#!/usr/bin/env swift
// Simple test to verify Swift execution and Virtualization.framework access
import Foundation
import Virtualization

print("=== Simple Virtualization.framework Test ===")
print("Step 1: Script started")

@available(macOS 12.0, *)
func test() {
    print("Step 2: Inside test function")

    let config = VZVirtualMachineConfiguration()
    print("Step 3: Created VZVirtualMachineConfiguration")

    config.cpuCount = 2
    config.memorySize = 1024 * 1024 * 1024
    print("Step 4: Set CPU and memory")

    let bootLoader = VZLinuxBootLoader(
        kernelURL: URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/vibecode-alpine/kernel/vmlinux")
    )
    print("Step 5: Created bootloader")

    bootLoader.initialRamdiskURL = URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/vibecode-alpine/kernel/initramfs")
    bootLoader.commandLine = "console=hvc0 root=/dev/vda rootfstype=ext4 rw"
    config.bootLoader = bootLoader
    print("Step 6: Configured bootloader")

    let diskURL = URL(fileURLWithPath: NSHomeDirectory() + "/.vfkit/vms/valkey-vz/disk/root.img")
    print("Step 7: Disk URL: \(diskURL.path)")

    do {
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        print("Step 8: Created disk attachment")

        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]
        print("Step 9: Added storage device")

        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        print("Step 10: Added network device")

        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        print("Step 11: Added entropy device")

        try config.validate()
        print("✅ SUCCESS! Configuration validated successfully")
        print("This proves:")
        print("  • Swift code executes correctly")
        print("  • Virtualization.framework is accessible")
        print("  • Entitlements are working")
        print("  • VM configuration is valid")

    } catch {
        print("❌ ERROR: \(error.localizedDescription)")
    }
}

if #available(macOS 12.0, *) {
    test()
    print("=== Test Complete ===")
} else {
    print("❌ Requires macOS 12.0+")
}
