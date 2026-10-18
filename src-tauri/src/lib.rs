//! StillLife — v0.7.0
//!
//! Two windows:
//! - "main":   the full StillLife window. Closing it hides it; StillLife keeps running in the tray.
//! - "island": a transparent, always-on-top window docked to one edge of the screen
//!             (top, bottom, left or right). It holds the small resting pill and, when
//!             opened, the glass plate. It is click-through while resting.
//!
//! A light background watcher checks where the cursor is. When it rests on the pill
//! itself, the pill grows ("glance"); if the cursor stays for a moment, or the pill is
//! clicked, it opens into the glass plate ("open"). Moving away folds it back up.
//! The pill can be dragged to another edge; it snaps there and is remembered.
//!
//! The island can be switched off completely (tray menu, the plate, or the full window),
//! e.g. before an exam. The choice is remembered after a restart.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, WebviewWindow, WindowEvent, Wry,
};

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// Set when the plate asks to fold up straight away (e.g. after opening the full window).
struct FoldRequest(AtomicBool);
/// Set when the pill is clicked, to open the plate without waiting.
struct OpenRequest(AtomicBool);
/// True while the pill is being dragged; the watcher pauses.
struct Dragging(AtomicBool);
/// Whether the island is switched on.
struct IslandEnabled(AtomicBool);
/// The tray's "Show island" tick box, kept so it can follow changes made elsewhere.
struct IslandToggle(Mutex<Option<CheckMenuItem<Wry>>>);
/// Which edge the island sits on, and how far along it (0.0 = start, 1.0 = end).
struct Dock(Mutex<(Edge, f64)>);

#[derive(Clone, Copy, PartialEq, Debug)]
enum Edge {
    Top,
    Bottom,
    Left,
    Right,
}

impl Edge {
    fn name(self) -> &'static str {
        match self {
            Edge::Top => "top",
            Edge::Bottom => "bottom",
            Edge::Left => "left",
            Edge::Right => "right",
        }
    }
    fn parse(text: &str) -> Option<Edge> {
        match text {
            "top" => Some(Edge::Top),
            "bottom" => Some(Edge::Bottom),
            "left" => Some(Edge::Left),
            "right" => Some(Edge::Right),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum IslandState {
    Rest,
    Glance,
    Open,
}

impl IslandState {
    fn name(self) -> &'static str {
        match self {
            IslandState::Rest => "rest",
            IslandState::Glance => "glance",
            IslandState::Open => "open",
        }
    }
}

// ---------------------------------------------------------------------------
// Sizes — these match island.html (logical pixels)
// ---------------------------------------------------------------------------

/// Gap between the screen edge and the pill / plate.
const EDGE_GAP: f64 = 6.0;
/// Resting pill.
const REST_W: f64 = 132.0;
const REST_H: f64 = 30.0;
/// Glancing pill.
const GLANCE_W: f64 = 340.0;
const GLANCE_H: f64 = 56.0;
/// Open plate.
const PLATE_W: f64 = 960.0;
const PLATE_H: f64 = 560.0;

/// How often the watcher checks the cursor.
const POLL_MS: u64 = 40;
/// How long the cursor rests on the pill before the plate opens.
const OPEN_DELAY_MS: u64 = 350;
/// How long the cursor can be away from the plate before it folds up.
const CLOSE_DELAY_MS: u64 = 200;
/// Extra room around the pill that still counts as "on it" (logical pixels).
const PILL_MARGIN: f64 = 4.0;
/// Extra room around the glancing pill / open plate before it counts as "left".
const GLANCE_MARGIN: f64 = 12.0;
const PLATE_MARGIN: f64 = 24.0;

/// A rectangle in physical screen pixels.
#[derive(Clone, Copy)]
struct Rect {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

impl Rect {
    fn contains(&self, x: f64, y: f64, margin: f64) -> bool {
        x >= self.left - margin && x <= self.right + margin && y >= self.top - margin && y <= self.bottom + margin
    }
}

/// Where an element of logical size (w, h), drawn against `edge` inside the island
/// window, sits on screen.
fn element_rect(island: &WebviewWindow, edge: Edge, w: f64, h: f64) -> Option<Rect> {
    let pos = island.outer_position().ok()?;
    let size = island.outer_size().ok()?;
    let scale = island.scale_factor().ok()?;
    let (wx, wy) = (pos.x as f64, pos.y as f64);
    let (ww, wh) = (size.width as f64, size.height as f64);
    let (ew, eh, gap) = (w * scale, h * scale, EDGE_GAP * scale);
    let (left, top) = match edge {
        Edge::Top => (wx + (ww - ew) / 2.0, wy + gap),
        Edge::Bottom => (wx + (ww - ew) / 2.0, wy + wh - gap - eh),
        Edge::Left => (wx + gap, wy + (wh - eh) / 2.0),
        Edge::Right => (wx + ww - gap - ew, wy + (wh - eh) / 2.0),
    };
    Some(Rect { left, top, right: left + ew, bottom: top + eh })
}

/// The usable area of a monitor (leaving out the taskbar).
fn usable_area(mon: &Monitor) -> (f64, f64, f64, f64) {
    let area = mon.work_area();
    (
        area.position.x as f64,
        area.position.y as f64,
        area.size.width as f64,
        area.size.height as f64,
    )
}

/// Moves the island window so it sits on `edge` of `mon`, `along` of the way (0..1).
fn place_island(island: &WebviewWindow, mon: &Monitor, edge: Edge, along: f64) {
    let Ok(size) = island.outer_size() else { return };
    let (mx, my, mw, mh) = usable_area(mon);
    let (ww, wh) = (size.width as f64, size.height as f64);
    let along = along.clamp(0.0, 1.0);
    let (x, y) = match edge {
        Edge::Top => (mx + along * (mw - ww).max(0.0), my),
        Edge::Bottom => (mx + along * (mw - ww).max(0.0), my + mh - wh),
        Edge::Left => (mx, my + along * (mh - wh).max(0.0)),
        Edge::Right => (mx + mw - ww, my + along * (mh - wh).max(0.0)),
    };
    let _ = island.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
}

fn monitor_at(island: &WebviewWindow, x: f64, y: f64) -> Option<Monitor> {
    let monitors = island.available_monitors().ok()?;
    monitors.into_iter().find(|m| {
        let p = m.position();
        let s = m.size();
        x >= p.x as f64 && x < p.x as f64 + s.width as f64 && y >= p.y as f64 && y < p.y as f64 + s.height as f64
    })
}

// ---------------------------------------------------------------------------
// Remembered settings (small files in the StillLife config folder)
// ---------------------------------------------------------------------------

fn config_file(app: &AppHandle, name: &str) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(name))
}

