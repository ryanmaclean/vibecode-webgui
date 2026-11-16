# VibeCode Native Swift App - Architecture Proposal

## 🎯 **Vision: Pure Swift 5 + SwiftUI Application**

**Rationale:** Since Virtualization.framework is macOS-only, building a native Swift app provides superior performance, smaller size, and better Apple ecosystem integration than Tauri.

---

## 📦 **Architecture**

```
VibeCode.app/
├── Contents/
│   ├── MacOS/
│   │   └── VibeCode           # Single Swift binary (~2-5MB)
│   ├── Resources/
│   │   └── vms/
│   │       ├── postgresql.img (10GB)
│   │       ├── postgresql-efi.nvram
│   │       ├── valkey.img (10GB)
│   │       ├── valkey-efi.nvram
│   │       ├── nodejs.img (50GB)
│   │       └── nodejs-efi.nvram
│   └── Info.plist (with Virtualization entitlement)
```

**Single process - no IPC overhead!**

---

## 🏗️ **Code Structure**

### **Main App (SwiftUI)**
```swift
@main
struct VibeCodeApp: App {
    @StateObject private var vmManager = VMManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(vmManager)
        }
        .commands {
            MenuCommands()
        }
    }
}
```

### **VM Manager (Direct Virtualization.framework)**
```swift
import Virtualization

class VMManager: ObservableObject {
    @Published var vms: [VM] = []
    @Published var runningVMs: [String: VZVirtualMachine] = [:]
    
    func startVM(name: String) async throws {
        let config = try createVMConfig(for: name)
        let vm = VZVirtualMachine(configuration: config)
        try await vm.start()
        runningVMs[name] = vm
    }
    
    func stopVM(name: String) async throws {
        guard let vm = runningVMs[name] else { return }
        try await vm.stop()
        runningVMs.removeValue(forKey: name)
    }
    
    // ... rest of VM management
}
```

### **UI (SwiftUI + Liquid Glass)**
```swift
struct ContentView: View {
    @EnvironmentObject var vmManager: VMManager
    
    var body: some View {
        NavigationSplitView {
            VMListView()
        } detail: {
            VMDetailView()
        }
        .background(.ultraThinMaterial) // Liquid Glass effect
    }
}

struct VMListView: View {
    @EnvironmentObject var vmManager: VMManager
    
    var body: some View {
        List(vmManager.vms) { vm in
            VMRowView(vm: vm)
        }
        .listStyle(.sidebar)
    }
}
```

### **Embedded Web View (Optional)**
```swift
import WebKit

struct WebIDEView: NSViewRepresentable {
    let url: URL
    
    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.load(URLRequest(url: url))
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
```

---

## 🎨 **Liquid Glass UI (Native SwiftUI)**

```swift
struct LiquidGlassCard: View {
    var body: some View {
        VStack {
            // Content
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 10)
    }
}

struct VMStatusIndicator: View {
    let isRunning: Bool
    
    var body: some View {
        Circle()
            .fill(isRunning ? Color.green : Color.gray)
            .frame(width: 8, height: 8)
            .shadow(color: isRunning ? .green : .clear, radius: 4)
    }
}
```

---

## 📂 **Project Structure**

```
vibecode-swift/
├── VibeCode.xcodeproj
├── Sources/
│   ├── App/
│   │   ├── VibeCodeApp.swift
│   │   └── AppDelegate.swift
│   ├── ViewModels/
│   │   ├── VMManager.swift
│   │   └── SettingsManager.swift
│   ├── Views/
│   │   ├── ContentView.swift
│   │   ├── VMListView.swift
│   │   ├── VMDetailView.swift
│   │   ├── SettingsView.swift
│   │   └── Components/
│   │       ├── LiquidGlassCard.swift
│   │       ├── VMStatusIndicator.swift
│   │       └── ConnectionInfoView.swift
│   ├── Models/
│   │   ├── VM.swift
│   │   └── VMConfiguration.swift
│   ├── Services/
│   │   ├── VirtualizationService.swift
│   │   └── NetworkService.swift
│   └── Utilities/
│       ├── FileManager+Extensions.swift
│       └── Logging.swift
├── Resources/
│   ├── Assets.xcassets
│   └── vms/
│       └── (VM disk images - symlinked or copied)
└── VibeCode.entitlements
```

---

## 🚀 **Build & Distribution**

### **Xcode Project Setup**
```bash
# Create new Xcode project
xcodebuild -create-xcodeproj \
  -project vibecode-swift/VibeCode.xcodeproj

# Or use Swift Package Manager
swift package init --type executable
```

### **Info.plist**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>VibeCode</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.app</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
```

### **Entitlements**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### **Build**
```bash
# Build for release
xcodebuild -scheme VibeCode \
  -configuration Release \
  -archivePath build/VibeCode.xcarchive \
  archive

# Export app
xcodebuild -exportArchive \
  -archivePath build/VibeCode.xcarchive \
  -exportPath build/Release \
  -exportOptionsPlist ExportOptions.plist
