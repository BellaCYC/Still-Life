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
  const VERSION = "1.0.1";
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
    lasso: '<path d="M12 4c5 0 9 2.5 9 6s-4 6-9 6-9-2.5-9-6 4-6 9-6z" stroke-dasharray="3 2.5"/><path d="M6 15c-1 2 0 4 2 5"/>',
    sticker: '<path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8l7-7V6a3 3 0 0 0-3-3z"/><path d="M14 21v-4a3 3 0 0 1 3-3h4"/>',
    dropper: '<path d="M14.5 5.5l4 4M17 3a2.1 2.1 0 0 1 3 3l-2 2-3-3zM15 7L5 17l-1 3 3-1L17 9"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8 6.5h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    camera: '<path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
    insert: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    exportIcon: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"/>',
    importIcon: '<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
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
    S: [], STRIKE: [], SUP: [], SUB: [], UL: [], OL: [], LI: ["style"], BLOCKQUOTE: ["style"], HR: ["class"], CODE: [], PRE: ["data-lang"], SPAN: ["style"],
    FONT: ["color"], A: ["href"], IMG: ["src", "alt", "style"],
  };
  const FONTS = [
    ["default", "Default", "Segoe UI Variable, Segoe UI, system-ui, sans-serif"],
    ["serif", "Serif", "Georgia, Times New Roman, serif"],
    ["hand", "Handwriting", "Ink Free, Segoe Print, Comic Sans MS, cursive"],
    ["hand2", "Neat handwriting", "Segoe Print, Ink Free, cursive"],
    ["script", "Script", "Segoe Script, Brush Script MT, cursive"],
    ["mono", "Typewriter", "Consolas, Courier New, monospace"],
  ];
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
      else if (prop === "font-family") {
        const f = FONTS.find((x) => val.replace(/["']/g, "").toLowerCase().startsWith(x[2].split(",")[0].replace(/["']/g, "").toLowerCase()));
        if (f) keep.push("font-family: " + f[2]);
      }
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
            if (keep && attr.name === "data-lang") keep = /^[a-z0-9+#]{1,14}$/.test(attr.value);
            if (keep && attr.name === "style") {
              const clean = safeStyle(attr.value);
              if (clean) child.setAttribute("style", clean);
              else keep = false;
            }
            if (!keep) child.removeAttribute(attr.name);
          }
          if (tag === "IMG" && !child.getAttribute("src")) { child.remove(); continue; }
          if (tag === "PRE") { child.textContent = child.textContent; continue; } // code is kept as plain text
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


  // ---------- colours ----------
  const PEN_PALETTE = [
    ["Ink", "#2f2e2b"], ["Brick", "#8a4f45"], ["Moss", "#4d6b55"], ["Slate", "#4f6a80"], ["Plum", "#6d5a80"], ["Clay", "#a3684d"], ["Black", "#111111"],
    ["Graphite", "#5a5650"], ["Stone", "#8c867c"], ["Fog", "#b9b2a6"], ["White", "#ffffff"], ["Caramel", "#b98b5e"], ["Olive", "#8a8148"], ["Sage", "#6f8a6a"],
    ["Teal grey", "#5e7d7a"], ["Dusty blue", "#5d6f9a"], ["Mauve", "#8a5a73"], ["Dusty rose", "#a86f7a"], ["Terracotta", "#b5654a"], ["Mustard", "#b8963a"], ["Forest", "#3d5a45"],
    ["Red", "#d64545"], ["Orange", "#e8833a"], ["Yellow", "#e5b82a"], ["Green", "#3f9b5b"], ["Teal", "#2f8f9d"], ["Blue", "#2f6fd6"], ["Navy", "#253c78"],
    ["Violet", "#6b4fd6"], ["Purple", "#8e44ad"], ["Pink", "#d1569b"], ["Coral", "#e86a5c"], ["Brown", "#6e4b36"], ["Lime", "#7cb342"], ["Sky", "#3fa7e0"],
  ];
  const HL_PALETTE = [
    ["Butter", "#f4e3a1"], ["Peach", "#f6cf9c"], ["Coral", "#f2b8b0"], ["Rose", "#ecd6d1"], ["Lavender", "#ddd7f0"], ["Sky", "#c9d8f0"], ["Mint", "#c7e3dc"],
    ["Sage", "#d3dccb"], ["Mist", "#d2dbe2"], ["Clay", "#e4cdb4"], ["Lilac", "#e7c6dc"], ["Oat", "#ece2cf"], ["Celadon", "#dbe5dc"], ["Pale gold", "#efe3b8"],
    ["Neon yellow", "#fff176"], ["Neon green", "#b9f6ca"], ["Neon pink", "#ffc1e3"], ["Neon blue", "#b3e5fc"], ["Neon orange", "#ffcc80"], ["Neon purple", "#e1bee7"], ["Grey", "#e0ddd6"],
  ];
  function colorName(v) {
    const hit = PEN_PALETTE.concat(HL_PALETTE).find((x) => x[1].toLowerCase() === String(v).toLowerCase());
    return hit ? hit[0] : String(v).toUpperCase();
  }
  // The eyedropper: pick any colour anywhere on the screen.
  function pickScreenColor(done, fail) {
    if (!window.EyeDropper) { if (fail) fail(); return; }
    new window.EyeDropper().open().then((r) => r && r.sRGBHex && done(r.sRGBHex)).catch(() => {});
  }
  function addCustomColor(v) {
    data.settings.customColors = [v].concat((data.settings.customColors || []).filter((x) => x !== v)).slice(0, 14);
    save();
  }

  // ---------- stickers (drawn here, so they work offline) ----------
  const STK = (body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g stroke-linejoin="round" stroke-linecap="round">' + body + "</g></svg>";
  const STICKERS = [
    ["Saturn", STK('<ellipse cx="60" cy="62" rx="54" ry="18" fill="none" stroke="#fff" stroke-width="16" transform="rotate(-18 60 62)"/><circle cx="60" cy="60" r="30" fill="#dccdb5" stroke="#fff" stroke-width="8"/><path d="M36 52c14 6 34 6 48-2" stroke="#c9a88f" stroke-width="5" fill="none"/><ellipse cx="60" cy="62" rx="54" ry="18" fill="none" stroke="#a9b7c2" stroke-width="6" transform="rotate(-18 60 62)"/>')],
    ["Star", STK('<path d="M60 10l14 30 33 4-24 22 6 33-29-16-29 16 6-33-24-22 33-4z" fill="#e5cf8f" stroke="#fff" stroke-width="8"/>')],
    ["Heart", STK('<path d="M60 102C20 76 10 54 18 36c8-18 32-20 42-2 10-18 34-16 42 2 8 18-2 40-42 66z" fill="#d3b5af" stroke="#fff" stroke-width="8"/>')],
    ["Leaf", STK('<path d="M24 96C20 50 50 18 100 18c2 50-30 80-76 78z" fill="#b7c2ae" stroke="#fff" stroke-width="8"/><path d="M28 92c20-22 40-40 62-62" stroke="#8a9a80" stroke-width="5" fill="none"/>')],
    ["Flower", STK('<g fill="#e7c6dc" stroke="#fff" stroke-width="6"><circle cx="60" cy="32" r="20"/><circle cx="88" cy="56" r="20"/><circle cx="76" cy="88" r="20"/><circle cx="44" cy="88" r="20"/><circle cx="32" cy="56" r="20"/></g><circle cx="60" cy="64" r="14" fill="#e5cf8f" stroke="#fff" stroke-width="5"/>')],
    ["Sun", STK('<g stroke="#fff" stroke-width="16"><path d="M60 8v18M60 94v18M8 60h18M94 60h18M23 23l13 13M84 84l13 13M97 23L84 36M36 84L23 97"/></g><g stroke="#e8b86a" stroke-width="7"><path d="M60 8v18M60 94v18M8 60h18M94 60h18M23 23l13 13M84 84l13 13M97 23L84 36M36 84L23 97"/></g><circle cx="60" cy="60" r="26" fill="#f2d48f" stroke="#fff" stroke-width="7"/>')],
    ["Moon", STK('<path d="M78 14a46 46 0 1 0 28 66A38 38 0 0 1 78 14z" fill="#bdb3c4" stroke="#fff" stroke-width="8"/>')],
    ["Cloud", STK('<path d="M30 92a22 22 0 0 1 2-44 30 30 0 0 1 56-6 22 22 0 0 1 4 50z" fill="#d2dbe2" stroke="#fff" stroke-width="8"/>')],
    ["Done!", STK('<circle cx="60" cy="60" r="48" fill="#b7c2ae" stroke="#fff" stroke-width="8"/><path d="M36 62l16 16 32-34" stroke="#fff" stroke-width="12" fill="none"/>')],
    ["Good job", STK('<path d="M20 34h80l-8 26 8 26H20l8-26z" fill="#c9a88f" stroke="#fff" stroke-width="7"/><text x="60" y="68" font-family="Georgia, serif" font-style="italic" font-size="20" text-anchor="middle" fill="#fff">Good job</text>')],
    ["Coffee", STK('<path d="M26 40h56v34a24 24 0 0 1-24 24h-8a24 24 0 0 1-24-24z" fill="#c9a88f" stroke="#fff" stroke-width="8"/><path d="M82 50h8a12 12 0 0 1 0 24h-8" fill="none" stroke="#fff" stroke-width="12"/><path d="M82 50h8a12 12 0 0 1 0 24h-8" fill="none" stroke="#c9a88f" stroke-width="5"/><path d="M44 16c-4 6 4 10 0 16M58 16c-4 6 4 10 0 16" stroke="#a9b7c2" stroke-width="5" fill="none"/>')],
    ["Book", STK('<path d="M14 30c18-6 32-4 46 6 14-10 28-12 46-6v62c-18-6-32-4-46 6-14-10-28-12-46-6z" fill="#a9b7c2" stroke="#fff" stroke-width="8"/><path d="M60 36v62" stroke="#fff" stroke-width="5"/>')],
    ["Idea", STK('<path d="M60 14a32 32 0 0 0-18 58v12h36V72a32 32 0 0 0-18-58z" fill="#f2d48f" stroke="#fff" stroke-width="8"/><path d="M46 96h28M50 106h20" stroke="#fff" stroke-width="10"/><path d="M46 96h28M50 106h20" stroke="#8c867c" stroke-width="5"/>')],
    ["Music", STK('<path d="M46 86V30l46-10v54" fill="none" stroke="#fff" stroke-width="14"/><path d="M46 86V30l46-10v54" fill="none" stroke="#6d5a80" stroke-width="6"/><circle cx="36" cy="88" r="13" fill="#bdb3c4" stroke="#fff" stroke-width="6"/><circle cx="82" cy="76" r="13" fill="#bdb3c4" stroke="#fff" stroke-width="6"/>')],
    ["Important", STK('<path d="M60 12l50 88H10z" fill="#d3b5af" stroke="#fff" stroke-width="8"/><path d="M60 46v24" stroke="#fff" stroke-width="10"/><circle cx="60" cy="84" r="5" fill="#fff"/>')],
    ["Pin", STK('<circle cx="60" cy="42" r="26" fill="#c4cfc6" stroke="#fff" stroke-width="8"/><path d="M60 68v40" stroke="#fff" stroke-width="12"/><path d="M60 68v40" stroke="#8c867c" stroke-width="5"/>')],
  ];

  // ---------- paper and covers ----------
  const PAPER_STYLES = [["plain", "Plain"], ["lined", "Lined"], ["grid", "Grid"], ["dots", "Dots"], ["cornell", "Cornell"]];
  const PAPER_COLORS = [["Cream", "#fffdf9"], ["White", "#ffffff"], ["Ivory", "#fbf5e6"], ["Sage", "#eff2ea"], ["Mist", "#edf1f4"], ["Rose", "#f7eeec"], ["Lavender", "#f2eff8"], ["Oat", "#f4ede1"]];
  const COVERS = [
    ["sage", "Sage linen", "#b7c2ae"], ["mist", "Mist", "#a9b7c2"], ["rose", "Rose", "#d3b5af"], ["oat", "Oat", "#dccdb5"],
    ["lilac", "Lilac", "#bdb3c4"], ["clay", "Clay", "#c9a88f"], ["plum", "Deep plum", "#6f5a8e"], ["night", "Night", "#3c4656"],
  ];
  // ---------- document tabs (like Google Docs): each tab has its own page ----------
  // The open tab's content lives on the note itself; the others keep theirs in note.tabs.
  const TAB_FIELDS = ["html", "ink", "stickers", "extraPages", "extraSpace"];
  function ensureTabs(note) {
    if (!Array.isArray(note.tabs) || !note.tabs.length) {
      note.tabs = [{ id: "main", title: "Tab 1", parent: null }];
      note.activeTab = "main";
    }
    if (!note.tabs.some((t) => t.id === note.activeTab)) note.activeTab = note.tabs[0].id;
  }
  function activateTab(note, id) {
    ensureTabs(note);
    if (note.activeTab === id) return;
    const cur = note.tabs.find((t) => t.id === note.activeTab);
    const next = note.tabs.find((t) => t.id === id);
    if (!next) return;
    for (const f of TAB_FIELDS) {
      cur[f] = note[f];
      note[f] = next[f];
      delete next[f];
    }
    if (typeof note.html !== "string") note.html = "";
    if (!Array.isArray(note.ink)) note.ink = [];
    if (!Array.isArray(note.stickers)) note.stickers = [];
    note.activeTab = id;
  }
  const tabHtml = (note, t) => (t.id === note.activeTab ? note.html : t.html || "");
  function tabOrder(note) {
    if (!Array.isArray(note.tabs)) return [];
    const out = [];
    const walk = (parent, depth) => {
      for (const t of note.tabs.filter((x) => (x.parent || null) === parent)) {
        out.push({ t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }
  // Every tab, one after another, for search and export.
  function allTabsHtml(note) {
    const order = tabOrder(note);
    if (order.length < 2) return note.html || "";
    return order.map(({ t }, i) => (i ? '<hr class="sl-pb">' : "") + "<h1>" + escapeText((t.emoji ? t.emoji + " " : "") + (t.title || "Untitled tab")) + "</h1>" + tabHtml(note, t)).join("");
  }
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
    return (a.title || "") === (b.title || "") && (a.html || "") === (b.html || "") && JSON.stringify(a.ink || []) === JSON.stringify(b.ink || []) && JSON.stringify(a.stickers || []) === JSON.stringify(b.stickers || []) && JSON.stringify(a.tabs || null) === JSON.stringify(b.tabs || null);
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
  const snapOf = (note) => ({
    t: now(), device: deviceName, title: note.title || "", html: note.html || "", ink: note.ink || [], stickers: note.stickers || [],
    tabs: Array.isArray(note.tabs) ? JSON.parse(JSON.stringify(note.tabs)) : null, activeTab: note.activeTab || null,
  });
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
        .filter((n) => view.type === "all" || (view.type === "starred" ? n.starred : n.type === view.type))
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
      else {
        note.html = "";
        if (data.settings.paperStyle) note.paperStyle = data.settings.paperStyle;
        if (data.settings.paperColor) note.paperColor = data.settings.paperColor;
      }
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
      const openDocs = (data.settings.openDocs || []).filter((x) => x !== id);
      const at = openDocs.indexOf(view.lastDoc);
      openDocs.splice(at >= 0 ? at + 1 : openDocs.length, 0, id);
      data.settings.openDocs = openDocs.slice(-8);
      view.lastDoc = id;
      save();
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
          b.append(l.id === "all" ? l.name : el("span", { class: "sl-user", text: l.name || "Untitled" }));
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
      for (const t of [["all", "Everything"], ["agenda", "Agendas"], ["doc", "Docs"], ["starred", "Starred"]]) {
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
      const moreBtn = el("button", {
        class: "sl-new alt sl-icon-only", "aria-label": "More: import, backup, settings", title: "Import, backup, settings",
        onclick: (e) => listMoreMenu(e.currentTarget),
      }, svg(ICON.more, 15));

      return el("div", { class: "sl-bar" },
        el("div", { class: "sl-group" }, tabs, types),
        el("div", { class: "sl-group" }, searchBox, viewBtn, archiveBtn, newAgenda, newDoc, moreBtn));
    }

    function listMoreMenu(anchor) {
      closeMenu();
      const item = (icon, label, fn) => el("button", { class: "sl-choice sl-action sl-ins", onclick: () => { closeMenu(); fn(); } }, svg(icon, 15), label);
      const restorePick = el("input", { type: "file", accept: ".json", hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) restoreBackup(f); } });
      menu = el("div", { class: "sl-menu sl-choices", role: "menu", "aria-label": "More" },
        item(ICON.importIcon, "Import files (Word, text, Markdown, pictures)…", () => importPick.click()),
        el("p", { class: "sl-g-note sl-menu-tip", text: "Tip: you can also drop files onto this window." }),
        el("hr", { class: "sl-choice-line" }),
        item(ICON.exportIcon, "Back up all notes", () => backupAll()),
        item(ICON.clock, "Restore from a backup…", () => restorePick.click()),
        el("hr", { class: "sl-choice-line" }),
        item(ICON.view, "Settings", () => openSettings()),
        restorePick);
      root.append(menu);
      placeMenu(anchor, 300, 280);
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
      if (label) foot.append(el("span", { class: "sl-chip sl-user", text: label.name }));
      foot.append(el("span", { class: "sl-chip", text: ago(note.edited || note.created) }));
      return foot;
    }

    function allDone(note) {
      return note.type === "agenda" && note.items.length > 0 && note.items.every((i) => i.done);
    }

    function headButtons(note, head) {
      head.append(el("button", {
        class: "sl-icon-btn sl-star" + (note.starred ? " on" : ""),
        "aria-label": note.starred ? "Unstar" : "Star",
        "aria-pressed": note.starred ? "true" : "false",
        title: note.starred ? "Remove star" : "Star (favourite)",
        onclick: (e) => { e.stopPropagation(); note.starred = !note.starred; touch(note); render(); },
      }, svg(ICON.star, 14)));
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
      const cover = COVERS.find((x) => x[0] === note.cover);
      if (cover) {
        // A notebook cover, like GoodNotes.
        c.classList.add("has-cover");
        c.append(el("div", { class: "sl-cover cv-" + cover[0], style: "--cv:" + cover[2] },
          el("span", { class: "sl-cover-spine", "aria-hidden": "true" }),
          el("span", { class: "sl-cover-planet", "aria-hidden": "true" }),
          el("span", { class: "sl-cover-label", text: note.title || "Untitled" })));
      } else {
        c.append(el("p", { class: "sl-preview", text: text || "Empty doc. Click to start writing." }));
      }
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
            label ? el("span", { class: "sl-chip sl-user", style: "background: var(--c-" + label.color + ")", text: label.name }) : null,
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
        const css = cmd === "foreColor" || cmd === "hiliteColor" || cmd === "fontName";
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

      const fontDd = dropdown({
        label: "Font", cls: "sl-dd-font", keepFocus: true, onOpen: saveSel,
        options: FONTS.map(([k, name, fam]) => ({ value: k, text: name, cls: "pv-font", hint: k === "hand" || k === "hand2" ? "text → handwriting" : "" })),
        value: "default",
        onPick: (k) => {
          const f = FONTS.find((x) => x[0] === k);
          run("fontName", f[2]);
        },
      });
      const TEXT_COLORS = [["Ink", "#2f2e2b"], ["Brick", "#8a4f45"], ["Clay", "#a3684d"], ["Moss", "#4d6b55"], ["Slate", "#4f6a80"], ["Plum", "#6d5a80"]];
      const MARKS = [["Butter", "#ece8b0"], ["Lavender", "#ddd7f0"], ["Sage", "#d3dccb"], ["Rose", "#ecd6d1"], ["Mist", "#d2dbe2"], ["None", "transparent"]];
      // A full colour picker: palette, your own colours, any custom colour, and the eyedropper.
      function colorPicker(anchor, o) {
        closeMenu();
        const keep = (e) => e.preventDefault();
        const pick = (v) => { closeMenu(); o.onPick(v); };
        const cur = String(o.current || "").toLowerCase();
        const swatch = (name, value) => el("button", {
          class: "sl-swatch" + (cur === value.toLowerCase() ? " on" : ""),
          style: "background:" + value, title: name, "aria-label": name,
          onmousedown: keep, onclick: () => pick(value),
        });
        const grid = el("div", { class: "sl-palette" });
        for (const [name, value] of o.colors) grid.append(swatch(name, value));
        if (o.none) grid.append(el("button", { class: "sl-swatch none", title: "No highlight", "aria-label": "No highlight", onmousedown: keep, onclick: () => pick("transparent") }));
        const mine = data.settings.customColors || [];
        const customs = el("div", { class: "sl-palette" });
        // Your own colours can be removed: hover and press ×, or right-click.
        const removeColor = (v) => {
          data.settings.customColors = (data.settings.customColors || []).filter((x) => x !== v);
          save();
          colorPicker(anchor, o);
        };
        for (const v of mine) {
          const sw = swatch(v.toUpperCase(), v);
          sw.addEventListener("contextmenu", (e) => { e.preventDefault(); removeColor(v); });
          customs.append(el("span", { class: "sl-swatch-wrap" }, sw,
            el("button", {
              class: "sl-swatch-x", title: "Remove this colour", "aria-label": "Remove colour " + v.toUpperCase(),
              onmousedown: keep, onclick: (e) => { e.stopPropagation(); removeColor(v); },
            }, svg(ICON.x, 9))));
        }
        const input = el("input", {
          type: "color", class: "sl-color-input", "aria-label": "Choose any colour",
          value: /^#[0-9a-f]{6}$/i.test(o.current || "") ? o.current : "#6f8a6a",
          onchange: (e) => { addCustomColor(e.target.value); pick(e.target.value); },
        });
        const note2 = el("span", { class: "sl-g-note", hidden: true, text: "The eyedropper isn't available on this computer; use Custom instead." });
        menu = el("div", { class: "sl-menu sl-color-menu wide", role: "dialog", "aria-label": o.title },
          el("span", { class: "sl-choice-head", text: o.title.toUpperCase() }), grid,
          el("span", { class: "sl-choice-head", text: "YOUR COLOURS" }),
          mine.length ? customs : el("span", { class: "sl-g-note", text: "Colours you pick with Custom or the eyedropper are kept here." }),
          el("div", { class: "sl-row" },
            el("label", { class: "sl-pill sl-custom", title: "Choose any colour" }, el("span", { class: "sl-rainbow", "aria-hidden": "true" }), "Custom", input),
            el("button", {
              class: "sl-pill", title: "Pick a colour from anywhere on the screen", onmousedown: keep,
              onclick: () => pickScreenColor((v) => { addCustomColor(v); pick(v); }, () => { note2.hidden = false; }),
            }, svg(ICON.dropper, 14), "Eyedropper")),
          note2);
        root.append(menu);
        placeMenu(anchor, 300, 340);
      }
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

      // Puts whole blocks (a page break, a code block) between paragraphs, never inside one.
      function insertBlocks(nodes, caretInto) {
        restoreSel();
        const sel = window.getSelection();
        const topBlock = () => {
          let x = sel.anchorNode;
          x = x && (x.nodeType === 1 ? x : x.parentElement);
          while (x && x !== body && x.parentElement !== body) x = x.parentElement;
          return x === body ? null : x;
        };
        const blk = sel.rangeCount ? topBlock() : null;
        let atEnd = true;
        if (blk && sel.rangeCount) {
          const r = sel.getRangeAt(0);
          const tail = document.createRange();
          tail.selectNodeContents(blk);
          tail.setStart(r.endContainer, r.endOffset);
          atEnd = !tail.toString().trim();
        }
        if (!blk) body.append(...nodes);
        else if (atEnd) blk.after(...nodes);
        else { document.execCommand("insertParagraph"); (topBlock() || blk).before(...nodes); }
        if (caretInto) {
          const c = document.createRange();
          c.setStart(caretInto, 0);
          c.collapse(true);
          sel.removeAllRanges();
          sel.addRange(c);
        }
        syncBody();
        later();
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
      function applyPaper() {
        paper.style.setProperty("--paper-bg", note.paperColor || "#fffdf9");
        for (const [k] of PAPER_STYLES) paper.classList.toggle("pp-" + k, (note.paperStyle || "plain") === k);
      }
      function layoutMenu(anchor) {
        closeMenu();
        const opt = (on, label, pick) => el("button", {
          class: "sl-choice" + (on ? " on" : ""), role: "menuitemradio", "aria-checked": on ? "true" : "false", onclick: pick,
        }, el("span", { class: "sl-radio", "aria-hidden": "true" }), label);
        const tiles = el("div", { class: "sl-paper-tiles" });
        for (const [k, name] of PAPER_STYLES) {
          tiles.append(el("button", {
            class: "sl-paper-tile pp-" + k + ((note.paperStyle || "plain") === k ? " on" : ""), title: name, "aria-label": name + " paper",
            style: "--paper-bg:" + (note.paperColor || "#fffdf9"),
            onclick: () => { note.paperStyle = k; data.settings.paperStyle = k; touch(note); applyPaper(); layoutMenu(anchor); },
          }, el("span", { text: name })));
        }
        const colors = el("div", { class: "sl-palette" });
        for (const [name, v] of PAPER_COLORS) {
          colors.append(el("button", {
            class: "sl-swatch" + ((note.paperColor || "#fffdf9") === v ? " on" : ""), style: "background:" + v, title: name, "aria-label": name + " paper",
            onclick: () => { note.paperColor = v; data.settings.paperColor = v; touch(note); applyPaper(); layoutMenu(anchor); },
          }));
        }
        menu = el("div", { class: "sl-menu sl-choices sl-page-setup", role: "dialog", "aria-label": "Page setup" },
          el("span", { class: "sl-choice-head", text: "PAGE LAYOUT" }),
          opt(layout() === "pages", "Pages", () => { note.layout = "pages"; data.settings.docLayout = "pages"; touch(note); closeMenu(); render(); }),
          opt(layout() === "pageless", "Pageless (one long page)", () => { note.layout = "pageless"; data.settings.docLayout = "pageless"; touch(note); closeMenu(); render(); }),
          el("span", { class: "sl-choice-head", text: "PAPER" }), tiles,
          el("span", { class: "sl-choice-head", text: "PAPER COLOUR" }), colors,
          el("hr", { class: "sl-choice-line" }),
          el("button", { class: "sl-choice sl-action", onmousedown: (e) => e.preventDefault(), onclick: () => { closeMenu(); insertPageBreak(); } }, "Insert page break  \u00B7  Ctrl+Enter"),
          el("button", { class: "sl-choice sl-action", onclick: () => { if (layout() === "pages") note.extraPages = (note.extraPages || 0) + 1; else note.extraSpace = (note.extraSpace || 0) + 600; touch(note); closeMenu(); later(); } }, "Add a blank page at the end"),
          (note.extraPages || note.extraSpace) ? el("button", { class: "sl-choice sl-action", onclick: () => { note.extraPages = 0; note.extraSpace = 0; touch(note); closeMenu(); later(); } }, "Remove added blank pages") : null);
        root.append(menu);
        placeMenu(anchor, 300, 520);
      }

      // ----- keyboard shortcuts list -----
      const SHORTCUTS = [
        ["Bold", "Ctrl+B"], ["Italic", "Ctrl+I"], ["Underline", "Ctrl+U"], ["Strikethrough", "Alt+Shift+5"],
        ["Superscript / subscript", "Ctrl+. / Ctrl+,"], ["Clear formatting", "Ctrl+\\"], ["Normal text", "Ctrl+Alt+0"], ["Title / Heading / Subheading", "Ctrl+Alt+1 / 2 / 3"],
        ["Numbered list", "Ctrl+Shift+7"], ["Bulleted list", "Ctrl+Shift+8"], ["Indent / outdent list", "Tab / Shift+Tab"],
        ["Align left / centre / right", "Ctrl+Shift+L / E / R"], ["Justify", "Ctrl+Shift+J"], ["Insert link", "Ctrl+K"],
        ["Work out selected maths", "Alt+="], ["Translate a word", "Long-press it"], ["Run code (in the code panel)", "Ctrl+Enter"],
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
        sep(), blockDd.el, fontDd.el, sep(),
        tool(ICON.bold, "Bold", () => run("bold"), "bold", "Ctrl+B"),
        tool(ICON.italic, "Italic", () => run("italic"), "italic", "Ctrl+I"),
        tool(ICON.underline, "Underline", () => run("underline"), "underline", "Ctrl+U"),
        tool(ICON.strike, "Strikethrough", () => run("strikeThrough"), "strikeThrough", "Alt+Shift+5"),
        tool(ICON.sup, "Superscript", () => run("superscript"), "superscript", "Ctrl+."),
        tool(ICON.sub, "Subscript", () => run("subscript"), "subscript", "Ctrl+,"),
        tool(ICON.color, "Text colour", (b) => colorPicker(b, { title: "Text colour", colors: PEN_PALETTE, onPick: (v) => run("foreColor", v) })),
        tool(ICON.mark, "Highlight", (b) => colorPicker(b, { title: "Highlight", colors: HL_PALETTE, none: true, onPick: (v) => run("hiliteColor", v) })),
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
        tool(ICON.pages, "Page setup: layout, paper, colour", (b) => layoutMenu(b)),
        tool(ICON.outline, "Show or hide tabs and outline", () => { outlineOpen = !outlineOpen; outline.hidden = !outlineOpen; buildOutline(); }),
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
      // ----- document tabs and subtabs (left side), with each tab's outline under it -----
      const TAB_EMOJI = ["📘", "📗", "📙", "📕", "📓", "✏️", "📝", "📌", "⭐", "✅", "💡", "🧪", "🧬", "🧮", "📐", "🌍", "🎵", "🎨", "💻", "📅", "❤️", "🌱", "🪐", "☕"];
      const hasTabs = () => Array.isArray(note.tabs) && note.tabs.length > 0;
      const activeTabObj = () => (hasTabs() ? note.tabs.find((t) => t.id === note.activeTab) : null);
      function goTab(id) {
        if (hasTabs() && note.activeTab === id) return;
        syncBody();
        activateTab(note, id);
        touch(note);
        render();
      }
      function addTab(parent) {
        syncBody();
        ensureTabs(note);
        const siblings = note.tabs.filter((t) => (t.parent || null) === (parent || null));
        const t = { id: "t" + uid(), title: parent ? "Subtab " + (siblings.length + 1) : "Tab " + (note.tabs.filter((x) => !x.parent).length + 1), parent: parent || null, html: "", ink: [], stickers: [] };
        if (parent) {
          const p = note.tabs.find((x) => x.id === parent);
          if (p) p.collapsed = false;
          // Put it after its parent's existing subtabs.
          const order = tabOrder(note).map((x) => x.t);
          const last = order.filter((x) => x.id === parent || isInside(x, parent)).pop();
          note.tabs.splice(note.tabs.indexOf(last) + 1, 0, t);
        } else note.tabs.push(t);
        activateTab(note, t.id);
        touch(note);
        view.renameTab = t.id;
        render();
      }
      function isInside(t, ancestor) {
        let p = t.parent;
        while (p) {
          if (p === ancestor) return true;
          const up = note.tabs.find((x) => x.id === p);
          p = up ? up.parent : null;
        }
        return false;
      }
      function deleteTab(t) {
        const gone = note.tabs.filter((x) => x === t || isInside(x, t.id));
        if (gone.length >= note.tabs.length) return; // keep at least one tab
        syncBody();
        const before = JSON.stringify({ tabs: note.tabs, active: note.activeTab, html: note.html, ink: note.ink, stickers: note.stickers });
        if (gone.includes(activeTabObj())) {
          const keep = tabOrder(note).map((x) => x.t).find((x) => !gone.includes(x));
          activateTab(note, keep.id);
        }
        note.tabs = note.tabs.filter((x) => !gone.includes(x));
        touch(note);
        render();
        showToast("Deleted “" + (t.title || "tab") + "”" + (gone.length > 1 ? " and its subtabs" : "") + ".", () => {
          const b = JSON.parse(before);
          note.tabs = b.tabs; note.activeTab = b.active; note.html = b.html; note.ink = b.ink; note.stickers = b.stickers;
          touch(note);
          render();
        });
      }
      function moveTab(t, dir) {
        const sib = note.tabs.filter((x) => (x.parent || null) === (t.parent || null));
        const i = sib.indexOf(t);
        const other = sib[i + dir];
        if (!other) return;
        const a = note.tabs.indexOf(t);
        const b = note.tabs.indexOf(other);
        note.tabs[a] = other;
        note.tabs[b] = t;
        touch(note);
        render();
      }
      function duplicateTab(t) {
        syncBody();
        const copy = JSON.parse(JSON.stringify(t));
        copy.id = "t" + uid();
        copy.title = (t.title || "Tab") + " (copy)";
        if (t.id === note.activeTab) { copy.html = note.html; copy.ink = JSON.parse(JSON.stringify(note.ink)); copy.stickers = JSON.parse(JSON.stringify(note.stickers)); }
        note.tabs.splice(note.tabs.indexOf(t) + 1, 0, copy);
        touch(note);
        render();
      }
      function tabMenu(t, anchor) {
        closeMenu();
        const item = (label, fn) => el("button", { class: "sl-choice sl-action", onclick: () => { closeMenu(); fn(); } }, label);
        const emojis = el("div", { class: "sl-emoji-grid" },
          el("button", { class: "sl-emoji none", title: "No emoji", onclick: () => { delete t.emoji; touch(note); closeMenu(); buildOutline(); } }, "—"),
          ...TAB_EMOJI.map((em) => el("button", { class: "sl-emoji", onclick: () => { t.emoji = em; touch(note); closeMenu(); buildOutline(); } }, em)));
        menu = el("div", { class: "sl-menu sl-choices", role: "menu", "aria-label": "Tab options" },
          item("Rename", () => { view.renameTab = t.id; buildOutline(); }),
          item("Add subtab", () => addTab(t.id)),
          item("Duplicate", () => duplicateTab(t)),
          item("Move up", () => moveTab(t, -1)),
          item("Move down", () => moveTab(t, 1)),
          el("span", { class: "sl-choice-head", text: "EMOJI" }), emojis,
          note.tabs.length > 1 ? item("Delete", () => deleteTab(t)) : null);
        root.append(menu);
        placeMenu(anchor, 240, 380);
      }
      let outlineOpen = full && (window.innerWidth > 1000 || (Array.isArray(note.tabs) && note.tabs.length > 1));
      const outline = el("nav", { class: "sl-outline", "aria-label": "Document tabs and outline" });
      outline.hidden = !outlineOpen;
      function headingsList() {
        const box = el("div", { class: "sl-tab-outline" });
        const heads = body.querySelectorAll("h1, h2, h3");
        if (!heads.length) {
          box.append(el("p", { class: "sl-faint sl-outline-empty", text: "Headings you add appear here." }));
          return box;
        }
        heads.forEach((h) => {
          box.append(el("button", {
            class: "sl-outline-item lvl-" + h.tagName.slice(1),
            onclick: () => h.scrollIntoView({ behavior: "smooth", block: "start" }),
            text: h.textContent.trim() || "Untitled heading",
          }));
        });
        return box;
      }
      function buildOutline() {
        if (!outlineOpen) return;
        outline.textContent = "";
        outline.append(el("div", { class: "sl-tabs-head" },
          el("span", { class: "sl-choice-head", text: "DOCUMENT TABS" }),
          el("button", { class: "sl-tool", "aria-label": "Add tab", title: "Add tab", onclick: () => addTab(null) }, svg(ICON.plus, 14))));
        const rows = hasTabs() ? tabOrder(note) : [{ t: { id: "main", title: "Tab 1" }, depth: 0, virtual: true }];
        const hidden = new Set();
        for (const { t, depth } of rows) {
          if (t.parent && hidden.has(t.parent)) { hidden.add(t.id); continue; }
          if (t.collapsed) hidden.add(t.id);
          const kids = hasTabs() && note.tabs.some((x) => x.parent === t.id);
          const active = !hasTabs() || note.activeTab === t.id;
          const row = el("div", { class: "sl-tab-row" + (active ? " on" : ""), style: "--depth:" + depth });
          row.append(kids
            ? el("button", { class: "sl-tab-caret" + (t.collapsed ? " shut" : ""), "aria-label": t.collapsed ? "Show subtabs" : "Hide subtabs", onclick: () => { t.collapsed = !t.collapsed; touch(note); buildOutline(); } }, svg(ICON.chevron, 13))
            : el("span", { class: "sl-tab-caret-space" }));
          row.append(el("span", { class: "sl-tab-icon", "aria-hidden": "true" }, t.emoji ? t.emoji : svg(ICON.doc, 14)));
          if (view.renameTab === t.id) {
            const input = el("input", {
              class: "sl-tab-rename", value: t.title || "", "aria-label": "Tab name",
              onkeydown: (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); input.blur(); } },
              onblur: () => { ensureTabs(note); const real = note.tabs.find((x) => x.id === t.id); if (real) real.title = input.value.trim() || real.title; view.renameTab = null; touch(note); buildOutline(); if (real && real.id === note.activeTab && real !== note.tabs[0]) title.value = real.title; },
            });
            row.append(input);
            setTimeout(() => { input.focus(); input.select(); }, 0);
          } else {
            row.append(el("button", { class: "sl-tab-name", title: t.title || "Untitled tab", onclick: () => goTab(t.id), ondblclick: () => { ensureTabs(note); view.renameTab = t.id; buildOutline(); } }, t.title || "Untitled tab"));
          }
          row.append(el("button", { class: "sl-tab-more", "aria-label": "Tab options", title: "Tab options", onclick: (e) => { ensureTabs(note); tabMenu(note.tabs.find((x) => x.id === t.id), e.currentTarget); } }, svg(ICON.more, 14)));
          outline.append(row);
          if (active) outline.append(headingsList());
        }
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
          } else if (!c && e.altKey && !e.shiftKey && (e.key === "=" || e.code === "Equal")) {
            act = () => calcSelection();
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
        calcOpen = which === "calc";
        codeOpen = which === "code";
        calcPanel.hidden = !calcOpen;
        codePanel.hidden = !codeOpen;
        calcBtn.classList.toggle("on", calcOpen);
        if (!codeOpen) body.querySelectorAll("pre.sl-code-on").forEach((x) => x.classList.remove("sl-code-on"));
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
          if (b.el.closest && b.el.closest("pre")) continue; // never "correct" code
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
      const REF = 816; // the page is 816 units wide; strokes are stored in those units
      if (!Array.isArray(note.ink)) note.ink = [];
      if (!Array.isArray(note.stickers)) note.stickers = [];
      const canvas = el("canvas", { class: "sl-ink", "aria-hidden": "true" });
      const ctx = canvas.getContext("2d");
      const base = document.createElement("canvas"); // finished strokes, drawn once and reused
      const bctx = base.getContext("2d");
      let res = 1;
      let inkH = 0;
      let drawing = false;      // draw mode on or off
      let stroke = null;        // the stroke being drawn
      let lasso = null;         // the lasso being drawn: [x, y, x, y, ...]
      let sel = null;           // { strokes: Set, stickers: Set }
      let moving = null;        // dragging the selection
      const undoInk = [];
      const redoInk = [];
      const pen = { tool: "pen", color: data.settings.penColor || "#2f2e2b", w: data.settings.penWidth || 2.4 };
      const hl = { tool: "hl", color: data.settings.hlColor || "#f4e3a1", w: data.settings.hlWidth || 16 };
      let inkTool = "pen";                    // pen | hl | eraser | lasso
      let eraseMode = note.eraseMode || "stroke"; // stroke | part
      let lastDrawTool = "pen";
      let backToPen = data.settings.eraserBackToPen !== false;
      let fingerDraw = data.settings.fingerDraw !== false;
      let shapeSnap = data.settings.shapeSnap !== false;
      const curPen = () => (inkTool === "hl" ? hl : pen);
      const snapshot = () => JSON.stringify({ ink: note.ink, st: note.stickers });
      function remember() {
        undoInk.push(snapshot());
        redoInk.length = 0;
        if (undoInk.length > 80) undoInk.shift();
      }
      function inkChanged() {
        note.ink = note.ink.filter((s) => s.pts.length >= 3);
        touch(note);
        laterSnap();
        updateStatus();
        later();
        drawInk();
      }
      function stepInk(from, to) {
        if (!from.length) return;
        to.push(snapshot());
        const back = JSON.parse(from.pop());
        note.ink = back.ink || [];
        note.stickers = back.st || [];
        clearSel();
        touch(note);
        later();
        drawInk();
        if (histOpen) drawHistory();
      }

      function sizeCanvas() {
        const k = zoomK();
        const h = paper.getBoundingClientRect().height / k;
        if (!h) return false;
        inkH = h;
        // Sharp at any zoom, but never larger than the browser allows for one canvas.
        res = Math.max(0.5, Math.min(4, (window.devicePixelRatio || 1) * k, 16000 / h, Math.sqrt(40e6 / (REF * h))));
        const cw = Math.round(REF * res);
        const ch = Math.round(h * res);
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        canvas.style.width = REF + "px";
        canvas.style.height = h + "px";
        return true;
      }

      // --- GoodNotes-style ink: each pen stroke is a filled outline whose width follows
      //     pressure (or speed, for a mouse or finger), with softly tapered ends. ---
      function constHalf(p) {
        for (let i = 2; i < p.length; i += 3) if (Math.abs(p[i] - 0.5) > 0.001) return false;
        return true;
      }
      function inkOutline(s) {
        const p = s.pts;
        const size = s.w;
        const sim = s.sim || constHalf(p);
        const xs = [];
        const ys = [];
        const ps = [];
        for (let i = 0; i < p.length; i += 3) {
          if (xs.length && Math.hypot(p[i] - xs[xs.length - 1], p[i + 1] - ys[ys.length - 1]) < 0.35) continue;
          xs.push(p[i]); ys.push(p[i + 1]); ps.push(p[i + 2]);
        }
        const m = xs.length;
        if (m < 2) {
          const r = size * 0.55;
          const dot = [];
          for (let a = 0; a < 16; a++) dot.push([xs[0] + r * Math.cos((a / 16) * 6.2832), ys[0] + r * Math.sin((a / 16) * 6.2832)]);
          return dot;
        }
        const lens = [0];
        for (let i = 1; i < m; i++) lens.push(lens[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
        const total = lens[m - 1];
        const rad = [];
        let pr = sim ? 0.42 : ps[0];
        for (let i = 0; i < m; i++) {
          if (sim) {
            // Faster movement draws a slightly thinner line, like a real pen.
            const d = i ? lens[i] - lens[i - 1] : 0;
            const sp = Math.min(1, d / (size * 2.2));
            pr = Math.min(1, pr + (Math.min(1, 1 - sp) - pr) * sp * 0.28);
          } else {
            pr += (ps[i] - pr) * 0.45;
          }
          let r = size * (0.5 - 0.5 * (0.5 - pr));
          const taper = Math.min(size * 6, total * 0.28);
          if (taper > 0) {
            const a = Math.min(1, lens[i] / taper);
            const b = Math.min(1, (total - lens[i]) / taper);
            r *= (0.5 + 0.5 * (1 - (1 - a) * (1 - a))) * (0.55 + 0.45 * (1 - (1 - b) * (1 - b)));
          }
          rad.push(Math.max(size * 0.14, r));
        }
        const L = [];
        const R = [];
        for (let i = 0; i < m; i++) {
          const a = Math.max(0, i - 1);
          const b = Math.min(m - 1, i + 1);
          let dx = xs[b] - xs[a];
          let dy = ys[b] - ys[a];
          const len = Math.hypot(dx, dy) || 1;
          dx /= len; dy /= len;
          L.push([xs[i] - dy * rad[i], ys[i] + dx * rad[i]]);
          R.push([xs[i] + dy * rad[i], ys[i] - dx * rad[i]]);
        }
        const cap = (cx, cy, r, from) => {
          const out = [];
          for (let k = 1; k < 8; k++) {
            const ang = from - (Math.PI * k) / 8;
            out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
          }
          return out;
        };
        const endAng = Math.atan2(ys[m - 1] - ys[m - 2], xs[m - 1] - xs[m - 2]);
        const startAng = Math.atan2(ys[1] - ys[0], xs[1] - xs[0]);
        return L.concat(cap(xs[m - 1], ys[m - 1], rad[m - 1], endAng + Math.PI / 2), R.reverse(), cap(xs[0], ys[0], rad[0], startAng - Math.PI / 2));
      }
      function smoothPath(c, pts, closed) {
        c.beginPath();
        if (pts.length < 3) {
          c.moveTo(pts[0][0], pts[0][1]);
          for (const q of pts) c.lineTo(q[0], q[1]);
          return;
        }
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (closed) {
          const start = mid(pts[pts.length - 1], pts[0]);
          c.moveTo(start[0], start[1]);
          for (let i = 0; i < pts.length; i++) {
            const mm = mid(pts[i], pts[(i + 1) % pts.length]);
            c.quadraticCurveTo(pts[i][0], pts[i][1], mm[0], mm[1]);
          }
          c.closePath();
        } else {
          c.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) {
            const mm = mid(pts[i], pts[i + 1]);
            c.quadraticCurveTo(pts[i][0], pts[i][1], mm[0], mm[1]);
          }
          c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        }
      }
      function renderStroke(c, s) {
        const p = s.pts;
        if (!p.length) return;
        c.fillStyle = s.color;
        c.strokeStyle = s.color;
        c.lineCap = "round";
        c.lineJoin = "round";
        if (s.tool === "hl" || s.shape) {
          // Highlighter and neat shapes: one even line.
          c.globalAlpha = s.tool === "hl" ? 0.6 : 1;
          c.lineWidth = s.w;
          const pts = [];
          for (let i = 0; i < p.length; i += 3) pts.push([p[i], p[i + 1]]);
          if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]);
          if (s.shape) {
            c.beginPath();
            c.moveTo(pts[0][0], pts[0][1]);
            for (const q of pts) c.lineTo(q[0], q[1]);
          } else smoothPath(c, pts, false);
          c.stroke();
          c.globalAlpha = 1;
          return;
        }
        smoothPath(c, inkOutline(s), true);
        c.fill();
      }
      const stickerImgs = new Map();
      function stickerImg(src) {
        let img = stickerImgs.get(src);
        if (!img) {
          img = new Image();
          img.onload = () => drawInk();
          img.src = src;
          stickerImgs.set(src, img);
        }
        return img;
      }
      function renderBase() {
        if (base.width !== canvas.width || base.height !== canvas.height) { base.width = canvas.width; base.height = canvas.height; }
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, base.width, base.height);
        bctx.setTransform(res, 0, 0, res, 0, 0);
        for (const st of note.stickers) {
          const img = stickerImg(st.src);
          if (img.complete && img.naturalWidth) bctx.drawImage(img, st.x, st.y, st.w, st.h);
        }
        for (const s of note.ink) renderStroke(bctx, s);
      }
      function composite() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(base, 0, 0);
        ctx.setTransform(res, 0, 0, res, 0, 0);
        if (stroke) renderStroke(ctx, stroke);
        if (lasso && lasso.length > 3) {
          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = "#5f7f9e";
          ctx.beginPath();
          ctx.moveTo(lasso[0], lasso[1]);
          for (let i = 2; i < lasso.length; i += 2) ctx.lineTo(lasso[i], lasso[i + 1]);
          ctx.stroke();
          ctx.restore();
        }
      }
      function drawInk() {
        if (!sizeCanvas()) return;
        renderBase();
        composite();
        placeSel();
      }
      let liveFrame = 0;
      function drawLive() {
        if (liveFrame) return;
        liveFrame = requestAnimationFrame(() => { liveFrame = 0; composite(); });
      }
      cleanups.push(() => cancelAnimationFrame(liveFrame));

      // Lowest point used by drawings and stickers, so pages grow to fit them.
      function inkBottom() {
        let b = 0;
        for (const s of note.ink) for (let i = 1; i < s.pts.length; i += 3) if (s.pts[i] > b) b = s.pts[i];
        for (const st of note.stickers) b = Math.max(b, st.y + st.h);
        return b;
      }

      // --- geometry helpers for erasing, shapes and the lasso ---
      function near(s, x, y, r) {
        const p = s.pts;
        const pad = r + s.w / 2;
        if (p.length === 3) return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= pad * pad;
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
        return false;
      }
      function eraseAt(x, y, r) {
        let changed = false;
        const kept = [];
        for (const s of note.ink) {
          if (!near(s, x, y, r)) { kept.push(s); continue; }
          changed = true;
          if (eraseMode === "stroke") continue;
          // Rub out only the part that was touched; keep the rest of the stroke.
          let piece = [];
          const flush = () => { if (piece.length >= 6) kept.push(Object.assign({}, s, { pts: piece })); piece = []; };
          for (let i = 0; i < s.pts.length; i += 3) {
            if ((s.pts[i] - x) ** 2 + (s.pts[i + 1] - y) ** 2 <= (r + s.w / 2) ** 2) flush();
            else piece.push(s.pts[i], s.pts[i + 1], s.pts[i + 2]);
          }
          flush();
        }
        if (eraseMode === "stroke") {
          const before = note.stickers.length;
          note.stickers = note.stickers.filter((st) => !(x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h));
          if (note.stickers.length !== before) changed = true;
        }
        if (changed) note.ink = kept;
        return changed;
      }
      function inPoly(x, y, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
          const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
        }
        return inside;
      }
      // Hold still at the end of a stroke and it becomes a neat shape: line, arrow, triangle,
      // square or rectangle, diamond, pentagon, hexagon, circle or ellipse.
      function rdp(pts, eps) {
        if (pts.length < 3) return pts.slice();
        const [ax, ay] = pts[0];
        const [bx, by] = pts[pts.length - 1];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        let best = -1;
        let at = 0;
        for (let i = 1; i < pts.length - 1; i++) {
          const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
          if (d > best) { best = d; at = i; }
        }
        if (best <= eps) return [pts[0], pts[pts.length - 1]];
        const left = rdp(pts.slice(0, at + 1), eps);
        return left.slice(0, -1).concat(rdp(pts.slice(at), eps));
      }
      const turn = (a, b, c) => {
        // Angle between a→b and b→c, in degrees (0 = straight on).
        const v1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const v2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        let d = Math.abs(v2 - v1) * 180 / Math.PI;
        return d > 180 ? 360 - d : d;
      };
      // Drop corners that are really just a wobble on a straight side.
      function cleanCorners(poly, closed, minSide) {
        let pts = poly.slice();
        for (let pass = 0; pass < 4; pass++) {
          const out = [];
          const n = pts.length;
          for (let i = 0; i < n; i++) {
            if (!closed && (i === 0 || i === n - 1)) { out.push(pts[i]); continue; }
            const a = pts[(i - 1 + n) % n];
            const c = pts[(i + 1) % n];
            const b = pts[i];
            if (turn(a, b, c) < 28) continue;
            if (out.length && Math.hypot(b[0] - out[out.length - 1][0], b[1] - out[out.length - 1][1]) < minSide) continue;
            out.push(b);
          }
          if (closed && out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < minSide) out.pop();
          if (out.length === pts.length) break;
          pts = out;
        }
        return pts;
      }
      function snapShape(s) {
        const p = s.pts;
        if (p.length < 18) return null;
        const pts = [];
        for (let i = 0; i < p.length; i += 3) pts.push([p[i], p[i + 1]]);
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        const diag = Math.hypot(w, h);
        if (diag < 22) return null;
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const ends = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
        const mk = (list, close) => ({ tool: s.tool, color: s.color, w: s.w, shape: true, pts: (close ? list.concat([list[0]]) : list).flatMap(([x, y]) => [x, y, 0.5]) });

        // ---- open strokes: line, arrow, or a neat zig-zag ----
        if (ends > Math.max(diag * 0.3, len * 0.18)) {
          if (ends / len > 0.9) return mk([pts[0], pts[pts.length - 1]]);
          const simple = cleanCorners(rdp(pts, diag * 0.06), false, diag * 0.06);
          if (simple.length >= 3) {
            // A short flick back at the end of a line is an arrow head.
            const n = simple.length;
            const tip = simple[n - 2];
            const tail = simple[n - 1];
            const shaftLen = Math.hypot(tip[0] - simple[n - 3][0], tip[1] - simple[n - 3][1]);
            const flick = Math.hypot(tail[0] - tip[0], tail[1] - tip[1]);
            if (turn(simple[n - 3], tip, tail) > 110 && flick < shaftLen * 0.45) {
              const from = simple[0];
              const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
              const head = Math.max(10, Math.min(28, shaftLen * 0.22));
              const l = [tip[0] - head * Math.cos(ang - 0.5), tip[1] - head * Math.sin(ang - 0.5)];
              const r = [tip[0] - head * Math.cos(ang + 0.5), tip[1] - head * Math.sin(ang + 0.5)];
              return mk([from, tip, l, tip, r]);
            }
            if (simple.length <= 5) return mk(simple);
          }
          return null;
        }

        // ---- closed shapes ----
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
        // How round is it? (spread of distances from the middle, scaled to the box)
        const rx = w / 2 || 1;
        const ry = h / 2 || 1;
        const radii = pts.map(([x, y]) => Math.hypot((x - cx) / rx, (y - cy) / ry));
        const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
        const roundness = Math.sqrt(radii.reduce((a, r) => a + (r - meanR) ** 2, 0) / radii.length) / meanR;
        const loop = pts.slice();
        if (ends > 1) loop.push(pts[0]);
        let corners = cleanCorners(rdp(loop, diag * 0.075).slice(0, -1), true, diag * 0.1);
        // Straight sides mean a polygon; curved ones mean a circle or ellipse.
        let sideFit = 1;
        if (corners.length >= 3 && corners.length <= 6) {
          let total = 0;
          for (const [x, y] of pts) {
            let best = Infinity;
            for (let i = 0; i < corners.length; i++) {
              const a2 = corners[i];
              const b2 = corners[(i + 1) % corners.length];
              const dx = b2[0] - a2[0];
              const dy = b2[1] - a2[1];
              const l2 = dx * dx + dy * dy || 1;
              const t = Math.max(0, Math.min(1, ((x - a2[0]) * dx + (y - a2[1]) * dy) / l2));
              best = Math.min(best, Math.hypot(a2[0] + t * dx - x, a2[1] + t * dy - y));
            }
            total += best;
          }
          sideFit = total / pts.length / diag;
        }
        const polygonish = corners.length >= 3 && corners.length <= 6 && sideFit < (corners.length >= 5 ? 0.016 : 0.022);
        if (!polygonish && (roundness < 0.12 || corners.length > 6 || corners.length < 3 || sideFit >= 0.022)) {
          const ring = [];
          for (let a = 0; a < 360; a += 6) {
            const t = (a * Math.PI) / 180;
            ring.push([(minX + maxX) / 2 + rx * Math.cos(t), (minY + maxY) / 2 + ry * Math.sin(t)]);
          }
          return mk(ring, true);
        }
        if (corners.length === 4) {
          // Square-ish corners and level sides: make a tidy rectangle (or a square if it's nearly one).
          const angles = corners.map((b, i) => turn(corners[(i + 3) % 4], b, corners[(i + 1) % 4]));
          const right = angles.every((a) => Math.abs(a - 90) < 25);
          const side = Math.atan2(corners[1][1] - corners[0][1], corners[1][0] - corners[0][0]) * 180 / Math.PI;
          const level = Math.min(...[0, 90, 180, -90, -180].map((t) => Math.abs(side - t))) < 15;
          if (right && level) {
            let x1 = minX, y1 = minY, x2 = maxX, y2 = maxY;
            if (Math.abs(w - h) < Math.max(w, h) * 0.12) { const m = (w + h) / 2; x2 = x1 + m; y2 = y1 + m; }
            return mk([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true);
          }
          if (right) {
            // A tilted rectangle: keep its angle, straighten the sides.
            const c0 = corners[0], c1 = corners[1], c3 = corners[3];
            const ux = [c1[0] - c0[0], c1[1] - c0[1]];
            const vx = [c3[0] - c0[0], c3[1] - c0[1]];
            const ul = Math.hypot(...ux) || 1;
            const proj = (vx[0] * -ux[1] + vx[1] * ux[0]) / ul;
            const nx = [-ux[1] / ul * proj, ux[0] / ul * proj];
            return mk([c0, c1, [c1[0] + nx[0], c1[1] + nx[1]], [c0[0] + nx[0], c0[1] + nx[1]]], true);
          }
          return mk(corners, true); // a diamond or other four-sided shape
        }
        if (corners.length === 3) {
          // Nearly equal sides: tidy it into a neat, level triangle.
          const sides = corners.map((a, i) => Math.hypot(corners[(i + 1) % 3][0] - a[0], corners[(i + 1) % 3][1] - a[1]));
          const avg = (sides[0] + sides[1] + sides[2]) / 3;
          if (sides.every((x) => Math.abs(x - avg) < avg * 0.15)) {
            const top = corners.reduce((a, b) => (b[1] < a[1] ? b : a));
            const baseY = Math.max(...corners.map((c) => c[1]));
            const half = w / 2;
            const mid = (minX + maxX) / 2;
            if (top[1] < baseY - h * 0.6) return mk([[mid, minY], [mid + half, baseY], [mid - half, baseY]], true);
          }
          return mk(corners, true);
        }
        // Five or six corners: a neat polygon with straight sides.
        return mk(corners, true);
      }

      // --- lasso selection: move, resize, recolour, copy or delete strokes and stickers ---
      const selBox = el("div", { class: "sl-sel", hidden: true });
      const selGrip = el("div", { class: "sl-sel-grip", title: "Drag to resize" });
      const selBar = el("div", { class: "sl-sel-bar" });
      selBox.append(selGrip, selBar);
      function selBounds() {
        if (!sel) return null;
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const s of sel.strokes) {
          for (let i = 0; i < s.pts.length; i += 3) {
            x1 = Math.min(x1, s.pts[i] - s.w / 2); y1 = Math.min(y1, s.pts[i + 1] - s.w / 2);
            x2 = Math.max(x2, s.pts[i] + s.w / 2); y2 = Math.max(y2, s.pts[i + 1] + s.w / 2);
          }
        }
        for (const st of sel.stickers) {
          x1 = Math.min(x1, st.x); y1 = Math.min(y1, st.y); x2 = Math.max(x2, st.x + st.w); y2 = Math.max(y2, st.y + st.h);
        }
        return x1 === Infinity ? null : { x: x1 - 6, y: y1 - 6, w: x2 - x1 + 12, h: y2 - y1 + 12 };
      }
      function clearSel() {
        sel = null;
        selBox.hidden = true;
      }
      function placeSel() {
        const b = selBounds();
        if (!b || !drawing) { selBox.hidden = true; return; }
        selBox.hidden = false;
        Object.assign(selBox.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" });
        selBar.classList.toggle("below", b.y < 60);
      }
      function drawSelBar() {
        selBar.textContent = "";
        const keep = (e) => { e.preventDefault(); e.stopPropagation(); };
        selBar.append(
          el("button", { class: "sl-pill", onpointerdown: keep, onclick: () => {
            remember();
            const copy = [];
            const dup = { strokes: new Set(), stickers: new Set() };
            for (const s of sel.strokes) { const c = JSON.parse(JSON.stringify(s)); for (let i = 0; i < c.pts.length; i += 3) { c.pts[i] += 24; c.pts[i + 1] += 24; } note.ink.push(c); dup.strokes.add(c); copy.push(c); }
            for (const st of sel.stickers) { const c = Object.assign({}, st, { x: st.x + 24, y: st.y + 24 }); note.stickers.push(c); dup.stickers.add(c); }
            sel = dup;
            inkChanged();
          }, text: "Copy" }),
          el("button", { class: "sl-pill", onpointerdown: keep, onclick: (e) => {
            colorPicker(e.currentTarget, { title: "Recolour", colors: PEN_PALETTE, current: pen.color, onPick: (c) => {
              remember();
              for (const s of sel.strokes) if (s.tool !== "hl") s.color = c;
              inkChanged();
            } });
          }, text: "Colour" }),
          el("button", { class: "sl-pill", onpointerdown: keep, onclick: () => {
            remember();
            note.ink = note.ink.filter((s) => !sel.strokes.has(s));
            note.stickers = note.stickers.filter((st) => !sel.stickers.has(st));
            clearSel();
            inkChanged();
          }, text: "Delete" }));
      }
      // Drag the corner to resize everything selected.
      selGrip.addEventListener("pointerdown", (e) => {
        if (!sel) return;
        e.preventDefault();
        e.stopPropagation();
        selGrip.setPointerCapture(e.pointerId);
        remember();
        const b = selBounds();
        const start = point(e);
        const orig = { strokes: [...sel.strokes].map((s) => s.pts.slice()), widths: [...sel.strokes].map((s) => s.w), stickers: [...sel.stickers].map((st) => Object.assign({}, st)) };
        const move = (ev) => {
          const q = point(ev);
          const f = Math.max(0.15, Math.max((b.w + q.x - start.x) / b.w, (b.h + q.y - start.y) / b.h));
          [...sel.strokes].forEach((s, i) => {
            const o = orig.strokes[i];
            for (let j = 0; j < o.length; j += 3) { s.pts[j] = b.x + (o[j] - b.x) * f; s.pts[j + 1] = b.y + (o[j + 1] - b.y) * f; }
            s.w = Math.max(0.5, orig.widths[i] * f);
          });
          [...sel.stickers].forEach((st, i) => {
            const o = orig.stickers[i];
            st.x = b.x + (o.x - b.x) * f; st.y = b.y + (o.y - b.y) * f; st.w = o.w * f; st.h = o.h * f;
          });
          drawInk();
        };
        const up = () => {
          selGrip.removeEventListener("pointermove", move);
          selGrip.removeEventListener("pointerup", up);
          inkChanged();
        };
        selGrip.addEventListener("pointermove", move);
        selGrip.addEventListener("pointerup", up);
      });

      // --- pointer handling ---
      let held = null;
      let rawLast = null;
      function point(e) {
        const r = canvas.getBoundingClientRect();
        const k = zoomK();
        return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, p: e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5 };
      }
      function stickerAt(x, y) {
        for (let i = note.stickers.length - 1; i >= 0; i--) {
          const st = note.stickers[i];
          if (x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h) return st;
        }
        return null;
      }
      // Drawing near the bottom adds room, like extending the paper in CollaNotes.
      function growIfNeeded(y) {
        if (y > inkH - 140) {
          if (layout() === "pages") note.extraPages = (note.extraPages || 0) + 1;
          else note.extraSpace = (note.extraSpace || 0) + 600;
          later();
        }
      }
      canvas.addEventListener("pointerdown", (e) => {
        if (!drawing || e.button !== 0) return;
        if (e.pointerType === "touch" && !fingerDraw) return;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        const q = point(e);
        if (inkTool === "lasso") {
          const b = selBounds();
          const hitSel = b && q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h;
          const st = hitSel ? null : stickerAt(q.x, q.y);
          if (st) { sel = { strokes: new Set(), stickers: new Set([st]) }; drawSelBar(); }
          if (hitSel || st) {
            remember();
            moving = { x: q.x, y: q.y };
            placeSel();
            return;
          }
          clearSel();
          lasso = [q.x, q.y];
          return;
        }
        remember();
        if (inkTool === "eraser") {
          stroke = null;
          if (eraseAt(q.x, q.y, eraseMode === "stroke" ? 6 : 10)) drawInk();
          return;
        }
        const c = curPen();
        stroke = { tool: c.tool, color: c.color, w: c.w, pts: [q.x, q.y, q.p] };
        if (e.pointerType !== "pen") stroke.sim = true;
        rawLast = q;
        held = { x: q.x, y: q.y, t: Date.now() };
        drawLive();
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!drawing || !e.buttons) return;
        if (e.pointerType === "touch" && !fingerDraw) return;
        // Every point the pen reported since the last frame, not just the latest one.
        const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        if (moving && sel) {
          const q = point(e);
          const dx = q.x - moving.x;
          const dy = q.y - moving.y;
          moving = { x: q.x, y: q.y };
          for (const s of sel.strokes) for (let i = 0; i < s.pts.length; i += 3) { s.pts[i] += dx; s.pts[i + 1] += dy; }
          for (const st of sel.stickers) { st.x += dx; st.y += dy; }
          drawInk();
          return;
        }
        if (lasso) {
          for (const ev of evs) { const q = point(ev); lasso.push(q.x, q.y); }
          drawLive();
          return;
        }
        if (inkTool === "eraser") {
          let changed = false;
          for (const ev of evs) { const q = point(ev); if (eraseAt(q.x, q.y, eraseMode === "stroke" ? 6 : 10)) changed = true; }
          if (changed) drawInk();
          return;
        }
        if (!stroke) return;
        for (const ev of evs) {
          const q = point(ev);
          rawLast = q;
          const n = stroke.pts.length;
          const lx = stroke.pts[n - 3];
          const ly = stroke.pts[n - 2];
          // A light smoothing filter takes out hand jitter without making the line lag.
          const d = Math.hypot(q.x - lx, q.y - ly);
          if (d < 0.6) continue;
          const t = stroke.tool === "hl" ? 0.5 : Math.min(0.75, 0.38 + d / (stroke.w * 10));
          stroke.pts.push(lx + (q.x - lx) * t, ly + (q.y - ly) * t, stroke.pts[n - 1] + (q.p - stroke.pts[n - 1]) * 0.5);
          if (held && Math.hypot(q.x - held.x, q.y - held.y) > 4) held = { x: q.x, y: q.y, t: Date.now() };
        }
        drawLive();
      });
      function endStroke(e) {
        if (!drawing) return;
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        if (moving) {
          moving = null;
          inkChanged();
          return;
        }
        if (lasso) {
          const poly = lasso;
          lasso = null;
          if (poly.length >= 8) {
            const picked = { strokes: new Set(), stickers: new Set() };
            for (const s of note.ink) {
              let inside = 0;
              const count = s.pts.length / 3;
              for (let i = 0; i < s.pts.length; i += 3) if (inPoly(s.pts[i], s.pts[i + 1], poly)) inside++;
              if (inside / count >= 0.6) picked.strokes.add(s);
            }
            for (const st of note.stickers) if (inPoly(st.x + st.w / 2, st.y + st.h / 2, poly)) picked.stickers.add(st);
            if (picked.strokes.size || picked.stickers.size) { sel = picked; drawSelBar(); }
          }
          composite();
          placeSel();
          return;
        }
        if (inkTool === "eraser") {
          inkChanged();
          if (backToPen) setTool(lastDrawTool);
          return;
        }
        if (!stroke) return;
        let s = stroke;
        stroke = null;
        // Catch the line up to where the pen actually lifted.
        if (rawLast) {
          const n = s.pts.length;
          if (Math.hypot(rawLast.x - s.pts[n - 3], rawLast.y - s.pts[n - 2]) > 0.4) s.pts.push(rawLast.x, rawLast.y, s.pts[n - 1]);
        }
        if (shapeSnap && held && Date.now() - held.t > 450) s = snapShape(s) || s;
        for (let i = 0; i < s.pts.length; i++) s.pts[i] = Math.round(s.pts[i] * 100) / 100;
        note.ink.push(s);
        growIfNeeded(s.pts[s.pts.length - 2]);
        inkChanged();
      }
      canvas.addEventListener("pointerup", endStroke);
      canvas.addEventListener("pointercancel", endStroke);

      // --- stickers ---
      function addSticker(src, w, h) {
        remember();
        const sr = scroller.getBoundingClientRect();
        const pr = paper.getBoundingClientRect();
        const k = zoomK();
        // Drop it in the middle of what is on screen.
        const cx = ((sr.left + sr.width / 2) - pr.left) / k;
        const cy = ((sr.top + sr.height / 2) - pr.top) / k;
        const st = { src, x: Math.max(10, Math.min(REF - w - 10, cx - w / 2)), y: Math.max(10, cy - h / 2), w, h };
        note.stickers.push(st);
        if (!drawing) toggleDraw(true);
        setTool("lasso");
        sel = { strokes: new Set(), stickers: new Set([st]) };
        drawSelBar();
        inkChanged();
      }
      function stickerMenu(anchor) {
        closeMenu();
        const grid = el("div", { class: "sl-sticker-grid" });
        for (const [name, svgText] of STICKERS) {
          const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
          grid.append(el("button", {
            class: "sl-sticker", title: name, "aria-label": name,
            onclick: () => { closeMenu(); addSticker(src, 110, 110); },
          }, el("img", { src, alt: "" })));
        }
        const mine = (data.settings.myStickers || []);
        const mineGrid = el("div", { class: "sl-sticker-grid" });
        mine.forEach((src, i) => {
          mineGrid.append(el("button", {
            class: "sl-sticker", title: "My sticker", "aria-label": "My sticker " + (i + 1),
            onclick: () => { closeMenu(); const im = new Image(); im.onload = () => { const r = Math.min(1, 160 / Math.max(im.width, im.height)); addSticker(src, im.width * r, im.height * r); }; im.src = src; },
          }, el("img", { src, alt: "" })));
        });
        menu = el("div", { class: "sl-menu sl-sticker-menu", role: "dialog", "aria-label": "Stickers" },
          el("span", { class: "sl-choice-head", text: "STICKERS" }), grid,
          el("span", { class: "sl-choice-head", text: "MY STICKERS" }),
          mine.length ? mineGrid : el("p", { class: "sl-g-note", text: "Make your own from any picture." }),
          el("button", { class: "sl-pill dark", onclick: () => { closeMenu(); stickerPick.click(); }, text: "Make a sticker from a picture…" }));
        root.append(menu);
        placeMenu(anchor, 300, 420);
      }
      const stickerPick = el("input", {
        type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true,
        onchange: async (e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (!f) return;
          const res2 = await readImage(f);
          if (res2) stickerTrim(res2.url);
        },
      });
      // Trim a picture into a sticker, like Instagram: circle, rounded, heart, star, or draw your own outline.
      function stickerTrim(url) {
        const img = new Image();
        img.onload = () => {
          const S = 360;
          const r = Math.min(S / img.width, S / img.height);
          const w = Math.round(img.width * r);
          const h = Math.round(img.height * r);
          const cv = el("canvas", { class: "sl-trim-canvas", width: String(w), height: String(h) });
          const c = cv.getContext("2d");
          let shape = "free";
          let path = [];
          function redraw() {
            c.clearRect(0, 0, w, h);
            c.globalAlpha = 0.35;
            c.drawImage(img, 0, 0, w, h);
            c.globalAlpha = 1;
            c.save();
            clipShape(c);
            c.drawImage(img, 0, 0, w, h);
            c.restore();
            c.save();
            c.setLineDash([6, 5]);
            c.strokeStyle = "#ffffff";
            c.lineWidth = 2;
            clipShape(c, true);
            c.stroke();
            c.restore();
          }
          function clipShape(cc, outlineOnly) {
            const m = Math.min(w, h);
            const cx = w / 2;
            const cy = h / 2;
            cc.beginPath();
            if (shape === "circle") cc.arc(cx, cy, m / 2 - 4, 0, 6.2832);
            else if (shape === "rounded") { const rr = 28; cc.moveTo(8 + rr, 8); cc.arcTo(w - 8, 8, w - 8, h - 8, rr); cc.arcTo(w - 8, h - 8, 8, h - 8, rr); cc.arcTo(8, h - 8, 8, 8, rr); cc.arcTo(8, 8, w - 8, 8, rr); }
            else if (shape === "heart") {
              const s2 = m / 2 - 6;
              cc.moveTo(cx, cy + s2 * 0.9);
              cc.bezierCurveTo(cx - s2 * 1.4, cy, cx - s2 * 0.9, cy - s2 * 1.1, cx, cy - s2 * 0.45);
              cc.bezierCurveTo(cx + s2 * 0.9, cy - s2 * 1.1, cx + s2 * 1.4, cy, cx, cy + s2 * 0.9);
            } else if (shape === "star") {
              for (let i = 0; i < 10; i++) {
                const rr = i % 2 ? m * 0.22 : m / 2 - 6;
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                if (i) cc.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); else cc.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
              }
              cc.closePath();
            } else if (path.length > 6) {
              cc.moveTo(path[0], path[1]);
              for (let i = 2; i < path.length; i += 2) cc.lineTo(path[i], path[i + 1]);
              cc.closePath();
            } else cc.rect(0, 0, w, h);
            if (!outlineOnly) cc.clip();
          }
          let tracing = false;
          cv.addEventListener("pointerdown", (e) => { if (shape !== "free") return; tracing = true; path = []; cv.setPointerCapture(e.pointerId); });
          cv.addEventListener("pointermove", (e) => {
            if (!tracing) return;
            const b = cv.getBoundingClientRect();
            path.push((e.clientX - b.left) * (w / b.width), (e.clientY - b.top) * (h / b.height));
            redraw();
          });
          cv.addEventListener("pointerup", () => { tracing = false; redraw(); });
          const shapes = el("div", { class: "sl-row" });
          for (const [k, name] of [["free", "Draw outline"], ["circle", "Circle"], ["rounded", "Rounded"], ["heart", "Heart"], ["star", "Star"]]) {
            shapes.append(el("button", { class: "sl-pill" + (shape === k ? " dark" : ""), "data-shape": k, onclick: (e) => {
              shape = k;
              shapes.querySelectorAll("button").forEach((b) => b.classList.toggle("dark", b.dataset.shape === k));
              redraw();
            }, text: name }));
          }
          function finish() {
            // Cut out the shape, trimmed to its edges, with a soft white border like a real sticker.
            const out = document.createElement("canvas");
            out.width = w + 16;
            out.height = h + 16;
            const o = out.getContext("2d");
            o.translate(8, 8);
            o.save();
            clipShape(o, true);
            o.lineWidth = 12;
            o.strokeStyle = "#ffffff";
            o.lineJoin = "round";
            o.shadowColor = "rgba(60,52,44,0.25)";
            o.shadowBlur = 6;
            o.stroke();
            o.restore();
            o.save();
            clipShape(o);
            o.drawImage(img, 0, 0, w, h);
            o.restore();
            const src = out.toDataURL("image/png");
            data.settings.myStickers = [src].concat(data.settings.myStickers || []).slice(0, 24);
            save();
            closeMenu();
            const rr = Math.min(1, 170 / Math.max(out.width, out.height));
            addSticker(src, out.width * rr, out.height * rr);
          }
          closeMenu();
          menu = el("div", { class: "sl-menu sl-trim", role: "dialog", "aria-label": "Make a sticker" },
            el("span", { class: "sl-choice-head", text: "MAKE A STICKER" }),
            el("p", { class: "sl-g-note", text: "Pick a shape, or draw around the part you want to keep." }),
            shapes, cv,
            el("div", { class: "sl-row" },
              el("button", { onclick: () => closeMenu(), text: "Cancel" }),
              el("button", { class: "sl-primary", onclick: finish, text: "Make sticker" })));
          root.append(menu);
          menu.style.left = Math.max(8, (root.clientWidth - 420) / 2) + "px";
          menu.style.top = "70px";
          setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
          redraw();
        };
        img.src = url;
      }

      // --- the pen tray ---
      const tray = el("div", { class: "sl-tray", hidden: true, role: "toolbar", "aria-label": "Drawing tools" });
      const widthInput = el("input", {
        type: "range", min: "0.5", max: "40", step: "0.1", class: "sl-range", "aria-label": "Stroke width",
        oninput: (e) => setWidth(parseFloat(e.target.value), true),
      });
      const widthNum = el("input", {
        type: "number", min: "0.5", max: "40", step: "0.1", class: "sl-wnum", "aria-label": "Stroke width in points",
        onchange: (e) => setWidth(parseFloat(e.target.value)),
      });
      const widthDot = el("span", { class: "sl-wdot" });
      function rememberPen() {
        data.settings.penColor = pen.color; data.settings.penWidth = pen.w;
        data.settings.hlColor = hl.color; data.settings.hlWidth = hl.w;
        save();
      }
      function setWidth(v, fromSlider) {
        if (!(v > 0)) return;
        curPen().w = Math.round(Math.min(40, Math.max(0.5, v)) * 10) / 10;
        rememberPen();
        if (fromSlider) { widthNum.value = curPen().w; showDot(); } else drawTray();
      }
      function showDot() {
        const c = curPen();
        const d = Math.max(3, Math.min(26, c.w));
        Object.assign(widthDot.style, { width: d + "px", height: d + "px", background: c.color, opacity: c.tool === "hl" ? 0.5 : 1 });
      }
      function setTool(t) {
        if (t !== "lasso") clearSel();
        inkTool = t;
        if (t === "pen" || t === "hl") lastDrawTool = t;
        drawTray();
      }
      function trayBtn(icon, label, on, onClick) {
        return el("button", { class: "sl-tool" + (on ? " on" : ""), "aria-label": label, title: label, "aria-pressed": on ? "true" : "false", onclick: onClick }, svg(icon, 16));
      }
      function trayColor(c) {
        c.color = c.color || "#2f2e2b";
        rememberPen();
        drawTray();
      }
      function drawTray() {
        tray.textContent = "";
        tray.hidden = !drawing;
        drawBtn.classList.toggle("on", drawing);
        canvas.classList.toggle("on", drawing);
        canvas.style.cursor = inkTool === "eraser" ? "cell" : inkTool === "lasso" ? "default" : "crosshair";
        body.setAttribute("contenteditable", drawing ? "false" : "true");
        paper.classList.toggle("drawing", drawing);
        if (!drawing) { clearSel(); return; }
        const sepEl = () => el("span", { class: "sl-tool-sep", "aria-hidden": "true" });
        tray.append(
          trayBtn(ICON.draw, "Pen", inkTool === "pen", () => setTool("pen")),
          trayBtn(ICON.mark, "Highlighter", inkTool === "hl", () => setTool("hl")),
          trayBtn(ICON.eraser, "Eraser", inkTool === "eraser", () => setTool("eraser")),
          trayBtn(ICON.lasso, "Lasso: select, move, resize", inkTool === "lasso", () => setTool("lasso")),
          trayBtn(ICON.sticker, "Stickers", false, (e) => stickerMenu(e.currentTarget || e)),
          sepEl());
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
        } else if (inkTool === "lasso") {
          tray.append(el("span", { class: "sl-tray-opt", text: "Draw around strokes or stickers, then drag, resize, recolour or delete them." }));
        } else {
          const c = curPen();
          const quick = c.tool === "hl" ? HL_PALETTE.slice(0, 7) : PEN_PALETTE.slice(0, 7);
          const recent = (data.settings.customColors || []).slice(0, 3);
          const dots = el("div", { class: "sl-pen-colors" });
          const list = quick.map((x) => x[1]).concat(recent.filter((x) => !quick.some((q) => q[1] === x)));
          if (!list.includes(c.color)) list.push(c.color);
          for (const value of list) {
            dots.append(el("button", {
              class: "sl-pen-dot" + (c.color === value ? " on" : ""),
              style: "background:" + value,
              "aria-label": colorName(value), title: colorName(value),
              onclick: () => { c.color = value; trayColor(c); },
            }));
          }
          dots.append(el("button", {
            class: "sl-pen-dot sl-more-colors", "aria-label": "More colours", title: "More colours, custom colour and eyedropper",
            onclick: (e) => colorPicker(e.currentTarget, { title: c.tool === "hl" ? "Highlighter colour" : "Pen colour", colors: c.tool === "hl" ? HL_PALETTE : PEN_PALETTE, current: c.color, onPick: (v) => { c.color = v; trayColor(c); } }),
          }));
          const dropper = el("button", {
            class: "sl-tool", "aria-label": "Eyedropper: pick any colour on screen", title: "Eyedropper: pick any colour on screen",
            onclick: () => pickScreenColor((v) => { c.color = v; addCustomColor(v); trayColor(c); }),
          }, svg(ICON.dropper, 16));
          widthInput.value = c.w;
          widthNum.value = c.w;
          showDot();
          tray.append(dots, dropper, sepEl(), widthDot, widthInput, widthNum, el("span", { class: "sl-tray-unit", text: "pt" }));
        }
        tray.append(
          sepEl(),
          trayBtn(ICON.undo, "Undo", false, () => stepInk(undoInk, redoInk)),
          trayBtn(ICON.redo, "Redo", false, () => stepInk(redoInk, undoInk)),
          trayBtn(ICON.shapes, "Hold at the end of a stroke to make a neat shape", shapeSnap, () => { shapeSnap = !shapeSnap; data.settings.shapeSnap = shapeSnap; save(); drawTray(); }),
          el("button", { class: "sl-pill", title: "Add more paper below", onclick: () => { if (layout() === "pages") note.extraPages = (note.extraPages || 0) + 1; else note.extraSpace = (note.extraSpace || 0) + 600; touch(note); later(); setTimeout(() => scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" }), 120); }, text: layout() === "pages" ? "+ Page" : "+ Space" }),
          el("label", { class: "sl-tray-opt" },
            el("input", { type: "checkbox", checked: fingerDraw, onchange: (e) => { fingerDraw = e.target.checked; data.settings.fingerDraw = fingerDraw; save(); } }),
            "Draw with finger"),
          sepEl(),
          el("button", { class: "sl-pill dark", onclick: () => toggleDraw(false), text: "Done" }));
        placeSel();
      }
      function toggleDraw(force) {
        drawing = force === undefined ? !drawing : force;
        drawTray();
        if (!drawing) body.focus();
      }
      const drawBtn = tool(ICON.draw, "Draw and handwrite", () => toggleDraw(), null, "Ctrl+D");
      tools.append(stickerPick);

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
        note.stickers = JSON.parse(JSON.stringify(v.stickers || []));
        if (v.tabs) { note.tabs = JSON.parse(JSON.stringify(v.tabs)); note.activeTab = v.activeTab; }
        else { delete note.tabs; delete note.activeTab; }
        touch(note);
        render();
        showToast("Restored the version from " + whenText(v.t) + ".", () => {
          const list = versionsOf(note);
          const back = list[list.length - 1];
          if (!back) return;
          note.title = back.title;
          note.html = back.html;
          note.ink = back.ink;
          note.stickers = back.stickers || [];
          if (back.tabs) { note.tabs = back.tabs; note.activeTab = back.activeTab; }
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

      // ----- export: PDF, Word, Markdown, text, web page -----
      function exportMenu(anchor) {
        closeMenu();
        const item = (label, hint, fn) => el("button", { class: "sl-choice sl-action sl-export", onclick: () => { closeMenu(); fn(); } },
          el("span", { text: label }), el("span", { class: "sl-dd-hint", text: hint }));
        menu = el("div", { class: "sl-menu sl-choices", role: "menu", "aria-label": "Export" },
          el("span", { class: "sl-choice-head", text: "SAVE A COPY AS" }),
          item("PDF", "with drawings", () => exportPdf()),
          item("Word document", ".docx", () => exportAs("docx")),
          item("Web page", ".html, with drawings", () => exportAs("html")),
          item("Markdown", ".md", () => exportAs("md")),
          item("Plain text", ".txt", () => exportAs("txt")),
          el("p", { class: "sl-g-note", text: "Copies go to Downloads › StillLife. Handwriting and stickers are kept in PDF and web page copies." }));
        root.append(menu);
        placeMenu(anchor, 270, 300);
      }
      async function exportAs(kind) {
        syncBody();
        const docData = { title: note.title, html: allTabsHtml(note) };
        const stem = fileStem(note.title);
        try {
          if (kind === "docx") await saveFile(stem + ".docx", window.SLTools.toDocx(docData), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          else if (kind === "md") await saveFile(stem + ".md", window.SLTools.toMarkdown(docData), "text/markdown");
          else if (kind === "txt") await saveFile(stem + ".txt", window.SLTools.toText(docData), "text/plain");
          else if (kind === "html") {
            drawInk();
            const ink = (note.ink.length || note.stickers.length) ? '<img class="ink" src="' + canvas.toDataURL("image/png") + '" alt="">' : "";
            const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
              (note.title || "Untitled doc").replace(/</g, "&lt;") + "</title><style>body{margin:0;background:#efebe5;font-family:'Segoe UI',system-ui,sans-serif;color:#34322e}" +
              ".page{position:relative;width:816px;max-width:100%;margin:24px auto;padding:48px 64px 64px;box-sizing:border-box;background:" + (note.paperColor || "#fffdf9") + ";border-radius:6px;box-shadow:0 2px 14px rgba(60,52,44,.12);line-height:1.75}" +
              "h1.t{font-family:Georgia,serif;font-size:34px;margin:0 0 18px}h1,h2,h3{line-height:1.25}img{max-width:100%;border-radius:6px}.ink{position:absolute;left:0;top:0;width:816px;pointer-events:none}" +
              "blockquote{margin:.6em 0 1em;padding:10px 16px;border-radius:10px;background:rgba(189,179,196,.3);font-family:Georgia,serif;font-style:italic}pre{background:#2f3340;color:#e9e6f2;padding:14px 16px;border-radius:12px;white-space:pre-wrap}</style></head><body><div class=\"page\">" +
              '<h1 class="t">' + (note.title || "Untitled doc").replace(/</g, "&lt;") + "</h1>" + allTabsHtml(note) + ink + "</div></body></html>";
            await saveFile(stem + ".html", html, "text/html");
          }
        } catch (e) {
          showNotice("The copy couldn't be saved: " + (e && e.message ? e.message : e));
        }
      }
      // PDF uses Windows' "Save as PDF" printer. A long page can be squeezed onto one sheet, or cut into pages.
      function exportPdf() {
        const tall = paper.getBoundingClientRect().height / zoomK();
        if (layout() === "pageless" && tall > 1180) {
          closeMenu();
          menu = el("div", { class: "sl-menu", role: "dialog", "aria-label": "Long page" },
            el("span", { class: "sl-choice-head", text: "THIS PAGE IS LONGER THAN A SHEET OF PAPER" }),
            el("p", { class: "sl-g-note", text: "Squeeze it to fit on one sheet, or cut it into normal pages?" }),
            el("div", { class: "sl-row" },
              el("button", { onclick: () => { closeMenu(); printWith(Math.max(0.2, 1000 / tall)); }, text: "Squeeze onto one" }),
              el("button", { class: "sl-primary", onclick: () => { closeMenu(); printWith(1); }, text: "Cut into pages" })));
          root.append(menu);
          menu.style.left = Math.max(8, (root.clientWidth - 300) / 2) + "px";
          menu.style.top = "90px";
          setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
          return;
        }
        printWith(1);
      }
      function printWith(squeeze) {
        document.documentElement.style.setProperty("--print-zoom", String(squeeze));
        showNotice("Choose “Microsoft Print to PDF” (or “Save as PDF”) as the printer to make a PDF.");
        setTimeout(printDoc, 60);
      }
      const exportBtn = el("button", { class: "sl-new alt", title: "Save a copy as PDF, Word, Markdown, text or a web page", onclick: (e) => exportMenu(e.currentTarget) }, svg(ICON.exportIcon, 13), "Export");
      headRight.prepend(exportBtn);

      // ===== study tools =====
      const T = window.SLTools;
      async function webRequest(url, bodyObj) {
        if (hasApp) return tauri.core.invoke("web_request", { url, body: bodyObj ? JSON.stringify(bodyObj) : null });
        const r = await fetch(url, bodyObj ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyObj) } : undefined);
        return r.text();
      }
      function insertAtCaret(text) {
        restoreSel();
        try { document.execCommand("styleWithCSS", false, false); } catch (e) {}
        document.execCommand("insertText", false, text);
        syncBody();
        later();
      }

      // ----- calculator (scientific, like a Casio), plus "work out the maths I selected" -----
      let calcOpen = false;
      let calcDeg = data.settings.calcDeg !== false;
      let calcAns = 0;
      const calcHistory = [];
      const calcInput = el("input", {
        class: "sl-calc-input", "aria-label": "Sum", placeholder: "Type a sum, e.g. 2sin(30)+√16",
        oninput: () => calcPreview(),
        onkeydown: (e) => {
          if (e.key === "Enter") { e.preventDefault(); calcEquals(); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); toggleCalc(false); }
        },
      });
      const calcOut = el("div", { class: "sl-calc-out", "aria-live": "polite" });
      const calcHist = el("div", { class: "sl-calc-hist" });
      const degBtn = el("button", { class: "sl-pill", onclick: () => { calcDeg = !calcDeg; data.settings.calcDeg = calcDeg; save(); degBtn.textContent = calcDeg ? "DEG" : "RAD"; calcPreview(); } }, calcDeg ? "DEG" : "RAD");
      function calcPreview() {
        const v = calcInput.value.trim();
        if (!v) { calcOut.textContent = ""; calcOut.classList.remove("err"); return; }
        try { calcOut.textContent = "= " + T.formatNumber(T.calc(v, { deg: calcDeg, ans: calcAns })); calcOut.classList.remove("err"); }
        catch (e) { calcOut.textContent = ""; }
      }
      function calcEquals() {
        const v = calcInput.value.trim();
        if (!v) return;
        try {
          const r = T.calc(v, { deg: calcDeg, ans: calcAns });
          calcAns = r;
          const shown = T.formatNumber(r);
          calcHistory.unshift({ expr: v, res: shown });
          calcHistory.length = Math.min(calcHistory.length, 30);
          calcOut.textContent = "= " + shown;
          calcOut.classList.remove("err");
          drawCalcHist();
          calcInput.value = shown.replace(/ × 10\^/, "e");
        } catch (e) {
          calcOut.textContent = e.message;
          calcOut.classList.add("err");
        }
      }
      function drawCalcHist() {
        calcHist.textContent = "";
        for (const h of calcHistory) {
          calcHist.append(el("button", { class: "sl-calc-line", title: "Use this again", onclick: () => { calcInput.value = h.expr; calcPreview(); calcInput.focus(); } },
            el("span", { text: h.expr }), el("b", { text: "= " + h.res })));
        }
      }
      function key(label, insert, cls) {
        return el("button", {
          class: "sl-key" + (cls ? " " + cls : ""), title: label,
          onmousedown: (e) => e.preventDefault(),
          onclick: () => {
            if (insert === "=") return calcEquals();
            if (insert === "AC") { calcInput.value = ""; calcPreview(); return; }
            if (insert === "DEL") { calcInput.value = calcInput.value.slice(0, -1); calcPreview(); return; }
            const i = calcInput.selectionStart ?? calcInput.value.length;
            const j = calcInput.selectionEnd ?? i;
            calcInput.value = calcInput.value.slice(0, i) + insert + calcInput.value.slice(j);
            const at = i + insert.length;
            calcInput.setSelectionRange(at, at);
            calcPreview();
          },
        }, label);
      }
      const keypad = el("div", { class: "sl-keypad" },
        key("sin", "sin("), key("cos", "cos("), key("tan", "tan("), key("(", "("), key(")", ")"),
        key("sin⁻¹", "asin("), key("cos⁻¹", "acos("), key("tan⁻¹", "atan("), key("xʸ", "^"), key("√", "√("),
        key("ln", "ln("), key("log", "log("), key("π", "π"), key("e", "e"), key("x!", "!"),
        key("nCr", "C"), key("x²", "^2"), key("%", "%"), key("Ans", "ans"), key("⌫", "DEL", "fn"),
        key("7", "7", "num"), key("8", "8", "num"), key("9", "9", "num"), key("÷", "÷", "op"), key("AC", "AC", "fn"),
        key("4", "4", "num"), key("5", "5", "num"), key("6", "6", "num"), key("×", "×", "op"), key("×10ˣ", "×10^", "op"),
        key("1", "1", "num"), key("2", "2", "num"), key("3", "3", "num"), key("−", "-", "op"), key("=", "=", "eq tall"),
        key("0", "0", "num wide"), key(".", ".", "num"), key("+", "+", "op"));
      const calcPanel = el("aside", { class: "sl-grammar sl-calc", hidden: true, "aria-label": "Calculator" },
        el("div", { class: "sl-g-head" },
          el("span", { class: "sl-choice-head", text: "CALCULATOR" }),
          el("div", { class: "sl-row" }, degBtn,
            el("button", { class: "sl-tool", "aria-label": "Close calculator", onclick: () => toggleCalc(false) }, svg(ICON.x, 14)))),
        el("div", { class: "sl-calc-screen" }, calcInput, calcOut),
        keypad,
        el("div", { class: "sl-row" },
          el("button", { class: "sl-pill", onmousedown: (e) => { saveSel(); e.preventDefault(); }, onclick: () => calcSelection(), title: "Select a sum in your doc, then press this (or Alt+=)" }, "Work out selected maths"),
          el("button", { class: "sl-pill dark", onmousedown: (e) => { saveSel(); e.preventDefault(); }, onclick: () => { if (calcHistory[0]) insertAtCaret(calcHistory[0].res); } }, "Insert answer")),
        calcHist);
      function toggleCalc(force) {
        const on = force === undefined ? !calcOpen : force;
        openSide(on ? "calc" : null);
        if (on) setTimeout(() => calcInput.focus(), 30);
      }
      // Select "12×3+4" in the doc and press Alt+= to get "12×3+4 = 40".
      function calcSelection() {
        restoreSel();
        const sel = window.getSelection();
        const text = sel.toString().replace(/=\s*$/, "").trim();
        if (!text) { updateStatus("select a sum first"); return; }
        try {
          const r = T.formatNumber(T.calc(text, { deg: calcDeg, ans: calcAns }));
          const range = sel.getRangeAt(0);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("insertText", false, " = " + r);
          calcHistory.unshift({ expr: text, res: r });
          drawCalcHist();
          syncBody();
          later();
        } catch (e) {
          updateStatus(e.message.toLowerCase());
        }
      }

      // ----- translate and look up words (long-press a word, or select text and press the globe) -----
      const LANGS = [["zh-TW", "繁體中文"], ["zh-CN", "简体中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"], ["vi", "Tiếng Việt"], ["th", "ไทย"]];
      let trPop = null;
      function closeTr() { if (trPop) trPop.remove(); trPop = null; }
      cleanups.push(closeTr);
      async function translateSelection() {
        restoreSel();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let range = sel.getRangeAt(0);
        let text = sel.toString().trim();
        if (!text) {
          // Nothing selected: use the word under the cursor.
          sel.modify("move", "backward", "word");
          sel.modify("extend", "forward", "word");
          range = sel.getRangeAt(0);
          text = sel.toString().trim();
        }
        if (!text) { updateStatus("select some text to translate"); return; }
        if (text.length > 480) text = text.slice(0, 480);
        showTranslation(text, range.cloneRange());
      }
      function showTranslation(text, range) {
        closeTr();
        closePop();
        const box = range.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        const to = data.settings.translateTo || "zh-TW";
        const result = el("div", { class: "sl-tr-result", text: "Translating…" });
        const meaning = el("div", { class: "sl-tr-meaning" });
        const langDd = dropdown({
          label: "Translate into", options: LANGS.map(([v, t]) => ({ value: v, text: t })), value: to,
          onPick: (v) => { data.settings.translateTo = v; save(); showTranslation(text, range); },
        });
        let translated = "";
        trPop = el("div", { class: "sl-gpop sl-trpop", role: "dialog", "aria-label": "Translation" },
          el("div", { class: "sl-tr-head" }, el("span", { class: "sl-tr-src", text: text.length > 80 ? text.slice(0, 80) + "…" : text }), langDd.el),
          result, meaning,
          el("div", { class: "sl-g-btns" },
            el("button", { class: "sl-pill dark", onmousedown: (e) => e.preventDefault(), onclick: () => {
              if (!translated) return;
              body.focus();
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand("insertText", false, translated);
              syncBody();
              closeTr();
            }, text: "Replace" }),
            el("button", { class: "sl-pill", onclick: () => { if (translated && navigator.clipboard) navigator.clipboard.writeText(translated); }, text: "Copy" }),
            el("button", { class: "sl-pill", onclick: closeTr, text: "Close" })),
          el("p", { class: "sl-g-note", text: "Uses the free MyMemory and Free Dictionary services, so it needs internet." }));
        trPop.style.left = Math.max(8, Math.min(box.left - rr.left, rr.width - 340)) + "px";
        trPop.style.top = Math.min(box.bottom - rr.top + 8, rr.height - 260) + "px";
        root.append(trPop);
        const from = /[぀-ヿ]/.test(text) ? "ja" : /[가-힯]/.test(text) ? "ko" : /[一-鿿]/.test(text) ? "zh-TW" : "en";
        const pair = (from === to ? (to === "en" ? "zh-TW" : "en") : from) + "|" + to;
        webRequest("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + encodeURIComponent(pair))
          .then((t) => {
            const j = JSON.parse(t);
            translated = (j.responseData && j.responseData.translatedText) || "";
            if (!translated || /^(PLEASE SELECT|INVALID|QUERY LENGTH)/i.test(translated)) throw new Error("no result");
            result.textContent = translated;
          })
          .catch(() => { result.textContent = "Couldn't translate right now. Check your internet connection."; result.classList.add("err"); });
        // One English word: show what it means too.
        if (/^[A-Za-z][A-Za-z'-]{1,30}$/.test(text)) {
          webRequest("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(text.toLowerCase()))
            .then((t) => {
              const j = JSON.parse(t);
              if (!Array.isArray(j)) return;
              const entry = j[0];
              const phon = entry.phonetic || ((entry.phonetics || []).find((x) => x.text) || {}).text || "";
              meaning.textContent = "";
              if (phon) meaning.append(el("span", { class: "sl-tr-phon", text: phon }));
              for (const m of (entry.meanings || []).slice(0, 3)) {
                const d = (m.definitions || [])[0];
                if (d) meaning.append(el("p", null, el("i", { text: m.partOfSpeech + " " }), d.definition));
              }
            })
            .catch(() => {});
        }
      }
      // Long-press a word (hold the mouse or your finger still) to translate it.
      let pressTimer = 0;
      let pressAt = null;
      body.addEventListener("pointerdown", (e) => {
        if (drawing || e.button !== 0 || e.target.closest("img, pre")) return;
        pressAt = { x: e.clientX, y: e.clientY };
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          const at = document.caretRangeFromPoint && document.caretRangeFromPoint(pressAt.x, pressAt.y);
          if (!at || !body.contains(at.startContainer)) return;
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(at);
          sel.modify("move", "backward", "word");
          sel.modify("extend", "forward", "word");
          const text = sel.toString().trim();
          if (text) { saveSel(); showTranslation(text, sel.getRangeAt(0).cloneRange()); }
        }, 650);
      });
      const cancelPress = (e) => {
        if (pressAt && e.type === "pointermove" && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) < 6) return;
        clearTimeout(pressTimer);
        pressAt = null;
      };
      body.addEventListener("pointermove", cancelPress);
      body.addEventListener("pointerup", cancelPress);
      body.addEventListener("pointercancel", cancelPress);
      cleanups.push(() => clearTimeout(pressTimer));

      // ----- code blocks: write code in any language and run it (like OneCompiler) -----
      const CODE_LANGS = [
        ["python", "Python"], ["cpp", "C++"], ["c", "C"], ["java", "Java"], ["javascript", "JavaScript"], ["csharp", "C#"],
        ["go", "Go"], ["rust", "Rust"], ["ruby", "Ruby"], ["php", "PHP"], ["swift", "Swift"], ["typescript", "TypeScript"], ["bash", "Bash"],
      ];
      const WANDBOX_LANG = { python: "Python", cpp: "C++", c: "C", java: "Java", javascript: "JavaScript", csharp: "C#", go: "Go", rust: "Rust", ruby: "Ruby", php: "PHP", swift: "Swift", typescript: "TypeScript", bash: "Bash script" };
      const WANDBOX_FALLBACK = { python: "cpython-head", cpp: "gcc-head", c: "gcc-head-c", java: "openjdk-jdk-22+36", javascript: "nodejs-20.17.0", csharp: "dotnetcore-8.0.402", go: "go-1.23.2", rust: "rust-1.82.0", ruby: "ruby-4.0.2", php: "php-8.3.12", swift: "swift-6.0.1", typescript: "typescript-5.6.2", bash: "bash" };
      const STARTER = {
        python: 'name = input()\nprint(f"Hello, {name}!")',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    string name;\n    cin >> name;\n    cout << "Hello, " << name << "!" << endl;\n    return 0;\n}',
        c: '#include <stdio.h>\n\nint main(void) {\n    char name[64];\n    scanf("%63s", name);\n    printf("Hello, %s!\\n", name);\n    return 0;\n}',
        java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        String name = in.next();\n        System.out.println("Hello, " + name + "!");\n    }\n}',
        javascript: 'const name = require("fs").readFileSync(0, "utf8").trim();\nconsole.log(`Hello, ${name}!`);',
      };
      let compilers = null;
      async function compilerFor(lang) {
        if (!compilers) {
          compilers = {};
          try {
            const list = JSON.parse(await webRequest("https://wandbox.org/api/list.json"));
            for (const c of list) {
              for (const [k, wl] of Object.entries(WANDBOX_LANG)) {
                if (c.language === wl && !compilers[k]) compilers[k] = c.name;
                // Prefer a stable build over an experimental "head" one.
                if (c.language === wl && compilers[k] && /head/.test(compilers[k]) && !/head/.test(c.name)) compilers[k] = c.name;
              }
            }
          } catch (e) { /* use the built-in names */ }
        }
        return compilers[lang] || WANDBOX_FALLBACK[lang];
      }
      function renderCode(pre) {
        pre.setAttribute("contenteditable", "false");
        const lang = pre.getAttribute("data-lang") || "python";
        const text = pre.textContent;
        pre.innerHTML = T.highlight(text, lang);
        pre.dataset.label = (CODE_LANGS.find((x) => x[0] === lang) || [lang, lang])[1] + " · click to edit and run";
      }
      function renderAllCode() { body.querySelectorAll("pre[data-lang]").forEach(renderCode); }
      let codeOpen = false;
      let codePre = null;
      const codeArea = el("textarea", {
        class: "sl-code-area", spellcheck: "false", "aria-label": "Code",
        oninput: () => { if (codePre) { codePre.textContent = codeArea.value; renderCode(codePre); syncBody(); later(); } },
        onkeydown: (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const i = codeArea.selectionStart;
            codeArea.setRangeText("    ", i, codeArea.selectionEnd, "end");
            codeArea.dispatchEvent(new Event("input"));
          } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runCode(); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); toggleCode(false); }
        },
      });
      const stdinArea = el("textarea", { class: "sl-code-area sl-stdin", spellcheck: "false", placeholder: "Input for the program (optional)", "aria-label": "Program input" });
      const codeOutput = el("pre", { class: "sl-code-out", "aria-live": "polite" });
      const codeLangDd = dropdown({
        label: "Language", options: CODE_LANGS.map(([v, t]) => ({ value: v, text: t })), value: "python",
        onPick: (v) => {
          if (!codePre) return;
          const was = codePre.textContent;
          codePre.setAttribute("data-lang", v);
          const old = codePre.getAttribute("data-lang");
          if (!was.trim() || Object.values(STARTER).includes(was)) { codePre.textContent = STARTER[v] || ""; codeArea.value = codePre.textContent; }
          void old;
          renderCode(codePre);
          syncBody();
        },
      });
      const runBtn = el("button", { class: "sl-pill dark", onclick: () => runCode(), title: "Run (Ctrl+Enter)" }, svg(ICON.play, 13), "Run");
      const codePanel = el("aside", { class: "sl-grammar sl-codepanel", hidden: true, "aria-label": "Code" },
        el("div", { class: "sl-g-head" },
          el("span", { class: "sl-choice-head", text: "CODE" }),
          el("button", { class: "sl-tool", "aria-label": "Close code", onclick: () => toggleCode(false) }, svg(ICON.x, 14))),
        el("div", { class: "sl-row" }, codeLangDd.el, runBtn,
          el("button", { class: "sl-pill", onclick: () => { if (codePre) { const p2 = codePre; toggleCode(false); p2.remove(); syncBody(); later(); } }, text: "Delete block" })),
        codeArea, stdinArea,
        el("span", { class: "sl-choice-head", text: "OUTPUT" }), codeOutput,
        el("p", { class: "sl-g-note", text: "Code runs on the free Wandbox service (needs internet), never on your computer." }));
      function toggleCode(force, pre) {
        const on = force === undefined ? !codeOpen : force;
        if (pre) codePre = pre;
        openSide(on && codePre ? "code" : null);
        if (on && codePre) {
          codeArea.value = codePre.textContent;
          codeLangDd.set(codePre.getAttribute("data-lang") || "python");
          codeOutput.textContent = "";
          body.querySelectorAll("pre.sl-code-on").forEach((x) => x.classList.remove("sl-code-on"));
          codePre.classList.add("sl-code-on");
          setTimeout(() => codeArea.focus(), 30);
        } else {
          body.querySelectorAll("pre.sl-code-on").forEach((x) => x.classList.remove("sl-code-on"));
        }
      }
      function insertCodeBlock() {
        const lang = data.settings.codeLang || "python";
        const pre = el("pre", { "data-lang": lang });
        pre.textContent = STARTER[lang] || "";
        const after = el("p", null, el("br"));
        insertBlocks([pre, after], after);
        renderCode(pre);
        toggleCode(true, pre);
      }
      async function runCode() {
        if (!codePre) return;
        const lang = codePre.getAttribute("data-lang") || "python";
        data.settings.codeLang = lang;
        let code = codeArea.value;
        if (lang === "java" && !/class\s+prog\b/.test(code)) {
          // Wandbox runs Java as "prog": keep the student's class and add a tiny starter.
          const main = /(?:public\s+)?class\s+(\w+)[^{]*\{[\s\S]*?static\s+void\s+main\s*\(/.exec(code);
          code = code.replace(/public\s+class\s+/g, "class ");
          if (main) code += "\nclass prog { public static void main(String[] a) throws Exception { " + main[1] + ".main(a); } }\n";
        }
        runBtn.disabled = true;
        codeOutput.className = "sl-code-out";
        codeOutput.textContent = "Running…";
        try {
          const compiler = await compilerFor(lang);
          const res = JSON.parse(await webRequest("https://wandbox.org/api/compile.json", { compiler, code, stdin: stdinArea.value }));
          const out = [res.compiler_error, res.program_output, res.program_error].filter(Boolean).join("\n").trim();
          codeOutput.textContent = out || "(no output)";
          if (res.status && res.status !== "0") codeOutput.classList.add("err");
        } catch (e) {
          codeOutput.textContent = "Couldn't run the code. Check your internet connection.\n" + (e && e.message ? e.message : "");
          codeOutput.classList.add("err");
        }
        runBtn.disabled = false;
      }
      body.addEventListener("click", (e) => {
        const pre = e.target.closest && e.target.closest("pre[data-lang]");
        if (pre && body.contains(pre)) toggleCode(true, pre);
      });

      // ----- lecture recording: record audio into the doc, with playback -----
      if (!Array.isArray(note.recordings)) note.recordings = [];
      const memMedia = new Map(); // in the browser preview there is no disk
      let recorder = null;
      let recChunks = [];
      let recStart = 0;
      let recTimer = 0;
      let recStream = null;
      let captions = null;
      const recBar = el("div", { class: "sl-recbar", hidden: true, role: "status" });
      const recShelf = el("div", { class: "sl-recshelf" });
      const blobToB64 = (blob) => new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.readAsDataURL(blob);
      });
      const fmtTime = (ms) => { const s2 = Math.round(ms / 1000); return Math.floor(s2 / 60) + ":" + String(s2 % 60).padStart(2, "0"); };
      async function startRecording() {
        if (recorder) return;
        try {
          recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          updateStatus("the microphone isn't available — check Windows privacy settings");
          return;
        }
        const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
        recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
        recChunks = [];
        recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
        recorder.onstop = finishRecording;
        recorder.start(1000);
        recStart = Date.now();
        // Live captions when Windows offers speech recognition here.
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR && data.settings.liveCaptions) {
          try {
            captions = new SR();
            captions.continuous = true;
            captions.interimResults = false;
            captions.lang = data.settings.captionLang || "en-US";
            captions.onresult = (ev) => {
              for (let i = ev.resultIndex; i < ev.results.length; i++) {
                if (ev.results[i].isFinal) {
                  const line = ev.results[i][0].transcript.trim();
                  if (line) { body.append(el("p", { text: line })); syncBody(); later(); }
                }
              }
            };
            captions.start();
          } catch (e) { captions = null; }
        }
        recBtn.classList.add("on");
        recBar.hidden = false;
        const tick = () => {
          recBar.textContent = "";
          recBar.append(el("span", { class: "sl-rec-dot", "aria-hidden": "true" }), "Recording " + fmtTime(Date.now() - recStart),
            el("button", { class: "sl-pill", onclick: () => { if (recorder.state === "recording") recorder.pause(); else recorder.resume(); tick(); }, text: recorder && recorder.state === "paused" ? "Resume" : "Pause" }),
            el("button", { class: "sl-pill dark", onclick: stopRecording }, svg(ICON.stop, 12), "Stop and save"));
        };
        tick();
        recTimer = setInterval(() => { if (recorder && recorder.state === "recording") tick(); }, 1000);
      }
      function stopRecording() {
        if (!recorder) return;
        clearInterval(recTimer);
        if (captions) { try { captions.stop(); } catch (e) {} captions = null; }
        recorder.stop();
        recStream.getTracks().forEach((t) => t.stop());
      }
      async function finishRecording() {
        const dur = Date.now() - recStart;
        const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
        recorder = null;
        recBtn.classList.remove("on");
        recBar.hidden = true;
        const id = "rec" + uid();
        try {
          if (hasApp) await tauri.core.invoke("save_media", { id, data: await blobToB64(blob) });
          else memMedia.set(id, blob);
        } catch (e) {
          updateStatus("the recording couldn't be saved");
          return;
        }
        note.recordings.push({ id, t: now(), dur, type: blob.type, name: "Lecture " + new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) });
        touch(note);
        drawShelf();
      }
      cleanups.push(() => { if (recorder) stopRecording(); });
      async function playRecording(r, holder) {
        holder.textContent = "Loading…";
        try {
          let blob = memMedia.get(r.id);
          if (!blob && hasApp) {
            const b64 = await tauri.core.invoke("load_media", { id: r.id });
            const bin = atob(b64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            blob = new Blob([u8], { type: r.type || "audio/webm" });
          }
          if (!blob) throw new Error("missing");
          const audio = el("audio", { controls: true, src: URL.createObjectURL(blob), class: "sl-audio" });
          holder.textContent = "";
          holder.append(audio);
          audio.play().catch(() => {});
        } catch (e) {
          holder.textContent = "This recording couldn't be found.";
        }
      }
      function drawShelf() {
        recShelf.textContent = "";
        recShelf.hidden = !note.recordings.length;
        for (const r of note.recordings) {
          const holder = el("span", { class: "sl-rec-player" });
          recShelf.append(el("div", { class: "sl-rec-item" },
            el("button", { class: "sl-tool", "aria-label": "Play " + r.name, onclick: () => playRecording(r, holder) }, svg(ICON.play, 14)),
            el("span", { class: "sl-rec-name", text: r.name + " · " + fmtTime(r.dur) }),
            holder,
            el("button", { class: "sl-tool", "aria-label": "Delete recording", title: "Delete recording", onclick: () => {
              note.recordings = note.recordings.filter((x) => x !== r);
              if (hasApp) tauri.core.invoke("delete_media", { id: r.id }).catch(() => {});
              touch(note);
              drawShelf();
            } }, svg(ICON.x, 13))));
        }
      }
      const recBtn = tool(ICON.mic, "Record a lecture", () => (recorder ? stopRecording() : startRecording()), null);

      // ----- take a photo with the camera -----
      async function takePhoto() {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1600 } } });
        } catch (e) {
          updateStatus("the camera isn't available — check Windows privacy settings");
          return;
        }
        saveSel();
        closeMenu();
        const video = el("video", { class: "sl-cam-video", autoplay: true, playsinline: true });
        video.srcObject = stream;
        const stopCam = () => stream.getTracks().forEach((t) => t.stop());
        menu = el("div", { class: "sl-menu sl-cam", role: "dialog", "aria-label": "Take a photo" },
          el("span", { class: "sl-choice-head", text: "TAKE A PHOTO" }), video,
          el("div", { class: "sl-row" },
            el("button", { onclick: () => { stopCam(); closeMenu(); }, text: "Cancel" }),
            el("button", { class: "sl-primary", onclick: () => {
              const c = document.createElement("canvas");
              c.width = video.videoWidth;
              c.height = video.videoHeight;
              c.getContext("2d").drawImage(video, 0, 0);
              stopCam();
              closeMenu();
              c.toBlob((blob) => { if (blob) insertImages([new File([blob], "photo.jpg", { type: "image/jpeg" })]); }, "image/jpeg", 0.88);
            }, text: "Take photo" })));
        root.append(menu);
        menu.style.left = Math.max(8, (root.clientWidth - 460) / 2) + "px";
        menu.style.top = "70px";
        const close = menu.querySelector("button");
        setTimeout(() => document.addEventListener("mousedown", (ev) => { if (menu && !menu.contains(ev.target)) { stopCam(); } }, { once: true, capture: true }), 0);
        void close;
      }

      // ----- the Insert menu -----
      function insertMenu(anchor) {
        closeMenu();
        const item = (icon, label, fn) => el("button", { class: "sl-choice sl-action sl-ins", onmousedown: (e) => e.preventDefault(), onclick: () => { closeMenu(); fn(); } }, svg(icon, 15), label);
        menu = el("div", { class: "sl-menu sl-choices", role: "menu", "aria-label": "Insert" },
          el("span", { class: "sl-choice-head", text: "INSERT" }),
          item(ICON.image, "Picture from a file", () => { saveSel(); filePick.click(); }),
          item(ICON.camera, "Take a photo", takePhoto),
          item(ICON.code, "Code block (run C++, Java, Python…)", insertCodeBlock),
          item(ICON.omega, "Symbol or equation", () => toggleChars(true)),
          item(ICON.hr, "Divider line", () => run("insertHorizontalRule")),
          item(ICON.pages, "Page break", insertPageBreak),
          item(ICON.mic, "Lecture recording", startRecording),
          item(ICON.image, "Screenshot (press Win+Shift+S, then Ctrl+V here)", () => showToast("Press Win+Shift+S to snip any part of your screen, then press Ctrl+V in your doc to paste it.", () => {})));
        root.append(menu);
        placeMenu(anchor, 280, 330);
      }
      const insertBtn = tool(ICON.insert, "Insert", (b) => insertMenu(b), null);
      const calcBtn = tool(ICON.calc, "Calculator", () => toggleCalc(), null, "Alt+=");
      const trBtn = tool(ICON.globe, "Translate or look up (or long-press a word)", () => translateSelection(), null);
      tools.insertBefore(insertBtn, imageBtn);
      imageBtn.remove();
      tools.querySelector('[aria-label="Divider line"]')?.remove();
      tools.insertBefore(trBtn, drawBtn);
      tools.insertBefore(calcBtn, drawBtn);
      tools.insertBefore(recBtn, drawBtn);

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
          const tall = Math.max(inkBottom() + 160, 680) + (note.extraSpace || 0);
          paper.style.minHeight = tall + "px";
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
        const inkB = inkBottom();
        const inkPages = inkB > 0 ? Math.floor(inkB / stride) + 1 : 1;
        pageCount = Math.max(1, Math.floor(Math.max(0, bottom - 1) / stride) + 1, inkPages) + (note.extraPages || 0);
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

      const subTab = hasTabs() && activeTabObj() !== note.tabs[0] ? activeTabObj() : null;
      const title = el("input", {
        class: "sl-doc-title" + (subTab ? " sl-tab-title" : ""),
        value: subTab ? subTab.title : note.title,
        placeholder: subTab ? "Untitled tab" : "Untitled doc",
        "aria-label": subTab ? "Tab name" : "Doc title",
        oninput: (e) => {
          if (subTab) { subTab.title = e.target.value; buildOutline(); }
          else note.title = e.target.value;
          touch(note);
          laterSnap();
        },
        onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); body.focus(); } },
      });

      const meta = el("div", { class: "sl-doc-meta" });
      const label = labelById(note.label);
      if (label) meta.append(el("span", { class: "sl-chip sl-user", style: "background: var(--c-" + label.color + ")", text: label.name }));
      const due = dueInfo(note.due);
      if (due) meta.append(el("span", { class: "sl-chip " + due.cls, text: due.text }));

      const paper = el("div", { class: "sl-paper" }, sheets, meta, recShelf, title, body, canvas, selBox);
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
      const page = el("div", { class: "sl-docpage", onkeydown: shortcut, onwheel: undefined }, head, tools, findBar, tray, recBar,
        el("div", { class: "sl-doc-main" }, outline, scroller, grammarPanel, charPanel, histPanel, calcPanel, codePanel));

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

      // Print, history and shortcuts sit beside Export so the formatting bar fits on one line.
      for (const label of ["Keyboard shortcuts", "Print or save as PDF", "Version history"]) {
        const b = tools.querySelector('[aria-label="' + label + '"]');
        if (b) headRight.insertBefore(b, exportBtn.nextSibling);
      }
      tools.querySelectorAll(".sl-tool-sep + .sl-tool-sep, .sl-tool-sep:last-child").forEach((x) => x.remove());
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
      applyPaper();
      renderAllCode();
      drawShelf();
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
      const coverRow = el("div", { class: "sl-cover-row", role: "group", "aria-label": "Cover" },
        el("button", { class: "sl-cover-pick none" + (!note.cover ? " on" : ""), title: "No cover", "aria-label": "No cover", onclick: () => { delete note.cover; touch(note); closeMenu(); render(); } }),
        ...COVERS.map(([id, name, col]) => el("button", {
          class: "sl-cover-pick" + (note.cover === id ? " on" : ""), style: "--cv:" + col, title: name, "aria-label": name + " cover",
          onclick: () => { note.cover = id; touch(note); closeMenu(); render(); },
        })));
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
        note.type === "doc" ? el("div", { class: "sl-field" }, "COVER", coverRow) : null,
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

    // ---------- files: export, import, backup ----------
    function bytesToB64(bytes) {
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }
    // Saves into Downloads\StillLife (in the app), or downloads it (in a browser).
    async function saveFile(name, dataOrBytes, mime) {
      const binary = typeof dataOrBytes !== "string";
      if (hasApp) {
        const path = await tauri.core.invoke("export_file", { name, data: binary ? bytesToB64(dataOrBytes) : dataOrBytes, binary });
        showNotice("Saved to Downloads › StillLife › " + path.split(/[\\/]/).pop(), "Show in folder", () => tauri.core.invoke("reveal_file", { path }));
        return path;
      }
      const blob = new Blob([dataOrBytes], { type: mime || "application/octet-stream" });
      const a = el("a", { href: URL.createObjectURL(blob), download: name });
      document.body.append(a);
      a.click();
      a.remove();
      showNotice("Downloaded " + name);
      return name;
    }
    function showNotice(message, actionText, action) {
      if (toast) toast.remove();
      clearTimeout(toastTimer);
      toast = el("div", { class: "sl-toast", role: "status" }, message,
        actionText ? el("button", { onclick: () => { action(); hideToast(); }, text: actionText }) : null);
      root.append(toast);
      toastTimer = setTimeout(hideToast, 8000);
    }
    const fileStem = (t) => (t || "Untitled doc").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().slice(0, 80) || "Untitled doc";

    // Bring files in as new docs: Word, text, Markdown, web pages and pictures.
    async function importFiles(files) {
      const list = Array.from(files || []);
      let made = 0;
      let firstId = null;
      for (const f of list) {
        const name = f.name || "Imported";
        const stem = name.replace(/\.[^.]+$/, "");
        const ext = (name.split(".").pop() || "").toLowerCase();
        let doc = null;
        try {
          if (ext === "docx") doc = await window.SLTools.fromDocx(new Uint8Array(await f.arrayBuffer()));
          else if (ext === "md" || ext === "markdown") doc = window.SLTools.fromText(await f.text(), true);
          else if (ext === "txt" || f.type === "text/plain") doc = window.SLTools.fromText(await f.text(), false);
          else if (ext === "html" || ext === "htm") {
            const d = new DOMParser().parseFromString(await f.text(), "text/html");
            doc = { title: (d.querySelector("title") || {}).textContent || "", html: d.body ? d.body.innerHTML : "" };
          } else if (ext === "json") {
            await restoreBackup(f);
            continue;
          } else if (/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) {
            const url = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(f); });
            doc = { title: stem, html: '<p><img src="' + url + '" alt="" style="width: 100%"></p>' };
          } else {
            showNotice("“" + name + "” can't be opened. StillLife reads Word (.docx), text, Markdown, web pages and pictures.");
            continue;
          }
        } catch (e) {
          showNotice("“" + name + "” couldn't be read.");
          continue;
        }
        const note = {
          id: uid(), type: "doc", title: (doc.title || stem).trim(), html: cleanHtml(doc.html || ""),
          label: view.label === "all" ? "" : view.label, color: ["oat", "rose", "lilac", "clay"][made % 4],
          pinned: false, importance: "low", due: "", created: now(), edited: now(), resolved: false, ink: [],
        };
        if (data.settings.paperStyle) note.paperStyle = data.settings.paperStyle;
        data.notes.unshift(note);
        firstId = firstId || note.id;
        made++;
      }
      if (!made) return;
      save();
      showNotice(made === 1 ? "Imported 1 file as a doc. Headings became its outline." : "Imported " + made + " files as docs.");
      if (made === 1 && opts.full) openDoc(firstId);
      else render();
    }
    const importPick = el("input", {
      type: "file", multiple: true, hidden: true,
      accept: ".docx,.txt,.md,.markdown,.html,.htm,.json,image/png,image/jpeg,image/gif,image/webp",
      onchange: (e) => { importFiles(e.target.files); e.target.value = ""; },
    });
    document.body.append(importPick);

    // A full copy of every note, saved as one file you can keep anywhere.
    async function backupAll() {
      const stamp = new Date().toISOString().slice(0, 10);
      await saveFile("StillLife backup " + stamp + ".json", JSON.stringify(data, null, 1), "application/json");
    }
    async function restoreBackup(file) {
      let incoming;
      try {
        incoming = migrate(JSON.parse(await file.text()));
      } catch (e) {
        showNotice("That backup file couldn't be read.");
        return;
      }
      let added = 0;
      let updated = 0;
      for (const n of incoming.notes) {
        const mine = data.notes.find((x) => x.id === n.id);
        if (!mine) { data.notes.push(n); added++; }
        else if ((n.edited || 0) > (mine.edited || 0)) { Object.assign(mine, n); updated++; }
      }
      for (const l of incoming.labels) if (!data.labels.some((x) => x.id === l.id)) data.labels.push(l);
      save();
      render();
      showNotice("Backup restored: " + added + " added, " + updated + " updated. Nothing was deleted.");
    }
    // Drop files anywhere on the notes list to import them.
    if (opts.full) {
      root.addEventListener("dragover", (e) => {
        if (view.doc || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
        e.preventDefault();
        root.classList.add("sl-dropping");
      });
      root.addEventListener("dragleave", (e) => { if (e.target === root) root.classList.remove("sl-dropping"); });
      root.addEventListener("drop", (e) => {
        root.classList.remove("sl-dropping");
        if (view.doc || !e.dataTransfer || !e.dataTransfer.files.length) return;
        e.preventDefault();
        importFiles(e.dataTransfer.files);
      });
    }

    // ---------- settings ----------
    function openSettings() {
      closeMenu();
      const close = () => { if (sheet) sheet.remove(); sheet = null; document.removeEventListener("keydown", esc, true); };
      const esc = (e) => { if (e.key === "Escape" && !document.querySelector(".sl-dd-pop")) { e.preventDefault(); e.stopPropagation(); close(); } };
      const row = (label, control, hint) => el("div", { class: "sl-set-row" },
        el("div", { class: "sl-set-text" }, el("span", { class: "sl-set-label", text: label }), hint ? el("span", { class: "sl-set-hint", text: hint }) : null), control);
      const toggle = (key, fallback, after) => {
        const input = el("input", { type: "checkbox", checked: data.settings[key] === undefined ? fallback : !!data.settings[key], onchange: (e) => { data.settings[key] = e.target.checked; save(); if (after) after(e.target.checked); } });
        return el("label", { class: "sl-switch" }, input, el("span", { class: "sl-switch-track", "aria-hidden": "true" }, el("span", { class: "sl-switch-knob" })));
      };
      const choose = (key, fallback, options, after) => dropdown({
        label: key, options: options.map(([v, t]) => ({ value: v, text: t })), value: data.settings[key] || fallback,
        onPick: (v) => { data.settings[key] = v; save(); if (after) after(v); },
      }).el;
      const islandToggle = el("label", { class: "sl-switch" });
      if (hasApp) {
        const input = el("input", { type: "checkbox", onchange: (e) => tauri.core.invoke("set_island_enabled", { enabled: e.target.checked }) });
        tauri.core.invoke("island_enabled").then((on) => { input.checked = !!on; });
        islandToggle.append(input, el("span", { class: "sl-switch-track", "aria-hidden": "true" }, el("span", { class: "sl-switch-knob" })));
      }
      const notesPlace = el("span", { class: "sl-set-hint", text: hasApp ? "Saved on this computer, in StillLife's own folder. A backup copy is kept automatically." : "Saved in this browser." });
      const hasCaptions = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      let sheet = el("div", { class: "sl-sheet-back", onmousedown: (e) => { if (e.target === e.currentTarget) close(); } },
        el("div", { class: "sl-settings", role: "dialog", "aria-label": "Settings" },
          el("div", { class: "sl-g-head" }, el("span", { class: "sl-set-title", text: "Settings" }),
            el("button", { class: "sl-tool", "aria-label": "Close settings", onclick: close }, svg(ICON.x, 15))),
          el("span", { class: "sl-choice-head", text: "GENERAL" }),
          row("Language", choose("lang", "en", [["en", "English"], ["zh-TW", "繁體中文"]], (v) => { window.SLi18n.setLanguage(v, document.body); if (v === "en") location.reload(); })),
          hasApp ? row("Show the island", islandToggle, "Turn it off before exams or presentations.") : null,
          opts.full ? row("Corner clock and battery", toggle("showClock", true, () => tickClock()), "Show the date, time and battery in the full window") : null,
          opts.full ? row("Show the quick ball", toggle("quickBall", true, () => drawBall()), "A floating button for new notes, search and more.") : null,
          el("span", { class: "sl-choice-head", text: "DOCS" }),
          row("New docs start as", choose("docLayout", "pages", [["pages", "Pages"], ["pageless", "Pageless (one long page)"]])),
          row("Grammar underlines", toggle("grammar", true)),
          row("Typing shortcuts (\\alpha, ->, x^2)", toggle("autoSymbols", true)),
          row("Translate into", choose("translateTo", "zh-TW", [["zh-TW", "繁體中文"], ["zh-CN", "简体中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"]])),
          hasCaptions ? row("Live captions while recording (when Windows offers them)", toggle("liveCaptions", false)) : null,
          el("span", { class: "sl-choice-head", text: "DRAWING" }),
          row("Draw with finger", toggle("fingerDraw", true), "Turn off to draw with a pen only, so your palm doesn't leave marks."),
          row("Back to pen after erasing", toggle("eraserBackToPen", true)),
          row("Neat shapes when you hold at the end", toggle("shapeSnap", true)),
          el("span", { class: "sl-choice-head", text: "YOUR NOTES" }),
          row("Back up all notes", el("button", { class: "sl-pill", onclick: () => backupAll(), text: "Back up" }), "Saves one file with everything to Downloads › StillLife."),
          row("Import files", el("button", { class: "sl-pill", onclick: () => importPick.click(), text: "Import…" }), "Word, text, Markdown, web pages and pictures."),
          el("div", { class: "sl-set-row" }, notesPlace),
          el("span", { class: "sl-choice-head", text: "ABOUT" }),
          el("p", { class: "sl-g-note", text: "StillLife — every note, quietly in orbit. Version " + VERSION + "." })));
      root.append(sheet);
      document.addEventListener("keydown", esc, true);
    }

    // ---------- the corner clock: date, time and battery ----------
    let battery = null;
    if (opts.clockEl && navigator.getBattery) navigator.getBattery().then((b) => { battery = b; b.addEventListener("levelchange", tickClock); b.addEventListener("chargingchange", tickClock); tickClock(); }).catch(() => {});
    function tickClock() {
      const c = opts.clockEl;
      if (!c) return;
      c.hidden = data.settings.showClock === false;
      if (c.hidden) return;
      const d = new Date();
      const date = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
      const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      c.textContent = "";
      c.append(el("span", { class: "clk-date", text: date }), el("span", { class: "clk-time", text: time }));
      if (battery) {
        const pctB = Math.round(battery.level * 100);
        c.append(el("span", { class: "clk-bat" + (battery.charging ? " charging" : pctB <= 20 ? " low" : ""), title: battery.charging ? "Charging" : "Battery" },
          el("span", { class: "clk-bat-body" }, el("span", { class: "clk-bat-fill", style: "width:" + pctB + "%" })), pctB + "%"));
      }
    }
    if (opts.clockEl) setInterval(tickClock, 15000);

    // ---------- the quick ball ----------
    let ball = null;
    function drawBall() {
      if (ball) { ball.remove(); ball = null; }
      if (!opts.full || data.settings.quickBall === false) return;
      let open = false;
      const items = el("div", { class: "sl-ball-items" });
      const act = (icon, label, fn) => el("button", { class: "sl-ball-item", title: label, "aria-label": label, onclick: () => { toggle(false); fn(); } }, svg(icon, 16), el("span", { text: label }));
      function toggle(force) {
        open = force === undefined ? !open : force;
        ball.classList.toggle("open", open);
        items.textContent = "";
        if (!open) return;
        if (view.doc) {
          const page = root.querySelector(".sl-docpage");
          const press = (label) => { const b = page && page.querySelector('[aria-label="' + label + '"]'); if (b) b.click(); };
          items.append(
            act(ICON.back, "All notes", () => { view.doc = null; render(); }),
            act(ICON.draw, "Draw", () => press("Draw and handwrite")),
            act(ICON.calc, "Calculator", () => press("Calculator")),
            act(ICON.globe, "Translate", () => press("Translate or look up (or long-press a word)")),
            act(ICON.find, "Find", () => press("Find and replace")));
        } else {
          items.append(
            act(ICON.agenda, "New agenda", () => newNote("agenda")),
            act(ICON.doc, "New doc", () => newNote("doc")),
            act(ICON.find, "Search notes", () => { const s2 = root.querySelector(".sl-search-input"); if (s2) s2.focus(); }),
            act(ICON.importIcon, "Import files", () => importPick.click()),
            act(ICON.view, "Settings", () => openSettings()));
        }
      }
      ball = el("div", { class: "sl-ball" }, items,
        el("button", { class: "sl-ball-btn", "aria-label": "Quick ball", title: "Quick ball", onclick: () => toggle() }));
      document.body.append(ball);
      document.addEventListener("mousedown", (e) => { if (open && ball && !ball.contains(e.target)) toggle(false); }, true);
    }

    // ---------- tabs for docs that are open at the same time ----------
    function docTabs() {
      const open = (data.settings.openDocs || []).filter((id) => data.notes.some((n) => n.id === id && n.type === "doc"));
      data.settings.openDocs = open;
      if (!opts.full || !open.length) return null;
      const strip = el("div", { class: "sl-doctabs", role: "tablist", "aria-label": "Open docs" });
      strip.append(el("button", { class: "sl-doctab home" + (view.doc ? "" : " on"), role: "tab", onclick: () => { view.doc = null; render(); } }, svg(ICON.view, 13), "All notes"));
      for (const id of open) {
        const n = data.notes.find((x) => x.id === id);
        strip.append(el("div", { class: "sl-doctab" + (view.doc === id ? " on" : ""), role: "tab", "aria-selected": view.doc === id ? "true" : "false" },
          el("button", { class: "sl-doctab-name", onclick: () => { if (view.doc !== id) { view.doc = id; render(); } } }, svg(ICON.doc, 12), n.title || "Untitled doc"),
          el("button", { class: "sl-doctab-x", "aria-label": "Close " + (n.title || "doc"), onclick: (e) => {
            e.stopPropagation();
            data.settings.openDocs = open.filter((x) => x !== id);
            if (view.doc === id) {
              const i = open.indexOf(id);
              view.doc = data.settings.openDocs[Math.max(0, i - 1)] || null;
            }
            save();
            render();
          } }, svg(ICON.x, 10))));
      }
      return strip;
    }

    // ---------- search everything (like iOS) ----------
    function noteText(n) {
      if (n.type !== "doc") return (n.items || []).map((i) => i.text).join(" · ");
      if (!Array.isArray(n.tabs) || n.tabs.length < 2) return htmlToText(n.html);
      return n.tabs.map((t) => (t.title || "") + " " + htmlToText(tabHtml(n, t))).join(" · ");
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
        if (Array.isArray(n.tabs) && n.tabs.length > 1) {
          const words = q.toLowerCase().split(/\s+/).filter(Boolean);
          const hit = n.tabs.find((t) => words.every((w) => ((t.title || "") + " " + htmlToText(tabHtml(n, t))).toLowerCase().includes(w)))
            || n.tabs.find((t) => words.some((w) => htmlToText(tabHtml(n, t)).toLowerCase().includes(w)));
          if (hit) { activateTab(n, hit.id); save(); }
        }
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
            h.label ? el("span", { class: "sl-chip sl-user", style: "background: var(--c-" + h.label.color + ")", text: h.label.name }) : null,
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
      const strip = docTabs();
      if (openNote) {
        const doc = docPage(openNote);
        if (strip) root.append(strip);
        root.append(doc.page);
        if (toast) root.append(toast);
        if (!openNote.title) doc.title.focus();
        if (opts.onCounts) opts.onCounts(counts());
        return;
      }
      view.doc = null;

      const scroller = el("div", { class: "sl-scroll" });
      if (opts.full && data.settings.listZoom && data.settings.listZoom !== 1) scroller.style.zoom = String(data.settings.listZoom);
      if (strip) root.append(strip);
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
    // ----- zoom: a touchpad pinch (or Ctrl + scroll) zooms StillLife's content, never the whole window -----
    let listZoomSave = 0;
    function setListZoom(z) {
      z = Math.round(Math.min(1.8, Math.max(0.6, z)) * 1000) / 1000;
      data.settings.listZoom = z;
      const sc = root.querySelector(".sl-scroll");
      if (sc) sc.style.zoom = String(z);
      clearTimeout(listZoomSave);
      listZoomSave = setTimeout(save, 400);
    }
    if (opts.full) {
      window.addEventListener("wheel", (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault(); // stops the whole app from zooming; the doc page zooms itself
        if (view.doc || !root.isConnected) return;
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.004));
        setListZoom((data.settings.listZoom || 1) * f);
      }, { passive: false, capture: true });
      window.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.defaultPrevented) return;
        const k = e.key;
        if (k !== "=" && k !== "+" && k !== "-" && k !== "0") return;
        e.preventDefault();
        if (view.doc) return;
        const z = data.settings.listZoom || 1;
        setListZoom(k === "0" ? 1 : k === "-" ? z / 1.1 : z * 1.1);
      });
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

    load().then(() => {
      render();
      if (window.SLi18n && data.settings.lang === "zh-TW") window.SLi18n.setLanguage("zh-TW", document.body);
      tickClock();
      drawBall();
    });
    return { refresh, counts, openDoc };
  }

  window.StillLifeNotes = { mount, grammarCheck };
})();
