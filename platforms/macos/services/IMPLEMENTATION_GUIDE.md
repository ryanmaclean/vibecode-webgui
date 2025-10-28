# macOS System Services - Implementation Guide

**Target Audience:** Engineers implementing Agent 28's architecture
**Status:** Ready for Phase 1 implementation
**Last Updated:** 2025-10-02

## Overview

This guide provides step-by-step instructions for implementing the macOS system services architecture designed by Agent 28. Follow the phases in order, as each builds upon the previous.

## Prerequisites

### Development Environment

```bash
# Required tools
xcode-select --install  # Xcode Command Line Tools
brew install rust       # Rust toolchain
brew install swift      # Swift toolchain (included with Xcode)

# Verify installations
rustc --version   # Should be 1.70+
swift --version   # Should be 5.9+
cargo --version   # Should be 1.70+

# Install container runtime (if not already)
brew install --cask container
container version
```

### Project Setup

```bash
# Clone repository
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui/macos-services

# Create directory structure
mkdir -p daemon/src bin xpc/Sources/VibeCodeService ui/Sources tests

# Initialize Rust project for daemon
cd daemon
cargo init --name vibecode-containerd
cd ..

# Initialize Swift package for XPC service
cd xpc
swift package init --type executable --name VibeCodeService
cd ..
```

## Phase 1: Container Daemon (Week 1)

### 1.1 Create Rust Daemon Project

```bash
cd daemon
```

**Edit `Cargo.toml`:**

```toml
[package]
name = "vibecode-containerd"
version = "1.0.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full", "macros"] }
tokio-stream = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
thiserror = "2"
anyhow = "1"
bollard = "0.18"  # Docker/container API
clap = { version = "4", features = ["derive"] }
nix = { version = "0.29", features = ["socket", "signal"] }

# macOS-specific
core-foundation = "0.10"
core-services = "0.3"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
```

### 1.2 Implement Unix Socket Server

**File: `daemon/src/socket_server.rs`:**

```rust
use std::path::Path;
use tokio::net::{UnixListener, UnixStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Request {
    pub command: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize, Serialize)]
pub struct Response {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub struct SocketServer {
    listener: UnixListener,
}

impl SocketServer {
    pub async fn new<P: AsRef<Path>>(socket_path: P) -> Result<Self> {
        // Remove existing socket if present
        let path = socket_path.as_ref();
        if path.exists() {
            std::fs::remove_file(path)?;
        }

        let listener = UnixListener::bind(path)?;

        // Set socket permissions (0600: owner read/write only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(path, permissions)?;
        }

        tracing::info!("Socket server listening on {:?}", path);

        Ok(Self { listener })
    }

    pub async fn run(&self) -> Result<()> {
        loop {
            match self.listener.accept().await {
                Ok((stream, _addr)) => {
                    tokio::spawn(async move {
                        if let Err(e) = handle_client(stream).await {
                            tracing::error!("Client error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    tracing::error!("Accept error: {}", e);
                }
            }
        }
    }
}

async fn handle_client(mut stream: UnixStream) -> Result<()> {
    let mut buffer = vec![0u8; 8192];
    let n = stream.read(&mut buffer).await?;

    if n == 0 {
        return Ok(());
    }

    let request: Request = serde_json::from_slice(&buffer[..n])?;
    tracing::debug!("Received command: {}", request.command);

    let response = match request.command.as_str() {
        "ping" => Response {
            success: true,
            data: Some(serde_json::json!({"pong": true})),
            error: None,
        },
        "start_container" => handle_start_container(request.params).await,
        "stop_container" => handle_stop_container(request.params).await,
        "list_containers" => handle_list_containers().await,
        "get_health" => handle_get_health().await,
        _ => Response {
            success: false,
            data: None,
            error: Some(format!("Unknown command: {}", request.command)),
        },
    };

    let response_data = serde_json::to_vec(&response)?;
    stream.write_all(&response_data).await?;

    Ok(())
}

async fn handle_start_container(params: serde_json::Value) -> Response {
    // Implementation in next step
    Response {
        success: true,
        data: Some(serde_json::json!({"container_id": "test"})),
        error: None,
    }
}

async fn handle_stop_container(params: serde_json::Value) -> Response {
    // Implementation in next step
    Response {
        success: true,
        data: None,
        error: None,
    }
}

async fn handle_list_containers() -> Response {
    // Implementation in next step
    Response {
        success: true,
        data: Some(serde_json::json!([])),
        error: None,
    }
}

async fn handle_get_health() -> Response {
    Response {
        success: true,
        data: Some(serde_json::json!({
            "daemon_running": true,
            "uptime": 3600,
            "container_count": 0,
        })),
        error: None,
    }
}
```

