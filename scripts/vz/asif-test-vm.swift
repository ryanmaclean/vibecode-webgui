#!/usr/bin/env swift
import Foundation
import Virtualization

// ASIF Test VM - Ultra-minimal VM for testing Apple Sparse Image Format
// Requirements: macOS 26+ (Tahoe), ~50MB total disk space
// Uses: Alpine Linux kernel + busybox initramfs + 100MB ASIF disk

@available(macOS 13.0, *)
class ASIFTestVM: NSObject {
    let kernelPath: String
    let initramfsPath: String
    let diskPath: String
    let outputPath: String

    var vm: VZVirtualMachine?
    var startTime: Date?
    var bootTime: TimeInterval?

    init(kernelPath: String, initramfsPath: String, diskPath: String, outputPath: String) {
        self.kernelPath = kernelPath
        self.initramfsPath = initramfsPath
        self.diskPath = diskPath
        self.outputPath = outputPath
        super.init()
    }

    func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // Minimal resources for test
        config.cpuCount = 1
        config.memorySize = 512 * 1024 * 1024 // 512MB

        // Boot loader
        let kernel = URL(fileURLWithPath: kernelPath)
        let initramfs = URL(fileURLWithPath: initramfsPath)

        let bootLoader = VZLinuxBootLoader(kernelURL: kernel)
        bootLoader.initialRamdiskURL = initramfs
        bootLoader.commandLine = "console=hvc0 panic=1"
        config.bootLoader = bootLoader

        // Storage - ASIF disk
        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [storageDevice]

        // Console for output
        let console = VZVirtioConsoleDeviceConfiguration()
        let consolePort = VZVirtioConsolePortConfiguration()
        consolePort.isConsole = true

        let outputURL = URL(fileURLWithPath: outputPath)
        consolePort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: nil,
            fileHandleForWriting: try FileHandle(forWritingTo: outputURL)
        )
        console.ports[0] = consolePort
        config.consoleDevices = [console]

        // Entropy device (required)
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Network (optional, but good for testing)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        try config.validate()
        return config
    }

    func run(duration: TimeInterval) async throws -> VMTestResult {
        print("🚀 Starting ASIF Test VM")
        print("   Kernel: \(kernelPath)")
        print("   Initramfs: \(initramfsPath)")
        print("   Disk: \(diskPath)")
        print("")

        let config = try createConfiguration()
        let vm = VZVirtualMachine(configuration: config)
        self.vm = vm

        // Start VM
        startTime = Date()
        print("⏱️  Starting VM...")
        try await vm.start()
        bootTime = Date().timeIntervalSince(startTime!)
        print("✅ VM started in \(String(format: "%.2f", bootTime!))s")

        // Run for specified duration
        print("⏱️  Running for \(Int(duration))s...")
        try await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))

        // Stop VM
        print("🛑 Stopping VM...")
        try await vm.stop()
        print("✅ VM stopped")

        // Collect results
        let result = try collectResults()
        return result
    }

    func collectResults() throws -> VMTestResult {
        let kernelSize = try FileManager.default.attributesOfItem(atPath: kernelPath)[.size] as! UInt64
        let initramfsSize = try FileManager.default.attributesOfItem(atPath: initramfsPath)[.size] as! UInt64
        let diskSize = try FileManager.default.attributesOfItem(atPath: diskPath)[.size] as! UInt64

        // Get disk actual size (sparse)
        let diskActualSize: UInt64
        if let process = try? Process() {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/du")
            process.arguments = ["-k", diskPath]
            let pipe = Pipe()
            process.standardOutput = pipe
            try? process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8),
               let sizeStr = output.split(separator: "\t").first,
               let size = UInt64(sizeStr) {
                diskActualSize = size * 1024 // Convert KB to bytes
            } else {
                diskActualSize = diskSize
            }
        } else {
            diskActualSize = diskSize
        }

        let totalSize = kernelSize + initramfsSize + diskActualSize

        return VMTestResult(
            bootTime: bootTime ?? 0,
            kernelSize: kernelSize,
            initramfsSize: initramfsSize,
            diskLogicalSize: diskSize,
            diskActualSize: diskActualSize,
            totalSize: totalSize,
            success: true
        )
    }
}

struct VMTestResult {
    let bootTime: TimeInterval
    let kernelSize: UInt64
    let initramfsSize: UInt64
    let diskLogicalSize: UInt64
    let diskActualSize: UInt64
    let totalSize: UInt64
    let success: Bool

