# VibeCode v1.6.0-multivm

Multi-VM manager for 6 specialized Linux VMs using macOS Virtualization.framework and Swift Package Manager.

## What is VibeCode?

VibeCode is a comprehensive VM management application that discovers and launches multiple specialized Linux VMs for different development purposes. Unlike BasicVibeCode (single VM), this manages 6 different VMs simultaneously.

## What's Included

- **VibeCode.dmg** (171KB) - Compact macOS application
- Native Swift multi-VM manager
- Support for 6 VM configurations:
  - IDE (OpenVSCode)
  - Nodejs
  - Nodejs-Codeserver
  - Pgvector (PostgreSQL with vector extensions)
  - Postgresql
  - Valkey (Redis-compatible)
- JSON structured logging for observability (Datadog-compatible)

## System Requirements

- **OS**: macOS 13.0 (Ventura) or later
- **Architecture**: Apple Silicon (ARM64)
- **Memory**: 16GB RAM minimum (for running multiple VMs)
- **Disk**: 5GB free space (for VM images)
- **Permissions**: Virtualization and network access

## Prerequisites

### VM Images Required

VibeCode discovers VMs from this directory:
```
~/vibecode-webgui/dist/vm-images/
```

Each VM requires three files:
- `<name>.img` - Disk image
- `<name>.iso` - Installation/boot ISO
- `<name>.nvram` - NVRAM/EFI variables

### Setting Up VM Images

1. Create the VM images directory:
```bash
mkdir -p ~/vibecode-webgui/dist/vm-images
```

2. Place your VM images in this directory. Example structure:
```
~/vibecode-webgui/dist/vm-images/
├── vibecode-ide.img
├── vibecode-ide.iso
├── vibecode-ide.nvram
├── vibecode-nodejs.img
├── vibecode-nodejs.iso
├── vibecode-nodejs.nvram
... (and so on)
```

3. VibeCode will automatically discover all VMs with matching `.img`, `.iso`, and `.nvram` files.

## Installation

1. Download `VibeCode.dmg` (171KB)
2. Verify checksum (see below)
3. Open the DMG file
4. Drag `VibeCode.app` to your Applications folder
5. First launch: Right-click → Open (to bypass Gatekeeper)

## Using VibeCode

### Launch the Application

```bash
# From Finder
Double-click VibeCode.app in Applications

# From Terminal
open /Applications/VibeCode.app
```

### What to Expect

When you launch VibeCode:

1. **VM Discovery** (1-2 seconds)
   - Application scans `~/vibecode-webgui/dist/vm-images/`
   - Lists all available VMs with matching files
   - Log entry: `VM discovery completed` with count

2. **Main Interface**
   - List of discovered VMs with status indicators
   - Each VM shows:
     - Name
     - Status (Stopped/Starting/Running)
     - CPU count
     - Memory allocation
     - Network status

3. **Starting VMs**
   - Select a VM from the list
   - Click "Start" button
   - VM boots in background (10-30 seconds depending on VM type)
   - Network configures automatically via DHCP
   - Status updates to "Running" when ready

4. **Viewing VM Details**
   - Click on a running VM to see:
     - IP address
     - Port mappings
     - Service URLs (e.g., OpenVSCode, PostgreSQL)
     - Console log output

5. **Stopping VMs**
   - Select a running VM
   - Click "Stop" button
   - VM shuts down gracefully

### Observability

VibeCode writes structured JSON logs to:
```
~/vibecode-webgui/logs/vibecode.log
```

View logs in real-time:
```bash
tail -f ~/vibecode-webgui/logs/vibecode.log | jq
```

Log entries include:
- Timestamp (ISO8601)
- Log level (INFO, WARN, ERROR)
- VM names and counts
- Event types (vm_discovery_complete, vm_start, vm_stop, etc.)
- Service name (vibecode)

Example log entry:
```json
{
  "timestamp":"2025-11-03T21:35:33Z",
  "level":"INFO",
  "message":"VM discovery completed",
  "service":"vibecode",
  "vm_count":6,
  "vm_names":["Ide","Nodejs","Nodejs-Codeserver","Pgvector","Postgresql","Valkey"],
  "event":"vm_discovery_complete"
}
```

## Verification

**SHA256 Checksum**:
```
7f7af4a1e723c18901dce11c3ab43e6747d257e67744d98d5ae64e7b84330c07  VibeCode.dmg
```

Verify the download:
```bash
shasum -a 256 VibeCode.dmg
```

## Testing

