// Menu bar module for macOS system tray integration
// Provides system tray menu with docker service control actions

use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;

/// Creates and configures the system tray menu
///
/// Menu structure:
/// - Open VibeCode
/// - Separator
/// - Start Services
/// - Stop Services
/// - Restart Services
/// - Separator
/// - Quit
pub fn create_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "Open VibeCode", true, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "start", "Start Services", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "Stop Services", true, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart", "Restart Services", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &PredefinedMenuItem::separator(app)?,
            &start_item,
            &stop_item,
            &restart_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(handle_menu_event)
        .build(app)?;

    Ok(())
}

/// Handles menu item click events from the system tray
///
/// Events:
/// - "open": Shows and focuses the main window
/// - "start": Emits "start-services" event to frontend
/// - "stop": Emits "stop-services" event to frontend
/// - "restart": Emits "restart-services" event to frontend
/// - "quit": Exits the application
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.show() {
                    eprintln!("Failed to show window: {}", e);
                }
                if let Err(e) = window.set_focus() {
                    eprintln!("Failed to focus window: {}", e);
                }
            }
        }
        "start" => {
            if let Err(e) = app.emit("start-services", ()) {
                eprintln!("Failed to emit start-services event: {}", e);
            }
        }
        "stop" => {
            if let Err(e) = app.emit("stop-services", ()) {
                eprintln!("Failed to emit stop-services event: {}", e);
            }
        }
        "restart" => {
            if let Err(e) = app.emit("restart-services", ()) {
                eprintln!("Failed to emit restart-services event: {}", e);
            }
        }
        "quit" => {
            std::process::exit(0);
        }
        _ => {
            eprintln!("Unknown menu item: {:?}", event.id);
        }
    }
}
