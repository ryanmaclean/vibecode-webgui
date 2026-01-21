//
// macOS VM Configuration - Apple Virtualization.framework
// Supports macOS guest VMs on Apple Silicon
//

import Foundation
import Virtualization

@available(macOS 12.0, *)
class MacOSVMConfiguration {
    
    static func create(name: String, diskPath: String, restoreImagePath: String?) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory for macOS guest
        config.cpuCount = 4
        config.memorySize = UInt64(8 * 1024 * 1024 * 1024) // 8GB for macOS
        
        // Platform: macOS platform
        let platform = VZMacPlatformConfiguration()
        
        // Hardware model
        let hardwareModelURL = URL(fileURLWithPath: "\(diskPath)/hardware-model.bin")
        if FileManager.default.fileExists(atPath: hardwareModelURL.path) {
            let hardwareModelData = try Data(contentsOf: hardwareModelURL)
            platform.hardwareModel = VZMacHardwareModel(dataRepresentation: hardwareModelData)!
        } else {
            // Create new hardware model (requires restore image for first boot)
            throw NSError(domain: "MacOSVM", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Hardware model not found. Requires macOS restore image (.ipsw) for first boot."
            ])
        }
        
        // Machine identifier
        let machineIDURL = URL(fileURLWithPath: "\(diskPath)/machine-id.bin")
        if FileManager.default.fileExists(atPath: machineIDURL.path) {
            let machineIDData = try Data(contentsOf: machineIDURL)
            platform.machineIdentifier = VZMacMachineIdentifier(dataRepresentation: machineIDData)!
        } else {
            platform.machineIdentifier = VZMacMachineIdentifier()
            try platform.machineIdentifier.dataRepresentation.write(to: machineIDURL)
        }
        
        // Auxiliary storage (for firmware updates)
        let auxStorageURL = URL(fileURLWithPath: "\(diskPath)/aux-storage.img")
        if !FileManager.default.fileExists(atPath: auxStorageURL.path) {
            let _ = try VZMacAuxiliaryStorage(creatingStorageAt: auxStorageURL, hardwareModel: platform.hardwareModel)
        }
        platform.auxiliaryStorage = VZMacAuxiliaryStorage(url: auxStorageURL)
        
        config.platform = platform
        
        // Boot Loader: macOS
        config.bootLoader = VZMacOSBootLoader()
        
        // Graphics
        let graphicsDevice = VZMacGraphicsDeviceConfiguration()
        graphicsDevice.displays = [
            VZMacGraphicsDisplayConfiguration(
                widthInPixels: 2560,
                heightInPixels: 1600,
                pixelsPerInch: 224 // Retina
            )
        ]
        config.graphicsDevices = [graphicsDevice]
        
        // Keyboard & Mouse
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        
        // Disk
        let mainDiskURL = URL(fileURLWithPath: "\(diskPath)/macos.img")
        if !FileManager.default.fileExists(atPath: mainDiskURL.path) {
            // Create 100GB disk for macOS
            let diskSize: UInt64 = 100 * 1024 * 1024 * 1024
            try FileManager.default.createFile(atPath: mainDiskURL.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: mainDiskURL)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("✅ Created 100GB macOS disk: \(mainDiskURL.path)")
        }
        
        let mainDisk = try VZDiskImageStorageDeviceAttachment(
            url: mainDiskURL,
            readOnly: false
        )
        let mainStorage = VZVirtioBlockDeviceConfiguration(attachment: mainDisk)
        config.storageDevices = [mainStorage]
        
        // Network (NAT for macOS guest)
        let networkDevice = NetworkConfig.createNATNetwork()
        config.networkDevices = [networkDevice]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Audio
        let audioInput = VZVirtioSoundDeviceConfiguration()
        audioInput.streams = [VZVirtioSoundDeviceInputStreamConfiguration()]
        let audioOutput = VZVirtioSoundDeviceConfiguration()
        audioOutput.streams = [VZVirtioSoundDeviceOutputStreamConfiguration()]
        config.audioDevices = [audioInput, audioOutput]
        
        // Trackpad (for macOS)
        config.pointingDevices = [VZMacTrackpadConfiguration()]
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
}

