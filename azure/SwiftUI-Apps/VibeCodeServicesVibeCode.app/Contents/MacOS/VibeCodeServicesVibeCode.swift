// VibeCode GUI Linux VM - Based on Apple's GUILinuxVirtualMachineSampleApp
// Enhanced with sparse disk support and Datadog integration.

import Cocoa
import Virtualization

@main
class AppDelegate: NSObject, NSApplicationDelegate, VZVirtualMachineDelegate {
    
    // VM paths
    private let vmBundlePath = NSHomeDirectory() + "/VibeCode VMs/VibeCodeServices VM.bundle/"
    private var mainDiskImagePath: String { vmBundlePath + "Disk.img" }
    private var efiVariableStorePath: String { vmBundlePath + "NVRAM" }
    private var machineIdentifierPath: String { vmBundlePath + "MachineIdentifier" }
    
    // VibeCode kernel and initramfs paths
    private let projectRoot = "/Users/ryan.maclean/vibecode-webgui"
    private var kernelPath: String { projectRoot + "/azure/linux-kernel-arm64" }
    private var initramfsPath: String { projectRoot + "/azure/unified-services-with-datadog.cpio.gz" }
    
    private var window: NSWindow!
    private var virtualMachineView: VZVirtualMachineView!
    private var virtualMachine: VZVirtualMachine!
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
    
    // Create ASIF (sparse/resizable) disk image instead of raw IMG
    private func createMainDiskImage() {
        let diskURL = URL(fileURLWithPath: mainDiskImagePath)
        
        guard let diskFileHandle = try? FileHandle(forWritingTo: diskURL) else {
            fatalError("Failed to get file handle for disk")
        }
        
        do {
            // 1GB disk (sparse on APFS - starts small, grows as needed)
            try diskFileHandle.truncate(atOffset: 1 * 1024 * 1024 * 1024)
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
        bootloader.commandLine = "console=hvc0"
        
        config.bootLoader = bootloader
        config.platform = VZGenericPlatformConfiguration()
        
        // Storage: just our main disk
        config.storageDevices = [createBlockDeviceConfiguration()]
        
        config.networkDevices = [createNetworkDeviceConfiguration()]
        config.graphicsDevices = [createGraphicsDeviceConfiguration()]
        config.audioDevices = [
            createInputAudioDeviceConfiguration(),
            createOutputAudioDeviceConfiguration()
        ]
        
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        config.consoleDevices = [createSpiceAgentConsoleDeviceConfiguration()]
        
        try! config.validate()
        virtualMachine = VZVirtualMachine(configuration: config)
        
        print("✅ VM configured: \(computeCPUCount()) CPUs, \(computeMemorySize() / (1024*1024*1024))GB RAM")
    }
    
    func configureAndStartVirtualMachine() {
        DispatchQueue.main.async {
            self.createVirtualMachine()
            self.virtualMachineView.virtualMachine = self.virtualMachine
            
            if #available(macOS 14.0, *) {
                self.virtualMachineView.automaticallyReconfiguresDisplay = true
            }
            
            self.virtualMachine.delegate = self
            self.virtualMachine.start { result in
                switch result {
                case .success:
                    print("✅ VM started successfully")
                case .failure(let error):
                    fatalError("VM failed to start: \(error)")
                }
            }
        }
    }
    
    // MARK: - Application Lifecycle
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create window
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "VibeCodeServices VibeCode - VibeCode Services"
        window.center()
        
        virtualMachineView = VZVirtualMachineView()
        window.contentView = virtualMachineView
        window.makeKeyAndOrderFront(nil)
        
        NSApp.activate(ignoringOtherApps: true)
        
        // Check if disk exists
        if !FileManager.default.fileExists(atPath: vmBundlePath) {
            print("📦 Creating new VM with VibeCode services...")
            createVMBundle()
            createMainDiskImage()
        } else {
            print("🚀 Booting existing VM")
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
