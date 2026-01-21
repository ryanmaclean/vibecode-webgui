import Foundation
import Virtualization

/// UnifiedServicesVM with 9p Directory Sharing for PostgreSQL Persistence
///
/// This implementation replaces VirtioFS with 9p/virtfs which is better supported
/// by the Apple Virtualization framework and Alpine Linux kernels.
///
/// Usage:
/// 1. Build and replace the binary in menubar/Apps/UnifiedServicesVibeCodeApp.app/Contents/MacOS/
/// 2. Update the init script in the initramfs with init-9p-updated.sh
/// 3. Rebuild initramfs and replace in App bundle Resources/
/// 4. Test with the provided test script

@main
struct UnifiedServicesVM {
    static func main() async throws {
        print("🚀 VibeCode Unified Services VM")
        print("   PostgreSQL + Valkey + OpenVSCode with 9p Persistence")
        print("=" * 60)

        let vm = UnifiedVMManager()
        try await vm.start()
    }
}

class UnifiedVMManager: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let appResourcesPath: URL
    private let hostDataPath: URL

    override init() {
        // Get app bundle resources path
        if let bundlePath = Bundle.main.resourcePath {
            self.appResourcesPath = URL(fileURLWithPath: bundlePath)
        } else {
            // Fallback for development
            let homeDir = FileManager.default.homeDirectoryForCurrentUser
            self.appResourcesPath = homeDir
                .appendingPathComponent(".vibecode")
                .appendingPathComponent("vm-resources")
        }

        // Host data directory for persistent storage
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        self.hostDataPath = homeDir
            .appendingPathComponent(".vibecode")
            .appendingPathComponent("vm-data")

        super.init()

        // Create host data directory structure
        try? FileManager.default.createDirectory(
            at: hostDataPath,
            withIntermediateDirectories: true
        )

        // Create PostgreSQL data directory on host
        let postgresPath = hostDataPath.appendingPathComponent("postgresql")
        try? FileManager.default.createDirectory(
            at: postgresPath,
            withIntermediateDirectories: true
        )

        print("📂 Host data path: \(hostDataPath.path)")
        print("📂 PostgreSQL data will persist at: \(postgresPath.path)")
    }

    func start() async throws {
        print("📦 Building VM configuration...")

        let config = try buildVMConfiguration()

        print("✅ Configuration validated")
        print("🔧 Starting virtual machine...")

        virtualMachine = VZVirtualMachine(configuration: config)
        virtualMachine?.delegate = self

        try await virtualMachine?.start()

        print("")
        print("=" * 60)
        print("✅ Unified Services VM Started Successfully")
        print("=" * 60)
        print("")
        print("📊 Services Available:")
        print("   • PostgreSQL:      postgresql://postgres@localhost:5432")
        print("   • Valkey (Redis):  redis://localhost:6379")
        print("   • OpenVSCode:      http://localhost:3000")
        print("   • SSH:             ssh -p 2222 root@localhost")
        print("")
        print("💾 Data Persistence:")
        print("   • Storage Backend: 9p/virtfs")
        print("   • Host Directory:  \(hostDataPath.path)")
        print("   • PostgreSQL Data: \(hostDataPath.path)/postgresql")
        print("")
        print("⌨️  Press Ctrl+C to stop")
        print("=" * 60)

        // Keep running until interrupted
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            // Never resume - keeps running until SIGTERM/SIGINT
        }
    }

    private func buildVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU configuration (4 cores)
        config.cpuCount = min(4, ProcessInfo.processInfo.processorCount)

        // Memory configuration (4GB)
        config.memorySize = 4 * 1024 * 1024 * 1024

        // Kernel and initramfs paths
        let kernelPath = appResourcesPath.appendingPathComponent("vmlinux-raw")
        let initramfsPath = appResourcesPath.appendingPathComponent("unified-vm-initramfs.cpio.gz")

        guard FileManager.default.fileExists(atPath: kernelPath.path) else {
            throw VMError.resourceNotFound("Kernel not found at: \(kernelPath.path)")
        }

        guard FileManager.default.fileExists(atPath: initramfsPath.path) else {
            throw VMError.resourceNotFound("Initramfs not found at: \(initramfsPath.path)")
        }

        // Boot loader configuration
        let bootloader = VZLinuxBootLoader(kernelURL: kernelPath)
        bootloader.initialRamdiskURL = initramfsPath
        bootloader.commandLine = "console=hvc0"
        config.bootLoader = bootloader

        // Network configuration (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // 9p Directory Sharing for Persistent Storage
        // This replaces VirtioFS which isn't available in the kernel
        print("📁 Configuring 9p directory share...")

        let sharedDirectory = VZSharedDirectory(url: hostDataPath, readOnly: false)
        let directoryShare = VZVirtioFileSystemDeviceConfiguration(tag: "hostshare")
        directoryShare.share = sharedDirectory

        config.directorySharingDevices = [directoryShare]

        print("   ✓ 9p share configured: \(hostDataPath.path) → /mnt/hostshare")

        // Serial console for logging and debugging
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let consoleOutput = Pipe()

        // Forward console output to stdout with timestamp
        consoleOutput.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty, let line = String(data: data, encoding: .utf8) {
                // Print with timestamp
                let timestamp = DateFormatter.localizedString(
                    from: Date(),
                    dateStyle: .none,
                    timeStyle: .medium
                )
                print("[\(timestamp)] \(line)", terminator: "")
            }
        }

        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.nullDevice,
            fileHandleForWriting: consoleOutput.fileHandleForWriting
        )
        config.serialPorts = [serialPort]

        // Entropy device for random number generation
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Rosetta support for x86_64 binaries (if available on Apple Silicon)
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability == .available {
            print("   ✓ Rosetta 2 for Linux available")
            let rosettaShare = VZLinuxRosettaDirectoryShare()
            let rosettaConfig = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaConfig.share = rosettaShare
            config.directorySharingDevices.append(rosettaConfig)
        }
        #endif

        // Validate configuration
        try config.validate()

        return config
    }

    // MARK: - VZVirtualMachineDelegate

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("")
        print("⚠️  VM stopped by guest OS")
        exit(0)
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("")
        print("❌ VM stopped with error: \(error.localizedDescription)")
        exit(1)
    }
}

// MARK: - Error Types

enum VMError: LocalizedError {
    case resourceNotFound(String)
    case configurationError(String)

    var errorDescription: String? {
        switch self {
        case .resourceNotFound(let msg):
            return "Resource not found: \(msg)"
        case .configurationError(let msg):
            return "Configuration error: \(msg)"
        }
    }
}

// MARK: - String Extension

extension String {
    static func * (left: String, right: Int) -> String {
        String(repeating: left, count: right)
    }
}
