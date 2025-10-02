# VibeCode.app - Native macOS Application Vision

## Current Reality vs Vision

### What We Have Now ❌
- CLI tool (`container`)
- Manual terminal commands
- No GUI
- No .app bundle
- No drag-to-Applications

### What Users Expect ✅
- VibeCode.app in /Applications
- Double-click to launch
- Menu bar integration
- Native macOS experience

## Proposed Architecture

### VibeCode.app Bundle Structure

```
VibeCode.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── VibeCode (Swift binary)
│   ├── Resources/
│   │   ├── icon.icns
│   │   └── Assets.car
│   ├── Frameworks/
│   │   └── (embedded if needed)
│   └── PlugIns/
│       └── container-runtime/ (bundled)
```

### First Launch Flow

```
User: Double-clicks VibeCode.app
  ↓
App: Checks for container CLI
  ├─ Not found → Install via Homebrew
  │   └─ Shows native dialog: "Installing dependencies..."
  └─ Found → Continue
  ↓
App: Starts container service
  └─ launchctl load com.apple.container.apiserver
  ↓
App: Launches code-server container
  └─ container run -d -p 8080:8080 codercom/code-server
  ↓
App: Opens default browser to http://localhost:8080
  OR
App: Shows embedded WebView with code-server
  ↓
App: Announces via mDNS (Bonjour)
  └─ _vibecode._tcp.local
  └─ Other users can discover and join
```

### Menu Bar Integration

```
┌─────────────────────────────┐
│ ⚡ VibeCode                 │
├─────────────────────────────┤
│ ● Running (localhost:8080)  │
│                             │
│ Open in Browser...      ⌘O  │
│ Share Session...        ⌘S  │
│ Preferences...          ⌘,  │
├─────────────────────────────┤
│ Active Sessions:            │
│   • Ryan's MacBook Pro      │
│   • Sarah's iMac            │
├─────────────────────────────┤
│ Stop Server                 │
│ Quit VibeCode           ⌘Q  │
└─────────────────────────────┘
```

## mDNS/Bonjour Discovery

### Service Advertisement

```swift
// Advertise VibeCode session
let service = NetService(
    domain: "local.",
    type: "_vibecode._tcp.",
    name: "Ryan's VibeCode",
    port: 8080
)

service.txtRecordData = [
    "version": "1.0.0",
    "user": "ryan",
    "workspace": "vibecode-project",
    "collaborative": "true"
].data()

service.publish()
```

### Discovery by Other Users

```swift
// Find nearby VibeCode sessions
let browser = NetServiceBrowser()
browser.searchForServices(ofType: "_vibecode._tcp.", inDomain: "local.")

// Results:
// - Ryan's MacBook Pro (192.168.1.100:8080)
// - Sarah's iMac (192.168.1.101:8080)
```

### User Experience

```
Sarah's Mac:
  1. Opens VibeCode.app
  2. Sees "Nearby Sessions" in sidebar
  3. Clicks "Ryan's MacBook Pro"
  4. Joins collaborative session
  5. Edits code together in real-time
```

## Collaborative Editing (SubEtha-like)

### Current State
- code-server has built-in collaboration via VS Code Live Share
- Need to enable and test

### Testing Collaborative Features

```bash
# Check if code-server has collaboration
container exec vibecode-test code-server --help | grep -i collab

# Check installed extensions
container exec vibecode-test ls /home/coder/.local/share/code-server/extensions/
```

### Implementation Options

#### Option A: VS Code Live Share (Built-in)
```typescript
// code-server supports VS Code extensions
// Install Live Share extension
{
  "extensions": [
    "ms-vsliveshare.vsliveshare"
  ]
}
```

#### Option B: Custom WebSocket (SubEtha-style)
```typescript
// Real-time collaborative editing
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';

const doc = new Y.Doc();
const wss = new WebSocketServer({ port: 8081 });

wss.on('connection', (ws) => {
  // Sync document state
  // Broadcast changes
  // Handle conflicts with CRDT
});
```

#### Option C: Operational Transform
```typescript
// Like Google Docs
import ShareDB from 'sharedb';

const backend = new ShareDB();
const connection = backend.connect();

// Real-time document sync
// Cursor positions
// User presence
```

## .pkg Installer Design

### What the .pkg Should Do

```
VibeCode Installer.pkg
├── Pre-install script:
│   └─ Check macOS version (15+)
│   └─ Check architecture (arm64)
│   └─ Check Homebrew (install if needed)
│
├── Install:
│   └─ Copy VibeCode.app to /Applications
│   └─ Install container CLI (via Homebrew)
│   └─ Set up launchd service
│
└── Post-install script:
    └─ container system start
    └─ Open VibeCode.app
    └─ Show welcome screen
```

### Installation Flow

```
User: Double-clicks "VibeCode Installer.pkg"
  ↓
Installer: Shows welcome screen
  "Welcome to VibeCode - The first cloud IDE for Apple Container"
  ↓
Installer: Checks requirements
  ✅ macOS 15.6.1 (Sequoia)
  ✅ Apple Silicon (M1 Pro)
  ⚠️  Homebrew not found
  ↓
Installer: "Install Homebrew? (Required for container runtime)"
  [Install Homebrew] [Cancel]
  ↓
Installer: Installs components
  [▓▓▓▓▓▓▓▓▓▓] Installing VibeCode.app
  [▓▓▓▓▓▓▓▓▓▓] Installing container CLI
  [▓▓▓▓▓▓▓▓▓▓] Starting services
  ↓
Installer: "Installation Complete!"
  "VibeCode.app has been installed to /Applications"
  [Open VibeCode] [Close]
```

## Testing Current Collaborative Features

Let me test what code-server already supports:

```bash
# 1. Check running container
container list

# 2. Check code-server version and features
container exec vibecode-test code-server --version

# 3. Check for collaboration extensions
container exec vibecode-test ls -la /home/coder/.local/share/code-server/extensions/

# 4. Test multi-user access
# Open http://localhost:8080 in two browsers
# See if they can edit same file
```

## Implementation Plan

### Phase 1: Native macOS App (Week 1)
- [ ] Create Xcode project
- [ ] Swift UI for main window
- [ ] Menu bar integration
- [ ] Container CLI wrapper
- [ ] Auto-start on launch

### Phase 2: mDNS Discovery (Week 2)
- [ ] Bonjour service advertisement
- [ ] Network browser UI
- [ ] Session discovery
- [ ] Join remote sessions

### Phase 3: Collaborative Editing (Week 3)
- [ ] Test VS Code Live Share
- [ ] Implement WebSocket sync
- [ ] Real-time cursor positions
- [ ] User presence indicators

### Phase 4: .pkg Installer (Week 4)
- [ ] Create installer package
- [ ] Pre/post install scripts
- [ ] Homebrew integration
- [ ] Notarization for distribution

## Questions to Answer

1. **Does code-server support multi-user editing?**
   - Need to test with multiple browsers
   - Check for built-in collaboration

2. **Can we embed WebView or use external browser?**
   - WebView: Better integration
   - External: More features

3. **How to handle authentication with mDNS?**
   - Share session tokens
   - OAuth between instances
   - Trust local network

4. **What about firewall/network restrictions?**
   - Local network only
   - VPN support
   - Tailscale integration?

## Next Steps

1. Test current code-server collaborative features
2. Create proof-of-concept Swift app
3. Implement mDNS discovery
4. Build .pkg installer
5. Submit to Mac App Store (if possible)

---

*This is the vision for a proper macOS experience*
