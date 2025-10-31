# Swift-Rust FFI Integration Architecture for Phase 4

**Version:** 1.0
**Date:** 2025-10-28
**Author:** Systems Engineering Team
**Platform:** macOS ARM64 (Apple Silicon)

---

## Executive Summary

This document provides a comprehensive architecture for integrating OpenVSCode Server's Rust CLI with a Swift 5 wrapper on macOS. The goal is to enable native process management, IPC communication, and seamless VM orchestration using Apple's Virtualization Framework.

**Key Decisions:**
- **FFI Technology:** swift-bridge (recommended)
- **Communication Pattern:** Hybrid (C FFI + MessagePack RPC)
- **Process Model:** Swift manages VM lifecycle, Rust CLI runs inside VM
- **Integration Point:** Swift wrapper calls Rust library (static linking)

---

## Table of Contents

1. [Rust CLI Analysis](#1-rust-cli-analysis)
2. [FFI Technology Comparison](#2-ffi-technology-comparison)
3. [Architecture Design](#3-architecture-design)
4. [Swift Module Structure](#4-swift-module-structure)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Code Examples](#6-code-examples)
7. [Build System Integration](#7-build-system-integration)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment Considerations](#9-deployment-considerations)
10. [Appendix](#10-appendix)

---

## 1. Rust CLI Analysis

### 1.1 Repository Structure

```
openvscode-server/cli/
├── Cargo.toml                 # Package manifest (code-cli v0.1.0)
├── build.rs                   # Build script
├── src/
│   ├── lib.rs                 # Library exports (auth, commands, tunnels, util, etc.)
│   ├── bin/code/main.rs       # Binary entry point (@tokio::main)
│   ├── commands/              # Command handlers
│   │   ├── serve_web.rs       # Web server implementation
│   │   ├── tunnels.rs         # Tunnel management
│   │   ├── args.rs            # CLI argument parsing (clap)
│   │   └── context.rs         # Command context
│   ├── tunnels/               # Tunnel subsystem
│   │   ├── service_macos.rs   # macOS launchd integration
│   │   └── nosleep_macos.rs   # IOPMAssertion sleep prevention
│   ├── rpc.rs                 # RPC framework (sync/async/duplex methods)
│   ├── util/                  # Utilities
│   └── ...
└── target/release/code        # Built binary (12MB, ARM64 Mach-O)
```

### 1.2 macOS-Specific Code

**File: `tunnels/service_macos.rs`**
- Purpose: Manages OpenVSCode Server as a macOS launchd service
- Key API: `LaunchdService` struct implementing `ServiceManager` trait
- Functions:
  - `register()`: Creates `.plist` file and loads service via `launchctl`
  - `unregister()`: Stops and unloads service
  - `is_installed()`: Checks if service is running
  - `run()`: Runs service container

**File: `tunnels/nosleep_macos.rs`**
- Purpose: Prevents macOS sleep during tunnel operation
- Key API: `SleepInhibitor` struct
- Uses: IOKit's `IOPMAssertionCreateWithName` via FFI
- Assertions:
  - `PreventUserIdleSystemSleep`
  - `PreventSystemSleep`

### 1.3 CLI Entry Points

**Main Entry Point:** `src/bin/code/main.rs`
```rust
#[tokio::main]
async fn main() -> Result<(), std::convert::Infallible> {
    // Parse CLI arguments
    let parsed = parse_args();

    // Execute command
    match parsed {
        Commands::ServeWeb(args) => serve_web::serve_web(context, args).await,
        Commands::Tunnel(args) => tunnels::serve(context, args).await,
        Commands::Status => start_code(context, args).await,
        // ...
    }
}
```

**Key Commands for FFI:**
1. **`serve-web`**: Starts local web version of VS Code
   - Launches HTTP server on specified port
   - Manages multiple concurrent server versions
   - Connection token authentication

2. **`tunnel`**: Creates remote tunnel
   - Registers with Microsoft Dev Tunnels service
   - Manages authentication
   - Service mode (launchd integration)

### 1.4 Public API Surfaces

**Cargo.toml Library Definition:**
```toml
[lib]
name = "cli"
path = "src/lib.rs"
```

**Exported Modules (lib.rs):**
```rust
pub mod auth;
pub mod commands;
pub mod constants;
pub mod log;
pub mod options;
pub mod state;
pub mod tunnels;
pub mod update_service;
pub mod util;
```

**Critical Types for FFI:**
- `commands::ServeWebArgs` - Configuration for web server
- `commands::CommandContext` - Execution context
- `state::LauncherPaths` - Path management
- `log::Logger` - Logging interface
- `rpc::RpcBuilder` - RPC communication

### 1.5 Dependencies Relevant to FFI

```toml
tokio = { version = "1.38.2", features = ["full"] }        # Async runtime
hyper = { version = "0.14.26", features = ["server"] }     # HTTP server
serde = { version = "1.0.163", features = ["derive"] }     # Serialization
serde_json = "1.0.96"                                      # JSON
rmp-serde = "1.1.1"                                        # MessagePack
clap = { version = "4.3.0", features = ["derive"] }        # CLI parsing
core-foundation = "0.9.3"  # macOS-specific (already uses FFI)
```

### 1.6 RPC Framework Analysis

**File: `src/rpc.rs`**

The CLI includes a sophisticated RPC framework for bidirectional communication:

```rust
pub trait Serialization: Send + Sync + 'static {
    fn serialize(&self, value: impl Serialize) -> Vec<u8>;
    fn deserialize<P: DeserializeOwned>(&self, b: &[u8]) -> Result<P, AnyError>;
}

pub struct RpcBuilder<S> {
    serializer: Arc<S>,
    methods: HashMap<&'static str, Method>,
    calls: Arc<Mutex<HashMap<u32, DispatchMethod>>>,
}

pub enum Method {
    Sync(SyncMethod),
    Async(AsyncMethod),
    Duplex(Duplex),
}
```

**Key Insight:** The Rust CLI already has production-grade RPC infrastructure. We can leverage this for Swift<->Rust communication instead of building from scratch.

---

## 2. FFI Technology Comparison

### 2.1 Option 1: swift-bridge (RECOMMENDED)

**Repository:** https://github.com/chinedufn/swift-bridge
**License:** MIT/Apache-2.0
**Maturity:** Production-ready, actively maintained

#### Pros:
- **Code Generation:** Automatic Swift/Rust bindings from annotations
- **Type Safety:** Compile-time checking across language boundary
- **Async Support:** Handles Swift async/await ↔ Rust tokio
- **String Handling:** Automatic Swift String ↔ Rust &str conversion
- **Memory Safety:** Proper ownership transfer, no manual memory management
- **Error Propagation:** Swift errors from Rust Results
- **Closures:** Bidirectional callback support
- **Generics:** Limited generic type support

#### Cons:
- **Learning Curve:** Requires understanding attribute macros
- **Build Complexity:** Additional build step for code generation
- **Debug Symbols:** Can be harder to debug generated code
- **Limited Ecosystem:** Smaller community than UniFFI

#### Example:
```rust
#[swift_bridge::bridge]
mod ffi {
    extern "Rust" {
        type VibeCodeServer;

        #[swift_bridge(associated_to = VibeCodeServer)]
        fn new(port: u16) -> VibeCodeServer;

        #[swift_bridge(associated_to = VibeCodeServer)]
        async fn start(&self) -> Result<(), String>;

        #[swift_bridge(associated_to = VibeCodeServer)]
        async fn stop(&self) -> Result<(), String>;
    }
}
```

Generated Swift:
```swift
public class VibeCodeServer {
    func start() async throws
    func stop() async throws
}
```

### 2.2 Option 2: UniFFI (Mozilla)

**Repository:** https://github.com/mozilla/uniffi-rs
**License:** MPL-2.0
**Maturity:** Production (used in Firefox)

#### Pros:
- **Multi-Language:** Generates Swift, Kotlin, Python bindings
- **IDL-Based:** Interface defined in separate `.udl` file
- **Mozilla Backed:** Strong institutional support
- **Documentation:** Excellent docs and examples
- **Async Support:** Experimental but improving

#### Cons:
- **Separate IDL:** Requires maintaining `.udl` file alongside Rust code
- **Code Duplication:** Type definitions in both Rust and UDL
- **Async Limitations:** Not as mature as swift-bridge for async
- **Heavier Runtime:** Larger runtime overhead
- **Complex Setup:** More moving parts in build system

#### Example:
```rust
// lib.rs
#[derive(uniffi::Object)]
pub struct VibeCodeServer {
    port: u16,
}

#[uniffi::export]
impl VibeCodeServer {
    #[uniffi::constructor]
    fn new(port: u16) -> Self {
        Self { port }
    }

    async fn start(&self) -> Result<(), String> {
        // ...
    }
}

uniffi::include_scaffolding!("vibecode");
```

```udl
// vibecode.udl
namespace vibecode {
    [Error]
    enum VibeCodeError {
        "StartupFailed",
        "AlreadyRunning",
    };
};

[Async]
interface VibeCodeServer {
    constructor(u16 port);
    [Async]
    void start() throws VibeCodeError;
    [Async]
    void stop() throws VibeCodeError;
};
```

### 2.3 Option 3: cbindgen + Manual C FFI

**Repository:** https://github.com/mozilla/cbindgen
**License:** MPL-2.0
**Maturity:** Very stable

#### Pros:
- **Full Control:** Complete control over ABI
- **Minimal Overhead:** Direct C function calls
- **Universal:** Works with any language that supports C FFI
- **Simple Mental Model:** Straightforward C conventions
- **Debugging:** Easy to debug with standard tools

#### Cons:
- **Manual Effort:** Write both Rust and Swift bindings manually
- **No Async:** Must wrap async code in blocking calls
- **Unsafe Code:** Heavy use of unsafe blocks
- **String Handling:** Manual CString/String conversion
- **Memory Management:** Manual ownership tracking
- **Error Handling:** C-style error codes, no Swift errors

#### Example:
```rust
// Rust side
#[no_mangle]
pub extern "C" fn vibecode_server_new(port: u16) -> *mut VibeCodeServer {
    Box::into_raw(Box::new(VibeCodeServer::new(port)))
}

#[no_mangle]
pub extern "C" fn vibecode_server_start(server: *mut VibeCodeServer) -> i32 {
    let server = unsafe { &*server };
    // Block on async...
    match tokio_runtime.block_on(server.start()) {
        Ok(()) => 0,
        Err(_) => -1,
    }
}

#[no_mangle]
pub extern "C" fn vibecode_server_free(server: *mut VibeCodeServer) {
    unsafe { drop(Box::from_raw(server)) };
}
```

```swift
// Swift side (manual)
public class VibeCodeServer {
    private let handle: OpaquePointer

    public init(port: UInt16) {
        handle = vibecode_server_new(port)
    }

    public func start() throws {
        let result = vibecode_server_start(handle)
        guard result == 0 else {
            throw VibeCodeError.startupFailed
        }
    }

    deinit {
        vibecode_server_free(handle)
    }
}
```

### 2.4 Option 4: Raw C FFI (No Code Generation)

Similar to cbindgen but without any tooling. Not recommended for this project.

### 2.5 Technology Decision Matrix

| Criterion | swift-bridge | UniFFI | cbindgen | Raw C FFI |
|-----------|-------------|--------|----------|-----------|
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| Async Support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐ |
| Error Handling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| Code Generation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Learning Curve | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Build Complexity | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Debugging | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Memory Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ |

### 2.6 Final Recommendation: swift-bridge

**Rationale:**
1. **Async-First:** OpenVSCode Server CLI is built on Tokio. swift-bridge handles async natively.
2. **Type Safety:** Reduces entire classes of bugs at compile time
3. **Developer Experience:** Code generation eliminates boilerplate
4. **Memory Safety:** Automatic ownership transfer prevents leaks
5. **Swift Integration:** Generates idiomatic Swift code (classes, async/await, errors)

**Trade-offs Accepted:**
- Slightly more complex build system (acceptable for quality gains)
- Debugging generated code requires understanding the bridge layer

---

## 3. Architecture Design

### 3.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     macOS .app Bundle                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              VibeCode.app (Swift UI)                       │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │           App Delegate / Main View                   │  │ │
│  │  │  • User interaction                                  │  │ │
│  │  │  • Settings management                               │  │ │
│  │  │  • Status display                                    │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │         ↓ calls                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │       VibeCodeCore (Swift Package)                   │  │ │
│  │  │  ┌────────────────────────────────────────────────┐  │  │ │
│  │  │  │  VMOrchestrator (Swift)                        │  │  │ │
│  │  │  │  • VM lifecycle management                     │  │  │ │
│  │  │  │  • Virtualization.framework integration       │  │  │ │
│  │  │  │  • Network/storage setup                      │  │  │ │
│  │  │  └────────────────────────────────────────────────┘  │  │ │
│  │  │         ↓ FFI calls                                    │  │ │
│  │  │  ┌────────────────────────────────────────────────┐  │  │ │
│  │  │  │  OpenVSCodeBridge (swift-bridge generated)     │  │  │ │
│  │  │  │  • Swift → Rust FFI boundary                   │  │  │ │
│  │  │  │  • Type marshalling                            │  │  │ │
│  │  │  │  • Async bridging                              │  │  │ │
│  │  │  └────────────────────────────────────────────────┘  │  │ │
│  │  │         ↓                                              │  │ │
│  │  │  ┌────────────────────────────────────────────────┐  │  │ │
│  │  │  │  libopenvscode_cli.a (Rust static lib)         │  │  │ │
│  │  │  │  • FFI entry points                            │  │  │ │
│  │  │  │  • Rust CLI library (repackaged)               │  │  │ │
│  │  │  │  • Tokio runtime embedded                      │  │  │ │
│  │  │  └────────────────────────────────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          ↓ spawns
┌─────────────────────────────────────────────────────────────────┐
│                Linux VM (Virtualization.framework)               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Alpine Linux (minimal)                                    │ │
│  │  • Kernel: vmlinuz (from VM bundle)                        │ │
│  │  • Init: OpenRC                                            │ │
│  │  • Runtime: Node.js (for OpenVSCode Server)               │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  OpenVSCode Server (Node.js)                         │ │ │
│  │  │  • HTTP server on port 8080                          │ │ │
│  │  │  • Extensions host                                   │ │ │
│  │  │  • Terminal integration                              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          ↑
                    Port forwarding
                    (NAT via Virtualization.framework)
                          ↑
┌─────────────────────────────────────────────────────────────────┐
│              User's Web Browser (localhost:8080)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Communication Flow

#### Scenario 1: Starting OpenVSCode Server

```
[User clicks "Start" in VibeCode.app]
  ↓
[Swift UI Layer]
  ↓ SwiftUI action
[VMOrchestrator.start(port: 8080)]
  ↓
[VMOrchestrator creates VZVirtualMachine with Alpine Linux]
  ↓
[VM boots, network configured (NAT)]
  ↓
[VMOrchestrator calls OpenVSCodeBridge.launchServer(port: 8080)]
  ↓ swift-bridge FFI
[Rust: openvscode_launch_server(port: 8080)]
  ↓
[Rust spawns tokio task]
  ↓
[Rust executes serve_web command internally]
  ↓
[HTTP server starts in Rust, binds to 0.0.0.0:8080]
  ↓ TCP connection via VM NAT
[OpenVSCode Server inside VM receives forwarded connection]
  ↓
[User opens http://localhost:8080 in browser]
```

#### Scenario 2: Stopping OpenVSCode Server

```
[User clicks "Stop" in VibeCode.app]
  ↓
[Swift UI Layer]
  ↓ SwiftUI action
[VMOrchestrator.stop()]
  ↓
[OpenVSCodeBridge.stopServer()]
  ↓ swift-bridge FFI
[Rust: openvscode_stop_server()]
  ↓
[Rust sends graceful shutdown signal]
  ↓
[HTTP server stops]
  ↓
[VMOrchestrator calls vm.stop()]
  ↓
[VZVirtualMachine shuts down Linux guest]
  ↓
[Swift UI updates status: "Stopped"]
```

### 3.3 Component Responsibilities

#### Swift Layer (VibeCodeCore)

**Responsibilities:**
1. **VM Lifecycle Management**
   - Create/configure VZVirtualMachine instances
   - Manage VM state (starting, running, stopping, error)
   - Handle Virtualization.framework delegates
   - Configure VM resources (CPU, memory, storage, network)

2. **Resource Management**
   - Disk image creation/management
   - Network configuration (NAT, port forwarding)
   - Shared directories (VirtioFS)
   - Rosetta integration (for x86_64 support)

3. **User Interface**
   - Display server status
   - Show logs
   - Settings management
   - Error presentation

4. **Process Monitoring**
   - VM health checks
   - Resource usage tracking
   - Crash detection and recovery

**Not Responsible For:**
- OpenVSCode Server process management (delegated to Rust)
- HTTP server implementation (handled by Rust)
- Extension management (handled by OpenVSCode Server)

#### Rust Layer (libopenvscode_cli)

**Responsibilities:**
1. **OpenVSCode Server Management**
   - Start/stop web server
   - Connection token management
   - Version management (download/cache different versions)
   - Update checking

2. **HTTP Server**
   - Hyper-based HTTP server
   - WebSocket support
   - Connection multiplexing
   - TLS/SSL (if needed)

3. **RPC Communication**
   - MessagePack serialization
   - Bidirectional method calls
   - Stream multiplexing

4. **Logging**
   - Structured logging
   - Log level management
   - File/console output

**Not Responsible For:**
- VM creation (handled by Swift)
- macOS-specific UI (handled by Swift)
- .app bundle packaging (handled by Xcode)

### 3.4 Data Flow Patterns

#### Pattern 1: Swift → Rust (Command)

```
Swift: let server = OpenVSCodeServer(port: 8080)
       ↓ swift-bridge marshalling
Rust:  VibeCodeServer::new(8080)
       Creates struct, allocates Tokio runtime
       Returns opaque pointer
       ↓ swift-bridge marshalling
Swift: (receives Swift class wrapping pointer)

Swift: try await server.start()
       ↓ swift-bridge async bridge
Rust:  async fn start(&self) -> Result<(), String>
       Spawns tokio::spawn task
       Starts HTTP server
       ↓ Result
Swift: (async throws if error)
```

#### Pattern 2: Rust → Swift (Callback)

```
Rust:  Server status changed
       ↓ Calls registered callback
       callback(ServerStatus::Running)
       ↓ swift-bridge marshalling
Swift: statusCallback(_: ServerStatus)
       Updates UI via @Published property
       ↓ SwiftUI observation
UI:    View updates automatically
```

#### Pattern 3: Bidirectional Stream (Logs)

```
Swift: for await log in server.streamLogs() {
           print(log)
       }
       ↓ swift-bridge async stream
Rust:  async fn stream_logs(&self) -> impl Stream<Item=String>
       Tails log file
       Yields log lines
       ↓ stream element
Swift: Receives each log line
       Appends to UI
```

### 3.5 Error Handling Strategy

#### Error Propagation

```rust
// Rust side
#[swift_bridge::bridge]
mod ffi {
    extern "Rust" {
        type VibeCodeServer;

        #[swift_bridge(associated_to = VibeCodeServer)]
        async fn start(&self) -> Result<(), ServerError>;
    }

    enum ServerError {
        PortInUse,
        VMNotReady,
        ConfigurationError { message: String },
    }
}

// Implementation
impl VibeCodeServer {
    async fn start(&self) -> Result<(), ServerError> {
        if !self.vm_ready {
            return Err(ServerError::VMNotReady);
        }

        match self.bind_server(self.port).await {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == ErrorKind::AddrInUse => {
                Err(ServerError::PortInUse)
            }
            Err(e) => Err(ServerError::ConfigurationError {
                message: e.to_string()
            })
        }
    }
}
```

```swift
// Swift side (generated by swift-bridge)
public enum ServerError: Error {
    case PortInUse
    case VMNotReady
    case ConfigurationError(message: String)
}

public class VibeCodeServer {
    public func start() async throws {
        // Automatically throws ServerError
    }
}

// Usage
do {
    try await server.start()
} catch ServerError.PortInUse {
    showAlert("Port 8080 is already in use")
} catch ServerError.VMNotReady {
    showAlert("VM is not ready, please wait")
} catch {
    showAlert("Unexpected error: \\(error)")
}
```

### 3.6 Threading and Concurrency

#### Rust Side (Tokio)

```rust
use tokio::runtime::Runtime;
use std::sync::Arc;

pub struct VibeCodeServer {
    runtime: Arc<Runtime>,
    state: Arc<Mutex<ServerState>>,
}

impl VibeCodeServer {
    pub fn new(port: u16) -> Self {
        let runtime = Runtime::new().unwrap();
        Self {
            runtime: Arc::new(runtime),
            state: Arc::new(Mutex::new(ServerState::Stopped)),
        }
    }

    pub async fn start(&self) -> Result<(), ServerError> {
        let state = self.state.clone();

        self.runtime.spawn(async move {
            // Long-running server task
            serve_web_internal(state).await
        });

        Ok(())
    }
}
```

#### Swift Side (Swift Concurrency)

```swift
@MainActor
public class VMOrchestrator: ObservableObject {
    @Published var serverStatus: ServerStatus = .stopped

    private let server: VibeCodeServer

    public func startServer() async throws {
        // Runs on main actor, but Rust work happens on Tokio threads
        try await server.start()

        // Update UI
        serverStatus = .running
    }
}
```

**Thread Safety Guarantees:**
1. Swift main actor → Rust Tokio runtime: Safe (swift-bridge handles)
2. Rust callbacks → Swift main actor: Must dispatch to main queue
3. Shared state: Protected by Rust Mutex/RwLock, Swift actors

---

## 4. Swift Module Structure

### 4.1 Package Organization

```
VibeCodeCore/
├── Package.swift                          # Swift Package Manager manifest
├── Sources/
│   ├── VibeCodeCore/                      # Main module
│   │   ├── VMOrchestrator.swift           # VM lifecycle management
│   │   ├── ServerManager.swift            # OpenVSCode Server management
│   │   ├── ConfigurationManager.swift     # Settings persistence
│   │   ├── LogManager.swift               # Log aggregation
│   │   └── Models/
│   │       ├── ServerConfiguration.swift
│   │       ├── ServerStatus.swift
│   │       └── VMConfiguration.swift
│   │
│   ├── OpenVSCodeBridge/                  # FFI bridge module
│   │   ├── OpenVSCodeBridge.swift         # Swift wrappers (generated)
│   │   └── RustInterop.swift              # Manual helpers
│   │
│   └── COpenVSCode/                       # C module for static lib
│       └── include/
│           └── module.modulemap           # Module map for Clang
│
├── rust/                                  # Rust FFI crate
│   ├── Cargo.toml
│   ├── build.rs                           # Build script (swift-bridge codegen)
│   └── src/
│       ├── lib.rs                         # FFI definitions
│       ├── server.rs                      # Server management
│       └── bridge.rs                      # swift-bridge module
│
├── Tests/
│   └── VibeCodeCoreTests/
│       ├── VMOrchestratorTests.swift
│       └── ServerManagerTests.swift
│
└── Resources/
    ├── vmlinuz                            # Linux kernel (ARM64)
    ├── initrd                             # Initial RAM disk
    └── alpine-base.img                    # Base Alpine Linux image
```

### 4.2 Package.swift

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeCodeCore",
    platforms: [
        .macOS(.v14) // Required for Virtualization.framework
    ],
    products: [
        .library(
            name: "VibeCodeCore",
            targets: ["VibeCodeCore"]
        ),
    ],
    dependencies: [
        // No external dependencies (pure Apple SDK)
    ],
    targets: [
        // Main Swift module
        .target(
            name: "VibeCodeCore",
            dependencies: ["OpenVSCodeBridge"],
            resources: [
                .copy("Resources/vmlinuz"),
                .copy("Resources/initrd"),
                .copy("Resources/alpine-base.img"),
            ]
        ),

        // FFI bridge module
        .target(
            name: "OpenVSCodeBridge",
            dependencies: ["COpenVSCode"],
            linkerSettings: [
                .linkedLibrary("openvscode_cli", .when(platforms: [.macOS]))
            ]
        ),

        // C module for Rust static library
        .systemLibrary(
            name: "COpenVSCode",
            path: "Sources/COpenVSCode",
            pkgConfig: nil
        ),

        // Tests
        .testTarget(
            name: "VibeCodeCoreTests",
            dependencies: ["VibeCodeCore"]
        ),
    ]
)
```

### 4.3 Key Swift Files

#### VMOrchestrator.swift

```swift
import Foundation
import Virtualization

@MainActor
public class VMOrchestrator: NSObject, ObservableObject {
    // MARK: - Published State
    @Published public private(set) var vmState: VMState = .stopped
    @Published public private(set) var serverStatus: ServerStatus = .unavailable

    // MARK: - Private Properties
    private var virtualMachine: VZVirtualMachine?
    private let serverManager: ServerManager
    private let vmBundlePath: URL

    // MARK: - Initialization
    public init(configuration: VMConfiguration) {
        self.vmBundlePath = configuration.bundlePath
        self.serverManager = ServerManager(bridge: OpenVSCodeBridge.shared)
        super.init()
    }

    // MARK: - Public API
    public func start() async throws {
        vmState = .starting

        // Create VM configuration
        let vmConfig = try createVMConfiguration()

        // Create and start VM
        virtualMachine = VZVirtualMachine(configuration: vmConfig)
        virtualMachine?.delegate = self

        try await virtualMachine?.start()
        vmState = .running

        // Wait for network to be ready
        try await waitForNetworkReady()

        // Start OpenVSCode Server inside VM
        try await serverManager.start(port: 8080)
        serverStatus = .running
    }

    public func stop() async throws {
        serverStatus = .stopping

        // Stop server first
        try await serverManager.stop()
        serverStatus = .stopped

        // Stop VM
        vmState = .stopping
        try await virtualMachine?.stop()
        vmState = .stopped
    }

    // MARK: - Private Methods
    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU: 4 cores
        config.cpuCount = 4

        // Memory: 4GB
        config.memorySize = 4 * 1024 * 1024 * 1024

        // Boot loader
        let kernelURL = vmBundlePath.appendingPathComponent("vmlinuz")
        let initrdURL = vmBundlePath.appendingPathComponent("initrd")

        let bootloader = VZLinuxBootLoader(kernelURL: kernelURL)
        bootloader.initialRamdiskURL = initrdURL
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw quiet"
        config.bootLoader = bootloader

        // Storage
        let diskURL = vmBundlePath.appendingPathComponent("disk.img")
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let storageDevice = VZVirtioBlockDeviceConfiguration(
            attachment: diskAttachment
        )
        config.storageDevices = [storageDevice]

        // Network (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Console
        let consoleDevice = VZVirtioConsoleDeviceConfiguration()
        let consolePort = VZVirtioConsolePortConfiguration()
        consolePort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: .standardInput,
            fileHandleForWriting: .standardOutput
        )
        consoleDevice.ports[0] = consolePort
        config.consoleDevices = [consoleDevice]

        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        try config.validate()
        return config
    }

    private func waitForNetworkReady() async throws {
        // Poll for network connectivity
        for _ in 0..<30 {
            if virtualMachine?.state == .running {
                // Check if we can reach the VM
                // (implement ping or check if port is listening)
                return
            }
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        }
        throw VMError.networkTimeout
    }
}

// MARK: - VZVirtualMachineDelegate
extension VMOrchestrator: VZVirtualMachineDelegate {
    public func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        Task { @MainActor in
            vmState = .stopped
            serverStatus = .unavailable
        }
    }

    public func virtualMachine(
        _ virtualMachine: VZVirtualMachine,
        didStopWithError error: Error
    ) {
        Task { @MainActor in
            vmState = .error(error)
            serverStatus = .unavailable
        }
    }
}
```

#### ServerManager.swift

```swift
import Foundation

public class ServerManager {
    private let bridge: OpenVSCodeBridge
    private var server: OpenVSCodeServer?

    init(bridge: OpenVSCodeBridge) {
        self.bridge = bridge
    }

    public func start(port: UInt16) async throws {
        let config = ServerConfiguration(
            port: port,
            host: "0.0.0.0",
            withoutConnectionToken: false
        )

        server = try bridge.createServer(config: config)
        try await server?.start()
    }

    public func stop() async throws {
        try await server?.stop()
        server = nil
    }

    public func status() async throws -> ServerStatus {
        guard let server = server else {
            return .stopped
        }
        return try await server.status()
    }
}
```

### 4.4 Model Types

```swift
// ServerConfiguration.swift
public struct ServerConfiguration {
    public let port: UInt16
    public let host: String
    public let withoutConnectionToken: Bool
    public let serverDataDir: URL?
    public let connectionToken: String?

    public init(
        port: UInt16,
        host: String = "0.0.0.0",
        withoutConnectionToken: Bool = false,
        serverDataDir: URL? = nil,
        connectionToken: String? = nil
    ) {
        self.port = port
        self.host = host
        self.withoutConnectionToken = withoutConnectionToken
        self.serverDataDir = serverDataDir
        self.connectionToken = connectionToken
    }
}

// ServerStatus.swift
public enum ServerStatus {
    case unavailable
    case starting
    case running
    case stopping
    case stopped
    case error(Error)
}

// VMState.swift
public enum VMState {
    case stopped
    case starting
    case running
    case paused
    case stopping
    case error(Error)
}
```

---

## 5. Implementation Roadmap

### Phase 1: FFI Foundation (Week 1-2)

**Goal:** Establish basic FFI communication between Swift and Rust

**Tasks:**
1. ✓ Create new Rust crate for FFI layer
   - Location: `VibeCodeCore/rust/`
   - Add swift-bridge dependency
   - Configure for staticlib output

2. ✓ Implement minimal FFI bridge
   - Define basic types (ServerConfig)
   - Implement create/destroy functions
   - Test memory safety

3. ✓ Set up build system
   - Configure Cargo to build staticlib
   - Add build.rs for swift-bridge codegen
   - Create C module.modulemap

4. ✓ Create Swift package structure
   - Set up Package.swift
   - Create module hierarchy
   - Link Rust static library

5. ✓ Write integration tests
   - Test Swift → Rust calls
   - Test Rust → Swift callbacks
   - Memory leak tests

**Deliverables:**
- Rust FFI crate compiles to `libopenvscode_cli.a`
- Swift can create/destroy Rust objects
- Basic test suite passes

### Phase 2: Server Management (Week 3-4)

**Goal:** Implement OpenVSCode Server start/stop functionality

**Tasks:**
1. ✓ Wrap serve_web functionality
   - Expose `serve_web::serve_web()` via FFI
   - Handle async with Tokio runtime
   - Implement graceful shutdown

2. ✓ Add configuration passing
   - Marshal ServeWebArgs from Swift to Rust
   - Handle optional fields
   - Validate configuration

3. ✓ Implement status checking
   - Health check endpoints
   - Port listening verification
   - Process status queries

4. ✓ Add logging bridge
   - Stream Rust logs to Swift
   - Implement log level filtering
   - File logging support

5. ✓ Error handling
   - Define error enum
   - Map Rust errors to Swift errors
   - User-friendly error messages

**Deliverables:**
- Swift can start/stop OpenVSCode Server
- Configuration flows from Swift to Rust
- Logs visible in Swift console

### Phase 3: VM Integration (Week 5-6)

**Goal:** Integrate Virtualization.framework with server management

**Tasks:**
1. ✓ Implement VMOrchestrator
   - VM lifecycle management
   - Resource configuration
   - Delegate handling

2. ✓ Network setup
   - Configure NAT
   - Port forwarding (8080)
   - Network readiness detection

3. ✓ Storage setup
   - Disk image creation
   - Alpine Linux integration
   - Shared directories (if needed)

4. ✓ Server lifecycle coordination
   - Wait for VM boot
   - Start server after network ready
   - Handle VM crashes

5. ✓ Resource management
   - CPU/memory allocation
   - Disk space management
   - Cleanup on shutdown

**Deliverables:**
- VM boots Alpine Linux
- OpenVSCode Server accessible at localhost:8080
- Graceful start/stop flow works end-to-end

### Phase 4: Advanced Features (Week 7-8)

**Goal:** Add production-ready features

**Tasks:**
1. ✓ RPC bidirectional communication
   - Use existing Rust RPC framework
   - Implement Swift RPC client
   - Message routing

2. ✓ Real-time log streaming
   - Async stream from Rust
   - Swift AsyncSequence integration
   - Log buffering

3. ✓ Update management
   - Check for new OpenVSCode versions
   - Download and cache versions
   - Version switching

4. ✓ Tunnel support (optional)
   - Expose tunnel commands via FFI
   - Handle authentication flow
   - Remote access

5. ✓ Performance optimization
   - Profile FFI boundary
   - Reduce marshalling overhead
   - Optimize Tokio runtime

**Deliverables:**
- RPC communication works both directions
- Real-time log streaming functional
- Version management implemented

### Phase 5: Testing and Hardening (Week 9-10)

**Goal:** Production-quality assurance

**Tasks:**
1. ✓ Comprehensive testing
   - Unit tests (Swift + Rust)
   - Integration tests
   - End-to-end tests
   - Memory leak tests
   - Crash recovery tests

2. ✓ Error scenarios
   - Port conflicts
   - VM failures
   - Network issues
   - Resource exhaustion

3. ✓ Performance testing
   - Startup time
   - Memory usage
   - CPU usage
   - Concurrent connections

4. ✓ Security audit
   - Connection token security
   - File permissions
   - Network exposure
   - Code signing

5. ✓ Documentation
   - API documentation
   - Architecture diagrams
   - Deployment guide
   - Troubleshooting guide

**Deliverables:**
- Test coverage >80%
- All critical error scenarios handled
- Performance benchmarks documented
- Security review completed

### Phase 6: Deployment (Week 11-12)

**Goal:** Package for distribution

**Tasks:**
1. ✓ Xcode project setup
   - Create .xcodeproj
   - Configure build phases
   - Code signing
   - Notarization

2. ✓ Resource bundling
   - Embed kernel/initrd
   - Package base disk image
   - Include Rust static library

3. ✓ App bundle creation
   - Info.plist configuration
   - Icon assets
   - Entitlements
   - Sandbox configuration (if needed)

4. ✓ CI/CD pipeline
   - GitHub Actions workflow
   - Automated builds
   - Release creation
   - Distribution

5. ✓ Documentation
   - User guide
   - Installation instructions
   - Troubleshooting
   - FAQ

**Deliverables:**
- Signed .app bundle
- Automated build pipeline
- User documentation
- Distribution method (DMG, .pkg, or App Store)

---

## 6. Code Examples

### 6.1 Rust FFI Layer (rust/src/lib.rs)

```rust
// Rust FFI crate entry point
use std::sync::Arc;
use tokio::runtime::Runtime;

#[swift_bridge::bridge]
mod ffi {
    // Expose error types to Swift
    #[swift_bridge(swift_repr = "struct")]
    pub struct ServerConfig {
        pub port: u16,
        pub host: String,
        pub without_connection_token: bool,
        pub connection_token: Option<String>,
        pub server_data_dir: Option<String>,
    }

    // Opaque Rust type
    extern "Rust" {
        type OpenVSCodeServer;

        // Constructor
        #[swift_bridge(associated_to = OpenVSCodeServer)]
        fn new(config: ServerConfig) -> Result<OpenVSCodeServer, String>;

        // Async methods
        #[swift_bridge(associated_to = OpenVSCodeServer)]
        async fn start(&self) -> Result<(), String>;

        #[swift_bridge(associated_to = OpenVSCodeServer)]
        async fn stop(&self) -> Result<(), String>;

        #[swift_bridge(associated_to = OpenVSCodeServer)]
        async fn status(&self) -> ServerStatus;

        #[swift_bridge(associated_to = OpenVSCodeServer)]
        async fn logs(&self, callback: Box<dyn FnMut(String)>);
    }

    // Enum types
    #[swift_bridge(swift_repr = "struct")]
    pub enum ServerStatus {
        Stopped,
        Starting,
        Running,
        Stopping,
        Error { message: String },
    }
}

// Implementation
pub struct OpenVSCodeServer {
    runtime: Arc<Runtime>,
    config: ffi::ServerConfig,
    state: Arc<tokio::sync::Mutex<ServerState>>,
}

struct ServerState {
    status: ffi::ServerStatus,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl OpenVSCodeServer {
    pub fn new(config: ffi::ServerConfig) -> Result<Self, String> {
        let runtime = Runtime::new()
            .map_err(|e| format!("Failed to create Tokio runtime: {}", e))?;

        Ok(Self {
            runtime: Arc::new(runtime),
            config,
            state: Arc::new(tokio::sync::Mutex::new(ServerState {
                status: ffi::ServerStatus::Stopped,
                shutdown_tx: None,
            })),
        })
    }

    pub async fn start(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;

        match state.status {
            ffi::ServerStatus::Running => {
                return Err("Server is already running".to_string());
            }
            ffi::ServerStatus::Starting => {
                return Err("Server is already starting".to_string());
            }
            _ => {}
        }

        state.status = ffi::ServerStatus::Starting;
        drop(state); // Release lock before long-running operation

        // Convert FFI config to internal config
        let mut args = cli::commands::args::ServeWebArgs {
            host: Some(self.config.host.clone()),
            port: self.config.port,
            without_connection_token: self.config.without_connection_token,
            connection_token: self.config.connection_token.clone(),
            server_data_dir: self.config.server_data_dir.clone(),
            ..Default::default()
        };

        // Create command context
        let paths = cli::state::LauncherPaths::new().unwrap();
        let http = reqwest::Client::new();
        let log = cli::log::Logger::new(
            opentelemetry::sdk::trace::TracerProvider::builder()
                .build()
                .tracer("vibecode"),
            cli::log::Level::Info,
        );

        let context = cli::commands::CommandContext {
            http,
            paths,
            log: log.clone(),
            args: cli::commands::args::CliCore::default(),
        };

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

        let state_clone = self.state.clone();
        let runtime_clone = self.runtime.clone();

        // Spawn server task
        runtime_clone.spawn(async move {
            // Run server
            let result = cli::commands::serve_web::serve_web(context, args).await;

            // Update state
            let mut state = state_clone.lock().await;
            match result {
                Ok(_) => {
                    state.status = ffi::ServerStatus::Stopped;
                }
                Err(e) => {
                    state.status = ffi::ServerStatus::Error {
                        message: e.to_string(),
                    };
                }
            }
        });

        // Store shutdown sender
        let mut state = self.state.lock().await;
        state.shutdown_tx = Some(shutdown_tx);
        state.status = ffi::ServerStatus::Running;

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;

        if let Some(shutdown_tx) = state.shutdown_tx.take() {
            state.status = ffi::ServerStatus::Stopping;
            drop(state);

            // Send shutdown signal
            let _ = shutdown_tx.send(());

            // Wait a bit for graceful shutdown
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            let mut state = self.state.lock().await;
            state.status = ffi::ServerStatus::Stopped;

            Ok(())
        } else {
            Err("Server is not running".to_string())
        }
    }

    pub async fn status(&self) -> ffi::ServerStatus {
        let state = self.state.lock().await;
        state.status.clone()
    }

    pub async fn logs(&self, mut callback: Box<dyn FnMut(String)>) {
        // Tail log file and call callback for each line
        // (Simplified implementation)
        let log_file = "/tmp/vibecode-server.log";

        if let Ok(content) = tokio::fs::read_to_string(log_file).await {
            for line in content.lines() {
                callback(line.to_string());
            }
        }
    }
}
```

### 6.2 Swift Wrapper (Sources/OpenVSCodeBridge/OpenVSCodeBridge.swift)

```swift
// This file is mostly generated by swift-bridge
// We add convenience methods on top

import Foundation

// Extension for Swift ergonomics
extension OpenVSCodeServer {
    public convenience init(port: UInt16, host: String = "0.0.0.0") throws {
        let config = ServerConfig(
            port: port,
            host: host,
            without_connection_token: false,
            connection_token: nil,
            server_data_dir: nil
        )

        try self.init(config: config)
    }

    public func streamLogs() -> AsyncStream<String> {
        AsyncStream { continuation in
            Task {
                await self.logs { line in
                    continuation.yield(line)
                }
                continuation.finish()
            }
        }
    }
}

// Convenience for ServerStatus
extension ServerStatus {
    public var isRunning: Bool {
        if case .Running = self {
            return true
        }
        return false
    }

    public var errorMessage: String? {
        if case .Error(let message) = self {
            return message
        }
        return nil
    }
}
```

### 6.3 Swift UI Integration (Example SwiftUI View)

```swift
import SwiftUI
import VibeCodeCore

@MainActor
class AppViewModel: ObservableObject {
    @Published var serverStatus: ServerStatus = .Stopped
    @Published var logs: [String] = []
    @Published var errorMessage: String?

    private let orchestrator: VMOrchestrator
    private var server: OpenVSCodeServer?

    init() {
        let config = VMConfiguration(
            bundlePath: Bundle.main.bundleURL
                .appendingPathComponent("Contents/Resources/vm")
        )
        orchestrator = VMOrchestrator(configuration: config)
    }

    func startServer() async {
        do {
            errorMessage = nil

            // Start VM
            try await orchestrator.start()

            // Create server instance
            server = try OpenVSCodeServer(port: 8080)

            // Start server
            try await server?.start()

            // Monitor status
            startStatusMonitoring()

            // Stream logs
            startLogStreaming()

        } catch {
            errorMessage = "Failed to start: \\(error.localizedDescription)"
        }
    }

    func stopServer() async {
        do {
            errorMessage = nil

            // Stop server
            try await server?.stop()

            // Stop VM
            try await orchestrator.stop()

            serverStatus = .Stopped

        } catch {
            errorMessage = "Failed to stop: \\(error.localizedDescription)"
        }
    }

    private func startStatusMonitoring() {
        Task {
            while let server = server {
                serverStatus = await server.status()

                if !serverStatus.isRunning {
                    break
                }

                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            }
        }
    }

    private func startLogStreaming() {
        Task {
            guard let server = server else { return }

            for await log in server.streamLogs() {
                logs.append(log)

                // Keep only last 100 lines
                if logs.count > 100 {
                    logs.removeFirst()
                }
            }
        }
    }
}

struct ContentView: View {
    @StateObject private var viewModel = AppViewModel()

    var body: some View {
        VStack(spacing: 20) {
            // Status
            HStack {
                Text("Status:")
                    .font(.headline)

                statusText
                    .font(.body)
                    .foregroundColor(statusColor)
            }

            // URL (when running)
            if viewModel.serverStatus.isRunning {
                Link("Open VS Code", destination: URL(string: "http://localhost:8080")!)
                    .font(.title2)
            }

            // Controls
            HStack {
                Button("Start") {
                    Task {
                        await viewModel.startServer()
                    }
                }
                .disabled(viewModel.serverStatus.isRunning)

                Button("Stop") {
                    Task {
                        await viewModel.stopServer()
                    }
                }
                .disabled(!viewModel.serverStatus.isRunning)
            }

            // Error message
            if let error = viewModel.errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            }

            // Logs
            GroupBox("Logs") {
                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(viewModel.logs, id: \\.self) { log in
                            Text(log)
                                .font(.system(.caption, design: .monospaced))
                        }
                    }
                }
                .frame(maxHeight: 200)
            }
        }
        .padding()
    }

    private var statusText: Text {
        switch viewModel.serverStatus {
        case .Stopped:
            return Text("Stopped")
        case .Starting:
            return Text("Starting...")
        case .Running:
            return Text("Running")
        case .Stopping:
            return Text("Stopping...")
        case .Error(let message):
            return Text("Error: \\(message)")
        }
    }

    private var statusColor: Color {
        switch viewModel.serverStatus {
        case .Stopped, .Stopping:
            return .gray
        case .Starting:
            return .orange
        case .Running:
            return .green
        case .Error:
            return .red
        }
    }
}
```

### 6.4 Build Script (rust/build.rs)

```rust
fn main() {
    // Generate Swift bridge code
    let bridge_files = vec!["src/lib.rs"];

    for file in &bridge_files {
        println!("cargo:rerun-if-changed={}", file);
    }

    swift_bridge_build::parse_bridges(bridge_files)
        .write_all_concatenated(out_dir(), env!("CARGO_PKG_NAME"));

    // Tell cargo to link necessary frameworks
    println!("cargo:rustc-link-lib=framework=CoreFoundation");
    println!("cargo:rustc-link-lib=framework=Security");
}

