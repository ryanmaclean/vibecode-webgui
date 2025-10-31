#!/usr/bin/env swift
import Foundation
import Virtualization

@available(macOS 12.0, *)
func main() throws {
    print("🚀 Tiny VM Test")

    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 1024 * 1024 * 1024

    // Use the WORKING initramfs from vfkit
    let kernel = URL(fileURLWithPath: "\(NSHomeDirectory())/.vfkit/vms/vibecode-valkey/kernel/vmlinux")
    let initrd = URL(fileURLWithPath: "\(NSHomeDirectory())/.vfkit/vms/vibecode-valkey/rootfs/auto-exec.cpio.gz")
    let disk = URL(fileURLWithPath: "\(NSHomeDirectory())/.vfkit/vms/vibecode-valkey/disk/root.img")

    let boot = VZLinuxBootLoader(kernelURL: kernel)
    boot.initialRamdiskURL = initrd
    boot.commandLine = "console=hvc0 root=/dev/vda rw quiet"
    config.bootLoader = boot

    config.storageDevices = [VZVirtioBlockDeviceConfiguration(
        attachment: try VZDiskImageStorageDeviceAttachment(url: disk, readOnly: false)
    )]

    let net = VZVirtioNetworkDeviceConfiguration()
    net.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [net]
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    try config.validate()
    print("✅ Config valid")

    let vm = VZVirtualMachine(configuration: config)
    print("🔄 Starting VM...")

    let sem = DispatchSemaphore(value: 0)
    var err: Error?

    vm.start { result in
        if case .failure(let e) = result { err = e }
        else { print("✅ VM STARTED!") }
        sem.signal()
    }

    sem.wait()
    if let e = err { throw e }

    print("⏱️  Running 2 seconds...")
    Thread.sleep(forTimeInterval: 2)

    print("🛑 Stopping...")
    let sem2 = DispatchSemaphore(value: 0)
    vm.stop { _ in sem2.signal() }
    sem2.wait()

    print("✅ Done!")
}

if #available(macOS 12.0, *) {
    do { try main() }
    catch { print("❌ \(error)"); exit(1) }
} else {
    print("Requires macOS 12.0+"); exit(1)
}
