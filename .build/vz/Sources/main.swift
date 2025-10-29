import Foundation
import Virtualization

class ValkeyVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let vmDirectory: URL
    private var consoleLog: FileHandle?

    var isRunning: Bool = false

    init(vmDirectory: URL? = nil) {
        let vmDir = vmDirectory ?? URL(fileURLWithPath: NSString(string: "~/.vfkit/vms/valkey-vz").expandingTildeInPath)
        self.vmDirectory = vmDir

        let logDir = vmDir.appendingPathComponent("logs")
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let logFile = logDir.appendingPathComponent("console.log")
        FileManager.default.createFile(atPath: logFile.path, contents: nil)
        self.consoleLog = try? FileHandle(forWritingTo: logFile)

        super.init()
    }

    deinit {
        try? consoleLog?.close()
    }

    func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        config.cpuCount = 2
        config.memorySize = 1 * 1024 * 1024 * 1024

        let kernelPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
        let initramfsPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath

        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(domain: "ValkeyVM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found"])
        }
        guard FileManager.default.fileExists(atPath: initramfsPath) else {
            throw NSError(domain: "ValkeyVM", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader

        let diskPath = vmDirectory.appendingPathComponent("disk/root.img").path
        guard FileManager.default.fileExists(atPath: diskPath) else {
            throw NSError(domain: "ValkeyVM", code: 3, userInfo: [NSLocalizedDescriptionKey: "Disk not found"])
        }

        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]

        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let outputPipe = Pipe()
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                if let line = String(data: data, encoding: .utf8) {
                    print(line, terminator: "")
                }
                try? self?.consoleLog?.write(contentsOf: data)
            }
        }

        let inputPipe = Pipe()
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        config.serialPorts = [serialPort]

        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        try config.validate()
        return config
    }

    func start() async throws {
        guard !isRunning else { return }

        print("Creating VM configuration...")
        let config = try createConfiguration()

        print("Creating virtual machine...")
        let vm = VZVirtualMachine(configuration: config)
        vm.delegate = self
        self.virtualMachine = vm

        print("Starting VM...")
        try await vm.start()

        isRunning = true
        print("✅ VM started successfully!")
    }

    func stop() async throws {
        guard let vm = virtualMachine, isRunning else { return }

        print("Stopping VM...")
        try await vm.stop()

        isRunning = false
        print("✅ VM stopped")
    }

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\n=== Guest OS shut down ===")
        isRunning = false
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\n=== VM stopped with error: \(error) ===")
        isRunning = false
    }
}

@main
struct ValkeyVMRunner {
    static func main() async {
        print("===========================================")
        print("Valkey VM - Virtualization Framework")
        print("===========================================")
        print("")

        let vm = ValkeyVM()

        do {
            try await vm.start()

            print("")
            print("VM is running! Console output above.")
            print("Log: ~/.vfkit/vms/valkey-vz/logs/console.log")
            print("")
            print("Press Ctrl+C to stop (or will auto-stop in 5 min)")
            print("")

            try await Task.sleep(for: .seconds(300))

            try await vm.stop()
            print("✅ Test complete")

        } catch {
            print("✗ Error: \(error)")
            exit(1)
        }
    }
}
