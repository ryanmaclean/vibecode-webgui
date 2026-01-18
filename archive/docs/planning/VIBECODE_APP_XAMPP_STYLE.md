# VibeCode.app - XAMPP-Style Implementation

## Key Insight from XAMPP/MAMP

**They DON'T use Mac App Store** - They distribute as:
1. `.dmg` with drag-to-Applications
2. `.pkg` installer
3. Bundle everything inside the .app

## XAMPP/MAMP Architecture

```
XAMPP.app/
├── Contents/
│   ├── MacOS/
│   │   └── manager-osx (GUI controller)
│   ├── Resources/
│   │   ├── xamppfiles/
│   │   │   ├── apache/
│   │   │   ├── mysql/
│   │   │   ├── php/
│   │   │   └── perl/
│   │   └── icon.icns
│   └── Info.plist
```

**How it works**:
1. User drags XAMPP.app to Applications
2. Double-click launches GUI
3. GUI starts/stops bundled servers
4. No system modifications needed
5. Everything self-contained

## VibeCode.app - XAMPP-Style Design

### Bundle Structure

```
VibeCode.app/
├── Contents/
│   ├── MacOS/
│   │   └── VibeCode (Swift GUI)
│   ├── Resources/
│   │   ├── bin/
│   │   │   └── container (bundled CLI)
│   │   ├── containers/
│   │   │   └── code-server/ (pre-pulled image)
│   │   ├── kernels/
│   │   │   └── vmlinux (Linux kernel)
│   │   └── icon.icns
│   ├── Frameworks/
│   │   └── (Swift dependencies)
│   └── Info.plist
```

### First Launch Flow

```
User: Drags VibeCode.app to Applications
User: Double-clicks VibeCode.app
  ↓
App: Shows welcome screen
  "Welcome to VibeCode"
  [Start Server] [Preferences]
  ↓
User: Clicks "Start Server"
  ↓
App: Initializes bundled container runtime
  - Extracts container CLI to ~/Library/Application Support/VibeCode/
  - Starts container service
  - Pulls code-server image (or uses bundled)
  ↓
App: Launches code-server container
  - container run -d -p 8080:8080 codercom/code-server
  ↓
App: Shows status window
  ┌─────────────────────────────┐
  │ ⚡ VibeCode                 │
  │                             │
  │ ● Server Running            │
  │ http://localhost:8080       │
  │                             │
  │ [Open in Browser]           │
  │ [Stop Server]               │
  │ [Preferences]               │
  └─────────────────────────────┘
  ↓
User: Clicks "Open in Browser"
  ↓
App: Opens default browser to localhost:8080
```

### GUI Design (SwiftUI)

```swift
import SwiftUI

struct ContentView: View {
    @State private var serverRunning = false
    @State private var serverURL = "http://localhost:8080"
    
    var body: some View {
        VStack(spacing: 20) {
            Image("vibecode-logo")
                .resizable()
                .frame(width: 100, height: 100)
            
            Text("VibeCode")
                .font(.largeTitle)
            
            HStack {
                Circle()
                    .fill(serverRunning ? Color.green : Color.red)
                    .frame(width: 12, height: 12)
                Text(serverRunning ? "Server Running" : "Server Stopped")
            }
            
            if serverRunning {
                Text(serverURL)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Button("Open in Browser") {
                    NSWorkspace.shared.open(URL(string: serverURL)!)
                }
                .buttonStyle(.borderedProminent)
                
                Button("Stop Server") {
                    stopServer()
                }
            } else {
                Button("Start Server") {
                    startServer()
                }
                .buttonStyle(.borderedProminent)
            }
            
            Button("Preferences") {
                // Show preferences
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .frame(width: 400, height: 500)
    }
    
    func startServer() {
        // Start container service
        let task = Process()
        task.launchPath = Bundle.main.path(forResource: "container", ofType: nil, inDirectory: "Resources/bin")
        task.arguments = ["run", "-d", "-p", "8080:8080", "codercom/code-server"]
        task.launch()
        
        serverRunning = true
    }
    
    func stopServer() {
        // Stop container
        serverRunning = false
    }
}
```

### Distribution Strategy

#### Option 1: .dmg (XAMPP-style) ✅ RECOMMENDED

```
VibeCode.dmg
├── VibeCode.app
├── Applications (symlink)
└── Background image with arrow
```

**User experience**:
1. Download VibeCode.dmg
2. Open .dmg
3. Drag VibeCode.app to Applications folder
4. Eject .dmg
5. Launch VibeCode.app from Applications

**Pros**:
- Familiar to Mac users
- No installer needed
- Clean uninstall (just delete app)
- Can be notarized