### 1.3 Implement Container Management

**File: `daemon/src/container_manager.rs`:**

```rust
use bollard::Docker;
use bollard::container::{Config, CreateContainerOptions, StartContainerOptions};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerConfig {
    pub name: String,
    pub image: String,
    pub ports: Vec<PortMapping>,
    pub environment: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortMapping {
    pub host_port: u16,
    pub container_port: u16,
}

pub struct ContainerManager {
    docker: Docker,
}

impl ContainerManager {
    pub async fn new() -> Result<Self> {
        // Connect to Apple Container runtime
        let docker = Docker::connect_with_unix(
            "/var/run/container.sock",
            120,
            bollard::API_DEFAULT_VERSION
        )?;

        Ok(Self { docker })
    }

    pub async fn start_container(&self, config: ContainerConfig) -> Result<String> {
        tracing::info!("Starting container: {}", config.name);

        // Create container
        let options = CreateContainerOptions {
            name: config.name.clone(),
            ..Default::default()
        };

        let config = Config {
            image: Some(config.image.clone()),
            // Add port bindings, environment, etc.
            ..Default::default()
        };

        let container = self.docker
            .create_container(Some(options), config)
            .await?;

        // Start container
        self.docker
            .start_container(&container.id, None::<StartContainerOptions<String>>)
            .await?;

        tracing::info!("Container {} started with ID: {}", config.name, container.id);

        Ok(container.id)
    }

    pub async fn stop_container(&self, name: &str) -> Result<()> {
        tracing::info!("Stopping container: {}", name);

        self.docker
            .stop_container(name, None)
            .await?;

        tracing::info!("Container {} stopped", name);

        Ok(())
    }

    pub async fn list_containers(&self) -> Result<Vec<bollard::models::ContainerSummary>> {
        let containers = self.docker
            .list_containers::<String>(None)
            .await?;

        Ok(containers)
    }

    pub async fn get_container_stats(&self, name: &str) -> Result<bollard::container::Stats> {
        // Get real-time stats
        let stats = self.docker
            .stats(name, Some(bollard::container::StatsOptions { stream: false, one_shot: true }))
            .try_collect::<Vec<_>>()
            .await?;

        Ok(stats.first().cloned().unwrap_or_default())
    }
}
```

### 1.4 Implement Main Daemon

**File: `daemon/src/main.rs`:**

```rust
mod socket_server;
mod container_manager;

use anyhow::Result;
use clap::Parser;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "vibecode-containerd")]
#[command(about = "VibeCode container daemon", long_about = None)]
struct Cli {
    #[arg(long, default_value = "/var/run/vibecode-containerd.sock")]
    socket: String,

    #[arg(long, default_value = "/etc/vibecode/containerd.conf")]
    config: String,

    #[arg(long)]
    debug: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    let log_level = if cli.debug { "debug" } else { "info" };
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("vibecode_containerd={}", log_level).into())
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("VibeCode Container Daemon starting");
    tracing::info!("Socket: {}", cli.socket);
    tracing::info!("Config: {}", cli.config);

    // Initialize container manager
    let manager = container_manager::ContainerManager::new().await?;
    tracing::info!("Container manager initialized");

    // Start socket server
    let server = socket_server::SocketServer::new(&cli.socket).await?;
    tracing::info!("Socket server started");

    // Run server (blocks until signal)
    server.run().await?;

    Ok(())
}
```

### 1.5 Test Daemon

```bash
# Build
cargo build --release

# Run daemon (requires root for socket creation)
sudo ./target/release/vibecode-containerd --debug

# In another terminal, test with nc
echo '{"command":"ping","params":{}}' | nc -U /var/run/vibecode-containerd.sock
```

### 1.6 Install LaunchDaemon

