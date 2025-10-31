import Foundation
import Virtualization

// Command-line tool to test different VZNATNetworkDeviceAttachment configurations

enum NetworkConfig: String, CaseIterable {
    case basic = "basic"
    case withVirtioNet = "virtio-params"
    case verboseKernel = "verbose"
    case withMacAddress = "custom-mac"
    case ubuntuKernel = "ubuntu"

    var description: String {
        switch self {
        case .basic: return "Basic (console=hvc0)"
        case .withVirtioNet: return "With virtio_net params"
        case .verboseKernel: return "Verbose kernel debug"
        case .withMacAddress: return "Custom MAC address"
        case .ubuntuKernel: return "Ubuntu kernel"
        }
    }

    var commandLine: String {
        switch self {
        case .basic: return "console=hvc0"
        case .withVirtioNet: return "console=hvc0 virtio_net.napi_weight=64"
        case .verboseKernel: return "console=hvc0 debug loglevel=7 initcall_debug"
        case .withMacAddress, .ubuntuKernel: return "console=hvc0 debug loglevel=7"
        }
    }

    var kernelPath: String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        if self == .ubuntuKernel {
            return "\(home)/.vfkit/vms/vibecode-alpine/kernel/vmlinux-ubuntu-uncompressed"
        }
        return "\(home)/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw"
    }
}

class VMTester {
    var vm: VZVirtualMachine?
    var consoleFileHandle: FileHandle?
    let config: NetworkConfig
    let consoleLogPath: String
    var startTime: Date?
    var hasEth0 = false
    var hasVirtioNet = false
    var bootMessages: [String] = []

    init(config: NetworkConfig) {
        self.config = config
        self.consoleLogPath = "/tmp/vibecode-test-\(config.rawValue).log"
    }

    func runTest(timeout: Int = 15) {
        print("========================================")
        print("Testing: \(config.description)")
        print("Kernel: \(config.kernelPath)")
        print("Command line: \(config.commandLine)")
        print("========================================")

        do {
            let vmConfig = try createVMConfiguration()

            vm = VZVirtualMachine(configuration: vmConfig)
            startTime = Date()

            let semaphore = DispatchSemaphore(value: 0)

            vm?.start { result in
                switch result {
                case .success:
                    print("VM started successfully")
                case .failure(let error):
                    print("ERROR: VM failed to start: \(error)")
                    semaphore.signal()
                }
            }

            // Monitor console output
            DispatchQueue.global().async {
                var lastSize: UInt64 = 0
                let endTime = Date().addingTimeInterval(TimeInterval(timeout))

                while Date() < endTime {
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: self.consoleLogPath),
                       let size = attrs[.size] as? UInt64,
                       size > lastSize {

                        if let data = try? Data(contentsOf: URL(fileURLWithPath: self.consoleLogPath)),
                           let content = String(data: data, encoding: .utf8) {

                            let newLines = content.split(separator: "\n").map(String.init)
                            for line in newLines {
                                if line.contains("eth0") && !self.hasEth0 {
                                    self.hasEth0 = true
                                    print("✓ FOUND: eth0 interface")
                                }
                                if line.contains("virtio") && line.contains("net") && !self.hasVirtioNet {
                                    self.hasVirtioNet = true
                                    print("✓ FOUND: virtio-net driver")
                                }
                            }
                        }
                        lastSize = size
                    }
                    usleep(500000) // 0.5 seconds
                }

                semaphore.signal()
            }

            // Wait for timeout
            _ = semaphore.wait(timeout: .now() + .seconds(timeout + 2))

            // Stop VM
            if let vm = vm {
                let stopSemaphore = DispatchSemaphore(value: 0)
                vm.stop { error in
                    if let error = error {
                        print("Error stopping VM: \(error)")
                    }
                    stopSemaphore.signal()
                }
                _ = stopSemaphore.wait(timeout: .now() + .seconds(5))
            }

            // Analyze results
            analyzeResults()

        } catch {
            print("ERROR: Failed to create VM configuration: \(error)")
        }

        print("")
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024

        let kernel = URL(fileURLWithPath: self.config.kernelPath)
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let initrd = URL(fileURLWithPath: "\(home)/vibecode-webgui/azure/bun-openvscode.cpio.gz")

        guard FileManager.default.fileExists(atPath: kernel.path) else {
            throw NSError(domain: "VMTester", code: 1,
                         userInfo: [NSLocalizedDescriptionKey: "Kernel not found: \(kernel.path)"])
        }

        guard FileManager.default.fileExists(atPath: initrd.path) else {
            throw NSError(domain: "VMTester", code: 2,
                         userInfo: [NSLocalizedDescriptionKey: "Initramfs not found: \(initrd.path)"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd
        bootloader.commandLine = self.config.commandLine
        config.bootLoader = bootloader

        // Network configuration
        let net = VZVirtioNetworkDeviceConfiguration()

        if self.config == .withMacAddress {
            let macAddress = VZMACAddress(string: "52:54:00:12:34:56")!
            net.macAddress = macAddress
            print("Using custom MAC: 52:54:00:12:34:56")
        }

        net.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [net]

        // Serial console
        try? FileManager.default.removeItem(atPath: consoleLogPath)
        FileManager.default.createFile(atPath: consoleLogPath, contents: nil)
        consoleFileHandle = try FileHandle(forWritingTo: URL(fileURLWithPath: consoleLogPath))

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

        try config.validate()
        return config
    }

    private func analyzeResults() {
        print("----------------------------------------")
        print("RESULTS for \(config.rawValue):")
        print("----------------------------------------")
        print("eth0 detected: \(hasEth0 ? "YES ✓" : "NO ✗")")
        print("virtio-net driver: \(hasVirtioNet ? "YES ✓" : "NO ✗")")

        // Read and display relevant console output
        if let content = try? String(contentsOfFile: consoleLogPath, encoding: .utf8) {
            print("\nRelevant console output:")
            print("------------------------")

            let lines = content.split(separator: "\n")
            var foundRelevant = false

            for line in lines {
                let lineStr = String(line)
                if lineStr.contains("virtio") || lineStr.contains("eth0") ||
                   lineStr.contains("Network") || lineStr.contains("ip link") ||
                   lineStr.contains("detecting") || lineStr.contains("Found interface") {
                    print(lineStr)
                    foundRelevant = true
                }
            }

            if !foundRelevant {
                print("No network-related messages found")
                print("\nLast 20 lines of output:")
                for line in lines.suffix(20) {
                    print(line)
                }
            }
        }

        print("\nFull log: \(consoleLogPath)")
        print("========================================\n")
    }
}

// Main execution
print("VibeCode Network Configuration Tester")
print("=====================================\n")

let args = CommandLine.arguments
if args.count > 1 {
    // Test specific configuration
    if let config = NetworkConfig(rawValue: args[1]) {
        let tester = VMTester(config: config)
        tester.runTest(timeout: 20)
    } else {
        print("Invalid configuration: \(args[1])")
        print("Valid options: \(NetworkConfig.allCases.map { $0.rawValue }.joined(separator: ", "))")
    }
} else {
    // Test all configurations
    for config in NetworkConfig.allCases {
        let tester = VMTester(config: config)
        tester.runTest(timeout: 20)
        sleep(2) // Brief pause between tests
    }
}

print("\n✓ Testing complete")
