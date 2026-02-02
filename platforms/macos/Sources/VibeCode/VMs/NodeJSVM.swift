// NodeJSVM.swift
// VibeCode - Node.js Development VM
//
// Native Apple Virtualization framework VM with Node.js v22 LTS
// Features: Rosetta 2, Shared workspace, PostgreSQL+pgvector, Valkey

import Foundation
import Virtualization

@available(macOS 14.0, *)
public class NodeJSVM: NSObject, VZVirtualMachineDelegate {

    // MARK: - Properties

    private var virtualMachine: VZVirtualMachine?
    private let vmName: String
    private let vmBasePath: URL

    // Configuration options
    private let cpuCount: Int
    private let memorySize: UInt64
    private let diskSize: UInt64

    // Paths
    private let kernelPath: String
    private let initramfsPath: String
    private let diskPath: URL
    private let workspacePath: URL

    // State
    public private(set) var isRunning = false
    public private(set) var lastError: Error?

    // MARK: - Initialization

    public init(
        name: String = "vibecode-nodejs",
        cpus: Int = 4,
        memoryGB: Int = 8,
        diskSizeGB: Int = 50,
        basePath: String = "~/.vfkit/vms",
        workspacePath: String = "~/vibecode-workspace"
    ) {
        self.vmName = name
        self.cpuCount = min(cpus, ProcessInfo.processInfo.processorCount)
        self.memorySize = UInt64(memoryGB) * 1024 * 1024 * 1024
        self.diskSize = UInt64(diskSizeGB) * 1024 * 1024 * 1024

        // Expand paths
        let expandedBase = NSString(string: basePath).expandingTildeInPath
        let expandedWorkspace = NSString(string: workspacePath).expandingTildeInPath

        self.vmBasePath = URL(fileURLWithPath: expandedBase).appendingPathComponent("nodejs-vz")
        self.workspacePath = URL(fileURLWithPath: expandedWorkspace)

        // Kernel and initramfs from Alpine
        let kernelBase = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel").expandingTildeInPath
        self.kernelPath = "\(kernelBase)/vmlinuz"
        self.initramfsPath = "\(kernelBase)/initramfs"

        // Disk location
        self.diskPath = vmBasePath.appendingPathComponent("disk/root.qcow2")

        super.init()
    }

    // MARK: - Setup

    public func setup() throws {
        print("🔧 Setting up Node.js VM...")

        let fileManager = FileManager.default

        // Create VM directory structure
        let diskDir = vmBasePath.appendingPathComponent("disk")
        try fileManager.createDirectory(at: diskDir, withIntermediateDirectories: true)

        // Create workspace directory
        try fileManager.createDirectory(at: workspacePath, withIntermediateDirectories: true)

        // Check kernel and initramfs
        guard fileManager.fileExists(atPath: kernelPath) else {
            throw VMError.missingKernel("Kernel not found at \(kernelPath)")
        }

        guard fileManager.fileExists(atPath: initramfsPath) else {
            throw VMError.missingInitramfs("Initramfs not found at \(initramfsPath)")
        }

        // Check or create disk
        if !fileManager.fileExists(atPath: diskPath.path) {
            print("💾 Creating disk image (\(diskSize / (1024*1024*1024))GB)...")
            try createDiskImage()
        } else {
            print("✅ Using existing disk image")
        }

        print("✅ Node.js VM setup complete")
    }

    private func createDiskImage() throws {
        // Check if we can copy from Lima
        let limaDisk = NSString(string: "~/.lima/vibecode-nodejs/diffdisk").expandingTildeInPath

        if FileManager.default.fileExists(atPath: limaDisk) {
            print("📦 Copying Node.js v22 disk from Lima...")
            try FileManager.default.copyItem(atPath: limaDisk, toPath: diskPath.path)
            print("✅ Disk copied from Lima (includes Node.js v22.21.1)")
        } else {
            print("📦 Creating fresh disk image...")
            // Create empty disk (would need Alpine installation)
            FileManager.default.createFile(atPath: diskPath.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: diskPath)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("⚠️  Fresh disk created - needs OS installation")
        }
    }

    // MARK: - Configuration

    public func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU Configuration
        config.cpuCount = cpuCount
        print("  CPU: \(cpuCount) cores")

        // Memory Configuration
        config.memorySize = memorySize
        print("  Memory: \(memorySize / (1024*1024*1024))GB")

        // Bootloader - Linux kernel
        let bootloader = VZLinuxBootLoader(
            kernelURL: URL(fileURLWithPath: kernelPath)
        )
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader

