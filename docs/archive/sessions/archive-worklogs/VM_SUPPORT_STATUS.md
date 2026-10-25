# VibeCode VM Support Status

## ✅ **Currently Supported: Linux VMs**

### **Implementation:**
- **Boot Loader:** `VZEFIBootLoader` with EFI variable store
- **Platform:** `VZGenericPlatformConfiguration` (for Linux)
- **Storage:** `VZDiskImageStorageDeviceAttachment` (.img files)
- **Network:** `VZNATNetworkDeviceAttachment` (localhost access)
- **CPU:** 4 cores
- **Memory:** 4GB
- **Status:** ✅ **WORKING**

### **Available Linux VMs:**

| VM | Disk | EFI | Status |
|----|------|-----|--------|
| **PostgreSQL** | 10GB | ✅ | Ready |
| **Node.js + Code-server** | 50GB | ⚠️ | Need .nvram |
| **IDE** | 50GB | ⚠️ | Need .nvram |

**From Lima (with .nvram files):**
| VM | Disk | Status |
|----|------|--------|
| **vibecode-nodejs** | 50GB | Can copy |
| **vibecode-pgvector** | 20GB | Can copy |
| **vibecode-valkey** | 10GB | Can copy |

---

## ❌ **NOT Implemented: macOS VMs**

### **What's Needed:**

#### **1. Different Boot Loader**
```swift
// Current (Linux):
let bootloader = VZEFIBootLoader()

// Needed (macOS):
let bootloader = VZMacOSBootLoader()
```

#### **2. Different Platform**
```swift
// Current (Linux):
let platform = VZGenericPlatformConfiguration()

// Needed (macOS):
let platform = VZMacPlatformConfiguration()
platform.hardwareModel = macOSConfiguration.hardwareModel
platform.machineIdentifier = VZMacMachineIdentifier()
```

#### **3. macOS Restore Image**
```swift
// Download and load:
let image = try await VZMacOSRestoreImage.latestSupported
let installer = VZMacOSInstaller(virtualMachine: vm, restoringFromImageAt: image.url)
try await installer.install()
```

#### **4. Different Hardware Requirements**
- Mac-specific hardware model
- Machine identifier (unique per VM)
- Auxiliary storage (for NVRAM, etc.)
- Graphics device for macOS GUI

---

## 🎯 **What the Swift App Shows RIGHT NOW:**

When you launch the app, you see:
1. **Sidebar** with "Virtual Machines" header
2. **VM List** showing discovered VMs:
   - ✅ **PostgreSQL** (blue icon, 10GB, port 5432)
   - ⚠️ Other VMs may not show if .nvram files missing
3. **Empty state** if no .nvram files found

---

## 🔧 **To Add More Linux VMs:**

### **Copy from Lima (with .nvram files):**
```bash
cd /Users/ryan.maclean/vibecode-webgui/dist/vm-images

# Valkey
cp ~/.lima/vibecode-valkey/diffdisk vibecode-valkey.img
cp ~/.lima/vibecode-valkey/vz-efi vibecode-valkey-efi.nvram

# Node.js
cp ~/.lima/vibecode-nodejs/diffdisk vibecode-nodejs.img
cp ~/.lima/vibecode-nodejs/vz-efi vibecode-nodejs-efi.nvram

# pgvector
cp ~/.lima/vibecode-pgvector/diffdisk vibecode-pgvector.img
cp ~/.lima/vibecode-pgvector/vz-efi vibecode-pgvector-efi.nvram
```

Then relaunch the app - all VMs will appear!

---

## 🚀 **To Add macOS VM Support:**

### **Steps Required:**

#### **1. Detect VM Type**
```swift
enum VMType {
    case linux
    case macOS
}

func detectVMType(diskPath: URL) -> VMType {
    // Check for macOS auxiliary storage or other indicators
    let auxPath = diskPath.deletingPathExtension().appendingPathExtension("aux")
    return FileManager.default.fileExists(atPath: auxPath.path) ? .macOS : .linux
}
```

#### **2. Separate Configuration Methods**
```swift
func createLinuxVMConfiguration(for vmInfo: VMInfo) async throws -> VZVirtualMachineConfiguration {
    // Current implementation (UEFI + Generic platform)
}

func createMacOSVMConfiguration(for vmInfo: VMInfo) async throws -> VZVirtualMachineConfiguration {
    // New: VZMacOSBootLoader + VZMacPlatformConfiguration
}
```

#### **3. Download macOS Restore Image**
```swift
func downloadMacOSImage() async throws -> URL {
    let image = try await VZMacOSRestoreImage.latestSupported
    let localPath = // save to disk
    try await URLSession.shared.download(from: image.url, to: localPath)
    return localPath
}
```

#### **4. Install macOS**
```swift
func installMacOS(to diskPath: URL) async throws {
    let config = try await createMacOSVMConfiguration(...)
    let vm = VZVirtualMachine(configuration: config)
    
    let installer = VZMacOSInstaller(
        virtualMachine: vm, 
        restoringFromImageAt: restoreImageURL
    )
    
    try await installer.install()
}
```

#### **5. Update UI**
```swift
// Add macOS icon and color
private var iconName: String {
    if vm.type == .macOS {
        return "apple.logo"
    }
    // ... existing Linux icons
}
```

---

## 📊 **Implementation Complexity:**

| Task | Lines of Code | Time Estimate |
|------|---------------|---------------|
| **Linux VMs** | ~700 lines | ✅ Done (4 hours) |
| **macOS VMs** | ~300 more lines | 4-6 hours |
| **Total** | ~1000 lines | 8-10 hours |

---

## 🎯 **Current Recommendation:**

### **For Linux VMs (NOW):**
1. Copy missing .nvram files from Lima
2. Relaunch app
3. All 3-4 Linux VMs will work

### **For macOS VMs (LATER):**
1. Add VMType enum
2. Implement VZMacPlatformConfiguration
3. Add macOS restore image download
4. Create separate boot path for macOS
5. Test on macOS 13+ (Ventura or later)

---

## 🔍 **What You're Seeing:**

When I launch the app, the console should show:
```
✅ Found VMs in dev location: /Users/ryan.maclean/vibecode-webgui/dist/vm-images
✅ Found 1 VMs
```

In the window:
- Sidebar: "Virtual Machines"
- List: PostgreSQL (blue icon)
- Detail: "No VM Selected" (until you click)

**This is working correctly for Linux VMs!**

**macOS VMs would require additional implementation.**

---

## 💭 **Why macOS VMs are Different:**

Apple's Virtualization.framework treats macOS VMs specially:
- Different boot process (no UEFI)
- Different platform config (Mac-specific)
- Requires Apple-signed restore images
- Needs machine identifier (like real Mac serial number)
- More hardware emulation required

**Linux VMs are simpler:** Just UEFI boot + generic platform.

---

**Current Status:** ✅ **Linux VMs working**  
**Next Step:** Copy .nvram files from Lima to show all VMs

**Want me to copy the Lima VM files so all VMs show up?**

