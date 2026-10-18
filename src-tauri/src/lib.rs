//! StillLife — v0.2.1
//!
//! Two windows:
//! - "main":   the full StillLife window. Closing it hides it; StillLife keeps running in the tray.
//! - "island": a transparent, always-on-top strip at the top-centre of the screen.
//!             It is click-through while resting, so it never blocks other apps.
//!
//! A light background watcher checks where the cursor is. When it touches the top
//! edge near the middle, the island grows ("glance"); if the cursor stays there for a
//! moment, it opens into the glass plate ("open"). Moving away folds it back up.
//!
//! The island can be switched off completely (tray menu, the plate, or the full window),
//! e.g. before an exam. The choice is remembered after a restart.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow, WindowEvent, Wry};

/// Set when the plate asks to fold up straight away (e.g. after opening the full window).
struct FoldRequest(AtomicBool);
/// Whether the island is switched on.
struct IslandEnabled(AtomicBool);
/// The tray's "Show island" tick box, kept so it can follow changes made elsewhere.
struct IslandToggle(Mutex<Option<CheckMenuItem<Wry>>>);

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

/// How often the watcher checks the cursor.
const POLL_MS: u64 = 40;
/// How long the cursor rests at the top before the plate opens.
const OPEN_DELAY_MS: u64 = 350;
/// How long the cursor can be away from the plate before it folds up.
const CLOSE_DELAY_MS: u64 = 200;
/// Distance from the top edge that counts as "touching" it (logical pixels).
const TOP_EDGE: f64 = 3.0;
/// While glancing, the cursor may drift this far down without closing (logical pixels).
const GLANCE_DEPTH: f64 = 80.0;
/// Half the width of the trigger zone, centred on the screen (logical pixels).
/// Keeps browser tabs and window buttons in the corners free.
const CENTRE_HALF_WIDTH: f64 = 320.0;
/// Extra margin around the open plate before it counts as "left" (logical pixels).
const PLATE_MARGIN: f64 = 24.0;

/// Places the island at the top-centre of the given monitor area.
fn place_island(island: &WebviewWindow, mon_x: i32, mon_y: i32, mon_width: u32) {
    if let Ok(size) = island.outer_size() {
        let x = mon_x + (mon_width as i32 - size.width as i32) / 2;
        let _ = island.set_position(PhysicalPosition::new(x, mon_y));
    }
}

/// A small marker file: present means "island switched off".
fn island_off_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("island-off"))
}

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

    if let Some(file) = island_off_file(app) {
        if enabled {
            let _ = std::fs::remove_file(&file);
        } else {
            if let Some(dir) = file.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(&file, "off");
        }
    }

    let _ = app.emit("island-enabled", enabled);
}

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

            let Some(island) = app.get_webview_window("island") else {
                continue;
            };
            let Ok(cursor) = island.cursor_position() else {
                continue;
            };
            let Ok(monitors) = island.available_monitors() else {
                continue;
            };

            // The monitor the cursor is on.
            let Some(mon) = monitors.into_iter().find(|m| {
                let p = m.position();
                let s = m.size();
                cursor.x >= p.x as f64
                    && cursor.x < p.x as f64 + s.width as f64
                    && cursor.y >= p.y as f64
                    && cursor.y < p.y as f64 + s.height as f64
            }) else {
                continue;
            };

            let scale = mon.scale_factor();
            let mon_pos = *mon.position();
            let mon_size = *mon.size();
            let centre_x = mon_pos.x as f64 + mon_size.width as f64 / 2.0;
            let in_centre = (cursor.x - centre_x).abs() <= CENTRE_HALF_WIDTH * scale;
            let from_top = cursor.y - mon_pos.y as f64;

            let touching_top = in_centre && from_top <= TOP_EDGE * scale;
            let near_top = in_centre && from_top <= GLANCE_DEPTH * scale;

            let near_plate = match (island.outer_position(), island.outer_size()) {
                (Ok(p), Ok(s)) => {
                    let m = PLATE_MARGIN * scale;
                    cursor.x >= p.x as f64 - m
                        && cursor.x <= p.x as f64 + s.width as f64 + m
                        && cursor.y >= p.y as f64 - m
                        && cursor.y <= p.y as f64 + s.height as f64 + m
                }
                _ => false,
            };

            let fold_now = app.state::<FoldRequest>().0.swap(false, Ordering::SeqCst);

            let next = if fold_now && state != IslandState::Rest {
                Some(IslandState::Rest)
            } else {
                match state {
                    IslandState::Rest => touching_top.then_some(IslandState::Glance),
                    IslandState::Glance => {
                        if !near_top {
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
                if next == IslandState::Glance {
                    // Follow the cursor to whichever screen it is on.
                    place_island(&island, mon_pos.x, mon_pos.y, mon_size.width);
                }
                // Only the open plate takes clicks; otherwise clicks pass straight through.
                let _ = island.set_ignore_cursor_events(next != IslandState::Open);
                state = next;
                since = Instant::now();
                let _ = app.emit_to("island", "island-state", next.name());
            }
        }
    });
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FoldRequest(AtomicBool::new(false)))
        .manage(IslandEnabled(AtomicBool::new(true)))
        .manage(IslandToggle(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_full_window,
            set_island_enabled,
            island_enabled
        ])
        .setup(|app| {
            // Remembered choice from last time.
            let enabled = island_off_file(app.handle())
                .map(|f| !f.exists())
                .unwrap_or(true);
            app.state::<IslandEnabled>().0.store(enabled, Ordering::SeqCst);

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

            // Start the island resting, click-through, at the top-centre of the main screen.
            if let Some(island) = app.get_webview_window("island") {
                let _ = island.set_ignore_cursor_events(true);
                if let Ok(Some(mon)) = island.primary_monitor() {
                    place_island(&island, mon.position().x, mon.position().y, mon.size().width);
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
