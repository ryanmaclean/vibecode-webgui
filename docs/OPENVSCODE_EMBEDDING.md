# OpenVSCode Server Embedding Architecture

## Executive Summary

This document describes the architecture for embedding OpenVSCode Server within the VibeCode Tauri desktop application. The design enables seamless integration of the VS Code web experience directly in the native app, with automatic lifecycle management, port allocation, and process supervision.

**Key Goals:**
- Bundle OpenVSCode Server binary with the Tauri app
- Launch and manage the server process from Rust
- Embed the web UI in the Tauri webview
- Provide robust error handling and recovery
- Support cross-platform deployment (macOS, Linux, Windows)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Application                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Main Window (Webview)                  │  │
│  │                                                         │  │
│  │   http://127.0.0.1:{port}?tkn={auth_token}            │  │
│  │                                                         │  │
│  │   ┌─────────────────────────────────────────────┐     │  │
│  │   │     OpenVSCode Server Web UI                │     │  │
│  │   │     - File Explorer                          │     │  │
│  │   │     - Editor                                 │     │  │
│  │   │     - Extensions (workspace-rag, etc)       │     │  │
│  │   └─────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Rust Backend (src-tauri)                  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  OpenVSCode Process Manager                      │  │  │
│  │  │  - Launch subprocess                             │  │  │
│  │  │  - Monitor health                                │  │  │
│  │  │  - Auto-restart on crash                         │  │  │
│  │  │  - Graceful shutdown                             │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Port Manager                                    │  │  │
│  │  │  - Find available port (8080-8099 range)        │  │  │
│  │  │  - Detect conflicts                              │  │  │
│  │  │  - Store port in app state                      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Resource Manager                                │  │  │
│  │  │  - Locate bundled binary                         │  │  │
│  │  │  - Setup user directories                        │  │  │
│  │  │  - Install bundled extensions                    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ spawns subprocess
                              ▼
        ┌────────────────────────────────────┐
        │   OpenVSCode Server Process        │
        │   ./code serve-web                 │
        │   --port 8080                      │
        │   --host 127.0.0.1                 │
        │   --connection-token {token}       │
        │   --without-connection-token       │
        │   --user-data-dir {path}           │
        │   --extensions-dir {path}          │
        └────────────────────────────────────┘
```

---

## 1. Binary Bundling Strategy

### 1.1 Directory Structure

```
VibeCode.app/
└── Contents/
    ├── MacOS/
    │   └── vibecode                    # Tauri executable
    └── Resources/
        ├── binaries/
        │   └── vibecode-vm            # Existing VM binary
        ├── openvscode-server/
        │   ├── bin/
        │   │   └── code               # OpenVSCode CLI binary
        │   ├── out/                   # Server runtime
        │   ├── extensions/            # Built-in extensions
        │   └── node_modules/          # Dependencies
        └── extensions/
            └── workspace-rag-1.0.0.vsix  # Bundled extension
```

### 1.2 Build Process Integration

**Update `tauri.conf.json`:**

```json
{
  "bundle": {
    "resources": [
      "binaries/vibecode-vm",
      "openvscode-server/bin/**",
      "openvscode-server/out/**",
      "openvscode-server/extensions/**",
      "openvscode-server/node_modules/**",
      "extensions/**/*.vsix"
    ],
    "externalBin": [
      "binaries/vibecode-vm",
      "openvscode-server/bin/code"
    ]
  }
}
```

**Pre-build Script** (`scripts/bundle-openvscode.sh`):

```bash
#!/usr/bin/env bash
# Bundle OpenVSCode Server for Tauri app
set -euo pipefail

OPENVSCODE_SRC="openvscode-server"
TAURI_RESOURCES="src-tauri/resources/openvscode-server"

echo "📦 Bundling OpenVSCode Server..."

# Clean previous bundle
rm -rf "$TAURI_RESOURCES"
mkdir -p "$TAURI_RESOURCES"

# Build OpenVSCode if needed
if [[ ! -f "$OPENVSCODE_SRC/cli/target/release/code" ]]; then
    echo "🔨 Building OpenVSCode Server..."
    cd "$OPENVSCODE_SRC"
    npm install
    npm run gulp vscode-darwin-arm64  # or appropriate platform
    cd ..
fi

# Copy binary
mkdir -p "$TAURI_RESOURCES/bin"
cp "$OPENVSCODE_SRC/cli/target/release/code" "$TAURI_RESOURCES/bin/"

