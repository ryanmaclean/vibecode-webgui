#!/usr/bin/env swift
// Standalone OpenVSCode Server VM Manager
// Uses Apple Virtualization.framework only (no vfkit dependency)
// Requires: macOS 26.0+ (Tahoe)
// Swift 5 compatible

import Foundation
import Virtualization
import Darwin

@available(macOS 26.0, *)
class StandaloneOpenVSCodeVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let vmQueue = DispatchQueue(label: "com.vibecode.openvscode-vm", qos: .userInteractive)
    private let vmName: String
    private let vmDir: String
    private let port: Int = 8080
    
    init(vmName: String = "openvscode") {
        self.vmName = vmName
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        self.vmDir = "\(homeDir)/.vibecode/vms/\(vmName)"
        super.init()
        
        // Create VM directory structure
        try? FileManager.default.createDirectory(
            atPath: "\(vmDir)/kernel",
            withIntermediateDirectories: true
        )
        try? FileManager.default.createDirectory(
            atPath: "\(vmDir)/disk",
            withIntermediateDirectories: true
        )
    }
    
    func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory
        config.cpuCount = 4
        config.memorySize = UInt64(4) * 1024 * 1024 * 1024 // 4GB
        
        // Bootloader - Alpine Linux kernel boot
        let kernelPath = "\(vmDir)/kernel/vmlinuz"
        let initramfsPath = "\(vmDir)/kernel/initramfs"
        
        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(
                domain: "StandaloneOpenVSCodeVM",
                code: 1,
                userInfo: [
                    NSLocalizedDescriptionKey: "Kernel not found at: \(kernelPath)\n" +
                    "Please run: bash scripts/vfkit/02-download-alpine-kernel.sh\n" +
                    "Then copy files to: \(vmDir)/kernel/"
                ]
            )
        }
        
        let bootLoader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        if FileManager.default.fileExists(atPath: initramfsPath) {
            bootLoader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        }
        bootLoader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootLoader
        
        // Storage - Use regular disk image
        let diskPath = "\(vmDir)/disk/root.img"
        if !FileManager.default.fileExists(atPath: diskPath) {
            print("📦 Creating disk image (20GB)...")
            try createDiskImage(at: diskPath, sizeGB: 20)
        }
        
        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]
        
        // Network - NAT
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Serial console
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let consoleAttachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialPort.attachment = consoleAttachment
        config.serialPorts = [serialPort]
        
        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        
        // Validate configuration
        try config.validate()
        return config
    }
    
    func createDiskImage(at path: String, sizeGB: Int) throws {
        // Check if disk already exists
        if FileManager.default.fileExists(atPath: path) {
            print("   Using existing disk image")
            return
        }
        
        let sizeMB = sizeGB * 1024
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/hdiutil")
        process.arguments = [
            "create",
            "-size", "\(sizeMB)m",
            "-fs", "HFS+",
            "-volname", "OpenVSCode",
            "-type", "SPARSE",
            path
        ]
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            throw NSError(
                domain: "StandaloneOpenVSCodeVM",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create disk image"]
            )
        }
    }
    
    func start() throws {
        print("🚀 Starting OpenVSCode Server VM...")
        print("   VM Directory: \(vmDir)")
        print("   Port: \(port)")
        print("")
        
        let config = try createVMConfiguration()
        virtualMachine = VZVirtualMachine(configuration: config, queue: vmQueue)
        virtualMachine?.delegate = self
        
        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?
        
        virtualMachine?.start { result in
            switch result {
            case .success:
                print("✅ VM started successfully")
                print("   Waiting for OpenVSCode Server to start...")
                print("   Access at: http://localhost:\(self.port)")
                print("   Press Ctrl+C to stop")
                print("")
            case .failure(let error):
                print("❌ VM failed to start: \(error.localizedDescription)")
                startError = error
            }
            semaphore.signal()
        }
        
        semaphore.wait()
        
        if let error = startError {
            throw error
        }
        
        // Keep running until interrupted
        RunLoop.main.run()
    }
    
    func stop() {
        print("\n🛑 Stopping VM...")
        virtualMachine?.stop { _ in }
    }
    
    // MARK: - VZVirtualMachineDelegate


}

// Main entry point
if #available(macOS 26.0, *) {
    var globalVM: StandaloneOpenVSCodeVM?
    let vmName = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "openvscode"
    globalVM = StandaloneOpenVSCodeVM(vmName: vmName)
    
    // Handle SIGINT (Ctrl+C) using DispatchSource
    let sigintSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
    sigintSource.setEventHandler {
        globalVM?.stop()
        exit(0)
    }
    sigintSource.resume()
    signal(SIGINT, SIG_IGN) // Ignore default handler
    
    do {
        try globalVM!.start()
    } catch {
        print("Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("❌ macOS 26.0+ (Tahoe) required")
    exit(1)
}
