use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get path to bundled OpenVSCode binary
pub fn get_openvscode_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    #[cfg(target_os = "macos")]
    let binary_path = resource_path
        .join("openvscode-server")
        .join("bin")
        .join("code");

    #[cfg(target_os = "windows")]
    let binary_path = resource_path
        .join("openvscode-server")
        .join("bin")
        .join("code.exe");

    #[cfg(target_os = "linux")]
    let binary_path = resource_path
        .join("openvscode-server")
        .join("bin")
        .join("code");

    if !binary_path.exists() {
        return Err(format!(
            "OpenVSCode binary not found at: {}",
            binary_path.display()
        ));
    }

    Ok(binary_path)
}

/// Get user data directory
pub fn get_user_data_dir(app: &AppHandle) -> Result<String, String> {
    let app_data = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let user_data = app_data.join("openvscode").join("user-data");

    std::fs::create_dir_all(&user_data)
        .map_err(|e| format!("Failed to create user data dir: {}", e))?;

    Ok(user_data.to_string_lossy().to_string())
}

/// Get extensions directory
pub fn get_extensions_dir(app: &AppHandle) -> Result<String, String> {
    let app_data = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let extensions = app_data.join("openvscode").join("extensions");

    std::fs::create_dir_all(&extensions)
        .map_err(|e| format!("Failed to create extensions dir: {}", e))?;

    Ok(extensions.to_string_lossy().to_string())
}

/// Get default workspace path
pub fn get_default_workspace(_app: &AppHandle) -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;

    let workspace = home.join("vibecode").join("workspaces").join("default");

    std::fs::create_dir_all(&workspace)
        .map_err(|e| format!("Failed to create workspace dir: {}", e))?;

    Ok(workspace.to_string_lossy().to_string())
}

/// Install bundled extensions on first run
pub fn install_bundled_extensions(app: &AppHandle) -> Result<Vec<String>, String> {
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let bundled_exts = resource_path.join("extensions");
    let extensions_dir = get_extensions_dir(app)?;

    if !bundled_exts.exists() {
        return Ok(vec![]);
    }

    let mut installed = Vec::new();

    for entry in std::fs::read_dir(bundled_exts)
        .map_err(|e| format!("Failed to read extensions: {}", e))? {

        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("vsix") {
            // Install using CLI
            let binary = get_openvscode_binary(app)?;

            let output = std::process::Command::new(&binary)
                .arg("--install-extension")
                .arg(&path)
                .arg("--extensions-dir")
                .arg(&extensions_dir)
                .output()
                .map_err(|e| format!("Failed to install extension: {}", e))?;

            if output.status.success() {
                let name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown");
                installed.push(name.to_string());
            }
        }
    }

    Ok(installed)
}
