# OpenVSCode Terminal Color Fix Report
**Agent AF** | Date: 2026-01-14

## Problem Statement
User reported that the OpenVSCode terminal was displaying white text on white/light background instead of the intended green (#00FF00) text on black (#000000) background for a retro aesthetic.

## Root Cause Analysis

### Issue Identified
1. **Missing Settings Files**: OpenVSCode settings.json files were not being created at boot time
2. **Wrong Directory**: Settings were being created in `/root/.openvscode-server/data/` but OpenVSCode was launched with `--user-data-dir /tmp/vscode-data`
3. **No Shell Fallback**: Even if VSCode settings failed, there was no shell-level color configuration

### Settings Hierarchy in OpenVSCode
VSCode has two levels of settings:
- **Machine Settings**: `/tmp/vscode-data/Machine/settings.json` (system-wide defaults)
- **User Settings**: `/tmp/vscode-data/User/settings.json` (user preferences)

## Solution Implemented

### 1. Immediate Fix (Running VM)
Applied settings to the currently running VM:

**Created Machine Settings:**
```bash
/tmp/vscode-data/Machine/settings.json
```

**Created User Settings:**
```bash
/tmp/vscode-data/User/settings.json
```

**Both files contain:**
```json
{
  "workbench.colorTheme": "Default Dark+",
  "terminal.integrated.cursorStyle": "block",
  "terminal.integrated.cursorBlinking": true,
  "terminal.integrated.fontFamily": "monospace",
  "terminal.integrated.fontSize": 14,
  "workbench.colorCustomizations": {
    "terminal.background": "#000000",
    "terminal.foreground": "#00FF00",
    "terminalCursor.background": "#00FF00",
    "terminalCursor.foreground": "#00FF00",
    "terminal.ansiBlack": "#000000",
    "terminal.ansiRed": "#FF0000",
    "terminal.ansiGreen": "#00FF00",
    "terminal.ansiYellow": "#FFFF00",
    "terminal.ansiBlue": "#0000FF",
    "terminal.ansiMagenta": "#FF00FF",
    "terminal.ansiCyan": "#00FFFF",
    "terminal.ansiWhite": "#C0C0C0",
    "terminal.ansiBrightBlack": "#808080",
    "terminal.ansiBrightRed": "#FF8080",
    "terminal.ansiBrightGreen": "#80FF80",
    "terminal.ansiBrightYellow": "#FFFF80",
    "terminal.ansiBrightBlue": "#8080FF",
    "terminal.ansiBrightMagenta": "#FF80FF",
    "terminal.ansiBrightCyan": "#80FFFF",
    "terminal.ansiBrightWhite": "#FFFFFF"
  }
}
```

**OpenVSCode Log Confirmation:**
```
[00:25:52] [File Watcher (node.js)] [ADDED] /tmp/vscode-data/Machine/settings.json
[00:25:52] [File Watcher (node.js)] [CHANGED] /tmp/vscode-data/Machine/settings.json
[00:25:56] [File Watcher (node.js)] Started watching: '/tmp/vscode-data/Machine/settings.json'
```

### 2. Shell-Level Fallback
Added ANSI color codes to shell prompt as a backup:

**Updated /etc/profile:**
```bash
# Set green terminal colors for retro aesthetic
export PS1='\[\033[1;32m\]\u@\h:\w$ \[\033[0m\]'
export TERM=xterm-256color
export ENV=/root/.ashrc
```

**Created /root/.ashrc:**
```bash
# Green terminal colors
export PS1='\[\033[1;32m\]\u@\h:\w$ \[\033[0m\]'
export TERM=xterm-256color
```

### 3. Permanent Fix (Init Script)
Updated the init script to create these settings on every boot:

**File Modified:**
```
/Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/init
```

**Changes Made:**
- Added section 4.6 between Datadog extension setup (4.5) and OpenVSCode launch (5)
- Creates both User and Machine settings directories
- Writes settings.json to both locations
- Configures shell-level green prompt
- Total: 59 new lines added

**Backup Created:**
```
/Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/init.backup
```

## Verification Steps

### Current VM Status
1. Settings files exist in correct locations:
   - `/tmp/vscode-data/Machine/settings.json` ✓
   - `/tmp/vscode-data/User/settings.json` ✓

2. OpenVSCode detected and is watching settings:
   ```
   [File Watcher (node.js)] Started watching: '/tmp/vscode-data/Machine/settings.json'
   ```

3. Shell colors configured:
   - PS1 environment variable set to green ANSI codes ✓
   - TERM=xterm-256color ✓

### User Testing Required
Please verify the following:

1. **Open http://localhost:8080 in browser**
2. **Open terminal** (Ctrl+` or Terminal menu)
3. **Check colors**:
   - Background should be black (#000000)
   - Text should be bright green (#00FF00)
   - Cursor should be green
   - Prompt should show: `root@unified-services-vm:~$` in green

4. **Test terminal commands**:
   ```bash
   echo "This should be green"
   ls -la
   ps aux
   ```

5. **Test color persistence**:
   - Close terminal
   - Open new terminal
   - Colors should remain green on black

## Next Steps

### To Apply Permanent Fix
The init script has been updated but needs to be rebuilt into initramfs:

1. **Rebuild initramfs** with updated init script
2. **Rebuild app** with new initramfs
3. **Test fresh VM boot** to ensure colors work from startup

### Rollback Plan
If issues occur:
```bash
cp /Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/init.backup \
   /Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/init
```

## Technical Notes

### Why Both Machine and User Settings?
- **Machine settings**: System-wide defaults, applied first
- **User settings**: Can override Machine settings, preserved across updates
- Using both ensures colors work regardless of VSCode's settings precedence

### Why Shell Fallback?
- If VSCode settings fail to load or are overridden
- Shell prompt will still display in green
- Provides consistent experience regardless of VSCode configuration

### ANSI Color Codes Used
- `\[\033[1;32m\]` - Bright green text
- `\[\033[0m\]` - Reset to default

### Settings Applied
- **Theme**: Default Dark+ (VSCode's dark theme)
- **Terminal Background**: Pure black (#000000)
- **Terminal Foreground**: Pure green (#00FF00)
- **Cursor**: Green to match text
- **ANSI Colors**: Full palette for syntax highlighting

## Success Criteria Met

- [x] Settings files created in correct locations
- [x] OpenVSCode watching and applying settings
- [x] Shell-level fallback configured
- [x] Init script updated for persistence
- [x] Backup created for rollback
- [ ] **User verification pending** - Please test and confirm colors work!

## Files Modified

1. `/Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/init`
   - Added terminal color configuration section
   - 59 lines added
   - Backup: `init.backup`

2. VM Files (runtime, not persistent):
   - `/tmp/vscode-data/Machine/settings.json`
   - `/tmp/vscode-data/User/settings.json`
   - `/etc/profile`
   - `/root/.ashrc`

## Troubleshooting

### If colors still don't work:

1. **Check browser cache**: Hard refresh (Cmd+Shift+R)
2. **Check VSCode logs**:
   ```bash
   ssh -p 2222 root@localhost "tail -100 /tmp/openvscode.log | grep settings"
   ```
3. **Verify settings exist**:
   ```bash
   ssh -p 2222 root@localhost "cat /tmp/vscode-data/Machine/settings.json"
   ```
4. **Check terminal in VSCode**:
   - Open Settings (Cmd+,)
   - Search for "terminal.foreground"
   - Should show "#00FF00"

### If shell prompt isn't green:

1. **Source profile manually**:
   ```bash
   source /etc/profile
   ```
2. **Check PS1 variable**:
   ```bash
   echo $PS1
   ```
   Should show: `\[\033[1;32m\]\u@\h:\w$ \[\033[0m\]`

## Conclusion

The OpenVSCode terminal color fix has been implemented at three levels:
1. **VSCode Settings** - Proper theme configuration
2. **Shell Prompt** - ANSI color codes for fallback
3. **Init Script** - Persistence across VM restarts

The current running VM has all fixes applied and should display green text on black background. The init script has been updated to make these changes permanent in future builds.

**Status**: Ready for user verification

---
*Generated by Agent AF - Terminal Color Fix Specialist*
*For questions or issues, check the troubleshooting section above*
