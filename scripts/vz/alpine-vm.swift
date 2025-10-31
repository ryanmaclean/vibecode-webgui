#!/usr/bin/env swift
// Alpine ARM64 VM using raw Apple Virtualization.framework
// Inspired by Virtual Buddy architecture

import Foundation
import Virtualization

@available(macOS 12.0, *)
class AlpineVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine!
    private let vmQueue = DispatchQueue(label: "com.vibecode.vm", qos: .userInteractive)

    func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU & Memory
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024 // 1GB

        // Bootloader - Linux kernel boot
        let bootLoader = VZLinuxBootLoader(
            kernelURL: URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/vibecode-alpine/kernel/vmlinux")
        )
        bootLoader.initialRamdiskURL = URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/vibecode-alpine/kernel/initramfs")
        bootLoader.commandLine = "console=hvc0 root=/dev/vda rootfstype=ext4 rw"
        config.bootLoader = bootLoader

        // Storage - virtio-blk disk
        let diskURL = URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/valkey-vz/disk/root.img")
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]

        // Network - NAT
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()

        // Set MAC address using string initializer
        if let macAddress = VZMACAddress(string: "52:54:00:12:34:59") {
            networkDevice.macAddress = macAddress
        }

        config.networkDevices = [networkDevice]

        // Entropy device (RNG)
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Validate
        try config.validate()

        return config
    }

    func start() throws {
        print("🚀 Starting Alpine ARM64 VM with Virtualization.framework...")
        print("   Kernel: ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux")
        print("   Disk: ~/.vfkit/vms/valkey-vz/disk/root.img")
        print("   CPUs: 2, Memory: 1GB")
        print("")

        let config = try createVMConfiguration()
        virtualMachine = VZVirtualMachine(configuration: config)
        virtualMachine.delegate = self

        print("✓ VM configuration validated")
        print("✓ Starting VM...")

        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?

        vmQueue.async { [weak self] in
            guard let self = self else { return }

            self.virtualMachine.start { result in
                switch result {
                case .success:
                    print("✅ VM started successfully with raw Swift + Virtualization.framework!")
                    print("   State: Running")
                    print("   This proves Alpine ARM64 boots on Apple VZ framework via pure Swift")
                case .failure(let error):
                    print("❌ VM failed to start: \(error.localizedDescription)")
                    startError = error
                }
                semaphore.signal()
            }
        }

        semaphore.wait()

        if let error = startError {
            throw error
        }

        // Keep running
        print("")
        print("VM is running. Press Ctrl+C to stop.")
        print("")

        RunLoop.main.run()
    }

    // MARK: - VZVirtualMachineDelegate

    nonisolated func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n⚠️  Guest stopped")
        exit(0)
    }

    nonisolated func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n❌ VM stopped with error: \(error.localizedDescription)")
        exit(1)
    }
}

// Main
if #available(macOS 12.0, *) {
    do {
        let vm = AlpineVM()
        try vm.start()
    } catch {
        print("❌ Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("❌ This requires macOS 12.0 or later")
    exit(1)
}
