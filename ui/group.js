// StillLife study groups: friends see each other's study time, chat and nudge.
// Messages travel through a free public MQTT relay. Everything is encrypted with a key
// made from the group code before it leaves your computer, so the relay (and anyone
// else on it) only ever sees scrambled bytes. Only people with the code can read it.
(function () {
  "use strict";

  const RELAYS = ["wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"];
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ---------------------------------------------------------------------------
  // A small MQTT 3.1.1 client over WebSocket (QoS 0, retained messages, last will)
  // ---------------------------------------------------------------------------
  function str(s) {
    const b = enc.encode(s);
    return concat([new Uint8Array([b.length >> 8, b.length & 255]), b]);
  }
  function bin(b) {
    return concat([new Uint8Array([b.length >> 8, b.length & 255]), b]);
  }
  function concat(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  function packet(type, body) {
    const len = [];
    let n = body.length;
    do { let byte = n % 128; n = Math.floor(n / 128); if (n > 0) byte |= 128; len.push(byte); } while (n > 0);
    return concat([new Uint8Array([type]), new Uint8Array(len), body]);
  }
  class Mqtt {
    constructor(url, clientId, will) {
      this.url = url;
      this.clientId = clientId;
      this.will = will; // { topic, payload: Uint8Array }
      this.buf = new Uint8Array(0);
      this.pid = 1;
      this.onmessage = null;
      this.onclose = null;
    }
    connect(timeoutMs) {
      return new Promise((resolve, reject) => {
        let ws;
        try { ws = new WebSocket(this.url, ["mqtt"]); } catch (e) { reject(e); return; }
        this.ws = ws;
        ws.binaryType = "arraybuffer";
        const timer = setTimeout(() => { try { ws.close(); } catch (e) {} reject(new Error("timeout")); }, timeoutMs || 9000);
        this.connack = (ok) => { clearTimeout(timer); if (ok) resolve(); else reject(new Error("refused")); };
        ws.onopen = () => {
          let flags = 0x02; // clean session
          const parts = [str("MQTT"), new Uint8Array([4]), null, new Uint8Array([0, 45]), str(this.clientId)];
          if (this.will) {
            flags |= 0x04 | 0x20; // will, will retain
            parts.push(str(this.will.topic), bin(this.will.payload));
          }
          parts[2] = new Uint8Array([flags]);
          ws.send(packet(0x10, concat(parts)));
          this.ping = setInterval(() => { try { ws.send(new Uint8Array([0xc0, 0])); } catch (e) {} }, 30000);
        };
        ws.onmessage = (ev) => this.read(new Uint8Array(ev.data));
        ws.onerror = () => {};
        ws.onclose = () => {
          clearInterval(this.ping);
          clearTimeout(timer);
          reject(new Error("closed"));
          if (this.onclose) this.onclose();
        };
      });
    }
    read(chunk) {
      this.buf = concat([this.buf, chunk]);
      for (;;) {
        if (this.buf.length < 2) return;
        let mult = 1;
        let len = 0;
        let i = 1;
        let byte;
        do {
          if (i >= this.buf.length) return;
          byte = this.buf[i++];
          len += (byte & 127) * mult;
          mult *= 128;
        } while (byte & 128);
        if (this.buf.length < i + len) return;
        const type = this.buf[0];
        const body = this.buf.subarray(i, i + len);
        this.buf = this.buf.slice(i + len);
        const kind = type >> 4;
        if (kind === 2) this.connack(body[1] === 0);
        else if (kind === 3) {
          const tl = (body[0] << 8) | body[1];
          const topic = dec.decode(body.subarray(2, 2 + tl));
          let at = 2 + tl;
          if ((type >> 1) & 3) at += 2; // QoS > 0 has a packet id
          if (this.onmessage) this.onmessage(topic, body.slice(at), !!(type & 1));
        }
      }
    }
    subscribe(topics) {
      const id = this.pid++ & 0xffff || 1;
      const parts = [new Uint8Array([id >> 8, id & 255])];
      for (const t of topics) parts.push(str(t), new Uint8Array([0]));
      this.ws.send(packet(0x82, concat(parts)));
    }
    publish(topic, payload, retain) {
      if (!this.ws || this.ws.readyState !== 1) return false;
      this.ws.send(packet(0x30 | (retain ? 1 : 0), concat([str(topic), payload])));
      return true;
    }
    close() {
      clearInterval(this.ping);
      try { this.ws.send(new Uint8Array([0xe0, 0])); } catch (e) {}
      try { this.ws.onclose = null; this.ws.close(); } catch (e) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Encryption: AES-GCM with a key made from the group code
  // ---------------------------------------------------------------------------
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  async function groupKeys(code) {
    const norm = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const topicHash = hex(await crypto.subtle.digest("SHA-256", enc.encode("stilllife-topic:" + norm))).slice(0, 32);
    const base = await crypto.subtle.importKey("raw", enc.encode(norm), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("stilllife-group-v1"), iterations: 150000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    return { topic: "stilllife/v1/" + topicHash, key };
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
    return concat([iv, ct]);
  }
  async function open(key, bytes) {
    if (!bytes || bytes.length < 29) return null;
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
      return JSON.parse(dec.decode(pt));
    } catch (e) {
      return null; // not ours, or damaged
    }
  }

  // Group codes look like SL-7KQ2-M9XA-4FDT-HP3N (no 0/O or 1/I to mix up).
  function newCode() {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = crypto.getRandomValues(new Uint8Array(16));
    let s = "";
    for (let i = 0; i < 16; i++) { s += abc[r[i] % abc.length]; if (i % 4 === 3 && i < 15) s += "-"; }
    return "SL-" + s;
  }
  const validCode = (c) => /^SL-?([A-Z2-9]{4}-?){4}$/i.test(String(c).trim().replace(/\s/g, ""));

  // ---------------------------------------------------------------------------
  // A group session: presence (who is studying), chat, nudges
  // ---------------------------------------------------------------------------
  // opts: { code, me: { id, name }, relays?, onEvent(type, data) }
  function join(opts) {
    const me = opts.me;
    const relays = opts.relays || RELAYS;
    let keys = null;
    let mq = null;
    let closed = false;
    let relayIndex = 0;
    let retry = 1000;
    let status = null;
    const myHistory = [];
    const emit = (t, d) => { try { opts.onEvent(t, d); } catch (e) { console.error(e); } };

    async function start() {
      keys = await groupKeys(opts.code);
      connect();
    }
    async function connect() {
      if (closed) return;
      emit("connection", { state: "connecting" });
      const offline = await seal(keys.key, Object.assign({}, status || { id: me.id, name: me.name }, { state: "offline", t: Date.now() }));
      const client = new Mqtt(relays[relayIndex % relays.length], "sl-" + me.id.slice(0, 10) + "-" + Math.random().toString(36).slice(2, 8),
        { topic: keys.topic + "/p/" + me.id, payload: offline });
      client.onmessage = onMessage;
      client.onclose = () => {
        if (mq !== client || closed) return;
        mq = null;
        emit("connection", { state: "offline" });
        setTimeout(connect, retry);
        retry = Math.min(retry * 2, 30000);
      };
      try {
        await client.connect();
      } catch (e) {
        relayIndex++;
        emit("connection", { state: "offline" });
        if (!closed) setTimeout(connect, retry);
        retry = Math.min(retry * 2, 30000);
        return;
      }
      mq = client;
      retry = 1000;
      client.subscribe([keys.topic + "/p/+", keys.topic + "/c", keys.topic + "/h/+", keys.topic + "/n/" + me.id]);
      emit("connection", { state: "online", relay: client.url });
      if (status) publishStatus();
    }
    async function onMessage(topic, payload) {
      const rest = topic.slice(keys.topic.length + 1);
      if (!payload.length) {
        if (rest.startsWith("p/")) emit("gone", { id: rest.slice(2) });
        return;
      }
      const msg = await open(keys.key, payload);
      if (!msg) return;
      if (rest.startsWith("p/")) emit("presence", msg);
      else if (rest === "c") emit("chat", msg);
      else if (rest.startsWith("h/") && Array.isArray(msg.list)) for (const m of msg.list) emit("chat", Object.assign({ old: true }, m));
      else if (rest.startsWith("n/")) emit("nudge", msg);
    }
    async function publishStatus() {
      if (!mq || !status) return;
      mq.publish(keys.topic + "/p/" + me.id, await seal(keys.key, status), true);
    }
    start();
    return {
      setStatus(s) {
        status = Object.assign({ id: me.id, name: me.name }, s, { t: Date.now() });
        publishStatus();
      },
      async sendChat(text, extra) {
        const m = Object.assign({ mid: me.id.slice(0, 6) + Date.now().toString(36), id: me.id, name: me.name, text: String(text).slice(0, 1000), t: Date.now() }, extra || {});
        myHistory.push(m);
        while (myHistory.length > 30) myHistory.shift();
        if (!mq) return null;
        mq.publish(keys.topic + "/c", await seal(keys.key, m), false);
        // Keep my last messages on the relay (encrypted) so people who join later can read them.
        mq.publish(keys.topic + "/h/" + me.id, await seal(keys.key, { list: myHistory }), true);
        return m;
      },
      async nudge(toId, text) {
        if (!mq) return false;
        mq.publish(keys.topic + "/n/" + toId, await seal(keys.key, { from: me.id, name: me.name, text, t: Date.now() }), false);
        return true;
      },
      seedHistory(list) {
        for (const m of list) if (m.id === me.id) myHistory.push(m);
        while (myHistory.length > 30) myHistory.shift();
      },
      async leave(forget) {
        closed = true;
        if (mq) {
          if (forget) {
            // Remove my status and messages from the relay.
            mq.publish(keys.topic + "/p/" + me.id, new Uint8Array(0), true);
            mq.publish(keys.topic + "/h/" + me.id, new Uint8Array(0), true);
          } else if (status) {
            mq.publish(keys.topic + "/p/" + me.id, await seal(keys.key, Object.assign({}, status, { state: "offline", t: Date.now() })), true);
          }
          setTimeout(() => mq && mq.close(), 200);
        }
      },
      get online() { return !!mq; },
    };
  }

  window.SLGroup = { join, newCode, validCode, groupKeys, seal, open };
})();
