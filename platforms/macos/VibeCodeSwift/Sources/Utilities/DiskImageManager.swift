import Foundation
import AppKit

/// Manages disk image formats for VMs based on macOS version
class DiskImageManager {
    static let shared = DiskImageManager()
    
    enum DiskImageFormat {
        case asif  // macOS 26+ Tahoe (fastest)
        case raw   // macOS 15 and earlier (standard)
        
        var description: String {
            switch self {
            case .asif: return "ASIF (Apple Sparse Image Format)"
            case .raw: return "RAW (UDIF read-write)"
            }
        }
        
        var fileExtension: String {
            switch self {
            case .asif: return ".asif"
            case .raw: return ".img"
            }
        }
    }
    
    private let macOSVersion: OperatingSystemVersion
    
    init() {
        self.macOSVersion = ProcessInfo.processInfo.operatingSystemVersion
    }
    
    /// Determine the best disk image format for the current macOS version
    func recommendedFormat() -> DiskImageFormat {
        // ASIF is available in macOS 26 (Tahoe) and later
        // Can be read in Sequoia (15.5+) but only created in Tahoe
        if macOSVersion.majorVersion >= 26 {
            return .asif
        } else {
            return .raw
        }
    }
    
    /// Check if ASIF format is supported on this system
    func isASIFSupported() -> Bool {
        return macOSVersion.majorVersion >= 26
    }
    
    /// Check if ASIF can be read (Sequoia 15.5+)
    func canReadASIF() -> Bool {
        if macOSVersion.majorVersion >= 26 {
            return true
        }
        if macOSVersion.majorVersion == 15 && macOSVersion.minorVersion >= 5 {
            return true
        }
        return false
    }
    
    /// Create a disk image using diskutil (supports ASIF in Tahoe)
    func createDiskImage(
        path: String,
        size: String,
        volumeName: String,
        format: DiskImageFormat
    ) async throws {
        NSLog("Creating \(format.description) disk image: \(path)")
        
        let formatArg = format == .asif ? "ASIF" : "UDRW"
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
        process.arguments = [
            "image", "create", "blank",
            "--format", formatArg,
            "--size", size,
            "--volumeName", volumeName,
            path
        ]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""
            throw NSError(
                domain: "DiskImageManager",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: "Failed to create disk image: \(output)"]
            )
        }
        
        NSLog("Successfully created \(format.description) disk image")
    }
    
    /// Convert existing RAW image to ASIF (Tahoe only)
    func convertToASIF(sourcePath: String, destinationPath: String) async throws {
        guard isASIFSupported() else {
            throw NSError(
                domain: "DiskImageManager",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "ASIF format requires macOS 26 Tahoe or later"]
            )
        }
        
        NSLog("Converting RAW image to ASIF: \(sourcePath) -> \(destinationPath)")
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
        process.arguments = [
            "image", "create",
            "--format", "ASIF",
            "--from", sourcePath,
            destinationPath
        ]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""
            throw NSError(
                domain: "DiskImageManager",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: "Failed to convert to ASIF: \(output)"]
            )
        }
        
        NSLog("Successfully converted to ASIF format")
    }
    
    /// Get disk image type from file
    func getDiskImageType(path: String) -> String? {
        let workspace = NSWorkspace.shared
        guard let type = try? workspace.type(ofFile: path) else {
            return nil
        }
        return type
    }
    
    /// Check if a file is an ASIF disk image
    func isASIFImage(path: String) -> Bool {
        guard let type = getDiskImageType(path: path) else {
            return false
        }
        return type == "com.apple.disk-image-sparse"
    }
    
    /// Get performance info for the current format
    func getPerformanceInfo() -> String {
        let format = recommendedFormat()
        switch format {
        case .asif:
            return """
            ASIF Format (Tahoe)
            - Read: 5.5-5.8 GB/s
            - Write: 6.6-8.3 GB/s
            - Sparse file in APFS
            - Recommended for VMs
            """
        case .raw:
            return """
            RAW Format (Standard)
            - Read: 2-3 GB/s
            - Write: 1-2 GB/s
            - Compatible with all macOS versions
            - Used by Podman, others
            """
        }
    }
}

