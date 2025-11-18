#!/usr/bin/env swift
//
// EFI NVRAM Initialization Tool
// Creates properly initialized EFI variable stores for VMs using Apple's Virtualization.framework
//
// Usage: swift efi-init.swift <path-to-efi-nvram-file>
//
// This tool uses VZEFIVariableStore.creatingVariableStoreAt() to create valid NVRAM files
// that can be used with VZEFIBootLoader for UEFI boot.
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
func createEFIVariableStore(at path: String) throws {
    let url = URL(fileURLWithPath: path)
    
    // Check if file already exists
    if FileManager.default.fileExists(atPath: path) {
        print("⚠️  EFI NVRAM file already exists: \(path)")
        print("   Use --force to overwrite or choose a different path")
        return
    }
    
    // Create parent directory if needed
    let parentDir = url.deletingLastPathComponent()
    if !FileManager.default.fileExists(atPath: parentDir.path) {
        try FileManager.default.createDirectory(
            at: parentDir,
            withIntermediateDirectories: true
        )
        print("✅ Created directory: \(parentDir.path)")
    }
    
    // Create EFI variable store using Apple's API
    // This creates a properly initialized NVRAM file that VZ can use
    print("🔧 Creating EFI variable store...")
    try VZEFIVariableStore(creatingVariableStoreAt: url)
    
    // Verify the file was created
    guard FileManager.default.fileExists(atPath: path) else {
        throw NSError(
            domain: "EFIInit",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to create EFI variable store"]
        )
    }
    
    // Get file size
    let attrs = try FileManager.default.attributesOfItem(atPath: path)
    let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
    
    print("✅ EFI variable store created successfully")
    print("   Path: \(path)")
    print("   Size: \(size) bytes (\(size / 1024) KB)")
    
    // Validate by trying to open it
    _ = try VZEFIVariableStore(url: url)
    print("✅ EFI variable store validated - ready for use with VZEFIBootLoader")
}

@available(macOS 13.0, *)
func recreateEFIVariableStore(at path: String) throws {
    let url = URL(fileURLWithPath: path)
    
    // Remove existing file
    if FileManager.default.fileExists(atPath: path) {
        print("🗑️  Removing existing EFI NVRAM file...")
        try FileManager.default.removeItem(at: url)
    }
    
    // Create new one
    try createEFIVariableStore(at: path)
}

@available(macOS 13.0, *)
func validateEFIVariableStore(at path: String) throws {
    let url = URL(fileURLWithPath: path)
    
    guard FileManager.default.fileExists(atPath: path) else {
        print("❌ File does not exist: \(path)")
        return
    }
    
    print("🔍 Validating EFI variable store...")
    print("   Path: \(path)")
    
    // Get file info
    let attrs = try FileManager.default.attributesOfItem(atPath: path)
    let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
    print("   Size: \(size) bytes (\(size / 1024) KB)")
    
    // Try to open it
    do {
        _ = try VZEFIVariableStore(url: url)
        print("✅ EFI variable store is valid and can be used with VZEFIBootLoader")
    } catch {
        print("❌ EFI variable store is invalid: \(error.localizedDescription)")
        print("   This file cannot be used for UEFI boot")
        print("   Consider recreating it with --force")
    }
}

@available(macOS 13.0, *)
func printUsage() {
    print("""
    EFI NVRAM Initialization Tool
    
    Creates properly initialized EFI variable stores for VMs using Apple's
    Virtualization.framework. These NVRAM files are required for UEFI boot.
    
    USAGE:
        swift efi-init.swift [OPTIONS] <path>
    
    OPTIONS:
        --force         Overwrite existing EFI NVRAM file
        --validate      Validate existing EFI NVRAM file
        --help          Show this help message
    
    EXAMPLES:
        # Create new EFI NVRAM
        swift efi-init.swift vm-efi.nvram
        
        # Recreate (overwrite) existing NVRAM
        swift efi-init.swift --force vm-efi.nvram
        
        # Validate existing NVRAM
        swift efi-init.swift --validate vm-efi.nvram
    
    NOTES:
        - Requires macOS 13.0+ (Ventura or later)
        - Creates 128KB EFI variable store files
        - Compatible with VZEFIBootLoader
        - For use with Alpine Linux, Fedora, Ubuntu, etc.
    """)
}

// Main
if #available(macOS 13.0, *) {
    let args = CommandLine.arguments
    
    if args.count < 2 {
        printUsage()
        exit(1)
    }
    
    var force = false
    var validate = false
    var path = ""
    
    // Parse arguments
    for i in 1..<args.count {
        let arg = args[i]
        switch arg {
        case "--force":
            force = true
        case "--validate":
            validate = true
        case "--help", "-h":
            printUsage()
            exit(0)
        default:
            if arg.hasPrefix("--") {
                print("❌ Unknown option: \(arg)")
                printUsage()
                exit(1)
            }
            path = arg
        }
    }
    
    if path.isEmpty {
        print("❌ Missing path argument")
        printUsage()
        exit(1)
    }
    
    do {
        if validate {
            try validateEFIVariableStore(at: path)
        } else if force {
            try recreateEFIVariableStore(at: path)
        } else {
            try createEFIVariableStore(at: path)
        }
    } catch {
        print("❌ Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("❌ This tool requires macOS 13.0 (Ventura) or later")
    exit(1)
}
