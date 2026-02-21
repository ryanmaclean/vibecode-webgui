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
        print("""
        ⚠️  Virtual Machine Stopped

        The VM has shut down cleanly.

        Possible reasons:
        → Guest OS initiated shutdown
        → Application requested VM stop
        → VM completed its boot sequence

        This is a normal shutdown and not an error.
        """)
        exit(0)
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        let nsError = error as NSError

        var errorMessage = """
        ❌ Virtual Machine Error

        The VM encountered an error and stopped unexpectedly.

        """

        // Provide specific guidance based on error domain and code
        if nsError.domain == "VZErrorDomain" {
            switch nsError.code {
            case 1: // VZErrorInternal
                errorMessage += """
                Error Type: Internal virtualization error

                This is usually caused by:
                → Invalid VM configuration
                → Corrupted disk image
                → Insufficient system resources

                Troubleshooting steps:
                1. Check available memory and disk space
                2. Verify VM configuration parameters
                3. Try removing and recreating the VM bundle:
                   rm -rf \(vmBundlePath.path)
                4. Check Console.app for detailed system logs

                """

            case 2: // VZErrorInvalidVirtualMachineConfiguration
                errorMessage += """
                Error Type: Invalid VM configuration

                The VM configuration is invalid or incompatible.

                Common causes:
                → CPU count exceeds system capabilities
                → Memory size too large for available RAM
                → Invalid boot loader configuration
                → Missing or corrupted kernel/initrd files

                Troubleshooting steps:
                1. Verify kernel and initrd files exist in:
                   \(vmBundlePath.path)
                2. Run: ./scripts/macos-vm/download-kernel.sh
                3. Check system resources:
                   - Available RAM
                   - CPU core count
                4. Review configuration in createVMConfiguration()

                """

            case 3: // VZErrorInvalidVirtualMachineState
                errorMessage += """
                Error Type: Invalid VM state

                The VM is in an invalid state for the requested operation.

                This can happen when:
                → Trying to start an already running VM
                → Accessing VM during state transition
                → VM is paused or suspended incorrectly

                Troubleshooting steps:
                1. Ensure no other instances are running
                2. Restart the application
                3. Remove VM state files:
                   rm -rf \(vmBundlePath.path)/*.state

                """

            case 4: // VZErrorInvalidVirtualMachineStateTransition
                errorMessage += """
                Error Type: Invalid state transition

                The VM cannot transition to the requested state.

                Troubleshooting steps:
                1. Wait for current operation to complete
                2. Restart the VM from a stopped state
                3. Check for resource contention

                """

            case 5: // VZErrorVirtualMachineLimitExceeded
                errorMessage += """
                Error Type: VM limit exceeded

                Too many VMs are running on this system.

                Fix this issue:
                → Close other running virtual machines
                → macOS limits concurrent VM instances
                → Check Activity Monitor for other VM processes

                """

            default:
                errorMessage += """
                Error Type: Virtualization framework error (code \(nsError.code))

                Troubleshooting steps:
                1. Check system logs in Console.app
                2. Verify virtualization entitlements
                3. Ensure macOS is up to date
                4. Review Apple's Virtualization framework documentation

                """
            }
        } else if nsError.domain == NSCocoaErrorDomain {
            // File system or resource errors
            errorMessage += """
            Error Type: System resource error

            This is typically a file system or resource issue.

            Common causes:
            → Disk image file is corrupted or inaccessible
            → Insufficient permissions to access VM files
            → Out of disk space
            → File system errors

            Troubleshooting steps:
            1. Check disk space: df -h
            2. Verify VM directory permissions:
               ls -la \(vmBundlePath.path)
            3. Check file integrity:
               ls -lh \(vmBundlePath.path)/*
            4. Try recreating the VM:
               rm -rf \(vmBundlePath.path)

            """
        } else {
            // Generic error handling
            errorMessage += """
            Error Type: Unexpected error

            An unexpected error occurred during VM operation.

            Troubleshooting steps:
            1. Check Console.app for detailed system logs
            2. Verify all VM files are intact
            3. Restart the application
            4. Check for macOS updates

            """
        }

        errorMessage += """
        Error Details:
        → Domain: \(nsError.domain)
        → Code: \(nsError.code)
        → Description: \(error.localizedDescription)
        """

        if let failureReason = nsError.localizedFailureReason {
            errorMessage += "\n→ Reason: \(failureReason)"
        }

        if let recoverySuggestion = nsError.localizedRecoverySuggestion {
            errorMessage += "\n→ Suggestion: \(recoverySuggestion)"
        }

        print(errorMessage)
        exit(1)
    }
}
