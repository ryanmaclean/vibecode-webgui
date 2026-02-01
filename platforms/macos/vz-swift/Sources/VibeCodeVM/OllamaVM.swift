//
// Ollama VM Configuration - Apple Virtualization.framework
// Full Alpine Linux with persistent disk for Ollama installation
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
class OllamaVMConfiguration {
    
    static func create(name: String, diskPath: String, alpineISO: String?) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory for Ollama (needs resources for models)
        config.cpuCount = 4
        config.memorySize = UInt64(8 * 1024 * 1024 * 1024) // 8GB for model inference
        
        // Platform - Generic for Linux
        let platform = VZGenericPlatformConfiguration()
        config.platform = platform
        
        // Boot Loader - EFI for modern Linux
        let efi = VZEFIBootLoader()
        let efiVarStoreURL = URL(fileURLWithPath: "\(diskPath)/efi-nvram.bin")
        if !FileManager.default.fileExists(atPath: efiVarStoreURL.path) {
            try VZEFIVariableStore(creatingVariableStoreAt: efiVarStoreURL)
        }
        efi.variableStore = VZEFIVariableStore(url: efiVarStoreURL)
        config.bootLoader = efi
        
        // Main Disk (50GB for Ollama models)
        let mainDiskURL = URL(fileURLWithPath: "\(diskPath)/ollama-disk.img")
        if !FileManager.default.fileExists(atPath: mainDiskURL.path) {
            let diskSize: UInt64 = 50 * 1024 * 1024 * 1024 // 50GB
            try FileManager.default.createFile(atPath: mainDiskURL.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: mainDiskURL)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("✅ Created 50GB Ollama disk: \(mainDiskURL.path)")
        }
        
        let mainDisk = try VZDiskImageStorageDeviceAttachment(
            url: mainDiskURL,
            readOnly: false
        )
        let mainStorage = VZVirtioBlockDeviceConfiguration(attachment: mainDisk)
        
        var storageDevices: [VZStorageDeviceConfiguration] = [mainStorage]
        
        // Alpine ISO for installation
        if let alpineISO = alpineISO {
            let isoURL = URL(fileURLWithPath: alpineISO)
            if FileManager.default.fileExists(atPath: isoURL.path) {
                let isoAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: isoURL,
                    readOnly: true
                )
                let isoStorage = VZUSBMassStorageDeviceConfiguration(attachment: isoAttachment)
                storageDevices.append(isoStorage)
                print("✅ Attached Alpine ISO: \(alpineISO)")
            }
        }
        
        config.storageDevices = storageDevices
        
        // Network - NAT (no MAC address set, let Apple auto-generate)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        print("📡 Network configured: NAT (auto MAC)")
        
        // Serial Console for installation
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        let serialAttachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialConfig.attachment = serialAttachment
        config.serialPorts = [serialConfig]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
}

