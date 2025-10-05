# Tauri Architecture Documentation

## Overview

This document describes the technical architecture of the VibeCode Tauri desktop application, including design decisions, component interactions, and implementation details.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    VibeCode Desktop Application                 │
└────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────┐        ┌──────────────┐       ┌──────────────┐
│  Frontend   │◄──────►│  Tauri Core  │◄─────►│   Backend    │
│  (Web UI)   │  IPC   │   (Bridge)   │  API  │   (Rust)     │
└─────────────┘        └──────────────┘       └──────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────┐        ┌──────────────┐       ┌──────────────┐
│  Next.js    │        │   System     │       │   Native     │
│  Static     │        │   WebView    │       │   Services   │
│  Export     │        │              │       │              │
└─────────────┘        └──────────────┘       └──────────────┘
```

## Component Architecture

### 1. Frontend Layer (Next.js)

**Technology Stack**:
- Next.js 14+ (Static Export)
- React 18+
- TypeScript
- Tailwind CSS
- Monaco Editor

**Architecture**:
```
src/
├── app/                    # App Router (Next.js 13+)
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── workspace/         # Workspace features
├── components/
│   ├── ui/                # UI components (shadcn/ui)
│   ├── editor/            # Monaco editor integration
│   ├── docker/            # Docker UI components
│   └── tauri/             # Tauri-specific components
└── lib/
    ├── tauri.ts           # Tauri invoke wrapper
    ├── docker-client.ts   # Docker API client
    └── utils.ts           # Utilities
```

**Key Design Decisions**:

1. **Static Export**: Next.js configured for static export to avoid runtime server requirements
   - No SSR (Server-Side Rendering)
   - No API routes requiring Node.js runtime
   - All routes pre-rendered at build time

2. **Tauri Integration**: Frontend communicates with Rust backend via Tauri's IPC
   ```typescript
   // lib/tauri.ts
   import { invoke } from '@tauri-apps/api/core';

   export async function checkDocker(): Promise<boolean> {
     return await invoke('check_docker');
   }
   ```

3. **Desktop-First UI**: UI optimized for desktop experience
   - Native window decorations
   - Keyboard shortcuts
   - System theme detection
   - Menu bar integration

### 2. Tauri Core (Bridge)

**Responsibilities**:
- IPC (Inter-Process Communication) between frontend and backend
- Window management
- System integration (menus, tray, notifications)
- Security enforcement (CSP, sandboxing)
- Event system

**Configuration** (`tauri.conf.json`):
```json
{
  "app": {
    "windows": [{
      "title": "VibeCode",
      "width": 1400,
      "height": 900,
      "resizable": true
    }],
    "security": {
      "csp": "default-src 'self'; ..."
    }
  },
  "plugins": {
    "shell": { "open": true }
  }
}
```

**IPC Flow**:
```
Frontend                Tauri Core              Backend
   │                        │                      │
   ├─invoke('check_docker')→│                      │
   │                        ├─route_command()──────→│
   │                        │                      │
   │                        │←─Result<bool>────────┤
   │←─Promise<bool>─────────┤                      │
   │                        │                      │
```

### 3. Backend Layer (Rust)

**Module Structure**:
```
src-tauri/src/
├── main.rs          # Application entry point
├── commands.rs      # Tauri command handlers
├── docker.rs        # Docker integration
└── lib.rs           # Shared utilities (future)
```

**Core Modules**:

#### main.rs - Application Entry

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::ping,
            commands::launch_browser,
            commands::check_docker,
            commands::get_docker_version,
            commands::get_docker_status,
            commands::get_docker_info,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Responsibilities**:
- Initialize Tauri application
- Register command handlers
- Setup development tools (DevTools in debug mode)
- Plugin initialization

#### commands.rs - Command Handlers

```rust
#[command]
pub async fn check_docker() -> Result<bool, String> {
    docker::check_docker_available().await
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
```

**Design Pattern**: Command handlers act as thin wrappers around business logic modules.

#### docker.rs - Docker Integration

```rust
use bollard::Docker;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DockerError {
    #[error("Docker is not available: {0}")]
    NotAvailable(String),
    #[error("Docker connection error: {0}")]
    ConnectionError(String),
}

pub async fn check_docker_available() -> Result<bool, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.ping().await {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Docker ping failed: {}", e)),
            }
        }
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}
```

**Key Features**:
- Async operations using Tokio runtime
- Proper error handling with custom error types
- Docker API abstraction using Bollard library

## Data Flow

### Command Invocation Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User Interaction (Click "Check Docker" button)           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Frontend: Call Tauri invoke()                            │
│    const available = await invoke('check_docker');          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Tauri Core: IPC Bridge                                   │
│    - Serialize command and arguments                         │
│    - Route to registered command handler                     │
│    - Apply security policies                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Backend: Execute Rust Function                           │
│    pub async fn check_docker() -> Result<bool, String>      │
│    - Connect to Docker daemon                                │
│    - Execute ping command                                    │
│    - Return result                                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Tauri Core: Return Response                              │
│    - Serialize result                                        │
│    - Send via IPC to frontend                                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Frontend: Handle Response                                │
│    - Update UI state                                         │
│    - Display status to user                                  │
└──────────────────────────────────────────────────────────────┘
```