fn write_config(app: &AppHandle, name: &str, text: &str) {
    if let Some(file) = config_file(app, name) {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, text);
    }
}

fn read_dock(app: &AppHandle) -> (Edge, f64) {
    config_file(app, "island-dock")
        .and_then(|f| std::fs::read_to_string(f).ok())
        .and_then(|text| {
            let mut parts = text.split_whitespace();
            let edge = Edge::parse(parts.next()?)?;
            let along = parts.next()?.parse::<f64>().ok()?;
            Some((edge, along))
        })
        .unwrap_or((Edge::Top, 0.5))
}

// ---------------------------------------------------------------------------
// Island on/off
// ---------------------------------------------------------------------------

/// Switches the island on or off everywhere and remembers the choice.
fn set_island(app: &AppHandle, enabled: bool) {
    app.state::<IslandEnabled>().0.store(enabled, Ordering::SeqCst);

    if let Some(island) = app.get_webview_window("island") {
        let _ = app.emit_to("island", "island-state", IslandState::Rest.name());
        let _ = island.set_ignore_cursor_events(true);
        if enabled {
            let _ = island.show();
        } else {
            let _ = island.hide();
        }
    }

    if let Ok(guard) = app.state::<IslandToggle>().0.lock() {
        if let Some(item) = guard.as_ref() {
            let _ = item.set_checked(enabled);
        }
    }

    if enabled {
        if let Some(file) = config_file(app, "island-off") {
            let _ = std::fs::remove_file(file);
        }
    } else {
        write_config(app, "island-off", "off");
    }

    let _ = app.emit("island-enabled", enabled);
}

// ---------------------------------------------------------------------------
// The watcher
// ---------------------------------------------------------------------------

