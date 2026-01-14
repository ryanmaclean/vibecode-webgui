# VibeCode v3.2.1 Download and Installation Instructions

## Download

### Direct Download Link
**Download:** [VibeCode-Unified-v3.2.1-Datadog.dmg](https://github.com/ryanmaclean/vibecode-webgui/releases/download/v3.2.1/VibeCode-Unified-v3.2.1-Datadog.dmg)

**Size:** 253 MB

### Checksum Verification

After downloading, verify the integrity of the DMG file:

```bash
shasum -a 256 VibeCode-Unified-v3.2.1-Datadog.dmg
```

**Expected SHA256:**
```
837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff
```

If the checksum doesn't match, do not install the application and report the issue.

## System Requirements

- **Operating System:** macOS 12.0 (Monterey) or later
- **Architecture:** Apple Silicon (M1/M2/M3) or Intel
- **RAM:** 8 GB minimum (16 GB recommended)
- **Disk Space:** 2 GB free space minimum
- **Network:** Internet connection required for initial setup

## Installation Steps

### 1. Download the DMG
Click the download link above or visit the [release page](https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v3.2.1).

### 2. Verify the Checksum (Recommended)
```bash
shasum -a 256 ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg
```

### 3. Mount the DMG
Double-click the downloaded DMG file to mount it.

### 4. Install the Application
Drag the **VibeCode Unified** app to your **Applications** folder.

### 5. First Launch
1. Open **Applications** folder
2. Right-click on **VibeCode Unified** and select **Open**
3. Click **Open** in the security dialog (first launch only)
4. The menubar icon will appear at the top of your screen
5. Wait 30-60 seconds for all services to start

### 6. Access Services
Click the menubar icon to access:
- **OpenVSCode Server** - Full VS Code in your browser
- **Redis** - In-memory data store
- **PostgreSQL** - Relational database
- **Valkey** - Redis alternative
- **Adminer** - Database management UI
- **Datadog Extension** - Pre-installed in OpenVSCode

## What's New in v3.2.1

### Datadog Extension Pre-installed
- Datadog VSCode extension now comes pre-installed
- No manual installation needed
- Ready to use immediately after first launch
- Integrated with OpenVSCode Server

### Features
- **All Services Running:** OpenVSCode, PostgreSQL, Redis, Valkey, Adminer
- **Localhost Access:** All services accessible via localhost URLs
- **Menubar App:** Native macOS interface with service status
- **IP Address Display:** Easy-to-read service URLs
- **Automatic Startup:** All services start automatically
- **No Docker Required:** Native virtualization using vfkit

## Troubleshooting

### DMG Won't Open
- **Issue:** "VibeCode-Unified-v3.2.1-Datadog.dmg is damaged and can't be opened"
- **Solution:** macOS may have blocked the file. Run:
  ```bash
  xattr -cr ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg
  ```

### App Won't Open
- **Issue:** Security warning prevents opening
- **Solution:** Right-click the app and select "Open" instead of double-clicking

### Services Not Starting
- **Issue:** Services show as "Not Ready" after 2 minutes
- **Solution:** 
  1. Quit the app completely (⌘Q)
  2. Wait 10 seconds
  3. Restart the app
  4. Wait 60 seconds for services to initialize

### IP Address Not Showing
- **Issue:** IP address shows as "Detecting..." indefinitely
- **Solution:** This is a known issue; the IP will appear within 30-60 seconds

### Datadog Extension Not Visible
- **Issue:** Datadog extension not showing in Extensions sidebar
- **Solution:** 
  1. Open OpenVSCode Server
  2. Press ⌘⇧X to open Extensions sidebar
  3. Search for "Datadog"
  4. The extension should appear as installed

## Uninstallation

To completely remove VibeCode:

1. **Quit the Application**
   ```bash
   pkill -f "VibeCode Unified"
   ```

2. **Remove the App**
   ```bash
   rm -rf /Applications/VibeCode\ Unified.app
   ```

3. **Remove VM Data (Optional)**
   ```bash
   rm -rf ~/Library/Application\ Support/VibeCode
   ```

4. **Remove Preferences (Optional)**
   ```bash
   defaults delete com.vibecode.unified
   ```

## Support

- **Issues:** [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Documentation:** [GitHub Repository](https://github.com/ryanmaclean/vibecode-webgui)
- **Release Notes:** [v3.2.1 Release](https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v3.2.1)

## Security Notes

- The DMG is not code-signed with an Apple Developer certificate
- You will need to explicitly allow the app to run via System Preferences
- All services run locally within a sandboxed VM
- No external network access required after initial download
- Verify the checksum before installation

## Quick Start Commands

After installation, access services at:

```bash
# OpenVSCode Server
open http://localhost:8080

# Adminer (Database UI)
open http://localhost:9000

# PostgreSQL (via Adminer or psql)
psql -h localhost -p 5432 -U postgres -d postgres

# Redis
redis-cli -h localhost -p 6379

# Valkey
redis-cli -h localhost -p 6378
```

## License

See the [LICENSE](https://github.com/ryanmaclean/vibecode-webgui/blob/main/LICENSE) file in the repository.

---

**Release Date:** January 14, 2026  
**Version:** v3.2.1  
**Build:** 2dc89f4a8
