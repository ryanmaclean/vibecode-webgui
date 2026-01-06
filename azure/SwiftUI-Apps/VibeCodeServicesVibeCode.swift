// VibeCode GUI Linux VM - Based on Apple's GUILinuxVirtualMachineSampleApp
// Enhanced with sparse disk support and interactive serial console.
// Supports multiple instances via unique VM bundle paths.

import Cocoa
import Virtualization

@main
class AppDelegate: NSObject, NSApplicationDelegate, VZVirtualMachineDelegate, NSTextViewDelegate {
    
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
    
    // VM paths - unique per instance using UUID
    private lazy var instanceId: String = {
        if let bundlePath = Bundle.main.bundlePath as NSString? {
            let hash = abs(bundlePath.hash)
            return String(format: "%08X", hash)
        }
        return UUID().uuidString.prefix(8).lowercased()
    }()
    
    private lazy var vmBundlePath: String = {
        let basePath = NSHomeDirectory() + "/VibeCode VMs/VibeCodeServices-\(instanceId).bundle/"
        return basePath
    }()
    
    private var mainDiskImagePath: String { vmBundlePath + "Disk.img" }
    private var efiVariableStorePath: String { vmBundlePath + "NVRAM" }
    private var machineIdentifierPath: String { vmBundlePath + "MachineIdentifier" }
    
    // VibeCode kernel and initramfs paths
    private let projectRoot = "/Users/ryan.maclean/vibecode-webgui"
    private var kernelPath: String { projectRoot + "/azure/linux-kernel-arm64" }
    private var initramfsPath: String { projectRoot + "/azure/unified-services-static.cpio.gz" }
    
    private var window: NSWindow!
    private var consoleTextView: NSTextView!
    private var scrollView: NSScrollView!
    private var virtualMachine: VZVirtualMachine!
    
    // Serial console pipes
    private var inputPipe: Pipe!
    private var outputPipe: Pipe!
    private var logFileHandle: FileHandle?
    
    override init() {
        super.init()
    }
    
    // MARK: - VM Bundle Setup
    
    private func createVMBundle() {
        do {
            try FileManager.default.createDirectory(atPath: vmBundlePath, withIntermediateDirectories: true)
            appendToConsole("✅ Created VM bundle: \(vmBundlePath)\n")
        } catch {
            fatalError("Failed to create VM bundle: \(error)")
        }
    }
    
