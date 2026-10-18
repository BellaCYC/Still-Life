// StillLife helpers that don't touch the screen: the calculator, code colouring,
// and turning docs into Word / Markdown / text files (and Word files back into docs).
// Everything here runs offline.
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Calculator: a small, safe maths parser (never uses eval)
  // ---------------------------------------------------------------------------
  const FUNCS = {
    sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sinh: 1, cosh: 1, tanh: 1,
    ln: 1, log: 1, log2: 1, exp: 1, sqrt: 1, cbrt: 1, abs: 1, floor: 1, ceil: 1, round: 1,
    ncr: 2, npr: 2, max: -1, min: -1, mod: 2, gcd: 2, lcm: 2,
  };
  function tokenize(src) {
    const s = String(src)
      .replace(/×/g, "*").replace(/÷/g, "/").replace(/−|–/g, "-").replace(/π/g, " pi ")
      .replace(/√/g, " sqrt ").replace(/∛/g, " cbrt ").replace(/²/g, "^2").replace(/³/g, "^3")
      .replace(/sin⁻¹/g, "asin").replace(/cos⁻¹/g, "acos").replace(/tan⁻¹/g, "atan")
      .replace(/ /g, " ");
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (num) { out.push({ t: "n", v: parseFloat(num[0]) }); i += num[0].length; continue; }
      const word = /^(log2|[a-z]+)/i.exec(s.slice(i));
      if (word) { out.push({ t: "w", v: word[0].toLowerCase() }); i += word[0].length; continue; }
      if ("+-*/^%!(),".includes(c)) { out.push({ t: c }); i++; continue; }
      throw new Error("I don't understand “" + c + "”");
    }
    return out;
  }
  function fact(n) {
    if (n < 0 || n !== Math.floor(n)) throw new Error("Factorial needs a whole number");
    if (n > 170) return Infinity;
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function calc(expr, opts) {
    const o = opts || {};
    const deg = o.deg !== false;
    const toRad = (x) => (deg ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (deg ? (x * 180) / Math.PI : x);
    const tk = tokenize(expr);
    let p = 0;
    const peek = () => tk[p];
    const take = (t) => { if (tk[p] && tk[p].t === t) return tk[p++]; return null; };
    // expression := term (('+'|'-') term)*
    function expression() {
      let v = term();
      for (;;) {
        if (take("+")) v += term();
        else if (take("-")) v -= term();
        else return v;
      }
    }
    // term := power (('*'|'/'|'%'| implicit) power)*
    function term() {
      let v = unary();
      for (;;) {
        if (take("*")) v *= unary();
        else if (take("/")) { const d = unary(); v /= d; }
        else if (peek() && peek().t === "%" && !(tk[p + 1] && (tk[p + 1].t === "n" || tk[p + 1].t === "(" || tk[p + 1].t === "w"))) { p++; v /= 100; }
        else if (take("%")) v %= unary();
        else if (peek() && peek().t === "w" && (peek().v === "c" || peek().v === "p") && tk[p + 1] && tk[p + 1].t === "n") {
          // 5C2 (combinations) and 5P2 (permutations), like a Casio
          const kind = tk[p++].v;
          const r = unary();
          v = kind === "c" ? fact(v) / (fact(r) * fact(v - r)) : fact(v) / fact(v - r);
        }
        else if (peek() && (peek().t === "n" || peek().t === "(" || peek().t === "w")) v *= unary(); // 2π, 3(4+5)
        else return v;
      }
    }
    function unary() {
      if (take("-")) return -unary();
      if (take("+")) return unary();
      return power();
    }
    function power() {
      let v = postfix();
      if (take("^")) v = Math.pow(v, unary());
      return v;
    }
    function postfix() {
      let v = atom();
      while (take("!")) v = fact(v);
      return v;
    }
    function args() {
      if (!take("(")) return [unary()];
      const list = [expression()];
      while (take(",")) list.push(expression());
      if (!take(")")) throw new Error("A bracket is missing");
      return list;
    }
    function atom() {
      const t = tk[p++];
      if (!t) throw new Error("The sum isn't finished");
      if (t.t === "n") return t.v;
      if (t.t === "(") {
        const v = expression();
        if (!take(")")) throw new Error("A bracket is missing");
        return v;
      }
      if (t.t === "w") {
        if (t.v === "pi") return Math.PI;
        if (t.v === "e") return Math.E;
        if (t.v === "ans") return o.ans || 0;
        const f = t.v === "c" ? "ncr" : t.v === "p" ? "npr" : t.v;
        if (FUNCS[f] === undefined) throw new Error("I don't know “" + t.v + "”");
        const a = args();
        const x = a[0];
        switch (f) {
          case "sin": return Math.sin(toRad(x));
          case "cos": return Math.cos(toRad(x));
          case "tan": return Math.tan(toRad(x));
          case "asin": return fromRad(Math.asin(x));
          case "acos": return fromRad(Math.acos(x));
          case "atan": return fromRad(Math.atan(x));
          case "sinh": return Math.sinh(x);
          case "cosh": return Math.cosh(x);
          case "tanh": return Math.tanh(x);
          case "ln": return Math.log(x);
          case "log": return a.length > 1 ? Math.log(a[1]) / Math.log(x) : Math.log10(x);
          case "log2": return Math.log2(x);
          case "exp": return Math.exp(x);
          case "sqrt": return Math.sqrt(x);
          case "cbrt": return Math.cbrt(x);
          case "abs": return Math.abs(x);
          case "floor": return Math.floor(x);
          case "ceil": return Math.ceil(x);
          case "round": return Math.round(x);
          case "max": return Math.max(...a);
          case "min": return Math.min(...a);
          case "mod": return x % a[1];
          case "gcd": return gcd(x, a[1]);
          case "lcm": return Math.abs(x * a[1]) / gcd(x, a[1]);
          case "ncr": return fact(x) / (fact(a[1]) * fact(x - a[1]));
          case "npr": return fact(x) / fact(x - a[1]);
        }
      }
      throw new Error("The sum isn't finished");
    }
    if (!tk.length) throw new Error("Type a sum first");
    const v = expression();
    if (p < tk.length) throw new Error("Something extra is at the end");
    if (Number.isNaN(v)) throw new Error("That has no answer");
    return v;
  }
  function formatNumber(v) {
    if (!isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "Error";
    if (Math.abs(v) < 1e-12) return "0";
    const abs = Math.abs(v);
    if (abs >= 1e12 || abs < 1e-6) {
      const [m, e] = v.toExponential(8).split("e");
      return parseFloat(m) + " × 10^" + parseInt(e, 10);
    }
    return String(parseFloat(v.toPrecision(12)));
  }

  // ---------------------------------------------------------------------------
  // Code colouring (a light highlighter for the common school languages)
  // ---------------------------------------------------------------------------
  const KEYWORDS = {
    javascript: "break case catch class const continue default delete do else export extends finally for function if import in instanceof let new of return switch this throw try typeof var void while yield async await null undefined true false",
    python: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print",
    cpp: "auto bool break case catch char class const continue default delete do double else enum false float for if include int long namespace new nullptr private protected public return short signed sizeof static struct switch template this throw true try typedef unsigned using virtual void while std cout cin endl string vector",
    c: "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while include printf scanf",
    java: "abstract boolean break byte case catch char class continue default do double else extends false final finally float for if implements import instanceof int interface long new null package private protected public return short static String super switch this throw throws true try void while System out println",
    csharp: "abstract bool break byte case catch char class const continue decimal default do double else enum false finally float for foreach if int interface internal is long namespace new null object out override private protected public return static string struct switch this throw true try using var virtual void while Console WriteLine",
    go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil fmt Println",
    rust: "as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while println",
    ruby: "begin break case class def do else elsif end ensure false for if in module next nil not or puts redo rescue retry return self super then true unless until when while yield",
  };
  const ALIAS = { js: "javascript", node: "javascript", typescript: "javascript", ts: "javascript", py: "python", "c++": "cpp", "c#": "csharp", cs: "csharp" };
  function escapeHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function highlight(code, lang) {
    const l = ALIAS[lang] || lang;
    const kw = new Set((KEYWORDS[l] || KEYWORDS.javascript).split(" "));
    const hashComment = l === "python" || l === "ruby";
    const re = hashComment
      ? /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g
      : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|^\s*#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/gm;
    let out = "";
    let last = 0;
    code.replace(re, (m, com, str, num, word, idx) => {
      out += escapeHtml(code.slice(last, idx));
      if (com) out += '<span class="tk-c">' + escapeHtml(m) + "</span>";
      else if (str) out += '<span class="tk-s">' + escapeHtml(m) + "</span>";
      else if (num) out += '<span class="tk-n">' + m + "</span>";
      else if (kw.has(word)) out += '<span class="tk-k">' + m + "</span>";
      else if (code[idx + m.length] === "(") out += '<span class="tk-f">' + m + "</span>";
      else out += m;
      last = idx + m.length;
      return m;
    });
    return out + escapeHtml(code.slice(last));
  }

  // ---------------------------------------------------------------------------
  // Zip files (Word files are zips): write, and read with the browser's inflater
  // ---------------------------------------------------------------------------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const enc = new TextEncoder();
  // files: [{ name, data: string | Uint8Array }] -> Uint8Array (stored, no compression)
  function zip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cenSize = central.reduce((n, a) => n + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of all) { out.set(a, at); at += a.length; }
    return out;
  }
  async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // Uint8Array -> { name: Uint8Array }
  async function unzip(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("This isn't a Word file");
    const count = dv.getUint16(eocd + 10, true);
    let at = dv.getUint32(eocd + 16, true);
    const out = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(at, true) !== 0x02014b50) break;
      const method = dv.getUint16(at + 10, true);
      const size = dv.getUint32(at + 20, true);
      const nameLen = dv.getUint16(at + 28, true);
      const extraLen = dv.getUint16(at + 30, true);
      const commentLen = dv.getUint16(at + 32, true);
      const localAt = dv.getUint32(at + 42, true);
      const name = dec.decode(buf.subarray(at + 46, at + 46 + nameLen));
      const lNameLen = dv.getUint16(localAt + 26, true);
      const lExtraLen = dv.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + size);
      out[name] = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
      at += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Doc -> Word (.docx)
  // ---------------------------------------------------------------------------
  const xmlEsc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function rgbHex(c) {
    if (!c) return null;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c);
    if (m) {
      if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
      return [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("");
    }
    const h = /^#([0-9a-f]{6})$/i.exec(c);
    return h ? h[1] : null;
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // doc: { title, html } -> Uint8Array (.docx)
  function toDocx(doc) {
    const parsed = new DOMParser().parseFromString("<body>" + (doc.html || "") + "</body>", "text/html").body;
    const media = [];
    let body = "";
    let numbered = false;
    const para = (inner, props) => "<w:p>" + (props ? "<w:pPr>" + props + "</w:pPr>" : "") + inner + "</w:p>";
    function runs(node, fmt) {
      let out = "";
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          const t = ch.textContent.replace(/ /g, " ");
          if (!t) continue;
          let rpr = "";
          if (fmt.b) rpr += "<w:b/>";
          if (fmt.i) rpr += "<w:i/>";
          if (fmt.u) rpr += '<w:u w:val="single"/>';
          if (fmt.s) rpr += "<w:strike/>";
          if (fmt.sup) rpr += '<w:vertAlign w:val="superscript"/>';
          if (fmt.sub) rpr += '<w:vertAlign w:val="subscript"/>';
          if (fmt.color) rpr += '<w:color w:val="' + fmt.color + '"/>';
          if (fmt.hl) rpr += '<w:shd w:val="clear" w:color="auto" w:fill="' + fmt.hl + '"/>';
          out += "<w:r>" + (rpr ? "<w:rPr>" + rpr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + xmlEsc(t) + "</w:t></w:r>";
        } else if (ch.nodeType === 1) {
          const tag = ch.tagName;
          if (tag === "BR") { out += "<w:r><w:br/></w:r>"; continue; }
          if (tag === "IMG") { out += image(ch); continue; }
          const f = Object.assign({}, fmt);
          const st = ch.style || {};
          if (tag === "B" || tag === "STRONG" || /bold|[6-9]00/.test(st.fontWeight || "")) f.b = true;
          if (tag === "I" || tag === "EM" || st.fontStyle === "italic") f.i = true;
          if (tag === "U" || /underline/.test(st.textDecoration || "")) f.u = true;
          if (tag === "S" || tag === "STRIKE" || /line-through/.test(st.textDecoration || "")) f.s = true;
          if (tag === "SUP") f.sup = true;
          if (tag === "SUB") f.sub = true;
          const col = rgbHex(st.color || ch.getAttribute("color"));
          if (col) f.color = col;
          const bg = rgbHex(st.backgroundColor);
          if (bg) f.hl = bg;
          out += runs(ch, f);
        }
      }
      return out;
    }
    function image(img) {
      const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.*)$/i.exec(img.getAttribute("src") || "");
      if (!m || m[1].toLowerCase() === "webp") return "";
      const ext = m[1].toLowerCase() === "jpg" ? "jpeg" : m[1].toLowerCase();
      const id = media.length + 1;
      media.push({ name: "word/media/image" + id + "." + ext, data: b64ToBytes(m[2].replace(/\s/g, "")), ext });
      const pct = parseFloat((/width:\s*([\d.]+)%/.exec(img.getAttribute("style") || "") || [0, 100])[1]);
      const wpx = (img.naturalWidth || 600) ? Math.min(624, 6.24 * pct) : 624; // 6.24in text width at 100%
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : 0.62;
      const cx = Math.round(wpx * 9525);
      const cy = Math.round(wpx * ratio * 9525);
      return '<w:r><w:drawing><wp:inline><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Picture ' + id + '"/>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="image' + id + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="rIdImg' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }
    const align = (el) => {
      const a = el.style && el.style.textAlign;
      return a === "center" ? '<w:jc w:val="center"/>' : a === "right" ? '<w:jc w:val="right"/>' : a === "justify" ? '<w:jc w:val="both"/>' : "";
    };
    function block(el, listType, depth) {
      const tag = el.tagName;
      if (tag === "H1" || tag === "H2" || tag === "H3") {
        body += para(runs(el, {}), '<w:pStyle w:val="Heading' + tag[1] + '"/>' + align(el));
      } else if (tag === "UL" || tag === "OL") {
        if (tag === "OL") numbered = true;
        for (const li of el.children) block(li, tag, (depth || 0));
      } else if (tag === "LI") {
        const nested = Array.from(el.children).filter((c) => c.tagName === "UL" || c.tagName === "OL");
        const clone = el.cloneNode(true);
        clone.querySelectorAll("ul, ol").forEach((n) => n.remove());
        body += para(runs(clone, {}), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="' + Math.min(depth || 0, 8) + '"/><w:numId w:val="' + (listType === "OL" ? 2 : 1) + '"/></w:numPr>');
        for (const n of nested) for (const li of n.children) block(li, n.tagName, (depth || 0) + 1);
      } else if (tag === "BLOCKQUOTE") {
        body += para(runs(el, { i: true }), '<w:pStyle w:val="Quote"/>');
      } else if (tag === "HR") {
        if (el.classList.contains("sl-pb")) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        else body += para("", '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BBB2A6"/></w:pBdr>');
      } else if (tag === "PRE") {
        for (const line of el.textContent.split("\n")) body += para('<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(line) + "</w:t></w:r>", '<w:shd w:val="clear" w:color="auto" w:fill="F3F0EA"/>');
      } else {
        body += para(runs(el, {}), align(el));
      }
    }
    if (doc.title) body += para('<w:r><w:t xml:space="preserve">' + xmlEsc(doc.title) + "</w:t></w:r>", '<w:pStyle w:val="Title"/>');
    for (const el of parsed.children) block(el);
    if (!parsed.children.length && parsed.textContent.trim()) body += para(runs(parsed, {}));
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + ns + "><w:body>" + body +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const style = (id, name, ppr, rpr, extra) => '<w:style w:type="paragraph"' + (id === "Normal" ? ' w:default="1"' : "") + ' w:styleId="' + id + '"><w:name w:val="' + name + '"/>' + (extra || "") + (ppr ? "<w:pPr>" + ppr + "</w:pPr>" : "") + (rpr ? "<w:rPr>" + rpr + "</w:rPr>" : "") + "</w:style>";
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:eastAsia="Microsoft JhengHei"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      style("Normal", "Normal", "", "", '<w:qFormat/>') +
      style("Title", "Title", '<w:spacing w:after="240"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="52"/>', '<w:basedOn w:val="Normal"/><w:qFormat/>') +
      style("Heading1", "heading 1", '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="40"/>', '<w:basedOn w:val="Normal"/><w:qFormat/>') +
      style("Heading2", "heading 2", '<w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/>', "<w:b/><w:sz w:val=\"32\"/>", '<w:basedOn w:val="Normal"/><w:qFormat/>') +
      style("Heading3", "heading 3", '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/>', "<w:b/><w:sz w:val=\"26\"/>", '<w:basedOn w:val="Normal"/><w:qFormat/>') +
      style("Quote", "Quote", '<w:ind w:left="567"/><w:shd w:val="clear" w:color="auto" w:fill="EFEAF3"/>', "<w:i/>", '<w:basedOn w:val="Normal"/>') +
      style("ListParagraph", "List Paragraph", '<w:spacing w:after="60"/>', "", '<w:basedOn w:val="Normal"/>') +
      "</w:styles>";
    let lvls = (fmt, text) => {
      let x = "";
      for (let i = 0; i < 9; i++) {
        x += '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + (fmt === "bullet" ? "bullet" : ["decimal", "lowerLetter", "lowerRoman"][i % 3]) + '"/><w:lvlText w:val="' +
          (fmt === "bullet" ? ["•", "◦", "▪"][i % 3] : "%" + (i + 1) + ".") + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + i * 360) + '" w:hanging="360"/></w:pPr></w:lvl>';
      }
      return x;
    };
    const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0">' + lvls("bullet") + "</w:abstractNum>" +
      '<w:abstractNum w:abstractNumId="1">' + lvls("decimal") + "</w:abstractNum>" +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
    const exts = new Set(media.map((m) => m.ext));
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      Array.from(exts).map((e) => '<Default Extension="' + e + '" ContentType="image/' + e + '"/>').join("") +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      media.map((m, i) => '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + m.name.slice(5) + '"/>').join("") +
      "</Relationships>";
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      "<dc:title>" + xmlEsc(doc.title || "Untitled doc") + "</dc:title><dc:creator>StillLife</dc:creator>" +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + "Z</dcterms:created></cp:coreProperties>";
    void numbered;
    return zip([
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rels },
      { name: "docProps/core.xml", data: core },
      { name: "word/document.xml", data: documentXml },
      { name: "word/styles.xml", data: stylesXml },
      { name: "word/numbering.xml", data: numberingXml },
      { name: "word/_rels/document.xml.rels", data: docRels },
    ].concat(media));
  }

  // ---------------------------------------------------------------------------
  // Word (.docx) -> doc HTML, keeping headings (for the outline), lists, bold/italic/underline,
  // colours and pictures
  // ---------------------------------------------------------------------------
  const escText = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  async function fromDocx(buf) {
    const files = await unzip(buf);
    const dec = new TextDecoder();
    const docXml = files["word/document.xml"];
    if (!docXml) throw new Error("This Word file has no text");
    const xml = new DOMParser().parseFromString(dec.decode(docXml), "application/xml");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const relsXml = files["word/_rels/document.xml.rels"];
    const rels = {};
    if (relsXml) {
      const rx = new DOMParser().parseFromString(dec.decode(relsXml), "application/xml");
      for (const r of rx.getElementsByTagName("Relationship")) rels[r.getAttribute("Id")] = r.getAttribute("Target");
    }
    // Map style ids like "Heading1" or a renamed style to heading levels.
    const styleLevel = {};
    const stylesXml = files["word/styles.xml"];
    if (stylesXml) {
      const sx = new DOMParser().parseFromString(dec.decode(stylesXml), "application/xml");
      for (const st of sx.getElementsByTagNameNS(W, "style")) {
        const id = st.getAttributeNS(W, "styleId");
        const nameEl = st.getElementsByTagNameNS(W, "name")[0];
        const name = nameEl ? (nameEl.getAttributeNS(W, "val") || "").toLowerCase() : "";
        const outline = st.getElementsByTagNameNS(W, "outlineLvl")[0];
        if (name === "title") styleLevel[id] = 1;
        else if (/^heading ([1-9])$/.test(name)) styleLevel[id] = Math.min(3, +name.slice(8));
        else if (outline) styleLevel[id] = Math.min(3, +outline.getAttributeNS(W, "val") + 1);
      }
    }
    const val = (el, tag) => {
      const x = el && el.getElementsByTagNameNS(W, tag)[0];
      return x ? (x.getAttributeNS(W, "val") ?? "true") : null;
    };
    function imageHtml(run) {
      const blip = run.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "blip")[0];
      if (!blip) return "";
      const target = rels[blip.getAttributeNS(R, "embed")];
      if (!target) return "";
      const path = target.startsWith("/") ? target.slice(1) : "word/" + target.replace(/^\.\//, "");
      const bytes = files[path];
      const ext = (path.split(".").pop() || "").toLowerCase();
      const type = ext === "jpg" || ext === "jpeg" ? "jpeg" : ext === "png" ? "png" : ext === "gif" ? "gif" : null;
      if (!bytes || !type) return "";
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return '<img src="data:image/' + type + ";base64," + btoa(bin) + '" alt="" style="width: 100%">';
    }
    function runsHtml(p) {
      let out = "";
      for (const r of p.getElementsByTagNameNS(W, "r")) {
        if (r.getElementsByTagNameNS(W, "drawing").length || r.getElementsByTagNameNS(W, "pict").length) { out += imageHtml(r); continue; }
        let text = "";
        for (const ch of r.childNodes) {
          if (ch.localName === "t") text += escText(ch.textContent);
          else if (ch.localName === "tab") text += "&emsp;";
          else if (ch.localName === "br") text += "<br>";
        }
        if (!text) continue;
        const rpr = r.getElementsByTagNameNS(W, "rPr")[0];
        const on = (tag) => { const v = val(rpr, tag); return v !== null && v !== "false" && v !== "0" && v !== "none"; };
        if (on("b")) text = "<b>" + text + "</b>";
        if (on("i")) text = "<i>" + text + "</i>";
        if (on("u")) text = "<u>" + text + "</u>";
        if (on("strike")) text = "<s>" + text + "</s>";
        const va = val(rpr, "vertAlign");
        if (va === "superscript") text = "<sup>" + text + "</sup>";
        if (va === "subscript") text = "<sub>" + text + "</sub>";
        const color = val(rpr, "color");
        if (color && /^[0-9a-f]{6}$/i.test(color) && color.toLowerCase() !== "000000") text = '<span style="color: #' + color + '">' + text + "</span>";
        out += text;
      }
      return out;
    }
    let html = "";
    let list = null;
    const body = xml.getElementsByTagNameNS(W, "body")[0];
    for (const p of body ? body.children : []) {
      if (p.localName === "tbl") {
        // Tables become simple lines, one row each.
        if (list) { html += "</" + list + ">"; list = null; }
        for (const tr of p.getElementsByTagNameNS(W, "tr")) {
          const cells = Array.from(tr.getElementsByTagNameNS(W, "tc")).map((tc) => Array.from(tc.getElementsByTagNameNS(W, "p")).map(runsHtml).join(" "));
          html += "<p>" + cells.join(" &nbsp;|&nbsp; ") + "</p>";
        }
        continue;
      }
      if (p.localName !== "p") continue;
      const ppr = p.getElementsByTagNameNS(W, "pPr")[0];
      const style = val(ppr, "pStyle");
      const numPr = ppr && ppr.getElementsByTagNameNS(W, "numPr")[0];
      const inner = runsHtml(p);
      const jc = val(ppr, "jc");
      const alignCss = jc === "center" ? ' style="text-align: center"' : jc === "right" || jc === "end" ? ' style="text-align: right"' : jc === "both" ? ' style="text-align: justify"' : "";
      if (numPr && inner) {
        const numId = val(numPr, "numId");
        const want = numId === "2" || /number|decimal/i.test(style || "") ? "ol" : "ul";
        if (list !== want) { if (list) html += "</" + list + ">"; html += "<" + want + ">"; list = want; }
        html += "<li>" + inner + "</li>";
        continue;
      }
      if (list) { html += "</" + list + ">"; list = null; }
      const level = styleLevel[style] || (/^heading([1-3])$/i.test(style || "") ? +style.slice(-1) : 0);
      if (p.getElementsByTagNameNS(W, "br").length && Array.from(p.getElementsByTagNameNS(W, "br")).some((b) => b.getAttributeNS(W, "type") === "page") && !inner.replace(/<br>/g, "").trim()) {
        html += '<hr class="sl-pb">';
        continue;
      }
      if (!inner.trim()) continue;
      if (level) html += "<h" + level + alignCss + ">" + inner + "</h" + level + ">";
      else if (/quote/i.test(style || "")) html += "<blockquote>" + inner + "</blockquote>";
      else html += "<p" + alignCss + ">" + inner + "</p>";
    }
    if (list) html += "</" + list + ">";
    // The first heading becomes the doc title when the file starts with one.
    let title = "";
    const firstTitle = /^<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (firstTitle) {
      title = firstTitle[1].replace(/<[^>]+>/g, "");
      html = html.slice(firstTitle[0].length);
    }
    return { title, html };
  }

  // ---------------------------------------------------------------------------
  // Plain text / Markdown -> doc HTML, guessing headings so the outline fills itself in
  // ---------------------------------------------------------------------------
  function inlineMd(t) {
    return escText(t)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  function fromText(text, isMarkdown) {
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    let html = "";
    let list = null;
    let title = "";
    const close = () => { if (list) { html += "</" + list + ">"; list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) { close(); continue; }
      let m;
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        close();
        const lvl = Math.min(3, m[1].length);
        if (!title && lvl === 1 && !html) { title = m[2]; continue; }
        html += "<h" + lvl + ">" + inlineMd(m[2]) + "</h" + lvl + ">";
        continue;
      }
      if ((m = /^[-*•]\s+(.*)$/.exec(line))) {
        if (list !== "ul") { close(); html += "<ul>"; list = "ul"; }
        html += "<li>" + inlineMd(m[1]) + "</li>";
        continue;
      }
      if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) {
        if (list !== "ol") { close(); html += "<ol>"; list = "ol"; }
        html += "<li>" + inlineMd(m[1]) + "</li>";
        continue;
      }
      close();
      // The first short line of a plain text file is its title.
      if (!isMarkdown && !title && !html && line.length <= 80 && !/[.,;:!?。，；：！？]$/.test(line)) { title = line; continue; }
      if ((m = /^>\s?(.*)$/.exec(line))) { html += "<blockquote>" + inlineMd(m[1]) + "</blockquote>"; continue; }
      if (/^(-{3,}|\*{3,})$/.test(line)) { html += "<hr>"; continue; }
      // A short line with no ending punctuation, followed by a longer paragraph, is probably a heading.
      let next = "";
      for (let j = i + 1; j < lines.length && !next; j++) next = lines[j].trim();
      const prevBlank = i === 0 || !lines[i - 1].trim();
      if (!isMarkdown && prevBlank && line.length <= 60 && !/[.,;:!?。，；：！？]$/.test(line) && next.length > line.length && /^[A-Z0-9一-鿿第]/.test(line)) {
        if (!title && !html) { title = line; continue; }
        html += "<h2>" + inlineMd(line) + "</h2>";
        continue;
      }
      html += "<p>" + inlineMd(line) + "</p>";
    }
    close();
    return { title, html };
  }

  // ---------------------------------------------------------------------------
  // Doc HTML -> Markdown and plain text
  // ---------------------------------------------------------------------------
  function toMarkdown(doc) {
    const body = new DOMParser().parseFromString("<body>" + (doc.html || "") + "</body>", "text/html").body;
    const inline = (node) => {
      let out = "";
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) out += ch.textContent.replace(/ /g, " ");
        else if (ch.nodeType === 1) {
          const t = ch.tagName;
          const inner = inline(ch);
          if (t === "B" || t === "STRONG") out += "**" + inner + "**";
          else if (t === "I" || t === "EM") out += "*" + inner + "*";
          else if (t === "S" || t === "STRIKE") out += "~~" + inner + "~~";
          else if (t === "A") out += "[" + inner + "](" + ch.getAttribute("href") + ")";
          else if (t === "BR") out += "  \n";
          else if (t === "IMG") out += "![picture](picture)";
          else out += inner;
        }
      }
      return out;
    };
    let md = doc.title ? "# " + doc.title + "\n\n" : "";
    const walk = (el, depth) => {
      for (const ch of el.children) {
        const t = ch.tagName;
        if (/^H[1-3]$/.test(t)) md += "#".repeat(+t[1] + (doc.title ? 1 : 0)) + " " + inline(ch).trim() + "\n\n";
        else if (t === "UL" || t === "OL") {
          let n = 1;
          for (const li of ch.children) {
            const clone = li.cloneNode(true);
            clone.querySelectorAll("ul, ol").forEach((x) => x.remove());
            md += "  ".repeat(depth) + (t === "OL" ? n++ + ". " : "- ") + inline(clone).trim() + "\n";
            for (const sub of li.children) if (sub.tagName === "UL" || sub.tagName === "OL") walk({ children: [sub] }, depth + 1);
          }
          if (!depth) md += "\n";
        } else if (t === "BLOCKQUOTE") md += "> " + inline(ch).trim() + "\n\n";
        else if (t === "HR") md += "---\n\n";
        else if (t === "PRE") md += "```\n" + ch.textContent + "\n```\n\n";
        else md += inline(ch).trim() + "\n\n";
      }
    };
    walk(body, 0);
    return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  function toText(doc) {
    const body = new DOMParser().parseFromString("<body>" + (doc.html || "") + "</body>", "text/html").body;
    body.querySelectorAll("li").forEach((li) => li.prepend("• "));
    body.querySelectorAll("p, div, h1, h2, h3, li, blockquote, pre").forEach((n) => n.append("\n"));
    body.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
    return ((doc.title ? doc.title + "\n\n" : "") + body.textContent.replace(/ /g, " ")).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  window.SLTools = { calc, formatNumber, highlight, toDocx, fromDocx, fromText, toMarkdown, toText, zip, unzip };
})();
