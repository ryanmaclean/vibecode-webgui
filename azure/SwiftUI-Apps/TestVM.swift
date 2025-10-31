#!/usr/bin/env swift
import Foundation
import Virtualization

class VMTestDelegate: NSObject, VZVirtualMachineDelegate {
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("VM stopped with error: \(error.localizedDescription)")
        exit(1)
    }

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("Guest shut down")
        exit(0)
    }
}

print("=== Testing VibeCode VM Configuration ===\n")

// Same configuration as the app
let config = VZVirtualMachineConfiguration()
config.cpuCount = 2
config.memorySize = 1024 * 1024 * 1024

// Use the bundled kernel and initramfs from app bundle
let kernelPath = "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/vmlinux-raw"
let initrdPath = "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz"

print("Kernel: \(kernelPath)")
print("Initrd: \(initrdPath)")

guard FileManager.default.fileExists(atPath: kernelPath) else {
    print("ERROR: Kernel not found at \(kernelPath)")
    exit(1)
}

guard FileManager.default.fileExists(atPath: initrdPath) else {
    print("ERROR: Initrd not found at \(initrdPath)")
    exit(1)
}

let kernel = URL(fileURLWithPath: kernelPath)
let initrd = URL(fileURLWithPath: initrdPath)

let bootloader = VZLinuxBootLoader(kernelURL: kernel)
bootloader.initialRamdiskURL = initrd
bootloader.commandLine = "console=hvc0"
config.bootLoader = bootloader

// Network with specific MAC
let net = VZVirtioNetworkDeviceConfiguration()
let macAddress = VZMACAddress(string: "52:54:00:12:34:90")!
net.macAddress = macAddress
net.attachment = VZNATNetworkDeviceAttachment()
config.networkDevices = [net]

print("Network: MAC=\(macAddress.string)")

// Serial console
let consoleLogPath = URL(fileURLWithPath: "/tmp/test-vm-console.log")
FileManager.default.createFile(atPath: consoleLogPath.path, contents: nil)
let consoleFileHandle = try! FileHandle(forWritingTo: consoleLogPath)

let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
serial.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: nil,
    fileHandleForWriting: consoleFileHandle
)
config.serialPorts = [serial]

// Entropy
config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

// Platform
let platform = VZGenericPlatformConfiguration()
platform.machineIdentifier = VZGenericMachineIdentifier()
config.platform = platform

print("\nValidating configuration...")
do {
    try config.validate()
    print("✓ Configuration valid")
} catch {
    print("✗ Configuration validation failed: \(error.localizedDescription)")
    exit(1)
}

print("\nStarting VM...")
let vm = VZVirtualMachine(configuration: config)
let delegate = VMTestDelegate()
vm.delegate = delegate

vm.start { result in
    switch result {
    case .success:
        print("✓ VM started successfully!")
        print("\nVM is now running. Monitoring console output...")
        print("Console log: \(consoleLogPath.path)")
        print("Press Ctrl+C to stop\n")
    case .failure(let error):
        print("✗ VM failed to start: \(error.localizedDescription)")
        exit(1)
    }
}

// Monitor console output
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    if let output = try? String(contentsOf: consoleLogPath, encoding: .utf8) {
        let lines = output.split(separator: "\n")
        if lines.count > 0 {
            print("=== Console Output (last 10 lines) ===")
            for line in lines.suffix(10) {
                print(line)
            }
            print("=====================================\n")
        }
    }
}

// Keep running
RunLoop.main.run()