fn out_dir() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap())
}
```

### 6.5 C Module Map (Sources/COpenVSCode/include/module.modulemap)

```
module COpenVSCode {
    header "../../generated/SwiftBridgeCore.h"
    header "../../generated/vibecode-ffi/vibecode-ffi.h"
    export *
}
```

---

## 7. Build System Integration

### 7.1 Cargo Configuration (rust/Cargo.toml)

```toml
[package]
name = "vibecode-ffi"
version = "0.1.0"
edition = "2021"

[lib]
name = "openvscode_cli"
crate-type = ["staticlib"]

[dependencies]
# OpenVSCode CLI (from submodule)
cli = { path = "../../../openvscode-server/cli" }

# Swift bridge
swift-bridge = "0.1"

# Async runtime
tokio = { version = "1.38", features = ["full"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[build-dependencies]
swift-bridge-build = "0.1"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

### 7.2 Build Flow

```
1. Swift Package Manager invokes build
   ↓
2. SPM resolves dependencies
   ↓
3. SPM builds Rust crate (via custom build phase)
   └─> cargo build --release
       ↓
       3a. build.rs runs
           ├─> Parses #[swift_bridge] annotations
           ├─> Generates Swift bindings
           └─> Generates C headers
       ↓
       3b. Compiles Rust code
           └─> Produces libopenvscode_cli.a
   ↓
4. SPM builds Swift modules
   ├─> Imports C module (COpenVSCode)
   ├─> Builds OpenVSCodeBridge (uses generated Swift)
   └─> Builds VibeCodeCore (uses OpenVSCodeBridge)
   ↓
5. Xcode links everything
   ├─> Links libopenvscode_cli.a
   ├─> Links system frameworks (CoreFoundation, Security, etc.)
   └─> Produces VibeCode.app
```

### 7.3 Xcode Build Phase Script

Add this as a "Run Script" build phase in Xcode:

```bash
#!/bin/bash
set -e

RUST_DIR="${PROJECT_DIR}/VibeCodeCore/rust"
TARGET_DIR="${RUST_DIR}/target"

echo "Building Rust FFI library..."

# Set up Rust environment
export PATH="$HOME/.cargo/bin:$PATH"

# Determine build configuration
if [ "${CONFIGURATION}" = "Debug" ]; then
    RUST_BUILD_MODE="debug"
    RUST_BUILD_FLAG=""
else
    RUST_BUILD_MODE="release"
    RUST_BUILD_FLAG="--release"
fi

# Build for current architecture
cd "${RUST_DIR}"
cargo build ${RUST_BUILD_FLAG} --target aarch64-apple-darwin

# Copy static library to expected location
STATIC_LIB="${TARGET_DIR}/aarch64-apple-darwin/${RUST_BUILD_MODE}/libopenvscode_cli.a"
DEST_DIR="${BUILT_PRODUCTS_DIR}"

echo "Copying ${STATIC_LIB} to ${DEST_DIR}"
cp "${STATIC_LIB}" "${DEST_DIR}/"

# Copy generated Swift files
GENERATED_SWIFT="${TARGET_DIR}/aarch64-apple-darwin/${RUST_BUILD_MODE}/build/vibecode-ffi-*/out/vibecode-ffi"
SWIFT_DEST="${PROJECT_DIR}/VibeCodeCore/Sources/OpenVSCodeBridge/Generated"

echo "Copying generated Swift files to ${SWIFT_DEST}"
mkdir -p "${SWIFT_DEST}"
cp -r ${GENERATED_SWIFT}/* "${SWIFT_DEST}/"

echo "Rust build complete!"
```

### 7.4 Continuous Integration (GitHub Actions)

```yaml
# .github/workflows/build-macos.yml
name: Build macOS

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: macos-14  # macOS Sonoma with Apple Silicon

    steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive  # Include openvscode-server

    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        target: aarch64-apple-darwin
        profile: minimal

    - name: Cache Rust dependencies
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          VibeCodeCore/rust/target
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

    - name: Build Rust FFI
      run: |
        cd VibeCodeCore/rust
        cargo build --release --target aarch64-apple-darwin

    - name: Build Swift Package
      run: |
        cd VibeCodeCore
        swift build -c release

    - name: Run Swift tests
      run: |
        cd VibeCodeCore
        swift test

    - name: Build Xcode project
      run: |
        xcodebuild -project VibeCode.xcodeproj \
                   -scheme VibeCode \
                   -configuration Release \
                   -archivePath build/VibeCode.xcarchive \
                   archive

    - name: Export app bundle
      run: |
        xcodebuild -exportArchive \
                   -archivePath build/VibeCode.xcarchive \
                   -exportPath build/export \
                   -exportOptionsPlist exportOptions.plist

    - name: Upload artifact
      uses: actions/upload-artifact@v3
      with:
        name: VibeCode.app
        path: build/export/VibeCode.app
```

---

## 8. Testing Strategy

### 8.1 Rust Unit Tests

```rust
// rust/src/lib.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_creation() {
        let config = ffi::ServerConfig {
            port: 8080,
            host: "127.0.0.1".to_string(),
            without_connection_token: true,
            connection_token: None,
            server_data_dir: None,
        };

        let server = OpenVSCodeServer::new(config);
        assert!(server.is_ok());
    }

    #[tokio::test]
    async fn test_server_lifecycle() {
        let config = ffi::ServerConfig {
            port: 18080, // Use different port for testing
            host: "127.0.0.1".to_string(),
            without_connection_token: true,
            connection_token: None,
            server_data_dir: None,
        };

        let server = OpenVSCodeServer::new(config).unwrap();

        // Start server
        let result = server.start().await;
        assert!(result.is_ok());

        // Check status
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let status = server.status().await;
        assert!(matches!(status, ffi::ServerStatus::Running));

        // Stop server
        let result = server.stop().await;
        assert!(result.is_ok());

        // Verify stopped
        let status = server.status().await;
        assert!(matches!(status, ffi::ServerStatus::Stopped));
    }

    #[test]
    fn test_memory_safety() {
        // Create and drop multiple servers
        for _ in 0..100 {
            let config = ffi::ServerConfig {
                port: 8080,
                host: "127.0.0.1".to_string(),
                without_connection_token: true,
                connection_token: None,
                server_data_dir: None,
            };

            let server = OpenVSCodeServer::new(config).unwrap();
            drop(server); // Explicit drop
        }

        // If we get here without crashing, memory management is likely correct
    }
}
```

### 8.2 Swift Unit Tests

```swift
// Tests/VibeCodeCoreTests/ServerManagerTests.swift
import XCTest
@testable import VibeCodeCore
@testable import OpenVSCodeBridge

final class ServerManagerTests: XCTestCase {
    var server: OpenVSCodeServer?

    override func setUp() async throws {
        let config = ServerConfig(
            port: 18080, // Test port
            host: "127.0.0.1",
            without_connection_token: true,
            connection_token: nil,
            server_data_dir: nil
        )

        server = try OpenVSCodeServer(config: config)
    }

    override func tearDown() async throws {
        if let server = server {
            try? await server.stop()
        }
        server = nil
    }

    func testServerCreation() throws {
        XCTAssertNotNil(server)
    }

    func testServerStartStop() async throws {
        guard let server = server else {
            XCTFail("Server not initialized")
            return
        }

        // Start
        try await server.start()

        // Wait for startup
        try await Task.sleep(nanoseconds: 2_000_000_000)

        // Check status
        let status = await server.status()
        XCTAssert(status.isRunning, "Server should be running")

        // Stop
        try await server.stop()

        // Verify stopped
        let stoppedStatus = await server.status()
        XCTAssertFalse(stoppedStatus.isRunning, "Server should be stopped")
    }

    func testMultipleInstances() async throws {
        // Create multiple servers on different ports
        let servers = try (18080..<18090).map { port in
            try OpenVSCodeServer(
                port: port,
                host: "127.0.0.1"
            )
        }

        // Start all
        try await withThrowingTaskGroup(of: Void.self) { group in
            for server in servers {
                group.addTask {
                    try await server.start()
                }
            }
            try await group.waitForAll()
        }

        // Stop all
        try await withThrowingTaskGroup(of: Void.self) { group in
            for server in servers {
                group.addTask {
                    try await server.stop()
                }
            }
            try await group.waitForAll()
        }
    }

    func testMemoryLeaks() async throws {
        // Create and destroy many servers
        for i in 0..<100 {
            autoreleasepool {
                let config = ServerConfig(
                    port: 18080,
                    host: "127.0.0.1",
                    without_connection_token: true,
                    connection_token: nil,
                    server_data_dir: nil
                )

                let server = try? OpenVSCodeServer(config: config)
                XCTAssertNotNil(server, "Failed to create server \\(i)")
                // Implicit dealloc
            }
        }

        // Use Instruments to verify no leaks
    }
}
```

### 8.3 Integration Tests

```swift
// Tests/VibeCodeCoreTests/IntegrationTests.swift
import XCTest
import Virtualization
@testable import VibeCodeCore

final class IntegrationTests: XCTestCase {
    var orchestrator: VMOrchestrator?

    override func setUp() async throws {
        let config = VMConfiguration(
            bundlePath: Bundle.module.resourceURL!
                .appendingPathComponent("vm")
        )
        orchestrator = VMOrchestrator(configuration: config)
    }

    override func tearDown() async throws {
        try? await orchestrator?.stop()
        orchestrator = nil
    }

    func testFullLifecycle() async throws {
        guard let orchestrator = orchestrator else {
            XCTFail("Orchestrator not initialized")
            return
        }

        // Start VM and server
        try await orchestrator.start()

        // Wait for server to be ready
        var attempts = 0
        while attempts < 30 {
            if orchestrator.serverStatus == .running {
                break
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
            attempts += 1
        }

        XCTAssertEqual(orchestrator.serverStatus, .running)

        // Test HTTP connectivity
        let url = URL(string: "http://localhost:8080")!
        let (_, response) = try await URLSession.shared.data(from: url)
        let httpResponse = response as! HTTPURLResponse
        XCTAssertEqual(httpResponse.statusCode, 200)

        // Stop
        try await orchestrator.stop()
        XCTAssertEqual(orchestrator.vmState, .stopped)
    }

    func testVMCrashRecovery() async throws {
        // TODO: Implement crash recovery test
        // 1. Start VM
        // 2. Force VM crash (kill process)
        // 3. Verify orchestrator detects crash
        // 4. Verify orchestrator can restart
    }

    func testResourceLimits() async throws {
        // TODO: Test behavior under resource constraints
        // 1. Start with limited CPU/memory
        // 2. Verify server still functions
        // 3. Monitor performance metrics
    }
}
```

### 8.4 Performance Tests

```swift
// Tests/VibeCodeCoreTests/PerformanceTests.swift
import XCTest
@testable import VibeCodeCore

final class PerformanceTests: XCTestCase {
    func testStartupTime() throws {
        let orchestrator = createOrchestrator()

        measure {
            let expectation = self.expectation(description: "Server started")

            Task {
                do {
                    try await orchestrator.start()
                    expectation.fulfill()
                } catch {
                    XCTFail("Failed to start: \\(error)")
                }
            }

            wait(for: [expectation], timeout: 30.0)
        }
    }

    func testMemoryUsage() async throws {
        let orchestrator = createOrchestrator()

        // Measure memory before
        let memoryBefore = memoryUsage()

        // Start server
        try await orchestrator.start()

        // Wait for stabilization
        try await Task.sleep(nanoseconds: 5_000_000_000)

        // Measure memory after
        let memoryAfter = memoryUsage()

        let memoryIncrease = memoryAfter - memoryBefore
        print("Memory increase: \\(memoryIncrease / 1024 / 1024) MB")

        // Assert reasonable memory usage (< 1GB)
        XCTAssertLessThan(memoryIncrease, 1024 * 1024 * 1024)
    }

    private func memoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        return kerr == KERN_SUCCESS ? info.resident_size : 0
    }
}
```

---

## 9. Deployment Considerations

### 9.1 App Bundle Structure

```
VibeCode.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── VibeCode                      # Swift executable
│   ├── Resources/
│   │   ├── vm/
│   │   │   ├── vmlinuz                   # Linux kernel (ARM64)
│   │   │   ├── initrd                    # Initial RAM disk
│   │   │   └── alpine-base.img           # Base Alpine image (~100MB)
│   │   ├── AppIcon.icns
│   │   └── Assets.car
│   ├── Frameworks/
│   │   ├── libopenvscode_cli.a           # Rust static lib (embedded)
│   │   └── (other frameworks if needed)
│   ├── _CodeSignature/
│   │   └── CodeResources
│   └── embedded.provisionprofile          # For App Store distribution
```

### 9.2 Code Signing and Notarization

#### Entitlements (VibeCode.entitlements)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Virtualization Framework -->
    <key>com.apple.security.virtualization</key>
    <true/>

    <!-- Network (for HTTP server) -->
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access (for VM disk images) -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>

    <!-- Optional: App Sandbox (if distributing via App Store) -->
    <!-- <key>com.apple.security.app-sandbox</key>
    <true/> -->
</dict>
</plist>
```

#### Code Signing Script

```bash
#!/bin/bash
set -e

IDENTITY="Developer ID Application: Your Company (TEAMID)"
ENTITLEMENTS="VibeCode.entitlements"
APP_BUNDLE="build/VibeCode.app"

echo "Signing app bundle..."

# Sign Rust static library (if not already signed)
codesign --force --sign "${IDENTITY}" \
         "${APP_BUNDLE}/Contents/MacOS/libopenvscode_cli.a"

# Sign main executable
codesign --force --sign "${IDENTITY}" \
         --entitlements "${ENTITLEMENTS}" \
         --options runtime \
         "${APP_BUNDLE}/Contents/MacOS/VibeCode"

# Sign entire bundle
codesign --force --sign "${IDENTITY}" \
         --entitlements "${ENTITLEMENTS}" \
         --options runtime \
         --deep \
         "${APP_BUNDLE}"

# Verify signature
codesign --verify --deep --strict --verbose=2 "${APP_BUNDLE}"

echo "Code signing complete!"
```

#### Notarization Script

```bash
#!/bin/bash
set -e

APP_BUNDLE="build/VibeCode.app"
ZIP_FILE="build/VibeCode.zip"
APPLE_ID="your-apple-id@example.com"
TEAM_ID="TEAMID"

echo "Creating archive for notarization..."
ditto -c -k --keepParent "${APP_BUNDLE}" "${ZIP_FILE}"

echo "Uploading to Apple for notarization..."
xcrun notarytool submit "${ZIP_FILE}" \
    --apple-id "${APPLE_ID}" \
    --team-id "${TEAM_ID}" \
    --wait

echo "Stapling notarization ticket..."
xcrun stapler staple "${APP_BUNDLE}"

echo "Notarization complete!"
```

### 9.3 Distribution Methods

#### Method 1: Direct Download (DMG)

```bash
#!/bin/bash
# create-dmg.sh

APP_NAME="VibeCode"
APP_BUNDLE="build/${APP_NAME}.app"
DMG_FILE="build/${APP_NAME}.dmg"
VOLUME_NAME="${APP_NAME} Installer"

# Create temporary directory
TMP_DIR=$(mktemp -d)
cp -R "${APP_BUNDLE}" "${TMP_DIR}/"

# Create symbolic link to Applications
ln -s /Applications "${TMP_DIR}/Applications"

# Create DMG
hdiutil create -volname "${VOLUME_NAME}" \
               -srcfolder "${TMP_DIR}" \
               -ov -format UDZO \
               "${DMG_FILE}"

# Clean up
rm -rf "${TMP_DIR}"

echo "DMG created: ${DMG_FILE}"
```

#### Method 2: Homebrew Cask

```ruby
# Formula: vibecode.rb
cask "vibecode" do
  version "1.0.0"
  sha256 "..."

  url "https://github.com/yourorg/vibecode/releases/download/v#{version}/VibeCode.dmg"
  name "VibeCode"
  desc "Native macOS VS Code environment with Virtualization.framework"
  homepage "https://github.com/yourorg/vibecode"

  depends_on macos: ">= :sonoma"

  app "VibeCode.app"

  zap trash: [
    "~/Library/Application Support/VibeCode",
    "~/Library/Caches/com.yourorg.vibecode",
    "~/Library/Preferences/com.yourorg.vibecode.plist",
  ]
end
```

#### Method 3: Mac App Store (Future)

Requirements:
- App Sandbox enabled
- Limited entitlements
- Review process compliance
- Subscription or paid app model

### 9.4 Update Mechanism

#### Sparkle Framework Integration

```swift
import Sparkle

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {
    @IBOutlet var updaterController: SPUStandardUpdaterController!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Sparkle auto-updates
        updaterController.startUpdater()
    }
}
```

#### appcast.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>VibeCode Updates</title>
    <item>
      <title>Version 1.1.0</title>
      <sparkle:version>1.1.0</sparkle:version>
      <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
      <pubDate>Tue, 28 Oct 2025 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/yourorg/vibecode/releases/download/v1.1.0/VibeCode-1.1.0.zip"
        sparkle:edSignature="..."
        length="50000000"
        type="application/octet-stream"
      />
      <description><![CDATA[
        <h2>What's New in 1.1.0</h2>
        <ul>
          <li>Improved startup performance</li>
          <li>Bug fixes and stability improvements</li>
        </ul>
      ]]></description>
    </item>
  </channel>
</rss>
```

### 9.5 System Requirements

**Minimum Requirements:**
- macOS 14.0 Sonoma or later
- Apple Silicon (M1/M2/M3)
- 8 GB RAM
- 10 GB free disk space
- Internet connection (for initial setup)

**Recommended:**
- macOS 14.0 or later
- Apple Silicon M2 or newer
- 16 GB RAM
- 20 GB free disk space
- SSD storage

**Why These Requirements:**
1. **macOS 14 (Sonoma):** Latest Virtualization.framework features, improved performance
2. **Apple Silicon:** Native ARM64 support, better VM performance than Rosetta translation
3. **8 GB RAM:** 4 GB for VM + 4 GB for host system
4. **10 GB Disk:** VM image (~5 GB) + application (~2 GB) + workspace (~3 GB)

---

## 10. Appendix

### 10.1 Glossary

- **FFI (Foreign Function Interface):** Mechanism to call code written in one language from another
- **swift-bridge:** Code generation tool for Swift-Rust FFI
- **Virtualization.framework:** Apple's native VM framework (macOS 11+)
- **vfkit:** CLI tool for managing VMs via Virtualization.framework
- **RPC (Remote Procedure Call):** Communication pattern for calling functions across process boundaries
- **Tokio:** Rust asynchronous runtime
- **MessagePack:** Efficient binary serialization format
- **Static Library (.a):** Compiled code linked at build time
- **Dynamic Library (.dylib):** Compiled code loaded at runtime
- **Mach-O:** macOS executable format
- **Code Signing:** Cryptographic signature proving app authenticity
- **Notarization:** Apple's malware scanning process
- **Entitlements:** Permission declarations for macOS apps

### 10.2 Reference Links

**Rust Resources:**
- OpenVSCode Server CLI: https://github.com/microsoft/vscode/tree/main/cli
- swift-bridge: https://github.com/chinedufn/swift-bridge
- Tokio: https://tokio.rs
- Rust FFI Guide: https://doc.rust-lang.org/nomicon/ffi.html

**Swift Resources:**
- Swift Package Manager: https://swift.org/package-manager/
- Virtualization Framework: https://developer.apple.com/documentation/virtualization
- Swift Concurrency: https://docs.swift.org/swift-book/LanguageGuide/Concurrency.html

**Apple Documentation:**
- Code Signing: https://developer.apple.com/documentation/security/code_signing_services
- Notarization: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- App Sandbox: https://developer.apple.com/documentation/security/app_sandbox

**Related Projects:**
- vfkit: https://github.com/crc-org/vfkit
- Lima: https://github.com/lima-vm/lima
- UTM: https://github.com/utmapp/UTM

### 10.3 Performance Benchmarks (Target)

| Metric | Target | Notes |
|--------|--------|-------|
| Cold Start (VM + Server) | < 10s | From app launch to HTTP 200 |
| Warm Start (Server only) | < 2s | VM already running |
| Memory Overhead | < 500 MB | Rust + Swift (excluding VM) |
| VM Memory | 4 GB | Configurable |
| CPU Usage (idle) | < 5% | Both VM and host |
| Disk I/O | < 50 MB/s | During active development |
| Network Latency | < 5ms | localhost connections |

### 10.4 Troubleshooting Guide

#### Issue: Port Already in Use

**Symptom:** Server fails to start with "Address already in use" error

**Solutions:**
1. Check if another instance is running: `lsof -i :8080`
2. Kill conflicting process: `kill -9 <PID>`
3. Configure different port in settings

#### Issue: VM Fails to Boot

**Symptom:** VM stuck in "Starting" state or crashes immediately

**Solutions:**
1. Verify kernel/initrd files exist in bundle
2. Check Console.app for kernel panic logs
3. Ensure sufficient disk space
4. Try recreating disk image

#### Issue: Network Not Available in VM

**Symptom:** Server starts but not accessible from host

**Solutions:**
1. Verify NAT network device configured
2. Check macOS Firewall settings
3. Ensure VM obtained IP via DHCP
4. Test with `ping` from host to VM

#### Issue: Rust Library Not Found

**Symptom:** Linker error "library not found for -lopenvscode_cli"

**Solutions:**
1. Rebuild Rust crate: `cargo clean && cargo build --release`
2. Check library path in Xcode build settings
3. Verify static library exists in expected location
4. Check architecture matches (ARM64)

#### Issue: Swift-Rust Type Mismatch

**Symptom:** Compilation error about incompatible types across FFI boundary

**Solutions:**
1. Rebuild swift-bridge generated code
2. Check for type changes in Rust code
3. Verify swift-bridge attributes are correct
4. Clean build folder and rebuild

### 10.5 Known Limitations

1. **macOS Only:** No cross-platform support (by design)
2. **Apple Silicon Only:** Intel Macs not supported (Virtualization.framework performance)
3. **Single VM Instance:** Cannot run multiple VMs simultaneously (yet)
4. **No GPU Acceleration:** VM has no GPU passthrough (Virtualization.framework limitation)
5. **Network Mode:** Only NAT supported, no bridge mode
6. **File Sharing:** Limited to VirtioFS (no NFS/SMB)
7. **Rosetta Requirement:** For x86_64 containers on ARM64 (macOS 13+ only)

### 10.6 Future Enhancements

#### Phase 5+ (Post-Launch)

1. **Multi-VM Support:** Run multiple isolated environments
2. **Custom Images:** Import custom Linux distributions
3. **Snapshots:** Save/restore VM state
4. **Resource Profiles:** Predefined CPU/memory configurations
5. **Extensions Sync:** Sync VS Code extensions with cloud
6. **Collaborative Features:** Share environments with team
7. **Container Registry:** Pull/push custom container images
8. **Metrics Dashboard:** Real-time resource monitoring
9. **CLI Tool:** Command-line interface for automation
10. **Plugin System:** Third-party extensions for VibeCode

### 10.7 Security Considerations

#### Threat Model

1. **Malicious Code in VM:** Sandboxed by Virtualization.framework
2. **Network Exposure:** HTTP server bound to localhost only
3. **File System Access:** VM can only access shared directories
4. **Code Injection:** Rust/Swift memory safety prevents most attacks
5. **Supply Chain:** Verify checksums of kernel/initrd downloads

#### Mitigations

1. **Connection Token:** Required for HTTP access (unless disabled)
2. **TLS/SSL:** Optional for production deployments
3. **Firewall Rules:** macOS Firewall integration
4. **Code Signing:** Prevent tampering
5. **Sandboxing:** Optional App Sandbox for additional isolation
6. **Audit Logging:** Track all VM/server operations

### 10.8 Contributing Guidelines

See main repository CONTRIBUTING.md for:
- Code style guidelines (Rust + Swift)
- Pull request process
- Issue reporting
- Testing requirements
- Documentation standards

---

## Conclusion

This document provides a comprehensive architecture for integrating OpenVSCode Server's Rust CLI with Swift 5 on macOS using **swift-bridge** for FFI. The design balances **performance**, **safety**, and **developer ergonomics** while leveraging Apple's native technologies.

**Key Takeaways:**
1. **swift-bridge** provides the best developer experience for async-heavy code
2. Rust handles server management, Swift handles VM orchestration
3. Clear separation of concerns enables independent testing
4. Build system integration requires careful coordination
5. macOS-native APIs (Virtualization.framework) provide excellent performance

**Next Steps:**
1. Begin Phase 1 implementation (FFI foundation)
2. Set up CI/CD pipeline
3. Create proof-of-concept demo
4. Iterate based on performance metrics
5. Expand test coverage

**Questions? Issues?**
- GitHub Issues: [link to repo]
- Discord: [link to server]
- Email: [support email]

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Maintainers:** Systems Engineering Team
**License:** MIT (same as parent project)
