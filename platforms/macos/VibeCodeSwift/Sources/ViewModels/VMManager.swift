// MIT License - VM Manager (Observable)
import Foundation
import Virtualization
import Combine
import os.log

extension String {
    func appendToFile(at path: String) {
        if let handle = FileHandle(forWritingAtPath: path) {
            handle.seekToEndOfFile()
            handle.write(self.data(using: .utf8)!)
            handle.closeFile()
        }
    }
}

class VMManager: ObservableObject {
    @Published var vms: [VMInfo] = []
    @Published var runningVMs: [String: VZVirtualMachine] = [:]
    @Published var vmStatus: [String: VMStatus] = [:]
    
    private let logger = Logger(subsystem: "com.vibecode.vm", category: "VMManager")
    
    // CRITICAL: VZVirtualMachine requires operations on a serial dispatch queue
    private let vmQueue = DispatchQueue(label: "com.vibecode.vmQueue", qos: .userInitiated)
    
    init() {
        DatadogLogger.shared.info("VMManager.init() called", [
            "component": "VMManager",
            "event": "initialization"
        ])
    }
    
    func loadAvailableVMs() {
        print("🔍 loadAvailableVMs() called")
        NSLog("🔍 VIBECODE: loadAvailableVMs() called")
        DatadogLogger.shared.info("loadAvailableVMs() called", [
            "component": "VMManager",
            "event": "vm_discovery_start"
        ])
        
        // Debug file write
        try? "VM Discovery Started\n".write(toFile: "/tmp/vibecode-debug.log", atomically: true, encoding: .utf8)
        
        // Try multiple locations for VMs
        var vmPath: URL?
        
        // 1. Try app bundle Resources
        if let resourcePath = Bundle.main.resourcePath {
            let bundlePath = URL(fileURLWithPath: resourcePath).appendingPathComponent("vms")
            print("📂 Checking app bundle: \(bundlePath.path)")
            DatadogLogger.shared.debug("Checking app bundle", ["path": bundlePath.path])
            if FileManager.default.fileExists(atPath: bundlePath.path) {
                print("✅ Found VMs in app bundle")
                DatadogLogger.shared.info("Found VMs in app bundle", ["path": bundlePath.path])
                vmPath = bundlePath
            }
        }
        
        // 2. Try development location (for testing)
        if vmPath == nil {
            let devPath = URL(fileURLWithPath: "/Users/studio/Documents/vibecode-webgui/dist/vm-images")
            print("📂 Checking dev location: \(devPath.path)")
            DatadogLogger.shared.debug("Checking dev location", ["path": devPath.path])
            if FileManager.default.fileExists(atPath: devPath.path) {
                print("✅ Found VMs in dev location!")
                DatadogLogger.shared.info("Found VMs in dev location", ["path": devPath.path])
                vmPath = devPath
            } else {
                print("❌ Dev location doesn't exist")
            }
        }
        
        // 3. Try user Application Support
        if vmPath == nil {
            if let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
                let userPath = appSupport.appendingPathComponent("VibeCode/vms")
                DatadogLogger.shared.debug("Checking Application Support", ["path": userPath.path])
                if FileManager.default.fileExists(atPath: userPath.path) {
                    DatadogLogger.shared.info("Found VMs in Application Support", ["path": userPath.path])
                    vmPath = userPath
                }
            }
        }
        
        guard let vmPath = vmPath else {
            print("❌ No VM directory found in any location!")
            DatadogLogger.shared.error("No VMs found in any location", [
                "component": "VMManager",
                "event": "vm_discovery_failed"
            ])
            return
        }
        
        print("📁 Using VM path: \(vmPath.path)")
        NSLog("📁 VIBECODE: Using VM path: %@", vmPath.path)
        try? "Using VM path: \(vmPath.path)\n".appendToFile(at: "/tmp/vibecode-debug.log")
        
