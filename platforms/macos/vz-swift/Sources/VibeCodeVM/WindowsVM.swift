//
// Windows VM Configuration - Apple Virtualization.framework
// Supports Windows 10/11 on Apple Silicon
//

import Foundation
import Virtualization

@available(macOS 12.0, *)
class WindowsVMConfiguration {
    
    static func create(name: String, diskPath: String, isoPath: String?) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory for Windows
        config.cpuCount = 4  // Windows needs more cores
        config.memorySize = UInt64(4 * 1024 * 1024 * 1024) // 4GB minimum for Windows 11
        
        // Platform: EFI for Windows
        let platform = VZGenericPlatformConfiguration()
        let efi = VZEFIBootLoader()
        
        // Create/load EFI variables store
        let efiVarStoreURL = URL(fileURLWithPath: "\(diskPath)/efi-nvram.bin")
        if !FileManager.default.fileExists(atPath: efiVarStoreURL.path) {
            try VZEFIVariableStore(creatingVariableStoreAt: efiVarStoreURL)
        }
        efi.variableStore = VZEFIVariableStore(url: efiVarStoreURL)
        
        config.platform = platform
        config.bootLoader = efi
        
        // Graphics (Windows requires display)
        let graphicsDevice = VZMacGraphicsDeviceConfiguration()
        graphicsDevice.displays = [
            VZMacGraphicsDisplayConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080,
                pixelsPerInch: 144
            )
        ]
        config.graphicsDevices = [graphicsDevice]
        
        // Keyboard & Mouse
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        
        // Disk (Main Windows installation)
        let mainDiskURL = URL(fileURLWithPath: "\(diskPath)/windows.img")
        if !FileManager.default.fileExists(atPath: mainDiskURL.path) {
            // Create 64GB disk for Windows
            let diskSize: UInt64 = 64 * 1024 * 1024 * 1024
            try FileManager.default.createFile(atPath: mainDiskURL.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: mainDiskURL)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("✅ Created 64GB Windows disk: \(mainDiskURL.path)")
        }
        
        let mainDisk = try VZDiskImageStorageDeviceAttachment(
            url: mainDiskURL,
            readOnly: false
        )
        let mainStorage = VZVirtioBlockDeviceConfiguration(attachment: mainDisk)
        
        var storageDevices: [VZStorageDeviceConfiguration] = [mainStorage]
        
        // ISO (for installation)
        if let isoPath = isoPath {
            let isoURL = URL(fileURLWithPath: isoPath)
            if FileManager.default.fileExists(atPath: isoURL.path) {
                let isoAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: isoURL,
                    readOnly: true
                )
                let isoStorage = VZVirtioBlockDeviceConfiguration(attachment: isoAttachment)
                storageDevices.append(isoStorage)
                print("✅ Attached Windows ISO: \(isoPath)")
            }
        }
        
        config.storageDevices = storageDevices
        
        // Network (NAT for Windows)
        let networkDevice = NetworkConfig.createNATNetwork()
        config.networkDevices = [networkDevice]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Audio (optional but nice for Windows)
        let audioInput = VZVirtioSoundDeviceConfiguration()
        audioInput.streams = [VZVirtioSoundDeviceInputStreamConfiguration()]
        let audioOutput = VZVirtioSoundDeviceConfiguration()
        audioOutput.streams = [VZVirtioSoundDeviceOutputStreamConfiguration()]
        config.audioDevices = [audioInput, audioOutput]
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
}

