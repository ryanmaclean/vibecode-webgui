#!/usr/bin/env swift
//
// test-initramfs-cli.swift
// CLI tool to test initramfs files with Apple Virtualization.framework
// Usage: swift scripts/test-initramfs-cli.swift <initramfs-path> [kernel-path] [timeout-seconds]
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
class VMTestDelegate: NSObject, VZVirtualMachineDelegate {
    var vmStopped = false
    var stopError: Error?
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("❌ VM stopped with error: \(error.localizedDescription)")
        stopError = error
        vmStopped = true
    }

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("✅ Guest shut down gracefully")
        vmStopped = true
    }
}

@available(macOS 13.0, *)
func testInitramfs(initramfsPath: String, kernelPath: String?, timeout: Int) -> Bool {
    print("=== Testing Initramfs with Apple Virtualization.framework ===\n")
    
    // Resolve paths
    let initramfsURL = URL(fileURLWithPath: initramfsPath)
    let initramfsAbsolute = initramfsURL.absoluteURL.path
    
    // Check initramfs exists
    guard FileManager.default.fileExists(atPath: initramfsAbsolute) else {
        print("❌ ERROR: Initramfs not found: \(initramfsAbsolute)")
        return false
    }
    
    print("📦 Initramfs: \(initramfsAbsolute)")
    if let attrs = try? FileManager.default.attributesOfItem(atPath: initramfsAbsolute),
       let size = attrs[.size] as? Int64 {
        let sizeMB = Double(size) / (1024 * 1024)
        print("   Size: \(String(format: "%.1f", sizeMB)) MB")
    }
    
    // Find kernel
    let kernelURL: URL
    if let kernelPath = kernelPath {
        kernelURL = URL(fileURLWithPath: kernelPath)
    } else {
        // Try common locations
        let commonKernels = [
            "azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/vmlinux-raw",
            "azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/Resources/vmlinux-raw",
            "azure/SwiftUI-Apps/ValkeyVibeCode.app/Contents/Resources/vmlinux-raw",
            "azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/Resources/vmlinux-raw",
            "azure/SwiftUI-Apps/UnifiedServicesVibeCode.app/Contents/Resources/vmlinux-raw",
        ]
        
        var foundKernel: String?
        for kernel in commonKernels {
            let fullPath = (initramfsAbsolute as NSString).deletingLastPathComponent + "/../" + kernel
            let resolved = (fullPath as NSString).standardizingPath
            if FileManager.default.fileExists(atPath: resolved) {
                foundKernel = resolved
                break
            }
        }
        
        guard let kernel = foundKernel else {
            print("❌ ERROR: Kernel not found. Please specify kernel path.")
            print("   Usage: swift scripts/test-initramfs-cli.swift <initramfs> [kernel] [timeout]")
            return false
        }
        
        kernelURL = URL(fileURLWithPath: kernel)
    }
    
    let kernelAbsolute = kernelURL.absoluteURL.path
    guard FileManager.default.fileExists(atPath: kernelAbsolute) else {
        print("❌ ERROR: Kernel not found: \(kernelAbsolute)")
        return false
    }
    
    print("🐧 Kernel: \(kernelAbsolute)")
    if let attrs = try? FileManager.default.attributesOfItem(atPath: kernelAbsolute),
       let size = attrs[.size] as? Int64 {
        let sizeMB = Double(size) / (1024 * 1024)
        print("   Size: \(String(format: "%.1f", sizeMB)) MB")
    }
    
    // Create VM configuration
    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024  // 2GB
    
    // Bootloader
    let bootloader = VZLinuxBootLoader(kernelURL: kernelURL)
    bootloader.initialRamdiskURL = initramfsURL
    bootloader.commandLine = "console=hvc0 debug loglevel=8 ipv6.disable=1"
    config.bootLoader = bootloader
    
    // Network
    let networkDevice = VZVirtioNetworkDeviceConfiguration()
    networkDevice.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [networkDevice]
    
    // Serial console
    let consoleLogPath = URL(fileURLWithPath: "/tmp/test-initramfs-console-\(UUID().uuidString).log")
    FileManager.default.createFile(atPath: consoleLogPath.path, contents: nil)
    guard let consoleFileHandle = try? FileHandle(forWritingTo: consoleLogPath) else {
        print("❌ ERROR: Failed to create console log file")
        return false
    }
    
    let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
    serial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: nil,
        fileHandleForWriting: consoleFileHandle
    )
    config.serialPorts = [serial]
    
    // Entropy
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    
    // Platform
    let platform = VZGenericPlatformConfiguration()
    platform.machineIdentifier = VZGenericMachineIdentifier()
    config.platform = platform
    
    print("\n🔧 Validating VM configuration...")
    do {
        try config.validate()
        print("✅ Configuration valid")
    } catch {
        print("❌ Configuration validation failed: \(error.localizedDescription)")
        return false
    }
    
    print("\n🚀 Starting VM...")
    print("   Console log: \(consoleLogPath.path)")
    print("   Timeout: \(timeout) seconds\n")
    
    let vm = VZVirtualMachine(configuration: config)
    let delegate = VMTestDelegate()
    vm.delegate = delegate
    
    var vmStarted = false
    var startError: Error?
    
    let startSemaphore = DispatchSemaphore(value: 0)
    vm.start { result in
        switch result {
        case .success:
            vmStarted = true
            print("✅ VM started successfully!")
            startSemaphore.signal()
        case .failure(let error):
            startError = error
            print("❌ VM failed to start: \(error.localizedDescription)")
            startSemaphore.signal()
        }
    }
    
    // Wait for start
    if startSemaphore.wait(timeout: .now() + .seconds(10)) == .timedOut {
        print("⚠️  VM start timeout (still starting...)")
    }
    
    if startError != nil {
        return false
    }
    
    guard vmStarted else {
        print("❌ VM did not start")
        return false
    }
    
    // Monitor console output
    print("\n📺 Monitoring console output...\n")
    let startTime = Date()
    var lastLineCount = 0
    var ipDetected = false
    var bootComplete = false
    
    let timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { timer in
        let elapsed = Int(Date().timeIntervalSince(startTime))
        
        // Check timeout
        if elapsed >= timeout {
            print("\n⏱️  Timeout reached (\(timeout)s)")
            timer.invalidate()
            vm.stop { _ in }
            return
        }
        
        // Read console log
        guard let output = try? String(contentsOf: consoleLogPath, encoding: .utf8),
              !output.isEmpty else {
            if elapsed % 10 == 0 {
                print("⏳ Waiting for console output... (\(elapsed)s)")
            }
            return
        }
        
        let lines = output.components(separatedBy: .newlines)
        let newLines = lines.count - lastLineCount
        
        if newLines > 0 {
            // Show new lines
            let newOutput = lines.suffix(newLines).joined(separator: "\n")
            print(newOutput)
            lastLineCount = lines.count
            
            // Check for success indicators
            if !ipDetected && output.contains("VM IP address:") {
                if lines.first(where: { $0.contains("VM IP address:") }) != nil {
                    print("\n✅ IP Address detected!")
                    ipDetected = true
                }
            }
            
            if !bootComplete && (output.contains("Ready to accept connections") ||
                                output.contains("Server listening") ||
                                output.contains("VM Ready") ||
                                output.contains("SUCCESS:")) {
                print("\n✅ Boot complete indicators detected!")
                bootComplete = true
            }
        }
        
        // Check if VM stopped
        if delegate.vmStopped {
            timer.invalidate()
            if let error = delegate.stopError {
                print("\n❌ VM stopped with error")
            } else {
                print("\n✅ VM stopped gracefully")
            }
        }
    }
    
    RunLoop.current.add(timer, forMode: .default)
    
    // Wait for timeout or completion
    while Date().timeIntervalSince(startTime) < Double(timeout) && !delegate.vmStopped {
        RunLoop.current.run(until: Date().addingTimeInterval(1.0))
    }
    
    timer.invalidate()
    
    // Final status
    print("\n" + String(repeating: "=", count: 60))
    print("📊 Test Summary")
    print(String(repeating: "=", count: 60))
    
    let finalOutput = (try? String(contentsOf: consoleLogPath, encoding: .utf8)) ?? ""
    let finalLines = finalOutput.components(separatedBy: .newlines)
    
    print("Console log: \(consoleLogPath.path)")
    print("Total lines: \(finalLines.count)")
    print("IP detected: \(ipDetected ? "✅" : "❌")")
    print("Boot complete: \(bootComplete ? "✅" : "❌")")
    print("VM running: \(!delegate.vmStopped ? "✅" : "❌")")
    
    if !finalOutput.isEmpty {
        print("\n📝 Last 20 lines of console:")
        print(String(repeating: "-", count: 60))
        for line in finalLines.suffix(20) {
            print(line)
        }
    }
    
    // Stop VM
    if !delegate.vmStopped {
        print("\n🛑 Stopping VM...")
        vm.stop { _ in }
        sleep(2)
    }
    
    _ = try? consoleFileHandle.close()
    
    return ipDetected || bootComplete
}

// Main
if #available(macOS 13.0, *) {
    let args = CommandLine.arguments
    
    guard args.count >= 2 else {
        print("Usage: swift scripts/test-initramfs-cli.swift <initramfs-path> [kernel-path] [timeout-seconds]")
        print("\nExamples:")
        print("  swift scripts/test-initramfs-cli.swift azure/valkey-standalone-complete.cpio.gz")
        print("  swift scripts/test-initramfs-cli.swift azure/postgresql-standalone-final.cpio.gz azure/kernel/vmlinux-raw 60")
        exit(1)
    }
    
    let initramfsPath = args[1]
    let kernelPath = args.count > 2 ? args[2] : nil
    let timeout = args.count > 3 ? Int(args[3]) ?? 60 : 60
    
    let success = testInitramfs(initramfsPath: initramfsPath, kernelPath: kernelPath, timeout: timeout)
    exit(success ? 0 : 1)
} else {
    print("❌ ERROR: macOS 13.0+ required for Virtualization.framework")
    exit(1)
}

