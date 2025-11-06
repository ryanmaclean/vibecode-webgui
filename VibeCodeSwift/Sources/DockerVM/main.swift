#!/usr/bin/env swift
// Docker-enabled Alpine VM with ASIF storage
// Uses Apple Virtualization.framework for native performance

import Foundation
import Virtualization

@available(macOS 26.0, *)
class DockerAlpineVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine!
    private let vmQueue = DispatchQueue(label: "com.vibecode.docker-vm", qos: .userInteractive)

    let vmDir = NSHomeDirectory() + "/.vfkit/vms/docker-alpine-asif"

    func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU & Memory - generous for Docker workloads
        config.cpuCount = 4
        config.memorySize = UInt64(4) * 1024 * 1024 * 1024 // 4GB

        // Bootloader - Linux kernel boot
        let kernelURL = URL(fileURLWithPath: vmDir + "/kernel/vmlinuz")
        let initramfsURL = URL(fileURLWithPath: vmDir + "/kernel/initramfs-docker")

        let bootLoader = VZLinuxBootLoader(kernelURL: kernelURL)
        bootLoader.initialRamdiskURL = initramfsURL
        bootLoader.commandLine = "console=hvc0 quiet"
        config.bootLoader = bootLoader

        // Storage - ASIF disk for Docker layers
        let diskURL = URL(fileURLWithPath: vmDir + "/disk/docker-alpine.asif")
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]

        // Network - NAT with fixed MAC
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()

        if let macAddress = VZMACAddress(string: "52:54:00:12:34:56") {
            networkDevice.macAddress = macAddress
        }

        config.networkDevices = [networkDevice]

        // Entropy device (RNG)
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Serial console for output
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let consoleAttachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialPort.attachment = consoleAttachment
        config.serialPorts = [serialPort]

        // Validate
        try config.validate()

        return config
    }

    func start() throws {
        print("🐳 Docker Alpine VM with ASIF Storage")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("")
        print("Configuration:")
        print("  • Kernel: vmlinuz (Alpine 3.20.8)")
        print("  • Initramfs: initramfs-docker (3.8MB)")
        print("  • Storage: docker-alpine.asif (512MB ASIF)")
        print("  • CPUs: 4")
        print("  • Memory: 4GB")
        print("  • Network: NAT (virtio-net)")
        print("  • Requires: macOS 26.0+ (Tahoe)")
        print("")
        print("Starting VM...")
        print("")

        let config = try createVMConfiguration()
        virtualMachine = VZVirtualMachine(configuration: config, queue: vmQueue)
        virtualMachine.delegate = self

        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?

        virtualMachine.start { result in
            switch result {
            case .success:
                break
            case .failure(let error):
                print("❌ VM failed to start: \(error.localizedDescription)")
                startError = error
            }
            semaphore.signal()
        }

        semaphore.wait()

        if let error = startError {
            throw error
        }

        // VM is now running - output will come through serial console
        RunLoop.main.run()
    }

    // MARK: - VZVirtualMachineDelegate

    nonisolated func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("VM stopped")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        exit(0)
    }

    nonisolated func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("❌ VM error: \(error.localizedDescription)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        exit(1)
    }
}

// Main
if #available(macOS 26.0, *) {
    do {
        let vm = DockerAlpineVM()
        try vm.start()
    } catch {
        print("❌ Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("❌ This requires macOS 26.0 (Tahoe) or later")
    print("   ASIF format is only available on Tahoe+")
    print("   Current OS: \(ProcessInfo.processInfo.operatingSystemVersionString)")
    exit(1)
}
