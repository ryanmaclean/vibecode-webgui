#!/usr/bin/env swift

import Foundation
import Virtualization

@available(macOS 12.0, *)
func quickTest() throws {
    print("=== Quick VM Test ===")
    print("1. Creating configuration...")

    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 1024 * 1024 * 1024

    let homeDir = NSHomeDirectory()
    let kernelURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/vmlinux")
    let initramfsURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/initramfs")
    let diskURL = URL(fileURLWithPath: "\(homeDir)/.vfkit/images/alpine-base.img")

    print("2. Setting up bootloader...")
    let bootLoader = VZLinuxBootLoader(kernelURL: kernelURL)
    bootLoader.initialRamdiskURL = initramfsURL
    bootLoader.commandLine = "console=hvc0 root=/dev/vda ro rootfstype=ext4"
    config.bootLoader = bootLoader

    print("3. Attaching disk...")
    let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: true)
    config.storageDevices = [VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)]

    print("4. Configuring network...")
    let networkDevice = VZVirtioNetworkDeviceConfiguration()
    networkDevice.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [networkDevice]

    print("5. Adding entropy...")
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    print("6. Validating configuration...")
    try config.validate()
    print("✅ Configuration valid!")

    print("7. Creating VM...")
    let vm = VZVirtualMachine(configuration: config)
    print("✅ VM created!")

    print("8. Attempting to start VM...")
    fflush(stdout)

    let semaphore = DispatchSemaphore(value: 0)
    var startError: Error?

    vm.start { result in
        switch result {
        case .success:
            print("\n✅ VM STARTED SUCCESSFULLY!")
            print("VM State: \(vm.state.rawValue)")
        case .failure(let error):
            print("\n❌ VM START FAILED: \(error.localizedDescription)")
            startError = error
        }
        semaphore.signal()
    }

    print("9. Waiting for start...")
    semaphore.wait()

    if let error = startError {
        throw error
    }

    print("\n10. VM is running! Stopping after 1 second...")
    Thread.sleep(forTimeInterval: 1)

    print("11. Stopping VM...")
    let stopSemaphore = DispatchSemaphore(value: 0)
    vm.stop { error in
        if let error = error {
            print("Stop error: \(error.localizedDescription)")
        } else {
            print("✅ VM stopped cleanly")
        }
        stopSemaphore.signal()
    }
    stopSemaphore.wait()

    print("\n=== Test Complete ===")
}

if #available(macOS 12.0, *) {
    do {
        try quickTest()
    } catch {
        print("\n❌ Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("Requires macOS 12.0+")
    exit(1)
}
