use crate::docker;
use crate::mdns::{DiscoveredService, VibeCodeService};
use crate::ml::commands as ml_commands;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::command;

const LIMA_PACKAGE_PATH: &str = "swift/lima-launcher";
const LIMA_INSTANCE: &str = "ide-lima";
const LIMA_CONFIG: &str = "vm-assets/ide-lima.yaml";

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

    Ok(format!(
        "Advertising as: {}'s VibeCode on port {}",
        user_name, port
    ))
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

fn run_lima_launcher(args: &[&str]) -> Result<String, String> {
    let output = Command::new("swift")
        .arg("run")
        .arg("--package-path")
        .arg(LIMA_PACKAGE_PATH)
        .arg("lima-launcher")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute swift: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|e| e.to_string())
    } else {
        Err(String::from_utf8(output.stderr).unwrap_or_else(|_| "Unknown error".to_string()))
    }
}

#[command]
pub async fn start_lima_vm() -> Result<String, String> {
    run_lima_launcher(&["start", "--name", LIMA_INSTANCE, "--config", LIMA_CONFIG])
}

#[command]
pub async fn stop_lima_vm() -> Result<String, String> {
    run_lima_launcher(&["stop", "--name", LIMA_INSTANCE])
}

#[command]
pub async fn status_lima_vm() -> Result<String, String> {
    run_lima_launcher(&["status"])
}

#[command]
pub async fn start_vfkit_vm() -> Result<String, String> {
    use std::path::Path;
    use std::process::Command;

    // Get the path to vfkit (system installation)
    let vfkit_path = "/opt/homebrew/bin/vfkit";

    // Check if vfkit is available
    let vfkit_check = Command::new(vfkit_path).arg("--version").output();

    if vfkit_check.is_err() {
        return Err(
            "vfkit is not available. On fresh macOS systems, install with: brew install vfkit"
                .to_string(),
        );
    }

    // Start vfkit VM with Datadog tracing
    let mut cmd = Command::new(vfkit_path);
    cmd.arg("--cpus")
        .arg("2")
        .arg("--memory")
        .arg("2048")
        .arg("--bootloader")
        .arg("linux,initrd=https://github.com/cirruslabs/vfkit/releases/download/v0.0.1/initrd,kernel=https://github.com/cirruslabs/vfkit/releases/download/v0.0.1/vmlinuz");

    // Add Datadog tracing environment variables
    cmd.env("DD_TRACE_ENABLED", "true")
        .env("DD_TRACE_AGENT_URL", "http://localhost:8126")
        .env("DD_DOGSTATSD_URL", "localhost:8125")
        .env("DD_SERVICE", "vibecode-vfkit")
        .env("DD_ENV", "development")
        .env("DD_VERSION", "1.0.0")
        .env("DD_TRACE_SAMPLE_RATE", "1.0")
        .env("DD_TRACE_ANALYTICS_ENABLED", "true")
        .env("DD_TRACE_DEBUG", "true")
        .env("DD_TRACE_STARTUP_LOGS", "true")
        .env("DD_RUNTIME_METRICS_ENABLED", "true")
        .env("DD_LOGS_ENABLED", "true")
        .env("DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL", "true");

    // Set hostname for tracing
    if let Ok(hostname) = hostname::get() {
        cmd.env("DD_HOSTNAME", hostname.to_string_lossy().to_string());
    }

    let _output = cmd
        .spawn()
        .map_err(|e| format!("Failed to start vfkit VM: {}", e))?;

    Ok("vfkit VM started successfully with Datadog tracing".to_string())
}

#[command]
pub async fn start_code_server(_app: tauri::AppHandle) -> Result<String, String> {
    use std::process::Command;

    // 1) Locate code-server: prefer bundled binary inside the app Resources/, then system paths
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Compute macOS Resources path relative to current executable: App.app/Contents/MacOS/vibecode → Contents/Resources
    if let Ok(exe) = std::env::current_exe() {
        if let Some(contents_dir) = exe.parent().and_then(|p| p.parent()) {
            let resources = contents_dir.join("Resources");
            // Common placements
            candidates.push(resources.join("codeserver/bin/code-server"));
            candidates.push(resources.join("openvscode-server/bin/openvscode-server"));
            // When tauri.conf.json uses "resources/codeserver/**" the on-disk path is Resources/resources/codeserver/...
            candidates.push(resources.join("resources/codeserver/bin/code-server"));
            candidates.push(resources.join("resources/openvscode-server/bin/openvscode-server"));
        }
    }

    // System fallbacks
    candidates.push(PathBuf::from("/opt/homebrew/bin/code-server"));
    candidates.push(PathBuf::from("/usr/local/bin/code-server"));
    candidates.push(PathBuf::from("/usr/bin/code-server"));
    candidates.push(PathBuf::from("code-server"));

    let mut chosen: Option<PathBuf> = None;
    for c in candidates {
        let check = Command::new(&c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output();
        if check.is_ok() {
            chosen = Some(c);
            break;
        }
    }

    let code_server_path = chosen.ok_or_else(||
            "code-server not found (bundled or system). Please ensure the app bundle includes codeserver/bin/code-server or install via Homebrew.".to_string()
        )?;

    // 2) If port 8080 is already in use, assume editor is running
    if let Ok(output) = Command::new("lsof").arg("-ti:8080").output() {
        if !output.stdout.is_empty() {
            return Ok("code-server is already running on port 8080".to_string());
        }
    }

    // 3) Expand user dirs for data/extension directories
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let user_data_dir = home.join(".config/code-server/user-data");
    let extensions_dir = home.join(".config/code-server/extensions");
    let workspace = home.join("vibecode/workspaces/default");
    let _ = std::fs::create_dir_all(&user_data_dir);
    let _ = std::fs::create_dir_all(&extensions_dir);
    let _ = std::fs::create_dir_all(&workspace);

    // 4) Launch bound to localhost
    let mut cmd = Command::new(code_server_path);
    cmd.arg("--bind-addr")
        .arg("127.0.0.1:8080")
        .arg("--auth")
        .arg("none")
        .arg("--disable-telemetry")
        .arg("--disable-update-check")
        .arg("--disable-workspace-trust")
        .arg("--disable-getting-started-override")
        .arg("--user-data-dir")
        .arg(user_data_dir)
        .arg("--extensions-dir")
        .arg(extensions_dir)
        .arg(workspace);

    // Datadog local agent environment
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
        .env(
            "DD_HOSTNAME",
            hostname::get()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        );

    cmd.spawn()
        .map_err(|e| format!("Failed to start code-server: {}", e))?;
    Ok("code-server started successfully at http://127.0.0.1:8080".to_string())
}
