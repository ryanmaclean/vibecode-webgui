//
// VibeCode VM - Direct Virtualization.framework Integration
// M4 Max optimized, pure Swift 5, zero overhead
//

import Foundation
import Virtualization

@main
struct VibeCodeVM {
    static func main() async throws {
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
        
        let vm = try await createVM(type: vmType, name: vmName)
        
        print("✅ VM configured")
        print("Starting...")
        
        try await vm.start()
        
        print("✅ VM running!")
        print("Press Ctrl+C to stop")
        
        // Keep running (await forever)
        try await Task.sleep(for: .seconds(Int.max))
    }
    
    static func createVM(type: String, name: String) async throws -> VZVirtualMachine {
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
        default:
            throw NSError(domain: "VibeCodeVM", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Unknown VM type: \(type). Use: linux, windows, or macos"
            ])
        }
    }
    
    static func createLinuxVM(name: String) async throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory (M4 Max optimized)
        config.cpuCount = 2
        config.memorySize = UInt64(1024 * 1024 * 1024) // 1GB
        
        // Boot Loader - Linux kernel + initramfs
        let vmDir = "\(homeDirectory)/.vfkit/vms/\(name)"
        let kernelPath = "\(vmDir)/kernel/vmlinux"
        let initramfsPath = "\(vmDir)/initramfs.cpio.gz"
        
        // Check if files exist
        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(domain: "VibeCodeVM", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "Kernel not found: \(kernelPath)"
            ])
        }
        guard FileManager.default.fileExists(atPath: initramfsPath) else {
            throw NSError(domain: "VibeCodeVM", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "Initramfs not found: \(initramfsPath)"
            ])
        }
        
        let bootLoader = VZLinuxBootLoader(
            kernelURL: URL(fileURLWithPath: kernelPath)
        )
        bootLoader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootLoader.commandLine = "console=hvc0 quiet"
        config.bootLoader = bootLoader
        
        // Serial Console
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        let serialAttachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialConfig.attachment = serialAttachment
        config.serialPorts = [serialConfig]
        
        // Network (NAT with port forwarding support)
        let networkDevice = NetworkConfig.createNATNetwork()
        config.networkDevices = [networkDevice]
        
        // Note: For Valkey (6379), PostgreSQL (5432), use socat for port forwarding
        // Example: socat TCP-LISTEN:6379,reuseaddr,fork UNIX-CONNECT:~/.vfkit/vms/vm-name/service.sock
        
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

