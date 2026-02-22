#!/usr/bin/env swift
/*
 * VibeCode Linux VM Manager - Standalone Distribution Binary
 * Native Apple Virtualization.framework with UEFI boot
 *
 * Copyright (c) 2025 VibeCode Contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import Foundation
import Virtualization

@available(macOS 13.0, *)
func createLinuxVM(vmPath: String) throws -> VZVirtualMachine {
    // Pre-flight validation: Check VM path exists
    guard FileManager.default.fileExists(atPath: vmPath) else {
        throw NSError(domain: "VibeCodeVM", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "VM path does not exist: \(vmPath). Please create the VM directory first."
        ])
    }

    let config = VZVirtualMachineConfiguration()

    // Platform
    config.platform = VZGenericPlatformConfiguration()

    // CPU & Memory - validate against host resources
    let hostCPUCount = ProcessInfo.processInfo.processorCount
    let requestedCPUCount = 2

    // Validate CPU count doesn't exceed host
    guard requestedCPUCount <= hostCPUCount else {
        throw NSError(domain: "VibeCodeVM", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Requested CPU count (\(requestedCPUCount)) exceeds host CPU count (\(hostCPUCount))"
        ])
    }

    config.cpuCount = requestedCPUCount

    // Validate memory against host physical memory
    let hostMemory = ProcessInfo.processInfo.physicalMemory
    let requestedMemory: UInt64 = 1_073_741_824 // 1GB
    let minMemory: UInt64 = 512 * 1024 * 1024 // 512MB minimum

    guard requestedMemory >= minMemory else {
        throw NSError(domain: "VibeCodeVM", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "Requested memory (\(requestedMemory / (1024 * 1024))MB) is below minimum (\(minMemory / (1024 * 1024))MB)"
        ])
    }

    guard requestedMemory <= hostMemory else {
        throw NSError(domain: "VibeCodeVM", code: 4, userInfo: [
            NSLocalizedDescriptionKey: "Requested memory (\(requestedMemory / (1024 * 1024))MB) exceeds host memory (\(hostMemory / (1024 * 1024 * 1024))GB)"
        ])
    }

    config.memorySize = requestedMemory

    // UEFI Boot - validate EFI variable store creation
    let efi = VZEFIBootLoader()
    let efiPath = "\(vmPath)/EFI.nvram"
    let efiURL = URL(fileURLWithPath: efiPath)

    do {
        if !FileManager.default.fileExists(atPath: efiPath) {
            print("  Creating new EFI variable store...")
            try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
        }
        efi.variableStore = try VZEFIVariableStore(url: efiURL)
        config.bootLoader = efi
    } catch {
        throw NSError(domain: "VibeCodeVM", code: 5, userInfo: [
            NSLocalizedDescriptionKey: "Failed to create EFI variable store at \(efiPath): \(error.localizedDescription)"
        ])
    }

    // Disk - validate existence and readability before attaching
    let diskPath = "\(vmPath)/disk.img"
    let diskURL = URL(fileURLWithPath: diskPath)

    guard FileManager.default.fileExists(atPath: diskPath) else {
        throw NSError(domain: "VibeCodeVM", code: 6, userInfo: [
            NSLocalizedDescriptionKey: "Disk image not found: \(diskPath). Please create or provide a disk image."
        ])
    }

    guard FileManager.default.isReadableFile(atPath: diskPath) else {
        throw NSError(domain: "VibeCodeVM", code: 7, userInfo: [
            NSLocalizedDescriptionKey: "Disk image not readable: \(diskPath). Check file permissions."
        ])
    }

    print("  Attaching disk: \(diskPath)")

    do {
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false,
            cachingMode: .automatic,
            synchronizationMode: .fsync
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]
    } catch {
        throw NSError(domain: "VibeCodeVM", code: 8, userInfo: [
            NSLocalizedDescriptionKey: "Failed to attach disk \(diskPath): \(error.localizedDescription)"
        ])
    }

    // Network
    let net = VZVirtioNetworkDeviceConfiguration()
    net.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [net]

    // Entropy
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    // Serial Console
    let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
    serial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: .standardInput,
        fileHandleForWriting: .standardOutput
    )
    config.serialPorts = [serial]

    // Final validation
    do {
        try config.validate()
    } catch {
        throw NSError(domain: "VibeCodeVM", code: 9, userInfo: [
            NSLocalizedDescriptionKey: "VM configuration validation failed: \(error.localizedDescription)"
        ])
    }

    return VZVirtualMachine(configuration: config)
}

// Main
if #available(macOS 13.0, *) {
    let vmName = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "alpine-test"
    let vmPath = "\(NSHomeDirectory())/.vfkit/vms/\(vmName)"
    
    print("🚀 VibeCode VM Manager")
    print("VM: \(vmName)")
    print("Path: \(vmPath)")
    print("")
    
    do {
        print("📀 Creating VM configuration...")
        let vm = try createLinuxVM(vmPath: vmPath)
        
        print("✅ Starting VM...")
        let semaphore = DispatchSemaphore(value: 0)
        
        vm.start { result in
            switch result {
            case .success:
                print("✅ VM running!")
                print("Press Ctrl+C to stop")
            case .failure(let error):
                print("❌ VM failed: \(error)")
                semaphore.signal()
            }
        }
        
        semaphore.wait()
        
    } catch {
        print("❌ Error: \(error)")
        exit(1)
    }
} else {
    print("❌ macOS 13+ required")
    exit(1)
}

