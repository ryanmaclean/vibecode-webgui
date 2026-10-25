# VibeCode Swift App - Quick Fix

## 🐛 **Issue:** No VMs showing in sidebar

### **Root Cause:**
Symlinks in the app bundle don't resolve correctly when the app runs.

### **Fix Applied:**
Updated `VMManager.swift` to search for VMs in multiple locations:
1. App bundle `Resources/vms` (for distribution)
2. Development location `/Users/ryan.maclean/vibecode-webgui/dist/vm-images` (for testing)
3. User Application Support `~/Library/Application Support/VibeCode/vms`

### **Quick Test:**
```bash
cd VibeCodeSwift
.build/release/VibeCode
```

**Look for console output showing:**
```
✅ Found VMs in dev location: /Users/ryan.maclean/vibecode-webgui/dist/vm-images
✅ Found 1 VMs
```

### **Expected Behavior:**
- Sidebar shows "PostgreSQL" VM with blue cylinder icon
- Click it to see details
- Click "Start VM" to boot

### **If still not working:**

**Option 1: Copy VMs to app bundle** (instead of symlinks)
```bash
cd VibeCodeSwift
rm -rf .build/release/VibeCode.app/Contents/Resources/vms
mkdir -p .build/release/VibeCode.app/Contents/Resources/vms
cp /Users/ryan.maclean/vibecode-webgui/dist/vm-images/vibecode-postgresql* \
   .build/release/VibeCode.app/Contents/Resources/vms/
```

**Option 2: Run from terminal to see debug output**
```bash
cd VibeCodeSwift
.build/release/VibeCode 2>&1 | grep -E "Found|VMs|❌"
```

**Option 3: Use absolute paths** (already done - should work now!)

### **Next Steps:**
1. Close and reopen the app
2. Check if PostgreSQL VM appears in sidebar
3. If yes → Click it and try "Start VM"
4. If no → Share console output for debugging

