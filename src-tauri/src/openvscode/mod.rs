use tauri::{AppHandle, State};
use std::sync::Mutex;

mod process;
mod port;
mod paths;

pub use process::{OpenVSCodeManager, ServerConfig, ServerStatus};

/// Start OpenVSCode Server
#[tauri::command]
pub async fn openvscode_start(
    app: AppHandle,
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<ServerStatus, String> {
    // Clone the manager to avoid holding the lock across await
    let manager = {
        let guard = state.lock().unwrap();
        guard.clone()
    };
    manager.start(&app).await
}

/// Stop OpenVSCode Server
#[tauri::command]
pub async fn openvscode_stop(
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<(), String> {
    let manager = {
        let guard = state.lock().unwrap();
        guard.clone()
    };
    manager.stop().await
}

/// Restart OpenVSCode Server
#[tauri::command]
pub async fn openvscode_restart(
    app: AppHandle,
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<ServerStatus, String> {
    let manager = {
        let guard = state.lock().unwrap();
        guard.clone()
    };
    manager.restart(&app).await
}

/// Get OpenVSCode Server status
#[tauri::command]
pub fn openvscode_status(
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<ServerStatus, String> {
    let manager = state.lock().unwrap();
    Ok(manager.get_status())
}

/// Install bundled extensions
#[tauri::command]
pub fn openvscode_install_extensions(
    app: AppHandle,
) -> Result<Vec<String>, String> {
    paths::install_bundled_extensions(&app)
}
