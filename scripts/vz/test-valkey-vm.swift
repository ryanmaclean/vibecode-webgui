#!/usr/bin/env swift

// test-valkey-vm.swift
// Standalone test script for Valkey VM using Virtualization.framework
//
// Usage: ./scripts/vz/test-valkey-vm.swift
// Prerequisites:
// - Alpine kernel at ~/.vfkit/vms/vibecode-alpine/kernel/
// - Valkey disk image at ~/.vfkit/vms/valkey-vz/disk/root.img

import Foundation
import Virtualization

// MARK: - ValkeyVM Implementation

@available(macOS 14.0, *)
class ValkeyVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let vmDirectory: URL
    private var consoleLog: FileHandle?

    var isRunning: Bool = false

    init(vmDirectory: URL? = nil) {
        let vmDir = vmDirectory ?? URL(fileURLWithPath: NSString(string: "~/.vfkit/vms/valkey-vz").expandingTildeInPath)
        self.vmDirectory = vmDir

        // Set up console log
        let logDir = vmDir.appendingPathComponent("logs")
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let logFile = logDir.appendingPathComponent("console.log")
        FileManager.default.createFile(atPath: logFile.path, contents: nil)
        self.consoleLog = try? FileHandle(forWritingTo: logFile)

        super.init()
    }

    deinit {
        try? consoleLog?.close()
    }

    func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU: 2 cores
        config.cpuCount = 2

        // Memory: 1GB
        config.memorySize = 1 * 1024 * 1024 * 1024

        // Boot Loader: Linux kernel
        let kernelPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
        let initramfsPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath

        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(domain: "ValkeyVM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found: \(kernelPath)"])
        }
        guard FileManager.default.fileExists(atPath: initramfsPath) else {
            throw NSError(domain: "ValkeyVM", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found: \(initramfsPath)"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"

        config.bootLoader = bootloader

        // Disk
        let diskPath = vmDirectory.appendingPathComponent("disk/root.img").path
        guard FileManager.default.fileExists(atPath: diskPath) else {
            throw NSError(domain: "ValkeyVM", code: 3, userInfo: [NSLocalizedDescriptionKey: "Disk not found: \(diskPath)"])
        }

        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]

        // Network (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Serial console
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()

        let outputPipe = Pipe()
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                if let line = String(data: data, encoding: .utf8) {
                    print(line, terminator: "")
                }
                try? self?.consoleLog?.write(contentsOf: data)
            }
        }

        let inputPipe = Pipe()
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        config.serialPorts = [serialPort]

        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        try config.validate()
        return config
    }

    func start() async throws {
        guard !isRunning else {
            print("VM is already running")
            return
        }

        print("Creating VM configuration...")
        let config = try createConfiguration()

        print("Creating virtual machine...")
        let vm = VZVirtualMachine(configuration: config)
        vm.delegate = self
        self.virtualMachine = vm

        print("Starting VM...")
        try await vm.start()

        isRunning = true
        print("✅ VM started successfully!")
    }

    func stop() async throws {
        guard let vm = virtualMachine, isRunning else {
            print("VM is not running")
            return
        }

        print("Stopping VM...")
        try await vm.stop()

        isRunning = false
        print("✅ VM stopped")
    }

    // MARK: - VZVirtualMachineDelegate

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n=== Guest OS shut down ===")
        isRunning = false
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n=== VM stopped with error: \(error) ===")
        isRunning = false
    }
}

// MARK: - Main Test Program

@available(macOS 14.0, *)
func runTest() async {
    print("===========================================")
    print("Valkey VM Test - Virtualization Framework")
    print("===========================================")
    print("")

    print("✓ macOS 14.0+ detected")

    // Validate files
    print("\nValidating prerequisites...")

    let kernel = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
    let initramfs = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath
    let disk = NSString(string: "~/.vfkit/vms/valkey-vz/disk/root.img").expandingTildeInPath

    var valid = true

    if FileManager.default.fileExists(atPath: kernel) {
        let attrs = try? FileManager.default.attributesOfItem(atPath: kernel)
        let size = attrs?[.size] as? Int64 ?? 0
        print("✓ Kernel: \(kernel) (\(size / 1024 / 1024)MB)")
    } else {
        print("✗ Kernel not found: \(kernel)")
        valid = false
    }

    if FileManager.default.fileExists(atPath: initramfs) {
        let attrs = try? FileManager.default.attributesOfItem(atPath: initramfs)
        let size = attrs?[.size] as? Int64 ?? 0
        print("✓ Initramfs: \(initramfs) (\(size / 1024 / 1024)MB)")
    } else {
        print("✗ Initramfs not found: \(initramfs)")
        valid = false
    }

    if FileManager.default.fileExists(atPath: disk) {
        let attrs = try? FileManager.default.attributesOfItem(atPath: disk)
        let size = attrs?[.size] as? Int64 ?? 0
        print("✓ Disk: \(disk) (\(size / 1024 / 1024)MB)")
    } else {
        print("✗ Disk not found: \(disk)")
        valid = false
    }

    guard valid else {
        print("\n✗ Prerequisites not met. Exiting.")
        exit(1)
    }

    print("\n✅ All prerequisites validated")
    print("")

    // Create and start VM
    let vm = ValkeyVM()

    do {
        print("===========================================")
        print("Starting Valkey VM...")
        print("===========================================")
        print("")

        try await vm.start()

        print("")
        print("===========================================")
        print("VM is running!")
        print("===========================================")
        print("")
        print("Console output will appear above.")
        print("Logs saved to: ~/.vfkit/vms/valkey-vz/logs/console.log")
        print("")
        print("To test Valkey connection (after boot completes):")
        print("  redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 PING")
        print("")
        print("VM will run for 5 minutes, then shut down.")
        print("Press Ctrl+C to stop early.")
        print("")

        // Keep running for 5 minutes
        try await Task.sleep(for: .seconds(300))

        print("\n===========================================")
        print("Test complete. Stopping VM...")
        print("===========================================")

        try await vm.stop()

        print("\n✅ Test completed successfully!")

    } catch {
        print("\n✗ Error: \(error)")
        exit(1)
    }
}

// Run the test
if #available(macOS 14.0, *) {
    Task {
        await runTest()
        exit(0)
    }
    RunLoop.main.run()
} else {
    print("✗ macOS 14.0+ required")
    exit(1)
}
