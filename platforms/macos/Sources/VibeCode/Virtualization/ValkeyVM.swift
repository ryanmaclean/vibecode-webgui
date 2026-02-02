// ValkeyVM.swift
// VibeCode - Valkey VM using Virtualization.framework
//
// Alpine Linux ARM64 VM running Valkey (Redis-compatible) for session storage
// Uses Linux kernel boot loader (not EFI) with Alpine kernel and initramfs

import Foundation
import Virtualization

@available(macOS 14.0, *)
@MainActor
public class ValkeyVM: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var isRunning: Bool = false
    @Published public private(set) var status: VMStatus = .stopped
    @Published public private(set) var consoleOutput: [String] = []

    // MARK: - Properties

    private var virtualMachine: VZVirtualMachine?
    private let vmDirectory: URL
    private let consoleLog: FileHandle?

    // MARK: - VM Status

    public enum VMStatus {
        case stopped
        case starting
        case running
        case stopping
        case error(String)

        public var description: String {
            switch self {
            case .stopped: return "Stopped"
            case .starting: return "Starting..."
            case .running: return "Running"
            case .stopping: return "Stopping..."
            case .error(let msg): return "Error: \(msg)"
            }
        }
    }

    public enum VMError: LocalizedError {
        case configurationInvalid(String)
        case fileNotFound(String)
        case startupFailed(String)

        public var errorDescription: String? {
            switch self {
            case .configurationInvalid(let msg):
                return "Configuration invalid: \(msg)"
            case .fileNotFound(let path):
                return "File not found: \(path)"
            case .startupFailed(let msg):
                return "Startup failed: \(msg)"
            }
        }
    }

    // MARK: - Initialization

    public init(vmDirectory: URL? = nil) {
        let vmDir = vmDirectory ?? URL(fileURLWithPath: NSString(string: "~/.vfkit/vms/valkey-vz").expandingTildeInPath)
        self.vmDirectory = vmDir

        // Set up console log file
        let logDir = vmDir.appendingPathComponent("logs")
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let logFile = logDir.appendingPathComponent("console.log")

        // Create or truncate log file
        FileManager.default.createFile(atPath: logFile.path, contents: nil)
        self.consoleLog = try? FileHandle(forWritingTo: logFile)

        super.init()
    }

    deinit {
        try? consoleLog?.close()
    }

    // MARK: - Configuration

    private func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU: 2 cores (Valkey is single-threaded, extra core for OS)
        config.cpuCount = 2

        // Memory: 1GB (512MB for Valkey + 512MB for OS)
        config.memorySize = 1 * 1024 * 1024 * 1024

        // Boot Loader: Linux kernel with Alpine initramfs
        let kernelPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
        let initramfsPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath

        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw VMError.fileNotFound(kernelPath)
        }
        guard FileManager.default.fileExists(atPath: initramfsPath) else {
            throw VMError.fileNotFound(initramfsPath)
        }

        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)

        // Kernel command line:
        // - console=hvc0: Serial console output
        // - root=/dev/vda: Root filesystem on first virtio disk
        // - rw: Mount root as read-write
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"

        config.bootLoader = bootloader

        // Storage: Main disk with Alpine + Valkey
        let diskPath = vmDirectory.appendingPathComponent("disk/root.img").path
        guard FileManager.default.fileExists(atPath: diskPath) else {
            throw VMError.fileNotFound(diskPath)
        }

        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]

        // Network: NAT (allows outbound connections, port forwarding for inbound)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Serial Console: For logging and debugging
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()

        // Attach both to log file and to our output handler
        let inputPipe = Pipe()
        let outputPipe = Pipe()

        // Read from output pipe in background
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                if let line = String(data: data, encoding: .utf8) {
                    Task { @MainActor in
                        self?.consoleOutput.append(line)
                        // Keep only last 1000 lines
                        if let count = self?.consoleOutput.count, count > 1000 {
                            self?.consoleOutput.removeFirst(count - 1000)
                        }
                    }
                }
                // Also write to log file
                try? self?.consoleLog?.write(contentsOf: data)
            }
        }

        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        config.serialPorts = [serialPort]

        // Entropy Device: For cryptographic operations
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Validate configuration
        try config.validate()

        return config
    }

    // MARK: - Lifecycle

    public func start() async throws {
        guard !isRunning else {
            print("VM is already running")
            return
        }

        status = .starting
        consoleOutput.append("Starting Valkey VM...")

        do {
            let config = try createConfiguration()
            let vm = VZVirtualMachine(configuration: config)
            vm.delegate = self

            self.virtualMachine = vm

            try await vm.start()

            isRunning = true
            status = .running
            consoleOutput.append("✓ Valkey VM started successfully")

            print("✓ Valkey VM started successfully")

        } catch {
            status = .error(error.localizedDescription)
            consoleOutput.append("✗ Failed to start VM: \(error)")
            print("✗ Failed to start VM: \(error)")
            throw VMError.startupFailed(error.localizedDescription)
        }
    }

    public func stop() async throws {
        guard isRunning, let vm = virtualMachine else {
            print("VM is not running")
            return
        }

        status = .stopping
        consoleOutput.append("Stopping Valkey VM...")

        do {
            try await vm.stop()

            isRunning = false
            status = .stopped
            consoleOutput.append("✓ Valkey VM stopped")

            print("✓ Valkey VM stopped")

        } catch {
            status = .error(error.localizedDescription)
            consoleOutput.append("✗ Failed to stop VM: \(error)")
            print("✗ Failed to stop VM: \(error)")
            throw error
        }
    }

    public func pause() async throws {
        guard let vm = virtualMachine else {
            throw VMError.startupFailed("VM not initialized")
        }

        try await vm.pause()
        status = .stopped
        consoleOutput.append("VM paused")
    }

    public func resume() async throws {
        guard let vm = virtualMachine else {
            throw VMError.startupFailed("VM not initialized")
        }

        try await vm.resume()
        status = .running
        consoleOutput.append("VM resumed")
    }
}

// MARK: - VZVirtualMachineDelegate

@available(macOS 14.0, *)
extension ValkeyVM: VZVirtualMachineDelegate {
    nonisolated public func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        Task { @MainActor in
            isRunning = false
            status = .stopped
            consoleOutput.append("Guest OS shut down")
            print("Guest OS shut down")
        }
    }

    nonisolated public func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        Task { @MainActor in
            isRunning = false
            status = .error(error.localizedDescription)
            consoleOutput.append("VM stopped with error: \(error)")
            print("VM stopped with error: \(error)")
        }
    }
}

// MARK: - Utility Methods

@available(macOS 14.0, *)
extension ValkeyVM {
    /// Check if VM files exist
    public func validateFiles() -> (valid: Bool, missing: [String]) {
        var missing: [String] = []

        let kernelPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
        if !FileManager.default.fileExists(atPath: kernelPath) {
            missing.append("Kernel: \(kernelPath)")
        }

        let initramfsPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath
        if !FileManager.default.fileExists(atPath: initramfsPath) {
            missing.append("Initramfs: \(initramfsPath)")
        }

        let diskPath = vmDirectory.appendingPathComponent("disk/root.img").path
        if !FileManager.default.fileExists(atPath: diskPath) {
            missing.append("Disk: \(diskPath)")
        }

        return (missing.isEmpty, missing)
    }

    /// Get VM info
    public var info: String {
        """
        Valkey VM Configuration:
          Status: \(status.description)
          Directory: \(vmDirectory.path)
          CPUs: 2
          Memory: 1GB
          Network: NAT
          Port: 6379 (Valkey)
        """
    }
}
