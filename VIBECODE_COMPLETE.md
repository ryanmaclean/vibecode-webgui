# VibeCode - Native macOS VM Manager ✅ COMPLETE

## 🎉 Status: FULLY WORKING

VibeCode is a native macOS application built with **Swift 5 + SwiftUI** that manages pre-configured Linux virtual machines using Apple's **Virtualization.framework**.

## ✅ What's Working

### 1. VM Discovery & Display
- ✅ Discovers 6 pre-configured VMs from `/dist/vm-images/`
- ✅ SwiftUI sidebar displays all VMs with icons and status
- ✅ Real-time UI updates via `@Published` properties

### 2. Datadog Integration  
- ✅ Structured JSON logging to `/logs/vibecode.log`
- ✅ All events tracked: app launch, VM discovery, VM operations
- ✅ Ready for Datadog agent monitoring

### 3. VM Management
- ✅ Start/Stop VMs using Virtualization.framework
- ✅ Proper entitlements for VM operations
- ✅ 4 CPU cores, 4GB RAM per VM
- ✅ NAT networking with port forwarding

### 4. Pre-configured VMs
1. **Pgvector** - PostgreSQL with vector extensions
2. **Ide** - VS Code Server / OpenVSCode Server
3. **Postgresql** - Standard PostgreSQL 15
4. **Nodejs** - Node.js development environment
5. **Nodejs-Codeserver** - Node.js + VS Code Server
6. **Valkey** - Redis-compatible key-value store

## 🏗️ Architecture

```
VibeCodeSwift/
├── Sources/
│   ├── VibeCodeApp.swift           # Main app entry point
│   ├── ViewModels/
│   │   └── VMManager.swift         # VM state management & Virtualization.framework
│   ├── Views/
│   │   ├── ContentView.swift       # Main UI with VM list
│   │   ├── VMDetailView.swift      # VM details & controls
│   │   └── VMListRow.swift         # Individual VM row component
│   └── Utilities/
│       └── DatadogLogger.swift     # Structured logging
├── VibeCode.entitlements           # Required permissions
└── Package.swift                   # Swift Package Manager config
```

## 🚀 Build & Run

### Quick Start
```bash
# Build and sign
./scripts/build-vibecode.sh

# Run
open VibeCodeSwift/.build/release/VibeCode.app
```

### Manual Build
```bash
cd VibeCodeSwift
swift build -c release
codesign --force --sign - --entitlements VibeCode.entitlements .build/release/VibeCode
open .build/release/VibeCode.app
```

## 📊 Datadog Setup

### Configure Datadog Agent
```bash
./scripts/setup_datadog.sh
```

This will:
1. Copy configuration to `/opt/datadog-agent/etc/conf.d/vibecode.d/conf.yaml`
2. Restart the Datadog agent
3. Start collecting logs from `/logs/vibecode.log`

### View Logs Locally
```bash
tail -f logs/vibecode.log | jq .
```

### Key Log Events
- `app_launch` - Application started
- `vm_discovery_complete` - VMs discovered (includes count and names)
- `vm_start` - VM starting
- `vm_stop` - VM stopping
- `ui_update` - SwiftUI view updated

## 🎨 UI Features

- **Liquid Glass Design**: Uses `.ultraThinMaterial` background
- **macOS Native**: Hidden title bar, unified toolbar
- **NavigationSplitView**: Sidebar + detail pane
- **Custom Icons**: Different icons per VM type (database, code, key-value)
- **Status Indicators**: Green/gray dots for running/stopped states
- **Refresh Button**: Manual VM discovery reload

## 🔧 Technical Details

### Virtualization.framework
- **Boot**: UEFI with persistent EFI variable stores (`*-efi.nvram`)
- **Disk**: RAW disk images on APFS (`*.img`)
- **CPU**: 4 cores per VM
- **Memory**: 4GB per VM
- **Network**: NAT with automatic port forwarding
- **Storage**: VirtIO block devices

### Entitlements Required
```xml
<key>com.apple.security.virtualization</key>
<true/>
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
```

### Threading & Reactivity
- `VMManager` uses `@Published` for automatic UI updates
- `DispatchQueue.main.async` ensures UI updates on main thread
- `objectWillChange.send()` forces SwiftUI refresh
- VM operations run on background threads

## 📝 Logging

All logs are structured JSON with fields:
- `timestamp` - ISO8601 timestamp
- `level` - DEBUG, INFO, WARNING, ERROR
- `message` - Human-readable message
- `service` - Always "vibecode"
- `source` - Always "swift"
- Custom attributes per event (vm_name, vm_count, error, etc.)

Example:
```json
{
  "timestamp": "2025-10-31T15:11:31Z",
  "level": "INFO",
  "message": "VM validated successfully",
  "service": "vibecode",
  "source": "swift",
  "vm_name": "vibecode-postgresql",
  "disk_path": "/Users/.../vibecode-postgresql.img"
}
```

## 🎯 Next Steps

### Completed ✅
- [x] SwiftUI native app
- [x] VM discovery from disk images
- [x] Datadog logging integration
- [x] VM list UI with icons
- [x] VM detail view
- [x] Start/Stop VM controls
- [x] Proper code signing with entitlements

### Future Enhancements
- [ ] VM console access (VZVirtualMachineView)
- [ ] Network port mapping UI
- [ ] VM creation wizard
- [ ] Snapshot management
- [ ] Performance metrics (CPU, memory, disk I/O)
- [ ] Log streaming in UI
- [ ] Auto-start VMs on app launch

## 📄 License

MIT License - See `REPOSITORY_RULES.md` for full details.

## 🔗 Related Documentation

- `DATADOG_INTEGRATION.md` - Datadog setup and log format
- `DISTRIBUTION_VM_STRATEGY.md` - VM disk image strategy
- `REPOSITORY_RULES.md` - Project rules and licenses

---

**Built with ❤️ using Swift 5, SwiftUI, and Apple Virtualization.framework**


