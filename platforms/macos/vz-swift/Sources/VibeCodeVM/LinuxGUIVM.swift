//
// Linux GUI VM Configuration - Apple Virtualization.framework
// Based on: https://developer.apple.com/documentation/virtualization/running-gui-linux-in-a-virtual-machine-on-a-mac
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
class LinuxGUIVMConfiguration {
    
    static func create(name: String, diskPath: String, isoPath: String?) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory for GUI Linux
        config.cpuCount = 4  // GUI needs more power
        config.memorySize = UInt64(4 * 1024 * 1024 * 1024) // 4GB for GUI
        
        // Platform
        let platform = VZGenericPlatformConfiguration()
        config.platform = platform
        
        // Boot Loader - EFI for modern Linux distros
        let efi = VZEFIBootLoader()
        let efiVarStoreURL = URL(fileURLWithPath: "\(diskPath)/efi-nvram.bin")
        if !FileManager.default.fileExists(atPath: efiVarStoreURL.path) {
            try VZEFIVariableStore(creatingVariableStoreAt: efiVarStoreURL)
        }
        efi.variableStore = VZEFIVariableStore(url: efiVarStoreURL)
        config.bootLoader = efi
        
        // Graphics Device - VirtIO GPU for Linux
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080
            )
        ]
        config.graphicsDevices = [graphicsDevice]
        
        // Graphics Display - Required for GUI
        let graphicsDisplay = VZMacGraphicsDisplayConfiguration(
            widthInPixels: 1920,
            heightInPixels: 1080,
            pixelsPerInch: 144
        )
        
        // Keyboard & Mouse for GUI interaction
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        
        // Main Disk
        let mainDiskURL = URL(fileURLWithPath: "\(diskPath)/linux-gui.img")
        if !FileManager.default.fileExists(atPath: mainDiskURL.path) {
            // Create 64GB disk for Linux GUI
            let diskSize: UInt64 = 64 * 1024 * 1024 * 1024
            try FileManager.default.createFile(atPath: mainDiskURL.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: mainDiskURL)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("✅ Created 64GB Linux GUI disk: \(mainDiskURL.path)")
        }
        
        let mainDisk = try VZDiskImageStorageDeviceAttachment(
            url: mainDiskURL,
            readOnly: false
        )
        let mainStorage = VZVirtioBlockDeviceConfiguration(attachment: mainDisk)
        
        var storageDevices: [VZStorageDeviceConfiguration] = [mainStorage]
        
        // ISO for installation (Ubuntu, Fedora, etc)
        if let isoPath = isoPath {
            let isoURL = URL(fileURLWithPath: isoPath)
            if FileManager.default.fileExists(atPath: isoURL.path) {
                let isoAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: isoURL,
                    readOnly: true
                )
                let isoStorage = VZUSBMassStorageDeviceConfiguration(attachment: isoAttachment)
                storageDevices.append(isoStorage)
                print("✅ Attached Linux ISO: \(isoPath)")
            }
        }
        
        config.storageDevices = storageDevices
        
        // Network (NAT for Linux GUI)
        let networkDevice = NetworkConfig.createNATNetwork()
        config.networkDevices = [networkDevice]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Audio (for multimedia)
        let audioInput = VZVirtioSoundDeviceConfiguration()
        audioInput.streams = [VZVirtioSoundDeviceInputStreamConfiguration()]
        let audioOutput = VZVirtioSoundDeviceConfiguration()
        audioOutput.streams = [VZVirtioSoundDeviceOutputStreamConfiguration()]
        config.audioDevices = [audioInput, audioOutput]
        
        // Directory Sharing (Rosetta for x86_64 on ARM)
        if #available(macOS 13.0, *) {
            // Share a directory between host and guest
            let sharedDirectory = VZSharedDirectory(
                url: URL(fileURLWithPath: "\(diskPath)/shared"),
                readOnly: false
            )
            let share = VZSingleDirectoryShare(directory: sharedDirectory)
            let tag = VZVirtioFileSystemDeviceConfiguration.macOSGuestAutomountTag
            let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: tag)
            sharingDevice.share = share
            config.directorySharingDevices = [sharingDevice]
            
            // Create shared directory if it doesn't exist
            try? FileManager.default.createDirectory(
                atPath: "\(diskPath)/shared",
                withIntermediateDirectories: true
            )
        }
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
}