```bash
# Copy daemon binary
sudo cp target/release/vibecode-containerd /usr/local/bin/
sudo chmod +x /usr/local/bin/vibecode-containerd

# Install plist
sudo cp ../launchd/com.vibecode.containerd.plist /Library/LaunchDaemons/

# Load daemon
sudo launchctl load /Library/LaunchDaemons/com.vibecode.containerd.plist

# Verify
sudo launchctl print system/com.vibecode.containerd
```

## Phase 2: XPC Service (Week 2)

### 2.1 Create Swift Package

```bash
cd xpc
```

**Edit `Package.swift`:**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeCodeService",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "VibeCodeService",
            targets: ["VibeCodeService"]
        ),
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "VibeCodeService",
            dependencies: [],
            path: "Sources"
        ),
        .testTarget(
            name: "VibeCodeServiceTests",
            dependencies: ["VibeCodeService"],
            path: "Tests"
        ),
    ]
)
```

### 2.2 Implement XPC Service

**File: `xpc/Sources/VibeCodeService.swift`:**

```swift
import Foundation

class VibeCodeService: NSObject, VibeCodeServiceProtocol, NSXPCListenerDelegate {
    private let listener = NSXPCListener.service()
    private var xpcConnection: NSXPCConnection?
    private let daemonClient = DaemonClient()

    override init() {
        super.init()
        listener.delegate = self
        listener.resume()
    }

    // MARK: - NSXPCListenerDelegate

    func listener(
        _ listener: NSXPCListener,
        shouldAcceptNewConnection connection: NSXPCConnection
    ) -> Bool {
        // Validate connection source
        let auditToken = connection.auditToken
        guard validateAuditToken(auditToken) else {
            NSLog("[VibeCodeService] Rejected unauthorized connection")
            return false
        }

        // Configure connection
        connection.exportedInterface = NSXPCInterface(with: VibeCodeServiceProtocol.self)
        connection.exportedObject = self

        connection.invalidationHandler = {
            NSLog("[VibeCodeService] Connection invalidated")
        }

        connection.interruptionHandler = {
            NSLog("[VibeCodeService] Connection interrupted")
        }

        connection.resume()
        xpcConnection = connection

        NSLog("[VibeCodeService] Accepted connection from authorized client")
        return true
    }

    // MARK: - Security Validation

    private func validateAuditToken(_ token: audit_token_t) -> Bool {
        // Get bundle ID from audit token
        var atoken = token
        let task = withUnsafePointer(to: &atoken) { ptr -> SecTask? in
            SecTaskCreateWithAuditToken(nil, ptr.pointee)
        }

        guard let secTask = task else {
            return false
        }

        let bundleID = SecTaskCopyValueForEntitlement(
            secTask,
            kSecCodeInfoIdentifier as CFString,
            nil
        ) as? String

        return bundleID == "com.vibecode.app"
    }

    // MARK: - VibeCodeServiceProtocol Implementation

    func startContainer(
        name: String,
        image: String,
        ports: [Int],
        environment: [String: String],
        reply: @escaping (Bool, Error?) -> Void
    ) {
        Task {
            do {
                let params: [String: Any] = [
                    "name": name,
                    "image": image,
                    "ports": ports,
                    "environment": environment
                ]

                let success = try await daemonClient.sendCommand(
                    command: "start_container",
                    params: params
                )

                reply(success, nil)
            } catch {
                reply(false, error)
            }
        }
    }

    func stopContainer(
        name: String,
        force: Bool,
        reply: @escaping (Bool, Error?) -> Void
    ) {
        Task {
            do {
                let params: [String: Any] = [
                    "name": name,
                    "force": force
                ]

                let success = try await daemonClient.sendCommand(
                    command: "stop_container",
                    params: params
                )

                reply(success, nil)
            } catch {
                reply(false, error)
            }
        }
    }

    func listContainers(
        reply: @escaping ([ContainerInfo], Error?) -> Void
    ) {
        Task {
            do {
                let response = try await daemonClient.sendCommand(
                    command: "list_containers",
                    params: [:]
                )

                // Parse response and convert to ContainerInfo array
                let containers: [ContainerInfo] = []  // Parse from response
                reply(containers, nil)
            } catch {
                reply([], error)
            }
        }
    }

