//
// VibeCode VM - Direct Virtualization.framework Integration
// M4 Max optimized, pure Swift 5, zero overhead
//

import Foundation
import Virtualization

@main
struct VibeCodeVM {
    static func main() {
        print("🚀 VibeCode VM - Direct Apple Virtualization.framework")
        print("Platform: \(ProcessInfo.processInfo.machineHardwareString ?? "Unknown")")
        print("macOS: \(ProcessInfo.processInfo.operatingSystemVersionString)")
        print("")

        // Verify VZ availability
        guard #available(macOS 13.0, *) else {
            print("❌ macOS 13.0+ required for Virtualization.framework")
            exit(1)
        }

        let vmType = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "linux"
        let vmName = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "vibecode-valkey"

        print("🔧 Creating VM: \(vmName) (type: \(vmType))")

        do {
            let vm = try createVM(type: vmType, name: vmName)

            print("✅ VM configured")
            print("Starting...")

            // Start VM synchronously
            let semaphore = DispatchSemaphore(value: 0)
            var startError: Error?
            vm.start { result in
                switch result {
                case .success:
                    print("✅ VM running!")
                    print("Press Ctrl+C to stop")
                case .failure(let error):
                    // Provide detailed VZ framework error context
                    let vzError = error as NSError
                    print("❌ VM failed to start")
                    print("   Error Domain: \(vzError.domain)")
                    print("   Error Code: \(vzError.code)")
                    print("   Description: \(vzError.localizedDescription)")

                    // Provide actionable troubleshooting based on common VZ errors
                    if vzError.domain == "VZErrorDomain" {
                        switch vzError.code {
                        case 1: // VZErrorInternal
                            print("   Hint: Internal Virtualization.framework error. Try restarting your Mac.")
                        case 2: // VZErrorInvalidVirtualMachineConfiguration
                            print("   Hint: Invalid VM configuration. Check CPU, memory, and disk settings.")
                        case 3: // VZErrorInvalidVirtualMachineState
                            print("   Hint: VM is in an invalid state. Ensure it's not already running.")
                        case 4: // VZErrorInvalidVirtualMachineStateTransition
                            print("   Hint: Invalid state transition. Wait for current operation to complete.")
                        case 5: // VZErrorInvalidDiskImage
                            print("   Hint: Disk image is corrupted or invalid format. Try recreating the disk.")
                        default:
                            print("   Hint: Check macOS Console.app for detailed Virtualization.framework logs.")
                        }
                    }

                    if let failureReason = vzError.localizedFailureReason {
                        print("   Reason: \(failureReason)")
                    }
                    if let recoverySuggestion = vzError.localizedRecoverySuggestion {
                        print("   Suggestion: \(recoverySuggestion)")
                    }

                    startError = error
                    semaphore.signal()
                }
            }

            // Keep running
            semaphore.wait()

            // If VM failed to start, exit with error
            if let error = startError {
                throw NSError(domain: "VibeCodeVM", code: 100, userInfo: [
                    NSLocalizedDescriptionKey: "VM failed to start: \(error.localizedDescription)",
                    NSUnderlyingErrorKey: error
                ])
            }

        } catch {
            print("❌ Error: \(error)")
            exit(1)
        }
    }
    
    static func createVM(type: String, name: String) throws -> VZVirtualMachine {
        let vmDir = "\(homeDirectory)/.vfkit/vms/\(name)"

        do {
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
        } catch let error as NSError {
            // Re-throw with additional context if this is our error
            if error.domain == "VibeCodeVM" {
                throw error
            }
            // Wrap other errors with context
            throw NSError(domain: "VibeCodeVM", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Failed to create \(type) VM '\(name)': \(error.localizedDescription)"
            ])
        }
    }
    
    static func createLinuxVM(name: String) throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()
        
        // Platform configuration (required for Linux VMs on macOS 13+)
        if #available(macOS 13.0, *) {
            config.platform = VZGenericPlatformConfiguration()
        }
        
        // CPU & Memory - optimize based on host resources
        let computeCPUCount = ProcessInfo.processInfo.processorCount
        config.cpuCount = min(2, computeCPUCount)

        // Dynamic memory allocation based on host physical memory
        // Allocate 25% of physical memory, capped at 8GB, minimum 512MB
        let physicalMemory = ProcessInfo.processInfo.physicalMemory
        let targetMemory = physicalMemory / 4  // 25% of total
        let minMemory: UInt64 = 512 * 1024 * 1024  // 512MB
        let maxMemory: UInt64 = 8 * 1024 * 1024 * 1024  // 8GB
        config.memorySize = max(minMemory, min(maxMemory, targetMemory))

        print("  Memory: \(config.memorySize / (1024 * 1024))MB (host: \(physicalMemory / (1024 * 1024 * 1024))GB)")
        
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

            do {
                if !FileManager.default.fileExists(atPath: efiPath) {
                    print("  Creating new EFI variable store...")
                    try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
                }
                efiBootLoader.variableStore = try VZEFIVariableStore(url: efiURL)
                config.bootLoader = efiBootLoader
            } catch {
                let vzError = error as NSError
                var errorDetails = "Failed to create EFI variable store at \(efiPath): \(vzError.localizedDescription)"

                // Provide troubleshooting for EFI variable store errors
                errorDetails += "\n   Common causes:"
                errorDetails += "\n   - Insufficient permissions in \(vmDir)"
                errorDetails += "\n   - Disk full or quota exceeded"
                errorDetails += "\n   - Corrupted existing EFI.nvram file"
                errorDetails += "\n   Troubleshooting:"
                errorDetails += "\n   - Try: rm \(efiPath) (to recreate)"
                errorDetails += "\n   - Check: ls -lh \(vmDir)"
                errorDetails += "\n   - Verify: df -h \(vmDir)"

                if let failureReason = vzError.localizedFailureReason {
                    errorDetails += "\n   Reason: \(failureReason)"
                }

                throw NSError(domain: "VibeCodeVM", code: 4, userInfo: [
                    NSLocalizedDescriptionKey: errorDetails,
                    NSUnderlyingErrorKey: error
                ])
            }
            
            // Disk attachment - use VirtualBuddy's approach
            print("  Attaching disk: \(diskPath)")
            let diskURL = URL(fileURLWithPath: diskPath)

            // Check if file exists and is accessible
            guard FileManager.default.isReadableFile(atPath: diskPath) else {
                throw NSError(domain: "VibeCodeVM", code: 5, userInfo: [
                    NSLocalizedDescriptionKey: "Disk not readable: \(diskPath)"
                ])
            }

            // Create disk attachment with synchronization mode and VZ error handling
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
                let vzError = error as NSError
                var errorDetails = "Failed to attach disk \(diskPath): \(vzError.localizedDescription)"

                // Provide specific troubleshooting for VZ disk attachment errors
                if vzError.domain == "VZErrorDomain" {
                    switch vzError.code {
                    case 5: // VZErrorInvalidDiskImage
                        errorDetails += "\n   Hint: Disk image format is invalid or corrupted"
                        errorDetails += "\n   - Supported formats: raw (.img), qcow2 (.qcow2)"
                        errorDetails += "\n   - Try: qemu-img check \(diskPath)"
                        errorDetails += "\n   - Try: qemu-img convert -O raw old.qcow2 disk.img"
                    default:
                        errorDetails += "\n   Hint: Check file permissions and disk space"
                        errorDetails += "\n   - Verify: ls -lh \(diskPath)"
                        errorDetails += "\n   - Check: df -h \(vmDir)"
                    }
                }

                if let failureReason = vzError.localizedFailureReason {
                    errorDetails += "\n   Reason: \(failureReason)"
                }

                throw NSError(domain: "VibeCodeVM", code: 6, userInfo: [
                    NSLocalizedDescriptionKey: errorDetails,
                    NSUnderlyingErrorKey: error
                ])
            }
            
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

        // Validate configuration with detailed VZ error reporting
        do {
            try config.validate()
        } catch {
            let vzError = error as NSError
            var errorDetails = "VM configuration validation failed: \(vzError.localizedDescription)"

            // Provide specific guidance based on VZ validation errors
            if vzError.domain == "VZErrorDomain" {
                switch vzError.code {
                case 2: // VZErrorInvalidVirtualMachineConfiguration
                    errorDetails += "\n   Common causes:"
                    errorDetails += "\n   - CPU count: \(config.cpuCount) (must be >= 1 and <= host cores)"
                    errorDetails += "\n   - Memory: \(config.memorySize / (1024 * 1024))MB (must be >= 512MB)"
                    errorDetails += "\n   - Boot loader not properly configured"
                    errorDetails += "\n   - Storage device configuration invalid"
                default:
                    errorDetails += "\n   Check Console.app for detailed Virtualization.framework logs"
                }
            }

            if let failureReason = vzError.localizedFailureReason {
                errorDetails += "\n   Reason: \(failureReason)"
            }

            throw NSError(domain: "VibeCodeVM", code: 7, userInfo: [
                NSLocalizedDescriptionKey: errorDetails,
                NSUnderlyingErrorKey: error
            ])
        }

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