fn watch_cursor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut state = IslandState::Rest;
        let mut since = Instant::now();

        loop {
            std::thread::sleep(Duration::from_millis(POLL_MS));

            // Switched off: do nothing at all.
            if !app.state::<IslandEnabled>().0.load(Ordering::SeqCst) {
                state = IslandState::Rest;
                continue;
            }
            // Being dragged: let the drag finish first.
            if app.state::<Dragging>().0.load(Ordering::SeqCst) {
                since = Instant::now();
                continue;
            }

            let Some(island) = app.get_webview_window("island") else { continue };
            let Ok(cursor) = island.cursor_position() else { continue };
            let Ok(scale) = island.scale_factor() else { continue };
            let edge = app.state::<Dock>().0.lock().map(|d| d.0).unwrap_or(Edge::Top);

            let on_pill = element_rect(&island, edge, REST_W, REST_H)
                .map(|r| r.contains(cursor.x, cursor.y, PILL_MARGIN * scale))
                .unwrap_or(false);
            let on_glance = element_rect(&island, edge, GLANCE_W, GLANCE_H)
                .map(|r| r.contains(cursor.x, cursor.y, GLANCE_MARGIN * scale))
                .unwrap_or(false);
            let near_plate = element_rect(&island, edge, PLATE_W, PLATE_H)
                .map(|r| r.contains(cursor.x, cursor.y, PLATE_MARGIN * scale))
                .unwrap_or(false);

            let fold_now = app.state::<FoldRequest>().0.swap(false, Ordering::SeqCst);
            let open_now = app.state::<OpenRequest>().0.swap(false, Ordering::SeqCst);

            let next = if fold_now && state != IslandState::Rest {
                Some(IslandState::Rest)
            } else if open_now && state != IslandState::Open {
                Some(IslandState::Open)
            } else {
                match state {
                    IslandState::Rest => on_pill.then_some(IslandState::Glance),
                    IslandState::Glance => {
                        if !on_glance {
                            Some(IslandState::Rest)
                        } else if since.elapsed() >= Duration::from_millis(OPEN_DELAY_MS) {
                            Some(IslandState::Open)
                        } else {
                            None
                        }
                    }
                    IslandState::Open => {
                        if near_plate {
                            since = Instant::now();
                            None
                        } else if since.elapsed() >= Duration::from_millis(CLOSE_DELAY_MS) {
                            Some(IslandState::Rest)
                        } else {
                            None
                        }
                    }
                }
            };

            if let Some(next) = next {
                // Resting: clicks pass straight through. Glance/open: the pill can be
                // clicked or dragged, and the plate used.
                let _ = island.set_ignore_cursor_events(next == IslandState::Rest);
                state = next;
                since = Instant::now();
                let _ = app.emit_to("island", "island-state", next.name());
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Commands called from the pages
// ---------------------------------------------------------------------------

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Called from the plate's "Open full window" button.
#[tauri::command]
fn open_full_window(app: AppHandle, fold: tauri::State<'_, FoldRequest>) {
    fold.0.store(true, Ordering::SeqCst);
    show_main(&app);
}

/// Opens a doc from the plate in the full window, and folds the plate away.
#[tauri::command]
fn open_doc(app: AppHandle, fold: tauri::State<'_, FoldRequest>, id: String) {
    fold.0.store(true, Ordering::SeqCst);
    show_main(&app);
    let _ = app.emit_to("main", "open-doc", id);
}

/// A click on the pill opens the plate straight away.
#[tauri::command]
fn open_island_now(open: tauri::State<'_, OpenRequest>) {
    open.0.store(true, Ordering::SeqCst);
}

/// Which edge the island is on ("top", "bottom", "left", "right").
#[tauri::command]
fn island_dock(dock: tauri::State<'_, Dock>) -> String {
    dock.0.lock().map(|d| d.0.name().to_string()).unwrap_or_else(|_| "top".into())
}

#[tauri::command]
fn drag_island_start(dragging: tauri::State<'_, Dragging>) {
    dragging.0.store(true, Ordering::SeqCst);
}

/// Moves the island window by (dx, dy) physical pixels while dragging.
#[tauri::command]
fn drag_island_by(app: AppHandle, dx: i32, dy: i32) {
    if let Some(island) = app.get_webview_window("island") {
        if let Ok(pos) = island.outer_position() {
            let _ = island.set_position(PhysicalPosition::new(pos.x + dx, pos.y + dy));
        }
    }
}

/// Drop: snap to the nearest edge of the screen under the cursor and remember it.
#[tauri::command]
fn drag_island_end(app: AppHandle) {
    if let Some(island) = app.get_webview_window("island") {
        if let (Ok(cursor), Ok(size)) = (island.cursor_position(), island.outer_size()) {
            if let Some(mon) = monitor_at(&island, cursor.x, cursor.y) {
                let (mx, my, mw, mh) = usable_area(&mon);
                let to_top = cursor.y - my;
                let to_bottom = my + mh - cursor.y;
                let to_left = cursor.x - mx;
                let to_right = mx + mw - cursor.x;
                let nearest = to_top.min(to_bottom).min(to_left).min(to_right);
                let edge = if nearest == to_top {
                    Edge::Top
                } else if nearest == to_bottom {
                    Edge::Bottom
                } else if nearest == to_left {
                    Edge::Left
                } else {
                    Edge::Right
                };
                let (ww, wh) = (size.width as f64, size.height as f64);
                let along = match edge {
                    Edge::Top | Edge::Bottom => (cursor.x - ww / 2.0 - mx) / (mw - ww).max(1.0),
                    Edge::Left | Edge::Right => (cursor.y - wh / 2.0 - my) / (mh - wh).max(1.0),
                }
                .clamp(0.0, 1.0);

                place_island(&island, &mon, edge, along);
                if let Ok(mut dock) = app.state::<Dock>().0.lock() {
                    *dock = (edge, along);
                }
                write_config(&app, "island-dock", &format!("{} {:.4}", edge.name(), along));
                let _ = app.emit_to("island", "island-dock", edge.name());
            }
        }
    }
    app.state::<Dragging>().0.store(false, Ordering::SeqCst);
}

/// Called from the plate and the full window to switch the island on or off.
#[tauri::command]
fn set_island_enabled(app: AppHandle, enabled: bool) {
    set_island(&app, enabled);
}

/// Lets the full window show the current on/off state.
#[tauri::command]
fn island_enabled(state: tauri::State<'_, IslandEnabled>) -> bool {
    state.0.load(Ordering::SeqCst)
}

/// Where notes are saved on this computer.
fn notes_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("notes.json"))
}