### Event System

Tauri supports bidirectional communication:

**Backend → Frontend** (Events):
```rust
// Backend emits event
app.emit_all("docker-status-changed", DockerStatus { available: true })?;
```

```typescript
// Frontend listens for event
import { listen } from '@tauri-apps/api/event';

await listen('docker-status-changed', (event) => {
  console.log('Docker status:', event.payload);
});
```

## Security Architecture

### Content Security Policy

Configured in `tauri.conf.json`:

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.datadoghq-browser-agent.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.openrouter.ai wss: ws: http://localhost:*"
  }
}
```

**Security Layers**:

1. **CSP (Content Security Policy)**: Restricts resource loading and execution
2. **IPC Allowlist**: Only registered commands can be invoked
3. **Sandboxing**: Limited system access through Tauri APIs
4. **Code Signing**: Verifies application integrity (macOS)

### Command Security

All commands must be explicitly registered:

```rust
.invoke_handler(tauri::generate_handler![
    commands::check_docker,  // Must be listed here
])
```

Frontend cannot invoke arbitrary Rust functions - only registered commands.

## Docker Integration Architecture

### Connection Management

```rust
// Singleton pattern for Docker client
lazy_static! {
    static ref DOCKER: Docker = Docker::connect_with_local_defaults()
        .expect("Failed to connect to Docker");
}

// Or on-demand connection
pub async fn get_docker_client() -> Result<Docker, DockerError> {
    Docker::connect_with_local_defaults()
        .map_err(|e| DockerError::ConnectionError(e.to_string()))
}
```

### API Abstraction

```
Frontend                 Docker Module           Bollard Library
   │                          │                        │
   ├─check_docker()───────────→│                        │
   │                          ├─connect()──────────────→│
   │                          │                        │
   │                          ├─ping()─────────────────→│
   │                          │                        │
   │                          │←─Result<()>────────────┤
   │←─Result<bool>────────────┤                        │
   │                          │                        │
```

### Future Container Management

Planned architecture for container operations:

```rust
// Container lifecycle management
pub struct ContainerManager {
    docker: Docker,
}

impl ContainerManager {
    pub async fn list_containers(&self) -> Result<Vec<Container>, DockerError>;
    pub async fn start_container(&self, id: &str) -> Result<(), DockerError>;
    pub async fn stop_container(&self, id: &str) -> Result<(), DockerError>;
    pub async fn remove_container(&self, id: &str) -> Result<(), DockerError>;
    pub async fn get_logs(&self, id: &str) -> Result<String, DockerError>;
}
```

## Build Architecture

### Development Build

```
┌─────────────────────────────────────────┐
│  cargo tauri dev                        │
└─────────────────────────────────────────┘
            │
            ├─→ Start Next.js dev server (port 3000)
            │   └─ Hot reload enabled
            │
            └─→ Compile Rust (debug mode)
                └─ Launch Tauri window
                  └─ Connect to http://localhost:3000
```

**Characteristics**:
- Debug symbols included
- Optimizations disabled
- DevTools auto-open
- Fast compilation
- Hot reload support

### Production Build

```
┌─────────────────────────────────────────┐
│  cargo tauri build                      │
└─────────────────────────────────────────┘
            │
            ├─→ Build Next.js (npm run build:export)
            │   ├─ Production optimizations
            │   ├─ Static HTML/CSS/JS
            │   └─ Output to out/
            │
            └─→ Compile Rust (release mode)
                ├─ Full optimizations
                ├─ Strip debug symbols
                └─ Bundle with frontend
                  └─ Create installers (DMG, etc.)
```

**Optimizations**:
- Rust: LTO, opt-level=3, codegen-units=1
- Frontend: Minification, tree-shaking, code splitting
- Assets: Image optimization, font subsetting

## Dependencies

### Rust Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
bollard = "0.18"           # Docker API client
mdns-sd = "0.11"           # mDNS service discovery
thiserror = "2"            # Error handling
```