    func format() -> String {
        """

        📊 ASIF Test VM Results
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        ⏱️  Boot Time: \(String(format: "%.2f", bootTime))s

        📦 Component Sizes:
           Kernel:      \(formatBytes(kernelSize))
           Initramfs:   \(formatBytes(initramfsSize))
           Disk (logical): \(formatBytes(diskLogicalSize))
           Disk (actual):  \(formatBytes(diskActualSize))

        💾 Total Disk Usage: \(formatBytes(totalSize))
        💡 Space Saved (sparse): \(formatBytes(diskLogicalSize - diskActualSize))

        ✅ Status: \(success ? "SUCCESS" : "FAILED")
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        """
    }

    func formatBytes(_ bytes: UInt64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// Performance test for ASIF vs RAW
@available(macOS 13.0, *)
func performanceTest(diskPath: String) async throws -> PerformanceResult {
    let testSize = 10 * 1024 * 1024 // 10MB test
    let testData = Data(repeating: 0xAB, count: testSize)
    let testFile = diskPath + ".perftest"

    // Write test
    let writeStart = Date()
    try testData.write(to: URL(fileURLWithPath: testFile))
    let writeTime = Date().timeIntervalSince(writeStart)
    let writeSpeed = Double(testSize) / writeTime / 1024 / 1024 // MB/s

    // Read test
    let readStart = Date()
    _ = try Data(contentsOf: URL(fileURLWithPath: testFile))
    let readTime = Date().timeIntervalSince(readStart)
    let readSpeed = Double(testSize) / readTime / 1024 / 1024 // MB/s

    // Cleanup
    try? FileManager.default.removeItem(atPath: testFile)

    return PerformanceResult(
        readSpeed: readSpeed,
        writeSpeed: writeSpeed,
        testSize: testSize
    )
}

struct PerformanceResult {
    let readSpeed: Double
    let writeSpeed: Double
    let testSize: Int

    func format() -> String {
        """

        🚀 ASIF Performance Test
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        Test Size: \(testSize / 1024 / 1024)MB

        📖 Read Speed:  \(String(format: "%.2f", readSpeed)) MB/s
        📝 Write Speed: \(String(format: "%.2f", writeSpeed)) MB/s

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        """
    }
}

// Main execution
@available(macOS 13.0, *)
func main() async throws {
    let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
    let testDir = "/tmp/asif-test"

    // Paths
    let kernelPath = "\(testDir)/vmlinuz"
    let initramfsPath = "\(testDir)/initramfs"
    let diskPath = "\(testDir)/test-vm.asif"
    let outputPath = "\(testDir)/console.log"

    // Create test directory
    try? FileManager.default.createDirectory(atPath: testDir, withIntermediateDirectories: true)

    // Check if components exist
    if !FileManager.default.fileExists(atPath: kernelPath) {
        print("❌ Kernel not found: \(kernelPath)")
        print("   Run: ./scripts/vz/download-alpine-minimal.sh")
        exit(1)
    }

    if !FileManager.default.fileExists(atPath: initramfsPath) {
        print("❌ Initramfs not found: \(initramfsPath)")
        print("   Run: ./scripts/vz/create-minimal-initramfs.sh")
        exit(1)
    }

    if !FileManager.default.fileExists(atPath: diskPath) {
        print("❌ ASIF disk not found: \(diskPath)")
        print("   Run: ./scripts/vz/create-asif-disk.sh")
        exit(1)
    }

    // Create console output file
    FileManager.default.createFile(atPath: outputPath, contents: nil)

    // Run VM test
    let testVM = ASIFTestVM(
        kernelPath: kernelPath,
        initramfsPath: initramfsPath,
        diskPath: diskPath,
        outputPath: outputPath
    )

    let result = try await testVM.run(duration: 5.0)
    print(result.format())

    // Run performance test
    print("\n🔬 Running performance test...")
    let perfResult = try await performanceTest(diskPath: testDir)
    print(perfResult.format())

    // Show console output
    if let consoleOutput = try? String(contentsOfFile: outputPath, encoding: .utf8) {
        if !consoleOutput.isEmpty {
            print("\n📝 Console Output:")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print(consoleOutput.prefix(1000))
            if consoleOutput.count > 1000 {
                print("... (truncated)")
            }
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        }
    }
}

if #available(macOS 13.0, *) {
    Task {
        do {
            try await main()
            exit(0)
        } catch {
            print("❌ Error: \(error)")
            exit(1)
        }
    }
    RunLoop.main.run()
} else {
    print("❌ Requires macOS 13.0+")
    exit(1)
}
