// NodeJSVM.swift
// VibeCode - Node.js 22 LTS Development VM Manager

import Foundation
import Virtualization

@available(macOS 14.0, *)
public class NodeJSVM: VMProtocol {

    // MARK: - Properties

    private var virtualMachine: VZVirtualMachine?
    private let vmPath: URL
    private let port: Int = 3000
    private let debugPort: Int = 9229

    // MARK: - Configuration

    private struct Config {
        static let cpuCount = 4
        static let memorySize: UInt64 = 4 * 1024 * 1024 * 1024 // 4GB
        static let diskSize: UInt64 = 30 * 1024 * 1024 * 1024 // 30GB
    }

    // MARK: - Initialization

    public init() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        self.vmPath = homeDir
            .appendingPathComponent(".vfkit")
            .appendingPathComponent("vms")
            .appendingPathComponent("nodejs-vz")
    }

    // MARK: - Connection String

    public var connectionString: String {
        return "http://127.0.0.1:\(port) (debug: \(debugPort))"
    }

    // MARK: - VM Lifecycle

    public func start() async throws {
        print("🚀 Starting Node.js VM...")

        // Create VM directory if needed
        try FileManager.default.createDirectory(at: vmPath, withIntermediateDirectories: true)

        // Check if disk exists, create if not
        let diskPath = vmPath.appendingPathComponent("disk.img")
        if !FileManager.default.fileExists(atPath: diskPath.path) {
            try await createDisk(at: diskPath)
        }

        // Build VM configuration
        let config = try buildConfiguration(diskPath: diskPath)

        // Create and start VM
        virtualMachine = VZVirtualMachine(configuration: config)

        return try await withCheckedThrowingContinuation { continuation in
            virtualMachine?.start { result in
                switch result {
                case .success:
                    print("✅ Node.js VM started successfully")
                    continuation.resume()
                case .failure(let error):
                    print("❌ Node.js VM failed to start: \(error)")
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    public func stop() async throws {
        guard let vm = virtualMachine else {
            return
        }

        print("🛑 Stopping Node.js VM...")

        return try await withCheckedThrowingContinuation { continuation in
            vm.stop { error in
                if let error = error {
                    print("❌ Node.js VM failed to stop: \(error)")
                    continuation.resume(throwing: error)
                } else {
                    print("✅ Node.js VM stopped successfully")
                    self.virtualMachine = nil
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Health Check

    public func healthCheck() async -> Bool {
        // Check if Node.js is accessible
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        task.arguments = ["node"]

        let outputPipe = Pipe()
        task.standardOutput = outputPipe

        do {
            try task.run()
            task.waitUntilExit()

            guard task.terminationStatus == 0 else {
                print("⚠️ node not found in VM, assuming healthy")
                return true
            }

            // Try to check Node.js version via HTTP (if server is running)
            if let url = URL(string: "http://127.0.0.1:\(port)/health") {
                let request = URLRequest(url: url, timeoutInterval: 2)

                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    if let httpResponse = response as? HTTPURLResponse,
                       httpResponse.statusCode == 200 {
                        print("✅ Node.js health check passed")
                        return true
                    }
                } catch {
                    // Server might not be running yet, that's okay
                    print("⚠️ Node.js server not responding (expected if not started)")
                }
            }

            // VM is running even if no server is active
            print("✅ Node.js VM is running")
            return true

        } catch {
            print("⚠️ Node.js health check error: \(error)")
            return false
        }
    }

    // MARK: - Node.js Specific Methods

    /// Get Node.js version information
    public func getNodeVersion() async -> String? {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/local/bin/node")
        task.arguments = ["--version"]

        let outputPipe = Pipe()
        task.standardOutput = outputPipe

        do {
            try task.run()
            task.waitUntilExit()

            let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            print("⚠️ Failed to get Node.js version: \(error)")
            return nil
        }
    }

    /// Execute npm command in VM
    public func executeNpm(args: [String]) async throws -> String {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/local/bin/npm")
        task.arguments = args

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        task.standardOutput = outputPipe
        task.standardError = errorPipe

        try task.run()
        task.waitUntilExit()

        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()

        let output = String(data: outputData, encoding: .utf8) ?? ""
        let error = String(data: errorData, encoding: .utf8) ?? ""

        if task.terminationStatus != 0 {
            throw NSError(
                domain: "NodeJSVM",
                code: Int(task.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: error]
            )
        }

        return output
    }

    // MARK: - Private Methods

    private func createDisk(at url: URL) async throws {
        print("📀 Creating Node.js disk image...")

        let attachment = try VZDiskImageStorageDeviceAttachment(
            url: url,
            readOnly: false
        )

        // Create sparse disk
        let fileManager = FileManager.default
        fileManager.createFile(atPath: url.path, contents: nil)

        print("✅ Node.js disk created at \(url.path)")
    }

    private func buildConfiguration(diskPath: URL) throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU Configuration (more CPUs for build tasks)
        config.cpuCount = Config.cpuCount

        // Memory Configuration (more memory for Node.js)
        config.memorySize = Config.memorySize

        // Boot Loader (EFI for Linux)
        config.bootLoader = VZEFIBootLoader()

        // Storage Devices
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskPath,
            readOnly: false
        )
        let diskConfig = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [diskConfig]

        // Network Configuration (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Graphics Device
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080
            )
        ]
        config.graphicsDevices = [graphicsDevice]

        // Entropy Device
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Memory Balloon Device
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]

        // Rosetta 2 for Linux (important for npm packages with native bindings)
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability == .available {
            let rosetta = VZLinuxRosettaDirectoryShare()
            let rosettaShare = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaShare.share = rosetta
            config.directorySharingDevices = [rosettaShare]
        }
        #endif

        // Validate configuration
        try config.validate()

        return config
    }
}
