#!/usr/bin/env swift

import Foundation
import Virtualization

@available(macOS 12.0, *)
class ProperVMArchitecture: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine!
    private var isRunning = false

    // MARK: - Configuration

    func createVMConfiguration(instanceID: String) throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU & Memory (check system limits)
        let maxCPUs = VZVirtualMachineConfiguration.maximumAllowedCPUCount
        let maxMemory = VZVirtualMachineConfiguration.maximumAllowedMemorySize

        config.cpuCount = min(2, maxCPUs)
        config.memorySize = min(2 * 1024 * 1024 * 1024, maxMemory) // 2GB

        print("✅ CPU: \(config.cpuCount) cores")
        print("✅ Memory: \(config.memorySize / 1024 / 1024 / 1024)GB")

        // Bootloader - Shared kernel/initramfs
        let homeDir = NSHomeDirectory()
        let kernelURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/vmlinux")
        let initramfsURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/initramfs")

        print("✅ Kernel: \(kernelURL.path)")
        print("✅ Initramfs: \(initramfsURL.path)")

        let bootLoader = VZLinuxBootLoader(kernelURL: kernelURL)
        bootLoader.initialRamdiskURL = initramfsURL
        bootLoader.commandLine = "console=hvc0 root=/dev/vda ro rootfstype=ext4"
        config.bootLoader = bootLoader

        // Storage Device 1: READ-ONLY BASE IMAGE (shared across all VMs)
        let baseImageURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/alpine-base.img")
        print("✅ Base image (read-only): \(baseImageURL.path)")

        let baseAttachment = try VZDiskImageStorageDeviceAttachment(
            url: baseImageURL,
            readOnly: true  // ← Read-only! Shared across all VMs
        )
        let baseDevice = VZVirtioBlockDeviceConfiguration(attachment: baseAttachment)
        config.storageDevices.append(baseDevice)

        // Storage Device 2: SPARSE DATA DISK (per-VM, read-write)
        let dataImageURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/instances/\(instanceID)-data.sparseimage")
        print("✅ Data disk (read-write): \(dataImageURL.path)")

        // Create sparse image if it doesn't exist
        if !FileManager.default.fileExists(atPath: dataImageURL.path) {
            print("⚙️  Creating sparse data disk...")
            try createSparseImage(at: dataImageURL, sizeGB: 10)
            print("✅ Created 10GB sparse data disk (starts at ~15MB)")
        }

        let dataAttachment = try VZDiskImageStorageDeviceAttachment(
            url: dataImageURL,
            readOnly: false  // ← Read-write for VM-specific data
        )
        let dataDevice = VZVirtioBlockDeviceConfiguration(attachment: dataAttachment)
        config.storageDevices.append(dataDevice)

        // Network - NAT with virtio-net
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()

        if let macAddress = VZMACAddress(string: "52:54:00:12:34:\(instanceID.prefix(2))") {
            networkDevice.macAddress = macAddress
        }

        config.networkDevices = [networkDevice]
        print("✅ Network: NAT with virtio-net")

        // Entropy - RNG device
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        print("✅ Entropy: virtio-rng")

        // Validate configuration
        try config.validate()
        print("✅ Configuration validated")

        return config
    }

    // MARK: - Sparse Image Creation

    func createSparseImage(at url: URL, sizeGB: Int) throws {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/hdiutil")
        task.arguments = [
            "create",
            "-size", "\(sizeGB)g",
            "-type", "SPARSE",
            "-fs", "APFS",
            "-volname", "VM-Data",
            url.deletingPathExtension().path
        ]

        try task.run()
        task.waitUntilExit()

        guard task.terminationStatus == 0 else {
            throw NSError(
                domain: "SparseImageCreation",
                code: Int(task.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: "Failed to create sparse image"]
            )
        }
    }

    // MARK: - VM Lifecycle

    func startVM(instanceID: String) throws {
        print("\n=== Creating VM with Proper Architecture ===")
        print("Instance ID: \(instanceID)")
        print("")

        let config = try createVMConfiguration(instanceID: instanceID)

        virtualMachine = VZVirtualMachine(configuration: config)
        virtualMachine.delegate = self

        print("\n=== Starting VM ===")

        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?

        virtualMachine.start { result in
            switch result {
            case .success:
                self.isRunning = true
                print("✅ VM started successfully!")
                print("\nVM Architecture:")
                print("  • Read-only base: ~/.vfkit/images/alpine-base.img (shared)")
                print("  • Sparse data: ~/.vfkit/instances/\(instanceID)-data.sparseimage (per-VM)")
                print("\nGuest OS sees:")
                print("  • /dev/vda - Read-only root filesystem (base)")
                print("  • /dev/vdb - Read-write data disk (sparse)")
            case .failure(let error):
                startError = error
                print("❌ Failed to start VM: \(error.localizedDescription)")
            }
            semaphore.signal()
        }

        semaphore.wait()

        if let error = startError {
            throw error
        }
    }

    func stopVM() {
        guard isRunning else { return }

        print("\n=== Stopping VM ===")

        let semaphore = DispatchSemaphore(value: 0)

        virtualMachine.stop { error in
            if let error = error {
                print("⚠️  Error stopping VM: \(error.localizedDescription)")
            } else {
                self.isRunning = false
                print("✅ VM stopped successfully")
            }
            semaphore.signal()
        }

        semaphore.wait()
    }

    // MARK: - VZVirtualMachineDelegate

    nonisolated func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n✅ Guest OS stopped cleanly")
    }

    nonisolated func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n❌ VM stopped with error: \(error.localizedDescription)")
    }
}

// MARK: - Main

@available(macOS 12.0, *)
func main() {
    print("=== Alpine ARM64 VM - Proper Architecture Demo ===")
    print("Architecture: arm64")
    print("Framework: Apple Virtualization.framework")
    print("")

    let vmManager = ProperVMArchitecture()

    do {
        // Start VM with unique instance ID
        try vmManager.startVM(instanceID: "demo-vm")

        // Run for a few seconds
        print("\n=== VM Running ===")
        print("Keeping VM alive for 5 seconds...")
        Thread.sleep(forTimeInterval: 5)

        // Stop VM
        vmManager.stopVM()

        print("\n=== Demo Complete ===")
        print("\nBenefits of This Architecture:")
        print("  ✅ Base image shared across all VMs (space efficient)")
        print("  ✅ Sparse data disks grow on demand (only use what's needed)")
        print("  ✅ APFS CoW enables instant cloning (cp -c)")
        print("  ✅ Read-only base prevents accidental modifications")
        print("  ✅ Per-VM data isolation (each VM has its own disk)")

        print("\nTo create more VMs:")
        print("  • Shared: kernel, initramfs, base image (reused)")
        print("  • Per-VM: Only sparse data disk (~15MB initial)")
        print("  • Total overhead per new VM: ~15MB (not 20GB!)")

    } catch {
        print("\n❌ Error: \(error.localizedDescription)")
        exit(1)
    }
}

if #available(macOS 12.0, *) {
    main()
} else {
    print("❌ Requires macOS 12.0 or later")
    exit(1)
}
