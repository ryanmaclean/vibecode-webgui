#!/usr/bin/env swift
import Foundation
import Virtualization

// Direct test of VM with verbose logging

print("=== Direct VM Network Test ===\n")

let consoleLogPath = "/tmp/direct-vm-test.log"

class VMDelegate: NSObject, VZVirtualMachineDelegate {
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("Guest stopped")
        exit(0)
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("VM error: \(error)")
        exit(1)
    }
}

func createConfig() throws -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 1024 * 1024 * 1024

    let home = FileManager.default.homeDirectoryForCurrentUser.path
    let kernel = URL(fileURLWithPath: "\(home)/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw")
    let initrd = URL(fileURLWithPath: "\(home)/vibecode-webgui/azure/bun-openvscode.cpio.gz")

    print("Kernel: \(kernel.path)")
    print("Initramfs: \(initrd.path)\n")

    let bootloader = VZLinuxBootLoader(kernelURL: kernel)
    bootloader.initialRamdiskURL = initrd
    // Very verbose kernel logging to see driver initialization
    let cmdLine = "console=hvc0 debug loglevel=8 initcall_debug dyndbg=\"module virtio_net +p\""
    bootloader.commandLine = cmdLine
    print("Kernel command line: \(cmdLine)\n")

    config.bootLoader = bootloader

    // Network with explicit configuration
    print("Configuring VZVirtioNetworkDeviceConfiguration...")
    let net = VZVirtioNetworkDeviceConfiguration()
    let macAddress = VZMACAddress(string: "52:54:00:12:34:56")!
    net.macAddress = macAddress
    print("  MAC Address: \(macAddress.string)")

    let natAttachment = VZNATNetworkDeviceAttachment()
    net.attachment = natAttachment
    print("  Attachment: VZNATNetworkDeviceAttachment")
    print("  Device: VZVirtioNetworkDeviceConfiguration\n")

    config.networkDevices = [net]

    // Console
    try? FileManager.default.removeItem(atPath: consoleLogPath)
    FileManager.default.createFile(atPath: consoleLogPath, contents: nil)
    let consoleHandle = try FileHandle(forWritingTo: URL(fileURLWithPath: consoleLogPath))

    let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
    serial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: nil,
        fileHandleForWriting: consoleHandle
    )
    config.serialPorts = [serial]

    // Entropy
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    // Platform
    let platform = VZGenericPlatformConfiguration()
    platform.machineIdentifier = VZGenericMachineIdentifier()
    config.platform = platform

    print("Validating configuration...")
    try config.validate()
    print("Configuration valid!\n")

    return config
}

// Monitor console in background
var lastSize: UInt64 = 0
Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
    if let attrs = try? FileManager.default.attributesOfItem(atPath: consoleLogPath),
       let size = attrs[.size] as? UInt64,
       size > lastSize {
        if let data = try? Data(contentsOf: URL(fileURLWithPath: consoleLogPath)),
           let content = String(data: data, encoding: .utf8) {
            let lines = content.split(separator: "\n")
            for line in lines.suffix(Int(size - lastSize) / 50 + 1) {
                if line.contains("virtio") || line.contains("eth0") || line.contains("network") {
                    print("📡 \(line)")
                }
            }
        }
        lastSize = size
    }
}

do {
    let config = try createConfig()
    let delegate = VMDelegate()
    let vm = VZVirtualMachine(configuration: config)
    vm.delegate = delegate

    print("Starting VM...\n")
    vm.start { result in
        switch result {
        case .success:
            print("✓ VM started successfully\n")
            print("Monitoring for 30 seconds...\n")

            DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
                print("\n=== Test Complete ===")
                print("Full log: \(consoleLogPath)\n")

                if let content = try? String(contentsOfFile: consoleLogPath, encoding: .utf8) {
                    let hasEth0 = content.contains("eth0")
                    let hasVirtio = content.contains("virtio") && content.contains("net")

                    print("Results:")
                    print("  eth0 found: \(hasEth0 ? "YES ✓" : "NO ✗")")
                    print("  virtio-net messages: \(hasVirtio ? "YES ✓" : "NO ✗")")

                    if !hasEth0 && !hasVirtio {
                        print("\n⚠️  No network device detected!")
                        print("This indicates the virtio-net driver is not loading.\n")
                    }
                }

                vm.stop { _ in
                    exit(0)
                }
            }

        case .failure(let error):
            print("✗ VM failed to start: \(error)")
            exit(1)
        }
    }

    RunLoop.main.run()

} catch {
    print("Error: \(error)")
    exit(1)
}
