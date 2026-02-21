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

/// Custom errors for VM permission and capability issues
enum VMPermissionError: Error, CustomStringConvertible {
    case virtualizationNotSupported(String)
    case fileSystemAccessDenied(String)

    var description: String {
        switch self {
        case .virtualizationNotSupported(let message):
            return message
        case .fileSystemAccessDenied(let message):
            return message
        }
    }
}

class VMManager: NSObject {
    private var virtualMachine: VZVirtualMachine?
    private let vmBundlePath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".vibecode/vm")
    
    func start() async throws {
        print("🔐 Checking virtualization permissions...")
        try checkVirtualizationPermissions()
        print("✅ Permissions validated")

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

    /// Check virtualization permissions and system requirements
    ///
    /// Verifies that the system can run VMs by checking:
    /// 1. Virtualization.framework support via VZVirtualMachine
    /// 2. Read/write access to VM bundle directory
    ///
    /// - Throws: VMPermissionError with detailed fix instructions
    private func checkVirtualizationPermissions() throws {
        // Check 1: Verify Virtualization.framework is supported
        // This checks both the com.apple.security.virtualization entitlement
        // and that the hardware supports virtualization
        guard VZVirtualMachine.isSupported else {
            let errorMessage = """
            ❌ Virtualization is not supported on this system.

            Possible causes:
            1. Missing entitlement: com.apple.security.virtualization
               → Add the entitlement to your app's .entitlements file
               → Ensure code signing is enabled

            2. macOS version too old (requires macOS 11.0 Big Sur or later)
               → Current version: \(ProcessInfo.processInfo.operatingSystemVersionString)
               → Upgrade to macOS 11.0+ to use Virtualization.framework

            3. Hardware doesn't support virtualization
               → Requires Apple Silicon (M1/M2/M3) or Intel with VT-x
               → Check "About This Mac" for processor details

            Documentation:
            https://developer.apple.com/documentation/virtualization
            """

            throw VMPermissionError.virtualizationNotSupported(errorMessage)
        }

        // Check 2: Verify file system permissions for VM bundle directory
        let fileManager = FileManager.default

        // Check parent directory exists and is writable
        let parentDirectory = vmBundlePath.deletingLastPathComponent()

        // Test write access by attempting to create the directory
        do {
            try fileManager.createDirectory(
                at: vmBundlePath,
                withIntermediateDirectories: true,
                attributes: nil
            )
        } catch let error as NSError {
            let errorMessage: String

            if error.domain == NSCocoaErrorDomain {
                switch error.code {
                case NSFileWriteNoPermissionError:
                    errorMessage = """
                    ❌ Permission denied: Cannot write to VM directory

                    Path: \(vmBundlePath.path)

                    Fix this issue:
                    1. Grant Full Disk Access to this application:
                       → Open System Preferences → Security & Privacy → Privacy
                       → Select "Full Disk Access" from the list
                       → Click the lock to make changes
                       → Add this application to the list

                    2. Or change the VM directory to a location you can write to:
                       → Edit vmBundlePath in the source code
                       → Use ~/Documents/.vibecode/vm or similar

                    Error details: \(error.localizedDescription)
                    """

                case NSFileWriteVolumeReadOnlyError:
                    errorMessage = """
                    ❌ Cannot write to read-only volume

                    Path: \(vmBundlePath.path)

                    Fix this issue:
                    → The volume is mounted as read-only
                    → Change VM directory to a writable location
                    → Use a location on your main system drive

                    Error details: \(error.localizedDescription)
                    """

                case NSFileWriteOutOfSpaceError:
                    errorMessage = """
                    ❌ Not enough disk space

                    Path: \(vmBundlePath.path)

                    Fix this issue:
                    → Free up disk space (need at least 20GB for VM)
                    → Or change VM directory to a volume with more space

                    Error details: \(error.localizedDescription)
                    """

                default:
                    errorMessage = """
                    ❌ Failed to create VM directory

                    Path: \(vmBundlePath.path)

                    Error: \(error.localizedDescription)
                    Error code: \(error.code)

                    Try:
                    → Check directory permissions
                    → Verify the path is valid
                    → Ensure parent directories exist and are writable
                    """
                }
            } else {
                errorMessage = """
                ❌ Failed to create VM directory

                Path: \(vmBundlePath.path)

                Error: \(error.localizedDescription)

                Try:
                → Check directory permissions
                → Verify the path is valid
                → Ensure parent directories exist and are writable
                """
            }

            throw VMPermissionError.fileSystemAccessDenied(errorMessage)
        }

        // Verify we can write to the directory
        let testFile = vmBundlePath.appendingPathComponent(".permission_test")
        do {
            try "test".write(to: testFile, atomically: true, encoding: .utf8)
            try fileManager.removeItem(at: testFile)
        } catch {
            let errorMessage = """
            ❌ Cannot write to VM directory

            Path: \(vmBundlePath.path)

            The directory exists but write operations fail.

            Fix this issue:
            1. Check directory permissions:
               → Run: ls -la \(parentDirectory.path)
               → Ensure your user has write access

            2. Grant Full Disk Access (if needed):
               → System Preferences → Security & Privacy → Privacy
               → "Full Disk Access" → Add this application

            Error: \(error.localizedDescription)
            """

            throw VMPermissionError.fileSystemAccessDenied(errorMessage)
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
