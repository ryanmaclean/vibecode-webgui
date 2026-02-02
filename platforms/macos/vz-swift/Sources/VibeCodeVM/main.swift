//
// VibeCode VM - Direct Virtualization.framework Integration
// M4 Max optimized, pure Swift 5, zero overhead
//

import Foundation
import Virtualization

@main
struct VibeCodeVM {
    static func main() throws {
        print("🚀 VibeCode VM - Direct Apple Virtualization.framework")
        print("Platform: \(ProcessInfo.processInfo.machineHardwareString ?? "Unknown")")
        print("macOS: \(ProcessInfo.processInfo.operatingSystemVersionString)")
        print("")
        
        // Verify VZ availability
        guard #available(macOS 13.0, *) else {
            fatalError("❌ macOS 13.0+ required for Virtualization.framework")
        }
        
        let vmType = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "linux"
        let vmName = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "vibecode-valkey"
        
        print("🔧 Creating VM: \(vmName) (type: \(vmType))")
        
        let vm = try createVM(type: vmType, name: vmName)
        
        print("✅ VM configured")
        print("Starting...")
        
        // Start VM synchronously
        let semaphore = DispatchSemaphore(value: 0)
        vm.start { error in
            if let error = error {
                print("❌ VM failed to start: \(error)")
            } else {
                print("✅ VM running!")
                print("Press Ctrl+C to stop")
            }
        }
        
        // Keep running
        semaphore.wait()
    }
    
    static func createVM(type: String, name: String) throws -> VZVirtualMachine {
        let vmDir = "\(homeDirectory)/.vfkit/vms/\(name)"
        
        switch type.lowercased() {
        case "windows", "win":
            print("🪟 Creating Windows VM...")
            return try await WindowsVMConfiguration.create(
                name: name,
                diskPath: vmDir,
                isoPath: nil // Set to Windows ISO path if installing
            )
        case "macos", "mac":
            print("🍎 Creating macOS VM...")
            return try await MacOSVMConfiguration.create(
                name: name,
                diskPath: vmDir,
                restoreImagePath: nil // Set to IPSW path if installing
            )
        case "linux":
            print("🐧 Creating Linux VM (console)...")
            return try await createLinuxVM(name: name)
        case "linux-gui", "ubuntu", "fedora":
            print("🖥️  Creating Linux GUI VM...")
            return try await LinuxGUIVMConfiguration.create(
                name: name,
                diskPath: vmDir,
                isoPath: nil // Set to Ubuntu/Fedora ISO path if installing
            )
        case "ollama":
            print("🦙 Creating Ollama VM...")
            return try await OllamaVMConfiguration.create(
                name: name,
                diskPath: vmDir,
                alpineISO: nil // Set to Alpine ISO path if installing
            )
        case "openclaw":
            print("🦞 Creating OpenClaw Tiny macOS VM...")
            return try await OpenClawVMConfiguration.create(
                name: name,
                diskPath: vmDir
            )
        default:
            throw NSError(domain: "VibeCodeVM", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Unknown VM type: \(type). Use: linux, windows, macos, or openclaw"
            ])
        }
    }
    
    static func createLinuxVM(name: String) throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // Platform configuration (required for Linux VMs on macOS 13+)
        if #available(macOS 13.0, *) {
            config.platform = VZGenericPlatformConfiguration()
        }
        
        // CPU & Memory - use safe values from VirtualBuddy approach
        let computeCPUCount = ProcessInfo.processInfo.processorCount
        config.cpuCount = min(2, computeCPUCount)
        config.memorySize = 1_073_741_824 // 1GB as UInt64 literal
        
        let vmDir = "\(homeDirectory)/.vfkit/vms/\(name)"
        
        // Try UEFI boot first (for disk images), fallback to direct kernel boot
        // Try raw disk first, then qcow2
        var diskPath = "\(vmDir)/disk.img"
        if !FileManager.default.fileExists(atPath: diskPath) {
            diskPath = "\(vmDir)/disk.qcow2"
        }
        let efiPath = "\(vmDir)/EFI.nvram"
        
        if FileManager.default.fileExists(atPath: diskPath) {
            print("📀 Using UEFI boot with disk image")
            
            // UEFI Boot Loader
            let efiBootLoader = VZEFIBootLoader()
            let efiURL = URL(fileURLWithPath: efiPath)
            
            if !FileManager.default.fileExists(atPath: efiPath) {
                print("  Creating new EFI variable store...")
                try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
            }
            efiBootLoader.variableStore = try VZEFIVariableStore(url: efiURL)
            config.bootLoader = efiBootLoader
            
            // Disk attachment - use VirtualBuddy's approach
            print("  Attaching disk: \(diskPath)")
            let diskURL = URL(fileURLWithPath: diskPath)
            
            // Check if file exists and is accessible
            guard FileManager.default.isReadableFile(atPath: diskPath) else {
                throw NSError(domain: "VibeCodeVM", code: 5, userInfo: [
                    NSLocalizedDescriptionKey: "Disk not readable: \(diskPath)"
                ])
            }
            
            // Create disk attachment with synchronization mode
            let diskAttachment = try VZDiskImageStorageDeviceAttachment(
                url: diskURL,
                readOnly: false,
                cachingMode: .automatic,
                synchronizationMode: .fsync
            )
            let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
            config.storageDevices = [blockDevice]
            
        } else {
            // Fallback: Direct kernel boot (legacy, limited support)
            print("📀 Using direct kernel boot (legacy)")
            
            let kernelPath = "\(vmDir)/kernel/vmlinuz"
            let initramfsPath = "\(vmDir)/initramfs.cpio.gz"
            
            guard FileManager.default.fileExists(atPath: kernelPath) else {
                throw NSError(domain: "VibeCodeVM", code: 3, userInfo: [
                    NSLocalizedDescriptionKey: "Neither disk.qcow2 nor kernel/vmlinuz found in \(vmDir)"
                ])
            }
            
            let bootLoader = VZLinuxBootLoader(
                kernelURL: URL(fileURLWithPath: kernelPath)
            )
            if FileManager.default.fileExists(atPath: initramfsPath) {
                bootLoader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
            }
            bootLoader.commandLine = "console=hvc0"
            config.bootLoader = bootLoader
        }
        
        // Serial Console
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        let serialAttachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialConfig.attachment = serialAttachment
        config.serialPorts = [serialConfig]
        
        // Network (NAT)
        let networkDevice = NetworkConfig.createNATNetwork()
        config.networkDevices = [networkDevice]
        
        // Entropy (RNG)
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Validate
        try config.validate()
        
        return VZVirtualMachine(configuration: config)
    }
    
    static var homeDirectory: String {
        FileManager.default.homeDirectoryForCurrentUser.path
    }
}

// Extension for hardware detection
extension ProcessInfo {
    var machineHardwareString: String? {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        var machine = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &machine, &size, nil, 0)
        return String(cString: machine)
    }
}