**Rationale**:

- **tauri**: Core framework for desktop app
- **tokio**: Async runtime for Docker operations
- **bollard**: Official Docker API client (async)
- **serde**: Serialization for IPC communication
- **thiserror**: Ergonomic error definitions
- **mdns-sd**: Future service discovery (planned)

### Frontend Dependencies

Key dependencies from `package.json`:

- **next**: Web framework (static export)
- **react**: UI library
- **@tauri-apps/api**: Tauri frontend integration
- **monaco-editor**: Code editor
- **tailwindcss**: Styling

## Performance Considerations

### Bundle Size

**Comparison with Electron**:

| Aspect | Tauri | Electron |
|--------|-------|----------|
| Binary Size | 10-20 MB | 100+ MB |
| Memory Usage | 50-100 MB | 200+ MB |
| Startup Time | <1 second | 2-3 seconds |

**Optimization Strategies**:

1. **Static Export**: No Node.js runtime bundled
2. **System WebView**: No Chromium bundled
3. **Rust Binary**: Small, highly optimized
4. **LTO**: Link-Time Optimization enabled

### Runtime Performance

**IPC Overhead**:
- Command invocation: ~1-2ms
- Small payload serialization: <1ms
- Large payload (1MB JSON): ~5-10ms

**Async Operations**:
- Docker API calls: Async, non-blocking
- File I/O: Tokio async I/O
- Network requests: Tokio async HTTP

## Testing Architecture

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_docker_check() {
        let result = check_docker_available().await;
        assert!(result.is_ok());
    }
}
```

Run with: `cargo test`

### Integration Tests (Frontend)

```typescript
// tests/tauri/docker.test.ts
import { invoke } from '@tauri-apps/api/core';

describe('Docker Integration', () => {
  it('should check docker availability', async () => {
    const available = await invoke('check_docker');
    expect(typeof available).toBe('boolean');
  });
});
```

### E2E Tests

Using Tauri WebDriver for automated testing:

```javascript
// tests/e2e/app.spec.js
const { Application } = require('spectron');

describe('Application launch', function () {
  beforeEach(function () {
    this.app = new Application({
      path: './src-tauri/target/release/bundle/macos/VibeCode.app'
    });
    return this.app.start();
  });

  it('should launch successfully', async function () {
    const isVisible = await this.app.browserWindow.isVisible();
    expect(isVisible).toBe(true);
  });
});
```

## Future Architecture Enhancements

### Planned Features

1. **Plugin System**
   ```rust
   pub trait Plugin {
       fn init(&self) -> Result<()>;
       fn commands(&self) -> Vec<Command>;
   }
   ```

2. **Database Integration**
   - Embedded SQLite for local data
   - Tauri SQL plugin
   - Data persistence layer

3. **Auto-Update**
   - Tauri updater plugin
   - Delta updates
   - Background downloads

4. **System Tray**
   - Background running
   - Quick actions menu
   - Status indicators

5. **Multi-Window Support**
   - Editor in separate window
   - Terminal in separate window
   - Window state persistence

## Design Patterns

### Command Pattern

All backend operations exposed as commands:

```rust
#[command]
pub async fn operation() -> Result<Output, Error> {
    // Implementation
}
```

### Repository Pattern

Docker operations abstracted through repository:

```rust
pub trait DockerRepository {
    async fn check_available(&self) -> Result<bool, Error>;
    async fn get_version(&self) -> Result<String, Error>;
}
```

### Error Handling Pattern

Consistent error handling across layers:

```rust
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Docker error: {0}")]
    Docker(#[from] DockerError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
```

## Deployment Architecture

### CI/CD Pipeline

```
GitHub Actions Workflow
    ↓
[1] Checkout Code
    ↓
[2] Setup Rust + Node.js
    ↓
[3] Install Dependencies
    ↓
[4] Build Next.js Static Export
    ↓
[5] Build Tauri App (Release)
    ↓
[6] Code Sign (macOS)
    ↓
[7] Notarize with Apple
    ↓
[8] Create DMG Installer
    ↓
[9] Upload Artifacts
    ↓
[10] Create GitHub Release
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## References

- [Tauri Architecture](https://tauri.app/v2/concepts/architecture/)
- [Inter-Process Communication](https://tauri.app/v2/guides/inter-process-communication/)
- [Security Best Practices](https://tauri.app/v2/guides/security/)

---

**Last Updated**: 2025-10-01
**Tauri Version**: 2.x
**Architecture Status**: Stable, Active Development
