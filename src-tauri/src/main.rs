// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker;
mod mdns;
mod menu;

use tauri::Manager;

fn main() {
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
            commands::start_containers,
            commands::stop_containers,
            commands::restart_containers,
            commands::start_code_server,
        ])
        .setup(|app| {
            // Initialize system tray
            if let Err(e) = menu::create_system_tray(app.handle()) {
                eprintln!("Failed to create system tray: {}", e);
            }

            // Start code-server automatically
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match commands::start_code_server().await {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => eprintln!("Failed to start code-server: {}", e),
                }
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