        do {
            let files = try FileManager.default.contentsOfDirectory(at: vmPath, includingPropertiesForKeys: nil)
            NSLog("📂 VIBECODE: Found %d files in directory", files.count)
            try? "Found \(files.count) files\n".appendToFile(at: "/tmp/vibecode-debug.log")
            DatadogLogger.shared.debug("Reading VM directory", [
                "path": vmPath.path,
                "total_files": files.count
            ])
            
            let imgFiles = files.filter { $0.pathExtension == "img" }
            DatadogLogger.shared.info("Found disk images", [
                "count": imgFiles.count,
                "path": vmPath.path
            ])
            
            let discoveredVMs = imgFiles.compactMap { diskPath -> VMInfo? in
                let name = diskPath.deletingPathExtension().lastPathComponent
                let parentDir = diskPath.deletingLastPathComponent()
                let efiFilename = name + "-efi.nvram"
                let efiPath = parentDir.appendingPathComponent(efiFilename)
                
                DatadogLogger.shared.debug("Validating VM", [
                    "vm_name": name,
                    "disk_path": diskPath.path,
                    "efi_path": efiPath.path
                ])
                
                guard FileManager.default.fileExists(atPath: efiPath.path) else {
                    DatadogLogger.shared.warning("Missing EFI file for VM", [
                        "vm_name": name,
                        "expected_efi": efiFilename
                    ])
                    return nil
                }
                
                DatadogLogger.shared.info("VM validated successfully", [
                    "vm_name": name,
                    "disk_path": diskPath.path
                ])
                
                return VMInfo(
                    id: name,
                    name: name.replacingOccurrences(of: "vibecode-", with: "").capitalized,
                    diskPath: diskPath,
                    efiPath: efiPath,
                    port: getDefaultPort(for: name)
                )
            }
            
            // Update on main thread to trigger SwiftUI updates
            DispatchQueue.main.async {
                DatadogLogger.shared.info("Updating vms array on main thread", [
                    "vm_count": discoveredVMs.count,
                    "event": "ui_update"
                ])
                self.vms = discoveredVMs
                self.objectWillChange.send()
                DatadogLogger.shared.info("vms array updated, objectWillChange sent", [
                    "current_vm_count": self.vms.count
                ])
                
                // Auto-start codeserver VM (DELAYED for 5 seconds to let UI load first)
                NSLog("🔍 VIBECODE: Checking for codeserver VM... Found \(discoveredVMs.count) VMs")
                for vm in discoveredVMs {
                    NSLog("  - VM name: %@", vm.name)
                }
                
                if let codeserverVM = discoveredVMs.first(where: { $0.name.lowercased().contains("codeserver") }) {
                    NSLog("⏱️  VIBECODE: Will auto-start codeserver VM (%@) in 5 seconds...", codeserverVM.name)
                    Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                        NSLog("🚀 VIBECODE: Starting auto-start for codeserver VM...")
                        do {
                            try await self.startVM(codeserverVM)
                            NSLog("✅ VIBECODE: Codeserver VM auto-started")
                        } catch {
                            NSLog("❌ VIBECODE: Failed to auto-start codeserver: %@", error.localizedDescription)
                        }
                    }
                } else {
                    NSLog("❌ VIBECODE: No codeserver VM found in discovered VMs")
                }
            }
            
            DatadogLogger.shared.info("VM discovery completed", [
                "component": "VMManager",
                "event": "vm_discovery_complete",
                "vm_count": discoveredVMs.count,
                "vm_names": discoveredVMs.map { $0.name }
            ])
            
