use crate::docker;
use tauri::command;

#[command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to VibeCode.", name)
}

#[command]
pub fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

#[command]
pub async fn launch_browser(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("cmd")
            .args(&["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
        Ok(())
    }
}

#[command]
pub async fn check_docker() -> Result<bool, String> {
    docker::check_docker_available().await
}

#[command]
pub async fn get_docker_version() -> Result<String, String> {
    docker::get_docker_version().await
}

#[command]
pub async fn get_docker_status() -> Result<serde_json::Value, String> {
    let available = docker::check_docker_available().await?;
    let version = if available {
        docker::get_docker_version().await.ok()
    } else {
        None
    };

    Ok(serde_json::json!({
        "available": available,
        "version": version,
    }))
}

#[command]
pub async fn get_docker_info() -> Result<serde_json::Value, String> {
    docker::get_docker_info().await
}