    func getSystemHealth(
        reply: @escaping (SystemHealth, Error?) -> Void
    ) {
        Task {
            do {
                let response = try await daemonClient.sendCommand(
                    command: "get_health",
                    params: [:]
                )

                // Parse response
                let health = SystemHealth.default  // Parse from response
                reply(health, nil)
            } catch {
                reply(SystemHealth.default, error)
            }
        }
    }
}

// Entry point
let service = VibeCodeService()
RunLoop.main.run()
```

### 2.3 Implement Daemon Client

**File: `xpc/Sources/DaemonClient.swift`:**

```swift
import Foundation
import Network

class DaemonClient {
    private let socketPath = "/var/run/vibecode-containerd.sock"

    func sendCommand(command: String, params: [String: Any]) async throws -> [String: Any] {
        let connection = NWConnection(
            to: .unix(path: socketPath),
            using: .tcp
        )

        return try await withCheckedThrowingContinuation { continuation in
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    self.sendRequest(
                        connection: connection,
                        command: command,
                        params: params,
                        continuation: continuation
                    )
                case .failed(let error):
                    continuation.resume(throwing: error)
                default:
                    break
                }
            }

            connection.start(queue: .global())
        }
    }

    private func sendRequest(
        connection: NWConnection,
        command: String,
        params: [String: Any],
        continuation: CheckedContinuation<[String: Any], Error>
    ) {
        let request: [String: Any] = [
            "command": command,
            "params": params
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: request) else {
            continuation.resume(throwing: NSError(domain: "DaemonClient", code: -1))
            return
        }

        connection.send(
            content: data,
            completion: .contentProcessed { error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                self.receiveResponse(connection: connection, continuation: continuation)
            }
        )
    }

    private func receiveResponse(
        connection: NWConnection,
        continuation: CheckedContinuation<[String: Any], Error>
    ) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, error in
            defer { connection.cancel() }

            if let error = error {
                continuation.resume(throwing: error)
                return
            }

            guard let data = data,
                  let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                continuation.resume(throwing: NSError(domain: "DaemonClient", code: -2))
                return
            }

            continuation.resume(returning: response)
        }
    }
}
```

### 2.4 Build and Test XPC Service

```bash
# Build
swift build -c release

# Copy to app bundle (manual for now)
# Will be automated in Phase 3
```

## Phase 3: Native UI (Week 3)

(See `ui/MenuBarApp.swift` from architecture doc)

## Phase 4: Packaging (Week 4)

### 4.1 Create Homebrew Cask

**File: `homebrew-vibecode/Casks/vibecode.rb`:**

```ruby
cask "vibecode" do
  version "1.0.0"
  sha256 :no_check  # Compute actual SHA256 for production

  url "https://github.com/vibecode/releases/download/v#{version}/VibeCode-#{version}-darwin-universal.dmg"
  name "VibeCode"
  desc "AI-Powered Development Environment"
  homepage "https://vibecode.dev"

  depends_on macos: ">= :sonoma"
  depends_on cask: "container"

  app "VibeCode.app"

  postflight do
    system_command "#{staged_path}/install-daemon.sh",
                   sudo: true
  end

  uninstall_postflight do
    system_command "/usr/local/bin/vibecode-service",
                   args: ["stop"],
                   sudo: true
  end

  zap trash: [
    "~/Library/Application Support/com.vibecode",
    "~/Library/Preferences/com.vibecode.app.plist",
    "~/Library/Logs/VibeCode",
  ]
end
```

## Checklist

### Phase 1: Daemon ✅
- [x] Project setup
- [ ] Unix socket server
- [ ] Container management
- [ ] Main daemon
- [ ] LaunchDaemon integration
- [ ] Basic testing

### Phase 2: XPC Service
- [ ] Swift package setup
- [ ] XPC service implementation
- [ ] Daemon client
- [ ] Security validation
- [ ] Integration testing

### Phase 3: Native UI
- [ ] SwiftUI menu bar app
- [ ] Container control UI
- [ ] mDNS integration
- [ ] Preferences panel
- [ ] LaunchAgent integration

### Phase 4: Packaging
- [ ] Homebrew Cask
- [ ] .pkg installer
- [ ] Code signing
- [ ] Notarization

### Phase 5: Monitoring
- [ ] Datadog integration
- [ ] Health monitoring
- [ ] Logging integration

### Phase 6: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

## Troubleshooting

See main README.md for comprehensive troubleshooting guide.

---

**Ready to build production-grade macOS services!**