Run the automated test script:
```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps
./test-vibecode-multivm.sh
```

This tests (23 test cases):
- Build process verification
- VM discovery (all 6 VMs)
- Observability logging
- UI components
- Individual VM launches

## Troubleshooting

### "No VMs Found"

If VibeCode doesn't discover any VMs:

1. Check the VM images directory exists:
```bash
ls -la ~/vibecode-webgui/dist/vm-images/
```

2. Verify each VM has all three required files:
```bash
# Should show .img, .iso, .nvram for each VM
cd ~/vibecode-webgui/dist/vm-images
ls -lh *.img *.iso *.nvram
```

3. Check log output for discovery errors:
```bash
tail -20 ~/vibecode-webgui/logs/vibecode.log
```

### "Cannot be opened because the developer cannot be verified"

macOS Gatekeeper blocks unsigned apps. To open:
1. Right-click VibeCode.app
2. Select "Open"
3. Click "Open" in the dialog

Or disable Gatekeeper for this app:
```bash
xattr -d com.apple.quarantine /Applications/VibeCode.app
```

### VM Won't Start

If a VM fails to start:

1. Check VM files are readable:
```bash
ls -l ~/vibecode-webgui/dist/vm-images/<vm-name>.*
```

2. Verify you have enough RAM:
```bash
# Total memory
sysctl hw.memsize

# Available memory
vm_stat | grep "Pages free"
```

3. Check console log for specific error:
```bash
tail -50 ~/vibecode-webgui/logs/vibecode.log | jq -r 'select(.level=="ERROR")'
```

4. Ensure no other apps are using virtualization

### Performance Issues

If VMs are slow or system is sluggish:

- Don't run all 6 VMs simultaneously unless you have 32GB+ RAM
- Start with 1-2 VMs at a time
- Close other memory-intensive applications
- Check Activity Monitor for memory pressure

### Logs Not Appearing

If `~/vibecode-webgui/logs/vibecode.log` isn't being created:

1. Create the directory manually:
```bash
mkdir -p ~/vibecode-webgui/logs
```

2. Restart VibeCode.app

3. Check permissions:
```bash
ls -ld ~/vibecode-webgui/logs
```

## Technical Specifications

- **Build**: Swift Package Manager (release mode)
- **Binary Size**: 517 KB (arm64)
- **VM Discovery**: Pattern matching on `.img` + `.iso` + `.nvram`
- **Logging**: JSON structured, Datadog-compatible format
- **Log Location**: `~/vibecode-webgui/logs/vibecode.log`
- **VM Images Location**: `~/vibecode-webgui/dist/vm-images/`
- **Supported VMs**: 6 (Ide, Nodejs, Nodejs-Codeserver, Pgvector, Postgresql, Valkey)

## Managed VMs

### 1. IDE (OpenVSCode)
- Browser-based VS Code
- Default port: 3000
- Access: `http://<vm-ip>:3000?tkn=<token>`

### 2. Nodejs
- Node.js development environment
- Latest LTS version

### 3. Nodejs-Codeserver
- Code-Server (VS Code in browser)
- Node.js + Code-Server combined

### 4. Pgvector (PostgreSQL + pgvector)
- PostgreSQL with vector similarity search
- Default port: 5432
- pgvector extension pre-installed

### 5. Postgresql
- Standard PostgreSQL database
- Default port: 5432

### 6. Valkey
- Redis-compatible key-value store
- Default port: 6379
- Drop-in Redis replacement

## Security

- Application requires explicit virtualization entitlements
- No data collection or telemetry
- VM networks isolated via NAT
- Logs stored locally, never transmitted

## Source Code

All source code available:
- `VibeCodeSwift/Sources/` - Main application source
- `VibeCodeSwift/Package.swift` - Swift package configuration
- `azure/SwiftUI-Apps/test-vibecode-multivm.sh` - Test script

## Known Issues

- First launch may take longer as macOS initializes VM framework
- VM discovery only checks `~/vibecode-webgui/dist/vm-images/` (hardcoded path)
- No GUI for creating/editing VM configurations (edit VM files directly)
- Log rotation not implemented (log file grows indefinitely)

## Related Releases

- **BasicVibeCode v1.0.0** - Simple single-VM launcher with OpenVSCode
- **LiquidGlassVibeCode v1.0.0** - Full observability stack (logs, metrics, traces)

## Support

Report issues: https://github.com/ryanmaclean/vibecode-webgui/issues

---

Generated with Claude Code - https://claude.com/claude-code