        // Storage - Root disk
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskPath,
            readOnly: false
        )
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]
        print("  Disk: \(diskPath.path)")

        // Network - NAT for internet access
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        print("  Network: NAT (internet access)")

        // Shared Directory - Workspace
        let sharedDirectory = VZSharedDirectory(url: workspacePath, readOnly: false)
        let share = VZSingleDirectoryShare(directory: sharedDirectory)
        let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: "workspace")
        sharingDevice.share = share
        config.directorySharingDevices = [sharingDevice]
        print("  Workspace: \(workspacePath.path) -> /workspace")

        // Rosetta 2 - x86_64 binary translation
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability != .notSupported {
            let rosettaShare = try VZLinuxRosettaDirectoryShare()
            let rosettaDevice = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaDevice.share = rosettaShare
            config.directorySharingDevices.append(rosettaDevice)
            print("  Rosetta 2: Enabled (x86_64 support)")
        }
        #endif

        // Serial Console
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let inputFileHandle = FileHandle.standardInput
        let outputFileHandle = FileHandle.standardOutput
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputFileHandle,
            fileHandleForWriting: outputFileHandle
        )
        config.serialPorts = [serialPort]
        print("  Console: Serial (interactive)")

        // Entropy Device
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Memory Balloon
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]

        // Graphics (minimal)
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080
            )
        ]
        config.graphicsDevices = [graphicsDevice]

        // Input devices
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]

        // Validate
        try config.validate()
        print("✅ Configuration validated")

        return config
    }

    // MARK: - Lifecycle

    public func start() async throws {
        guard !isRunning else {
            print("⚠️  VM already running")
            return
        }

        print("\n🚀 Starting Node.js VM...")

        let config = try createConfiguration()
        let vm = VZVirtualMachine(configuration: config)
        vm.delegate = self

        self.virtualMachine = vm

        do {
            try await vm.start()
            isRunning = true
            print("\n✅ Node.js VM started successfully!")
            print("\n📝 Next steps:")
            print("  1. VM is booting (wait ~10 seconds)")
            print("  2. Login as root (password: vibecode)")
            print("  3. Node.js v22.21.1 should be available")
            print("  4. Workspace mounted at /workspace")
            print("  5. Press Ctrl+C to stop\n")
        } catch {
            lastError = error
            isRunning = false
            throw VMError.startFailed(error.localizedDescription)
        }
    }

    public func stop() async throws {
        guard let vm = virtualMachine, isRunning else {
            print("⚠️  VM not running")
            return
        }

        print("\n🛑 Stopping Node.js VM...")

        do {
            try await vm.stop()
            isRunning = false
            print("✅ VM stopped")
        } catch {
            lastError = error
            throw VMError.stopFailed(error.localizedDescription)
        }
    }

    public func pause() async throws {
        guard let vm = virtualMachine, isRunning else {
            throw VMError.notRunning
        }

        try await vm.pause()
        print("⏸️  VM paused")
    }

    public func resume() async throws {
        guard let vm = virtualMachine else {
            throw VMError.notRunning
        }

        try await vm.resume()
        print("▶️  VM resumed")
    }

    // MARK: - VZVirtualMachineDelegate

    public func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n⚠️  Guest stopped")
        isRunning = false
    }

    public func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n❌ VM error: \(error.localizedDescription)")
        lastError = error
        isRunning = false
    }

    // MARK: - Utilities

    public func getInfo() -> VMInfo {
        return VMInfo(
            name: vmName,
            cpus: cpuCount,
            memoryGB: Int(memorySize / (1024*1024*1024)),
            diskPath: diskPath.path,
            workspacePath: workspacePath.path,
            isRunning: isRunning
        )
    }

    public struct VMInfo {
        public let name: String
        public let cpus: Int
        public let memoryGB: Int
        public let diskPath: String
        public let workspacePath: String
        public let isRunning: Bool
    }

    // MARK: - Errors

    public enum VMError: LocalizedError {
        case missingKernel(String)
        case missingInitramfs(String)
        case missingDisk(String)
        case startFailed(String)
        case stopFailed(String)
        case notRunning

        public var errorDescription: String? {
            switch self {
            case .missingKernel(let msg):
                return "Missing kernel: \(msg)"
            case .missingInitramfs(let msg):
                return "Missing initramfs: \(msg)"
            case .missingDisk(let msg):
                return "Missing disk: \(msg)"
            case .startFailed(let msg):
                return "Failed to start VM: \(msg)"
            case .stopFailed(let msg):
                return "Failed to stop VM: \(msg)"
            case .notRunning:
                return "VM is not running"
            }
        }
    }
}

// MARK: - Convenience Extensions

@available(macOS 14.0, *)
extension NodeJSVM {

    /// Quick setup and start
    public func setupAndStart() async throws {
        try setup()
        try await start()
    }

    /// Run for a specified duration
    public func run(for duration: TimeInterval) async throws {
        try await setupAndStart()
        try await Task.sleep(for: .seconds(duration))
        try await stop()
    }

    /// Run indefinitely (until interrupted)
    public func runIndefinitely() async throws {
        try await setupAndStart()

        // Keep running until interrupted
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            // Set up signal handler for clean shutdown
            signal(SIGINT) { _ in
                print("\n\n🛑 Caught interrupt signal...")
                continuation.resume()
            }

            signal(SIGTERM) { _ in
                print("\n\n🛑 Caught termination signal...")
                continuation.resume()
            }
        }

        try await stop()
    }
}
