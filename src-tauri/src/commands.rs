use crate::docker;
use crate::mdns::{DiscoveredService, VibeCodeService};
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

// mDNS/Bonjour Service Discovery Commands

#[command]
pub async fn start_mdns_service(user_name: String, port: u16) -> Result<String, String> {
    let service = VibeCodeService::new(&user_name).map_err(|e| e.to_string())?;

    service.advertise(port).map_err(|e| e.to_string())?;

    Ok(format!("Advertising as: {}'s VibeCode on port {}", user_name, port))
}

#[command]
pub async fn discover_vibecode_sessions() -> Result<Vec<DiscoveredService>, String> {
    // Create a temporary service instance for discovery
    let service = VibeCodeService::new("discovery").map_err(|e| e.to_string())?;

    service.discover().map_err(|e| e.to_string())
}

#[command]
pub async fn stop_mdns_service(user_name: String) -> Result<String, String> {
    let service = VibeCodeService::new(&user_name).map_err(|e| e.to_string())?;

    service.shutdown().map_err(|e| e.to_string())?;

    Ok("mDNS service stopped".to_string())
}

// Docker Container Lifecycle Commands

#[command]
pub async fn start_containers() -> Result<String, String> {
    docker::start_containers().await
}

#[command]
pub async fn stop_containers() -> Result<String, String> {
    docker::stop_containers().await
}

#[command]
pub async fn restart_containers() -> Result<String, String> {
    docker::restart_containers().await
}

#[command]
pub async fn start_code_server() -> Result<String, String> {
    use std::process::Command;
    
    // Check if code-server is available
    let code_server_check = Command::new("code-server")
        .arg("--version")
        .output();
    
    if code_server_check.is_err() {
        return Err("code-server is not installed. Please install code-server first: brew install code-server".to_string());
    }
    
    // Check if port 8080 is already in use
    let port_check = Command::new("lsof")
        .arg("-ti:8080")
        .output();
    
    if let Ok(output) = port_check {
        if !output.stdout.is_empty() {
            return Ok("code-server is already running on port 8080".to_string());
        }
    }
    
    // Start code-server on port 8080 with automatic trust, theme, and local Datadog tracing
    let mut cmd = Command::new("code-server");
    cmd.arg("--bind-addr")
        .arg("0.0.0.0:8080")
        .arg("--auth")
        .arg("none")
        .arg("--disable-telemetry")
        .arg("--disable-update-check")
        .arg("--disable-workspace-trust")
        .arg("--disable-getting-started-override")
        .arg("--user-data-dir")
        .arg("~/.config/code-server/user-data")
        .arg("--extensions-dir")
        .arg("~/.config/code-server/extensions");
    
    // Add local Datadog tracing (no API key needed for local agent)
    cmd.env("DD_TRACE_ENABLED", "true")
        .env("DD_TRACE_AGENT_URL", "http://localhost:8126")
        .env("DD_DOGSTATSD_URL", "localhost:8125")
        .env("DD_SERVICE", "vibecode-codeserver")
        .env("DD_ENV", "development")
        .env("DD_VERSION", "1.0.0")
        .env("DD_TRACE_SAMPLE_RATE", "1.0")
        .env("DD_TRACE_ANALYTICS_ENABLED", "true")
        .env("DD_TRACE_DEBUG", "true")
        .env("DD_TRACE_STARTUP_LOGS", "true")
        .env("DD_RUNTIME_METRICS_ENABLED", "true")
        .env("DD_LOGS_ENABLED", "true")
        .env("DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL", "true")
        .env("DD_HOSTNAME", hostname::get().unwrap_or_default().to_string_lossy().to_string());
    
    let _output = cmd.arg(".")
        .spawn()
        .map_err(|e| format!("Failed to start code-server: {}", e))?;
    
    Ok("code-server started successfully at http://localhost:8080".to_string())
}
