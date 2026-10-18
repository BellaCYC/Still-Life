/* StillLife notes view — shared by the island plate and the full window.
 *
 * Usage: StillLifeNotes.mount(element, { label: "island" | "main", full: bool, onCounts(fn) })
 *
 * Notes are saved through the app (notes.json in the StillLife data folder).
 * When StillLife runs as a plain web page (e.g. previewing), they fall back to localStorage.
 */
(function () {
  "use strict";

  const tauri = window.__TAURI__;
  const hasApp = !!(tauri && tauri.core);

  const COLORS = ["sage", "mist", "rose", "oat", "lilac", "clay", "celadon", "lavender"];
  const LABELS = [
    { id: "school", name: "School", color: "var(--c-mist)" },
    { id: "research", name: "Research", color: "var(--c-sage)" },
    { id: "personal", name: "Personal", color: "var(--c-rose)" },
  ];
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

  // ---------- storage ----------
  let notes = [];
  let loadFailed = false;
  let saveTimer = null;

  async function load() {
    try {
      const text = hasApp ? await tauri.core.invoke("load_notes") : (localStorage.getItem("stilllife-notes") || "[]");
      const parsed = JSON.parse(text);
      notes = Array.isArray(parsed) ? parsed : [];
      loadFailed = false;
    } catch (e) {
      // Never overwrite a file we could not read.
      loadFailed = true;
      notes = [];
    }
  }
  function save() {
    if (loadFailed) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const text = JSON.stringify(notes);
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
    const view = { label: "all", type: "all", archive: false };
    let menu = null;
    let toast = null;
    let toastTimer = null;
    let pendingRender = false;

    root.classList.add("sl");
    if (opts.full) root.classList.add("full");

    function counts() {
      const active = notes.filter((n) => !n.resolved);
      const t = todayStr(0);
      return {
        total: active.length,
        due: active.filter((n) => n.due && n.due <= t).length,
      };
    }

    function visible() {
      return notes
        .filter((n) => (view.archive ? n.resolved : !n.resolved))
        .filter((n) => view.label === "all" || n.label === view.label)
        .filter((n) => view.type === "all" || n.type === view.type)
        .sort((a, b) => (view.archive ? (b.resolvedAt || 0) - (a.resolvedAt || 0) : (b.edited || 0) - (a.edited || 0)));
    }

    function newNote(type) {
      const used = notes.filter((n) => !n.resolved).length;
      const note = {
        id: uid(),
        type,
        title: "",
        body: "",
        items: type === "agenda" ? [] : undefined,
        label: view.label === "all" ? "" : view.label,
        color: type === "agenda" ? ["sage", "mist", "celadon", "lavender"][used % 4] : ["oat", "rose", "lilac", "clay"][used % 4],
        pinned: false,
        importance: "low",
        due: "",
        created: now(),
        edited: now(),
        resolved: false,
      };
      notes.unshift(note);
      view.archive = false;
      save();
      render({ id: note.id, sel: ".sl-title" });
    }

    // ---------- toolbar ----------
    function toolbar() {
      const tabs = el("div", { class: "sl-seg sl-tabs", role: "tablist", "aria-label": "Labels" });
      const allTabs = [{ id: "all", name: "All" }].concat(LABELS);
      for (const l of allTabs) {
        const b = el("button", {
          class: view.label === l.id ? "on" : "",
          role: "tab",
          "aria-selected": view.label === l.id ? "true" : "false",
          onclick: () => { view.label = l.id; render(); },
        });
        if (l.color) b.append(el("span", { class: "sl-dot", style: "background:" + l.color }));
        b.append(l.name);
        tabs.append(b);
      }

      const types = el("div", { class: "sl-seg", role: "group", "aria-label": "Show" });
      for (const t of [["all", "Everything"], ["agenda", "Agendas"], ["doc", "Docs"]]) {
        types.append(el("button", { class: view.type === t[0] ? "on" : "", onclick: () => { view.type = t[0]; render(); }, text: t[1] }));
      }

      const resolvedCount = notes.filter((n) => n.resolved).length;
      const archiveBtn = el("button", {
        class: "sl-new alt",
        onclick: () => { view.archive = !view.archive; render(); },
        text: view.archive ? "Back to notes" : "Resolved" + (resolvedCount ? " (" + resolvedCount + ")" : ""),
      });

      const newAgenda = el("button", { class: "sl-new", onclick: () => newNote("agenda") }, svg(ICON.plus, 13), "Agenda");
      const newDoc = el("button", { class: "sl-new", onclick: () => newNote("doc") }, svg(ICON.plus, 13), "Doc");

      return el("div", { class: "sl-bar" },
        el("div", { class: "sl-group" }, tabs, types),
        el("div", { class: "sl-group" }, archiveBtn, newAgenda, newDoc));
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
      const label = LABELS.find((l) => l.id === note.label);
      if (label) foot.append(el("span", { class: "sl-chip", text: label.name }));
      foot.append(el("span", { class: "sl-chip", text: ago(note.edited || note.created) }));
      return foot;
    }

    function allDone(note) {
      return note.type === "agenda" && note.items.length > 0 && note.items.every((i) => i.done);
    }

    function card(note) {
      const c = el("article", {
        class: "sl-card c-" + (note.color || "oat") + (allDone(note) && !note.resolved ? " ready" : "") + (note.resolved ? " archived" : ""),
        "data-id": note.id,
      });

      // Header: type icon, title, (agenda) All resolved, pin, menu
      const title = el("input", {
        class: "sl-title",
        value: note.title,
        placeholder: note.type === "agenda" ? "Agenda title" : "Doc title",
        "aria-label": "Title",
        oninput: (e) => { note.title = e.target.value; touch(note); },
        onkeydown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const next = c.querySelector(note.type === "agenda" ? ".sl-item-text, .sl-add-item" : ".sl-body");
            if (next) next.focus();
          }
        },
      });
      const head = el("div", { class: "sl-head" }, svg(note.type === "agenda" ? ICON.agenda : ICON.doc, 13), title);

      if (note.type === "agenda" && !note.resolved) {
        const box = el("input", {
          type: "checkbox",
          "aria-label": "All resolved: clear this agenda",
          onchange: () => resolve(note),
        });
        head.append(el("label", { class: "sl-resolved", title: "Tick when everything is done to clear this agenda" }, box, "All resolved"));
      }
      if (!note.resolved) {
        head.append(el("button", {
          class: "sl-icon-btn",
          "aria-label": note.pinned ? "Unpin" : "Pin",
          "aria-pressed": note.pinned ? "true" : "false",
          title: note.pinned ? "Unpin" : "Pin to the top",
          style: note.pinned ? "background: rgba(255,255,255,0.6)" : "opacity: 0.6",
          onclick: () => { note.pinned = !note.pinned; touch(note); render(); },
        }, svg(ICON.pin, 14)));
        head.append(el("button", {
          class: "sl-icon-btn",
          "aria-label": "More options",
          onclick: (e) => openMenu(note, e.currentTarget),
        }, svg(ICON.more, 15)));
      }
      c.append(head);

      // Body
      if (note.type === "doc") {
        const body = el("textarea", {
          class: "sl-body",
          placeholder: "Write\u2026",
          "aria-label": "Doc text",
          readonly: note.resolved ? "" : null,
          oninput: (e) => { note.body = e.target.value; touch(note); },
        });
        body.value = note.body || "";
        c.append(body);
      } else {
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
      }

      if (note.resolved) {
        c.append(el("div", { class: "sl-archive-actions" },
          el("button", { onclick: () => { note.resolved = false; delete note.resolvedAt; touch(note); render(); }, text: "Restore" }),
          el("button", { onclick: () => remove(note), text: "Delete for good" })));
      } else {
        c.append(chips(note));
      }
      return c;
    }

    // ---------- actions ----------
    function resolve(note) {
      note.resolved = true;
      note.resolvedAt = now();
      touch(note);
      render();
      showToast("\u201C" + (note.title || "Agenda") + "\u201D was resolved and cleared.", () => {
        note.resolved = false;
        delete note.resolvedAt;
        touch(note);
        render();
      });
    }

    function remove(note) {
      const index = notes.indexOf(note);
      if (index < 0) return;
      notes.splice(index, 1);
      save();
      render();
      showToast("\u201C" + (note.title || (note.type === "agenda" ? "Agenda" : "Doc")) + "\u201D was deleted.", () => {
        notes.splice(Math.min(index, notes.length), 0, note);
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
      for (const l of LABELS) labelSel.append(el("option", { value: l.id, text: l.name }));
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
      const scrollEl = root.querySelector(".sl-scroll");
      const scroll = scrollEl ? scrollEl.scrollTop : 0;
      root.textContent = "";
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
          scroller.append(el("div", { class: "sl-grid" }, ...list.map(card)));
        } else {
          const pinned = list.filter((n) => n.pinned);
          const others = list.filter((n) => !n.pinned);
          if (pinned.length) {
            scroller.append(el("div", { class: "sl-section", text: "PINNED" }));
            scroller.append(el("div", { class: "sl-grid" }, ...pinned.map(card)));
            if (others.length) scroller.append(el("div", { class: "sl-section", text: "OTHERS" }));
          }
          if (others.length) scroller.append(el("div", { class: "sl-grid" }, ...others.map(card)));
        }
      }
      scroller.scrollTop = scroll;

      if (focus) {
        const c = root.querySelector('[data-id="' + focus.id + '"]');
        let target = null;
        if (c && focus.item) target = c.querySelector('[data-item="' + focus.item + '"] .sl-item-text');
        else if (c && focus.sel) target = c.querySelector(focus.sel);
        if (target) {
          target.focus();
          if (target.setSelectionRange && target.value) target.setSelectionRange(target.value.length, target.value.length);
          target.scrollIntoView({ block: "nearest" });
        }
      }
      if (opts.onCounts) opts.onCounts(counts());
    }

    // Another window changed the notes: reload, but never interrupt typing.
    function editing() {
      const a = document.activeElement;
      return a && root.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
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
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    load().then(() => render());
    return { refresh, counts };
  }

  window.StillLifeNotes = { mount };
})();
