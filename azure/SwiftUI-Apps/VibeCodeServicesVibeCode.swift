// VibeCode GUI Linux VM - Based on Apple's GUILinuxVirtualMachineSampleApp
// Enhanced with sparse disk support and Datadog integration.

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
    
    // VM paths
    private let vmBundlePath = NSHomeDirectory() + "/VibeCode VMs/VibeCodeServices VM.bundle/"
    private var mainDiskImagePath: String { vmBundlePath + "Disk.img" }
    private var efiVariableStorePath: String { vmBundlePath + "NVRAM" }
    private var machineIdentifierPath: String { vmBundlePath + "MachineIdentifier" }
    
    // VibeCode kernel and initramfs paths
    private let projectRoot = "/Users/ryan.maclean/vibecode-webgui"
    private var kernelPath: String { projectRoot + "/azure/linux-kernel-arm64" }
    private var initramfsPath: String { projectRoot + "/azure/unified-services-static.cpio.gz" }
    
    private var window: NSWindow!
    private var virtualMachine: VZVirtualMachine!
    private var textView: NSTextView!
    private var outputPipe: Pipe!
    private var inputPipe: Pipe!
    private var logFileHandle: FileHandle?
    private let logPath = "/tmp/vibecode-vm-serial.log"
    private var installerISOPath: URL?
    private var needsInstall = true
    
    override init() {
        super.init()
    }
    
    // MARK: - VM Bundle Setup
    
    private func createVMBundle() {
        do {
            try FileManager.default.createDirectory(atPath: vmBundlePath, withIntermediateDirectories: true)
            print("✅ Created VM bundle: \(vmBundlePath)")
        } catch {
            fatalError("Failed to create VM bundle: \(error)")
        }
    }
    
    // Create sparse disk image (APFS automatically makes it sparse)
    private func createMainDiskImage() {
        // First create the empty file
        let created = FileManager.default.createFile(atPath: mainDiskImagePath, contents: nil, attributes: nil)
        guard created else {
            fatalError("Failed to create disk file at: \(mainDiskImagePath)")
        }
        
        // Now open it for writing and truncate to size
        guard let diskFileHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: mainDiskImagePath)) else {
            fatalError("Failed to get file handle for disk")
        }
        
        do {
            // 1GB disk (sparse on APFS - starts small, grows as needed)
            try diskFileHandle.truncate(atOffset: 1 * 1024 * 1024 * 1024)
            try diskFileHandle.close()
            print("✅ Created 1GB disk (sparse): \(mainDiskImagePath)")
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
        var cpuCount = totalCPUs <= 1 ? 1 : totalCPUs / 2  // Use half for guest
        cpuCount = max(cpuCount, VZVirtualMachineConfiguration.minimumAllowedCPUCount)
        cpuCount = min(cpuCount, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
        return cpuCount
    }
    
    private func computeMemorySize() -> UInt64 {
        var memorySize = (8 * 1024 * 1024 * 1024) as UInt64  // 8GB
        memorySize = max(memorySize, VZVirtualMachineConfiguration.minimumAllowedMemorySize)
        memorySize = min(memorySize, VZVirtualMachineConfiguration.maximumAllowedMemorySize)
        return memorySize
    }
    
    private func createAndSaveMachineIdentifier() -> VZGenericMachineIdentifier {
        let machineIdentifier = VZGenericMachineIdentifier()
        try! machineIdentifier.dataRepresentation.write(to: URL(fileURLWithPath: machineIdentifierPath))
        return machineIdentifier
    }
    
    private func retrieveMachineIdentifier() -> VZGenericMachineIdentifier {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: machineIdentifierPath)),
              let identifier = VZGenericMachineIdentifier(dataRepresentation: data) else {
            fatalError("Failed to retrieve machine identifier")
        }
        return identifier
    }
    
    private func createEFIVariableStore() -> VZEFIVariableStore {
        guard let store = try? VZEFIVariableStore(
            creatingVariableStoreAt: URL(fileURLWithPath: efiVariableStorePath)
        ) else {
            fatalError("Failed to create EFI variable store")
        }
        return store
    }
    
    private func retrieveEFIVariableStore() -> VZEFIVariableStore {
        return VZEFIVariableStore(url: URL(fileURLWithPath: efiVariableStorePath))
    }
    
    private func createUSBMassStorageDeviceConfiguration() -> VZUSBMassStorageDeviceConfiguration {
        guard let attachment = try? VZDiskImageStorageDeviceAttachment(
            url: installerISOPath!,
            readOnly: true
        ) else {
            fatalError("Failed to create installer attachment")
        }
        return VZUSBMassStorageDeviceConfiguration(attachment: attachment)
    }
    
    private func createNetworkDeviceConfiguration() -> VZVirtioNetworkDeviceConfiguration {
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        return networkDevice
    }
    
    private func createGraphicsDeviceConfiguration() -> VZVirtioGraphicsDeviceConfiguration {
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(widthInPixels: 1920, heightInPixels: 1080)
        ]
        return graphicsDevice
    }
    
    private func createInputAudioDeviceConfiguration() -> VZVirtioSoundDeviceConfiguration {
        let audioDevice = VZVirtioSoundDeviceConfiguration()
        let inputStream = VZVirtioSoundDeviceInputStreamConfiguration()
        inputStream.source = VZHostAudioInputStreamSource()
        audioDevice.streams = [inputStream]
        return audioDevice
    }
    
    private func createOutputAudioDeviceConfiguration() -> VZVirtioSoundDeviceConfiguration {
        let audioDevice = VZVirtioSoundDeviceConfiguration()
        let outputStream = VZVirtioSoundDeviceOutputStreamConfiguration()
        outputStream.sink = VZHostAudioOutputStreamSink()
        audioDevice.streams = [outputStream]
        return audioDevice
    }
    
    private func createSpiceAgentConsoleDeviceConfiguration() -> VZVirtioConsoleDeviceConfiguration {
        let consoleDevice = VZVirtioConsoleDeviceConfiguration()
        let spiceAgentPort = VZVirtioConsolePortConfiguration()
        spiceAgentPort.name = VZSpiceAgentPortAttachment.spiceAgentPortName
        spiceAgentPort.attachment = VZSpiceAgentPortAttachment()
        consoleDevice.ports[0] = spiceAgentPort
        return consoleDevice
    }
    
    // MARK: - VM Creation
    
    func createVirtualMachine() {
        let config = VZVirtualMachineConfiguration()
        
        config.cpuCount = computeCPUCount()
        config.memorySize = computeMemorySize()
        
        // Use Linux bootloader with our kernel and initramfs
        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        // Console to hvc0 (serial) - set TERM=dumb to avoid escape sequences
        bootloader.commandLine = "console=hvc0 TERM=dumb"
        
        config.bootLoader = bootloader
        config.platform = VZGenericPlatformConfiguration()
        
        // Storage: just our main disk
        config.storageDevices = [createBlockDeviceConfiguration()]
        
        config.networkDevices = [createNetworkDeviceConfiguration()]
        
        // Serial console - bidirectional pipes for input/output
        outputPipe = Pipe()
        inputPipe = Pipe()
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        let serialPort = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        serialConfig.attachment = serialPort
        config.serialPorts = [serialConfig]
        
        // Create log file
        FileManager.default.createFile(atPath: logPath, contents: nil, attributes: nil)
        logFileHandle = FileHandle(forWritingAtPath: logPath)
        
        // Read pipe output and display in text view + log to file
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                // Write raw to log file
                self?.logFileHandle?.write(data)
                
                if let text = String(data: data, encoding: .utf8), !text.isEmpty {
                    // Strip ANSI escape sequences that we can't render
                    let cleaned = self?.stripAnsiEscapes(text) ?? text
                    DispatchQueue.main.async {
                        self?.appendToConsole(cleaned)
                    }
                }
            }
        }
        
        try! config.validate()
        virtualMachine = VZVirtualMachine(configuration: config)
        
        print("✅ VM configured: \(computeCPUCount()) CPUs, \(computeMemorySize() / (1024*1024*1024))GB RAM")
    }
    
    func configureAndStartVirtualMachine() {
        DispatchQueue.main.async {
            self.createVirtualMachine()
            self.virtualMachine.delegate = self
            self.virtualMachine.start { result in
                switch result {
                case .success:
                    self.appendToConsole("✅ VM started successfully\n")
                case .failure(let error):
                    self.appendToConsole("❌ VM failed to start: \(error)\n")
                }
            }
        }
    }
    
    private func appendToConsole(_ text: String) {
        textView.textStorage?.append(NSAttributedString(
            string: text,
            attributes: [
                .foregroundColor: NSColor.green,
                .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
            ]
        ))
        textView.scrollToEndOfDocument(nil)
    }
    
    // Strip ANSI escape sequences that NSTextView can't render
    private func stripAnsiEscapes(_ text: String) -> String {
        // Match ESC [ ... (any params) ending with a letter
        // This covers: cursor position, colors, clear screen, etc.
        let pattern = "\\x1b\\[[0-9;?]*[A-Za-z]|\\x1b\\][^\\x07]*\\x07|\\x1b[()][AB012]"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return text
        }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, options: [], range: range, withTemplate: "")
    }
    
    // MARK: - NSTextViewDelegate - Capture keyboard input
    
    func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange, replacementString: String?) -> Bool {
        // Send typed characters to VM serial input (only if pipe is initialized)
        if let pipe = inputPipe, let text = replacementString, let data = text.data(using: .utf8) {
            pipe.fileHandleForWriting.write(data)
        }
        return false  // Don't insert into text view - VM will echo back
    }
    
    // MARK: - Application Lifecycle
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("🚀 VibeCodeServices starting...")
        
        // Create window
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "VibeCodeServices - Console"
        window.center()
        window.backgroundColor = .black
        
        // Create scrollable text view for console output
        let scrollView = NSScrollView(frame: window.contentView!.bounds)
        scrollView.autoresizingMask = [.width, .height]
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        
        textView = NSTextView(frame: scrollView.bounds)
        textView.autoresizingMask = [.width, .height]
        textView.isEditable = true  // Allow typing
        textView.backgroundColor = .black
        textView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.textColor = .green
        textView.insertionPointColor = .green
        textView.delegate = self
        
        scrollView.documentView = textView
        window.contentView = scrollView
        window.makeKeyAndOrderFront(nil)
        
        NSApp.activate(ignoringOtherApps: true)
        NSLog("Window created")
        
        // Check kernel and initramfs exist
        if !FileManager.default.fileExists(atPath: kernelPath) {
            NSLog("❌ ERROR: Kernel not found at: \(kernelPath)")
            let alert = NSAlert()
            alert.messageText = "Kernel Not Found"
            alert.informativeText = "Kernel not found at: \(kernelPath)"
            alert.runModal()
            return
        }
        NSLog("✅ Kernel found: \(kernelPath)")
        
        if !FileManager.default.fileExists(atPath: initramfsPath) {
            NSLog("❌ ERROR: Initramfs not found at: \(initramfsPath)")
            let alert = NSAlert()
            alert.messageText = "Initramfs Not Found"
            alert.informativeText = "Initramfs not found at: \(initramfsPath)"
            alert.runModal()
            return
        }
        NSLog("✅ Initramfs found: \(initramfsPath)")
        
        // Check if disk exists
        if !FileManager.default.fileExists(atPath: vmBundlePath) {
            NSLog("📦 Creating new VM with VibeCode services...")
            createVMBundle()
            createMainDiskImage()
        } else {
            NSLog("🚀 Booting existing VM")
        }
        
        // Always boot with our kernel + initramfs
        needsInstall = false
        configureAndStartVirtualMachine()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    // MARK: - VZVirtualMachineDelegate
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("❌ VM stopped with error: \(error.localizedDescription)")
    }
    
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("🛑 Guest OS shut down")
    }
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, networkDevice: VZNetworkDevice, attachmentWasDisconnectedWithError error: Error) {
        print("⚠️ Network disconnected: \(error.localizedDescription)")
    }
}