**Cons**:
- Large file size (if bundling everything)
- First launch might download components

#### Option 2: .pkg Installer (MAMP-style)

```
VibeCode Installer.pkg
├── Pre-install: Check requirements
├── Install: Copy VibeCode.app
└── Post-install: Initialize services
```

**Pros**:
- Can run setup scripts
- Can install system-wide components
- Professional appearance

**Cons**:
- More complex
- Harder to uninstall
- Requires admin password

#### Option 3: Hybrid (BEST)

```
VibeCode.dmg
├── VibeCode.app (self-contained)
├── Applications (symlink)
└── Optional: Install Helper.pkg
```

**How it works**:
- VibeCode.app works standalone
- First launch downloads container CLI if needed
- Optional .pkg for system-wide installation

## Implementation Plan

### Phase 1: Self-Contained App (Week 1-2)

```swift
// VibeCode/VibeCodeApp.swift
import SwiftUI

@main
struct VibeCodeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
    }
}

// VibeCode/AppDelegate.swift
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Check if container CLI is installed
        // If not, download and install to app support directory
        setupContainerRuntime()
    }
    
    func setupContainerRuntime() {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!.appendingPathComponent("VibeCode")
        
        // Install container CLI if needed
        if !FileManager.default.fileExists(atPath: appSupport.path + "/bin/container") {
            downloadContainerCLI()
        }
    }
}
```

### Phase 2: Bundle Container Runtime (Week 3)

**Options**:

A. **Bundle container CLI binary** (50MB)
   - Include in Resources/bin/
   - Extract on first launch
   - Self-contained

B. **Download on first launch** (Smaller .dmg)
   - Check for Homebrew
   - Install via `brew install --cask container`
   - Or download directly from GitHub

C. **Hybrid** (BEST)
   - Include lightweight launcher
   - Download full runtime on first use
   - Cache in ~/Library/Application Support/

### Phase 3: Menu Bar Integration (Week 4)

```swift
class StatusBarController {
    private var statusItem: NSStatusItem!
    
    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = NSImage(named: "MenuBarIcon")
            button.action = #selector(togglePopover)
        }
        
        setupMenu()
    }
    
    func setupMenu() {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open VibeCode", action: #selector(openBrowser), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Stop Server", action: #selector(stopServer), keyEquivalent: "s"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q"))
        
        statusItem.menu = menu
    }
}
```

## Size Comparison

### XAMPP
- **Size**: ~150MB
- **Includes**: Apache, MySQL, PHP, Perl
- **Distribution**: .dmg

### MAMP
- **Size**: ~300MB
- **Includes**: Apache, MySQL, PHP, nginx
- **Distribution**: .pkg

### LocalWP
- **Size**: ~500MB
- **Includes**: Docker, WordPress, nginx
- **Distribution**: .dmg

### VibeCode (Proposed)

**Option A: Minimal** (~50MB)
- VibeCode.app GUI
- Downloads container CLI on first launch
- Downloads code-server image on first use

**Option B: Bundled** (~200MB)
- VibeCode.app GUI
- Bundled container CLI
- Bundled code-server image
- Self-contained

**Option C: Hybrid** (~100MB) ✅ RECOMMENDED
- VibeCode.app GUI
- Bundled container CLI
- Downloads code-server on first use
- Good balance

## Advantages of XAMPP-Style Approach

1. ✅ **No Mac App Store restrictions**
2. ✅ **Self-contained** - everything in one .app
3. ✅ **Familiar UX** - drag to Applications
4. ✅ **Easy uninstall** - just delete app
5. ✅ **No admin password** needed
6. ✅ **Can be notarized** for Gatekeeper
7. ✅ **Professional appearance**
8. ✅ **Works offline** (if bundled)

## Next Steps

### Immediate (This Week)
1. Create Xcode project
2. Build basic SwiftUI interface
3. Bundle container CLI
4. Test start/stop functionality

### Short Term (Next 2 Weeks)
1. Create .dmg with background
2. Code signing
3. Notarization
4. Test on fresh Mac

### Medium Term (Next Month)
1. Add menu bar integration
2. Add mDNS discovery
3. Add preferences panel
4. Beta testing

## Conclusion

**The XAMPP approach is perfect for VibeCode**:
- No Mac App Store limitations
- Self-contained distribution
- Familiar to developers
- Professional appearance
- Easy to build and maintain

**Distribution**: .dmg with drag-to-Applications
**Size**: ~100MB (hybrid approach)
**Timeline**: 2-3 weeks for v1.0

This is the middle ground you were looking for!

---

*Based on XAMPP, MAMP, and LocalWP patterns*
*October 1, 2025*
