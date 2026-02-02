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
    let config = VZVirtualMachineConfiguration()
    
    // Platform
    config.platform = VZGenericPlatformConfiguration()
    
    // CPU & Memory
    config.cpuCount = 2
    config.memorySize = 1_073_741_824 // 1GB
    
    // UEFI Boot
    let efi = VZEFIBootLoader()
    let efiPath = "\(vmPath)/EFI.nvram"
    let efiURL = URL(fileURLWithPath: efiPath)
    
    if !FileManager.default.fileExists(atPath: efiPath) {
        let _ = try? VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    }
    efi.variableStore = VZEFIVariableStore(url: efiURL)
    config.bootLoader = efi
    
    // Disk
    let diskPath = "\(vmPath)/disk.img"
    let diskURL = URL(fileURLWithPath: diskPath)
    let diskAttachment = try VZDiskImageStorageDeviceAttachment(
        url: diskURL,
        readOnly: false
    )
    let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
    config.storageDevices = [blockDevice]
    
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
    
    // Validate
    try config.validate()
    
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