            // Send VM discovery metrics
            DogStatsDClient.shared.gauge("vibecode.vm.discovered_count", value: Double(discoveredVMs.count))
            DogStatsDClient.shared.event("VM Discovery", 
                text: "Discovered \(discoveredVMs.count) VMs", 
                alertType: "info",
                tags: ["component:VMManager"])
        } catch {
            DatadogLogger.shared.error("Error loading VMs", [
                "error": error.localizedDescription,
                "component": "VMManager"
            ])
        }
    }
    
    func startVM(_ vmInfo: VMInfo) async throws {
        print("🚀 Starting VM: \(vmInfo.name)")
        NSLog("🚀 VIBECODE: Starting VM: %@", vmInfo.name)
        
        // Safe mode: avoid booting tiny stub images that will crash VZ
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: vmInfo.diskPath.path)
            if let size = attrs[.size] as? NSNumber {
                let bytes = size.int64Value
                // 50 MB threshold; allow known dev VMs (codeserver/ide)
                let isTiny = bytes < (50 * 1_024 * 1_024)
                let lower = vmInfo.name.lowercased()
                let isAllowed = lower.contains("codeserver") || lower.contains("ide")
                if isTiny && !isAllowed {
                    DatadogLogger.shared.warning("Skipping VM start due to tiny disk (safe mode)", [
                        "vm_name": vmInfo.name,
                        "disk_bytes": bytes
                    ])
                    DogStatsDClient.shared.increment("vibecode.vm.start.skipped", tags: [
                        "vm_name:\(vmInfo.name)",
                        "reason:tiny_disk"
                    ])
                    throw VMError.failedToLoadDisk
                }
            }
        } catch {
            // If we cannot read attributes, proceed; VZ will validate later
        }
        
        // Send Datadog metrics
        let startTime = Date()
        DogStatsDClient.shared.increment("vibecode.vm.start.attempt", tags: [
            "vm_name:\(vmInfo.name)",
            "vm_id:\(vmInfo.id)"
        ])
        
        // Update status on main thread
        await MainActor.run {
            vmStatus[vmInfo.id] = .starting
        }
        
        // CRITICAL: VZVirtualMachine must be created and started on a serial queue
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            vmQueue.async {
                do {
                    NSLog("📋 VIBECODE: Creating VM configuration on vmQueue...")
                    
                    // Create config synchronously on vmQueue
                    let semaphore = DispatchSemaphore(value: 0)
                    var config: VZVirtualMachineConfiguration?
                    var configError: Error?
                    
                    Task {
                        do {
                            config = try await self.createVMConfiguration(for: vmInfo)
                        } catch {
                            configError = error
                        }
                        semaphore.signal()
                    }
                    semaphore.wait()
                    
                    if let error = configError {
                        throw error
                    }
                    
                    guard let finalConfig = config else {
                        throw VMError.failedToLoadDisk
                    }
                    
                    NSLog("✅ VIBECODE: Configuration created on vmQueue")
                    
                    let vm = VZVirtualMachine(configuration: finalConfig, queue: self.vmQueue)
                    NSLog("✅ VIBECODE: VZVirtualMachine initialized with dedicated queue")
                    
                    // Store reference
                    DispatchQueue.main.sync {
                        self.runningVMs[vmInfo.id] = vm
                    }
                    
                    // Start VM on the dedicated queue
                    NSLog("🚀 VIBECODE: Starting VM on vmQueue...")
                    vm.start { result in
                        switch result {
                        case .success:
                            NSLog("✅ VIBECODE: VM started successfully: %@", vmInfo.name)
                            
                            // Send success metrics
                            let duration = Date().timeIntervalSince(startTime)
                            DogStatsDClient.shared.increment("vibecode.vm.start.success", tags: [
                                "vm_name:\(vmInfo.name)",
                                "vm_id:\(vmInfo.id)"
                            ])
                            DogStatsDClient.shared.timing("vibecode.vm.start.duration", 
                                milliseconds: Int(duration * 1000), 
                                tags: ["vm_name:\(vmInfo.name)"])
                            DogStatsDClient.shared.event("VM Started", 
                                text: "VM \(vmInfo.name) started successfully", 
                                alertType: "success",
                                tags: ["vm_name:\(vmInfo.name)"])
                            
                            DispatchQueue.main.async {
                                self.vmStatus[vmInfo.id] = .running
                                DogStatsDClient.shared.gauge("vibecode.vm.running_count", 
                                    value: Double(self.runningVMs.count))
                            }
                            continuation.resume()
                        case .failure(let error):
                            NSLog("❌ VIBECODE: VM start failed: %@", error.localizedDescription)
                            
                            // Send failure metrics
                            DogStatsDClient.shared.increment("vibecode.vm.start.failure", tags: [
                                "vm_name:\(vmInfo.name)",
                                "vm_id:\(vmInfo.id)",
                                "error:\(error.localizedDescription)"
                            ])
                            DogStatsDClient.shared.event("VM Start Failed", 
                                text: "VM \(vmInfo.name) failed to start: \(error.localizedDescription)", 
                                alertType: "error",
                                tags: ["vm_name:\(vmInfo.name)"])
                            
                            DispatchQueue.main.async {
                                self.vmStatus[vmInfo.id] = .stopped
                                self.runningVMs.removeValue(forKey: vmInfo.id)
                            }
                            continuation.resume(throwing: error)
                        }
                    }
                } catch {
                    NSLog("❌ VIBECODE: VM setup failed: %@", error.localizedDescription)
                    DispatchQueue.main.async {
                        self.vmStatus[vmInfo.id] = .stopped
                    }
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    func stopVM(_ vmInfo: VMInfo) async throws {
        print("🛑 Stopping VM: \(vmInfo.name)")
        
        guard let vm = runningVMs[vmInfo.id] else {
            throw VMError.notRunning
        }
        
        vmStatus[vmInfo.id] = .stopping
        
        // Stop VM
        try await vm.stop()
        
        runningVMs.removeValue(forKey: vmInfo.id)
        vmStatus[vmInfo.id] = .stopped
        
        print("✅ VM stopped: \(vmInfo.name)")
    }
    
    func isVMRunning(_ vmInfo: VMInfo) -> Bool {
        return runningVMs[vmInfo.id]?.state == .running
    }
    
    // MARK: - VM Configuration
    
    private func createVMConfiguration(for vmInfo: VMInfo) async throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        
        // CPU
        config.cpuCount = 4
        
        // Memory - 4GB
        config.memorySize = 4 * 1024 * 1024 * 1024
        
        // Platform (Generic for Linux)
        let platform = VZGenericPlatformConfiguration()
        config.platform = platform
        
        // Boot loader - UEFI
        let bootloader = VZEFIBootLoader()
        
        // EFI variable store
        NSLog("📂 VIBECODE: Loading EFI from: %@", vmInfo.efiPath.path)
        let efiStore: VZEFIVariableStore
        do {
            efiStore = try VZEFIVariableStore(url: vmInfo.efiPath)
            NSLog("✅ VIBECODE: EFI variable store loaded")
        } catch {
            NSLog("❌ VIBECODE: Failed to load EFI: %@", error.localizedDescription)
            throw VMError.failedToLoadEFI
        }
        bootloader.variableStore = efiStore
        config.bootLoader = bootloader
        
        // Storage - Disk image
        NSLog("💾 VIBECODE: Loading disk from: %@", vmInfo.diskPath.path)
        let diskAttachment: VZDiskImageStorageDeviceAttachment
        do {
            // Use advanced initializer with explicit synchronization mode
            // This is required for VZ to accept the disk attachment
            // VirtualBuddy and other VZ apps use synchronizationMode: .full
            diskAttachment = try VZDiskImageStorageDeviceAttachment(
                url: vmInfo.diskPath,
                readOnly: false,
                cachingMode: .automatic,        // Let VZ optimize caching
                synchronizationMode: .full      // Full sync for data safety
            )
            NSLog("✅ VIBECODE: Disk image loaded with synchronization mode")
        } catch {
            NSLog("❌ VIBECODE: Failed to load disk: %@", error.localizedDescription)
            throw VMError.failedToLoadDisk
        }
        
        let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        
        // Check for cloud-init ISO (for first boot provisioning)
        // Try multiple possible locations
        let basePath = vmInfo.diskPath.deletingLastPathComponent()
        var cloudInitPath = basePath.appendingPathComponent("\(vmInfo.id)-seed.iso")
        
        // If not found in main directory, try cloud-init subdirectory
        if !FileManager.default.fileExists(atPath: cloudInitPath.path) {
            cloudInitPath = basePath.appendingPathComponent("cloud-init")
                .appendingPathComponent("\(vmInfo.id)-seed.iso")
        }
        
        var storageDevices: [VZStorageDeviceConfiguration] = [storageDevice]
        
        if FileManager.default.fileExists(atPath: cloudInitPath.path) {
            NSLog("📀 VIBECODE: Found cloud-init ISO: %@", cloudInitPath.path)
            do {
                let cloudInitAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: cloudInitPath,
                    readOnly: true,
                    cachingMode: .automatic,
                    synchronizationMode: .full
                )
                let cloudInitDevice = VZVirtioBlockDeviceConfiguration(attachment: cloudInitAttachment)
                storageDevices.append(cloudInitDevice)
                NSLog("✅ VIBECODE: Cloud-init ISO attached")
            } catch {
                NSLog("⚠️ VIBECODE: Could not attach cloud-init ISO: %@", error.localizedDescription)
            }
        }
        
        config.storageDevices = storageDevices
        
        // Network
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        
        // Serial console for boot output and debugging
        let consoleConfig = VZVirtioConsoleDeviceConfiguration()
        let inputPipe = Pipe()
        let outputPipe = Pipe()
        
        // Create console port
        let consolePort = VZVirtioConsolePortConfiguration()
        consolePort.name = "console"
        consolePort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        consoleConfig.ports[0] = consolePort
        config.consoleDevices = [consoleConfig]
        
        // Capture console output to file for debugging
        let consoleLogPath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("vibecode-webgui/logs/\(vmInfo.name)-console.log")
        
        DispatchQueue.global(qos: .utility).async {
            while true {
                let data = outputPipe.fileHandleForReading.availableData
                if data.count > 0 {
                    if let output = String(data: data, encoding: .utf8) {
                        try? (output + "\n").write(to: consoleLogPath, atomically: false, encoding: .utf8)
                        NSLog("📟 VM Console (\(vmInfo.name)): \(output.trimmingCharacters(in: .whitespacesAndNewlines))")
                    }
                }
            }
        }
        
        // Validate
        NSLog("🔍 VIBECODE: Validating configuration...")
        do {
            try config.validate()
            NSLog("✅ VIBECODE: Configuration validated successfully")
        } catch {
            NSLog("❌ VIBECODE: Configuration validation failed: %@", error.localizedDescription)
            throw error
        }
        
        return config
    }
    
    // MARK: - Helpers
    
    private func getDefaultPort(for vmName: String) -> Int {
        if vmName.contains("postgresql") {
            return 5432
        } else if vmName.contains("valkey") {
            return 6379
        } else if vmName.contains("nodejs") {
            return 3000
        }
        return 8080
    }
}

// MARK: - Models

struct VMInfo: Identifiable, Hashable {
    let id: String
    let name: String
    let diskPath: URL
    let efiPath: URL
    let port: Int
}

enum VMStatus {
    case stopped
    case starting
    case running
    case stopping
}

enum VMError: LocalizedError {
    case notRunning
    case failedToLoadEFI
    case failedToLoadDisk
    
    var errorDescription: String? {
        switch self {
        case .notRunning: return "VM is not running"
        case .failedToLoadEFI: return "Failed to load EFI variable store"
        case .failedToLoadDisk: return "Failed to load disk image"
        }
    }
}

// MARK: - Stderr Helper

import Darwin

var standardError = FileHandleOutputStream(fileHandle: FileHandle.standardError)

struct FileHandleOutputStream: TextOutputStream {
    let fileHandle: FileHandle
    
    func write(_ string: String) {
        if let data = string.data(using: .utf8) {
            fileHandle.write(data)
        }
    }
}

