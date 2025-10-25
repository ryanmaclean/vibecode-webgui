// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker;
mod mdns;
mod menu;

// use tauri::Manager; // Removed unused import

fn main() {
    // Initialize Datadog tracing for local agent
    std::env::set_var("DD_TRACE_ENABLED", "true");
    std::env::set_var("DD_TRACE_AGENT_URL", "http://localhost:8126");
    std::env::set_var("DD_DOGSTATSD_URL", "localhost:8125");
    std::env::set_var("DD_SERVICE", "vibecode-tauri");
    std::env::set_var("DD_ENV", "development");
    std::env::set_var("DD_VERSION", "1.0.0");
    std::env::set_var("DD_TRACE_SAMPLE_RATE", "1.0");
    std::env::set_var("DD_TRACE_ANALYTICS_ENABLED", "true");
    std::env::set_var("DD_TRACE_DEBUG", "true");
    std::env::set_var("DD_TRACE_STARTUP_LOGS", "true");
    std::env::set_var("DD_RUNTIME_METRICS_ENABLED", "true");
    std::env::set_var("DD_LOGS_ENABLED", "true");
    std::env::set_var("DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL", "true");
    
    // Set hostname for tracing
    if let Ok(hostname) = hostname::get() {
        std::env::set_var("DD_HOSTNAME", hostname.to_string_lossy().to_string());
    }

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
            commands::start_vfkit_vm,
            commands::start_containers,
            commands::stop_containers,
            commands::restart_containers,
            commands::start_lima_vm,
            commands::stop_lima_vm,
            commands::status_lima_vm,
            commands::start_code_server,
        ])
        .setup(|app| {
            // Initialize system tray
            if let Err(e) = menu::create_system_tray(app.handle()) {
                eprintln!("Failed to create system tray: {}", e);
            }

            // Start code-server immediately (prefer bundled), then optionally try vfkit
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Start code-server first for fast local UX
                match commands::start_code_server(_app_handle.clone()).await {
                    Ok(msg) => {
                        println!("✅ {}", msg);
                        // Optionally try vfkit VM in the background (non-blocking)
                        if let Err(e) = commands::start_vfkit_vm().await {
                            println!("⚠️  vfkit VM not available: {}", e);
                        }
                    },
                    Err(e) => {
                        eprintln!("❌ Failed to start code-server: {}", e);
                        // As a fallback, still attempt vfkit VM
                        if let Err(e2) = commands::start_vfkit_vm().await {
                            println!("⚠️  vfkit VM not available: {}", e2);
                        }
                    }
                }
            });

            #[cfg(debug_assertions)]
            {
                // Disable devtools in debug mode for cleaner experience
                // let window = app.get_webview_window("main").unwrap();
                // window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
