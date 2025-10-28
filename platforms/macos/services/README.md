# macOS System Services for VibeCode

Production-grade system services architecture for VibeCode container runtime using launchd, XPC, and native macOS frameworks.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Space (Aqua)                     │
├─────────────────────────────────────────────────────────┤
│  VibeCode.app                      (LaunchAgent)        │
│  ├─ SwiftUI Menu Bar               ~/Library/...        │
│  ├─ Container Control UI                                │
│  └─ mDNS Session Browser                                │
│                                                          │
│         ↓ NSXPCConnection (secure IPC)                  │
│                                                          │
│  VibeCodeService.xpc               (XPC Service)        │
│  ├─ Privilege Separation                                │
│  ├─ API Gateway                                         │
│  └─ Security Validation                                 │
│                                                          │
│         ↓ Unix Domain Socket                            │
├─────────────────────────────────────────────────────────┤
│                    System Space (root)                   │
├─────────────────────────────────────────────────────────┤
│  vibecode-containerd               (LaunchDaemon)       │
│  ├─ Container Lifecycle            /Library/...         │
│  ├─ Resource Management                                 │
│  ├─ Health Monitoring                                   │
│  └─ Log Aggregation                                     │
│                                                          │
│         ↓ Apple Virtualization.framework                │
│                                                          │
│  Container Runtime                                      │
│  └─ Lightweight VMs (code-server)                       │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
macos-services/
├── launchd/                    # Launch daemon/agent plists
│   ├── com.vibecode.containerd.plist  (System daemon)
│   └── com.vibecode.app.plist         (User agent)
│
├── xpc/                        # XPC service implementation
│   ├── VibeCodeServiceProtocol.swift  (Protocol definition)
│   ├── VibeCodeService.swift          (Service implementation)
│   ├── DaemonClient.swift             (Unix socket client)
│   └── SecurityValidator.swift        (Audit token validation)
│
├── bin/                        # Management scripts
│   ├── vibecode-service               (Service control CLI)
│   └── vibecode-containerd            (Container daemon binary)
│
├── ui/                         # Native macOS UI (SwiftUI)
│   ├── MenuBarApp.swift               (Main app)
│   ├── ContainerManager.swift         (Business logic)
│   ├── Views/
│   │   ├── MenuBarContentView.swift
│   │   ├── SessionBrowserView.swift
│   │   └── PreferencesView.swift
│   └── Models/
│       └── ContainerModels.swift
│
├── installer/                  # Packaging
│   ├── build-pkg.sh                   (Create .pkg installer)
│   ├── Distribution.xml               (Installer layout)
│   ├── scripts/
│   │   ├── preinstall
│   │   └── postinstall
│   └── homebrew/
│       └── vibecode.rb                (Homebrew cask)
│
└── tests/                      # Integration tests
    ├── test-launchd.sh
    ├── test-xpc.swift
    └── test-service-lifecycle.sh
```

## Installation

### Option 1: Homebrew (Recommended)

```bash
# Install VibeCode with all dependencies
brew tap vibecode/tap
brew install --cask vibecode

# Or install directly
brew install --cask container  # Apple Container runtime
brew install --cask vibecode   # VibeCode app
```

### Option 2: Manual Installation

```bash
# 1. Install system daemon
sudo cp launchd/com.vibecode.containerd.plist /Library/LaunchDaemons/
sudo cp bin/vibecode-containerd /usr/local/bin/
sudo chmod +x /usr/local/bin/vibecode-containerd

# 2. Install user agent
cp launchd/com.vibecode.app.plist ~/Library/LaunchAgents/

# 3. Install VibeCode.app
cp -R VibeCode.app /Applications/

# 4. Install management CLI
sudo cp bin/vibecode-service /usr/local/bin/
sudo chmod +x /usr/local/bin/vibecode-service

# 5. Create required directories
sudo mkdir -p /var/log/vibecode /var/lib/vibecode /etc/vibecode

# 6. Start services
vibecode-service start
```

### Option 3: .pkg Installer

```bash
# Download and install
curl -LO https://github.com/vibecode/releases/latest/VibeCode-Installer.pkg
sudo installer -pkg VibeCode-Installer.pkg -target /
```

## Usage

### Service Management

```bash
# Start all services
vibecode-service start

# Stop all services
vibecode-service stop

# Restart services
vibecode-service restart

# Check status
vibecode-service status

# View logs
vibecode-service logs          # Last 50 lines
vibecode-service logs 100      # Last 100 lines
vibecode-service logs:follow   # Tail logs

# Health check
vibecode-service health

# Full diagnostics
vibecode-service diagnose

