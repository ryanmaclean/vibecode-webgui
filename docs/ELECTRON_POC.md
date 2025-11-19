# Electron Proof of Concept - VibeCode

If you decide to explore Electron as an alternative to Tauri for Chromium consistency, here's a quick POC to evaluate feasibility.

## Why This POC?

- Test Chromium rendering of OpenVSCode Server
- Measure binary size and performance
- Validate Rust backend integration approach
- Make informed decision vs Tauri

## Quick Start (30 minutes)

### Step 1: Create POC Directory

```bash
cd /Users/studio/vibecode-webgui
mkdir electron-poc
cd electron-poc
```

### Step 2: Initialize Electron Project

```bash
npm init -y
npm install electron electron-builder
```

### Step 3: Create Main Process (main.js)

```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let rustBackend;

// Start Rust backend as HTTP server
function startRustBackend() {
  const rustBinary = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'vibecode');

  // Run Rust binary in server mode
  rustBackend = spawn(rustBinary, ['--server-mode'], {
    stdio: 'inherit'
  });

  rustBackend.on('error', (err) => {
    console.error('Failed to start Rust backend:', err);
  });

  // Give backend time to start
  return new Promise(resolve => setTimeout(resolve, 2000));
}

async function createWindow() {
  // Start Rust backend first
  await startRustBackend();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load OpenVSCode Server
  mainWindow.loadURL('http://localhost:8080');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (rustBackend) {
    rustBackend.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

### Step 4: Create Preload Script (preload.js)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to frontend
contextBridge.exposeInMainWorld('vibeCodeAPI', {
  // Call Rust backend via HTTP
  async callRustCommand(command, args) {
    const response = await fetch(`http://localhost:9876/api/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return response.json();
  },

  // Example: Docker status
  async getDockerStatus() {
    return this.callRustCommand('docker/status', {});
  },

  // Example: Start VM
  async startVM(vmName) {
    return this.callRustCommand('vm/start', { name: vmName });
  }
});
```

### Step 5: Update package.json

```json
{
  "name": "vibecode-electron-poc",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "NODE_ENV=development electron .",
    "build": "electron-builder",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win",
    "build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.vibecode.electron",
    "productName": "VibeCode",
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "zip"]
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Development"
    },
    "extraResources": [
      {
        "from": "../src-tauri/target/release/vibecode",
        "to": "backend/vibecode"
      }
    ]
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0"
  }
}
```

### Step 6: Modify Rust Backend for HTTP Mode

Add to `/Users/studio/vibecode-webgui/src-tauri/src/main.rs`:

```rust
use clap::Parser;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Run as HTTP server instead of Tauri app
    #[arg(long)]
    server_mode: bool,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    if cli.server_mode {
        // Run as HTTP server for Electron
        run_http_server().await;
    } else {
        // Run normal Tauri app
        run_tauri_app();
    }
}

