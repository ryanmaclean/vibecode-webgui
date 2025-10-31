import SwiftUI
import Virtualization
import Network

@main
struct VibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var vmManager = VsockVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode - Vsock Edition")
                .font(.system(size: 36, weight: .bold))

            Text("OpenVSCode Server via VirtIO Socket")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Status
            HStack {
                Circle()
                    .fill(vmManager.isRunning ? Color.green : Color.gray)
                    .frame(width: 12, height: 12)
                Text(vmManager.status)
                    .font(.system(.body, design: .monospaced))
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

            // Vsock Status
            Text("Vsock Status: \(vmManager.vsockStatus)")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.blue)

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
        .frame(minWidth: 600, minHeight: 550)
    }
}

// MARK: - Vsock VM Manager with VZVirtioSocketDevice

class VsockVMManager: NSObject, ObservableObject {
    @Published var status = "Stopped"
    @Published var isRunning = false
    @Published var consoleOutput = ""
    @Published var serverURL: String?
    @Published var vsockStatus = "Not initialized"

    private var vm: VZVirtualMachine?
    private var consoleFileHandle: FileHandle?
    private let consoleLogPath = URL(fileURLWithPath: "/tmp/vibecode-vsock-console.log")
    private var consoleTimer: Timer?

    // Vsock components
    private var vsockDevice: VZVirtioSocketDevice?
    private var vsockListener: VZVirtioSocketListener?
    private var proxyServer: VsockProxyServer?
    private let vmQueue = DispatchQueue(label: "com.vibecode.vmqueue")

    func startVM() {
        guard !isRunning else { return }

        status = "Starting..."
        consoleOutput = ""
        vsockStatus = "Initializing..."

        vmQueue.async { [weak self] in
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
                    self.vsockStatus = "Configuration failed"
                }
            }
        }
    }

    func stopVM() {
        guard isRunning else { return }

        status = "Stopping..."
        consoleTimer?.invalidate()
        consoleTimer = nil

        // Stop proxy server
        proxyServer?.stop()
        proxyServer = nil

        vm?.stop { _ in
            DispatchQueue.main.async {
                self.isRunning = false
                self.status = "Stopped"
                self.serverURL = nil
                self.vsockStatus = "Stopped"
                try? self.consoleFileHandle?.close()
            }
        }
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024 // 1GB

        // Linux bootloader with our optimized initramfs
        guard let kernel = Bundle.main.url(forResource: "vmlinux-raw", withExtension: nil) else {
            throw NSError(domain: "VMManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found in bundle"])
        }
        guard let initrd = Bundle.main.url(forResource: "bun-openvscode-vsock", withExtension: "cpio.gz") else {
            throw NSError(domain: "VMManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found in bundle"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd
        // Pass vsock info via kernel command line
        bootloader.commandLine = "console=hvc0 vsock=1"
        config.bootLoader = bootloader

        // VirtIO Socket Device Configuration - INSTEAD of NAT networking
        let socketConfig = VZVirtioSocketDeviceConfiguration()
        config.socketDevices = [socketConfig]

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
            self.vsockStatus = "VM started, setting up vsock..."

            // Start monitoring console output
            self.consoleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                self.updateConsoleOutput()
            }

            // Setup vsock listener on the VM queue
            self.vmQueue.async {
                self.setupVsockListener()
            }
        }
    }

    private func setupVsockListener() {
        guard let vm = vm else { return }

        // Get the socket device - must be done on vmQueue
        guard let devices = vm.socketDevices as? [VZVirtioSocketDevice],
              let device = devices.first else {
            DispatchQueue.main.async {
                self.vsockStatus = "Error: No socket device found"
            }
            return
        }

        self.vsockDevice = device

        do {
            // Listen on port 3000 for connections from the guest
            // The guest will connect to host port 3000 via vsock
            let listener = try device.setSocketListener(VZVirtioSocketListener(), forPort: 3000)
            self.vsockListener = listener

            DispatchQueue.main.async {
                self.vsockStatus = "Listening on vsock port 3000"

                // Start the proxy server that will forward localhost:3000 to vsock
                self.proxyServer = VsockProxyServer(device: device, vmQueue: self.vmQueue)
                self.proxyServer?.start { [weak self] success in
                    if success {
                        self?.serverURL = "http://localhost:3000"
                        self?.vsockStatus = "Proxy active on localhost:3000"
                    } else {
                        self?.vsockStatus = "Proxy failed to start"
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                self.vsockStatus = "Error setting up listener: \(error.localizedDescription)"
            }
        }
    }

    private func onVMError(_ error: Error) {
        DispatchQueue.main.async {
            self.isRunning = false
            self.status = "Error: \(error.localizedDescription)"
            self.vsockStatus = "VM error"
        }
    }

    private func updateConsoleOutput() {
        guard let output = try? String(contentsOf: consoleLogPath, encoding: .utf8) else { return }

        DispatchQueue.main.async {
            self.consoleOutput = String(output.suffix(2000))

            // Update status based on console output
            if output.contains("Server will be available") && self.status == "Running" {
                self.status = "Ready"
            }
        }
    }
}

// MARK: - Vsock Proxy Server

class VsockProxyServer {
    private let device: VZVirtioSocketDevice
    private let vmQueue: DispatchQueue
    private var listener: NWListener?
    private var activeConnections: [ProxyConnection] = []

    init(device: VZVirtioSocketDevice, vmQueue: DispatchQueue) {
        self.device = device
        self.vmQueue = vmQueue
    }

    func start(completion: @escaping (Bool) -> Void) {
        // Create TCP listener on localhost:3000
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true

        do {
            listener = try NWListener(using: parameters, on: 3000)

            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("Proxy server ready on localhost:3000")
                    completion(true)
                case .failed(let error):
                    print("Proxy server failed: \(error)")
                    completion(false)
                default:
                    break
                }
            }

            listener?.newConnectionHandler = { [weak self] connection in
                self?.handleNewConnection(connection)
            }

            listener?.start(queue: .main)
        } catch {
            print("Failed to create listener: \(error)")
            completion(false)
        }
    }

    private func handleNewConnection(_ tcpConnection: NWConnection) {
        print("New TCP connection from browser")

        // Connect to guest via vsock on vmQueue
        vmQueue.async { [weak self] in
            guard let self = self else { return }

            do {
                // Connect to guest's port 3000 via vsock
                let vsockConnection = try self.device.connect(toPort: 3000)

                let proxy = ProxyConnection(
                    tcpConnection: tcpConnection,
                    vsockConnection: vsockConnection
                )

                self.activeConnections.append(proxy)
                proxy.start()

                print("Established proxy connection")
            } catch {
                print("Failed to connect to guest via vsock: \(error)")
                tcpConnection.cancel()
            }
        }
    }

    func stop() {
        listener?.cancel()
        activeConnections.forEach { $0.stop() }
        activeConnections.removeAll()
    }
}