```

---

## 📊 **Comparison: Tauri vs Swift Native**

### **Binary Size**
- Tauri: ~15MB + 75KB = ~15MB
- Swift Native: ~2-5MB (everything in one binary)
- **Winner:** Swift Native (3-7x smaller)

### **Memory Usage**
- Tauri: ~150-200MB (Rust + WebView + IPC)
- Swift Native: ~50-100MB (SwiftUI + VM)
- **Winner:** Swift Native (2-3x less)

### **Startup Time**
- Tauri: 1-2 seconds (launch Rust, WebView, IPC setup)
- Swift Native: 0.3-0.5 seconds (native launch)
- **Winner:** Swift Native (3-4x faster)

### **VM Performance**
- Tauri: IPC overhead for every VM command
- Swift Native: Direct Virtualization.framework access
- **Winner:** Swift Native (no overhead)

### **Development Experience**
- Tauri: Web stack (React, TypeScript) + Rust
- Swift Native: SwiftUI (declarative, type-safe)
- **Winner:** Swift Native (single language, Xcode tools)

### **Distribution**
- Tauri: Complex signing (Rust + JS)
- Swift Native: Standard Apple signing
- **Winner:** Swift Native (simpler)

---

## 🎯 **Migration Plan**

### **Phase 1: Port Core VM Logic** (2-4 hours)
- [ ] Create Xcode project
- [ ] Move `vz-swift/Sources/VibeCodeVM/main.swift` to SwiftUI app
- [ ] Create `VMManager` class
- [ ] Implement VM start/stop/status

### **Phase 2: Build SwiftUI Interface** (4-8 hours)
- [ ] Create main window layout
- [ ] Build VM list view
- [ ] Add VM detail view
- [ ] Implement Liquid Glass styling
- [ ] Add connection info display

### **Phase 3: Add Features** (4-8 hours)
- [ ] First-run setup flow
- [ ] VM logs viewer
- [ ] Network status
- [ ] Settings panel
- [ ] Menu bar integration

### **Phase 4: Bundle & Test** (2-4 hours)
- [ ] Add VM disk images to Resources
- [ ] Configure Info.plist
- [ ] Set up entitlements
- [ ] Build and test
- [ ] Code sign

**Total: 12-24 hours (1-3 days)**

---

## ✅ **Advantages Over Tauri**

1. **Native**: First-class macOS citizen
2. **Smaller**: 3-7x smaller binary
3. **Faster**: 3-4x faster startup
4. **Simpler**: One language, one toolchain
5. **Direct VM access**: No IPC overhead
6. **SwiftUI**: Native Liquid Glass effects
7. **Xcode**: Best-in-class IDE for macOS
8. **Signing**: Standard Apple process
9. **Licensing**: 100% Apache 2.0
10. **Future-proof**: Apple's first-party tech

---

## 🎨 **UI Preview (SwiftUI)**

```swift
struct VMCard: View {
    let vm: VM
    @EnvironmentObject var vmManager: VMManager
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: vm.icon)
                    .font(.title)
                Text(vm.name)
                    .font(.headline)
                Spacer()
                VMStatusIndicator(isRunning: vm.isRunning)
            }
            
            if vm.isRunning {
                VStack(alignment: .leading, spacing: 4) {
                    ConnectionInfoRow(
                        label: "Host",
                        value: "localhost"
                    )
                    ConnectionInfoRow(
                        label: "Port",
                        value: "\(vm.port)"
                    )
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            
            HStack {
                Button(vm.isRunning ? "Stop" : "Start") {
                    Task {
                        if vm.isRunning {
                            try? await vmManager.stopVM(name: vm.name)
                        } else {
                            try? await vmManager.startVM(name: vm.name)
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                
                if vm.isRunning {
                    Button("Connect") {
                        // Open connection
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 10)
    }
}
```

---

## 🚀 **Recommendation: Build Swift Native App**

**Reasons:**
1. Virtualization.framework is macOS-only anyway
2. We already have working Swift VM code
3. Smaller, faster, more native
4. Perfect for Liquid Glass UI
5. Simpler code signing
6. Better user experience

**Next Steps:**
1. Create Xcode project
2. Port VM manager to SwiftUI app
3. Build Liquid Glass UI
4. Bundle VM disk images
5. Ship!

**Timeline:** 1-3 days (vs 1-2 days for Tauri completion)

**Trade-off:** Lose cross-platform, but gain native quality

---

## 💭 **User Decision Points**

### **Go Swift Native if:**
- ✅ macOS-only is acceptable
- ✅ Want best performance
- ✅ Want smallest binary
- ✅ Want native Apple experience
- ✅ Have Xcode/Swift experience

### **Keep Tauri if:**
- ✅ Need Windows/Linux support later
- ✅ Prefer web tech (React/TypeScript)
- ✅ Already invested in Tauri setup
- ✅ Want to leverage existing web UI

**My recommendation:** **Swift Native** - fits VibeCode's vision perfectly!

---

Would you like me to:
1. **Create the Xcode project** and start building the Swift native app?
2. **Continue with Tauri** and finish the integration?
3. **Build both** and compare?

