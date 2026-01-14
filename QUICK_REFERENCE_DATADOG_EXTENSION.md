# Quick Reference: Datadog Extension in Unified-VM-Initramfs

## Current Status
✓ **INSTALLED AND VERIFIED**

## Extension Details
- **Name**: Datadog
- **ID**: datadog.datadog-vscode
- **Version**: 2.0.0
- **Location**: `/.openvscode-server/extensions/datadog.datadog-vscode-2.0.0/`
- **Files**: 27 files

## Access URLs
- **OpenVSCode**: http://localhost:8080
- **SSH**: `sshpass -p 'vibecode' ssh root@localhost -p 2222`

## Quick Verification Commands

```bash
# Check extension is installed
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ls /.openvscode-server/extensions/"

# View extension metadata
sshpass -p 'vibecode' ssh root@localhost -p 2222 "cat /.openvscode-server/extensions/datadog.datadog-vscode-2.0.0/package.json | grep -E 'name|version|displayName'"

# Check extensions registry
sshpass -p 'vibecode' ssh root@localhost -p 2222 "cat /.openvscode-server/extensions/extensions.json"

# Verify services
nc -z localhost 8080 && echo "OpenVSCode: OK"
nc -z localhost 2222 && echo "SSH: OK"
nc -z localhost 6379 && echo "Valkey: OK"
nc -z localhost 5432 && echo "PostgreSQL: OK"
```

## File Locations

### Host Machine
- **App**: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app`
- **Initramfs**: `~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz`
- **Backup**: `~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz.backup`

### Inside VM
- **Extension Source** (in initramfs): `/opt/openvscode/extensions/datadog.datadog-vscode-2.0.0/`
- **Extension Runtime** (copied at boot): `/.openvscode-server/extensions/datadog.datadog-vscode-2.0.0/`
- **Init Script**: `/init`

## Size Information
- **Old initramfs**: 112 MB
- **New initramfs**: 120 MB
- **Increase**: +8 MB (compressed)
- **Extension uncompressed**: 41 MB

## How to View Extension in OpenVSCode

1. Open http://localhost:8080 in your browser
2. Wait for OpenVSCode to load
3. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
4. Look for "Datadog" in the Extensions panel
5. Click on it to view details and configure

## Troubleshooting

### Extension not showing up?
```bash
# Check if extension exists
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ls -la /.openvscode-server/extensions/"

# Check OpenVSCode logs
sshpass -p 'vibecode' ssh root@localhost -p 2222 "tail -100 /tmp/openvscode.log"

# Restart the app
killall UnifiedServicesVibeCode
open ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
```

### VM not responding?
```bash
# Check if app is running
ps aux | grep UnifiedServicesVibeCode

# Check if ports are open
nc -z localhost 2222 && echo "SSH OK" || echo "SSH FAILED"
nc -z localhost 8080 && echo "OpenVSCode OK" || echo "OpenVSCode FAILED"
```

### Need to restore backup?
```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/
cp unified-vm-initramfs.cpio.gz.backup unified-vm-initramfs.cpio.gz
```

## Success Indicators

When everything is working, you should see:
- ✓ App running with PID
- ✓ SSH accessible on port 2222
- ✓ OpenVSCode accessible on port 8080
- ✓ Extension directory exists with 27 files
- ✓ extensions.json contains datadog entry
- ✓ Extension visible in OpenVSCode Extensions panel

## Next Actions

To actually use the Datadog extension:
1. Configure your Datadog API key (if needed)
2. Set up Datadog organization settings
3. Start using Datadog features in your code
4. View Datadog insights in the OpenVSCode interface

## Documentation
- Full summary: `DATADOG_EXTENSION_ADDED_SUMMARY.md`
- Previous work: `DATADOG_EXTENSION_COMPLETE.md`
- Related docs: `DATADOG-*` markdown files in project root
