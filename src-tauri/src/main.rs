// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker;
mod mdns;
mod logging;

use tauri::Manager;

fn main() {
    // Initialize native macOS observability (Agent 27)
    if let Err(e) = logging::init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    }

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "VibeCode Tauri application starting"
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::ping,
            commands::launch_browser,
            commands::check_docker,
            commands::get_docker_version,
            commands::get_docker_status,
            commands::get_docker_info,
            commands::start_mdns_service,
            commands::discover_vibecode_sessions,
            commands::stop_mdns_service,
        ])
        .setup(|app| {
            tracing::info!("Tauri setup complete");

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                tracing::debug!("DevTools opened");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    tracing::info!("VibeCode Tauri application shutting down");
}