# Reset (stops services and removes data)
vibecode-service reset
```

### Menu Bar App

1. **Launch VibeCode.app**
   - Opens menu bar icon automatically
   - Click icon to show menu

2. **Quick Actions**
   - `⌘O` - Open in browser
   - `⌘S` - Share session
   - `⌘,` - Preferences
   - `⌘Q` - Quit

3. **Session Discovery**
   - Automatically discovers nearby VibeCode instances via mDNS
   - Click on a session to connect
   - Share your session for others to join

### Manual Container Control

```bash
# Start a container
container run -d \
  --name vibecode-dev \
  -p 8080:8080 \
  -e PASSWORD=vibecode \
  --label com.vibecode.managed=true \
  codercom/code-server:latest

# Check container status
container ps

# View container logs
container logs vibecode-dev

# Stop container
container stop vibecode-dev
```

## Configuration

### Daemon Configuration

Edit `/etc/vibecode/containerd.conf`:

```json
{
  "log_level": "info",
  "max_containers": 10,
  "default_cpu": 2,
  "default_memory": "4G",
  "container_image": "codercom/code-server:latest",
  "port_range": {
    "start": 8080,
    "end": 8089
  },
  "datadog": {
    "enabled": true,
    "api_key": "your-api-key",
    "site": "datadoghq.com"
  },
  "mdns": {
    "enabled": true,
    "service_name": "_vibecode._tcp.local"
  }
}
```

### Agent Configuration

Edit `~/Library/Preferences/com.vibecode.app.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
    <key>LaunchOnStartup</key>
    <true/>

    <key>ShowInDock</key>
    <false/>

    <key>DefaultBrowser</key>
    <string>safari</string>

    <key>Notifications</key>
    <dict>
        <key>ContainerStart</key>
        <true/>
        <key>ContainerCrash</key>
        <true/>
    </dict>
</dict>
</plist>
```

## Monitoring & Observability

### Console.app Integration

View logs in macOS Console.app:

1. Open Console.app
2. Filter by subsystem: `com.vibecode.app`
3. Filter by category:
   - `daemon` - Daemon events
   - `container` - Container lifecycle
   - `xpc` - IPC communication
   - `mdns` - Service discovery

### Activity Monitor

VibeCode processes appear in Activity Monitor:
- `VibeCode` - Menu bar app
- `vibecode-containerd` - System daemon
- `container` - Container runtime

### Datadog APM/DBM

```bash
# Enable Datadog integration
export DD_API_KEY="your-api-key"
vibecode-service restart

# View metrics in Datadog
# Service: vibecode-containerd
# Metrics:
#   - vibecode.daemon.uptime
#   - vibecode.containers.count
#   - vibecode.system.cpu_usage
#   - vibecode.system.memory_usage
```

### Health Checks

```bash
# Quick health check
vibecode-service health

# Expected output:
# ✅ Daemon is running
# ✅ Socket is accessible
# ✅ Daemon is responsive
# ✅ Container runtime is healthy
# ✅ All health checks passed

# Detailed diagnostics
vibecode-service diagnose
```

## Troubleshooting

### Daemon Won't Start

```bash
# 1. Check if already running
vibecode-service status

# 2. Check logs for errors
vibecode-service errors

# 3. Verify socket permissions
ls -l /var/run/vibecode-containerd.sock

# 4. Check launchd status
sudo launchctl print system/com.vibecode.containerd

# 5. Try manual start
sudo /usr/local/bin/vibecode-containerd --debug

# 6. Check dependencies
container version  # Should work
```

### Container Runtime Issues

```bash
# 1. Verify container CLI
which container
container version

# 2. Check virtualization framework
# Requires macOS 14.0+ and Apple Silicon or Intel with virtualization

# 3. Check resource limits
ulimit -n  # Should be ≥4096

# 4. Check disk space
df -h /var/lib/vibecode
```

### XPC Connection Failures

```bash
# 1. Verify app is running
pgrep -fl VibeCode

# 2. Check XPC service
ls -la /Applications/VibeCode.app/Contents/XPCServices/

# 3. Check security settings
spctl --assess --verbose /Applications/VibeCode.app

# 4. Reset XPC cache
sudo rm -rf /var/db/xpcd/
```

### mDNS Discovery Not Working

```bash
# 1. Check mDNS daemon
sudo launchctl list | grep mDNS

# 2. Check firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 3. Test with dns-sd
dns-sd -B _vibecode._tcp

# 4. Check network connectivity
ping -c 1 $(hostname).local
```

### Performance Issues

```bash
# 1. Check resource usage
vibecode-service diagnose

# 2. Check container resource limits
container stats

# 3. Check file descriptor usage
lsof -p $(pgrep vibecode-containerd) | wc -l

