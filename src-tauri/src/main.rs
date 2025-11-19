// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod browser;
mod commands;
mod docker;
mod mdns;
mod menu;
mod ml;
mod openvscode;
mod vm;

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
        .manage(std::sync::Mutex::new(openvscode::OpenVSCodeManager::new()))
        .invoke_handler(tauri::generate_handler![
            browser::open_browser_window,
            browser::navigate_to,
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
            // ML commands
            ml::commands::ml_is_available,
            ml::commands::ml_get_device_info,
            ml::commands::ml_get_capabilities,
            ml::commands::ml_init,
            // AI commands
            ai::ai_chat,
            ai::ai_complete,
            ai::ai_check_local_models,
            ai::ai_list_models,
            ai::ai_chat_stream,
            ai::mcp_connect,
            ai::mcp_list_tools,
            ai::mcp_call_tool,
            ai::agent_create_task,
            ai::agent_get_status,
            ai::agent_cancel_task,
            // VM commands
            vm::vm_list,
            vm::vm_start_openvscode,
            vm::vm_start,
            vm::vm_stop,
            vm::vm_status,
            vm::vm_setup_first_run,
            // OpenVSCode commands
            openvscode::openvscode_start,
            openvscode::openvscode_stop,
            openvscode::openvscode_restart,
            openvscode::openvscode_status,
            openvscode::openvscode_install_extensions,
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
                match vm::vm_start_openvscode(_app_handle.clone()).await {
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
