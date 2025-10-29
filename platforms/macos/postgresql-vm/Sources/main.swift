import Foundation
import Virtualization

@main
struct PostgreSQLVM {
    static func main() async throws {
        print("🐘 PostgreSQL VM - Native macOS Virtualization with pgvector")
        print("=" * 60)

        let manager = PostgreSQLVMManager()
        try await manager.start()
    }
}

class PostgreSQLVMManager: NSObject {
    private var virtualMachine: VZVirtualMachine?
    private let vmBasePath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".vfkit/vms/postgresql-vz")

    func start() async throws {
        print("📦 Initializing PostgreSQL VM configuration...")

        // Verify disks exist
        let rootDisk = vmBasePath.appendingPathComponent("disk/root.qcow2")
        let dataDisk = vmBasePath.appendingPathComponent("disk/data.qcow2")

        guard FileManager.default.fileExists(atPath: rootDisk.path) else {
            throw VMError.diskNotFound("Root disk not found at: \(rootDisk.path)")
        }

        guard FileManager.default.fileExists(atPath: dataDisk.path) else {
            throw VMError.diskNotFound("Data disk not found at: \(dataDisk.path)")
        }

        print("✅ Root disk: \(rootDisk.path)")
        print("✅ Data disk: \(dataDisk.path)")

        let configuration = try createVMConfiguration()

        print("✅ Configuration validated")
        print("🔧 Starting PostgreSQL virtual machine...")

        virtualMachine = VZVirtualMachine(configuration: configuration)
        virtualMachine?.delegate = self

        try await virtualMachine?.start()

        print("")
        print("=" * 60)
        print("✅ PostgreSQL VM started successfully")
        print("")
        print("📊 VM Configuration:")
        print("   CPU Cores: 4")
        print("   Memory: 8GB")
        print("   Root Disk: 20GB (QCOW2)")
        print("   Data Disk: 100GB (QCOW2)")
        print("")
        print("🔌 PostgreSQL Connection:")
        print("   Host: 127.0.0.1")
        print("   Port: 5432")
        print("   Database: vibecode")
        print("   User: vibecode")
        print("")
        print("🧩 Extensions:")
        print("   pgvector: Vector similarity search")
        print("")
        print("⌨️  Press Ctrl+C to stop")
        print("=" * 60)

        // Keep running
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            // Never resume - keeps running until interrupted
        }
    }

    func stop() async throws {
        print("🛑 Stopping PostgreSQL VM...")
        try await virtualMachine?.stop()
        print("✅ PostgreSQL VM stopped")
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU configuration (4 cores for vector operations)
        config.cpuCount = min(4, ProcessInfo.processInfo.processorCount)

        // Memory configuration (8GB for PostgreSQL + pgvector workloads)
        config.memorySize = 8 * 1024 * 1024 * 1024

        // Boot loader - Alpine Linux kernel
        let kernelPath = vmBasePath.appendingPathComponent("kernel/vmlinuz")
        let initrdPath = vmBasePath.appendingPathComponent("kernel/initramfs")

        guard FileManager.default.fileExists(atPath: kernelPath.path) else {
            throw VMError.kernelNotFound("Kernel not found at: \(kernelPath.path)")
        }

        guard FileManager.default.fileExists(atPath: initrdPath.path) else {
            throw VMError.initrdNotFound("Initramfs not found at: \(initrdPath.path)")
        }

        let bootloader = VZLinuxBootLoader(kernelURL: kernelPath)
        bootloader.initialRamdiskURL = initrdPath
        // Note: Using Lima's disk which expects /dev/vda
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader

        // Storage configuration - Two disks
        // Disk 1: Root disk (20GB) - from Lima PostgreSQL VM
        let rootDiskURL = vmBasePath.appendingPathComponent("disk/root.qcow2")
        let rootAttachment = try VZDiskImageStorageDeviceAttachment(
            url: rootDiskURL,
            readOnly: false
        )
        let rootDevice = VZVirtioBlockDeviceConfiguration(attachment: rootAttachment)

        // Disk 2: Data disk (100GB) - for PostgreSQL data directory
        let dataDiskURL = vmBasePath.appendingPathComponent("disk/data.qcow2")
        let dataAttachment = try VZDiskImageStorageDeviceAttachment(
            url: dataDiskURL,
            readOnly: false
        )
        let dataDevice = VZVirtioBlockDeviceConfiguration(attachment: dataAttachment)

        config.storageDevices = [rootDevice, dataDevice]

        // Network configuration (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Serial console for debugging
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let inputFileHandle = FileHandle.standardInput
        let outputFileHandle = FileHandle.standardOutput
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputFileHandle,
            fileHandleForWriting: outputFileHandle
        )
        config.serialPorts = [serialPort]

        // Entropy device for random number generation
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Graphics and input devices (for console interaction)
        let graphics = VZVirtioGraphicsDeviceConfiguration()
        graphics.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1920,
                heightInPixels: 1080
            )
        ]
        config.graphicsDevices = [graphics]

        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]

        try config.validate()

        return config
    }
}

extension PostgreSQLVMManager: VZVirtualMachineDelegate {
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("")
        print("⚠️  PostgreSQL VM stopped")
        exit(0)
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("")
        print("❌ PostgreSQL VM error: \(error.localizedDescription)")
        exit(1)
    }
}

enum VMError: Error {
    case diskNotFound(String)
    case kernelNotFound(String)
    case initrdNotFound(String)
}

// Helper for string multiplication
extension String {
    static func * (left: String, right: Int) -> String {
        String(repeating: left, count: right)
    }
}
