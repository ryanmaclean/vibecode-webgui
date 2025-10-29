#!/usr/bin/env swift
//
// Test Node.js VM with Apple Virtualization Framework
// Usage: ./scripts/vz/test-nodejs-vm.swift

import Foundation
import Virtualization

// MARK: - NodeJSVM Implementation

@available(macOS 14.0, *)
class NodeJSVM: NSObject, VZVirtualMachineDelegate {

    private var virtualMachine: VZVirtualMachine?
    private let vmName: String
    private let vmBasePath: URL
    private let cpuCount: Int
    private let memorySize: UInt64
    private let diskSize: UInt64
    private let kernelPath: String
    private let initramfsPath: String
    private let diskPath: URL
    private let workspacePath: URL
    public private(set) var isRunning = false
    public private(set) var lastError: Error?

    init(
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

        let expandedBase = NSString(string: basePath).expandingTildeInPath
        let expandedWorkspace = NSString(string: workspacePath).expandingTildeInPath

        self.vmBasePath = URL(fileURLWithPath: expandedBase).appendingPathComponent("nodejs-vz")
        self.workspacePath = URL(fileURLWithPath: expandedWorkspace)

        let kernelBase = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel").expandingTildeInPath
        self.kernelPath = "\(kernelBase)/vmlinuz"
        self.initramfsPath = "\(kernelBase)/initramfs"
        self.diskPath = vmBasePath.appendingPathComponent("disk/root.qcow2")

        super.init()
    }

    func setup() throws {
        print("🔧 Setting up Node.js VM...")

        let fileManager = FileManager.default
        let diskDir = vmBasePath.appendingPathComponent("disk")
        try fileManager.createDirectory(at: diskDir, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: workspacePath, withIntermediateDirectories: true)

        guard fileManager.fileExists(atPath: kernelPath) else {
            throw VMError.missingKernel("Kernel not found at \(kernelPath)")
        }

        guard fileManager.fileExists(atPath: initramfsPath) else {
            throw VMError.missingInitramfs("Initramfs not found at \(initramfsPath)")
        }

        if !fileManager.fileExists(atPath: diskPath.path) {
            print("💾 Disk image not found - please run setup first")
            throw VMError.missingDisk("Disk not found at \(diskPath.path)")
        } else {
            print("✅ Using existing disk image")
        }

        print("✅ Node.js VM setup complete")
    }

    func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        config.cpuCount = cpuCount
        print("  CPU: \(cpuCount) cores")

        config.memorySize = memorySize
        print("  Memory: \(memorySize / (1024*1024*1024))GB")

        let bootloader = VZLinuxBootLoader(
            kernelURL: URL(fileURLWithPath: kernelPath)
        )
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader

        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskPath,
            readOnly: false
        )
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]
        print("  Disk: \(diskPath.path)")

        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        print("  Network: NAT (internet access)")

        let sharedDirectory = VZSharedDirectory(url: workspacePath, readOnly: false)
        let share = VZSingleDirectoryShare(directory: sharedDirectory)
        let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: "workspace")
        sharingDevice.share = share
        config.directorySharingDevices = [sharingDevice]
        print("  Workspace: \(workspacePath.path) -> /workspace")

        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability != .notSupported {
            let rosettaShare = try VZLinuxRosettaDirectoryShare()
            let rosettaDevice = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaDevice.share = rosettaShare
            config.directorySharingDevices.append(rosettaDevice)
            print("  Rosetta 2: Enabled (x86_64 support)")
        }
        #endif

        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        config.serialPorts = [serialPort]
        print("  Console: Serial (interactive)")

        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]

        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(widthInPixels: 1920, heightInPixels: 1080)
        ]
        config.graphicsDevices = [graphicsDevice]

        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]

        try config.validate()
        print("✅ Configuration validated")

        return config
    }

    func start() async throws {
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
            print("\n📝 VM Information:")
            print("  - Node.js v22.21.1 available")
            print("  - Workspace: ~/vibecode-workspace -> /workspace")
            print("  - Login: root (password from Lima)")
            print("  - Press Ctrl+C to stop\n")
        } catch {
            lastError = error
            isRunning = false
            throw VMError.startFailed(error.localizedDescription)
        }
    }

    func stop() async throws {
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

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n⚠️  Guest stopped")
        isRunning = false
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n❌ VM error: \(error.localizedDescription)")
        lastError = error
        isRunning = false
    }

    enum VMError: LocalizedError {
        case missingKernel(String)
        case missingInitramfs(String)
        case missingDisk(String)
        case startFailed(String)
        case stopFailed(String)

        var errorDescription: String? {
            switch self {
            case .missingKernel(let msg): return "Missing kernel: \(msg)"
            case .missingInitramfs(let msg): return "Missing initramfs: \(msg)"
            case .missingDisk(let msg): return "Missing disk: \(msg)"
            case .startFailed(let msg): return "Failed to start VM: \(msg)"
            case .stopFailed(let msg): return "Failed to stop VM: \(msg)"
            }
        }
    }
}

// MARK: - Main Test

@available(macOS 14.0, *)
@main
struct NodeJSVMTest {
    static func main() async {
        print("=" * 60)
        print("🚀 Node.js VM Test - Apple Virtualization Framework")
        print("=" * 60)
        print()

        let vm = NodeJSVM()

        do {
            try vm.setup()
            try await vm.start()

            // Set up signal handler for clean shutdown
            signal(SIGINT) { _ in
                print("\n\n🛑 Caught interrupt signal...")
                Task {
                    try? await vm.stop()
                    exit(0)
                }
            }

            // Run for 5 minutes for testing
            print("⏱️  VM will run for 5 minutes for testing...")
            print("   Press Ctrl+C to stop earlier\n")

            try await Task.sleep(for: .seconds(300))
            try await vm.stop()

            print("\n" + "=" * 60)
            print("✅ Test completed successfully!")
            print("=" * 60)

        } catch {
            print("\n❌ Test failed: \(error.localizedDescription)")
            exit(1)
        }
    }
}

// Helper for string repetition
extension String {
    static func * (left: String, right: Int) -> String {
        return String(repeating: left, count: right)
    }
}