    private func createMainDiskImage() {
        let created = FileManager.default.createFile(atPath: mainDiskImagePath, contents: nil, attributes: nil)
        guard created else {
            fatalError("Failed to create disk file at: \(mainDiskImagePath)")
        }
        
        guard let diskFileHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: mainDiskImagePath)) else {
            fatalError("Failed to get file handle for disk")
        }
        
        do {
            try diskFileHandle.truncate(atOffset: 1 * 1024 * 1024 * 1024)
            try diskFileHandle.close()
            appendToConsole("✅ Created 1GB sparse disk\n")
        } catch {
            fatalError("Failed to truncate disk: \(error)")
        }
    }
    
    // MARK: - Device Configuration
    
    private func createBlockDeviceConfiguration() -> VZVirtioBlockDeviceConfiguration {
        guard let mainDiskAttachment = try? VZDiskImageStorageDeviceAttachment(
            url: URL(fileURLWithPath: mainDiskImagePath),
            readOnly: false
        ) else {
            fatalError("Failed to create disk attachment")
        }
        return VZVirtioBlockDeviceConfiguration(attachment: mainDiskAttachment)
    }
    
    private func computeCPUCount() -> Int {
        let totalCPUs = ProcessInfo.processInfo.processorCount
        var cpuCount = totalCPUs <= 1 ? 1 : totalCPUs / 2
        cpuCount = max(cpuCount, VZVirtualMachineConfiguration.minimumAllowedCPUCount)
        cpuCount = min(cpuCount, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
        return cpuCount
    }
    
    private func computeMemorySize() -> UInt64 {
        var memorySize = (4 * 1024 * 1024 * 1024) as UInt64  // 4GB
        memorySize = max(memorySize, VZVirtualMachineConfiguration.minimumAllowedMemorySize)
        memorySize = min(memorySize, VZVirtualMachineConfiguration.maximumAllowedMemorySize)
        return memorySize
    }
    
    private func createNetworkDeviceConfiguration() -> VZVirtioNetworkDeviceConfiguration {
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        return networkDevice
    }
    
    // MARK: - Console Output
    
    private func appendToConsole(_ text: String) {
        DispatchQueue.main.async {
            guard self.consoleTextView != nil else { return }
            
            // Filter ANSI escape sequences
            let filtered = self.filterAnsiEscapes(text)
            
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular),
                .foregroundColor: NSColor.green
            ]
            let attrStr = NSAttributedString(string: filtered, attributes: attrs)
            self.consoleTextView.textStorage?.append(attrStr)
            
            // Auto-scroll to bottom
            self.consoleTextView.scrollToEndOfDocument(nil)
        }
    }
    
    private func filterAnsiEscapes(_ text: String) -> String {
        // Remove ANSI escape sequences
        let pattern = "\\x1b\\[[0-9;]*[a-zA-Z]|\\x1b\\][^\\x07]*\\x07|\\x1b[\\(\\)][AB012]"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return text
        }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, options: [], range: range, withTemplate: "")
    }
    
    // MARK: - VM Creation
    
    func createVirtualMachine() {
        let config = VZVirtualMachineConfiguration()
        
        config.cpuCount = computeCPUCount()
        config.memorySize = computeMemorySize()
        
        // Linux bootloader with kernel and initramfs
        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 TERM=dumb"
        
        config.bootLoader = bootloader
        config.platform = VZGenericPlatformConfiguration()
        
        config.storageDevices = [createBlockDeviceConfiguration()]
        config.networkDevices = [createNetworkDeviceConfiguration()]
        
        // Serial console using pipes for bidirectional I/O
        inputPipe = Pipe()
        outputPipe = Pipe()
        
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        serialConfig.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        config.serialPorts = [serialConfig]
        
        // Create log file
        let logPath = vmBundlePath + "console.log"
        FileManager.default.createFile(atPath: logPath, contents: nil, attributes: nil)
        logFileHandle = FileHandle(forWritingAtPath: logPath)
        
        // Read output from VM and display in console + write to log
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty, let text = String(data: data, encoding: .utf8) {
                self?.appendToConsole(text)
                // Also write to log file
                self?.logFileHandle?.write(data)
            }
        }
        
        try! config.validate()
        virtualMachine = VZVirtualMachine(configuration: config)
        
        appendToConsole("✅ VM configured: \(computeCPUCount()) CPUs, \(computeMemorySize() / (1024*1024*1024))GB RAM\n")
    }
    
    func startVirtualMachine() {
        virtualMachine.delegate = self
        virtualMachine.start { [weak self] result in
            switch result {
            case .success:
                self?.appendToConsole("✅ VM started successfully\n\n")
            case .failure(let error):
                self?.appendToConsole("❌ VM failed to start: \(error.localizedDescription)\n")
            }
        }
    }
    
    // MARK: - NSTextViewDelegate - Handle keyboard input
    
    func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange, replacementString: String?) -> Bool {
        // Send typed characters to VM serial input
        if let text = replacementString, let data = text.data(using: .utf8) {
            if let pipe = inputPipe {
                pipe.fileHandleForWriting.write(data)
            }
        }
        return false  // Don't insert into text view - VM will echo back
    }
    
    // Handle special keys
    func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if commandSelector == #selector(NSResponder.insertNewline(_:)) {
            // Enter key
            if let data = "\n".data(using: .utf8) {
                inputPipe?.fileHandleForWriting.write(data)
            }
            return true
        } else if commandSelector == #selector(NSResponder.deleteBackward(_:)) {
            // Backspace
            let data = Data([0x7f])  // DEL character
            inputPipe?.fileHandleForWriting.write(data)
            return true
        } else if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
            // Escape / Ctrl+C
            let data = Data([0x03])  // ETX (Ctrl+C)
            inputPipe?.fileHandleForWriting.write(data)
            return true
        }
        return false
    }
    
    // MARK: - Application Lifecycle
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("🚀 VibeCodeServices starting...")
        
        // Create window with dark background
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "VibeCode Services VM [\(instanceId)]"
        window.center()
        window.backgroundColor = NSColor.black
        
        // Create scroll view with text view for console
        scrollView = NSScrollView(frame: window.contentView!.bounds)
        scrollView.autoresizingMask = [.width, .height]
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        
        consoleTextView = NSTextView(frame: scrollView.bounds)
        consoleTextView.autoresizingMask = [.width, .height]
        consoleTextView.backgroundColor = NSColor.black
        consoleTextView.textColor = NSColor.green
        consoleTextView.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        consoleTextView.isEditable = true
        consoleTextView.isSelectable = true
        consoleTextView.delegate = self
        consoleTextView.insertionPointColor = NSColor.green
        
        // Allow text view to be first responder for keyboard input
        consoleTextView.isFieldEditor = false
        
        scrollView.documentView = consoleTextView
        window.contentView = scrollView
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(consoleTextView)
        
        NSApp.activate(ignoringOtherApps: true)
        
        // Welcome message
        appendToConsole("╔══════════════════════════════════════════════════════════╗\n")
        appendToConsole("║  VibeCode Services VM - Interactive Console              ║\n")
        appendToConsole("║  Instance: \(instanceId)                                      ║\n")
        appendToConsole("╚══════════════════════════════════════════════════════════╝\n\n")
        
        // Check kernel and initramfs
        if !FileManager.default.fileExists(atPath: kernelPath) {
            appendToConsole("❌ ERROR: Kernel not found at: \(kernelPath)\n")
            return
        }
        appendToConsole("✅ Kernel: \(kernelPath)\n")
        
        if !FileManager.default.fileExists(atPath: initramfsPath) {
            appendToConsole("❌ ERROR: Initramfs not found at: \(initramfsPath)\n")
            return
        }
        appendToConsole("✅ Initramfs: \(initramfsPath)\n")
        
        // Create or use existing VM bundle
        if !FileManager.default.fileExists(atPath: vmBundlePath) {
            appendToConsole("\n📦 Creating new VM...\n")
            createVMBundle()
            createMainDiskImage()
        } else {
            appendToConsole("\n🚀 Using existing VM bundle\n")
        }
        
        appendToConsole("\n--- Booting Linux ---\n\n")
        
        createVirtualMachine()
        startVirtualMachine()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Clean up
        outputPipe?.fileHandleForReading.readabilityHandler = nil
    }
    
    // MARK: - VZVirtualMachineDelegate
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        appendToConsole("\n❌ VM stopped with error: \(error.localizedDescription)\n")
    }
    
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        appendToConsole("\n🛑 Guest OS shut down\n")
    }
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, networkDevice: VZNetworkDevice, attachmentWasDisconnectedWithError error: Error) {
        appendToConsole("\n⚠️ Network disconnected: \(error.localizedDescription)\n")
    }
}
