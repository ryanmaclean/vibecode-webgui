#!/usr/bin/env swift
// OpenVSCode Server VM Manager
// Uses Apple Virtualization.framework (no vfkit dependency)
// macOS 26.0+ (Tahoe) with ASIF support

import Foundation
import Virtualization

@available(macOS 26.0, *)
class OpenVSCodeVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let vmQueue = DispatchQueue(label: "com.vibecode.openvscode-vm", qos: .userInteractive)
    private var sshPortForward: Process?
    private let vmName: String
    
    let vmDir: String
    let port: Int = 8080
    
    init(vmName: String = "openvscode") {
        self.vmName = vmName
        self.vmDir = NSHomeDirectory() + "/.vibecode/vms/\(vmName)"
        super.init()
        
        // Create VM directory
        try? FileManager.default.createDirectory(
            atPath: vmDir,
            withIntermediateDirectories: true
        )
    }
    
    func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        
        // CPU & Memory
        config.cpuCount = 4
        config.memorySize = UInt64(4) * 1024 * 1024 * 1024 // 4GB
        
        // Bootloader - Alpine Linux
        let kernelPath = vmDir + "/kernel/vmlinuz"
        let initramfsPath = vmDir + "/kernel/initramfs"
        
        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(
                domain: "OpenVSCodeVM",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Kernel not found: \(kernelPath)"]
            )
        }
        
        let bootLoader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        if FileManager.default.fileExists(atPath: initramfsPath) {
            bootLoader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        }
        bootLoader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootLoader
        
        // Storage - ASIF disk (macOS 26.0+)
        let diskPath = vmDir + "/disk/root.asif"
        if !FileManager.default.fileExists(atPath: diskPath) {
            // Create ASIF disk if it doesn't exist
            try createASIFDisk(at: diskPath, sizeGB: 20)
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
        
        try config.validate()
        return config
    }
    
    func createASIFDisk(at path: String, sizeGB: Int) throws {
        // Create ASIF disk using hdiutil or VZ APIs
        let sizeMB = sizeGB * 1024
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/hdiutil")
        process.arguments = [
            "create", "-size", "\(sizeMB)m",
            "-fs", "APFS",
            "-volname", "OpenVSCode",
            path
        ]
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            throw NSError(
                domain: "OpenVSCodeVM",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create ASIF disk"]
            )
        }
    }
    
    func start() throws {
        print("🚀 Starting OpenVSCode Server VM...")
        
        let config = try createVMConfiguration()
        virtualMachine = VZVirtualMachine(configuration: config, queue: vmQueue)
        virtualMachine?.delegate = self
        
        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?
        
        virtualMachine?.start { result in
            switch result {
            case .success:
                print("✅ VM started successfully")
                // Wait for VM to boot, then set up port forwarding
                DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                    self.setupPortForwarding()
                }
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
        
        // Keep running
        RunLoop.main.run()
    }
    
    func setupPortForwarding() {
        // Port forwarding via SSH or direct VM IP access
        // For now, OpenVSCode Server should bind to 0.0.0.0:8080 in VM
        // We'll access it via VM's NAT IP or use SSH port forwarding
        
        print("📡 Setting up port forwarding...")
        print("   OpenVSCode Server should be accessible at http://localhost:\(port)")
        print("   (Port forwarding will be configured once VM IP is known)")
    }
    
    func stop() {
        sshPortForward?.terminate()
        virtualMachine?.stop { _ in }
    }
    
    // MARK: - VZVirtualMachineDelegate
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("❌ VM stopped with error: \(error.localizedDescription)")
    }
    
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("🛑 VM guest stopped")
    }
}

// Main entry point
if CommandLine.arguments.count > 1 {
    let vmName = CommandLine.arguments[1]
    let vm = OpenVSCodeVM(vmName: vmName)
    do {
        try vm.start()
    } catch {
        print("Error: \(error)")
        exit(1)
    }
} else {
    print("Usage: \(CommandLine.arguments[0]) <vm-name>")
    exit(1)
}
    
    func setupPortForwarding() {
        print("📡 Setting up port forwarding...")
        
        // Wait for VM to get IP and SSH to be ready
        // Then set up SSH port forwarding: ssh -L 8080:localhost:8080 root@vm-ip -N
        
        // For now, OpenVSCode Server should bind to 0.0.0.0:8080 in VM
        // We'll access it via VM's NAT IP or use SSH port forwarding
        
        // TODO: Get VM IP from DHCP lease or serial console
        // TODO: Set up SSH port forwarding automatically
        
        print("   OpenVSCode Server should be accessible at http://localhost:\(port)")
        print("   (Ensure VM has SSH enabled and port forwarding configured)")
    }