async fn run_http_server() {
    use axum::{Router, routing::{get, post}};

    let app = Router::new()
        .route("/api/docker/status", get(api_docker_status))
        .route("/api/vm/start", post(api_vm_start))
        .route("/api/vm/stop", post(api_vm_stop));

    println!("🦀 Rust backend listening on http://127.0.0.1:9876");

    axum::Server::bind(&"127.0.0.1:9876".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

fn run_tauri_app() {
    // Existing Tauri code
    tauri::Builder::default()
        // ... existing setup ...
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// HTTP API handlers
async fn api_docker_status() -> axum::Json<DockerStatusResponse> {
    // Reuse existing command logic
    let status = commands::get_docker_status().await;
    axum::Json(status)
}

async fn api_vm_start(
    axum::Json(payload): axum::Json<VmStartRequest>
) -> axum::Json<VmStartResponse> {
    let result = commands::start_lima_vm().await;
    axum::Json(result)
}
```

Add dependencies to `Cargo.toml`:

```toml
[dependencies]
# Existing dependencies...
clap = { version = "4.5", features = ["derive"] }
axum = "0.7"
tower = "0.5"
tower-http = { version = "0.6", features = ["cors"] }
```

## Step 7: Test the POC

```bash
# Terminal 1: Start OpenVSCode Server
cd /Users/studio/vibecode-webgui
# (however you normally start code-server)

# Terminal 2: Build Rust backend with HTTP mode
cd src-tauri
cargo build --release

# Terminal 3: Run Electron
cd ../electron-poc
npm start
```

## Evaluation Checklist

### Performance
- [ ] Initial launch time vs Tauri: _____ seconds
- [ ] Memory usage: _____ MB (compare to Tauri's _____ MB)
- [ ] CPU usage at idle: _____ %
- [ ] Battery impact on laptop (if applicable)

### Binary Size
```bash
# After building:
cd electron-poc
npm run build:mac

# Check size
du -sh dist/mac/VibeCode.app
# Compare to Tauri: 5.8 MB
```

- [ ] macOS .app size: _____ MB
- [ ] Windows installer size: _____ MB
- [ ] Linux AppImage size: _____ MB

### Rendering Quality
- [ ] OpenVSCode Server renders correctly
- [ ] No CSS issues
- [ ] Monaco editor works smoothly
- [ ] Extensions load properly
- [ ] Terminal rendering is clean
- [ ] File tree performance is good

### Integration Quality
- [ ] Rust backend starts automatically
- [ ] API calls work (Docker, VM, etc.)
- [ ] Error handling is robust
- [ ] Backend shutdown is clean
- [ ] No port conflicts

### Developer Experience
- [ ] Hot reload works
- [ ] DevTools accessible
- [ ] Build time: _____ seconds
- [ ] Easy to debug
- [ ] Documentation clear

## Decision Matrix

| Criteria | Weight | Tauri Score | Electron Score | Notes |
|----------|--------|-------------|----------------|-------|
| Binary Size | 10% | 10/10 (5.8MB) | ___/10 | |
| Rendering Consistency | 40% | ___/10 | ___/10 | Critical for VSCode |
| Development Speed | 20% | ___/10 | ___/10 | |
| Performance | 15% | ___/10 | ___/10 | |
| Maintenance Burden | 15% | ___/10 | ___/10 | |
| **Total** | 100% | **___/10** | **___/10** | |

## Next Steps

### If Electron Wins:
1. Create full migration plan
2. Port all Tauri commands to HTTP API
3. Setup CI/CD for dual builds
4. Plan phased rollout

### If Tauri Wins:
1. Document WebKit quirks
2. Add platform-specific CSS
3. Setup cross-platform testing
4. File upstream bugs

## Alternative: Hybrid Approach

Keep both:

```
VibeCode Lite (Tauri)  → 5.8 MB, fast, native
VibeCode Pro (Electron) → 180 MB, consistent, full-featured
```

Users choose based on needs:
- **Lite:** Quick tasks, low resources
- **Pro:** Heavy development, need consistency

## Cost-Benefit Analysis

### Electron Migration Costs:
- Development: 2-4 weeks ($10k-$20k)
- Testing: 1 week ($5k)
- Documentation: 3 days ($2k)
- Ongoing maintenance: +10% effort
- **Total:** $17k-$27k

### Electron Benefits:
- 100% rendering consistency
- Proven VSCode ecosystem
- Easier debugging
- Better extension support
- Larger community

### Tauri Keeping Costs:
- WebKit testing: ongoing
- Platform-specific bugs: unpredictable
- User confusion: support burden
- Limited VSCode compatibility: feature gaps

### Tauri Benefits:
- Small binary size
- Lower resource usage
- Already working
- Native performance

## Recommendation Formula

```
IF (WebKit issues > 5 critical bugs)
  OR (User complaints about rendering)
  OR (VSCode extensions broken on macOS)
THEN
  Migrate to Electron
ELSE
  Stick with Tauri + document quirks
END
```

## Sample Results Template

```
=== POC Results ===
Date: _____
Tester: _____

Binary Size:
- Tauri: 5.8 MB
- Electron: _____ MB
- Difference: _____ MB (___x larger)

Performance:
- Tauri startup: _____ s
- Electron startup: _____ s
- Tauri memory: _____ MB
- Electron memory: _____ MB

Rendering:
- Critical bugs on WebKit: _____
- Works on Electron: Yes/No
- User experience: 1-10: _____

Decision: [ ] Electron [ ] Tauri [ ] Need more testing

Reasoning:
_____________________
_____________________
```

## Resources

- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-builder Docs](https://www.electron.build/)
- [Electron + Rust Examples](https://github.com/topics/electron-rust)
- [VSCode Electron Setup](https://github.com/microsoft/vscode) (reference)

---

**Time Investment:** 2-4 hours for POC
**Value:** Clear data-driven decision on rendering strategy
