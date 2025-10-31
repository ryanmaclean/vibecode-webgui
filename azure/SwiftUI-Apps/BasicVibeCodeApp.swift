import SwiftUI
import Virtualization

@main
struct VibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var vmManager = VMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode")
                .font(.system(size: 36, weight: .bold))

            Text("OpenVSCode Server on Alpine Linux")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Status
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(vmManager.isRunning ? Color.green : Color.gray)
                        .frame(width: 12, height: 12)
                    Text(vmManager.status)
                        .font(.system(.body, design: .monospaced))
                }

                // VM IP Address if detected
                if let vmIP = vmManager.vmIPAddress {
                    HStack(spacing: 8) {
                        Image(systemName: "network")
                            .foregroundColor(.blue)
                        Text("VM IP: \(vmIP)")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }
            }

            // URL if available
            if let url = vmManager.serverURL {
                Link(destination: URL(string: url)!) {
                    HStack {
                        Image(systemName: "link")
                        Text(url)
                    }
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
                }
            }

            // Console output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(height: 200)
            .background(Color.black.opacity(0.8))
            .foregroundColor(.green)
            .cornerRadius(8)

            // Controls
            HStack(spacing: 20) {
                Button(action: {
                    vmManager.startVM()
                }) {
                    Label("Start", systemImage: "play.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vmManager.isRunning)

                Button(action: {
                    vmManager.stopVM()
                }) {
                    Label("Stop", systemImage: "stop.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(!vmManager.isRunning)
            }

            Spacer()
        }
        .padding(40)
        .frame(minWidth: 600, minHeight: 500)
    }
}

class VMManager: ObservableObject {
    @Published var status = "Stopped"
    @Published var isRunning = false
    @Published var consoleOutput = ""
    @Published var serverURL: String?
    @Published var vmIPAddress: String?

    private var vm: VZVirtualMachine?
    private var consoleFileHandle: FileHandle?
    private let consoleLogPath = URL(fileURLWithPath: "/tmp/vibecode-console.log")
    private var consoleTimer: Timer?
    private var dhcpMonitorTimer: Timer?
    private let vmMACAddress = "52:54:00:12:34:90"

    func startVM() {
        guard !isRunning else { return }

        status = "Starting..."
        consoleOutput = ""

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
        dhcpMonitorTimer?.invalidate()
        dhcpMonitorTimer = nil

        vm?.stop { _ in
            DispatchQueue.main.async {
                self.isRunning = false
                self.status = "Stopped"
                self.serverURL = nil
                self.vmIPAddress = nil
                try? self.consoleFileHandle?.close()
            }
        }
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024 // 1GB

        // Linux bootloader with our optimized initramfs - use bundled resources
        guard let kernel = Bundle.main.url(forResource: "vmlinux-raw", withExtension: nil) else {
            throw NSError(domain: "VMManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found in bundle"])
        }
        guard let initrd = Bundle.main.url(forResource: "bun-openvscode", withExtension: "cpio.gz") else {
            throw NSError(domain: "VMManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found in bundle"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd
        bootloader.commandLine = "console=hvc0 debug loglevel=8"
        config.bootLoader = bootloader

        // Network
        let net = VZVirtioNetworkDeviceConfiguration()
        // Set specific MAC address for DHCP lease identification
        let macAddress = VZMACAddress(string: vmMACAddress)!
        net.macAddress = macAddress
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
            self.status = "Running"

            // Start monitoring console output
            self.consoleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                self.updateConsoleOutput()
            }

            // Start monitoring DHCP leases for VM IP address
            self.dhcpMonitorTimer = DHCPLeaseParser.startMonitoring(
                macAddress: self.vmMACAddress,
                interval: 1.0,
                onIPFound: { ip in
                    DispatchQueue.main.async {
                        self.vmIPAddress = ip
                        print("VM IP Address detected: \(ip)")
                    }
                },
                onNotFound: {
                    DispatchQueue.main.async {
                        self.vmIPAddress = nil
                    }
                }
            )
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
            self.consoleOutput = String(output.suffix(2000))

            // Check if OpenVSCode server is ready
            if output.contains("Server will be available") && self.serverURL == nil {
                // Use actual VM IP if available, otherwise fallback to localhost
                if let vmIP = self.vmIPAddress {
                    self.serverURL = "http://\(vmIP):3000"
                } else {
                    self.serverURL = "http://localhost:3000"
                }
                self.status = "Ready"
            }
        }
    }
}
