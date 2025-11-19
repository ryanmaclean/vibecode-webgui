use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub connection_token: Option<String>,
    pub user_data_dir: String,
    pub extensions_dir: String,
    pub workspace_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
    pub url: Option<String>,
    pub startup_time: Option<u64>,
}

#[derive(Clone)]
pub struct OpenVSCodeManager {
    process: Arc<Mutex<Option<Child>>>,
    config: Arc<Mutex<Option<ServerConfig>>>,
    status: Arc<Mutex<ServerStatus>>,
}

impl OpenVSCodeManager {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(ServerStatus {
                running: false,
                port: None,
                pid: None,
                url: None,
                startup_time: None,
            })),
        }
    }

    /// Start OpenVSCode Server
    pub async fn start(&self, app: &AppHandle) -> Result<ServerStatus, String> {
        // Check if already running
        if self.is_running() {
            return Ok(self.get_status());
        }

        // 1. Find available port
        let port = crate::openvscode::port::find_available_port(8080, 8099)
            .map_err(|e| format!("Failed to find available port: {}", e))?;

        // 2. Locate binary
        let binary_path = crate::openvscode::paths::get_openvscode_binary(app)?;

        // 3. Setup directories
        let user_data_dir = crate::openvscode::paths::get_user_data_dir(app)?;
        let extensions_dir = crate::openvscode::paths::get_extensions_dir(app)?;
        let workspace_path = crate::openvscode::paths::get_default_workspace(app)?;

        // 4. Generate connection token for security
        let connection_token = generate_token();

        // 5. Build command
        let mut cmd = Command::new(&binary_path);
        cmd.arg("serve-web")
           .arg("--port").arg(port.to_string())
           .arg("--host").arg("127.0.0.1")
           .arg("--connection-token").arg(&connection_token)
           .arg("--user-data-dir").arg(&user_data_dir)
           .arg("--extensions-dir").arg(&extensions_dir)
           .arg("--disable-telemetry")
           .arg("--disable-update-check")
           .arg(&workspace_path)
           .stdout(Stdio::piped())
           .stderr(Stdio::piped())
           .env("VSCODE_AGENT_FOLDER", user_data_dir.clone());

        // 6. Add Datadog tracing
        self.configure_datadog(&mut cmd);

        // 7. Spawn process
        let start_time = std::time::Instant::now();
        let child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn OpenVSCode Server: {}", e))?;

        let pid = child.id();

        // Store process handle
        *self.process.lock().unwrap() = Some(child);

        // Store config
        let config = ServerConfig {
            port,
            host: "127.0.0.1".to_string(),
            connection_token: Some(connection_token.clone()),
            user_data_dir,
            extensions_dir,
            workspace_path,
        };
        *self.config.lock().unwrap() = Some(config);

        // 8. Wait for server to be ready
        self.wait_for_ready(port).await?;

        let startup_time = start_time.elapsed().as_millis() as u64;
        let url = format!("http://127.0.0.1:{}?tkn={}", port, connection_token);

        // Update status
        let status = ServerStatus {
            running: true,
            port: Some(port),
            pid: Some(pid),
            url: Some(url.clone()),
            startup_time: Some(startup_time),
        };
        *self.status.lock().unwrap() = status.clone();

        println!("✅ OpenVSCode Server started at {} ({}ms)", url, startup_time);

        Ok(status)
    }

    /// Stop OpenVSCode Server
    pub async fn stop(&self) -> Result<(), String> {
        // Take the child process out of the mutex
        let mut child_opt = {
            let mut process_guard = self.process.lock().unwrap();
            process_guard.take()
        };

        if let Some(mut child) = child_opt.take() {
            // Try graceful shutdown first (SIGTERM)
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;

                let pid = Pid::from_raw(child.id() as i32);
                let _ = kill(pid, Signal::SIGTERM);

                // Wait up to 5 seconds for graceful shutdown
                for _ in 0..50 {
                    match child.try_wait() {
                        Ok(Some(_)) => break,
                        Ok(None) => sleep(Duration::from_millis(100)).await,
                        Err(_) => break,
                    }
                }
            }

            // Force kill if still running
            let _ = child.kill();
            let _ = child.wait();

            println!("🛑 OpenVSCode Server stopped");
        }

        // Clear status
        *self.status.lock().unwrap() = ServerStatus {
            running: false,
            port: None,
            pid: None,
            url: None,
            startup_time: None,
        };

        Ok(())
    }

    /// Restart OpenVSCode Server
    pub async fn restart(&self, app: &AppHandle) -> Result<ServerStatus, String> {
        self.stop().await?;
        sleep(Duration::from_secs(1)).await;
        self.start(app).await
    }

    /// Check if server is running
    pub fn is_running(&self) -> bool {
        self.status.lock().unwrap().running
    }

    /// Get current status
    pub fn get_status(&self) -> ServerStatus {
        self.status.lock().unwrap().clone()
    }

    /// Wait for server to be ready
    async fn wait_for_ready(&self, port: u16) -> Result<(), String> {
        let client = reqwest::Client::new();
        let health_url = format!("http://127.0.0.1:{}/healthz", port);

        for _i in 0..30 {  // Try for 30 seconds
            match client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    return Ok(());
                }
                _ => {
                    sleep(Duration::from_secs(1)).await;
                }
            }
        }

        Err("Server failed to start within 30 seconds".to_string())
    }

    /// Configure Datadog tracing
    fn configure_datadog(&self, cmd: &mut Command) {
        cmd.env("DD_TRACE_ENABLED", "true")
           .env("DD_TRACE_AGENT_URL", "http://localhost:8126")
           .env("DD_DOGSTATSD_URL", "localhost:8125")
           .env("DD_SERVICE", "vibecode-openvscode")
           .env("DD_ENV", "development")
           .env("DD_VERSION", "1.0.0");
    }
}

impl Drop for OpenVSCodeManager {
    fn drop(&mut self) {
        // Ensure cleanup on drop
        if let Some(mut child) = self.process.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Generate secure random token
fn generate_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();

    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}