// MARK: - Proxy Connection Handler

class ProxyConnection {
    private let tcpConnection: NWConnection
    private let vsockConnection: VZVirtioSocketConnection

    init(tcpConnection: NWConnection, vsockConnection: VZVirtioSocketConnection) {
        self.tcpConnection = tcpConnection
        self.vsockConnection = vsockConnection
    }

    func start() {
        tcpConnection.start(queue: .global())

        // Forward TCP -> Vsock
        forwardTCPToVsock()

        // Forward Vsock -> TCP
        forwardVsockToTCP()
    }

    private func forwardTCPToVsock() {
        tcpConnection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }

            if let data = data, !data.isEmpty {
                // Write to vsock
                var bytesWritten = 0
                data.withUnsafeBytes { buffer in
                    if let baseAddress = buffer.baseAddress {
                        do {
                            bytesWritten = try self.vsockConnection.write(baseAddress, count: buffer.count)
                        } catch {
                            print("Error writing to vsock: \(error)")
                        }
                    }
                }
            }

            if !isComplete && error == nil {
                self.forwardTCPToVsock() // Continue receiving
            } else {
                self.stop()
            }
        }
    }

    private func forwardVsockToTCP() {
        DispatchQueue.global().async { [weak self] in
            guard let self = self else { return }

            var buffer = [UInt8](repeating: 0, count: 65536)

            while true {
                do {
                    let bytesRead = try self.vsockConnection.read(&buffer, count: buffer.count)

                    if bytesRead > 0 {
                        let data = Data(buffer[..<bytesRead])
                        self.tcpConnection.send(content: data, completion: .contentProcessed({ error in
                            if let error = error {
                                print("Error sending to TCP: \(error)")
                            }
                        }))
                    } else {
                        break // Connection closed
                    }
                } catch {
                    print("Error reading from vsock: \(error)")
                    break
                }
            }

            self.stop()
        }
    }

    func stop() {
        tcpConnection.cancel()
        try? vsockConnection.close()
    }
}
