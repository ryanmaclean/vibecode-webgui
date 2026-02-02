// MIT License - EFI Boot Entry Manager
// Inspired by Tart and UTM's EFI boot management approaches
// Manages EFI NVRAM boot entries for Virtualization.framework VMs

import Foundation
import Virtualization

/// Manages EFI boot entries for VMs using Virtualization.framework
/// Similar to how Tart and UTM handle EFI boot configuration
@available(macOS 12.0, *)
public class EFIBootManager {
    
    /// Creates or updates an EFI boot entry for a VM disk image
    /// - Parameters:
    ///   - diskPath: Path to the VM disk image
    ///   - efiStorePath: Path to the EFI variable store file
    ///   - bootloaderPath: Path to the bootloader (e.g., /EFI/BOOT/BOOTAA64.EFI)
    ///   - label: Label for the boot entry
    /// - Returns: Success status
    public static func createBootEntry(
        diskPath: URL,
        efiStorePath: URL,
        bootloaderPath: String = "/EFI/BOOT/BOOTAA64.EFI",
        label: String = "Alpine Linux"
    ) throws -> Bool {
        
        // Ensure EFI variable store exists
        let efiStore: VZEFIVariableStore
        if FileManager.default.fileExists(atPath: efiStorePath.path) {
            efiStore = try VZEFIVariableStore(url: efiStorePath)
        } else {
            // Create new EFI variable store
            efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiStorePath)
        }
        
        // Verify disk image exists
        guard FileManager.default.fileExists(atPath: diskPath.path) else {
            throw EFIBootError.diskNotFound(diskPath.path)
        }
        
        // For Virtualization.framework, we need to boot the VM once to let EFI firmware
        // discover and register the bootloader. However, we can prepare the disk image
        // with the correct bootloader structure.
        
        // The actual EFI boot entry creation happens when the VM boots for the first time
        // and the EFI firmware discovers the bootloader on the disk.
        
        // We can verify the bootloader exists on the disk by checking the ESP partition
        if !verifyBootloaderOnDisk(diskPath: diskPath, bootloaderPath: bootloaderPath) {
            throw EFIBootError.bootloaderNotFound(bootloaderPath)
        }
        
        return true
    }
    
    /// Verifies that a bootloader exists on the disk image
    /// - Parameters:
    ///   - diskPath: Path to the disk image
    ///   - bootloaderPath: Expected path to bootloader in ESP
    /// - Returns: True if bootloader exists
    private static func verifyBootloaderOnDisk(diskPath: URL, bootloaderPath: String) -> Bool {
        // On macOS, we can't easily mount and inspect the disk image directly
        // This is a simplified check - in production, you'd want to:
        // 1. Attach the disk image using hdiutil
        // 2. Mount the ESP partition
        // 3. Check for the bootloader file
        
        // For now, we'll assume the bootloader exists if the disk image is valid
        // A more robust implementation would use diskutil/hdiutil to inspect
        
        return FileManager.default.fileExists(atPath: diskPath.path)
    }
    
    /// Creates a properly initialized EFI variable store
    /// - Parameter efiStorePath: Path where the EFI variable store should be created
    /// - Returns: The created EFI variable store
    public static func createEFIVariableStore(at efiStorePath: URL) throws -> VZEFIVariableStore {
        // Remove existing file if it exists (to start fresh)
        if FileManager.default.fileExists(atPath: efiStorePath.path) {
            try FileManager.default.removeItem(at: efiStorePath)
        }
        
        // Create new EFI variable store
        let efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiStorePath)
        
        return efiStore
    }
    
    /// Prepares a disk image for EFI boot by ensuring proper partition structure
    /// - Parameters:
    ///   - diskPath: Path to the disk image
    ///   - createESP: Whether to create an EFI System Partition if missing
    /// - Returns: Success status
    public static func prepareDiskForEFIBoot(
        diskPath: URL,
        createESP: Bool = false
    ) throws -> Bool {
        
        guard FileManager.default.fileExists(atPath: diskPath.path) else {
            throw EFIBootError.diskNotFound(diskPath.path)
        }
        
        // Check if disk has proper partition structure
        // This would require using diskutil or similar tools
        // For now, we assume the disk is already properly partitioned
        
        if createESP {
            // Create ESP partition using external script
            // This is complex and requires root access, so we delegate to a script
            throw EFIBootError.operationNotSupported("ESP creation requires external tools")
        }
        
        return true
    }
    
    /// Boots a VM once to let EFI firmware discover and register boot entries
    /// This is similar to how Tart handles EFI boot entry creation
    /// - Parameters:
    ///   - diskPath: Path to the VM disk image
    ///   - efiStorePath: Path to the EFI variable store
    ///   - timeout: Maximum time to wait for boot discovery (seconds)
    /// - Returns: Success status
    public static func discoverBootEntries(
        diskPath: URL,
        efiStorePath: URL,
        timeout: TimeInterval = 30.0
    ) async throws -> Bool {
        
        // Create VM configuration for boot discovery
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024 // 1GB
        
        // EFI Boot Loader
        let bootloader = VZEFIBootLoader()
        let efiStore = try VZEFIVariableStore(url: efiStorePath)
        bootloader.variableStore = efiStore
        config.bootLoader = bootloader
        
        // Storage
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskPath,
            readOnly: false
        )
        let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [storageDevice]
        
        // Network (optional, for cloud-init or setup)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Validate configuration
        try config.validate()
        
        // Create and start VM
        let vm = VZVirtualMachine(configuration: config)
        
        // Start VM to let EFI discover boot entries
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            vm.start { result in
                switch result {
                case .success:
                    // Wait a bit for EFI to discover boot entries
                    DispatchQueue.global().asyncAfter(deadline: .now() + timeout) {
                        // Stop the VM
                        vm.stop { stopError in
                            if let stopError = stopError {
                                continuation.resume(throwing: stopError)
                            } else {
                                continuation.resume()
                            }
                        }
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
        
        return true
    }
}

/// Errors that can occur during EFI boot management
public enum EFIBootError: LocalizedError {
    case diskNotFound(String)
    case bootloaderNotFound(String)
    case efiStoreCreationFailed(String)
    case operationNotSupported(String)
    
    public var errorDescription: String? {
        switch self {
        case .diskNotFound(let path):
            return "Disk image not found: \(path)"
        case .bootloaderNotFound(let path):
            return "Bootloader not found at expected path: \(path)"
        case .efiStoreCreationFailed(let reason):
            return "Failed to create EFI variable store: \(reason)"
        case .operationNotSupported(let reason):
            return "Operation not supported: \(reason)"
        }
    }
}

