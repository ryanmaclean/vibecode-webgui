import Foundation
import Virtualization

/// Manages EFI variable stores for VMs
/// Issue #954: Create persistent EFI variable store for VMs
public class EFIVariableStoreManager {

    /// Default EFI variable store filename
    public static let defaultFilename = "efi-vars.nvram"

    /// Minimum valid EFI store size (indicates it has been initialized)
    private static let minValidSize: UInt64 = 1024

    /// Create or load EFI variable store for a VM
    /// - Parameters:
    ///   - vmDirectory: Directory containing VM files
    ///   - filename: Name of EFI variable store file
    /// - Returns: VZEFIVariableStore for use with VZEFIBootLoader
    public static func getOrCreate(
        vmDirectory: URL,
        filename: String = defaultFilename
    ) throws -> VZEFIVariableStore {
        let efiVarsPath = vmDirectory.appendingPathComponent(filename)

        if FileManager.default.fileExists(atPath: efiVarsPath.path) {
            // Load existing store
            return VZEFIVariableStore(url: efiVarsPath)
        } else {
            // Create new store
            return try VZEFIVariableStore(creatingVariableStoreAt: efiVarsPath)
        }
    }

    /// Check if EFI variable store is initialized
    /// - Parameter path: Path to EFI variable store file
    /// - Returns: true if store appears to be valid and initialized
    public static func isInitialized(path: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: path.path) else {
            return false
        }

        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: path.path)
            guard let size = attrs[.size] as? UInt64 else {
                return false
            }
            // An initialized EFI store should be larger than minimum size
            return size > minValidSize
        } catch {
            return false
        }
    }

    /// Create EFI boot loader with persistent variable store
    /// - Parameters:
    ///   - vmDirectory: Directory containing VM files
    ///   - filename: Name of EFI variable store file
    /// - Returns: Configured VZEFIBootLoader
    public static func createBootLoader(
        vmDirectory: URL,
        filename: String = defaultFilename
    ) throws -> VZEFIBootLoader {
        let bootLoader = VZEFIBootLoader()
        bootLoader.variableStore = try getOrCreate(
            vmDirectory: vmDirectory,
            filename: filename
        )
        return bootLoader
    }

    /// Reset EFI variable store by deleting and recreating
    /// - Parameters:
    ///   - vmDirectory: Directory containing VM files
    ///   - filename: Name of EFI variable store file
    /// - Returns: New VZEFIVariableStore
    public static func reset(
        vmDirectory: URL,
        filename: String = defaultFilename
    ) throws -> VZEFIVariableStore {
        let efiVarsPath = vmDirectory.appendingPathComponent(filename)

        // Delete existing if present
        if FileManager.default.fileExists(atPath: efiVarsPath.path) {
            try FileManager.default.removeItem(at: efiVarsPath)
        }

        // Create new store
        return try VZEFIVariableStore(creatingVariableStoreAt: efiVarsPath)
    }

    /// Backup EFI variable store
    /// - Parameters:
    ///   - vmDirectory: Directory containing VM files
    ///   - filename: Name of EFI variable store file
    ///   - backupSuffix: Suffix for backup file
    /// - Returns: URL of backup file
    @discardableResult
    public static func backup(
        vmDirectory: URL,
        filename: String = defaultFilename,
        backupSuffix: String = ".backup"
    ) throws -> URL {
        let efiVarsPath = vmDirectory.appendingPathComponent(filename)
        let backupPath = vmDirectory.appendingPathComponent(filename + backupSuffix)

        guard FileManager.default.fileExists(atPath: efiVarsPath.path) else {
            throw EFIError.storeNotFound
        }

        // Remove existing backup
        if FileManager.default.fileExists(atPath: backupPath.path) {
            try FileManager.default.removeItem(at: backupPath)
        }

        try FileManager.default.copyItem(at: efiVarsPath, to: backupPath)
        return backupPath
    }

    /// Restore EFI variable store from backup
    /// - Parameters:
    ///   - vmDirectory: Directory containing VM files
    ///   - filename: Name of EFI variable store file
    ///   - backupSuffix: Suffix of backup file
    public static func restore(
        vmDirectory: URL,
        filename: String = defaultFilename,
        backupSuffix: String = ".backup"
    ) throws {
        let efiVarsPath = vmDirectory.appendingPathComponent(filename)
        let backupPath = vmDirectory.appendingPathComponent(filename + backupSuffix)

        guard FileManager.default.fileExists(atPath: backupPath.path) else {
            throw EFIError.backupNotFound
        }

        // Remove current store
        if FileManager.default.fileExists(atPath: efiVarsPath.path) {
            try FileManager.default.removeItem(at: efiVarsPath)
        }

        try FileManager.default.copyItem(at: backupPath, to: efiVarsPath)
    }
}

/// EFI-related errors
public enum EFIError: LocalizedError {
    case storeNotFound
    case backupNotFound
    case creationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .storeNotFound:
            return "EFI variable store not found"
        case .backupNotFound:
            return "EFI variable store backup not found"
        case .creationFailed(let reason):
            return "Failed to create EFI variable store: \(reason)"
        }
    }
}