/// The name of this computer, shown in a doc's version history.
#[tauri::command]
fn device_name() -> String {
    for key in ["COMPUTERNAME", "HOSTNAME", "NAME"] {
        if let Ok(name) = std::env::var(key) {
            let name = name.trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "This computer".to_string()
}

/// Returns the saved notes as JSON text ("[]" when there are none yet).
#[tauri::command]
fn load_notes(app: AppHandle) -> String {
    notes_file(&app)
        .and_then(|file| std::fs::read_to_string(file).ok())
        .unwrap_or_else(|| "[]".to_string())
}

/// Saves the notes safely: writes a temporary file first, keeps the previous version
/// as notes.bak.json, then swaps the new file in. Tells every window that notes changed.
#[tauri::command]
fn save_notes(app: AppHandle, window: tauri::Window, data: String) -> Result<(), String> {
    let file = notes_file(&app).ok_or("Could not find the StillLife data folder")?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let temp = file.with_extension("json.tmp");
    std::fs::write(&temp, data).map_err(|e| e.to_string())?;
    if file.exists() {
        let _ = std::fs::copy(&file, file.with_extension("bak.json"));
    }
    std::fs::rename(&temp, &file).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-changed", window.label().to_string());
    Ok(())
}

// ---------------------------------------------------------------------------
// Files, recordings and the few web services StillLife talks to
// ---------------------------------------------------------------------------

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn b64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { B64[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { B64[n as usize & 63] as char } else { '=' });
    }
    out
}

fn b64_decode(text: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;
    for c in text.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            b'=' | b'\n' | b'\r' | b' ' => continue,
            _ => return Err("The file data was damaged".into()),
        } as u32;
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8 & 0xff);
        }
    }
    Ok(out)
}

/// Keeps a file name simple and safe for Windows.
fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { '-' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').to_string();
    if trimmed.is_empty() { "StillLife file".to_string() } else { trimmed.chars().take(120).collect() }
}

fn export_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?.join("StillLife");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Saves an exported doc (or a backup) into Downloads\StillLife and returns where it went.
/// `data` is plain text, or base64 when `binary` is true. Never overwrites an existing file.
#[tauri::command]
fn export_file(app: AppHandle, name: String, data: String, binary: bool) -> Result<String, String> {
    let dir = export_dir(&app)?;
    let name = safe_name(&name);
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (name[..i].to_string(), name[i..].to_string()),
        _ => (name.clone(), String::new()),
    };
    let mut path = dir.join(&name);
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{} ({}){}", stem, n, ext));
        n += 1;
    }
    let bytes = if binary { b64_decode(&data)? } else { data.into_bytes() };
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Opens File Explorer with an exported file selected.
#[tauri::command]
fn reveal_file(app: AppHandle, path: String) -> Result<(), String> {
    let dir = export_dir(&app)?;
    let target = std::path::PathBuf::from(&path);
    if !target.starts_with(&dir) {
        return Err("Only StillLife exports can be shown".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = target;
    }
    Ok(())
}

fn media_file(app: &AppHandle, id: &str) -> Result<std::path::PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Bad recording name".into());
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("media");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{}.bin", id)))
}