# 4. Check log rotation
ls -lh /var/log/vibecode/
```

## Security

### Sandboxing

VibeCode.app runs in a sandboxed environment with limited entitlements:

- ✅ Network client/server (for local web server)
- ✅ User-selected file access (workspace folders)
- ✅ XPC service communication
- ❌ No system-wide file access
- ❌ No kernel extensions
- ❌ No privileged operations (handled by daemon)

### Audit Token Validation

XPC service validates all connections using audit tokens:

```swift
// Only accept connections from VibeCode.app bundle
func validateConnection(_ connection: NSXPCConnection) -> Bool {
    let token = connection.auditToken
    let bundleID = getBundleID(from: token)
    return bundleID == "com.vibecode.app"
}
```

### SIP Compliance

- ✅ No system partition modifications
- ✅ No kernel extensions
- ✅ No NVRAM manipulation
- ✅ Uses only user-approved entitlements
- ✅ Runs with System Integrity Protection enabled

## Development

### Building from Source

```bash
# 1. Clone repository
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui

# 2. Build Tauri app with Rust daemon
cd src-tauri
cargo build --release

# 3. Build XPC service
cd ../macos-services/xpc
swift build -c release

# 4. Create app bundle
cd ../..
npm run tauri:build

# 5. Sign and notarize
./scripts/sign-and-notarize.sh
```

### Running Tests

```bash
# Unit tests (XCTest)
cd macos-services/xpc
swift test

# Integration tests
cd ../tests
./test-service-lifecycle.sh
./test-xpc.swift
./test-launchd.sh

# E2E tests
cd ../../src-tauri
cargo test
```

### Debugging

```bash
# Enable debug logging
export VIBECODE_LOG_LEVEL=debug
vibecode-service restart

# Debug daemon
sudo lldb /usr/local/bin/vibecode-containerd

# Debug XPC service
lldb /Applications/VibeCode.app/Contents/MacOS/VibeCode

# View unified logs
log stream --predicate 'subsystem == "com.vibecode.app"' --level debug
```

## Upgrade Procedures

### Zero-Downtime Upgrade

```bash
# Automatic upgrade via Homebrew
brew upgrade vibecode

# Manual upgrade
./scripts/upgrade-vibecode.sh

# Upgrade process:
# 1. Health check (abort if unhealthy)
# 2. Backup current configuration
# 3. Stop user-facing services
# 4. Upgrade daemon with rollback capability
# 5. Health check (rollback on failure)
# 6. Restart user services
```

### Rollback

```bash
# If upgrade fails, rollback is automatic
# Manual rollback:
cd /tmp/vibecode-backup-*
sudo cp vibecode-containerd /usr/local/bin/
sudo launchctl load /Library/LaunchDaemons/com.vibecode.containerd.plist
```

## Uninstallation

```bash
# Complete uninstall (removes everything)
vibecode-service uninstall

# Or via Homebrew
brew uninstall --cask vibecode

# Manual cleanup
sudo launchctl unload /Library/LaunchDaemons/com.vibecode.containerd.plist
launchctl unload ~/Library/LaunchAgents/com.vibecode.app.plist
sudo rm -rf /var/lib/vibecode /var/log/vibecode /etc/vibecode
rm -rf ~/Library/Application\ Support/com.vibecode
```

## FAQ

**Q: Why use launchd instead of systemd?**
A: macOS doesn't have systemd. launchd is the native service manager and provides superior integration with macOS features like socket activation, resource limits, and Aqua session management.

**Q: Do I need root access?**
A: Only for initial installation and daemon management. The menu bar app runs in user context.

**Q: Can I run multiple containers?**
A: Yes, the daemon supports up to 10 concurrent container instances (configurable).

**Q: Does it work with SIP enabled?**
A: Yes, fully SIP-compliant. No kernel extensions or system modifications required.

**Q: How does mDNS discovery work?**
A: Uses Bonjour (Apple's mDNS implementation) to advertise and discover VibeCode instances on the local network.

**Q: What about Windows/Linux?**
A: This architecture is macOS-specific. For other platforms, we use systemd (Linux) and Windows Services.

**Q: Can I customize the container image?**
A: Yes, edit `/etc/vibecode/containerd.conf` to specify a different image.

## Support

- Documentation: https://docs.vibecode.dev/macos
- Issues: https://github.com/vibecode/vibecode-webgui/issues
- Slack: https://vibecode.slack.com/channels/macos-support
- Email: support@vibecode.dev

## License

MIT License - see LICENSE file for details

---

**Built by Agent 28 - Staff Systems Engineer**
*Google macOS Infrastructure Team*
