#!/usr/bin/env swift
import Foundation
import Virtualization

// MARK: - Configuration
struct VMConfig {
    let name: String
    let memory: Int // MiB
    let cpus: Int
    let diskPath: String
    let ipswPath: String?
}

// MARK: - VM Manager
class VMManager {
    let vmDir = FileManager.default.urls(for: .userDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("VMs")
    
    init() {
        try? FileManager.default.createDirectory(at: vmDir, withIntermediateDirectories: true)
    }
    
    func listVMs() -> [String] {
        guard let files = try? FileManager.default.contentsOfDirectory(at: vmDir, includingPropertiesForKeys: nil) else {
            return []
        }
        return files.map { $0.lastPathComponent }
    }
    
    func createVM(config: VMConfig) throws {
        let vmPath = vmDir.appendingPathComponent(config.name)
        
        // Create disk
        let diskURL = vmPath.appendingPathComponent("disk.img")
        let diskSize = config.memory * 1024 * 1024 * 1024 // GiB to bytes
        try createDisk(at: diskURL, size: diskSize)
        
        // Load IPSW if provided
        if let ipswPath = config.ipswPath {
            let ipswURL = URL(fileURLWithPath: ipswPath)
            try loadRestoreImage(from: ipswURL, to: vmPath, config: config)
        }
        
        // Create VM configuration using VZVirtualMachineConfiguration
        let vmConfig = try createVMConfiguration(config: config, diskURL: diskURL)
        
        // Save configuration
        let configURL = vmPath.appendingPathComponent("config.json")
        let data = try JSONEncoder().encode(vmConfig)
        try data.write(to: configURL)
        
        print("✅ VM created: \(config.name)")
    }
    
    func startVM(name: String) throws {
        let vmPath = vmDir.appendingPathComponent(name)
        let configURL = vmPath.appendingPathComponent("config.json")
        
        guard FileManager.default.fileExists(atPath: configURL.path) else {
            throw VMError.vmNotFound
        }
        
        let data = try Data(contentsOf: configURL)
        let vmConfig = try JSONDecoder().decode(VMConfigurationData.self, from: data)
        
        // Create VZVirtualMachineConfiguration from saved data
        let config = try buildConfiguration(from: vmConfig)
        let vm = VZVirtualMachine(configuration: config)
        
        // Start VM
        vm.start { result in
            switch result {
            case .success:
                print("✅ VM started: \(name)")
            case .failure(let error):
                print("❌ Failed to start VM: \(error)")
            }
        }
    }
    
    private func createDisk(at url: URL, size: Int) throws {
        if !FileManager.default.fileExists(atPath: url.path) {
            let data = Data(count: size)
            try data.write(to: url)
        }
    }
    
    private func loadRestoreImage(from ipswURL: URL, to vmPath: URL, config: VMConfig) throws {
        let semaphore = DispatchSemaphore(value: 0)
        var image: VZMacOSRestoreImage?
        var error: Error?
        
        VZMacOSRestoreImage.load(from: ipswURL) { result in
            switch result {
            case .success(let img):
                image = img
            case .failure(let err):
                error = err
            }
            semaphore.signal()
        }
        
        semaphore.wait()
        
        guard let restoreImage = image else {
            throw error ?? VMError.ipswLoadFailed
        }
        
        // Save hardware model
        let hardwareModel = restoreImage.mostFeaturefulSupportedConfiguration
        let hwData = hardwareModel.hardwareModel.dataRepresentation()
        
        try hwData.write(to: vmPath.appendingPathComponent("HardwareModel.bin"))
        
        // Generate machine ID
        let machineID = VZMacMachineIdentifier()
        let midData = machineID.dataRepresentation
        try midData.write(to: vmPath.appendingPathComponent("MachineIdentifier.bin"))
        
        // Create auxiliary storage
        let auxURL = vmPath.appendingPathComponent("AuxiliaryStorage.img")
        _ = try VZMacAuxiliaryStorage(creatingStorageAt: auxURL, hardwareModel: hardwareModel.hardwareModel)
        
        print("✅ Hardware model extracted from IPSW")
    }
    
    private func createVMConfiguration(config: VMConfig, diskURL: URL) throws -> VMConfigurationData {
        var vmConfig = VMConfigurationData()
        vmConfig.name = config.name
        vmConfig.memory = config.memory
        vmConfig.cpus = config.cpus
        vmConfig.diskPath = diskURL.path
        
        // Load hardware model if exists
        let vmPath = vmDir.appendingPathComponent(config.name)
        let hwURL = vmPath.appendingPathComponent("HardwareModel.bin")
        let midURL = vmPath.appendingPathComponent("MachineIdentifier.bin")
        let auxURL = vmPath.appendingPathComponent("AuxiliaryStorage.img")
        
        if FileManager.default.fileExists(atPath: hwURL.path) {
            vmConfig.hardwareModelPath = hwURL.path
            vmConfig.machineIdentifierPath = midURL.path
            vmConfig.auxiliaryImagePath = auxURL.path
        }
        
        return vmConfig
    }
    
    private func buildConfiguration(from data: VMConfigurationData) throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        
        // Set CPUs and memory
        config.cpuCount = data.cpus
        config.memorySize = UInt64(data.memory) * 1024 * 1024 // MiB to bytes
        
        // Platform
        if let hwPath = data.hardwareModelPath {
            let hwData = try Data(contentsOf: URL(fileURLWithPath: hwPath))
            let hardwareModel = VZMacHardwareModel(dataRepresentation: hwData)
            let platform = VZMacPlatformConfiguration()
            platform.hardwareModel = hardwareModel
            
            if let midPath = data.machineIdentifierPath {
                let midData = try Data(contentsOf: URL(fileURLWithPath: midPath))
                let machineID = VZMacMachineIdentifier(dataRepresentation: midData)
                platform.machineIdentifier = machineID
            }
            
            if let auxPath = data.auxiliaryImagePath {
                platform.auxiliaryStorage = VZMacAuxiliaryStorage(contentsOf: URL(fileURLWithPath: auxPath))
            }
            
            config.platform = platform
        }
        
        // Disk
        let diskAttachment = VZDiskImageStorageDeviceAttachment(url: URL(fileURLWithPath: data.diskPath), readOnly: false)
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]
        
