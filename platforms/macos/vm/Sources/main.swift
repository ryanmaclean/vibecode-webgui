import Foundation
import Virtualization

@main
struct VibeCodeVM {
    static func main() async throws {
        print("🚀 VibeCode VM - Native macOS Virtualization")
        
        let manager = VMManager()
        try await manager.start()
    }
}

class VMManager: NSObject {
    private var virtualMachine: VZVirtualMachine?
    private let vmBundlePath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".vibecode/vm")
    
    func start() async throws {
        print("📦 Initializing VM configuration...")
        
        // Create VM bundle directory
        try FileManager.default.createDirectory(
            at: vmBundlePath,
            withIntermediateDirectories: true
        )
        
        let configuration = try createVMConfiguration()
        
        print("✅ Configuration validated")
        print("🔧 Starting virtual machine...")
        
        virtualMachine = VZVirtualMachine(configuration: configuration)
        virtualMachine?.delegate = self
        
        try await virtualMachine?.start()
        
        print("✅ VM started successfully")
        print("🌐 Code-server available at: http://localhost:8080")
        print("⌨️  Press Ctrl+C to stop")
        
        // Keep running
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            // Never resume - keeps running until interrupted
        }
    }
    
    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        
        // CPU configuration (4 cores)
        config.cpuCount = min(4, ProcessInfo.processInfo.processorCount)
        
        // Memory configuration (4GB)
        config.memorySize = 4 * 1024 * 1024 * 1024
        
        // Boot loader - Linux kernel
        let bootloader = VZLinuxBootLoader(kernelURL: kernelURL())
        bootloader.initialRamdiskURL = initrdURL()
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader
        
        // Storage - main disk
        let diskURL = vmBundlePath.appendingPathComponent("disk.img")
        if !FileManager.default.fileExists(atPath: diskURL.path) {
            try createDiskImage(at: diskURL, sizeGB: 20)
        }
        
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]
        
        // Network configuration
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Serial console
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let inputFileHandle = FileHandle.standardInput
        let outputFileHandle = FileHandle.standardOutput
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputFileHandle,
            fileHandleForWriting: outputFileHandle
        )
        config.serialPorts = [serialPort]
        
        // Entropy device
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Graphics and input (headless mode)
        let graphics = VZVirtioGraphicsDeviceConfiguration()
        graphics.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080
            )
        ]
        config.graphicsDevices = [graphics]
        
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        
        try config.validate()
        
        return config
    }
    
    private func kernelURL() -> URL {
        // Check for downloaded kernel
        let downloadedKernel = vmBundlePath.appendingPathComponent("vmlinuz")
        if FileManager.default.fileExists(atPath: downloadedKernel.path) {
            return downloadedKernel
        }
        
        // Fallback to bundled kernel (if exists)
        fatalError("Kernel not found. Run: ./scripts/macos-vm/download-kernel.sh")
    }
    
    private func initrdURL() -> URL {
        let initrd = vmBundlePath.appendingPathComponent("initramfs")
        if FileManager.default.fileExists(atPath: initrd.path) {
            return initrd
        }
        
        fatalError("Initramfs not found. Run: ./scripts/macos-vm/download-kernel.sh")
    }
    
    private func createDiskImage(at url: URL, sizeGB: Int) throws {
        print("💾 Creating \(sizeGB)GB disk image...")
        
        let sizeBytes = Int64(sizeGB) * 1024 * 1024 * 1024
        FileManager.default.createFile(atPath: url.path, contents: nil)
        
        let fileHandle = try FileHandle(forWritingTo: url)
        try fileHandle.truncate(atOffset: UInt64(sizeBytes))
        try fileHandle.close()
        
        print("✅ Disk image created")
    }
}

extension VMManager: VZVirtualMachineDelegate {
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("⚠️  VM stopped")
        exit(0)
    }
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("❌ VM error: \(error.localizedDescription)")
        exit(1)
    }
}
