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
    S: [], STRIKE: [], UL: [], OL: [], LI: ["style"], BLOCKQUOTE: ["style"], HR: [], CODE: [], PRE: [], SPAN: ["style"],
    FONT: ["color"], A: ["href"],
  };
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
    }
    return keep.join("; ");
  }
  const DROP = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "IMG", "VIDEO", "AUDIO"];
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
            if (keep && attr.name === "style") {
              const clean = safeStyle(attr.value);
              if (clean) child.setAttribute("style", clean);
              else keep = false;
            }
            if (!keep) child.removeAttribute(attr.name);
          }
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

  // ---------- storage ----------
  const DEFAULT_SETTINGS = { view: "blocks", sort: "edited", pinnedTop: true, textSize: "m" };
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
    const view = { label: "all", type: "all", archive: false, editLabels: false, doc: null, expanded: null, focus: null };
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

      const newAgenda = el("button", { class: "sl-new", onclick: () => newNote("agenda") }, svg(ICON.plus, 13), "Agenda");
      const newDoc = el("button", { class: "sl-new", onclick: () => newNote("doc") }, svg(ICON.plus, 13), "Doc");

      return el("div", { class: "sl-bar" },
        el("div", { class: "sl-group" }, tabs, types),
        el("div", { class: "sl-group" }, viewBtn, archiveBtn, newAgenda, newDoc));
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
      const status = el("span", { class: "sl-doc-status" });
      function updateStatus() {
        const words = htmlToText(note.html).split(" ").filter(Boolean).length;
        status.textContent = words + (words === 1 ? " word" : " words") + " · saved";
      }

      const headRight = el("div", { class: "sl-group" });
      headButtons(note, headRight);
      const head = el("div", { class: "sl-doc-head" },
        el("button", { class: "sl-new alt", onclick: closeDoc }, svg(ICON.back, 13), "All notes"),
        status, headRight);

      const body = el("div", {
        class: "sl-doc-body",
        contenteditable: "true",
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
        if (savedRange) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      }
      function run(cmd, value) {
        restoreSel();
        try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
        document.execCommand(cmd, false, value === undefined ? null : value);
        syncBody();
        refreshTools();
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

      const blockSel = el("select", {
        "aria-label": "Text style",
        onmousedown: saveSel,
        onchange: (e) => run("formatBlock", e.target.value),
      },
        el("option", { value: "P", text: "Normal text" }),
        el("option", { value: "H1", text: "Title" }),
        el("option", { value: "H2", text: "Heading" }),
        el("option", { value: "H3", text: "Subheading" }),
        el("option", { value: "BLOCKQUOTE", text: "Quote" }));

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

      tools.append(
        tool(ICON.undo, "Undo", () => run("undo"), null, "Ctrl+Z"),
        tool(ICON.redo, "Redo", () => run("redo"), null, "Ctrl+Y"),
        sep(), blockSel, sep(),
        tool(ICON.bold, "Bold", () => run("bold"), "bold", "Ctrl+B"),
        tool(ICON.italic, "Italic", () => run("italic"), "italic", "Ctrl+I"),
        tool(ICON.underline, "Underline", () => run("underline"), "underline", "Ctrl+U"),
        tool(ICON.strike, "Strikethrough", () => run("strikeThrough"), "strikeThrough"),
        tool(ICON.color, "Text colour", (b) => swatchMenu(b, "Text colour", TEXT_COLORS, "foreColor")),
        tool(ICON.mark, "Highlight", (b) => swatchMenu(b, "Highlight", MARKS, "hiliteColor")),
        sep(),
        tool(ICON.left, "Align left", () => run("justifyLeft"), "justifyLeft"),
        tool(ICON.center, "Align centre", () => run("justifyCenter"), "justifyCenter"),
        tool(ICON.right, "Align right", () => run("justifyRight"), "justifyRight"),
        sep(),
        tool(ICON.ul, "Bulleted list", () => run("insertUnorderedList"), "insertUnorderedList"),
        tool(ICON.ol, "Numbered list", () => run("insertOrderedList"), "insertOrderedList"),
        tool(ICON.link, "Link", (b) => linkMenu(b)),
        tool(ICON.hr, "Divider line", () => run("insertHorizontalRule")),
        sep(),
        tool(ICON.outline, "Show or hide outline", () => { outlineOpen = !outlineOpen; outline.hidden = !outlineOpen; buildOutline(); }),
        tool(ICON.print, "Print or save as PDF", () => window.print()));

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
          blockSel.value = ["H1", "H2", "H3", "BLOCKQUOTE"].includes(block) ? block : "P";
        } catch (e) {}
      }
      document.addEventListener("selectionchange", refreshTools);
      stopDocListeners = () => document.removeEventListener("selectionchange", refreshTools);

      // ----- outline built from the headings -----
      let outlineOpen = !!opts.full && window.innerWidth > 1000;
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
      });

      body.addEventListener("focus", () => {
        // New lines become proper paragraphs.
        try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
      });
      body.addEventListener("input", () => { syncBody(); buildOutline(); });
      body.addEventListener("paste", (e) => {
        // Keep simple formatting from the clipboard, drop everything else.
        e.preventDefault();
        const html = e.clipboardData.getData("text/html");
        if (html) document.execCommand("insertHTML", false, cleanHtml(html));
        else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        syncBody();
        buildOutline();
      });
      body.addEventListener("click", (e) => {
        // Never let a link replace the app page.
        if (e.target.closest("a")) e.preventDefault();
      });

      const title = el("input", {
        class: "sl-doc-title",
        value: note.title,
        placeholder: "Untitled doc",
        "aria-label": "Doc title",
        oninput: (e) => { note.title = e.target.value; touch(note); },
        onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); body.focus(); } },
      });

      const meta = el("div", { class: "sl-doc-meta" });
      const label = labelById(note.label);
      if (label) meta.append(el("span", { class: "sl-chip", style: "background: var(--c-" + label.color + ")", text: label.name }));
      const due = dueInfo(note.due);
      if (due) meta.append(el("span", { class: "sl-chip " + due.cls, text: due.text }));

      const paper = el("div", { class: "sl-paper" }, meta, title, body);
      const page = el("div", { class: "sl-docpage" }, head, tools,
        el("div", { class: "sl-doc-main" }, outline, el("div", { class: "sl-doc-scroll" }, paper)));
      updateStatus();
      buildOutline();
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
      const labelSel = el("select", { onchange: (e) => { note.label = e.target.value; touch(note); closeMenu(); render(); } },
        el("option", { value: "", text: "No label" }));
      for (const l of data.labels) labelSel.append(el("option", { value: l.id, text: l.name || "Untitled" }));
      labelSel.value = note.label || "";

      const impSel = el("select", { onchange: (e) => { note.importance = e.target.value; touch(note); closeMenu(); render(); } });
      for (const [k, v] of Object.entries(IMPORTANCE)) impSel.append(el("option", { value: k, text: v }));
      impSel.value = note.importance || "low";

      const dueInput = el("input", { type: "date", value: note.due || "", onchange: (e) => { note.due = e.target.value; touch(note); render(); } });

      menu = el("div", { class: "sl-menu", role: "dialog", "aria-label": "Note options" },
        el("label", null, "COLOUR", swatches),
        el("label", null, "LABEL", labelSel),
        el("label", null, "IMPORTANCE", impSel),
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

      if (loadFailed) {
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
        if (focus.label) {
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
      if (e.key !== "Escape") return;
      if (menu) closeMenu();
      else if (view.focus) { view.focus = null; render(); }
    });

    load().then(() => render());
    return { refresh, counts, openDoc };
  }

  window.StillLifeNotes = { mount };
})();
