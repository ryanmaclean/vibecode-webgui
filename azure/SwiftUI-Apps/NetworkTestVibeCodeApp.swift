import SwiftUI
import Virtualization

@main
struct NetworkTestVibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            NetworkTestContentView()
        }
    }
}

struct NetworkTestContentView: View {
    @StateObject private var vmManager = NetworkTestVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode Network Test")
                .font(.system(size: 36, weight: .bold))

            Text("Testing VZNATNetworkDeviceAttachment")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Configuration selector
            VStack(alignment: .leading, spacing: 10) {
                Text("Test Configuration:")
                    .font(.headline)

                ForEach(NetworkConfig.allCases, id: \.self) { config in
                    Button(action: {
                        vmManager.selectedConfig = config
                    }) {
                        HStack {
                            Image(systemName: vmManager.selectedConfig == config ? "checkmark.circle.fill" : "circle")
                            Text(config.rawValue)
                                .font(.system(.body, design: .monospaced))
                        }
                    }
                }
            }
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(8)

            // Status
            HStack {
                Circle()
                    .fill(vmManager.isRunning ? Color.green : Color.gray)
                    .frame(width: 12, height: 12)
                Text(vmManager.status)
                    .font(.system(.body, design: .monospaced))
            }

            // Console output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(height: 300)
            .background(Color.black.opacity(0.8))
            .foregroundColor(.green)
            .cornerRadius(8)

            // Controls
            HStack(spacing: 20) {
                Button(action: {
                    vmManager.startVM()
                }) {
                    Label("Start VM", systemImage: "play.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vmManager.isRunning)

                Button(action: {
                    vmManager.stopVM()
                }) {
                    Label("Stop VM", systemImage: "stop.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(!vmManager.isRunning)
            }

            Spacer()
        }
        .padding(40)
        .frame(minWidth: 700, minHeight: 700)
    }
}

enum NetworkConfig: String, CaseIterable {
    case basic = "Basic (console=hvc0)"
    case withVirtioNet = "With virtio_net (console=hvc0 virtio_net.napi_weight=64)"
    case verboseKernel = "Verbose Kernel (console=hvc0 debug loglevel=7)"
    case withMacAddress = "Custom MAC (console=hvc0 + MAC:52:54:00:12:34:56)"
    case allVirtio = "All Virtio Modules (console=hvc0 + explicit modules)"
    case ubuntuKernel = "Ubuntu Kernel (console=hvc0)"
}

class NetworkTestVMManager: ObservableObject {
    @Published var status = "Stopped"
    @Published var isRunning = false
    @Published var consoleOutput = ""
    @Published var selectedConfig: NetworkConfig = .basic

    private var vm: VZVirtualMachine?
    private var consoleFileHandle: FileHandle?
    private let consoleLogPath = URL(fileURLWithPath: "/tmp/vibecode-console.log")
    private var consoleTimer: Timer?

    func startVM() {
        guard !isRunning else { return }

        status = "Starting with \(selectedConfig.rawValue)..."
        consoleOutput = ""

        // Clear previous console log
        try? FileManager.default.removeItem(at: consoleLogPath)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            do {
                let config = try self.createVMConfiguration()

                DispatchQueue.main.async {
                    self.vm = VZVirtualMachine(configuration: config)
                    self.vm?.start { result in
                        switch result {
                        case .success:
                            self.onVMStarted()
                        case .failure(let error):
                            self.onVMError(error)
                        }
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.status = "Error: \(error.localizedDescription)"
                }
            }
        }
    }

    func stopVM() {
        guard isRunning else { return }

        status = "Stopping..."
        consoleTimer?.invalidate()
        consoleTimer = nil

        vm?.stop { _ in
            DispatchQueue.main.async {
                self.isRunning = false
                self.status = "Stopped"
                try? self.consoleFileHandle?.close()
            }
        }
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024 // 1GB

        // Kernel selection based on config
        let kernelPath: String
        if selectedConfig == .ubuntuKernel {
            kernelPath = "\(NSHomeDirectory())/.vfkit/vms/vibecode-alpine/kernel/vmlinux-ubuntu-uncompressed"
        } else {
            kernelPath = "\(NSHomeDirectory())/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw"
        }

        let kernel = URL(fileURLWithPath: kernelPath)
        let initrd = URL(fileURLWithPath: "\(NSHomeDirectory())/vibecode-webgui/azure/bun-openvscode.cpio.gz")

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd

        // Configure kernel command line based on selected config
        switch selectedConfig {
        case .basic:
            bootloader.commandLine = "console=hvc0"
        case .withVirtioNet:
            bootloader.commandLine = "console=hvc0 virtio_net.napi_weight=64"
        case .verboseKernel:
            bootloader.commandLine = "console=hvc0 debug loglevel=7 initcall_debug"
        case .withMacAddress, .allVirtio:
            bootloader.commandLine = "console=hvc0 debug loglevel=7"
        case .ubuntuKernel:
            bootloader.commandLine = "console=hvc0 debug loglevel=7"
        }

        config.bootLoader = bootloader

        // Network configuration
        let net = VZVirtioNetworkDeviceConfiguration()

        if selectedConfig == .withMacAddress {
            // Try setting a specific MAC address
            let macAddress = VZMACAddress(string: "52:54:00:12:34:56")!
            net.macAddress = macAddress
        }

        net.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [net]

        // Serial console for output
        FileManager.default.createFile(atPath: consoleLogPath.path, contents: nil)
        consoleFileHandle = try FileHandle(forWritingTo: consoleLogPath)

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

    private func onVMStarted() {
        DispatchQueue.main.async {
            self.isRunning = true
            self.status = "Running - Monitoring for network interfaces..."

            // Start monitoring console output
            self.consoleTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
                self.updateConsoleOutput()
            }
        }
    }

    private func onVMError(_ error: Error) {
        DispatchQueue.main.async {
            self.isRunning = false
            self.status = "Error: \(error.localizedDescription)"
        }
    }

    private func updateConsoleOutput() {
        guard let output = try? String(contentsOf: consoleLogPath, encoding: .utf8) else { return }

        DispatchQueue.main.async {
            self.consoleOutput = String(output.suffix(4000))

            // Look for network-related messages
            if output.contains("eth0") {
                self.status = "SUCCESS: eth0 detected!"
            } else if output.contains("virtio") && output.contains("net") {
                self.status = "Virtio-net driver detected"
            } else if output.contains("Network interfaces:") {
                self.status = "Init script running - checking interfaces..."
            }
        }
    }
}