# Copy runtime (minified)
rsync -a --exclude='*.ts' \
         --exclude='*.map' \
         --exclude='test' \
         --exclude='*.test.js' \
         "$OPENVSCODE_SRC/out/" "$TAURI_RESOURCES/out/"

# Copy essential extensions only
mkdir -p "$TAURI_RESOURCES/extensions"
ESSENTIAL_EXTS=(
    "vscode.typescript-language-features"
    "vscode.json-language-features"
    "vscode.markdown-language-features"
)
for ext in "${ESSENTIAL_EXTS[@]}"; do
    if [[ -d "$OPENVSCODE_SRC/extensions/$ext" ]]; then
        cp -r "$OPENVSCODE_SRC/extensions/$ext" "$TAURI_RESOURCES/extensions/"
    fi
done

# Copy minimal node_modules (production only)
cd "$OPENVSCODE_SRC"
npm prune --production
cd ..
cp -r "$OPENVSCODE_SRC/node_modules" "$TAURI_RESOURCES/"

echo "✅ Bundle complete: $(du -sh $TAURI_RESOURCES)"
```

### 1.3 Size Optimization

**Target:** < 150 MB bundled size

- Strip source maps and tests
- Production-only node_modules
- Compress with UPX (optional): `upx --best code`
- Bundle only essential extensions
- Use shared libraries where possible

---

## 2. Rust Implementation

### 2.1 Module Structure

```
src-tauri/src/
├── openvscode/
│   ├── mod.rs           # Public API
│   ├── process.rs       # Process lifecycle management
│   ├── port.rs          # Port allocation
│   ├── paths.rs         # Resource path resolution
│   └── health.rs        # Health monitoring
└── main.rs
```

### 2.2 Process Manager (`src-tauri/src/openvscode/process.rs`)

```rust
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration};
use tauri::{AppHandle, Manager};

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
        let mut process_guard = self.process.lock().unwrap();

        if let Some(mut child) = process_guard.take() {
            // Try graceful shutdown first (SIGTERM)
            #[cfg(unix)]
            {
                use std::os::unix::process::ExitStatusExt;
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

        for i in 0..30 {  // Try for 30 seconds
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
```

### 2.3 Port Manager (`src-tauri/src/openvscode/port.rs`)

```rust
use std::net::TcpListener;

/// Find an available port in the given range
pub fn find_available_port(start: u16, end: u16) -> Result<u16, String> {
    for port in start..=end {
        if is_port_available(port) {
            return Ok(port);
        }
    }
    Err(format!("No available ports in range {}-{}", start, end))
}

/// Check if a port is available
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Check if a port is in use
pub fn is_port_in_use(port: u16) -> bool {
    !is_port_available(port)
}

/// Get port from existing process (using lsof)
#[cfg(target_os = "macos")]
pub fn get_port_from_process(process_name: &str) -> Option<u16> {
    use std::process::Command;

    let output = Command::new("lsof")
        .args(&["-nP", "-iTCP", "-sTCP:LISTEN"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains(process_name) {
            // Parse port from line like: "code 1234 user TCP *:8080 (LISTEN)"
            if let Some(port_part) = line.split("*:").nth(1) {
                if let Some(port_str) = port_part.split_whitespace().next() {
                    return port_str.parse().ok();
                }
            }
        }
    }

    None
}
```

### 2.4 Path Resolution (`src-tauri/src/openvscode/paths.rs`)

```rust
use std::path::PathBuf;
use tauri::AppHandle;

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
pub fn get_default_workspace(app: &AppHandle) -> Result<String, String> {
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
```

### 2.5 Tauri Commands (`src-tauri/src/openvscode/mod.rs`)

```rust
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
    let manager = state.lock().unwrap();
    manager.start(&app).await
}

/// Stop OpenVSCode Server
#[tauri::command]
pub async fn openvscode_stop(
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<(), String> {
    let manager = state.lock().unwrap();
    manager.stop().await
}

/// Restart OpenVSCode Server
#[tauri::command]
pub async fn openvscode_restart(
    app: AppHandle,
    state: State<'_, Mutex<OpenVSCodeManager>>,
) -> Result<ServerStatus, String> {
    let manager = state.lock().unwrap();
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
```

### 2.6 Main Integration (`src-tauri/src/main.rs`)

```rust
mod openvscode;

use std::sync::Mutex;
use openvscode::OpenVSCodeManager;

fn main() {
    // ... existing setup ...

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(OpenVSCodeManager::new()))
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...

            // OpenVSCode commands
            openvscode::openvscode_start,
            openvscode::openvscode_stop,
            openvscode::openvscode_restart,
            openvscode::openvscode_status,
            openvscode::openvscode_install_extensions,
        ])
        .setup(|app| {
            // ... existing setup ...

            // Auto-start OpenVSCode Server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let manager = app_handle.state::<Mutex<OpenVSCodeManager>>();

                match manager.lock().unwrap().start(&app_handle).await {
                    Ok(status) => {
                        println!("✅ OpenVSCode Server started: {:?}", status);
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to start OpenVSCode Server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2.7 Dependencies (`src-tauri/Cargo.toml`)

```toml
[dependencies]
# ... existing dependencies ...
reqwest = { version = "0.12.24", features = ["blocking", "json"] }
rand = "0.8"
nix = { version = "0.29", features = ["signal", "process"] }
```

---

## 3. Frontend Integration

### 3.1 Loading OpenVSCode in Webview

**Update `tauri.conf.json`:**

```json
{
  "app": {
    "windows": [
      {
        "title": "VibeCode",
        "width": 1400,
        "height": 900,
        "url": "openvscode://start"  // Custom protocol
      }
    ]
  }
}
```

**Loading Screen** (`src/App.tsx`):

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ServerStatus {
  running: boolean;
  port?: number;
  url?: string;
  startup_time?: number;
}

function App() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startServer();
  }, []);

  const startServer = async () => {
    try {
      setLoading(true);
      setError(null);

      // Start OpenVSCode Server
      const serverStatus = await invoke<ServerStatus>('openvscode_start');
      setStatus(serverStatus);

      // Install bundled extensions
      await invoke('openvscode_install_extensions');

      // Redirect to OpenVSCode URL
      if (serverStatus.url) {
        window.location.href = serverStatus.url;
      }
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <h1>Starting VibeCode...</h1>
        <p>Initializing OpenVSCode Server</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>Failed to Start</h1>
        <p>{error}</p>
        <button onClick={startServer}>Retry</button>
      </div>
    );
  }

  return null; // Will redirect to OpenVSCode URL
}

export default App;
```

### 3.2 Direct Webview Approach

Alternatively, load OpenVSCode directly without a loading screen:

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    invoke<ServerStatus>('openvscode_start')
      .then(status => {
        if (status.url) {
          setServerUrl(status.url);
        }
      })
      .catch(err => console.error('Failed to start server:', err));
  }, []);

  if (!serverUrl) {
    return <div>Loading...</div>;
  }

  return (
    <iframe
      src={serverUrl}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="OpenVSCode Server"
    />
  );
}
```

---

## 4. Error Handling & Recovery

### 4.1 Crash Detection & Auto-Restart

```rust
use tokio::time::{interval, Duration};

impl OpenVSCodeManager {
    /// Monitor process health and restart if crashed
    pub async fn monitor_health(self: Arc<Self>, app: AppHandle) {
        let mut check_interval = interval(Duration::from_secs(5));

        loop {
            check_interval.tick().await;

            let mut process_guard = self.process.lock().unwrap();

            if let Some(child) = process_guard.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        // Process exited
                        eprintln!("⚠️  OpenVSCode Server crashed: {:?}", status);
                        drop(process_guard); // Release lock

                        // Auto-restart
                        if let Err(e) = self.start(&app).await {
                            eprintln!("❌ Failed to restart: {}", e);
                        }
                    }
                    Ok(None) => {
                        // Still running
                    }
                    Err(e) => {
                        eprintln!("❌ Error checking process: {}", e);
                    }
                }
            }
        }
    }
}
```

Start monitor in `main.rs`:

```rust
.setup(|app| {
    let app_handle = app.handle().clone();
    let manager = app.state::<Mutex<OpenVSCodeManager>>();
    let manager_clone = Arc::new(manager.lock().unwrap().clone());

    tauri::async_runtime::spawn(async move {
        manager_clone.monitor_health(app_handle).await;
    });

    Ok(())
})
```

### 4.2 Port Conflict Resolution

```rust
pub async fn start(&self, app: &AppHandle) -> Result<ServerStatus, String> {
    // Check if port 8080 is already in use by our process
    if let Some(existing_port) = port::get_port_from_process("code") {
        // Check if it's responsive
        if self.check_health(existing_port).await {
            return Ok(ServerStatus {
                running: true,
                port: Some(existing_port),
                url: Some(format!("http://127.0.0.1:{}", existing_port)),
                ..Default::default()
            });
        }
    }

    // Find new port
    let port = port::find_available_port(8080, 8099)?;
    // ... continue with start
}
```

### 4.3 Graceful Shutdown

```rust
impl Drop for OpenVSCodeManager {
    fn drop(&mut self) {
        // Ensure cleanup on drop
        if let Some(mut child) = self.process.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
```

Register shutdown handler in `main.rs`:

```rust
use tauri::RunEvent;

.run(tauri::generate_context!())
.map(|mut app| {
    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            // Cleanup OpenVSCode Server
            let manager = app_handle.state::<Mutex<OpenVSCodeManager>>();
            tauri::async_runtime::block_on(async {
                let _ = manager.lock().unwrap().stop().await;
            });
        }
    })
})
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_allocation() {
        let port = port::find_available_port(8080, 8099).unwrap();
        assert!(port >= 8080 && port <= 8099);
    }

    #[test]
    fn test_token_generation() {
        let token = generate_token();
        assert_eq!(token.len(), 32);
    }

    #[tokio::test]
    async fn test_server_lifecycle() {
        // Test requires bundled binary
    }
}
```

### 5.2 Integration Tests

```bash
#!/usr/bin/env bash
# Test OpenVSCode embedding

echo "🧪 Testing OpenVSCode Embedding..."

# 1. Build Tauri app
npm run tauri build

# 2. Start app
open target/release/bundle/macos/VibeCode.app &
APP_PID=$!

# 3. Wait for server
sleep 10

# 4. Check if server is running
if lsof -nP -iTCP:8080 -sTCP:LISTEN | grep -q "code"; then
    echo "✅ Server is running"
else
    echo "❌ Server not running"
    exit 1
fi

# 5. Test HTTP endpoint
if curl -s http://127.0.0.1:8080/healthz | grep -q "ok"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

# 6. Cleanup
kill $APP_PID
```

---

## 6. Performance Considerations

### 6.1 Cold Start Optimization

**Target:** < 3 seconds from launch to ready

1. **Pre-compile resources:** Use `vscode-web` compiled output
2. **Lazy loading:** Load extensions on-demand
3. **Process pooling:** Keep warm process in background (optional)
4. **Binary size:** Optimize with UPX, strip symbols

### 6.2 Memory Management

- Monitor RSS/heap usage
- Set Node.js memory limits: `--max-old-space-size=512`
- Periodic garbage collection

### 6.3 Resource Bundling

**Estimated Sizes:**
- OpenVSCode binary: 50 MB
- Runtime (out/): 80 MB
- Essential extensions: 20 MB
- Total: ~150 MB

---

## 7. Security Considerations

### 7.1 Connection Token

- Generate random 32-character token on each start
- Pass via URL query parameter: `?tkn={token}`
- Server validates all requests

### 7.2 Localhost Binding

- Bind only to `127.0.0.1` (never `0.0.0.0`)
- Prevent network access from outside

### 7.3 CSP Updates

Update `tauri.conf.json`:

```json
{
  "security": {
    "csp": "default-src 'self'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*"
  }
}
```

---

## 8. Deployment Checklist

- [ ] Build OpenVSCode Server for target platform
- [ ] Run `scripts/bundle-openvscode.sh`
- [ ] Update `tauri.conf.json` resources
- [ ] Test on clean VM (no existing installation)
- [ ] Verify auto-start works
- [ ] Test crash recovery
- [ ] Check binary size (< 200 MB total)
- [ ] Test with bundled extensions
- [ ] Verify Datadog tracing
- [ ] Document known issues

---

## 9. Known Limitations

1. **Platform-specific builds:** Need separate builds for macOS/Linux/Windows
2. **Node.js dependency:** Requires bundled Node.js runtime
3. **Extension compatibility:** Some extensions may not work in embedded mode
4. **Update mechanism:** No auto-update for bundled OpenVSCode (manual rebuild required)

---

## 10. Future Enhancements

1. **Hot reload:** Detect binary updates and restart automatically
2. **Multi-workspace:** Support multiple OpenVSCode instances
3. **Remote sync:** Sync settings/extensions to cloud
4. **Extension marketplace:** Built-in extension browser
5. **Performance profiling:** Built-in perf monitoring dashboard

---

## References

- [OpenVSCode Server Docs](https://github.com/gitpod-io/openvscode-server)
- [Tauri Process Management](https://tauri.app/v1/guides/features/command/)
- [Tauri Resource Bundling](https://tauri.app/v1/guides/building/resources/)
- [VS Code Extension API](https://code.visualstudio.com/api)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Author:** VibeCode Team
