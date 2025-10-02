// Prevents additional console window on Windows in release
#\![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler\![
            commands::greet,
            commands::check_docker,
            commands::get_docker_version,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context\!())
        .expect("error while running tauri application");
}
