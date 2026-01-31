//
// OpenClaw Tiny macOS VM - Tahoe+, ARM64, Apple VZ
// Minimal footprint with OpenClaw + Tailscale + Let's Encrypt
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
class OpenClawVMConfiguration {
    
    static func create(name: String, diskPath: String) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // TINY: Minimal resources for OpenClaw
        config.cpuCount = 2  // Minimal CPU
        config.memorySize = UInt64(2 * 1024 * 1024 * 1024) // 2GB RAM
        
        // Platform: macOS
        let platform = VZMacPlatformConfiguration()
        
        // Hardware model (reuse or create)
        let hardwareModelURL = URL(fileURLWithPath: "\(diskPath)/hardware-model.bin")
        if FileManager.default.fileExists(atPath: hardwareModelURL.path) {
            let hardwareModelData = try Data(contentsOf: hardwareModelURL)
            platform.hardwareModel = VZMacHardwareModel(dataRepresentation: hardwareModelData)!
        } else {
            // Will need restore image for first boot
            throw NSError(domain: "OpenClawVM", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Hardware model required. Use macOS restore image (.ipsw) for first boot."
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
        
        // Auxiliary storage
        let auxStorageURL = URL(fileURLWithPath: "\(diskPath)/aux-storage.img")
        if !FileManager.default.fileExists(atPath: auxStorageURL.path) {
            let _ = try VZMacAuxiliaryStorage(creatingStorageAt: auxStorageURL, hardwareModel: platform.hardwareModel)
        }
        platform.auxiliaryStorage = VZMacAuxiliaryStorage(url: auxStorageURL)
        config.platform = platform
        
        // Boot loader
        config.bootLoader = VZMacOSBootLoader()
        
        // Minimal graphics (headless capable)
        let graphicsDevice = VZMacGraphicsDeviceConfiguration()
        graphicsDevice.displays = [
            VZMacGraphicsDisplayConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080,
                pixelsPerInch: 110
            )
        ]
        config.graphicsDevices = [graphicsDevice]
        
        // Input devices
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZMacTrackpadConfiguration()]
        
        // TINY disk: 20GB (minimal for macOS + OpenClaw)
        let mainDiskURL = URL(fileURLWithPath: "\(diskPath)/openclaw.img")
        if !FileManager.default.fileExists(atPath: mainDiskURL.path) {
            let diskSize: UInt64 = 20 * 1024 * 1024 * 1024 // 20GB
            try FileManager.default.createFile(atPath: mainDiskURL.path, contents: nil)
            let fileHandle = try FileHandle(forWritingTo: mainDiskURL)
            try fileHandle.truncate(atOffset: diskSize)
            try fileHandle.close()
            print("✅ Created 20GB OpenClaw disk: \(mainDiskURL.path)")
        }
        
        let mainDisk = try VZDiskImageStorageDeviceAttachment(
            url: mainDiskURL,
            readOnly: false,
            cachingMode: .automatic,
            synchronizationMode: .full
        )
        let mainStorage = VZVirtioBlockDeviceConfiguration(attachment: mainDisk)
        config.storageDevices = [mainStorage]
        
        // Network: NAT (will fix carrier signal issue)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        // CRITICAL: Don't set MAC address - let Apple auto-generate
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
}
