# Quick Terminal Colors Test Guide

## How to Test (3 Easy Steps)

### 1. Open OpenVSCode in Browser
```
http://localhost:8080
```

### 2. Open Terminal
- Click **Terminal** menu → **New Terminal**
- Or press: **Ctrl + `** (backtick)

### 3. What You Should See
```
✓ Black background (#000000)
✓ Bright green text (#00FF00)  
✓ Green cursor (blinking block)
✓ Prompt: root@unified-services-vm:~$ (in green)
```

## Test Commands
Try running these to see colors in action:
```bash
echo "This text should be green"
ls -la
ps aux
pwd
```

## If Colors Are Still White

### Quick Fix 1: Hard Refresh Browser
```
Mac: Cmd + Shift + R
Windows/Linux: Ctrl + Shift + R
```

### Quick Fix 2: Close and Reopen Terminal
- Close terminal panel
- Open new terminal (Ctrl + `)
- Colors should now be green

### Quick Fix 3: Check Settings Were Applied
SSH into VM and verify:
```bash
ssh -p 2222 root@localhost
cat /tmp/vscode-data/Machine/settings.json
```

Should see: `"terminal.foreground": "#00FF00"`

## Expected Result
![Terminal should look like an old-school green phosphor CRT monitor]

---
**Status**: All settings have been applied to running VM
**Next Step**: User verification required!