        // Network
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Bootloader
        config.bootLoader = VZMacOSBootLoader()
        
        // Validate
        try config.validate()
        
        return config
    }
}

// MARK: - Data Models
struct VMConfigurationData: Codable {
    var name = ""
    var memory = 8192
    var cpus = 4
    var diskPath = ""
    var hardwareModelPath: String?
    var machineIdentifierPath: String?
    var auxiliaryImagePath: String?
}

enum VMError: Error {
    case vmNotFound
    case ipswLoadFailed
}

// MARK: - CLI
func main() {
    let manager = VMManager()
    let args = CommandLine.arguments
    
    if args.count < 2 {
        print("Usage: vm-native [list|create|start|stop] [args]")
        return
    }
    
    let command = args[1]
    
    switch command {
    case "list":
        let vms = manager.listVMs()
        print("📋 VMs:")
        for vm in vms {
            print("  • \(vm)")
        }
    
    case "create":
        if args.count < 4 {
            print("Usage: vm-native create <name> <ipsw-path>")
            return
        }
        
        let name = args[2]
        let ipswPath = args[3]
        
        let config = VMConfig(
            name: name,
            memory: 8192,
            cpus: 4,
            diskPath: "",
            ipswPath: ipswPath
        )
        
        do {
            try manager.createVM(config: config)
        } catch {
            print("❌ Error: \(error)")
        }
    
    case "start":
        if args.count < 3 {
            print("Usage: vm-native start <name>")
            return
        }
        
        do {
            try manager.startVM(name: args[2])
            RunLoop.main.run() // Keep running
        } catch {
            print("❌ Error: \(error)")
        }
    
    default:
        print("Unknown command: \(command)")
    }
}

main()
