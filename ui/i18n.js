// StillLife's app language. English is the default; 繁體中文 translates the buttons,
// menus and messages (never your own notes).
(function () {
  "use strict";
  const ZH = {
    // notes list
    "All": "全部", "Everything": "全部", "Agendas": "待辦", "Docs": "文件", "Starred": "星號", "Agenda": "待辦", "Doc": "文件",
    "Label": "標籤", "Labels": "標籤", "Add label": "新增標籤", "Done": "完成", "New label": "新標籤", "Search": "搜尋",
    "Search all notes": "搜尋所有筆記", "Resolved": "已完成", "Back to notes": "回到筆記", "PINNED": "已釘選", "OTHERS": "其他",
    "RESOLVED": "已完成", "VIEW": "檢視", "SORT BY": "排序方式", "TEXT SIZE": "文字大小", "Blocks": "區塊", "List": "清單",
    "Details": "詳細資料", "Date edited": "編輯日期", "Date created": "建立日期", "Importance": "重要性", "Due date": "截止日期",
    "Pinned on top": "釘選置頂", "Small": "小", "Medium": "中", "Large": "大", "Extra large": "特大",
    "A quiet space for your notes.": "一個安靜的筆記空間。", "Start an Agenda for checklists, or a Doc for writing.": "建立「待辦」做清單，或建立「文件」來寫作。",
    "Nothing resolved yet.": "還沒有完成的項目。", "Add item": "新增項目", "+ Add item": "+ 新增項目", "Untitled doc": "未命名文件",
    "Untitled agenda": "未命名待辦", "Agenda title": "待辦標題", "All resolved": "全部完成", "Zoom in": "放大", "Shrink back": "縮小",
    "Pin": "釘選", "Unpin": "取消釘選", "Star": "加星號", "Unstar": "移除星號", "More options": "更多選項", "COLOUR": "顏色", "LABEL": "標籤",
    "IMPORTANCE": "重要性", "DUE DATE": "截止日期", "COVER": "封面", "Clear date": "清除日期", "Delete": "刪除", "No label": "無標籤",
    "High": "高", "Low": "低", "Overdue": "已逾期", "Due today": "今天到期", "Due tomorrow": "明天到期", "just now": "剛剛",
    "Restore": "還原", "Delete for good": "永久刪除", "Undo": "復原", "Redo": "取消復原", "No cover": "無封面",
    "Search looks through titles, doc text, agenda items and labels.": "搜尋範圍包含標題、文件內容、待辦項目和標籤。",
    "Import files (Word, text, Markdown, pictures)…": "匯入檔案（Word、文字、Markdown、圖片）…",
    "Tip: you can also drop files onto this window.": "提示：也可以把檔案直接拖進這個視窗。", "Back up all notes": "備份所有筆記",
    "Restore from a backup…": "從備份還原…", "Settings": "設定",
    // doc page
    "All notes": "所有筆記", "Export": "匯出", "saved": "已儲存", "Normal text": "內文", "Title": "標題", "Heading": "標題 2",
    "Subheading": "標題 3", "Quote": "引言", "Bold": "粗體", "Italic": "斜體", "Underline": "底線", "Strikethrough": "刪除線",
    "Superscript": "上標", "Subscript": "下標", "Text colour": "文字顏色", "Highlight": "螢光標記", "Align left": "靠左對齊",
    "Align centre": "置中", "Align right": "靠右對齊", "Bulleted list": "項目符號", "Numbered list": "編號清單", "Link": "連結",
    "Insert": "插入", "Special characters and equations": "特殊字元與公式", "Page setup: layout, paper, colour": "版面設定：版面、紙張、顏色",
    "Show or hide tabs and outline": "顯示或隱藏分頁與大綱", "Find and replace": "尋找與取代", "Grammar suggestions": "文法建議",
    "Translate or look up (or long-press a word)": "翻譯或查字典（或長按單字）", "Calculator": "計算機", "Record a lecture": "錄下課堂",
    "Draw and handwrite": "手寫與繪圖", "Version history": "版本記錄", "Print or save as PDF": "列印或存成 PDF",
    "Keyboard shortcuts": "鍵盤快速鍵", "Zoom": "縮放", "Fit width": "符合寬度", "Text style": "文字樣式",
    "DOCUMENT TABS": "文件分頁", "Add tab": "新增分頁", "Tab options": "分頁選項", "Rename": "重新命名", "Add subtab": "新增子分頁",
    "Duplicate": "建立副本", "Move up": "上移", "Move down": "下移", "EMOJI": "表情符號", "Headings you add appear here.": "你加入的標題會顯示在這裡。",
    "Untitled tab": "未命名分頁", "Doc title": "文件標題", "Start writing…": "開始寫作…",
    "PAGE LAYOUT": "版面", "Pages": "分頁", "Pageless (one long page)": "無分頁（一整頁）", "PAPER": "紙張", "PAPER COLOUR": "紙張顏色",
    "Plain": "空白", "Lined": "橫線", "Grid": "方格", "Dots": "點格", "Cornell": "康乃爾", "Insert page break  ·  Ctrl+Enter": "插入分頁符號  ·  Ctrl+Enter",
    "Add a blank page at the end": "在最後加一頁空白頁", "Remove added blank pages": "移除加上的空白頁",
    "INSERT": "插入", "Picture from a file": "從檔案插入圖片", "Take a photo": "拍照", "Code block (run C++, Java, Python…)": "程式碼區塊（可執行 C++、Java、Python…）",
    "Symbol or equation": "符號或公式", "Divider line": "分隔線", "Page break": "分頁符號", "Lecture recording": "課堂錄音",
    "SAVE A COPY AS": "另存副本為", "PDF": "PDF", "Word document": "Word 文件", "Web page": "網頁", "Markdown": "Markdown", "Plain text": "純文字",
    "Find in doc": "在文件中尋找", "Replace with": "取代為", "Replace": "取代", "Replace all": "全部取代", "Replace…": "取代…", "No results": "沒有結果",
    "SUGGESTIONS": "建議", "Underline as I type": "輸入時加上底線", "Accept": "接受", "Accept all": "全部接受", "Ignore": "忽略",
    "Looking good.": "看起來很棒。", "No suggestions right now.": "目前沒有建議。",
    "English grammar, spelling and punctuation rules. Works offline; nothing leaves your computer.": "英文文法、拼字與標點規則。離線運作，資料不會離開你的電腦。",
    "CHARACTERS & EQUATIONS": "字元與公式", "Recent": "最近使用", "Accents": "重音字母", "Greek": "希臘字母", "Maths": "數學",
    "Super / sub": "上標 / 下標", "Arrows": "箭頭", "Chemistry": "化學", "Physics": "物理", "Currency & more": "貨幣與其他", "Equations": "公式",
    "EQUATIONS": "公式", "Symbols and equations you use will appear here.": "你用過的符號和公式會出現在這裡。",
    "VERSION HISTORY": "版本記錄", "Current version": "目前版本", "Restore this version": "還原這個版本", "Back to current": "回到目前版本",
    "removed since": "之後刪除", "added since": "之後新增", "No earlier versions yet. One is kept as you write.": "還沒有較早的版本。寫作時會自動保留。",
    "KEYBOARD SHORTCUTS": "鍵盤快速鍵", "CALCULATOR": "計算機", "Work out selected maths": "計算選取的算式", "Insert answer": "插入答案",
    "CODE": "程式碼", "Run": "執行", "Delete block": "刪除區塊", "OUTPUT": "輸出", "Input for the program (optional)": "程式輸入（選填）",
    "Code runs on the free Wandbox service (needs internet), never on your computer.": "程式在免費的 Wandbox 服務上執行（需要網路），不會在你的電腦上執行。",
    "Running…": "執行中…", "(no output)": "（沒有輸出）", "Translating…": "翻譯中…", "Copy": "複製", "Close": "關閉",
    "Uses the free MyMemory and Free Dictionary services, so it needs internet.": "使用免費的 MyMemory 與 Free Dictionary 服務，需要網路。",
    "TAKE A PHOTO": "拍照", "Take photo": "拍照", "Cancel": "取消", "Pause": "暫停", "Resume": "繼續", "Stop and save": "停止並儲存",
    // drawing
    "Pen": "原子筆", "Highlighter": "螢光筆", "Eraser": "橡皮擦", "Lasso: select, move, resize": "套索：選取、移動、縮放", "Stickers": "貼紙",
    "Whole stroke": "整筆擦除", "Rub out part": "局部擦除", "Back to pen after erasing": "擦完自動換回筆", "Draw with finger": "用手指繪圖",
    "Draw around strokes or stickers, then drag, resize, recolour or delete them.": "圈選筆跡或貼紙，然後拖曳、縮放、換色或刪除。",
    "+ Page": "+ 頁面", "+ Space": "+ 空間", "Colour": "顏色", "STICKERS": "貼紙", "MY STICKERS": "我的貼紙",
    "Make your own from any picture.": "用任何圖片自己做貼紙。", "Make a sticker from a picture…": "用圖片做貼紙…", "MAKE A STICKER": "製作貼紙",
    "Pick a shape, or draw around the part you want to keep.": "選一個形狀，或圈出你想保留的部分。", "Draw outline": "自己圈", "Circle": "圓形",
    "Rounded": "圓角", "Heart": "愛心", "Make sticker": "製作貼紙", "YOUR COLOURS": "你的顏色", "Custom": "自訂", "Eyedropper": "滴管",
    "Colours you pick with Custom or the eyedropper are kept here.": "用「自訂」或滴管選的顏色會保留在這裡。",
    "PEN COLOUR": "筆的顏色", "HIGHLIGHTER COLOUR": "螢光筆顏色", "TEXT COLOUR": "文字顏色", "HIGHLIGHT": "螢光標記", "RECOLOUR": "換色",
    // settings
    "SETTINGS": "設定", "Language": "語言", "Island": "動態島", "Show the island": "顯示動態島", "Docs": "文件",
    "New docs start as": "新文件預設", "Typing shortcuts (\\alpha, ->, x^2)": "輸入捷徑（\\alpha、->、x^2）", "Grammar underlines": "文法底線",
    "Translate into": "翻譯成", "Drawing": "繪圖", "Neat shapes when you hold at the end": "停住筆尾時自動整理成形狀",
    "Corner clock and battery": "右上角時鐘與電量", "Show the date, time and battery in the full window": "在完整視窗顯示日期、時間與電量",
    "Your notes": "你的筆記", "About": "關於", "Live captions while recording (when Windows offers them)": "錄音時即時字幕（Windows 支援時）",
    "Quick ball": "快捷球", "Show the quick ball": "顯示快捷球", "New agenda": "新增待辦", "New doc": "新增文件", "Search notes": "搜尋筆記",
    "Import files": "匯入檔案", "Island on": "動態島：開", "Island off": "動態島：關", "Got it": "知道了", "Font": "字型", "Remove this colour": "移除這個顏色", "Default": "預設",
    "Serif": "襯線體", "Handwriting": "手寫體", "Neat handwriting": "工整手寫", "Script": "草寫", "Typewriter": "打字機", "text → handwriting": "文字 → 手寫",
    "GENERAL": "一般", "DOCS": "文件", "DRAWING": "繪圖", "YOUR NOTES": "你的筆記", "ABOUT": "關於", "Back up": "備份", "Import…": "匯入…",
    "Turn it off before exams or presentations.": "考試或簡報前可以關掉。", "A floating button for new notes, search and more.": "浮動按鈕，快速新增筆記、搜尋等。",
    "Turn off to draw with a pen only, so your palm doesn't leave marks.": "關閉後只能用筆畫，手掌不會留下痕跡。",
    "Saves one file with everything to Downloads › StillLife.": "把所有內容存成一個檔案，放在「下載 › StillLife」。",
    "Word, text, Markdown, web pages and pictures.": "Word、文字、Markdown、網頁和圖片。", "New agenda": "新增待辦", "Find": "尋找", "Draw": "繪圖", "Translate": "翻譯",
  };
  // Pieces of changing text, like "12 words · 2 pages · saved".
  const PARTS = [
    [/^(\d+) words?$/, "$1 字"], [/^(\d+) pages?$/, "$1 頁"], [/^(\d+) strokes?$/, "$1 筆"], [/^saved$/, "已儲存"],
    [/^saved just now$/, "剛剛儲存"], [/^(\d+) of (\d+)$/, "第 $1 / $2 個"], [/^(\d+) RESULTS?$/, "$1 個結果"],
    [/^(\d+) suggestions?$/, "$1 個建議"], [/^(\d+) h ago$/, "$1 小時前"], [/^(\d+) min ago$/, "$1 分鐘前"],
    [/^Recording (\d+:\d+)$/, "錄音中 $1"], [/^Today, (.+)$/, "今天 $1"], [/^Yesterday, (.+)$/, "昨天 $1"],
    [/^Resolved( \((\d+)\))?$/, "已完成$1"], [/^(\d+) words? · (\d+) strokes?$/, "$1 字 · $2 筆"],
  ];
  // Never translate what people wrote.
  const SKIP = ".sl-user, .sl-doctab-name, .sl-doc-body, .sl-doc-title, .sl-preview, .sl-title, .sl-item-text, .sl-label-input, .sl-cover-label, .sl-result-text, " +
    ".sl-calc-input, .sl-calc-hist, .sl-code-area, .sl-code-out, .sl-tr-result, .sl-tr-src, .sl-tr-meaning, .sl-g-change, .sl-outline-item, " +
    ".sl-rec-name, .sl-tab-name, .sl-tab-rename, .sl-search-input, .sl-find-input, .sl-char-grid, .sl-eq-f, .sl-keypad, textarea, input, pre, .sl-tab-title";
  function tr(text) {
    const t = text.trim();
    if (!t) return null;
    if (ZH[t]) return text.replace(t, ZH[t]);
    if (t.includes(" · ")) {
      const parts = t.split(" · ");
      let changed = false;
      const out = parts.map((p) => {
        if (ZH[p]) { changed = true; return ZH[p]; }
        for (const [re, to] of PARTS) if (re.test(p)) { changed = true; return p.replace(re, to); }
        return p;
      });
      return changed ? text.replace(t, out.join(" · ")) : null;
    }
    for (const [re, to] of PARTS) if (re.test(t)) return text.replace(t, t.replace(re, to));
    return null;
  }
  function translateNode(node) {
    if (node.nodeType === 3) {
      const p = node.parentElement;
      if (!p || p.closest(SKIP)) return;
      const v = tr(node.textContent);
      if (v !== null && v !== node.textContent) node.textContent = v;
      return;
    }
    if (node.nodeType !== 1 || node.closest(SKIP + ", script, style")) {
      if (node.nodeType === 1 && (node.matches("input, textarea") && !node.closest(".sl-doc-body"))) {
        const ph = node.getAttribute("placeholder");
        const v = ph && tr(ph);
        if (v) node.setAttribute("placeholder", v);
      }
      return;
    }
    for (const attr of ["title", "aria-label", "placeholder", "data-placeholder"]) {
      const val = node.getAttribute(attr);
      if (val) { const v = tr(val); if (v) node.setAttribute(attr, v); }
    }
    for (const ch of Array.from(node.childNodes)) translateNode(ch);
  }
  let observer = null;
  let lang = "en";
  function setLanguage(next, root) {
    lang = next === "zh-TW" ? "zh-TW" : "en";
    document.documentElement.lang = lang === "zh-TW" ? "zh-Hant" : "en";
    if (observer) { observer.disconnect(); observer = null; }
    if (lang !== "zh-TW") return;
    const target = root || document.body;
    translateNode(target);
    observer = new MutationObserver((list) => {
      observer.disconnect();
      for (const m of list) {
        if (m.type === "characterData") translateNode(m.target);
        else for (const n of m.addedNodes) translateNode(n);
      }
      observer.observe(target, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }
  window.SLi18n = { setLanguage, get lang() { return lang; } };
})();
