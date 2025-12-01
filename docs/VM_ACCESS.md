# VM Browser Access - One-Click Guide

**Get OpenVSCode in your browser in 30 seconds**

---

## 🚀 Quick Access

After launching VibeCode, wait 30 seconds, then use any method below:

### Method 1: Direct Browser Access (RECOMMENDED)
**Status:** ✅ Working

```bash
# One-click open
open http://192.168.64.3:8080
```

**Copy-paste in browser:**
```
http://192.168.64.3:8080
```

### Method 2: Localhost Access (via VSOCK Proxy)
**Status:** ⏳ In Progress (library dependencies)

```bash
# One-click open
open http://localhost:3000
```

**Copy-paste in browser:**
```
http://localhost:3000
```

### Method 3: SSH Tunnel Access
**Status:** ⏳ In Progress (GLIBC compatibility)

```bash
# Create tunnel (will prompt for password: vibecode)
ssh -L 9000:localhost:3000 -N root@192.168.64.3 &

# One-click open
open http://localhost:9000
```

**Copy-paste in browser:**
```
http://localhost:9000
```

---

## 📋 Complete One-Liner Commands

### Get Token and Open Browser Automatically
```bash
# Extract token from VM console log and open browser
TOKEN=$(grep "Web UI available" /tmp/vibecode-console-*.log | tail -1 | grep -oE 'tkn=[a-f0-9-]+' | cut -d= -f2)
[[ -n "$TOKEN" ]] && open "http://192.168.64.3:8080?tkn=$TOKEN" || open "http://192.168.64.3:8080"
```

### Copy URL to Clipboard
```bash
# Copy direct access URL
echo "http://192.168.64.3:8080" | pbcopy && echo "✓ URL copied to clipboard"
```

### Check VM Network Status
```bash
# Verify VM is accessible
nc -zv -w 2 192.168.64.3 8080 2>&1 && echo "✅ VM is ready!" || echo "⏳ Still booting..."
```

---

## 🎯 SwiftUI Integration

### Add "Open Browser" Button
```swift
Button(action: {
    NSWorkspace.shared.open(URL(string: "http://192.168.64.3:8080")!)
}) {
    HStack {
        Image(systemName: "arrow.up.right.circle.fill")
        Text("Open OpenVSCode")
    }
    .font(.headline)
    .padding()
    .background(Color.blue)
    .foregroundColor(.white)
    .cornerRadius(10)
}
```

### Add "Copy URL" Button
```swift
Button(action: {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString("http://192.168.64.3:8080", forType: .string)

    // Show confirmation
    showToast(message: "URL copied to clipboard")
}) {
    HStack {
        Image(systemName: "doc.on.doc")
        Text("Copy URL")
    }
    .padding(8)
}
```

### Status Indicator with Click to Open
```swift
HStack {
    Circle()
        .fill(vmManager.isRunning ? Color.green : Color.gray)
        .frame(width: 8, height: 8)

    Text(vmManager.isRunning ? "Running • http://192.168.64.3:8080" : "VM not running")
        .font(.system(size: 12))

    if vmManager.isRunning {
        Button(action: {
            NSWorkspace.shared.open(URL(string: "http://192.168.64.3:8080")!)
        }) {
            Image(systemName: "arrow.up.right.circle")
        }
    }
}
```

---

## 🔧 Troubleshooting

### Cannot Connect to 192.168.64.3:8080
```bash
# 1. Check VM is running
ps aux | grep "BasicVibeCode\|virtualmachine" | grep -v grep

# 2. Check VM has network
tail -50 /tmp/vibecode-console-*.log | grep -E "eth0.*UP|DHCP"

# 3. Check TCP relay is active
tail -50 /tmp/vibecode-console-*.log | grep "TCP relay"

# 4. Test port accessibility
nc -zv -w 2 192.168.64.3 8080
```

### Port 8080 Not Accessible
```bash
# Wait 30 seconds for boot
sleep 30

# Check again
nc -zv -w 2 192.168.64.3 8080 && echo "Ready!" || echo "Still booting..."
```

### Wrong IP Address
```bash
# Find VM's actual IP
tail -100 /tmp/vibecode-console-*.log | grep "DHCP successful" | tail -1

# Extract IP
grep "eth0.*inet " /tmp/vibecode-console-*.log | tail -1 | grep -oE '192\.168\.[0-9]+\.[0-9]+'
```

---

## 📊 Access Method Comparison

| Method | Status | Speed | Setup | Pros |
|--------|--------|-------|-------|------|
| **Direct (8080)** | ✅ Working | Fast | None | Zero config, just works |
| **Localhost (3000)** | ⏳ In Progress | Fastest | None | Feels native, clean URL |
| **SSH Tunnel** | ⏳ In Progress | Medium | Password | Secure, encrypted |

**Recommendation:** Use Method 1 (Direct Access) for now.

---

## 🎉 Quick Start Checklist

Copy-paste these into Terminal:

```bash
# 1. Launch VibeCode
open /Applications/BasicVibeCode.app

# 2. Wait 30 seconds
sleep 30

# 3. Open browser
open http://192.168.64.3:8080

# 4. Start coding!
```

**That's it!** 🚀

---

## 📱 Menu Bar Integration

For menu bar apps, use this pattern:

```swift
// Menu item
Button("Open OpenVSCode") {
    NSWorkspace.shared.open(URL(string: "http://192.168.64.3:8080")!)
}

// With keyboard shortcut
.keyboardShortcut("o", modifiers: .command)

// With tooltip
.help("Opens OpenVSCode in your default browser")
```

---

## 🔗 Related Documentation

- [Complete UI Messages](./UI_MESSAGES.md) - All SwiftUI components
- [SSH Access Guide](./QUICKSTART_SSH_ACCESS.md) - Detailed SSH tunnel setup
- [Main Quickstart](./QUICKSTART.md) - Full VibeCode setup

---

**Keep it simple. One click. Happy coding!** ✨