/// Keeps a lecture recording next to the notes (recordings are too big for notes.json).
#[tauri::command]
fn save_media(app: AppHandle, id: String, data: String) -> Result<(), String> {
    let file = media_file(&app, &id)?;
    std::fs::write(file, b64_decode(&data)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_media(app: AppHandle, id: String) -> Result<String, String> {
    let file = media_file(&app, &id)?;
    let bytes = std::fs::read(file).map_err(|_| "This recording couldn't be found".to_string())?;
    Ok(b64_encode(&bytes))
}

#[tauri::command]
fn delete_media(app: AppHandle, id: String) -> Result<(), String> {
    let file = media_file(&app, &id)?;
    let _ = std::fs::remove_file(file);
    Ok(())
}

/// Talks to the small set of online services StillLife uses (translation, dictionary,
/// running code). Anything else is refused.
#[tauri::command]
async fn web_request(url: String, body: Option<String>) -> Result<String, String> {
    const ALLOWED: [&str; 3] = [
        "https://api.mymemory.translated.net/",
        "https://api.dictionaryapi.dev/",
        "https://wandbox.org/api/",
    ];
    if !ALLOWED.iter().any(|a| url.starts_with(a)) {
        return Err("StillLife doesn't connect to that address".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout(Duration::from_secs(25))
            .user_agent("StillLife")
            .build();
        let result = match body {
            Some(b) => agent.post(&url).set("Content-Type", "application/json").send_string(&b),
            None => agent.get(&url).call(),
        };
        match result {
            Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
            Err(ureq::Error::Status(404, resp)) => Ok(resp.into_string().unwrap_or_default()),
            Err(ureq::Error::Status(code, _)) => Err(format!("The service answered with error {}", code)),
            Err(e) => Err(format!("Couldn't connect: {}", e)),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FoldRequest(AtomicBool::new(false)))
        .manage(OpenRequest(AtomicBool::new(false)))
        .manage(Dragging(AtomicBool::new(false)))
        .manage(IslandEnabled(AtomicBool::new(true)))
        .manage(IslandToggle(Mutex::new(None)))
        .manage(Dock(Mutex::new((Edge::Top, 0.5))))
        .invoke_handler(tauri::generate_handler![
            open_full_window,
            open_doc,
            open_island_now,
            island_dock,
            drag_island_start,
            drag_island_by,
            drag_island_end,
            set_island_enabled,
            island_enabled,
            load_notes,
            save_notes,
            device_name,
            export_file,
            reveal_file,
            save_media,
            load_media,
            delete_media,
            web_request
        ])
        .setup(|app| {
            // Remembered choices from last time.
            let enabled = config_file(app.handle(), "island-off")
                .map(|f| !f.exists())
                .unwrap_or(true);
            app.state::<IslandEnabled>().0.store(enabled, Ordering::SeqCst);
            let (edge, along) = read_dock(app.handle());
            if let Ok(mut dock) = app.state::<Dock>().0.lock() {
                *dock = (edge, along);
            }

            // Tray icon, so StillLife can keep running with the main window closed.
            let open_item = MenuItem::with_id(app, "open", "Open StillLife", true, None::<&str>)?;
            let island_item =
                CheckMenuItem::with_id(app, "island", "Show island", true, enabled, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit StillLife", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &island_item, &quit_item])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("StillLife")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "island" => {
                        let now = app.state::<IslandEnabled>().0.load(Ordering::SeqCst);
                        set_island(app, !now);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            if let Ok(mut guard) = app.state::<IslandToggle>().0.lock() {
                *guard = Some(island_item.clone());
            }

            // Start the island resting and click-through, on its remembered edge.
            if let Some(island) = app.get_webview_window("island") {
                let _ = island.set_ignore_cursor_events(true);
                if let Ok(Some(mon)) = island.primary_monitor() {
                    place_island(&island, &mon, edge, along);
                }
                if !enabled {
                    let _ = island.hide();
                }
            }

            watch_cursor(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window only hides it.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running StillLife");
}
