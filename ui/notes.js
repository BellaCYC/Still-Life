/* StillLife notes view — shared by the island plate and the full window.
 *
 * Usage: StillLifeNotes.mount(element, { label: "island" | "main", full: bool, onCounts(fn) })
 *
 * Saved data (notes.json): { "version": 2, "labels": [...], "notes": [...] }
 * - Agendas are quick checklist cards.
 * - Docs show as previews; opening one shows a full document page (in the full window).
 * Labels belong to the user: none by default, add / rename / recolour / delete freely.
 *
 * When StillLife runs as a plain web page (e.g. previewing), data falls back to localStorage.
 */
(function () {
  "use strict";

  const tauri = window.__TAURI__;
  const hasApp = !!(tauri && tauri.core);

  const COLORS = ["sage", "mist", "rose", "oat", "lilac", "clay", "celadon", "lavender"];
  const IMPORTANCE = { high: "High", medium: "Medium", low: "Low" };

  // ---------- small helpers ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => Date.now();
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else if (k === "value") node.value = v;
        else if (k === "checked") node.checked = !!v;
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children) if (c) node.append(c);
    return node;
  }
  function svg(path, size) {
    const s = size || 14;
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.display = "inline-flex";
    wrap.innerHTML =
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' + path + "</svg>";
    return wrap;
  }
  const ICON = {
    agenda: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>',
    pin: '<path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    view: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    color: '<path d="M6 20l6-16 6 16M8.5 14h7"/>',
    mark: '<path d="M9 11l-5 5v4h4l5-5M14 6l4 4M12 8l4 4 4-4-4-4z"/>',
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    hr: '<path d="M4 12h16"/>',
    outline: '<path d="M4 6h10M7 12h13M7 18h13M4 12h.01M4 18h.01"/>',
    print: '<path d="M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M11 5h6M7 19h6M14 5l-4 14"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    strike: '<path d="M5 12h14M16 6.5A4 3 0 0 0 8 8c0 4 8 3 8 7a4 3 0 0 1-8 1.5"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 14h2l-2 3h2"/>',
    pages: '<rect x="5" y="2.5" width="14" height="8" rx="1.5"/><rect x="5" y="13.5" width="14" height="8" rx="1.5"/>',
    find: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    grammar: '<path d="M4 17l4-11 4 11M5.5 13h5"/><path d="M13 15l3 3 5-6"/>',
    keys: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    draw: '<path d="M3 21l1-4L16 5a2.4 2.4 0 0 1 3.5 3.5L7.5 20z"/><path d="M14 7l3 3"/>',
    eraser: '<path d="M8 20h12M5.5 16.5l9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3L14 20H8z"/><path d="M11 11l5.5 5.5"/>',
    shapes: '<circle cx="8" cy="8" r="4.5"/><rect x="11" y="11" width="9" height="9" rx="1.5"/>',
    cursor: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
    omega: '<path d="M5 20h4v-2a7 7 0 1 1 6 0v2h4"/>',
    sup: '<path d="M4 8l8 10M12 8l-8 10"/><path d="M15 4.5a2 2 0 1 1 3.5 1.5L15 10h4.5"/>',
    sub: '<path d="M4 6l8 10M12 6L4 16"/><path d="M15 14.5a2 2 0 1 1 3.5 1.5L15 20h4.5"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
  };
  function todayStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function dueInfo(due) {
    if (!due) return null;
    const t = todayStr(0);
    if (due < t) return { text: "Overdue", cls: "overdue" };
    if (due === t) return { text: "Due today", cls: "overdue" };
    if (due === todayStr(1)) return { text: "Due tomorrow", cls: "due" };
    const d = new Date(due + "T00:00:00");
    return { text: "Due " + d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }), cls: "due" };
  }
  function ago(ts) {
    const mins = Math.round((now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + " h ago";
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  function escapeText(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- safe rich text ----------
  // Only simple formatting survives; anything else (scripts, styles, event handlers,
  // odd links) is stripped. Parsing happens in an inert document, so nothing runs.
  const ALLOWED = {
    P: ["style"], DIV: ["style"], BR: [], H1: ["style"], H2: ["style"], H3: ["style"], B: [], STRONG: [], I: [], EM: [], U: [],
    S: [], STRIKE: [], SUP: [], SUB: [], UL: [], OL: [], LI: ["style"], BLOCKQUOTE: ["style"], HR: ["class"], CODE: [], PRE: [], SPAN: ["style"],
    FONT: ["color"], A: ["href"], IMG: ["src", "alt", "style"],
  };
  const SAFE_IMG = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
  const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;
  // Only text colour, highlight and alignment survive inside style="".
  function safeStyle(value) {
    const keep = [];
    for (const part of String(value).split(";")) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      const prop = part.slice(0, i).trim().toLowerCase();
      const val = part.slice(i + 1).trim();
      if ((prop === "color" || prop === "background-color") && SAFE_COLOR.test(val)) keep.push(prop + ": " + val);
      else if (prop === "text-align" && /^(left|center|right|justify)$/i.test(val)) keep.push(prop + ": " + val.toLowerCase());
      else if (prop === "width" && /^(100|[1-9]\d?)(\.\d+)?%$/.test(val)) keep.push("width: " + val);
      else if (prop === "font-weight" && /^(bold|bolder|[6-9]00)$/i.test(val)) keep.push("font-weight: bold");
      else if (prop === "font-style" && /^italic$/i.test(val)) keep.push("font-style: italic");
      else if ((prop === "text-decoration" || prop === "text-decoration-line") && /(underline|line-through)/i.test(val)) {
        keep.push("text-decoration: " + (val.match(/underline|line-through/gi) || []).map((x) => x.toLowerCase()).join(" "));
      }
    }
    return keep.join("; ");
  }
  const DROP = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "VIDEO", "AUDIO"];
  function cleanNode(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        const tag = child.tagName.toUpperCase();
        if (DROP.includes(tag)) {
          child.remove();
        } else if (!(tag in ALLOWED)) {
          cleanNode(child);
          child.replaceWith(...Array.from(child.childNodes));
        } else {
          for (const attr of Array.from(child.attributes)) {
            let keep = ALLOWED[tag].includes(attr.name);
            if (keep && attr.name === "href") keep = /^(https?:|mailto:)/i.test(attr.value.trim());
            if (keep && attr.name === "color") keep = SAFE_COLOR.test(attr.value.trim());
            if (keep && attr.name === "class") keep = attr.value.trim() === "sl-pb"; // page break only
            if (keep && attr.name === "src") keep = SAFE_IMG.test(attr.value.trim()); // pictures stored inside the note only
            if (keep && attr.name === "style") {
              const clean = safeStyle(attr.value);
              if (clean) child.setAttribute("style", clean);
              else keep = false;
            }
            if (!keep) child.removeAttribute(attr.name);
          }
          if (tag === "IMG" && !child.getAttribute("src")) { child.remove(); continue; }
          cleanNode(child);
        }
      } else if (child.nodeType !== 3) {
        child.remove();
      }
    }
  }
  function cleanHtml(html) {
    const doc = new DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
    cleanNode(doc.body);
    return doc.body.innerHTML;
  }
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
    doc.body.querySelectorAll("p,div,h1,h2,h3,li,blockquote,br").forEach((n) => n.append(" "));
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }


  // ---------- rounded dropdown (replaces the browser's sharp-edged <select>) ----------
  // o = { label, options: [{ value, text, cls, hint }], value, onPick(value), keepFocus, onOpen, cls }
  function dropdown(o) {
    let value = o.value;
    let pop = null;
    let active = -1;
    const text = el("span", { class: "sl-dd-text" });
    const btn = el("button", {
      type: "button",
      class: "sl-dd-btn",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      "aria-label": o.label,
      title: o.label,
      // In the doc toolbar the text keeps focus, so the selection survives.
      onmousedown: (e) => { if (o.keepFocus) { if (o.onOpen) o.onOpen(); e.preventDefault(); } },
      onclick: () => (pop ? close() : open()),
      onkeydown: (e) => {
        if (pop) keys(e);
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
      },
    }, text, svg(ICON.chevron, 14));
    const wrap = el("div", { class: "sl-dd" + (o.cls ? " " + o.cls : "") }, btn);
    function show() {
      const opt = o.options.find((x) => x.value === value);
      text.textContent = opt ? opt.text : o.format ? o.format(value) : (o.options[0] || {}).text || "";
    }
    function open() {
      pop = el("div", { class: "sl-dd-pop", role: "listbox", "aria-label": o.label });
      o.options.forEach((opt, i) => {
        pop.append(el("div", {
          class: "sl-dd-opt" + (opt.cls ? " " + opt.cls : "") + (opt.value === value ? " on" : ""),
          role: "option",
          "aria-selected": opt.value === value ? "true" : "false",
          onmousedown: (e) => e.preventDefault(),
          onmouseenter: () => setActive(i),
          onclick: () => pick(opt.value),
        }, el("span", { class: "sl-dd-label", text: opt.text }), opt.hint ? el("span", { class: "sl-dd-hint", text: opt.hint }) : null));
      });
      wrap.append(pop);
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      setActive(o.options.findIndex((x) => x.value === value));
      if (pop.getBoundingClientRect().bottom > window.innerHeight - 8) pop.classList.add("up");
      setTimeout(() => document.addEventListener("mousedown", away, true), 0);
      document.addEventListener("keydown", keys, true);
    }
    function close() {
      if (!pop) return;
      pop.remove();
      pop = null;
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", away, true);
      document.removeEventListener("keydown", keys, true);
    }
    function away(e) { if (!wrap.contains(e.target)) close(); }
    function setActive(i) {
      active = i;
      if (pop) Array.from(pop.children).forEach((c, j) => c.classList.toggle("active", j === i));
    }
    function keys(e) {
      if (!pop) return;
      if (e.key === "ArrowDown") setActive(Math.min(o.options.length - 1, active + 1));
      else if (e.key === "ArrowUp") setActive(Math.max(0, active - 1));
      else if (e.key === "Enter") { if (active >= 0) pick(o.options[active].value); }
      else if (e.key === "Escape") close();
      else { if (e.key === "Tab") close(); return; }
      e.preventDefault();
      e.stopPropagation();
    }
    function pick(v) { value = v; show(); close(); o.onPick(v); }
    show();
    return { el: wrap, set(v) { value = v; show(); }, close };
  }

  // ---------- grammar checker: English rules, runs offline ----------
  const SPELLING = {
    alot: "a lot", definately: "definitely", definatly: "definitely", seperate: "separate", recieve: "receive",
    occured: "occurred", untill: "until", wich: "which", becuase: "because", beacuse: "because", thier: "their",
    teh: "the", beleive: "believe", goverment: "government", enviroment: "environment", accomodate: "accommodate",
    arguement: "argument", begining: "beginning", tommorow: "tomorrow", tommorrow: "tomorrow", tomorow: "tomorrow",
    wierd: "weird", truely: "truly", publically: "publicly", existance: "existence", independant: "independent",
    occurence: "occurrence", neccessary: "necessary", necesary: "necessary", succesful: "successful",
    successfull: "successful", irregardless: "regardless", embarass: "embarrass", calender: "calendar",
    concious: "conscious", experiance: "experience", freind: "friend", greatful: "grateful", knowlege: "knowledge",
    maintainance: "maintenance", noticable: "noticeable", persue: "pursue", posession: "possession",
    prefered: "preferred", recomend: "recommend", refered: "referred", relevent: "relevant", resturant: "restaurant",
    rythm: "rhythm", sentance: "sentence", suprise: "surprise", tounge: "tongue", writting: "writing",
  };
  function keepCase(orig, fix) {
    if (!fix) return fix;
    if (orig.length > 1 && orig === orig.toUpperCase() && /[A-Z]/.test(orig)) return fix.toUpperCase();
    if (/^[A-Z]/.test(orig)) return fix[0].toUpperCase() + fix.slice(1);
    return fix;
  }
  const PHRASES = [
    [/\b(could|should|would|must|might)\s+of\b/gi, (m) => m[1] + " have", "After “could”, “should” or “would”, write “have”, not “of”."],
    [/\b(more|less|better|worse|rather|other|bigger|smaller|faster|slower|greater|higher|lower|larger|older|younger|easier|harder|earlier|later)\s+then\b/gi, (m) => m[1] + " than", "Use “than” when comparing."],
    [/\byour\s+welcome\b/gi, () => "you're welcome", "Did you mean “you're” (you are)?"],
    [/\bits\s+(a|an|the|not|been|going|very|so|also|just|really|important|possible|impossible|hard|easy|true|okay|ok|fine|clear)\b/gi, (m) => "it's " + m[1], "Did you mean “it's” (it is)?"],
    [/\bit's\s+own\b/gi, () => "its own", "Use “its” (no apostrophe) to show belonging."],
    [/\b(he|she|it)\s+don't\b/gi, (m) => m[1] + " doesn't", "Use “doesn't” with he, she or it."],
    [/\b(he|she|it)\s+were\b(?!\s+to\b)/gi, (m) => m[1] + " was", "Use “was” with he, she or it."],
    [/\b(they|we|you)\s+was\b/gi, (m) => m[1] + " were", "Use “were” with they, we or you."],
    [/\b(he|she)\s+are\b/gi, (m) => m[1] + " is", "Use “is” with he or she."],
    [/\bI\s+is\b/g, () => "I am", "Use “am” with I."],
    [/(?<!\b(?:does|did|do|will|would|can|could|should|may|might|must|to|let|make|makes|made|help|helps|n't|not|doesn't|didn't)\s)\b(he|she|it)\s+have\b(?!\s+to\s+be\b)/gi, (m) => m[1] + " has", "Use “has” with he, she or it."],
    [/\bmore\s+(better|worse|easier|harder|faster|bigger|smaller|greater)\b/gi, (m) => m[1], "“More” isn't needed here."],
    [/\bbetween\s+you\s+and\s+I\b/gi, () => "between you and me", "After “between”, use “me”."],
    [/\b(am|is|are|was|were|be|been)\s+suppose\s+to\b/gi, (m) => m[1] + " supposed to", "Write “supposed to”."],
    [/\bcould\s+care\s+less\b/gi, () => "couldn't care less", "The phrase is “couldn't care less”."],
    [/\bfor\s+all\s+intensive\s+purposes\b/gi, () => "for all intents and purposes", "The phrase is “for all intents and purposes”."],
    [/\bthere\s+(own|homework|parents|friends|teacher|teachers|school|names?|house|car)\b/gi, (m) => "their " + m[1], "Did you mean “their” (belonging to them)?"],
    [/\bthey're\s+(own|homework|parents|friends|teacher|teachers|school|names?|house|car)\b/gi, (m) => "their " + m[1], "Did you mean “their” (belonging to them)?"],
  ];
  const ABBREV = /\b(e\.g|i\.e|etc|vs|approx|mr|mrs|ms|dr|prof|st|no|fig|cf|al|pp?|ca|jr|sr|inc|ltd)\.$/i;
  const FULLWIDTH = { "，": ",", "。": ".", "；": ";", "：": ":", "！": "!", "？": "?" };

  // Returns [{ start, end, fix, msg, orig }] for one block of text.
  function grammarCheck(raw, listItem) {
    const s = raw.replace(/ /g, " ");
    const out = [];
    function add(start, end, fix, msg) {
      const orig = s.slice(start, end);
      if (orig !== fix) out.push({ start, end, fix, msg, orig });
    }
    function each(re, fn) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s))) {
        fn(m);
        if (!m[0]) re.lastIndex++;
      }
    }

    // Common misspellings
    each(/[A-Za-z]+/g, (m) => {
      const fix = SPELLING[m[0].toLowerCase()];
      if (fix) add(m.index, m.index + m[0].length, keepCase(m[0], fix), "Spelling: did you mean “" + fix + "”?");
    });
    // Mixed-up words and phrases
    for (const [re, fix, msg] of PHRASES) each(re, (m) => add(m.index, m.index + m[0].length, keepCase(m[0], fix(m)), msg));

    // Repeated word: "the the"
    each(/\b([A-Za-z']+)(\s+)\1\b/gi, (m) => {
      if (["had", "that"].includes(m[1].toLowerCase())) return;
      add(m.index, m.index + m[0].length, m[1], "This word is repeated.");
    });

    // a / an
    each(/\b(a|an|A|An)\s+([A-Za-z][\w'-]*)/g, (m) => {
      const art = m[1];
      const word = m[2];
      const lw = word.toLowerCase();
      if (word.length > 1 && word === word.toUpperCase()) return; // acronyms: a NASA, an FBI
      if (/^(and|or|to|is|was|the|of|in|on|at)$/.test(lw)) return; // "a" used as a letter
      const before = s.slice(Math.max(0, m.index - 1), m.index);
      if (/[(\w'’-]/.test(before)) return;
      if (lw[0] === "u") return; // a university / an umbrella: too ambiguous
      const wantAn = ("aeio".includes(lw[0]) && !/^(one|once|eu|ewe)/.test(lw)) || /^(hour|honest|honou?r|heir)/.test(lw);
      const isAn = art.toLowerCase() === "an";
      if (wantAn === isAn) return;
      add(m.index, m.index + art.length, keepCase(art, wantAn ? "an" : "a"),
        wantAn ? "Use “an” before a vowel sound." : "Use “a” before a consonant sound.");
    });

    // Lowercase "i" on its own
    each(/(^|[^\w'’.])i(?=$|[\s,.;:!?)]|['’](?:m|ve|ll|d)\b)/g, (m) => {
      const p = m.index + m[1].length;
      if (s.slice(p, p + 3) === "i.e" || (m[1] === "(" && s[p + 1] === ")")) return;
      add(p, p + 1, "I", "“I” is always a capital letter.");
    });

    // Capital letter at the start of a sentence
    if (!listItem) {
      const f = s.search(/\S/);
      if (f >= 0 && /[a-z]/.test(s[f])) {
        const w = (s.slice(f).match(/^[\w.-]+/) || [""])[0];
        if (!/[A-Z]/.test(w) && !/^(e\.g|i\.e|etc|vs|http|www)/i.test(w) && !/\.\w/.test(w)) {
          add(f, f + 1, s[f].toUpperCase(), "Start a sentence with a capital letter.");
        }
      }
    }
    each(/([.!?])(\s+)([a-z])/g, (m) => {
      const before = s.slice(0, m.index + 1);
      if (m[1] === "." && (ABBREV.test(before) || /(\.\.|\d)\.$/.test(before) || /\b[a-z]\.$/i.test(before))) return;
      const p = m.index + m[1].length + m[2].length;
      const w = (s.slice(p).match(/^[\w-]+/) || [""])[0];
      if (/[A-Z]/.test(w)) return; // iPhone, eBay
      add(p, p + 1, m[3].toUpperCase(), "Start a sentence with a capital letter.");
    });

    // Spacing
    each(/(\S)( {2,})(?=\S)/g, (m) => add(m.index + 1, m.index + 1 + m[2].length, " ", "There's an extra space here."));
    each(/(\w)( +)([,.;:!?])(?=\s|$)/g, (m) => add(m.index + 1, m.index + 1 + m[2].length, "", "Remove the space before “" + m[3] + "”."));
    each(/(\w)( +)([,;])(?=[A-Za-z])/g, (m) => add(m.index + 1, m.index + 1 + m[2].length + 1, m[3] + " ", "The space goes after “" + m[3] + "”, not before."));
    each(/([a-z]{2,})([,;])([A-Za-z]{2,})/g, (m) => {
      const p = m.index + m[1].length;
      add(p, p + 1, m[2] + " ", "Add a space after “" + m[2] + "”.");
    });
    each(/([A-Za-z][a-z]{2,})([.!?])([A-Z][a-z]+)/g, (m) => {
      const p = m.index + m[1].length;
      add(p, p + 1, m[2] + " ", "Add a space after “" + m[2] + "”.");
    });
    // Chinese punctuation inside English text
    each(/([A-Za-z])\s*([，。；：！？])\s*(?=[A-Za-z])/g, (m) => {
      const p = m.index + 1;
      add(p, m.index + m[0].length, FULLWIDTH[m[2]] + " ", "Use English punctuation in English text.");
    });

    // Keep the first suggestion where two overlap.
    out.sort((a, b) => a.start - b.start || b.end - a.end);
    const clean = [];
    let last = -1;
    for (const x of out) {
      if (x.start >= last) { clean.push(x); last = Math.max(x.end, x.start + 1); }
    }
    return clean;
  }

  // ---------- special characters and equations ----------
  const MARK_NAMES = { "́": "acute", "̀": "grave", "̂": "circumflex", "̈": "umlaut", "̃": "tilde", "̧": "cedilla", "̊": "ring" };
  function accentName(ch) {
    const d = ch.normalize("NFD");
    const base = d[0];
    const mark = MARK_NAMES[d[1]] || "";
    return (base === base.toUpperCase() ? "capital " : "") + base.toLowerCase() + " " + mark;
  }
  const accentItems = Array.from("áéíóúñüÁÉÍÓÚÑÜàâçèêëîïôùûÿÀÂÇÈÊËÎÏÔÙÛäöÄÖãõåÅ").map((c) => [c, accentName(c)])
    .concat([["¿", "inverted question mark spanish"], ["¡", "inverted exclamation spanish"], ["ß", "sharp s eszett german"],
      ["æ", "ae ligature"], ["Æ", "capital ae ligature"], ["œ", "oe ligature french"], ["Œ", "capital oe ligature"],
      ["ø", "o slash"], ["Ø", "capital o slash"], ["«", "left guillemet quote french"], ["»", "right guillemet quote french"]]);
  const GREEK_NAMES = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega"];
  const greekLower = "αβγδεζηθικλμνξοπρστυφχψω";
  const greekUpper = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
  const GREEK_LATIN_LOOKALIKE = "ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ"; // capitals that look like Latin letters
  const greekItems = Array.from(greekLower).map((c, i) => [c, GREEK_NAMES[i]])
    .concat(Array.from(greekUpper).map((c, i) => [c, "capital " + GREEK_NAMES[i]]).filter((x) => !GREEK_LATIN_LOOKALIKE.includes(x[0])));
  const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ";
  const SUBS = "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓ";
  const SUP_FROM = "0123456789+-=()ni";
  const SUB_FROM = "0123456789+-=()aeox";
  const SYMBOLS = [
    { id: "accents", name: "Accents", items: accentItems },
    { id: "greek", name: "Greek", items: greekItems },
    { id: "maths", name: "Maths", items: [
      ["±", "plus minus"], ["×", "times multiply"], ["÷", "divide"], ["−", "minus"], ["≠", "not equal"], ["≈", "approximately"],
      ["≡", "identical congruent"], ["≤", "less than or equal"], ["≥", "greater than or equal"], ["∞", "infinity"],
      ["√", "square root"], ["∛", "cube root"], ["∑", "sum sigma"], ["∏", "product"], ["∫", "integral"], ["∬", "double integral"],
      ["∮", "contour integral"], ["∂", "partial derivative"], ["∇", "nabla del"], ["Δ", "delta change"], ["°", "degree"],
      ["′", "prime minute"], ["″", "double prime second"], ["π", "pi"], ["∝", "proportional"], ["∠", "angle"], ["⊥", "perpendicular"],
      ["∥", "parallel"], ["△", "triangle"], ["∴", "therefore"], ["∵", "because"], ["∈", "element of in set"], ["∉", "not element of"],
      ["⊂", "subset"], ["⊆", "subset or equal"], ["∪", "union"], ["∩", "intersection"], ["∅", "empty set"], ["∀", "for all"],
      ["∃", "there exists"], ["¬", "not logic"], ["∧", "and logic"], ["∨", "or logic"], ["ℕ", "natural numbers"], ["ℤ", "integers"],
      ["ℚ", "rational numbers"], ["ℝ", "real numbers"], ["ℂ", "complex numbers"], ["½", "half fraction"], ["⅓", "third fraction"],
      ["¼", "quarter fraction"], ["¾", "three quarters fraction"], ["⅔", "two thirds fraction"], ["‰", "per mille"], ["·", "dot multiply"],
      ["∘", "compose ring"], ["⌊", "floor left"], ["⌋", "floor right"], ["⌈", "ceiling left"], ["⌉", "ceiling right"], ["∼", "similar tilde"]] },
    { id: "scripts", name: "Super / sub", items: Array.from(SUPS).map((c, i) => [c, "superscript power " + SUP_FROM[i]])
      .concat(Array.from(SUBS).map((c, i) => [c, "subscript " + SUB_FROM[i]])) },
    { id: "arrows", name: "Arrows", items: [
      ["→", "right arrow yields"], ["←", "left arrow"], ["↑", "up arrow gas"], ["↓", "down arrow precipitate"], ["↔", "left right arrow"],
      ["⇒", "implies double arrow"], ["⇐", "double left arrow"], ["⇔", "if and only if"], ["⇌", "equilibrium reversible"],
      ["⇋", "equilibrium left"], ["↗", "up right arrow increase"], ["↘", "down right arrow decrease"], ["↖", "up left arrow"],
      ["↙", "down left arrow"], ["⟶", "long right arrow"], ["↦", "maps to"], ["↻", "clockwise"], ["↺", "anticlockwise"]] },
    { id: "chemistry", name: "Chemistry", items: [
      ["→", "yields reaction arrow"], ["⇌", "equilibrium"], ["↑", "gas given off"], ["↓", "precipitate"], ["Δ", "heat delta"],
      ["°", "degree"], ["℃", "degrees celsius"], ["·", "hydrate dot"], ["⁺", "positive charge"], ["⁻", "negative charge"],
      ["²⁺", "2+ charge"], ["²⁻", "2- charge"], ["³⁺", "3+ charge"], ["³⁻", "3- charge"], ["e⁻", "electron"], ["Å", "angstrom"],
      ["‡", "transition state"], ["H₂O", "water"], ["CO₂", "carbon dioxide"], ["O₂", "oxygen"], ["H₂", "hydrogen"], ["N₂", "nitrogen"],
      ["NaCl", "sodium chloride salt"], ["HCl", "hydrochloric acid"], ["H₂SO₄", "sulfuric acid"], ["HNO₃", "nitric acid"],
      ["NaOH", "sodium hydroxide"], ["NH₃", "ammonia"], ["CH₄", "methane"], ["C₆H₁₂O₆", "glucose"], ["CaCO₃", "calcium carbonate"],
      ["H₂O₂", "hydrogen peroxide"], ["KMnO₄", "potassium permanganate"], ["C₂H₅OH", "ethanol"], ["Fe₂O₃", "iron oxide rust"],
      ["NH₄⁺", "ammonium"], ["OH⁻", "hydroxide"], ["H₃O⁺", "hydronium"], ["H⁺", "hydrogen ion proton"], ["SO₄²⁻", "sulfate"],
      ["NO₃⁻", "nitrate"], ["CO₃²⁻", "carbonate"], ["PO₄³⁻", "phosphate"]] },
    { id: "physics", name: "Physics", items: [
      ["Ω", "ohm omega"], ["µ", "micro mu"], ["λ", "wavelength lambda"], ["ν", "frequency nu"], ["ħ", "h bar reduced planck"],
      ["ε₀", "permittivity epsilon zero"], ["μ₀", "permeability mu zero"], ["ρ", "density rho"], ["θ", "angle theta"], ["ω", "angular velocity omega"],
      ["τ", "torque tau"], ["Φ", "flux phi"], ["η", "efficiency eta"], ["°C", "degrees celsius"], ["K", "kelvin"], ["m/s²", "metres per second squared"],
      ["c = 3.00 × 10⁸ m/s", "speed of light constant"], ["g = 9.81 m/s²", "gravity acceleration constant"],
      ["G = 6.67 × 10⁻¹¹ N·m²/kg²", "gravitational constant"], ["h = 6.63 × 10⁻³⁴ J·s", "planck constant"],
      ["e = 1.60 × 10⁻¹⁹ C", "elementary charge constant"], ["k = 8.99 × 10⁹ N·m²/C²", "coulomb constant"],
      ["Nₐ = 6.02 × 10²³ mol⁻¹", "avogadro constant"], ["R = 8.31 J/(mol·K)", "gas constant"],
      ["k_B = 1.38 × 10⁻²³ J/K", "boltzmann constant"], ["mₑ = 9.11 × 10⁻³¹ kg", "electron mass constant"]] },
    { id: "more", name: "Currency & more", items: [
      ["€", "euro"], ["£", "pound"], ["¥", "yen yuan"], ["₩", "won"], ["NT$", "new taiwan dollar"], ["¢", "cent"], ["©", "copyright"],
      ["®", "registered"], ["™", "trademark"], ["§", "section"], ["¶", "paragraph pilcrow"], ["†", "dagger"], ["•", "bullet"],
      ["…", "ellipsis"], ["—", "em dash"], ["–", "en dash"], ["“", "left double quote"], ["”", "right double quote"],
      ["‘", "left single quote"], ["’", "right single quote apostrophe"], ["✓", "check tick"], ["✗", "cross"], ["★", "star"],
      ["☆", "star outline"], ["♪", "music note"], ["♥", "heart"]] },
  ];
  const EQUATIONS = {
    Maths: [
      ["Arithmetic series", "Sₙ = n(a₁ + aₙ)/2"], ["Binomial square", "(a + b)² = a² + 2ab + b²"], ["Circle area", "A = πr²"],
      ["Circumference", "C = 2πr"], ["Compound interest", "A = P(1 + r/n)ⁿᵗ"], ["Derivative (power rule)", "d/dx xⁿ = nxⁿ⁻¹"],
      ["Difference of squares", "a² − b² = (a + b)(a − b)"], ["Distance formula", "d = √((x₂ − x₁)² + (y₂ − y₁)²)"],
      ["Euler's identity", "e^(iπ) + 1 = 0"], ["Geometric series", "Sₙ = a₁(1 − rⁿ)/(1 − r)"], ["Integral (power rule)", "∫xⁿ dx = xⁿ⁺¹/(n + 1) + C"],
      ["Law of cosines", "c² = a² + b² − 2ab cos C"], ["Law of sines", "a/sin A = b/sin B = c/sin C"], ["Logarithm product", "log(ab) = log a + log b"],
      ["Midpoint", "M = ((x₁ + x₂)/2, (y₁ + y₂)/2)"], ["Pythagorean identity", "sin²θ + cos²θ = 1"], ["Pythagorean theorem", "a² + b² = c²"],
      ["Quadratic formula", "x = (−b ± √(b² − 4ac)) / 2a"], ["Slope", "m = (y₂ − y₁)/(x₂ − x₁)"], ["Sphere volume", "V = ⁴⁄₃πr³"],
    ],
    Physics: [
      ["Centripetal acceleration", "a = v²/r"], ["Coulomb's law", "F = kq₁q₂/r²"], ["Density", "ρ = m/V"], ["Electric power", "P = IV"],
      ["Gravitation", "F = Gm₁m₂/r²"], ["Hooke's law", "F = −kx"], ["Kinematics (velocity)", "v = u + at"], ["Kinematics (displacement)", "s = ut + ½at²"],
      ["Kinematics (no time)", "v² = u² + 2as"], ["Kinetic energy", "Eₖ = ½mv²"], ["Mass–energy", "E = mc²"], ["Momentum", "p = mv"],
      ["Newton's second law", "F = ma"], ["Ohm's law", "V = IR"], ["Pendulum period", "T = 2π√(L/g)"], ["Photon energy", "E = hf"],
      ["Potential energy", "Eₚ = mgh"], ["Power", "P = W/t"], ["Pressure", "P = F/A"], ["Snell's law", "n₁ sin θ₁ = n₂ sin θ₂"],
      ["Wave speed", "v = fλ"], ["Weight", "W = mg"], ["Work", "W = Fd cos θ"],
    ],
    Chemistry: [
      ["Arrhenius equation", "k = Ae^(−Eₐ/RT)"], ["Combined gas law", "P₁V₁/T₁ = P₂V₂/T₂"], ["Combustion of methane", "CH₄ + 2O₂ → CO₂ + 2H₂O"],
      ["Concentration", "c = n/V"], ["Dilution", "c₁V₁ = c₂V₂"], ["Gibbs free energy", "ΔG = ΔH − TΔS"], ["Heat", "q = mcΔT"],
      ["Henderson–Hasselbalch", "pH = pKₐ + log([A⁻]/[HA])"], ["Ideal gas law", "PV = nRT"], ["Moles", "n = m/M"],
      ["Neutralisation", "HCl + NaOH → NaCl + H₂O"], ["Number of particles", "N = n × Nₐ"], ["pH", "pH = −log[H⁺]"], ["pH + pOH", "pH + pOH = 14"],
      ["Photosynthesis", "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"], ["Rate law", "rate = k[A]ᵐ[B]ⁿ"], ["Respiration", "C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O"],
      ["Water ionisation", "K_w = [H⁺][OH⁻] = 1.0 × 10⁻¹⁴"],
    ],
  };
  // Typed shortcuts: \alpha + space → α, -> → →, x^2 → x², H_2O → H₂O
  const BACKSLASH = { sqrt: "√", inf: "∞", infty: "∞", deg: "°", pm: "±", times: "×", div: "÷", neq: "≠", ne: "≠", approx: "≈",
    le: "≤", leq: "≤", ge: "≥", geq: "≥", sum: "∑", int: "∫", partial: "∂", nabla: "∇", therefore: "∴", because: "∵",
    in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", to: "→", rightarrow: "→",
    leftarrow: "←", implies: "⇒", iff: "⇔", eq: "⇌", angle: "∠", perp: "⊥", parallel: "∥", cdot: "·", prime: "′", hbar: "ħ",
    ohm: "Ω", micro: "µ", half: "½", celsius: "℃", check: "✓", star: "★" };
  GREEK_NAMES.forEach((n, i) => {
    BACKSLASH[n] = greekLower[i];
    const up = greekUpper[i];
    if (!GREEK_LATIN_LOOKALIKE.includes(up)) BACKSLASH[n[0].toUpperCase() + n.slice(1)] = up;
  });
  const ARROWS = [["<=>", "⇔"], ["<->", "↔"], ["←>", "↔"], ["≤>", "⇔"], ["->", "→"], ["<-", "←"], ["=>", "⇒"], ["<=", "≤"],
    [">=", "≥"], ["!=", "≠"], ["+-", "±"], ["~=", "≈"], ["(c)", "©"], ["(tm)", "™"]];

  const HAS_HIGHLIGHT = !!(window.CSS && CSS.highlights && window.Highlight);


  // ---------- version history ----------
  const VERSION_KEEP = 40;
  const VERSION_BYTES = 500000;
  let deviceName = "This computer";
  if (hasApp) tauri.core.invoke("device_name").then((n) => { if (n) deviceName = n; }).catch(() => {});
  function versionsOf(note) {
    if (!Array.isArray(note.versions)) note.versions = [];
    return note.versions;
  }
  function sameContent(a, b) {
    return (a.title || "") === (b.title || "") && (a.html || "") === (b.html || "") && JSON.stringify(a.ink || []) === JSON.stringify(b.ink || []);
  }
  // Keeps a copy of the doc as it is now, so it can be brought back later.
  function pushVersion(note, snap, force) {
    const list = versionsOf(note);
    const last = list[list.length - 1];
    if (last && sameContent(last, snap)) return false;
    if (!force && last && snap.t - last.t < 90000) {
      const grew = Math.abs((snap.html || "").length - (last.html || "").length);
      if (grew < 400) return false;
    }
    list.push(snap);
    while (list.length > VERSION_KEEP) list.shift();
    let bytes = list.reduce((n, v) => n + (v.html || "").length + JSON.stringify(v.ink || []).length, 0);
    while (list.length > 3 && bytes > VERSION_BYTES) {
      const gone = list.shift();
      bytes -= (gone.html || "").length + JSON.stringify(gone.ink || []).length;
    }
    return true;
  }
  const snapOf = (note) => ({ t: now(), device: deviceName, title: note.title || "", html: note.html || "", ink: note.ink || [] });
  function whenText(t) {
    const d = new Date(t);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (sameDay) return "Today, " + time;
    const yest = new Date(today.getTime() - 86400000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday, " + time;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " + time;
  }
  // Word-by-word comparison, so changes can be shown like Google Docs.
  function wordDiff(oldText, newText) {
    const a = oldText.split(/(\s+)/).filter((x) => x !== "");
    const b = newText.split(/(\s+)/).filter((x) => x !== "");
    if (a.length > 1400 || b.length > 1400) return null;
    const n = a.length;
    const m = b.length;
    const table = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * (m + 1) + j] = a[i] === b[j]
          ? table[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(table[(i + 1) * (m + 1) + j], table[i * (m + 1) + j + 1]);
      }
    }
    const out = [];
    const push = (type, text) => {
      const last = out[out.length - 1];
      if (last && last.type === type) last.text += text;
      else out.push({ type, text });
    };
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
      else if (table[(i + 1) * (m + 1) + j] >= table[i * (m + 1) + j + 1]) { push("del", a[i]); i++; }
      else { push("add", b[j]); j++; }
    }
    while (i < n) { push("del", a[i]); i++; }
    while (j < m) { push("add", b[j]); j++; }
    return out;
  }

  // ---------- storage ----------
  const DEFAULT_SETTINGS = { view: "blocks", sort: "edited", pinnedTop: true, textSize: "m", docLayout: "pages", grammar: true, autoSymbols: true, recentChars: [] };
  const TEXT_SIZES = { s: "Small", m: "Medium", l: "Large", xl: "Extra large" };
  let data = { version: 2, labels: [], notes: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
  let loadFailed = false;
  let saveTimer = null;

  function migrate(parsed) {
    // v0.3.0 saved a plain list of notes with fixed labels.
    if (Array.isArray(parsed)) {
      const fixed = [
        { id: "school", name: "School", color: "mist" },
        { id: "research", name: "Research", color: "sage" },
        { id: "personal", name: "Personal", color: "rose" },
      ];
      const used = new Set(parsed.map((n) => n.label).filter(Boolean));
      parsed = { version: 2, labels: fixed.filter((l) => used.has(l.id)), notes: parsed };
    }
    parsed.labels = Array.isArray(parsed.labels) ? parsed.labels : [];
    parsed.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
    for (const n of parsed.notes) {
      // Docs used to be plain text; turn it into paragraphs.
      if (n.type === "doc" && n.html === undefined) {
        n.html = (n.body || "")
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p) => "<p>" + escapeText(p).replace(/\n/g, "<br>") + "</p>")
          .join("");
        delete n.body;
      }
      if (n.type === "agenda" && !Array.isArray(n.items)) n.items = [];
      if (n.type === "doc" && !Array.isArray(n.ink)) n.ink = [];
      if (n.versions && !Array.isArray(n.versions)) delete n.versions;
    }
    parsed.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {});
    parsed.version = 2;
    return parsed;
  }

  async function load() {
    try {
      const text = hasApp ? await tauri.core.invoke("load_notes") : (localStorage.getItem("stilllife-notes") || "[]");
      data = migrate(JSON.parse(text));
      loadFailed = false;
    } catch (e) {
      // Never overwrite a file we could not read.
      loadFailed = true;
      data = { version: 2, labels: [], notes: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
    }
  }
  function save() {
    if (loadFailed) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const text = JSON.stringify(data);
      try {
        if (hasApp) await tauri.core.invoke("save_notes", { data: text });
        else localStorage.setItem("stilllife-notes", text);
      } catch (e) {
        console.error("StillLife could not save", e);
      }
    }, 250);
  }
  function touch(note) {
    note.edited = now();
    save();
  }

  // ---------- the view ----------
  function mount(root, options) {
    const opts = options || {};
    const view = { label: "all", type: "all", archive: false, editLabels: false, doc: null, expanded: null, focus: null, query: "", findQuery: null };
    const IMPORTANCE_RANK = { high: 0, medium: 1, low: 2 };
    function compare(a, b) {
      const sort = data.settings.sort;
      if (sort === "created") return (b.created || 0) - (a.created || 0);
      if (sort === "importance") {
        const d = (IMPORTANCE_RANK[a.importance] ?? 2) - (IMPORTANCE_RANK[b.importance] ?? 2);
        return d || (b.edited || 0) - (a.edited || 0);
      }
      if (sort === "due") {
        if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.edited || 0) - (a.edited || 0);
        if (a.due) return -1;
        if (b.due) return 1;
        return (b.edited || 0) - (a.edited || 0);
      }
      return (b.edited || 0) - (a.edited || 0);
    }
    let menu = null;
    let toast = null;
    let toastTimer = null;
    let pendingRender = false;
    let stopDocListeners = null;

    root.classList.add("sl");
    if (opts.full) root.classList.add("full");

    const labelById = (id) => data.labels.find((l) => l.id === id);

    function counts() {
      const active = data.notes.filter((n) => !n.resolved);
      const t = todayStr(0);
      return { total: active.length, due: active.filter((n) => n.due && n.due <= t).length };
    }

    function visible() {
      return data.notes
        .filter((n) => (view.archive ? n.resolved : !n.resolved))
        .filter((n) => view.label === "all" || n.label === view.label)
        .filter((n) => view.type === "all" || n.type === view.type)
        .sort((a, b) => (view.archive ? (b.resolvedAt || 0) - (a.resolvedAt || 0) : compare(a, b)));
    }

    function newNote(type) {
      const used = data.notes.filter((n) => !n.resolved).length;
      const note = {
        id: uid(),
        type,
        title: "",
        label: view.label === "all" ? "" : view.label,
        color: type === "agenda" ? ["sage", "mist", "celadon", "lavender"][used % 4] : ["oat", "rose", "lilac", "clay"][used % 4],
        pinned: false,
        importance: "low",
        due: "",
        created: now(),
        edited: now(),
        resolved: false,
      };
      if (type === "agenda") note.items = [];
      else note.html = "";
      data.notes.unshift(note);
      view.archive = false;
      if (type === "doc") {
        // Save straight away so the full window can find it.
        clearTimeout(saveTimer);
        const text = JSON.stringify(data);
        const done = hasApp ? tauri.core.invoke("save_notes", { data: text }) : Promise.resolve(localStorage.setItem("stilllife-notes", text));
        Promise.resolve(done).then(() => openDoc(note.id));
        if (!opts.full) render();
      } else {
        save();
        render({ id: note.id, sel: ".sl-title" });
      }
    }

    // ---------- docs open as pages ----------
    function openDoc(id) {
      const note = data.notes.find((n) => n.id === id);
      if (!note) return;
      if (!opts.full) {
        // The plate is too small for writing: hand the doc to the full window.
        if (hasApp) tauri.core.invoke("open_doc", { id });
        return;
      }
      view.doc = id;
      render();
    }
    function closeDoc() {
      view.doc = null;
      render();
    }

    // ---------- labels (the user's own) ----------
    function addLabel() {
      const used = new Set(data.labels.map((l) => l.color));
      const color = COLORS.find((c) => !used.has(c)) || COLORS[data.labels.length % COLORS.length];
      const label = { id: uid(), name: "New label", color };
      data.labels.push(label);
      view.editLabels = true;
      save();
      render({ label: label.id });
    }
    function deleteLabel(label) {
      data.labels = data.labels.filter((l) => l !== label);
      for (const n of data.notes) if (n.label === label.id) n.label = "";
      if (view.label === label.id) view.label = "all";
      save();
      render();
    }

    // ---------- toolbar ----------
    function toolbar() {
      const tabs = el("div", { class: "sl-seg sl-tabs", role: view.editLabels ? "group" : "tablist", "aria-label": "Labels" });

      if (view.editLabels) {
        for (const l of data.labels) {
          const dot = el("button", {
            class: "sl-dot-btn",
            style: "background: var(--c-" + l.color + ")",
            title: "Change colour",
            "aria-label": "Change colour of " + l.name,
            onclick: () => {
              l.color = COLORS[(COLORS.indexOf(l.color) + 1) % COLORS.length];
              save();
              render({ label: l.id });
            },
          });
          const name = el("input", {
            class: "sl-label-input",
            value: l.name,
            "aria-label": "Label name",
            size: Math.max(4, l.name.length),
            oninput: (e) => { l.name = e.target.value; e.target.size = Math.max(4, e.target.value.length); save(); },
            onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); view.editLabels = false; render(); } },
          });
          name.dataset.label = l.id;
          const del = el("button", { class: "sl-icon-btn", "aria-label": "Delete label " + l.name, title: "Delete label (notes stay)", onclick: () => deleteLabel(l) }, svg(ICON.x, 11));
          tabs.append(el("span", { class: "sl-tab-edit" }, dot, name, del));
        }
        tabs.append(el("button", { class: "sl-tab-add", onclick: addLabel }, svg(ICON.plus, 12), "Add label"));
        tabs.append(el("button", { class: "on", onclick: () => { view.editLabels = false; render(); }, text: "Done" }));
      } else {
        const allTabs = [{ id: "all", name: "All" }].concat(data.labels);
        for (const l of allTabs) {
          const b = el("button", {
            class: view.label === l.id ? "on" : "",
            role: "tab",
            "aria-selected": view.label === l.id ? "true" : "false",
            onclick: () => { view.label = l.id; render(); },
          });
          if (l.color) b.append(el("span", { class: "sl-dot", style: "background: var(--c-" + l.color + ")" }));
          b.append(l.name || "Untitled");
          tabs.append(b);
        }
        const editing = data.labels.length > 0;
        tabs.append(el("button", {
          class: "sl-tab-add",
          title: editing ? "Add, rename or delete labels" : "Add a label",
          "aria-label": editing ? "Edit labels" : "Add a label",
          onclick: () => { if (editing) { view.editLabels = true; render(); } else addLabel(); },
        }, svg(editing ? ICON.pencil : ICON.plus, 12), editing ? null : "Label"));
      }

      const types = el("div", { class: "sl-seg", role: "group", "aria-label": "Show" });
      for (const t of [["all", "Everything"], ["agenda", "Agendas"], ["doc", "Docs"]]) {
        types.append(el("button", { class: view.type === t[0] ? "on" : "", onclick: () => { view.type = t[0]; render(); }, text: t[1] }));
      }

      const resolvedCount = data.notes.filter((n) => n.resolved).length;
      const archiveBtn = el("button", {
        class: "sl-new alt",
        onclick: () => { view.archive = !view.archive; render(); },
        text: view.archive ? "Back to notes" : "Resolved" + (resolvedCount ? " (" + resolvedCount + ")" : ""),
      });

      const VIEWS = { blocks: "Blocks", list: "List", details: "Details" };
      const SORTS = { edited: "Date edited", created: "Date created", importance: "Importance", due: "Due date" };
      const viewBtn = el("button", {
        class: "sl-new alt",
        "aria-haspopup": "true",
        onclick: (e) => openChoices(e.currentTarget, [
          { heading: "VIEW" },
          ...Object.entries(VIEWS).map(([k, v]) => ({ text: v, on: data.settings.view === k, pick: () => { data.settings.view = k; save(); } })),
          { heading: "SORT BY" },
          ...Object.entries(SORTS).map(([k, v]) => ({ text: v, on: data.settings.sort === k, pick: () => { data.settings.sort = k; save(); } })),
          { heading: "" },
          { text: "Pinned on top", check: true, on: data.settings.pinnedTop, pick: () => { data.settings.pinnedTop = !data.settings.pinnedTop; save(); } },
          { heading: "TEXT SIZE" },
          ...Object.entries(TEXT_SIZES).map(([k, v]) => ({ text: v, on: data.settings.textSize === k, pick: () => { data.settings.textSize = k; save(); } })),
        ]),
      }, svg(ICON.view, 13), VIEWS[data.settings.view] + " \u00B7 " + SORTS[data.settings.sort]);

      const searchBox = el("label", { class: "sl-search" + (view.query ? " has" : "") }, svg(ICON.find, 14),
        el("input", {
          class: "sl-search-input",
          type: "search",
          placeholder: "Search",
          value: view.query,
          "aria-label": "Search all notes",
          title: "Search titles, doc text, agenda items and labels (Ctrl+F)",
          oninput: (e) => { view.query = e.target.value; render({ search: true }); },
          onkeydown: (e) => {
            if (e.key === "Escape" && view.query) { e.preventDefault(); e.stopPropagation(); view.query = ""; render({ search: true }); }
          },
        }));

      const newAgenda = el("button", { class: "sl-new", onclick: () => newNote("agenda") }, svg(ICON.plus, 13), "Agenda");
      const newDoc = el("button", { class: "sl-new", onclick: () => newNote("doc") }, svg(ICON.plus, 13), "Doc");

      return el("div", { class: "sl-bar" },
        el("div", { class: "sl-group" }, tabs, types),
        el("div", { class: "sl-group" }, searchBox, viewBtn, archiveBtn, newAgenda, newDoc));
    }

    // ---------- cards ----------
    function chips(note) {
      const foot = el("div", { class: "sl-foot" });
      if (note.type === "agenda" && note.items.length) {
        const done = note.items.filter((i) => i.done).length;
        foot.append(el("span", { class: "sl-chip", text: done + " of " + note.items.length }));
      }
      if (note.importance === "high" || note.importance === "medium") {
        foot.append(el("span", { class: "sl-chip " + note.importance, text: IMPORTANCE[note.importance] }));
      }
      const due = dueInfo(note.due);
      if (due && !note.resolved) foot.append(el("span", { class: "sl-chip " + due.cls, text: due.text }));
      const label = labelById(note.label);
      if (label) foot.append(el("span", { class: "sl-chip", text: label.name }));
      foot.append(el("span", { class: "sl-chip", text: ago(note.edited || note.created) }));
      return foot;
    }

    function allDone(note) {
      return note.type === "agenda" && note.items.length > 0 && note.items.every((i) => i.done);
    }

    function headButtons(note, head) {
      head.append(el("button", {
        class: "sl-icon-btn",
        "aria-label": note.pinned ? "Unpin" : "Pin",
        "aria-pressed": note.pinned ? "true" : "false",
        title: note.pinned ? "Unpin" : "Pin to the top",
        style: note.pinned ? "background: rgba(255,255,255,0.6)" : "opacity: 0.6",
        onclick: (e) => { e.stopPropagation(); note.pinned = !note.pinned; touch(note); render(); },
      }, svg(ICON.pin, 14)));
      head.append(el("button", {
        class: "sl-icon-btn",
        "aria-label": "More options",
        onclick: (e) => { e.stopPropagation(); openMenu(note, e.currentTarget); },
      }, svg(ICON.more, 15)));
    }

    function docCard(note) {
      const c = el("article", {
        class: "sl-card sl-doc-card c-" + (note.color || "oat") + (note.resolved ? " archived" : ""),
        "data-id": note.id,
        tabindex: "0",
        "aria-label": "Open doc " + (note.title || "Untitled"),
        onclick: (e) => { if (!e.target.closest("button")) openDoc(note.id); },
        onkeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); openDoc(note.id); } },
      });
      const head = el("div", { class: "sl-head" }, svg(ICON.doc, 13),
        el("span", { class: "sl-title sl-title-static", text: note.title || "Untitled doc" }));
      if (!note.resolved) headButtons(note, head);
      c.append(head);
      const text = htmlToText(note.html);
      c.append(el("p", { class: "sl-preview", text: text || "Empty doc. Click to start writing." }));
      if (note.resolved) {
        c.append(el("div", { class: "sl-archive-actions" },
          el("button", { onclick: (e) => { e.stopPropagation(); restore(note); }, text: "Restore" }),
          el("button", { onclick: (e) => { e.stopPropagation(); remove(note); }, text: "Delete for good" })));
      } else {
        c.append(chips(note));
      }
      return c;
    }

    function agendaCard(note, big) {
      const c = el("article", {
        class: "sl-card c-" + (note.color || "sage") + (allDone(note) && !note.resolved ? " ready" : "") + (note.resolved ? " archived" : "") + (big ? " big" : ""),
        "data-id": note.id,
        ondblclick: (e) => {
          if (big || e.target.closest("input, button, label")) return;
          view.focus = note.id;
          render();
        },
      });

      const title = el("input", {
        class: "sl-title",
        value: note.title,
        placeholder: "Agenda title",
        "aria-label": "Title",
        readonly: note.resolved ? "" : null,
        oninput: (e) => { note.title = e.target.value; touch(note); },
        onkeydown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const next = c.querySelector(".sl-item-text, .sl-add-item");
            if (next) next.focus();
          }
        },
      });
      const head = el("div", { class: "sl-head" }, svg(ICON.agenda, 13), title);
      if (!note.resolved) {
        const box = el("input", { type: "checkbox", "aria-label": "All resolved: clear this agenda", onchange: () => resolve(note) });
        head.append(el("label", { class: "sl-resolved", title: "Tick when everything is done to clear this agenda" }, box, "All resolved"));
        head.append(el("button", {
          class: "sl-icon-btn",
          "aria-label": big ? "Shrink back" : "Zoom in",
          title: big ? "Shrink back (Esc)" : "Zoom in (or double-click the card)",
          onclick: (e) => { e.stopPropagation(); view.focus = big ? null : note.id; render(); },
        }, svg(big ? ICON.x : ICON.expand, 13)));
        headButtons(note, head);
      }
      c.append(head);

      const list = el("ul", { class: "sl-items" });
      note.items.forEach((item, index) => {
        const text = el("input", {
          class: "sl-item-text",
          value: item.text,
          "aria-label": "Item",
          readonly: note.resolved ? "" : null,
          oninput: (e) => { item.text = e.target.value; touch(note); },
          onkeydown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const fresh = { id: uid(), text: "", done: false };
              note.items.splice(index + 1, 0, fresh);
              touch(note);
              render({ id: note.id, item: fresh.id });
            } else if (e.key === "Backspace" && item.text === "") {
              e.preventDefault();
              note.items.splice(index, 1);
              touch(note);
              const prev = note.items[index - 1];
              render(prev ? { id: note.id, item: prev.id } : { id: note.id, sel: ".sl-add-item" });
            }
          },
        });
        const li = el("li", { class: "sl-item" + (item.done ? " done" : "") },
          el("input", {
            type: "checkbox",
            checked: item.done,
            disabled: note.resolved ? "" : null,
            "aria-label": "Done",
            onchange: (e) => { item.done = e.target.checked; touch(note); render(); },
          }),
          text,
          note.resolved ? null : el("button", {
            class: "sl-icon-btn",
            "aria-label": "Remove item",
            onclick: () => { note.items.splice(index, 1); touch(note); render(); },
          }, svg(ICON.x, 11)));
        li.dataset.item = item.id;
        list.append(li);
      });
      c.append(list);
      if (!note.resolved) {
        c.append(el("input", {
          class: "sl-add-item",
          placeholder: "+ Add item",
          "aria-label": "Add item",
          onkeydown: (e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              e.preventDefault();
              note.items.push({ id: uid(), text: e.target.value.trim(), done: false });
              touch(note);
              render({ id: note.id, sel: ".sl-add-item" });
            }
          },
        }));
      }

      if (note.resolved) {
        c.append(el("div", { class: "sl-archive-actions" },
          el("button", { onclick: () => restore(note), text: "Restore" }),
          el("button", { onclick: () => remove(note), text: "Delete for good" })));
      } else {
        c.append(chips(note));
      }
      return c;
    }

    const card = (note) => (note.type === "doc" ? docCard(note) : agendaCard(note));

    // Clicking a row: docs open; agendas unfold under the row.
    function rowClick(note, e) {
      if (e.target.closest("button, input, label")) return;
      if (note.type === "doc") openDoc(note.id);
      else { view.expanded = view.expanded === note.id ? null : note.id; render(); }
    }
    function secondLine(note) {
      if (note.type === "doc") return htmlToText(note.html) || "Empty doc";
      const done = note.items.filter((i) => i.done).length;
      const next = note.items.find((i) => !i.done);
      return done + " of " + note.items.length + " done" + (next ? " \u00B7 next: " + next.text : "");
    }
    function rowButtons(note) {
      const wrap = el("div", { class: "sl-row-btns" });
      if (!note.resolved) headButtons(note, wrap);
      else wrap.append(
        el("button", { class: "sl-new alt sl-small", onclick: () => restore(note), text: "Restore" }),
        el("button", { class: "sl-new alt sl-small", onclick: () => remove(note), text: "Delete" }));
      return wrap;
    }
    function listView(list) {
      const box = el("div", { class: "sl-list" });
      for (const note of list) {
        const due = dueInfo(note.due);
        const label = labelById(note.label);
        const row = el("div", {
          class: "sl-row-item" + (view.expanded === note.id ? " open" : ""),
          tabindex: "0",
          "data-id": note.id,
          onclick: (e) => rowClick(note, e),
          onkeydown: (e) => { if (e.key === "Enter" && e.target === row) rowClick(note, e); },
        },
          el("span", { class: "sl-swatch", style: "background: var(--c-" + (note.color || "oat") + ")" }, svg(note.type === "doc" ? ICON.doc : ICON.agenda, 13)),
          el("div", { class: "sl-row-text" },
            el("span", { class: "sl-row-title", text: note.title || (note.type === "doc" ? "Untitled doc" : "Untitled agenda") }),
            el("span", { class: "sl-row-sub", text: secondLine(note) })),
          el("div", { class: "sl-row-chips" },
            note.importance === "high" || note.importance === "medium" ? el("span", { class: "sl-chip " + note.importance, text: IMPORTANCE[note.importance] }) : null,
            due && !note.resolved ? el("span", { class: "sl-chip " + due.cls, text: due.text }) : null,
            label ? el("span", { class: "sl-chip", style: "background: var(--c-" + label.color + ")", text: label.name }) : null,
            el("span", { class: "sl-row-when", text: ago(note.edited || note.created) })),
          rowButtons(note));
        box.append(row);
        if (view.expanded === note.id && note.type === "agenda") box.append(el("div", { class: "sl-row-open" }, agendaCard(note)));
      }
      return box;
    }
    function detailsView(list) {
      const SORTABLE = { importance: "Importance", due: "Due", edited: "Edited" };
      const head = el("div", { class: "sl-table-head" });
      for (const [key, text] of [["", ""], ["", "Title"], ["", "Label"], ["importance", "Importance"], ["due", "Due"], ["edited", "Edited"], ["", ""]]) {
        if (key) {
          head.append(el("button", {
            class: "sl-th" + (data.settings.sort === key ? " on" : ""),
            "aria-label": "Sort by " + SORTABLE[key],
            onclick: () => { data.settings.sort = key; save(); render(); },
            text: text + (data.settings.sort === key ? " \u2193" : ""),
          }));
        } else head.append(el("span", { class: "sl-th", text }));
      }
      const table = el("div", { class: "sl-table", role: "table" }, head);
      for (const note of list) {
        const due = dueInfo(note.due);
        const label = labelById(note.label);
        const row = el("div", {
          class: "sl-tr" + (view.expanded === note.id ? " open" : ""),
          role: "row",
          tabindex: "0",
          "data-id": note.id,
          onclick: (e) => rowClick(note, e),
          onkeydown: (e) => { if (e.key === "Enter" && e.target === row) rowClick(note, e); },
        },
          el("span", { class: "sl-swatch", style: "background: var(--c-" + (note.color || "oat") + ")" }, svg(note.type === "doc" ? ICON.doc : ICON.agenda, 13)),
          el("span", { class: "sl-td sl-td-title" },
            el("strong", { text: note.title || (note.type === "doc" ? "Untitled doc" : "Untitled agenda") }),
            note.type === "agenda" ? el("span", { class: "sl-row-sub", text: " \u00B7 " + note.items.filter((i) => i.done).length + " of " + note.items.length }) : null),
          el("span", { class: "sl-td", text: label ? label.name : "\u2014" }),
          el("span", { class: "sl-td" }, note.importance === "high" || note.importance === "medium" ? el("span", { class: "sl-chip " + note.importance, text: IMPORTANCE[note.importance] }) : el("span", { class: "sl-faint", text: "Low" })),
          el("span", { class: "sl-td" + (due && due.cls === "overdue" ? " sl-red" : ""), text: due && !note.resolved ? due.text.replace(/^Due /, "") : "\u2014" }),
          el("span", { class: "sl-td sl-faint", text: ago(note.edited || note.created) }),
          rowButtons(note));
        table.append(row);
        if (view.expanded === note.id && note.type === "agenda") table.append(el("div", { class: "sl-row-open" }, agendaCard(note)));
      }
      return table;
    }
    function group(list) {
      if (data.settings.view === "list") return listView(list);
      if (data.settings.view === "details") return detailsView(list);
      return el("div", { class: "sl-grid" }, ...list.map(card));
    }

    // ---------- the doc page ----------
    function docPage(note) {
      const full = !!opts.full;
      const cleanups = [];
      stopDocListeners = () => cleanups.forEach((f) => f());
      const layout = () => note.layout || data.settings.docLayout || "pages";
      let pageCount = 1;

      const status = el("span", { class: "sl-doc-status" });
      function updateStatus(extra) {
        const words = htmlToText(note.html).split(" ").filter(Boolean).length;
        let t = words + (words === 1 ? " word" : " words");
        if (layout() === "pages") t += " · " + pageCount + (pageCount === 1 ? " page" : " pages");
        const strokes = (note.ink || []).length;
        if (strokes) t += " · " + strokes + (strokes === 1 ? " stroke" : " strokes");
        status.textContent = t + " · " + (extra || "saved");
      }

      const headRight = el("div", { class: "sl-group" });
      headButtons(note, headRight);
      const head = el("div", { class: "sl-doc-head" },
        el("button", { class: "sl-new alt", onclick: closeDoc }, svg(ICON.back, 13), "All notes"),
        status, headRight);

      const body = el("div", {
        class: "sl-doc-body",
        contenteditable: "true",
        spellcheck: "true",
        lang: "en",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Doc text",
        "data-placeholder": "Start writing…",
      });
      body.innerHTML = cleanHtml(note.html);

      function syncBody() {
        note.html = cleanHtml(body.innerHTML);
        touch(note);
        updateStatus();
      }

      // ----- keep the text selection while using toolbar pop-ups -----
      let savedRange = null;
      function saveSel() {
        const sel = window.getSelection();
        if (sel.rangeCount && body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
      }
      function restoreSel() {
        body.focus();
        const sel = window.getSelection();
        if (savedRange && body.contains(savedRange.startContainer)) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        } else if (!sel.rangeCount || !body.contains(sel.anchorNode)) {
          const r = document.createRange();
          r.selectNodeContents(body);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
      function run(cmd, value) {
        restoreSel();
        // Colours need inline styles; everything else uses plain tags (<b>, <i>, <u>) so it is saved.
        const css = cmd === "foreColor" || cmd === "hiliteColor";
        try { document.execCommand("styleWithCSS", false, css); } catch (e) {}
        document.execCommand(cmd, false, value === undefined ? null : value);
        syncBody();
        refreshTools();
        later();
      }

      // ----- formatting toolbar -----
      const tools = el("div", { class: "sl-doc-tools", role: "toolbar", "aria-label": "Formatting" });
      const toolButtons = [];
      function tool(icon, labelText, onClick, cmd, key) {
        const b = el("button", {
          class: "sl-tool",
          "aria-label": labelText,
          title: labelText + (key ? " (" + key + ")" : ""),
          onmousedown: (e) => { saveSel(); e.preventDefault(); }, // keep the text selection
          onclick: (e) => onClick(e.currentTarget),
        }, svg(icon, 16));
        if (cmd) { b.dataset.cmd = cmd; toolButtons.push(b); }
        return b;
      }
      const sep = () => el("span", { class: "sl-tool-sep", "aria-hidden": "true" });
      const zoomSlot = el("span", { class: "sl-zoom-slot" });

      const BLOCKS = [
        { value: "P", text: "Normal text", cls: "pv-p", hint: "Ctrl+Alt+0" },
        { value: "H1", text: "Title", cls: "pv-h1", hint: "Ctrl+Alt+1" },
        { value: "H2", text: "Heading", cls: "pv-h2", hint: "Ctrl+Alt+2" },
        { value: "H3", text: "Subheading", cls: "pv-h3", hint: "Ctrl+Alt+3" },
        { value: "BLOCKQUOTE", text: "Quote", cls: "pv-q", hint: "> space" },
      ];
      const blockDd = dropdown({
        label: "Text style", options: BLOCKS, value: "P", keepFocus: true, onOpen: saveSel, cls: "sl-dd-block",
        onPick: (v) => { run("formatBlock", v); buildOutline(); },
      });

      const TEXT_COLORS = [["Ink", "#2f2e2b"], ["Brick", "#8a4f45"], ["Clay", "#a3684d"], ["Moss", "#4d6b55"], ["Slate", "#4f6a80"], ["Plum", "#6d5a80"]];
      const MARKS = [["Butter", "#ece8b0"], ["Lavender", "#ddd7f0"], ["Sage", "#d3dccb"], ["Rose", "#ecd6d1"], ["Mist", "#d2dbe2"], ["None", "transparent"]];
      function swatchMenu(anchor, title, colors, cmd) {
        closeMenu();
        menu = el("div", { class: "sl-menu sl-color-menu", role: "dialog", "aria-label": title },
          el("span", { class: "sl-choice-head", text: title.toUpperCase() }));
        const grid = el("div", { class: "sl-swatches" });
        for (const [name, value] of colors) {
          grid.append(el("button", {
            style: "background:" + (value === "transparent" ? "#ffffff; box-shadow: inset 0 0 0 1px rgba(47,46,43,0.3)" : value),
            "aria-label": name,
            title: name,
            onmousedown: (e) => e.preventDefault(),
            onclick: () => { closeMenu(); run(cmd, value); },
          }));
        }
        menu.append(grid);
        root.append(menu);
        placeMenu(anchor, 230, 110);
      }
      function linkMenu(anchor) {
        closeMenu();
        const input = el("input", { type: "url", placeholder: "https://", "aria-label": "Link address", class: "sl-link-input" });
        function apply() {
          let url = input.value.trim();
          if (!url) return;
          if (!/^(https?:|mailto:)/i.test(url)) url = "https://" + url;
          closeMenu();
          run("createLink", url);
        }
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
        menu = el("div", { class: "sl-menu", role: "dialog", "aria-label": "Add link" },
          el("label", null, "LINK", input),
          el("div", { class: "sl-row" },
            el("button", { onclick: () => { closeMenu(); run("unlink"); }, text: "Remove link" }),
            el("button", { class: "sl-primary", onclick: apply, text: "Apply" })));
        root.append(menu);
        placeMenu(anchor, 230, 130);
        setTimeout(() => input.focus(), 0);
      }

      function insertPageBreak() {
        restoreSel();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        // The break always sits between top-level blocks, never inside bold text or a list item.
        const topBlock = () => {
          let x = sel.anchorNode;
          x = x && (x.nodeType === 1 ? x : x.parentElement);
          while (x && x !== body && x.parentElement !== body) x = x.parentElement;
          return x === body ? null : x;
        };
        const blk = topBlock();
        const r = sel.getRangeAt(0);
        let atEnd = true;
        if (blk) {
          const tail = document.createRange();
          tail.selectNodeContents(blk);
          tail.setStart(r.endContainer, r.endOffset);
          atEnd = !tail.toString().trim();
        }
        const hr = el("hr", { class: "sl-pb" });
        let next;
        if (!blk) { next = el("p", null, el("br")); body.append(hr, next); }
        else if (atEnd) { next = el("p", null, el("br")); blk.after(hr, next); }
        else { document.execCommand("insertParagraph"); next = topBlock() || blk; next.before(hr); }
        const c = document.createRange();
        c.setStart(next, 0);
        c.collapse(true);
        sel.removeAllRanges();
        sel.addRange(c);
        syncBody();
        later();
      }
      function printDoc() {
        clearPushes();
        window.print();
        later();
      }
      function layoutMenu(anchor) {
        openChoices(anchor, [
          { heading: "PAGE LAYOUT" },
          { text: "Pages", on: layout() === "pages", pick: () => { note.layout = "pages"; data.settings.docLayout = "pages"; touch(note); } },
          { text: "Pageless (one long page)", on: layout() === "pageless", pick: () => { note.layout = "pageless"; data.settings.docLayout = "pageless"; touch(note); } },
          { heading: "" },
          { text: "Insert page break  ·  Ctrl+Enter", action: true, keep: true, pick: () => insertPageBreak() },
        ]);
      }

      // ----- keyboard shortcuts list -----
      const SHORTCUTS = [
        ["Bold", "Ctrl+B"], ["Italic", "Ctrl+I"], ["Underline", "Ctrl+U"], ["Strikethrough", "Alt+Shift+5"],
        ["Superscript / subscript", "Ctrl+. / Ctrl+,"], ["Clear formatting", "Ctrl+\\"], ["Normal text", "Ctrl+Alt+0"], ["Title / Heading / Subheading", "Ctrl+Alt+1 / 2 / 3"],
        ["Numbered list", "Ctrl+Shift+7"], ["Bulleted list", "Ctrl+Shift+8"], ["Indent / outdent list", "Tab / Shift+Tab"],
        ["Align left / centre / right", "Ctrl+Shift+L / E / R"], ["Justify", "Ctrl+Shift+J"], ["Insert link", "Ctrl+K"],
        ["Zoom in / out / 100%", "Ctrl+= / Ctrl+- / Ctrl+0"], ["Zoom with touchpad", "Pinch, or Ctrl + scroll"],
        ["Insert picture", "Paste or drop it in"], ["Draw and handwrite", "Ctrl+D"], ["Page break", "Ctrl+Enter"], ["Find", "Ctrl+F"], ["Find and replace", "Ctrl+H"], ["Undo / redo", "Ctrl+Z / Ctrl+Y"],
        ["Print or save as PDF", "Ctrl+P"], ["This list", "Ctrl+/"],
        ["Greek and maths symbols", "\\alpha, \\pi, \\sqrt + space"], ["Arrows and signs", "->  =>  <=  >=  !=  +-"],
        ["Powers and chemistry", "x^2 then space, H_2O"],
      ];
      function showShortcuts(anchor) {
        closeMenu();
        menu = el("div", { class: "sl-menu sl-keys", role: "dialog", "aria-label": "Keyboard shortcuts" },
          el("span", { class: "sl-choice-head", text: "KEYBOARD SHORTCUTS" }),
          ...SHORTCUTS.map(([what, keysText]) => el("div", { class: "sl-key-row" },
            el("span", { text: what }), el("kbd", { text: keysText }))));
        root.append(menu);
        placeMenu(anchor || keysBtn, 330, 560);
      }

      const linkBtn = tool(ICON.link, "Link", (b) => linkMenu(b), null, "Ctrl+K");
      const keysBtn = tool(ICON.keys, "Keyboard shortcuts", (b) => showShortcuts(b), null, "Ctrl+/");
      const grammarBtn = tool(ICON.grammar, "Grammar suggestions", () => toggleGrammar(), null);
      const charsBtn = tool(ICON.omega, "Special characters and equations", () => toggleChars(), null);
      const badge = el("span", { class: "sl-badge", hidden: true });
      grammarBtn.append(badge);

      tools.append(
        tool(ICON.undo, "Undo", () => run("undo"), null, "Ctrl+Z"),
        tool(ICON.redo, "Redo", () => run("redo"), null, "Ctrl+Y"),
        zoomSlot,
        sep(), blockDd.el, sep(),
        tool(ICON.bold, "Bold", () => run("bold"), "bold", "Ctrl+B"),
        tool(ICON.italic, "Italic", () => run("italic"), "italic", "Ctrl+I"),
        tool(ICON.underline, "Underline", () => run("underline"), "underline", "Ctrl+U"),
        tool(ICON.strike, "Strikethrough", () => run("strikeThrough"), "strikeThrough", "Alt+Shift+5"),
        tool(ICON.sup, "Superscript", () => run("superscript"), "superscript", "Ctrl+."),
        tool(ICON.sub, "Subscript", () => run("subscript"), "subscript", "Ctrl+,"),
        tool(ICON.color, "Text colour", (b) => swatchMenu(b, "Text colour", TEXT_COLORS, "foreColor")),
        tool(ICON.mark, "Highlight", (b) => swatchMenu(b, "Highlight", MARKS, "hiliteColor")),
        sep(),
        tool(ICON.left, "Align left", () => run("justifyLeft"), "justifyLeft", "Ctrl+Shift+L"),
        tool(ICON.center, "Align centre", () => run("justifyCenter"), "justifyCenter", "Ctrl+Shift+E"),
        tool(ICON.right, "Align right", () => run("justifyRight"), "justifyRight", "Ctrl+Shift+R"),
        sep(),
        tool(ICON.ul, "Bulleted list", () => run("insertUnorderedList"), "insertUnorderedList", "Ctrl+Shift+8"),
        tool(ICON.ol, "Numbered list", () => run("insertOrderedList"), "insertOrderedList", "Ctrl+Shift+7"),
        linkBtn,
        tool(ICON.hr, "Divider line", () => run("insertHorizontalRule")),
        charsBtn,
        sep(),
        tool(ICON.pages, "Page layout: pages or pageless", (b) => layoutMenu(b)),
        tool(ICON.outline, "Show or hide outline", () => { outlineOpen = !outlineOpen; outline.hidden = !outlineOpen; buildOutline(); }),
        tool(ICON.find, "Find and replace", () => openFind(false), null, "Ctrl+F"),
        grammarBtn,
        tool(ICON.print, "Print or save as PDF", () => printDoc(), null, "Ctrl+P"),
        keysBtn);

      function refreshTools() {
        if (document.activeElement !== body) return;
        for (const b of toolButtons) {
          let on = false;
          try { on = document.queryCommandState(b.dataset.cmd); } catch (e) {}
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        }
        try {
          const block = (document.queryCommandValue("formatBlock") || "p").toUpperCase();
          blockDd.set(["H1", "H2", "H3", "BLOCKQUOTE"].includes(block) ? block : "P");
        } catch (e) {}
      }
      document.addEventListener("selectionchange", refreshTools);
      cleanups.push(() => document.removeEventListener("selectionchange", refreshTools));

      // ----- outline built from the headings -----
      let outlineOpen = full && window.innerWidth > 1000;
      const outline = el("nav", { class: "sl-outline", "aria-label": "Outline" });
      outline.hidden = !outlineOpen;
      function buildOutline() {
        if (!outlineOpen) return;
        outline.textContent = "";
        outline.append(el("span", { class: "sl-choice-head", text: "OUTLINE" }));
        const heads = body.querySelectorAll("h1, h2, h3");
        if (!heads.length) {
          outline.append(el("p", { class: "sl-faint sl-outline-empty", text: "Headings you add appear here. Pick Title, Heading or Subheading, or type # and a space." }));
          return;
        }
        heads.forEach((h) => {
          outline.append(el("button", {
            class: "sl-outline-item lvl-" + h.tagName.slice(1),
            onclick: () => h.scrollIntoView({ behavior: "smooth", block: "start" }),
            text: h.textContent.trim() || "Untitled heading",
          }));
        });
      }

      // ----- Markdown-style shortcuts: "# ", "## ", "### ", "- ", "* ", "1. ", "> " -----
      const MD = { "#": "H1", "##": "H2", "###": "H3", ">": "BLOCKQUOTE", "-": "ul", "*": "ul", "1.": "ol" };
      body.addEventListener("keydown", (e) => {
        if (e.key !== " ") return;
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.isCollapsed) return;
        const node = sel.anchorNode;
        if (!node || node.nodeType !== 3) return;
        const before = node.textContent.slice(0, sel.anchorOffset);
        const rule = MD[before];
        if (!rule) return;
        const block = node.parentElement && node.parentElement.closest("p, div, h1, h2, h3, li, blockquote");
        if (block && block !== body && block.firstChild !== node) return;
        e.preventDefault();
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, before.length);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("delete");
        if (rule === "ul") document.execCommand("insertUnorderedList");
        else if (rule === "ol") document.execCommand("insertOrderedList");
        else document.execCommand("formatBlock", false, rule);
        syncBody();
        buildOutline();
      });

      // ----- Google Docs keyboard shortcuts -----
      const HEAD_KEYS = { Digit0: "P", Digit1: "H1", Digit2: "H2", Digit3: "H3", Numpad0: "P", Numpad1: "H1", Numpad2: "H2", Numpad3: "H3" };
      function inList() {
        const sel = window.getSelection();
        const n = sel.anchorNode;
        const elx = n && (n.nodeType === 1 ? n : n.parentElement);
        return !!(elx && body.contains(elx) && elx.closest("li"));
      }
      function shortcut(e) {
        const c = e.ctrlKey || e.metaKey;
        const k = (e.key || "").toLowerCase();
        const inText = body.contains(e.target);
        let act = null;
        if (e.key === "Escape" && !menu) {
          if (drawing) act = () => toggleDraw(false);
          else if (histPick) act = closePreview;
          else if (gpop) act = closePop;
          else if (!findBar.hidden) act = closeFind;
        }
        // Anywhere on the doc page
        if (c && !e.shiftKey && !e.altKey) {
          if (k === "p") act = printDoc;
          else if (k === "=" || k === "+") act = () => stepZoom(1);
          else if (k === "-") act = () => stepZoom(-1);
          else if (k === "0") act = () => { zoomMode = 1; data.settings.docZoom = 1; save(); setZoom(1); };
          else if (k === "f") act = () => openFind(false);
          else if (k === "h") act = () => openFind(true);
          else if (k === "/") act = () => showShortcuts();
          else if (k === "s") act = () => updateStatus("saved just now");
        }
        if (!act && inText) {
          if (c && !e.shiftKey && !e.altKey) {
            if (k === "b") act = () => run("bold");
            else if (k === "i") act = () => run("italic");
            else if (k === "u") act = () => run("underline");
            else if (k === "k") act = () => linkMenu(linkBtn);
            else if (k === "\\") act = () => run("removeFormat");
            else if (k === "d") act = () => toggleDraw();
            else if (k === ".") act = () => run("superscript");
            else if (k === ",") act = () => run("subscript");
            else if (k === "enter") act = insertPageBreak;
            else if (k === "z") act = () => run("undo");
            else if (k === "y") act = () => run("redo");
          } else if (c && e.shiftKey && !e.altKey) {
            if (e.code === "Digit7") act = () => run("insertOrderedList");
            else if (e.code === "Digit8") act = () => run("insertUnorderedList");
            else if (k === "x") act = () => run("strikeThrough");
            else if (k === "l") act = () => run("justifyLeft");
            else if (k === "e") act = () => run("justifyCenter");
            else if (k === "r") act = () => run("justifyRight");
            else if (k === "j") act = () => run("justifyFull");
            else if (k === "z") act = () => run("redo");
          } else if (c && e.altKey && !e.shiftKey && HEAD_KEYS[e.code]) {
            act = () => { run("formatBlock", HEAD_KEYS[e.code]); buildOutline(); };
          } else if (!c && e.altKey && e.shiftKey && e.code === "Digit5") {
            act = () => run("strikeThrough");
          } else if (!c && !e.altKey && e.key === "Tab" && inList()) {
            act = () => run(e.shiftKey ? "outdent" : "indent");
          }
        }
        if (act) {
          e.preventDefault();
          e.stopPropagation();
          saveSel();
          act();
        }
      }

      // ----- text positions inside the doc (for find and grammar) -----
      function textBlocks() {
        const blocks = [];
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        let cur = null;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const b = n.parentElement.closest("p, div, h1, h2, h3, li, blockquote, pre");
          const blk = b && b !== body && body.contains(b) ? b : body;
          if (!cur || cur.el !== blk) { cur = { el: blk, text: "", nodes: [] }; blocks.push(cur); }
          cur.nodes.push({ node: n, start: cur.text.length });
          cur.text += n.textContent;
        }
        return blocks;
      }
      function locate(block, i, isEnd) {
        for (const x of block.nodes) {
          const len = x.node.textContent.length;
          if (isEnd ? (i > x.start && i <= x.start + len) : (i >= x.start && i < x.start + len)) return [x.node, i - x.start];
        }
        const lastNode = block.nodes[block.nodes.length - 1].node;
        return [lastNode, isEnd ? lastNode.textContent.length : Math.min(i, lastNode.textContent.length)];
      }
      function rangeFor(block, start, end) {
        const r = document.createRange();
        const [sn, so] = locate(block, start, false);
        const [en, eo] = end > start ? locate(block, end, true) : [sn, so];
        r.setStart(sn, so);
        r.setEnd(en, eo);
        return r;
      }
      function setHighlight(name, ranges) {
        if (!HAS_HIGHLIGHT) return;
        if (ranges && ranges.length) CSS.highlights.set(name, new Highlight(...ranges));
        else CSS.highlights.delete(name);
      }
      cleanups.push(() => ["sl-grammar", "sl-grammar-now", "sl-find", "sl-find-now"].forEach((n) => setHighlight(n, null)));
      function replaceRange(r, text) {
        body.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        try { document.execCommand("styleWithCSS", false, false); } catch (e) {}
        if (text) document.execCommand("insertText", false, text);
        else document.execCommand("delete");
      }
      function scrollToRange(r) {
        const box = r.getBoundingClientRect();
        const sr = scroller.getBoundingClientRect();
        if (box.top < sr.top + 40 || box.bottom > sr.bottom - 40) scroller.scrollTop += box.top - sr.top - sr.height / 3;
      }

      // ----- find and replace (Ctrl+F / Ctrl+H) -----
      let matches = [];
      let current = -1;
      const findInput = el("input", { class: "sl-find-input", placeholder: "Find in doc", "aria-label": "Find in doc" });
      const replInput = el("input", { class: "sl-find-input", placeholder: "Replace with", "aria-label": "Replace with" });
      const findCount = el("span", { class: "sl-find-count", "aria-live": "polite" });
      const replBox = el("div", { class: "sl-find-repl", hidden: true }, replInput,
        el("button", { class: "sl-pill", onclick: () => replaceOne(), text: "Replace" }),
        el("button", { class: "sl-pill", onclick: () => replaceAll(), text: "Replace all" }));
      const findBar = el("div", { class: "sl-findbar", hidden: true, role: "search" },
        el("div", { class: "sl-find-row" },
          svg(ICON.find, 15), findInput, findCount,
          el("button", { class: "sl-tool", "aria-label": "Previous match", title: "Previous (Shift+Enter)", onclick: () => step(-1) }, svg(ICON.up, 15)),
          el("button", { class: "sl-tool", "aria-label": "Next match", title: "Next (Enter)", onclick: () => step(1) }, svg(ICON.chevron, 15)),
          el("button", { class: "sl-pill", onclick: () => { replBox.hidden = !replBox.hidden; if (!replBox.hidden) replInput.focus(); }, text: "Replace…" }),
          el("button", { class: "sl-tool", "aria-label": "Close find", title: "Close (Esc)", onclick: () => closeFind() }, svg(ICON.x, 15))),
        replBox);
      function openFind(withReplace) {
        findBar.hidden = false;
        if (withReplace) replBox.hidden = false;
        const sel = window.getSelection();
        if (sel.rangeCount && !sel.isCollapsed && body.contains(sel.anchorNode)) {
          const t = sel.toString();
          if (t.length < 80 && !t.includes("\n")) findInput.value = t;
        }
        findInput.focus();
        findInput.select();
        runFind(true);
      }
      function closeFind() {
        findBar.hidden = true;
        matches = [];
        setHighlight("sl-find", null);
        setHighlight("sl-find-now", null);
        body.focus();
      }
      function runFind(jump) {
        if (findBar.hidden) return;
        const q = findInput.value;
        matches = [];
        if (q) {
          const lq = q.toLowerCase();
          for (const b of textBlocks()) {
            const t = b.text.replace(/ /g, " ").toLowerCase();
            for (let i = t.indexOf(lq); i >= 0; i = t.indexOf(lq, i + lq.length)) matches.push(rangeFor(b, i, i + lq.length));
          }
        }
        if (current >= matches.length) current = matches.length - 1;
        if (jump || current < 0) current = matches.length ? 0 : -1;
        showFind(jump);
      }
      function showFind(scroll) {
        setHighlight("sl-find", matches);
        setHighlight("sl-find-now", current >= 0 ? [matches[current]] : null);
        findCount.textContent = !findInput.value ? "" : matches.length ? (current + 1) + " of " + matches.length : "No results";
        if (scroll && current >= 0) scrollToRange(matches[current]);
      }
      function step(d) {
        if (!matches.length) return;
        current = (current + d + matches.length) % matches.length;
        showFind(true);
      }
      function replaceOne() {
        if (current < 0 || !matches[current]) return;
        replaceRange(matches[current], replInput.value);
        syncBody();
        runFind(false);
        showFind(true);
        replInput.focus();
      }
      function replaceAll() {
        if (!matches.length) return;
        const n = matches.length;
        for (let i = matches.length - 1; i >= 0; i--) replaceRange(matches[i], replInput.value);
        syncBody();
        runFind(true);
        updateStatus("replaced " + n);
        replInput.focus();
      }
      findInput.addEventListener("input", () => runFind(true));
      for (const inp of [findInput, replInput]) {
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFind(); }
          else if (e.key === "Enter" && inp === findInput) { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
          else if (e.key === "Enter") { e.preventDefault(); replaceOne(); }
        });
      }

      // ----- grammar suggestions -----
      const ignored = new Set(Array.isArray(note.gIgnore) ? note.gIgnore : []);
      const issueKey = (x) => x.orig + "→" + x.fix;
      let issues = [];
      let lastSig = null;
      let grammarOpen = false;
      const gList = el("div", { class: "sl-g-list" });
      const gUnderline = el("input", {
        type: "checkbox",
        checked: data.settings.grammar !== false,
        onchange: (e) => { data.settings.grammar = e.target.checked; save(); check(); },
      });
      const grammarPanel = el("aside", { class: "sl-grammar", hidden: true, "aria-label": "Grammar suggestions" },
        el("div", { class: "sl-g-head" },
          el("span", { class: "sl-choice-head", text: "SUGGESTIONS" }),
          el("button", { class: "sl-tool", "aria-label": "Close suggestions", onclick: () => toggleGrammar(false) }, svg(ICON.x, 14))),
        el("label", { class: "sl-g-opt" }, gUnderline, "Underline as I type"),
        gList,
        el("p", { class: "sl-g-note", text: "English grammar, spelling and punctuation rules. Works offline; nothing leaves your computer." }));
      function toggleGrammar(force) {
        const on = force === undefined ? !grammarOpen : force;
        openSide(on ? "grammar" : null);
      }
      function toggleChars(force) {
        const on = force === undefined ? !charsOpen : force;
        openSide(on ? "chars" : null);
      }
      // One side panel at a time.
      function openSide(which) {
        grammarOpen = which === "grammar";
        charsOpen = which === "chars";
        histOpen = which === "hist";
        grammarPanel.hidden = !grammarOpen;
        charPanel.hidden = !charsOpen;
        histPanel.hidden = !histOpen;
        grammarBtn.classList.toggle("on", grammarOpen);
        charsBtn.classList.toggle("on", charsOpen);
        histBtn.classList.toggle("on", histOpen);
        check();
        if (charsOpen) drawChars();
        if (histOpen) drawHistory();
        else if (histPick) closePreview();
      }
      function check() {
        issues = [];
        for (const b of textBlocks()) {
          const isList = b.el.tagName === "LI";
          for (const x of grammarCheck(b.text, isList)) {
            if (ignored.has(issueKey(x))) continue;
            x.range = rangeFor(b, x.start, x.end);
            // Short fixes (one capital letter, "i", a space) underline the whole word so they are easy to see.
            let ws = x.start;
            let we = x.end;
            if (we - ws <= 2) {
              while (ws > 0 && /[\w'’]/.test(b.text[ws - 1])) ws--;
              while (we < b.text.length && /[\w'’]/.test(b.text[we])) we++;
              if (we === ws) { ws = Math.max(0, ws - 1); we = Math.min(b.text.length, we + 1); }
            }
            x.show = ws === x.start && we === x.end ? x.range : rangeFor(b, ws, we);
            issues.push(x);
          }
        }
        const show = data.settings.grammar !== false;
        setHighlight("sl-grammar", show ? issues.map((x) => x.show) : null);
        badge.hidden = !show || !issues.length;
        badge.textContent = issues.length > 99 ? "99+" : String(issues.length);
        // Only redraw the list when the suggestions actually changed.
        const sig = issues.map((x) => x.start + ":" + x.orig + ">" + x.fix).join("|");
        if (grammarOpen && (sig !== lastSig || !gList.childElementCount)) renderIssues();
        lastSig = grammarOpen ? sig : null;
      }
      const showChars = (t) => (t === "" ? "(remove)" : t.trim() ? t : "␣".repeat(t.length));
      function issueCard(x) {
        return el("div", {
          class: "sl-g-card",
          onmouseenter: () => setHighlight("sl-grammar-now", [x.show]),
          onmouseleave: () => setHighlight("sl-grammar-now", null),
          onclick: (e) => { if (!e.target.closest("button")) scrollToRange(x.range); },
        },
          el("span", { class: "sl-g-msg", text: x.msg }),
          el("div", { class: "sl-g-change" },
            el("s", { text: showChars(x.orig) }), " → ", el("b", { text: showChars(x.fix) })),
          el("div", { class: "sl-g-btns" },
            el("button", { class: "sl-pill dark", onclick: () => accept(x), text: "Accept" }),
            el("button", { class: "sl-pill", onclick: () => ignore(x), text: "Ignore" })));
      }
      function renderIssues() {
        gList.textContent = "";
        if (!issues.length) {
          gList.append(el("div", { class: "sl-g-empty" },
            el("strong", { text: "Looking good." }), el("span", { text: "No suggestions right now." })));
          return;
        }
        gList.append(el("div", { class: "sl-g-top" },
          el("span", { text: issues.length + (issues.length === 1 ? " suggestion" : " suggestions") }),
          el("button", { class: "sl-pill", onclick: acceptAll, text: "Accept all" })));
        issues.forEach((x) => gList.append(issueCard(x)));
      }
      function accept(x) {
        closePop();
        setHighlight("sl-grammar-now", null);
        replaceRange(x.range, x.fix);
        syncBody();
        check();
      }
      function acceptAll() {
        for (let i = issues.length - 1; i >= 0; i--) replaceRange(issues[i].range, issues[i].fix);
        syncBody();
        check();
      }
      function ignore(x) {
        closePop();
        ignored.add(issueKey(x));
        note.gIgnore = Array.from(ignored).slice(-200);
        touch(note);
        check();
      }
      // Click an underlined word to see the suggestion right there.
      let gpop = null;
      function closePop() { if (gpop) gpop.remove(); gpop = null; }
      cleanups.push(closePop);
      function issueAtCaret() {
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.isCollapsed) return null;
        const n = sel.anchorNode;
        const o = sel.anchorOffset;
        return issues.find((x) => {
          try { return x.show.isPointInRange(n, o); } catch (e) { return false; }
        }) || null;
      }
      function maybePop() {
        closePop();
        if (data.settings.grammar === false) return;
        const x = issueAtCaret();
        if (!x) return;
        const box = x.show.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        gpop = el("div", { class: "sl-gpop", role: "dialog", "aria-label": "Suggestion" },
          el("span", { class: "sl-g-msg", text: x.msg }),
          el("div", { class: "sl-g-btns" },
            el("button", { class: "sl-pill dark", onmousedown: (e) => e.preventDefault(), onclick: () => accept(x), text: x.fix === "" ? "Remove" : x.fix.trim() ? x.fix : "Fix spacing" }),
            el("button", { class: "sl-pill", onmousedown: (e) => e.preventDefault(), onclick: () => ignore(x), text: "Ignore" })));
        gpop.style.left = Math.max(8, Math.min(box.left - r.left, r.width - 268)) + "px";
        gpop.style.top = (box.bottom - r.top + 8) + "px";
        root.append(gpop);
      }


      // ----- special characters and equations -----
      let charsOpen = false;
      let charCat = (data.settings.recentChars || []).length ? "recent" : "maths";
      let eqSubject = "Maths";
      const charSearch = el("input", {
        class: "sl-find-input sl-char-search",
        type: "search",
        placeholder: "Search: alpha, degree, arrow, quadratic…",
        "aria-label": "Search symbols and equations",
        oninput: () => drawChars(),
        onkeydown: (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (charSearch.value) { charSearch.value = ""; drawChars(); } else toggleChars(false); } },
      });
      const charCats = el("div", { class: "sl-char-cats", role: "tablist", "aria-label": "Symbol groups" });
      const charBody = el("div", { class: "sl-char-body" });
      const autoBox = el("input", {
        type: "checkbox",
        checked: data.settings.autoSymbols !== false,
        onchange: (e) => { data.settings.autoSymbols = e.target.checked; save(); },
      });
      const charPanel = el("aside", { class: "sl-grammar sl-chars", hidden: true, "aria-label": "Special characters and equations" },
        el("div", { class: "sl-g-head" },
          el("span", { class: "sl-choice-head", text: "CHARACTERS & EQUATIONS" }),
          el("button", { class: "sl-tool", "aria-label": "Close characters", onclick: () => toggleChars(false) }, svg(ICON.x, 14))),
        charSearch, charCats, charBody,
        el("label", { class: "sl-g-opt" }, autoBox, "Typing shortcuts (\\alpha, ->, x^2, H_2O)"));
      const SYMBOL_NAME = {};
      for (const c of SYMBOLS) for (const [ch, name] of c.items) if (!SYMBOL_NAME[ch]) SYMBOL_NAME[ch] = name;
      for (const list of Object.values(EQUATIONS)) for (const [name, f] of list) SYMBOL_NAME[f] = name;
      function insertChar(text) {
        run("insertText", text);
        const rec = (data.settings.recentChars || []).filter((x) => x !== text);
        rec.unshift(text);
        data.settings.recentChars = rec.slice(0, 24);
        save();
        saveSel();
        if (charCat === "recent" && !charSearch.value) drawChars();
      }
      const keepText = (e) => { saveSel(); e.preventDefault(); };
      function charGrid(items) {
        const g = el("div", { class: "sl-char-grid" });
        for (const [ch, name] of items) {
          const size = ch.length <= 2 ? "" : ch.length <= 7 ? " mid" : " row";
          g.append(el("button", {
            class: "sl-char" + size,
            title: name,
            "aria-label": name,
            onmousedown: keepText,
            onclick: () => insertChar(ch),
          }, el("span", { class: "sl-char-glyph", text: ch }), size === " row" ? el("span", { class: "sl-char-name", text: name }) : null));
        }
        return g;
      }
      function eqList(list, showSubject) {
        const box = el("div", { class: "sl-eq-list" });
        for (const [name, f, subject] of list) {
          box.append(el("button", { class: "sl-eq", title: "Insert " + name, onmousedown: keepText, onclick: () => insertChar(f) },
            el("span", { class: "sl-eq-name", text: name + (showSubject ? " · " + subject : "") }),
            el("span", { class: "sl-eq-f", text: f })));
        }
        return box;
      }
      function drawChars() {
        const q = charSearch.value.trim().toLowerCase();
        charCats.textContent = "";
        charBody.textContent = "";
        charCats.hidden = !!q;
        if (q) {
          const words = q.split(/\s+/);
          const hit = (t) => words.every((w) => t.includes(w));
          const seen = new Set();
          const items = [];
          for (const c of SYMBOLS) {
            for (const [ch, name] of c.items) {
              if (!seen.has(ch) && hit((name + " " + c.name + " " + ch).toLowerCase())) { seen.add(ch); items.push([ch, name]); }
            }
          }
          const eqs = [];
          for (const [subject, list] of Object.entries(EQUATIONS)) {
            for (const [name, f] of list) if (hit((name + " " + subject + " " + f).toLowerCase())) eqs.push([name, f, subject]);
          }
          if (items.length) charBody.append(charGrid(items.slice(0, 160)));
          if (eqs.length) charBody.append(el("span", { class: "sl-choice-head", text: "EQUATIONS" }), eqList(eqs, true));
          if (!items.length && !eqs.length) charBody.append(el("p", { class: "sl-g-note", text: "Nothing found for “" + q + "”." }));
          return;
        }
        const cats = [{ id: "recent", name: "Recent" }].concat(SYMBOLS.map((c) => ({ id: c.id, name: c.name })), [{ id: "equations", name: "Equations" }]);
        for (const c of cats) {
          charCats.append(el("button", {
            class: "sl-cat" + (charCat === c.id ? " on" : ""),
            role: "tab",
            "aria-selected": charCat === c.id ? "true" : "false",
            onmousedown: (e) => e.preventDefault(),
            onclick: () => { charCat = c.id; drawChars(); },
            text: c.name,
          }));
        }
        if (charCat === "recent") {
          const rec = data.settings.recentChars || [];
          if (rec.length) charBody.append(charGrid(rec.map((r) => [r, SYMBOL_NAME[r] || r])));
          else charBody.append(el("p", { class: "sl-g-note", text: "Symbols and equations you use will appear here." }));
          return;
        }
        if (charCat === "equations") {
          const subj = el("div", { class: "sl-char-cats" });
          for (const name of Object.keys(EQUATIONS)) {
            subj.append(el("button", {
              class: "sl-cat" + (eqSubject === name ? " on" : ""),
              onmousedown: (e) => e.preventDefault(),
              onclick: () => { eqSubject = name; drawChars(); },
              text: name,
            }));
          }
          charBody.append(subj, eqList(EQUATIONS[eqSubject].map(([n, f]) => [n, f, eqSubject]), false));
          return;
        }
        if (charCat === "scripts") {
          charBody.append(el("div", { class: "sl-g-btns" },
            el("button", { class: "sl-pill", onmousedown: keepText, onclick: () => run("superscript"), text: "x² Superscript  Ctrl+." }),
            el("button", { class: "sl-pill", onmousedown: keepText, onclick: () => run("subscript"), text: "x₂ Subscript  Ctrl+," })));
        }
        const group = SYMBOLS.find((c) => c.id === charCat) || SYMBOLS[0];
        charBody.append(charGrid(group.items));
      }

      // Typing shortcuts: \alpha + space, ->, x^2 + space, H_2O
      let replacing = false;
      const toScript = (t, to, from) => Array.from(t).map((c) => to[from.indexOf(c)] || c).join("");
      function autoSymbol(e) {
        if (replacing || data.settings.autoSymbols === false || e.inputType !== "insertText" || !e.data) return;
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.isCollapsed) return;
        const node = sel.anchorNode;
        if (!node || node.nodeType !== 3) return;
        const off = sel.anchorOffset;
        const before = node.textContent.slice(0, off).replace(/ /g, " ");
        const typed = before.slice(-1);
        let start = -1;
        let end = off;
        let sym = null;
        let after = 0;
        let m;
        if (/\s/.test(typed) && (m = before.match(/\\([A-Za-z]+)\s$/)) && BACKSLASH[m[1]]) {
          start = off - m[0].length; end = off - 1; sym = BACKSLASH[m[1]]; after = 1;
        }
        if (sym === null) {
          for (const [from, to] of ARROWS) {
            if (before.endsWith(from)) { start = off - from.length; sym = to; break; }
          }
        }
        if (sym === null && !/[0-9]/.test(typed)) {
          const head = before.slice(0, -1);
          if ((m = head.match(/[A-Za-z0-9)\]]\^(-?\d+|n)$/))) {
            const len = m[1].length + 1;
            start = off - 1 - len; end = off - 1; sym = toScript(m[1], SUPS, SUP_FROM); after = 1;
          } else if ((m = head.match(/[A-Za-z)\]]_(\d+)$/))) {
            const len = m[1].length + 1;
            start = off - 1 - len; end = off - 1; sym = toScript(m[1], SUBS, SUB_FROM); after = 1;
          }
        }
        if (sym === null || start < 0) return;
        replacing = true;
        const r = document.createRange();
        r.setStart(node, start);
        r.setEnd(node, end);
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand("insertText", false, sym);
        for (let i = 0; i < after; i++) sel.modify("move", "forward", "character");
        replacing = false;
      }

      // ----- handwriting: a drawing layer over the page -----
      const REF = 816; // strokes are stored against this page width, so they scale with the page
      if (!Array.isArray(note.ink)) note.ink = [];
      const canvas = el("canvas", { class: "sl-ink", "aria-hidden": "true" });
      const ctx = canvas.getContext("2d");
      let scale = 1;
      let drawing = false;      // draw mode on or off
      let stroke = null;        // the stroke being drawn
      const undoInk = [];
      const redoInk = [];
      const PEN_COLORS = [["Ink", "#2f2e2b"], ["Brick", "#8a4f45"], ["Moss", "#4d6b55"], ["Slate", "#4f6a80"], ["Plum", "#6d5a80"], ["Clay", "#a3684d"]];
      const HL_COLORS = [["Butter", "#ece8b0"], ["Sage", "#d3dccb"], ["Rose", "#ecd6d1"], ["Mist", "#d2dbe2"], ["Lavender", "#ddd7f0"], ["Clay", "#e4cdb4"]];
      const pen = { tool: "pen", color: "#2f2e2b", w: 2.2 };
      const hl = { tool: "hl", color: "#ece8b0", w: 14 };
      let inkTool = "pen";                    // pen | hl | eraser
      let eraseMode = note.eraseMode || "stroke"; // stroke | part
      let lastDrawTool = "pen";
      let backToPen = data.settings.eraserBackToPen !== false;
      let fingerDraw = data.settings.fingerDraw !== false;
      let shapeSnap = data.settings.shapeSnap !== false;
      const curPen = () => (inkTool === "hl" ? hl : pen);

      function inkChanged(remember) {
        if (remember) { undoInk.push(JSON.stringify(note.ink)); redoInk.length = 0; if (undoInk.length > 60) undoInk.shift(); }
        note.ink = note.ink.filter((s) => s.pts.length >= 2);
        touch(note);
        updateStatus();
        drawInk();
      }
      function stepInk(from, to) {
        if (!from.length) return;
        to.push(JSON.stringify(note.ink));
        note.ink = JSON.parse(from.pop());
        touch(note);
        drawInk();
        if (histOpen) drawHistory();
      }

      let inkH = 0;
      function sizeCanvas() {
        const k = zoomK();
        const h = paper.getBoundingClientRect().height / k;
        if (!h) return;
        scale = 1;
        inkH = h;
        // Sharp at any zoom, but never larger than the browser allows for one canvas.
        const res = Math.max(0.5, Math.min(4, (window.devicePixelRatio || 1) * k, 16000 / h, Math.sqrt(40e6 / (REF * h))));
        const cw = Math.round(REF * res);
        const ch = Math.round(h * res);
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        canvas.style.width = REF + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(res, 0, 0, res, 0, 0);
      }
      function strokePath(s) {
        const p = s.pts;
        ctx.strokeStyle = s.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = s.tool === "hl" ? 0.42 : 1;
        if (p.length === 3) {
          ctx.beginPath();
          ctx.lineWidth = s.w * (s.tool === "hl" ? 1 : 0.4 + 0.6 * p[2]);
          ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, 6.2832);
          ctx.fillStyle = s.color;
          ctx.fill();
          ctx.globalAlpha = 1;
          return;
        }
        // Highlighter and even-pressure strokes are one smooth path, so see-through ink stays even.
        let even = s.tool === "hl";
        if (!even) {
          even = true;
          for (let i = 5; i < p.length; i += 3) if (Math.abs(p[i] - p[2]) > 0.05) { even = false; break; }
        }
        if (even) {
          ctx.beginPath();
          ctx.lineWidth = s.w * (s.tool === "hl" ? 1 : 0.4 + 0.6 * p[2]);
          ctx.moveTo(p[0], p[1]);
          for (let i = 3; i < p.length; i += 3) {
            if (i + 3 < p.length) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 3]) / 2, (p[i + 1] + p[i + 4]) / 2);
            else ctx.lineTo(p[i], p[i + 1]);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          return;
        }
        for (let i = 3; i < p.length; i += 3) {
          ctx.beginPath();
          ctx.lineWidth = s.w * (0.4 + 0.6 * ((p[i + 2] + p[i - 1]) / 2));
          ctx.moveTo(p[i - 3], p[i - 2]);
          if (i + 3 < p.length) {
            const mx = (p[i] + p[i + 3]) / 2;
            const my = (p[i + 1] + p[i + 4]) / 2;
            ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
          } else {
            ctx.lineTo(p[i], p[i + 1]);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      function drawInk() {
        sizeCanvas();
        ctx.clearRect(0, 0, REF, inkH);
        for (const s of note.ink) strokePath(s);
        if (stroke) strokePath(stroke);
      }

      // --- geometry helpers for erasing and shapes ---
      function near(s, x, y, r) {
        const p = s.pts;
        const pad = r + s.w / 2;
        for (let i = 0; i < p.length - 3; i += 3) {
          const dx = p[i + 3] - p[i];
          const dy = p[i + 4] - p[i + 1];
          const len = dx * dx + dy * dy;
          let t = len ? ((x - p[i]) * dx + (y - p[i + 1]) * dy) / len : 0;
          t = Math.max(0, Math.min(1, t));
          const ex = p[i] + t * dx - x;
          const ey = p[i + 1] + t * dy - y;
          if (ex * ex + ey * ey <= pad * pad) return true;
        }
        const last = p.length - 3;
        return (p[last] - x) ** 2 + (p[last + 1] - y) ** 2 <= pad * pad;
      }
      function eraseAt(x, y, r) {
        let changed = false;
        const kept = [];
        for (const s of note.ink) {
          if (!near(s, x, y, r)) { kept.push(s); continue; }
          changed = true;
          if (eraseMode === "stroke") continue;
          // Partial rubbing out: keep the pieces of the stroke that were not touched.
          let piece = [];
          for (let i = 0; i < s.pts.length; i += 3) {
            const hit = (s.pts[i] - x) ** 2 + (s.pts[i + 1] - y) ** 2 <= (r + s.w / 2) ** 2;
            if (hit) {
              if (piece.length >= 6) kept.push({ tool: s.tool, color: s.color, w: s.w, pts: piece });
              piece = [];
            } else {
              piece.push(s.pts[i], s.pts[i + 1], s.pts[i + 2]);
            }
          }
          if (piece.length >= 6) kept.push({ tool: s.tool, color: s.color, w: s.w, pts: piece });
        }
        if (changed) note.ink = kept;
        return changed;
      }
      // Hold still at the end of a stroke and it becomes a neat line, box, circle or triangle.
      function snapShape(s) {
        const p = s.pts;
        if (p.length < 18) return null;
        const xs = [];
        const ys = [];
        for (let i = 0; i < p.length; i += 3) { xs.push(p[i]); ys.push(p[i + 1]); }
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        if (Math.max(w, h) < 18) return null;
        let len = 0;
        for (let i = 1; i < xs.length; i++) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        const span = Math.hypot(xs[xs.length - 1] - xs[0], ys[ys.length - 1] - ys[0]);
        const closed = span < Math.max(w, h) * 0.32;
        const mk = (pts) => ({ tool: s.tool, color: s.color, w: s.w, pts: pts.flatMap(([x, y]) => [x, y, 0.8]) });
        if (!closed) {
          if (len && span / len > 0.88) return mk([[xs[0], ys[0]], [xs[xs.length - 1], ys[ys.length - 1]]]);
          return null;
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const area = Math.abs(xs.reduce((a, _, i) => {
          const j = (i + 1) % xs.length;
          return a + (xs[i] * ys[j] - xs[j] * ys[i]);
        }, 0) / 2);
        const fill = area / (w * h || 1);
        if (fill > 0.88) {
          return mk([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]);
        }
        if (fill < 0.58) {
          // Three corners: the points furthest from the middle, spread around it.
          const picked = [];
          for (let a = -90; a < 270; a += 120) {
            let best = null;
            let bestD = -1;
            for (let i = 0; i < xs.length; i++) {
              const ang = (Math.atan2(ys[i] - cy, xs[i] - cx) * 180) / Math.PI;
              let d = Math.abs(((ang - a + 540) % 360) - 180);
              if (d > 120) continue;
              const dist = Math.hypot(xs[i] - cx, ys[i] - cy);
              if (dist > bestD) { bestD = dist; best = [xs[i], ys[i]]; }
            }
            if (best) picked.push(best);
          }
          if (picked.length === 3) return mk(picked.concat([picked[0]]));
        }
        const pts = [];
        for (let a = 0; a <= 360; a += 10) {
          const r = (a * Math.PI) / 180;
          pts.push([cx + (w / 2) * Math.cos(r), cy + (h / 2) * Math.sin(r)]);
        }
        return mk(pts);
      }

      // --- pointer handling ---
      let held = null;
      function point(e) {
        const r = canvas.getBoundingClientRect();
        const k = zoomK();
        return {
          x: (e.clientX - r.left) / k,
          y: (e.clientY - r.top) / k,
          p: e.pressure && e.pressure > 0 && e.pointerType !== "mouse" ? e.pressure : 0.5,
        };
      }
      canvas.addEventListener("pointerdown", (e) => {
        if (!drawing || e.button !== 0) return;
        if (e.pointerType === "touch" && !fingerDraw) return;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        undoInk.push(JSON.stringify(note.ink));
        redoInk.length = 0;
        if (undoInk.length > 60) undoInk.shift();
        const q = point(e);
        if (inkTool === "eraser") {
          stroke = null;
          eraseAt(q.x, q.y, eraseMode === "stroke" ? 6 : 10);
          drawInk();
          return;
        }
        const c = curPen();
        stroke = { tool: c.tool, color: c.color, w: c.w, pts: [q.x, q.y, q.p] };
        held = { x: q.x, y: q.y, t: Date.now() };
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!drawing || !e.buttons) return;
        if (e.pointerType === "touch" && !fingerDraw) return;
        const q = point(e);
        if (inkTool === "eraser") {
          if (eraseAt(q.x, q.y, eraseMode === "stroke" ? 6 : 10)) drawInk();
          return;
        }
        if (!stroke) return;
        const n = stroke.pts.length;
        if (Math.hypot(q.x - stroke.pts[n - 3], q.y - stroke.pts[n - 2]) < 1.1) return;
        stroke.pts.push(q.x, q.y, q.p);
        if (held && Math.hypot(q.x - held.x, q.y - held.y) > 4) held = { x: q.x, y: q.y, t: Date.now() };
        drawInk();
      });
      function endStroke(e) {
        if (!drawing) return;
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        if (inkTool === "eraser") {
          inkChanged(false);
          if (backToPen) setTool(lastDrawTool);
          return;
        }
        if (!stroke) return;
        let s = stroke;
        stroke = null;
        if (shapeSnap && held && Date.now() - held.t > 450) s = snapShape(s) || s;
        note.ink.push(s);
        inkChanged(false);
      }
      canvas.addEventListener("pointerup", endStroke);
      canvas.addEventListener("pointercancel", endStroke);

      // --- the pen tray ---
      const tray = el("div", { class: "sl-tray", hidden: true, role: "toolbar", "aria-label": "Drawing tools" });
      const widthInput = el("input", {
        type: "range", min: "1", max: "40", step: "0.5", class: "sl-range", "aria-label": "Stroke width",
        oninput: (e) => setWidth(parseFloat(e.target.value)),
      });
      const widthNum = el("input", {
        type: "number", min: "1", max: "40", step: "0.5", class: "sl-wnum", "aria-label": "Stroke width in points",
        onchange: (e) => setWidth(parseFloat(e.target.value)),
      });
      function setWidth(v) {
        if (!(v > 0)) return;
        curPen().w = Math.min(40, Math.max(1, v));
        drawTray();
      }
      function setTool(t) {
        inkTool = t;
        if (t !== "eraser") lastDrawTool = t;
        drawTray();
      }
      function trayBtn(icon, label, on, onClick, extra) {
        return el("button", { class: "sl-tool" + (on ? " on" : "") + (extra || ""), "aria-label": label, title: label, "aria-pressed": on ? "true" : "false", onclick: onClick }, svg(icon, 16));
      }
      function drawTray() {
        tray.textContent = "";
        tray.hidden = !drawing;
        drawBtn.classList.toggle("on", drawing);
        canvas.classList.toggle("on", drawing);
        canvas.style.cursor = inkTool === "eraser" ? "cell" : "crosshair";
        body.setAttribute("contenteditable", drawing ? "false" : "true");
        paper.classList.toggle("drawing", drawing);
        if (!drawing) return;
        tray.append(
          trayBtn(ICON.draw, "Pen", inkTool === "pen", () => setTool("pen")),
          trayBtn(ICON.mark, "Highlighter", inkTool === "hl", () => setTool("hl")),
          trayBtn(ICON.eraser, "Eraser", inkTool === "eraser", () => setTool("eraser")),
          el("span", { class: "sl-tool-sep", "aria-hidden": "true" }));
        if (inkTool === "eraser") {
          for (const [k, name] of [["stroke", "Whole stroke"], ["part", "Rub out part"]]) {
            tray.append(el("button", {
              class: "sl-pill" + (eraseMode === k ? " dark" : ""),
              onclick: () => { eraseMode = k; note.eraseMode = k; touch(note); drawTray(); },
              text: name,
            }));
          }
          tray.append(el("label", { class: "sl-tray-opt" },
            el("input", { type: "checkbox", checked: backToPen, onchange: (e) => { backToPen = e.target.checked; data.settings.eraserBackToPen = backToPen; save(); } }),
            "Back to pen after erasing"));
        } else {
          const c = curPen();
          const colors = inkTool === "hl" ? HL_COLORS : PEN_COLORS;
          const dots = el("div", { class: "sl-pen-colors" });
          for (const [name, value] of colors) {
            dots.append(el("button", {
              class: "sl-pen-dot" + (c.color === value ? " on" : ""),
              style: "background:" + value,
              "aria-label": name, title: name,
              onclick: () => { c.color = value; drawTray(); },
            }));
          }
          widthInput.value = c.w;
          widthNum.value = c.w;
          tray.append(dots, el("span", { class: "sl-tool-sep", "aria-hidden": "true" }), widthInput, widthNum, el("span", { class: "sl-tray-unit", text: "pt" }));
        }
        tray.append(
          el("span", { class: "sl-tool-sep", "aria-hidden": "true" }),
          trayBtn(ICON.undo, "Undo stroke", false, () => stepInk(undoInk, redoInk)),
          trayBtn(ICON.redo, "Redo stroke", false, () => stepInk(redoInk, undoInk)),
          trayBtn(ICON.shapes, "Hold at the end of a stroke to make a neat shape", shapeSnap, () => { shapeSnap = !shapeSnap; data.settings.shapeSnap = shapeSnap; save(); drawTray(); }),
          el("label", { class: "sl-tray-opt" },
            el("input", { type: "checkbox", checked: fingerDraw, onchange: (e) => { fingerDraw = e.target.checked; data.settings.fingerDraw = fingerDraw; save(); } }),
            "Draw with finger"),
          el("span", { class: "sl-tool-sep", "aria-hidden": "true" }),
          el("button", { class: "sl-pill", onclick: () => toggleDraw(false), text: "Done" }));
      }
      function toggleDraw(force) {
        drawing = force === undefined ? !drawing : force;
        drawTray();
        if (!drawing) body.focus();
      }
      const drawBtn = tool(ICON.draw, "Draw and handwrite", () => toggleDraw(), null, "Ctrl+D");

      // Slot the drawing and history buttons in beside Print.
      const printAnchor = tools.querySelector('[aria-label="Print or save as PDF"]');
      tools.insertBefore(drawBtn, printAnchor);

      // ----- version history -----
      let histOpen = false;
      let histPick = null;
      const histList = el("div", { class: "sl-g-list" });
      const histPanel = el("aside", { class: "sl-grammar sl-hist", hidden: true, "aria-label": "Version history" },
        el("div", { class: "sl-g-head" },
          el("span", { class: "sl-choice-head", text: "VERSION HISTORY" }),
          el("button", { class: "sl-tool", "aria-label": "Close history", onclick: () => toggleHist(false) }, svg(ICON.x, 14))),
        histList,
        el("p", { class: "sl-g-note", text: "A copy is kept as you write, and whenever you close the doc. Older copies are removed once there are 40." }));
      const histBtn = tool(ICON.clock, "Version history", () => toggleHist(), null);
      tools.insertBefore(histBtn, printAnchor);
      function toggleHist(force) {
        const on = force === undefined ? !histOpen : force;
        openSide(on ? "hist" : null);
      }
      function closePreview() {
        histPick = null;
        preview.hidden = true;
        paper.hidden = false;
        drawHistory();
      }
      const previewPaper = el("div", { class: "sl-paper sl-prev-paper" });
      const previewHead = el("div", { class: "sl-prev-head" });
      const preview = el("div", { class: "sl-prev", hidden: true }, previewHead, previewPaper);
      function showVersion(v) {
        histPick = v;
        paper.hidden = true;
        preview.hidden = false;
        previewHead.textContent = "";
        previewHead.append(
          el("span", { class: "sl-prev-when", text: whenText(v.t) + " · " + (v.device || "This computer") }),
          el("button", { class: "sl-pill dark", onclick: () => restoreVersion(v), text: "Restore this version" }),
          el("button", { class: "sl-pill", onclick: closePreview, text: "Back to current" }));
        previewPaper.textContent = "";
        previewPaper.append(el("div", { class: "sl-doc-title sl-prev-title", text: v.title || "Untitled doc" }));
        const diff = wordDiff(htmlToText(v.html), htmlToText(note.html));
        const bodyBox = el("div", { class: "sl-doc-body sl-prev-body" });
        if (diff && diff.some((d) => d.type !== "same")) {
          for (const d of diff) {
            if (d.type === "same") bodyBox.append(d.text);
            else if (d.type === "del") bodyBox.append(el("span", { class: "sl-d-del", text: d.text }));
            else bodyBox.append(el("span", { class: "sl-d-add", text: d.text }));
          }
          previewHead.append(el("span", { class: "sl-prev-key" },
            el("span", { class: "sl-d-del", text: "removed since" }), " ", el("span", { class: "sl-d-add", text: "added since" })));
        } else {
          bodyBox.innerHTML = cleanHtml(v.html);
        }
        previewPaper.append(bodyBox);
        if ((v.ink || []).length) previewPaper.append(el("p", { class: "sl-g-note", text: (v.ink || []).length + " handwritten strokes are part of this version." }));
        drawHistory();
      }
      function restoreVersion(v) {
        pushVersion(note, snapOf(note), true);
        note.title = v.title || "";
        note.html = v.html || "";
        note.ink = JSON.parse(JSON.stringify(v.ink || []));
        touch(note);
        render();
        showToast("Restored the version from " + whenText(v.t) + ".", () => {
          const list = versionsOf(note);
          const back = list[list.length - 1];
          if (!back) return;
          note.title = back.title;
          note.html = back.html;
          note.ink = back.ink;
          list.pop();
          touch(note);
          render();
        });
      }
      function drawHistory() {
        histList.textContent = "";
        const list = versionsOf(note).slice().reverse();
        histList.append(el("button", {
          class: "sl-ver" + (histPick ? "" : " on"),
          onclick: closePreview,
        },
          el("span", { class: "sl-ver-when", text: "Current version" }),
          el("span", { class: "sl-ver-who", text: htmlToText(note.html).split(" ").filter(Boolean).length + " words" + ((note.ink || []).length ? " · " + note.ink.length + " strokes" : "") })));
        if (!list.length) {
          histList.append(el("p", { class: "sl-g-note", text: "No earlier versions yet. One is kept as you write." }));
          return;
        }
        for (const v of list) {
          histList.append(el("button", {
            class: "sl-ver" + (histPick === v ? " on" : ""),
            onclick: () => showVersion(v),
          },
            el("span", { class: "sl-ver-when", text: whenText(v.t) }),
            el("span", { class: "sl-ver-who", text: (v.device || "This computer") + " · " + htmlToText(v.html).split(" ").filter(Boolean).length + " words" })));
        }
      }
      // Keep a copy once typing settles, and again when the doc is closed.
      let snapTimer = 0;
      function laterSnap() {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
          if (pushVersion(note, snapOf(note), false)) { save(); if (histOpen) drawHistory(); }
        }, 15000);
      }
      cleanups.push(() => {
        clearTimeout(snapTimer);
        if (pushVersion(note, snapOf(note), false)) save();
      });


      // ----- zoom, like Google Docs: pinch the touchpad, Ctrl + / Ctrl − / Ctrl 0, or the menu -----
      const ZOOMS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2];
      let zoom = 1;
      let zoomMode = data.settings.docZoom === undefined ? "auto" : data.settings.docZoom; // auto | fit | a number
      function zoomK() {
        const wpx = paper.getBoundingClientRect().width;
        return wpx ? wpx / REF : 1;
      }
      function fitZoom() {
        const avail = (scroller.clientWidth || 900) - 40;
        return Math.min(2, Math.max(0.5, avail / REF));
      }
      const pct = (z) => Math.round(z * 100) + "%";
      const zoomDd = dropdown({
        label: "Zoom",
        cls: "sl-dd-zoom",
        keepFocus: true,
        onOpen: saveSel,
        options: [{ value: "fit", text: "Fit width" }].concat(ZOOMS.map((z) => ({ value: z, text: pct(z) }))),
        value: 1,
        format: (v) => (typeof v === "number" ? pct(v) : "100%"),
        onPick: (v) => {
          zoomMode = v;
          data.settings.docZoom = v;
          save();
          setZoom(v === "fit" ? fitZoom() : v);
          restoreSel();
        },
      });
      function setZoom(z, ax, ay) {
        z = Math.round(Math.min(2.5, Math.max(0.5, z)) * 1000) / 1000;
        const sr = scroller.getBoundingClientRect();
        const ox = (ax === undefined ? sr.left + sr.width / 2 : ax) - sr.left;
        const oy = (ay === undefined ? sr.top + sr.height / 3 : ay) - sr.top;
        // Keep the spot under the cursor (or the middle) in place while zooming.
        const cx = (scroller.scrollLeft + ox) / zoom;
        const cy = (scroller.scrollTop + oy) / zoom;
        zoom = z;
        zoomBox.style.zoom = String(z);
        scroller.scrollLeft = cx * z - ox;
        scroller.scrollTop = cy * z - oy;
        zoomDd.set(zoomMode === "fit" ? "fit" : z);
        closePop();
        later();
      }
      function stepZoom(dir) {
        const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.001) : ZOOMS.slice().reverse().find((z) => z < zoom - 0.001);
        if (!next) return;
        zoomMode = next;
        data.settings.docZoom = next;
        save();
        setZoom(next);
      }
      let zoomSave = 0;
      function onWheelZoom(e) {
        if (!e.ctrlKey && !e.metaKey) return; // touchpad pinch arrives as Ctrl + wheel
        e.preventDefault();
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.004));
        zoomMode = zoom * f;
        setZoom(zoom * f, e.clientX, e.clientY);
        zoomMode = zoom;
        clearTimeout(zoomSave);
        zoomSave = setTimeout(() => { data.settings.docZoom = zoom; save(); }, 400);
      }
      cleanups.push(() => clearTimeout(zoomSave));

      // ----- pictures: paste, drop, or pick a file -----
      const MAX_SIDE = 1600;
      function readImage(file) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              let w = img.naturalWidth;
              let h = img.naturalHeight;
              let url = reader.result;
              // Big photos are scaled down so notes stay quick to open and save.
              if (Math.max(w, h) > MAX_SIDE || file.size > 1200000) {
                const r = Math.min(1, MAX_SIDE / Math.max(w, h));
                w = Math.round(w * r);
                h = Math.round(h * r);
                const c = document.createElement("canvas");
                c.width = w;
                c.height = h;
                const cx = c.getContext("2d");
                const keepPng = /png|gif|webp/.test(file.type) && file.size < 1200000;
                if (!keepPng) { cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h); }
                cx.drawImage(img, 0, 0, w, h);
                url = keepPng ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
              }
              resolve({ url, w });
            };
            img.onerror = () => resolve(null);
            img.src = reader.result;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }
      async function insertImages(files) {
        const list = Array.from(files || []).filter((f) => /^image\/(png|jpe?g|gif|webp)$/i.test(f.type));
        if (!list.length) return false;
        saveSel();
        updateStatus("adding picture…");
        let html = "";
        for (const f of list) {
          const res = await readImage(f);
          if (!res || !SAFE_IMG.test(res.url)) continue;
          const width = Math.max(10, Math.min(100, Math.round((res.w / 688) * 100)));
          html += '<img src="' + res.url + '" alt="" style="width: ' + width + '%">';
        }
        if (!html) { updateStatus("that picture couldn't be read"); return true; }
        // Pictures go on their own line, like Google Docs does when you paste into a sentence end.
        restoreSel();
        const sel = window.getSelection();
        const n = sel.anchorNode;
        const blk = n && (n.nodeType === 1 ? n : n.parentElement).closest("p, div, h1, h2, h3, li, blockquote");
        if (blk && blk !== body && blk.textContent.trim()) {
          try { document.execCommand("insertParagraph"); } catch (e) {}
          saveSel();
        }
        run("insertHTML", html);
        buildOutline();
        return true;
      }
      const filePick = el("input", {
        type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", multiple: true, hidden: true,
        onchange: (e) => { insertImages(e.target.files); e.target.value = ""; },
      });
      const imageBtn = tool(ICON.image, "Insert picture (or paste / drop one)", () => { saveSel(); filePick.click(); }, null);
      tools.insertBefore(imageBtn, charsBtn);
      tools.append(filePick);

      // Click a picture to resize, align or remove it.
      let imgBar = null;
      let imgOn = null;
      function closeImgBar() {
        if (imgBar) imgBar.remove();
        imgBar = null;
        if (imgOn) imgOn.classList.remove("sl-img-on");
        imgOn = null;
      }
      cleanups.push(closeImgBar);
      function imgWidth(img) {
        const m = /width:\s*([\d.]+)%/.exec(img.getAttribute("style") || "");
        return m ? parseFloat(m[1]) : 100;
      }
      function setImgWidth(img, w) {
        img.style.width = Math.max(10, Math.min(100, Math.round(w))) + "%";
        syncBody();
        later();
      }
      function openImgBar(img) {
        closeImgBar();
        imgOn = img;
        img.classList.add("sl-img-on");
        const sel = window.getSelection();
        const r = document.createRange();
        r.selectNode(img);
        sel.removeAllRanges();
        sel.addRange(r);
        const block = img.closest("p, div, h1, h2, h3, li, blockquote");
        const slider = el("input", {
          type: "range", min: "10", max: "100", step: "1", value: String(imgWidth(img)), class: "sl-range", "aria-label": "Picture size",
          oninput: (e) => { setImgWidth(img, parseFloat(e.target.value)); place(); },
        });
        const align = (a) => {
          if (block && block !== body) { block.style.textAlign = a; syncBody(); later(); place(); }
        };
        imgBar = el("div", { class: "sl-imgbar", role: "toolbar", "aria-label": "Picture" },
          ...[["Small", 33], ["Medium", 60], ["Full width", 100]].map(([name, w]) => el("button", {
            class: "sl-pill", onmousedown: (e) => e.preventDefault(),
            onclick: () => { setImgWidth(img, w); slider.value = String(w); place(); }, text: name,
          })),
          slider,
          el("span", { class: "sl-tool-sep", "aria-hidden": "true" }),
          el("button", { class: "sl-tool", "aria-label": "Align picture left", onmousedown: (e) => e.preventDefault(), onclick: () => align("left") }, svg(ICON.left, 15)),
          el("button", { class: "sl-tool", "aria-label": "Centre picture", onmousedown: (e) => e.preventDefault(), onclick: () => align("center") }, svg(ICON.center, 15)),
          el("button", { class: "sl-tool", "aria-label": "Align picture right", onmousedown: (e) => e.preventDefault(), onclick: () => align("right") }, svg(ICON.right, 15)),
          el("span", { class: "sl-tool-sep", "aria-hidden": "true" }),
          el("button", {
            class: "sl-pill", onmousedown: (e) => e.preventDefault(),
            onclick: () => { const i = img; closeImgBar(); i.remove(); syncBody(); later(); }, text: "Delete",
          }));
        root.append(imgBar);
        function place() {
          if (!imgBar) return;
          const b = img.getBoundingClientRect();
          const rr = root.getBoundingClientRect();
          const wBar = imgBar.offsetWidth || 420;
          imgBar.style.left = Math.max(8, Math.min(b.left - rr.left + b.width / 2 - wBar / 2, rr.width - wBar - 8)) + "px";
          const below = b.bottom - rr.top + 8;
          imgBar.style.top = (below + 50 > rr.height ? Math.max(8, b.top - rr.top - 52) : below) + "px";
        }
        place();
      }
      body.addEventListener("mousedown", (e) => {
        const img = e.target.closest && e.target.closest("img");
        if (img && body.contains(img)) { e.preventDefault(); body.focus(); openImgBar(img); }
        else closeImgBar();
      });
      body.addEventListener("dragover", (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) e.preventDefault();
      });
      body.addEventListener("drop", (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;
        e.preventDefault();
        const at = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (at && body.contains(at.startContainer)) savedRange = at;
        insertImages(files);
      });
      // Pictures take a moment to load; re-split pages once they have.
      body.addEventListener("load", () => later(), true);

      // ----- pages: split the doc into separate sheets, like Google Docs -----
      const sheets = el("div", { class: "sl-sheets", "aria-hidden": "true" });
      const GAP = 24;
      function clearPushes() {
        body.querySelectorAll("[data-slpush]").forEach((n) => {
          n.style.paddingTop = "";
          n.style.marginTop = "";
          n.removeAttribute("data-slpush");
          if (!n.getAttribute("style")) n.removeAttribute("style");
        });
      }
      function units() {
        const out = [];
        for (const c of body.children) {
          if ((c.tagName === "UL" || c.tagName === "OL") && c.children.length) out.push(...Array.from(c.children));
          else out.push(c);
        }
        return out;
      }
      function paginate() {
        const paged = layout() === "pages";
        paper.classList.toggle("paged", paged);
        clearPushes();
        if (!paged) {
          sheets.textContent = "";
          paper.style.minHeight = "";
          paper.style.paddingTop = paper.style.paddingBottom = "";
          pageCount = 1;
          updateStatus();
          drawInk();
          return;
        }
        const zk = zoomK();
        const w = REF;
        if (!paper.getBoundingClientRect().width) return;
        const pageH = Math.round((w * 11) / 8.5);
        const margin = Math.round(w * (full ? 0.09 : 0.07));
        const stride = pageH + GAP;
        paper.style.paddingTop = paper.style.paddingBottom = margin + "px";
        const top0 = () => paper.getBoundingClientRect().top;
        let forceNext = false;
        for (const u of units()) {
          if (u.tagName === "HR" && u.classList.contains("sl-pb")) { forceNext = true; continue; }
          const r = u.getBoundingClientRect();
          if (!r.height && !forceNext) continue;
          const base = top0();
          const t = (r.top - base) / zk;
          const b = (r.bottom - base) / zk;
          const rh = r.height / zk;
          const k = Math.floor(t / stride);
          const end = k * stride + pageH - margin;
          let target = null;
          if (forceNext) { if (t > k * stride + margin + 1) target = (k + 1) * stride + margin; }
          else if (t >= end || (b > end && rh < pageH - 2 * margin)) target = (k + 1) * stride + margin;
          forceNext = false;
          if (target === null) continue;
          u.setAttribute("data-slpush", "");
          if (u.tagName === "BLOCKQUOTE" || u.tagName === "HR") {
            // These have a background, so push with margin instead of padding.
            const prev = u.previousElementSibling;
            const cur = parseFloat(getComputedStyle(u).marginTop) || 0;
            const gap = prev ? Math.max(cur, t - (prev.getBoundingClientRect().bottom - base) / zk) : cur;
            u.style.marginTop = gap + (target - t) + "px";
          } else {
            const cur = parseFloat(getComputedStyle(u).paddingTop) || 0;
            u.style.paddingTop = cur + (target - t) + "px";
          }
        }
        drawInk();
        const bottom = (body.getBoundingClientRect().bottom - top0()) / zk;
        pageCount = Math.max(1, Math.floor(Math.max(0, bottom - 1) / stride) + 1);
        paper.style.minHeight = pageCount * stride - GAP + "px";
        drawInk();
        sheets.textContent = "";
        for (let i = 0; i < pageCount; i++) {
          sheets.append(el("div", { class: "sl-sheet", style: "top:" + i * stride + "px; height:" + pageH + "px" },
            el("span", { class: "sl-sheet-no", text: String(i + 1) })));
        }
        updateStatus();
      }

      // ----- run the slower jobs shortly after typing -----
      let frame = 0;
      let slow = 0;
      function later() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { paginate(); runFind(false); });
        clearTimeout(slow);
        slow = setTimeout(check, 450);
      }
      cleanups.push(() => { cancelAnimationFrame(frame); clearTimeout(slow); });

      body.addEventListener("focus", () => {
        // New lines become proper paragraphs.
        try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
      });
      body.addEventListener("input", (e) => { closeImgBar(); autoSymbol(e); syncBody(); buildOutline(); closePop(); later(); laterSnap(); });
      body.addEventListener("blur", saveSel);
      body.addEventListener("paste", (e) => {
        // Keep simple formatting from the clipboard, drop everything else.
        e.preventDefault();
        if (e.clipboardData.files && e.clipboardData.files.length) {
          const hasImage = Array.from(e.clipboardData.files).some((f) => /^image\//.test(f.type));
          if (hasImage) { insertImages(e.clipboardData.files); return; }
        }
        const html = e.clipboardData.getData("text/html");
        try { document.execCommand("styleWithCSS", false, false); } catch (err) {}
        if (html) document.execCommand("insertHTML", false, cleanHtml(html));
        else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        syncBody();
        buildOutline();
        later();
      });
      body.addEventListener("click", (e) => {
        // Never let a link replace the app page.
        if (e.target.closest("a")) e.preventDefault();
        setTimeout(maybePop, 0);
      });
      body.addEventListener("keyup", (e) => { if (e.key.startsWith("Arrow")) maybePop(); });

      const title = el("input", {
        class: "sl-doc-title",
        value: note.title,
        placeholder: "Untitled doc",
        "aria-label": "Doc title",
        oninput: (e) => { note.title = e.target.value; touch(note); laterSnap(); },
        onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); body.focus(); } },
      });

      const meta = el("div", { class: "sl-doc-meta" });
      const label = labelById(note.label);
      if (label) meta.append(el("span", { class: "sl-chip", style: "background: var(--c-" + label.color + ")", text: label.name }));
      const due = dueInfo(note.due);
      if (due) meta.append(el("span", { class: "sl-chip " + due.cls, text: due.text }));

      const paper = el("div", { class: "sl-paper" }, sheets, meta, title, body, canvas);
      // Clicking the empty part of a page puts the cursor at the end of the text.
      paper.addEventListener("mousedown", (e) => {
        if (e.target !== paper) return;
        e.preventDefault();
        body.focus();
        const r = document.createRange();
        r.selectNodeContents(body);
        r.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      });
      const zoomBox = el("div", { class: "sl-zoom" }, paper);
      const scroller = el("div", { class: "sl-doc-scroll" }, zoomBox, preview);
      zoomSlot.replaceWith(zoomDd.el);
      scroller.addEventListener("scroll", closePop);
      const page = el("div", { class: "sl-docpage", onkeydown: shortcut, onwheel: undefined }, head, tools, findBar, tray,
        el("div", { class: "sl-doc-main" }, outline, scroller, grammarPanel, charPanel, histPanel));

      // Re-split pages when the window is resized, and around printing.
      let lastW = 0;
      const ro = new ResizeObserver(() => {
        const w = paper.offsetWidth;
        if (w && w !== lastW) { lastW = w; later(); }
      });
      ro.observe(paper);
      const before = () => clearPushes();
      const after = () => later();
      window.addEventListener("beforeprint", before);
      window.addEventListener("afterprint", after);
      cleanups.push(() => { ro.disconnect(); window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); });

      page.addEventListener("wheel", onWheelZoom, { passive: false });
      // While drawing nothing has keyboard focus, so listen on the whole window too.
      const winKeys = (e) => {
        const a = document.activeElement;
        if (!page.isConnected || (a && a !== document.body && a !== document.documentElement)) return;
        shortcut(e);
      };
      document.addEventListener("keydown", winKeys);
      cleanups.push(() => document.removeEventListener("keydown", winKeys));
      scroller.addEventListener("scroll", closeImgBar);
      // Start at the remembered zoom; "auto" fits narrow windows and stays at 100% on wide ones.
      requestAnimationFrame(() => {
        const z = zoomMode === "fit" ? fitZoom() : zoomMode === "auto" ? Math.min(1, fitZoom()) : Number(zoomMode) || 1;
        setZoom(z);
      });
      let lastScrollW = 0;
      const ro2 = new ResizeObserver(() => {
        const w = scroller.clientWidth;
        if (!w || w === lastScrollW) return;
        lastScrollW = w;
        if (zoomMode === "fit") setZoom(fitZoom());
        else if (zoomMode === "auto") setZoom(Math.min(1, fitZoom()));
      });
      ro2.observe(scroller);
      cleanups.push(() => ro2.disconnect());
      updateStatus();
      buildOutline();
      drawTray();
      later();
      // Opened from search: show the matches in the doc.
      if (view.findQuery) {
        const q = view.findQuery;
        view.findQuery = null;
        setTimeout(() => { findBar.hidden = false; findInput.value = q; runFind(true); }, 60);
      }
      return { page, title, body };
    }

    // ---------- actions ----------
    function resolve(note) {
      note.resolved = true;
      note.resolvedAt = now();
      touch(note);
      render();
      showToast("“" + (note.title || "Agenda") + "” was resolved and cleared.", () => restore(note));
    }
    function restore(note) {
      note.resolved = false;
      delete note.resolvedAt;
      touch(note);
      render();
    }
    function remove(note) {
      const index = data.notes.indexOf(note);
      if (index < 0) return;
      data.notes.splice(index, 1);
      if (view.doc === note.id) view.doc = null;
      save();
      render();
      showToast("“" + (note.title || (note.type === "agenda" ? "Agenda" : "Doc")) + "” was deleted.", () => {
        data.notes.splice(Math.min(index, data.notes.length), 0, note);
        save();
        render();
      });
    }

    function showToast(message, undo) {
      if (toast) toast.remove();
      clearTimeout(toastTimer);
      toast = el("div", { class: "sl-toast", role: "status" }, message,
        el("button", { onclick: () => { undo(); hideToast(); }, text: "Undo" }));
      root.append(toast);
      toastTimer = setTimeout(hideToast, 7000);
    }
    function hideToast() {
      if (toast) toast.remove();
      toast = null;
    }

    // ---------- menu ----------
    function closeMenu() {
      if (menu) menu.remove();
      menu = null;
      document.removeEventListener("mousedown", outside, true);
    }
    function outside(e) {
      if (menu && !menu.contains(e.target)) closeMenu();
    }
    function placeMenu(anchor, width, height) {
      const r = root.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const left = Math.max(4, Math.min(a.right - r.left - width, r.width - width - 8));
      let top = a.bottom - r.top + 6;
      if (top + height > r.height) top = Math.max(4, a.top - r.top - height);
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
    }
    function openChoices(anchor, items) {
      closeMenu();
      menu = el("div", { class: "sl-menu sl-choices", role: "menu" });
      for (const item of items) {
        if (item.heading !== undefined) {
          menu.append(item.heading ? el("span", { class: "sl-choice-head", text: item.heading }) : el("hr", { class: "sl-choice-line" }));
          continue;
        }
        if (item.action) {
          menu.append(el("button", {
            class: "sl-choice sl-action",
            role: "menuitem",
            onmousedown: (e) => e.preventDefault(),
            onclick: () => { closeMenu(); item.pick(); if (!item.keep) render(); },
          }, item.text));
          continue;
        }
        menu.append(el("button", {
          class: "sl-choice" + (item.on ? " on" : ""),
          role: item.check ? "menuitemcheckbox" : "menuitemradio",
          "aria-checked": item.on ? "true" : "false",
          onclick: () => { item.pick(); closeMenu(); render(); },
        }, el("span", { class: item.check ? "sl-check" : "sl-radio", "aria-hidden": "true" }), item.text));
      }
      root.append(menu);
      placeMenu(anchor, 220, 470);
    }

    function openMenu(note, anchor) {
      closeMenu();
      const swatches = el("div", { class: "sl-swatches", role: "group", "aria-label": "Colour" });
      for (const col of COLORS) {
        swatches.append(el("button", {
          class: note.color === col ? "on" : "",
          style: "background: var(--c-" + col + ")",
          "aria-label": col,
          onclick: () => { note.color = col; touch(note); closeMenu(); render(); },
        }));
      }
      const labelDd = dropdown({
        label: "Label",
        options: [{ value: "", text: "No label" }].concat(data.labels.map((l) => ({ value: l.id, text: l.name || "Untitled" }))),
        value: note.label || "",
        onPick: (v) => { note.label = v; touch(note); closeMenu(); render(); },
      });
      const impDd = dropdown({
        label: "Importance",
        options: Object.entries(IMPORTANCE).map(([k, v]) => ({ value: k, text: v })),
        value: note.importance || "low",
        onPick: (v) => { note.importance = v; touch(note); closeMenu(); render(); },
      });

      const dueInput = el("input", { type: "date", value: note.due || "", onchange: (e) => { note.due = e.target.value; touch(note); render(); } });

      menu = el("div", { class: "sl-menu", role: "dialog", "aria-label": "Note options" },
        el("label", null, "COLOUR", swatches),
        el("div", { class: "sl-field" }, "LABEL", labelDd.el),
        el("div", { class: "sl-field" }, "IMPORTANCE", impDd.el),
        el("label", null, "DUE DATE", dueInput),
        el("div", { class: "sl-row" },
          el("button", { onclick: () => { note.due = ""; touch(note); closeMenu(); render(); }, text: "Clear date" }),
          el("button", { class: "sl-danger", onclick: () => { closeMenu(); remove(note); }, text: "Delete" })));
      root.append(menu);

      const r = root.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const left = Math.max(4, Math.min(a.right - r.left - 230, r.width - 238));
      let top = a.bottom - r.top + 6;
      if (top + 330 > r.height) top = Math.max(4, a.top - r.top - 330);
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
    }

    // ---------- search everything (like iOS) ----------
    function noteText(n) {
      return n.type === "doc" ? htmlToText(n.html) : (n.items || []).map((i) => i.text).join(" · ");
    }
    function snippet(text, words) {
      const lt = text.toLowerCase();
      let i = -1;
      for (const w of words) {
        const j = lt.indexOf(w);
        if (j >= 0 && (i < 0 || j < i)) i = j;
      }
      if (i < 0) return text.slice(0, 120) + (text.length > 120 ? "…" : "");
      const start = Math.max(0, i - 40);
      return (start > 0 ? "…" : "") + text.slice(start, start + 140) + (start + 140 < text.length ? "…" : "");
    }
    function markText(node, text, words) {
      const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
      let last = 0;
      text.replace(re, (m, g, idx) => {
        node.append(text.slice(last, idx), el("mark", { text: m }));
        last = idx + m.length;
        return m;
      });
      node.append(text.slice(last));
      return node;
    }
    function openResult(n, q) {
      if (n.type === "doc") {
        if (opts.full) view.findQuery = q;
        openDoc(n.id);
        return;
      }
      if (n.resolved) { view.archive = true; view.query = ""; render(); return; }
      view.focus = n.id;
      render();
    }
    function searchResults(q) {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = [];
      for (const n of data.notes) {
        const title = n.title || "";
        const text = noteText(n);
        const label = labelById(n.label);
        const hay = (title + " " + text + " " + (label ? label.name : "")).toLowerCase();
        if (!words.every((w) => hay.includes(w))) continue;
        const inTitle = words.some((w) => title.toLowerCase().includes(w));
        hits.push({ n, title, text, label, score: (inTitle ? 0 : 1) + (n.resolved ? 2 : 0) });
      }
      hits.sort((a, b) => a.score - b.score || compare(a.n, b.n));
      const wrap = el("div", { class: "sl-results", role: "list" });
      if (!hits.length) {
        wrap.append(el("div", { class: "sl-empty" },
          el("h3", { text: "Nothing matches “" + q + "”." }),
          el("p", { text: "Search looks through titles, doc text, agenda items and labels." })));
        return wrap;
      }
      wrap.append(el("div", { class: "sl-section", text: hits.length + (hits.length === 1 ? " RESULT" : " RESULTS") }));
      for (const h of hits) {
        const open = () => openResult(h.n, q);
        wrap.append(el("div", {
          class: "sl-result",
          role: "listitem",
          tabindex: "0",
          onclick: open,
          onkeydown: (e) => { if (e.key === "Enter") open(); },
        },
          el("span", { class: "sl-result-icon c-" + (h.n.color || "oat") }, svg(h.n.type === "doc" ? ICON.doc : ICON.agenda, 15)),
          el("div", { class: "sl-result-text" },
            markText(el("strong"), h.title || (h.n.type === "doc" ? "Untitled doc" : "Untitled agenda"), words),
            h.text ? markText(el("span", { class: "sl-result-snip" }), snippet(h.text, words), words) : null),
          el("div", { class: "sl-result-meta" },
            h.n.resolved ? el("span", { class: "sl-chip", text: "Resolved" }) : null,
            h.label ? el("span", { class: "sl-chip", style: "background: var(--c-" + h.label.color + ")", text: h.label.name }) : null,
            el("span", { class: "sl-chip", text: ago(h.n.edited || h.n.created) }))));
      }
      return wrap;
    }

    // ---------- render ----------
    function render(focus) {
      closeMenu();
      if (stopDocListeners) { stopDocListeners(); stopDocListeners = null; }
      const scrollEl = root.querySelector(".sl-scroll");
      const scroll = scrollEl ? scrollEl.scrollTop : 0;
      root.textContent = "";

      // A doc is open: show the page instead of the grid.
      const openNote = view.doc && data.notes.find((n) => n.id === view.doc);
      if (openNote) {
        const doc = docPage(openNote);
        root.append(doc.page);
        if (toast) root.append(toast);
        if (!openNote.title) doc.title.focus();
        if (opts.onCounts) opts.onCounts(counts());
        return;
      }
      view.doc = null;

      const scroller = el("div", { class: "sl-scroll" });
      root.append(toolbar(), scroller);
      if (toast) root.append(toast);

      if (!loadFailed && view.query.trim()) {
        scroller.append(searchResults(view.query.trim()));
      } else if (loadFailed) {
        scroller.append(el("div", { class: "sl-empty" },
          el("h3", { text: "Your notes couldn't be opened." }),
          el("p", { text: "Nothing was changed. Your previous copy is kept as notes.bak.json in the StillLife data folder." })));
      } else {
        const list = visible();
        if (!list.length) {
          scroller.append(el("div", { class: "sl-empty" },
            el("img", { src: "icon.png", alt: "" }),
            el("h3", { text: view.archive ? "Nothing resolved yet." : "A quiet space for your notes." }),
            el("p", { text: view.archive ? "Agendas you tick as All resolved rest here, ready to restore." : "Start an Agenda for checklists, or a Doc for writing." })));
        } else if (view.archive) {
          scroller.append(el("div", { class: "sl-section", text: "RESOLVED" }));
          scroller.append(group(list));
        } else if (!data.settings.pinnedTop) {
          scroller.append(group(list));
        } else {
          const pinned = list.filter((n) => n.pinned);
          const others = list.filter((n) => !n.pinned);
          if (pinned.length) {
            scroller.append(el("div", { class: "sl-section", text: "PINNED" }));
            scroller.append(group(pinned));
            if (others.length) scroller.append(el("div", { class: "sl-section", text: "OTHERS" }));
          }
          if (others.length) scroller.append(group(others));
        }
      }
      scroller.scrollTop = scroll;

      root.classList.remove("ts-s", "ts-m", "ts-l", "ts-xl");
      root.classList.add("ts-" + (data.settings.textSize || "m"));

      // A zoomed-in agenda floats above everything.
      const zoomed = view.focus && data.notes.find((n) => n.id === view.focus && n.type === "agenda" && !n.resolved);
      if (zoomed) {
        root.append(el("div", {
          class: "sl-focus",
          onmousedown: (e) => { if (e.target === e.currentTarget) { view.focus = null; render(); } },
        }, agendaCard(zoomed, true)));
        if (!focus) focus = { id: zoomed.id, sel: ".sl-add-item" };
      } else {
        view.focus = null;
      }

      if (focus) {
        let target = null;
        if (focus.search) {
          target = root.querySelector(".sl-search-input");
        } else if (focus.label) {
          target = root.querySelector('.sl-label-input[data-label="' + focus.label + '"]');
        } else {
          const c = root.querySelector('.sl-card.big[data-id="' + focus.id + '"]') || root.querySelector('.sl-card[data-id="' + focus.id + '"]') || root.querySelector('[data-id="' + focus.id + '"]');
          if (c && focus.item) target = c.querySelector('[data-item="' + focus.item + '"] .sl-item-text');
          else if (c && focus.sel) target = c.querySelector(focus.sel);
        }
        if (target) {
          target.focus();
          if (focus.label && target.select) target.select();
          else if (target.setSelectionRange && target.value) target.setSelectionRange(target.value.length, target.value.length);
          target.scrollIntoView({ block: "nearest" });
        }
      }
      if (opts.onCounts) opts.onCounts(counts());
    }

    // Another window changed the notes: reload, but never interrupt typing.
    function editing() {
      const a = document.activeElement;
      return a && root.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
    }
    async function refresh() {
      if (editing()) {
        pendingRender = true;
        return;
      }
      await load();
      render();
    }
    root.addEventListener("focusout", () => {
      setTimeout(() => {
        if (pendingRender && !editing()) {
          pendingRender = false;
          refresh();
        }
      }, 50);
    });
    if (hasApp && tauri.event) {
      tauri.event.listen("notes-changed", (e) => {
        if (e.payload !== opts.label) refresh();
      });
      if (opts.full) {
        // The plate asked this window to open a doc.
        tauri.event.listen("open-doc", async (e) => {
          await load();
          openDoc(e.payload);
        });
      }
    }
    document.addEventListener("keydown", (e) => {
      // Ctrl+F on the notes list jumps to search (inside a doc it finds text instead).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key || "").toLowerCase() === "f" && !view.doc && root.isConnected) {
        const box = root.querySelector(".sl-search-input");
        if (box) { e.preventDefault(); box.focus(); box.select(); }
        return;
      }
      if (e.key !== "Escape") return;
      if (menu) closeMenu();
      else if (view.focus) { view.focus = null; render(); }
    });

    load().then(() => render());
    return { refresh, counts, openDoc };
  }

  window.StillLifeNotes = { mount, grammarCheck };
})();
