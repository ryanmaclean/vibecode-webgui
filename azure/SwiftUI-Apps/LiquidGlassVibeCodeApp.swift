import SwiftUI
import Virtualization

@main
struct VibeCodeApp: App {
    init() {
        // Initialize observability on app launch
        DatadogLogger.shared.info("VibeCode app launching", ["version": "1.0.0", "os": "macOS"])
        DogStatsDClient.shared.increment("app.launch", tags: ["version:1.0.0"])
        NSLog("✅ Observability initialized: Datadog + StatsD")
    }

    var body: some Scene {
        WindowGroup {
            LiquidGlassContentView()
        }
        .windowStyle(.hiddenTitleBar)
    }
}

struct LiquidGlassContentView: View {
    @StateObject private var vmManager = VMManager()
    @State private var isHoveringStart = false
    @State private var isHoveringStop = false

    var body: some View {
        ZStack {
            // Animated gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.2),
                    Color(red: 0.2, green: 0.1, blue: 0.3),
                    Color(red: 0.1, green: 0.2, blue: 0.3)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Glass card
            VStack(spacing: 0) {
                // Header
                VStack(spacing: 12) {
                    HStack {
                        // Logo/Icon area
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [.blue, .purple, .pink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 60, height: 60)
                            .overlay(
                                Image(systemName: "chevron.left.forwardslash.chevron.right")
                                    .foregroundColor(.white)
                                    .font(.system(size: 24, weight: .semibold))
                            )

                        VStack(alignment: .leading, spacing: 4) {
                            Text("VibeCode")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.white, .white.opacity(0.8)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )

                            Text("OpenVSCode Server")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                        }

                        Spacer()

                        // Status indicator
                        StatusPill(status: vmManager.status, isRunning: vmManager.isRunning)
                    }
                }
                .padding(30)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: [.white.opacity(0.3), .white.opacity(0.1)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1
                                )
                        )
                )

                // VM IP Address display
                if let vmIP = vmManager.vmIPAddress {
                    HStack(spacing: 12) {
                        Image(systemName: "network")
                            .font(.system(size: 18))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.green, .teal],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text("VM Network Address")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white.opacity(0.7))

                            Text(vmIP)
                                .font(.system(size: 14, weight: .medium, design: .monospaced))
                                .foregroundColor(.white.opacity(0.9))
                        }

                        Spacer()
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.green.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .padding(.top, 20)
                }

                // URL Card
                if let url = vmManager.serverURL {
                    URLCard(url: url)
                        .padding(.top, 20)
                }

                // Console
                ConsoleView(output: vmManager.consoleOutput)
                    .padding(.top, 20)

                // Controls
                HStack(spacing: 16) {
                    GlassButton(
                        title: "Start VM",
                        icon: "play.fill",
                        gradient: [.green, .blue],
                        isEnabled: !vmManager.isRunning,
                        isHovering: $isHoveringStart
                    ) {
                        vmManager.startVM()
                    }

                    GlassButton(
                        title: "Stop VM",
                        icon: "stop.fill",
                        gradient: [.red, .orange],
                        isEnabled: vmManager.isRunning,
                        isHovering: $isHoveringStop
                    ) {
                        vmManager.stopVM()
                    }
                }
                .padding(.top, 24)
            }
            .padding(40)
        }
        .frame(minWidth: 700, minHeight: 650)
    }
}

struct StatusPill: View {
    let status: String
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isRunning ? Color.green : Color.gray)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .fill(isRunning ? Color.green : Color.clear)
                        .blur(radius: 4)
                        .scaleEffect(1.5)
                )

            Text(status)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay(
                    Capsule()
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

struct URLCard: View {
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 12) {
                Image(systemName: "link.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text(url)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.9))

                Spacer()

                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.5))
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [.blue.opacity(0.5), .cyan.opacity(0.3)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

struct ConsoleView: View {
    let output: String

    var body: some View {
        ScrollView {
            Text(output)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.green.opacity(0.9))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
        }
        .frame(height: 200)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.black.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.green.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

struct GlassButton: View {
    let title: String
    let icon: String
    let gradient: [Color]
    let isEnabled: Bool
    @Binding var isHovering: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(title)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        isEnabled
                            ? LinearGradient(
                                colors: isHovering ? gradient.map { $0.opacity(0.8) } : gradient.map { $0.opacity(0.6) },
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            : LinearGradient(
                                colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                isEnabled
                                    ? LinearGradient(
                                        colors: [.white.opacity(0.3), .white.opacity(0.1)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                    : LinearGradient(
                                        colors: [.white.opacity(0.1), .white.opacity(0.05)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                lineWidth: 1
                            )
                    )
                    .shadow(color: isHovering && isEnabled ? gradient[0].opacity(0.5) : .clear, radius: 20, x: 0, y: 10)
            )
            .scaleEffect(isHovering && isEnabled ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isHovering = hovering
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovering)
    }
}

// Same VMManager class as before
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

    init() {
        // Initialize observability for VMManager
        DatadogLogger.shared.info("VMManager initialized", ["component": "VMManager", "mac_address": vmMACAddress])
        DogStatsDClient.shared.increment("vm.manager.init", tags: ["component:vm_manager"])

        // Auto-start VM when manager is created
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.startVM()
        }
    }

    func startVM() {
        guard !isRunning else { return }

        // Track VM start with observability
        let startTime = Date()
        let traceId = UUID().uuidString

        DatadogLogger.shared.info("VM start requested", [
            "trace_id": traceId,
            "status": status,
            "is_running": "\(isRunning)",
            "mac_address": vmMACAddress
        ])
        DogStatsDClient.shared.increment("vm.start.attempt", tags: [
            "trace_id:\(traceId)",
            "mac:\(vmMACAddress)"
        ])

        let debugLog = URL(fileURLWithPath: "/tmp/vibecode-debug.log")
        let logMsg = "[\(Date())] Starting VM...\n"
        try? logMsg.data(using: .utf8)?.write(to: debugLog, options: .atomic)
        NSLog("VibeCode: Starting VM")
        print("VibeCode: Starting VM")

        status = "Starting..."
        consoleOutput = ""

        DatadogLogger.shared.info("VM status changed", ["status": "Starting...", "trace_id": traceId])
        DogStatsDClient.shared.increment("vm.status.change", tags: ["status:starting", "trace_id:\(traceId)"])

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            do {
                let debugLog = URL(fileURLWithPath: "/tmp/vibecode-debug.log")
                let logMsg = "[\(Date())] Creating VM configuration...\n"
                try? FileManager.default.createFile(atPath: debugLog.path, contents: nil)
                if let handle = try? FileHandle(forWritingTo: debugLog) {
                    try? handle.seekToEnd()
                    try? handle.write(contentsOf: logMsg.data(using: .utf8)!)
                    try? handle.close()
                }

                let config = try self.createVMConfiguration()

                let successMsg = "[\(Date())] VM configuration created successfully\n"
                if let handle = try? FileHandle(forWritingTo: debugLog) {
                    try? handle.seekToEnd()
                    try? handle.write(contentsOf: successMsg.data(using: .utf8)!)
                    try? handle.close()
                }
                NSLog("VibeCode: VM configuration created")
                print("VibeCode: VM configuration created")

                DispatchQueue.main.async {
                    self.vm = VZVirtualMachine(configuration: config)
                    let startMsg = "[\(Date())] Starting VZVirtualMachine...\n"
                    if let handle = try? FileHandle(forWritingTo: debugLog) {
                        try? handle.seekToEnd()
                        try? handle.write(contentsOf: startMsg.data(using: .utf8)!)
                        try? handle.close()
                    }
                    NSLog("VibeCode: Calling vm.start()")
                    print("VibeCode: Calling vm.start()")

                    self.vm?.start { result in
                        let duration = Date().timeIntervalSince(startTime)

                        switch result {
                        case .success:
                            let successMsg = "[\(Date())] VM started successfully!\n"
                            if let handle = try? FileHandle(forWritingTo: debugLog) {
                                try? handle.seekToEnd()
                                try? handle.write(contentsOf: successMsg.data(using: .utf8)!)
                                try? handle.close()
                            }
                            NSLog("VibeCode: VM started successfully")
                            print("VibeCode: VM started successfully")

                            // Track success metrics
                            DatadogLogger.shared.info("VM start completed", [
                                "trace_id": traceId,
                                "duration_seconds": duration,
                                "duration_ms": Int(duration * 1000),
                                "result": "success"
                            ])
                            DogStatsDClient.shared.increment("vm.start.success", tags: ["trace_id:\(traceId)"])
                            DogStatsDClient.shared.timing("vm.start.duration",
                                milliseconds: Int(duration * 1000),
                                tags: ["result:success", "trace_id:\(traceId)"])
                            DogStatsDClient.shared.event("VM Started",
                                text: "VM started successfully in \(String(format: "%.2f", duration))s",
                                alertType: "success",
                                tags: ["trace_id:\(traceId)", "mac:\(self.vmMACAddress)"])

                            self.onVMStarted()
                        case .failure(let error):
                            let errorMsg = "[\(Date())] VM start FAILED: \(error.localizedDescription)\n"
                            if let handle = try? FileHandle(forWritingTo: debugLog) {
                                try? handle.seekToEnd()
                                try? handle.write(contentsOf: errorMsg.data(using: .utf8)!)
                                try? handle.close()
                            }
                            NSLog("VibeCode: VM start failed: %@", error.localizedDescription)
                            print("VibeCode: VM start failed: \(error.localizedDescription)")

                            // Track failure metrics
                            DatadogLogger.shared.error("VM start failed", [
                                "trace_id": traceId,
                                "duration_seconds": duration,
                                "result": "failure",
                                "error_type": String(describing: type(of: error)),
                                "error_message": error.localizedDescription
                            ])
                            DogStatsDClient.shared.increment("vm.start.failure", tags: [
                                "trace_id:\(traceId)",
                                "error:\(String(describing: type(of: error)))"
                            ])
                            DogStatsDClient.shared.event("VM Start Failed",
                                text: "VM failed to start: \(error.localizedDescription)",
                                alertType: "error",
                                tags: ["trace_id:\(traceId)", "mac:\(self.vmMACAddress)"])

                            self.onVMError(error)
                        }
                    }
                }
            } catch {
                let errorMsg = "[\(Date())] Configuration ERROR: \(error.localizedDescription)\n"
                if let handle = try? FileHandle(forWritingTo: debugLog) {
                    try? handle.seekToEnd()
                    try? handle.write(contentsOf: errorMsg.data(using: .utf8)!)
                    try? handle.close()
                }
                NSLog("VibeCode: Configuration error: %@", error.localizedDescription)
                print("VibeCode: Configuration error: \(error.localizedDescription)")

                DispatchQueue.main.async {
                    self.status = "Error: \(error.localizedDescription)"
                }
            }
        }
    }

    func stopVM() {
        guard isRunning else { return }

        let stopTime = Date()
        let traceId = UUID().uuidString

        DatadogLogger.shared.info("VM stop requested", [
            "trace_id": traceId,
            "status": status,
            "mac_address": vmMACAddress
        ])
        DogStatsDClient.shared.increment("vm.stop.attempt", tags: ["trace_id:\(traceId)"])

        status = "Stopping..."
        consoleTimer?.invalidate()
        consoleTimer = nil
        dhcpMonitorTimer?.invalidate()
        dhcpMonitorTimer = nil

        vm?.stop { _ in
            let duration = Date().timeIntervalSince(stopTime)

            DispatchQueue.main.async {
                self.isRunning = false
                self.status = "Stopped"
                self.serverURL = nil
                self.vmIPAddress = nil
                try? self.consoleFileHandle?.close()

                // Track stop metrics
                DatadogLogger.shared.info("VM stopped", [
                    "trace_id": traceId,
                    "duration_seconds": duration,
                    "duration_ms": Int(duration * 1000)
                ])
                DogStatsDClient.shared.increment("vm.stop.success", tags: ["trace_id:\(traceId)"])
                DogStatsDClient.shared.timing("vm.stop.duration",
                    milliseconds: Int(duration * 1000),
                    tags: ["trace_id:\(traceId)"])
                DogStatsDClient.shared.event("VM Stopped",
                    text: "VM stopped successfully",
                    alertType: "info",
                    tags: ["trace_id:\(traceId)", "mac:\(self.vmMACAddress)"])
            }
        }
    }

    private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = 2
        config.memorySize = 1024 * 1024 * 1024

        // Use bundled resources
        guard let kernel = Bundle.main.url(forResource: "vmlinux-raw", withExtension: nil) else {
            throw NSError(domain: "VMManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found in bundle"])
        }
        guard let initrd = Bundle.main.url(forResource: "bun-openvscode", withExtension: "cpio.gz") else {
            throw NSError(domain: "VMManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found in bundle"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd
        bootloader.commandLine = "console=hvc0"
        config.bootLoader = bootloader

        let net = VZVirtioNetworkDeviceConfiguration()
        // Set specific MAC address for DHCP lease identification
        let macAddress = VZMACAddress(string: vmMACAddress)!
        net.macAddress = macAddress
        net.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [net]

        FileManager.default.createFile(atPath: consoleLogPath.path, contents: nil)
        consoleFileHandle = try FileHandle(forWritingTo: consoleLogPath)

        let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
        serial.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: nil,
            fileHandleForWriting: consoleFileHandle
        )
        config.serialPorts = [serial]

        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

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

            // Track DHCP errors
            if output.contains("udhcpc: no lease, failing") {
                DatadogLogger.shared.warning("DHCP failed in VM", [
                    "mac_address": self.vmMACAddress,
                    "error": "udhcpc: no lease, failing",
                    "regression": "true",
                    "component": "networking"
                ])
                DogStatsDClient.shared.increment("vm.dhcp.failure", tags: [
                    "mac:\(self.vmMACAddress)",
                    "regression:true"
                ])
            }

            // Extract full URL with token from "Web UI available at http://..."
            if self.serverURL == nil, let range = output.range(of: "Web UI available at ") {
                let afterPrefix = output[range.upperBound...]
                if let urlEnd = afterPrefix.firstIndex(where: { $0.isWhitespace || $0.isNewline }) {
                    let urlString = String(afterPrefix[..<urlEnd])
                    // Replace localhost with actual VM IP if available
                    if let vmIP = self.vmIPAddress {
                        self.serverURL = urlString.replacingOccurrences(of: "localhost", with: vmIP)
                    } else {
                        self.serverURL = urlString
                    }
                    self.status = "Ready"

                    // Track server ready
                    DatadogLogger.shared.info("OpenVSCode server ready", [
                        "url": urlString,
                        "vm_ip": self.vmIPAddress ?? "none",
                        "mac_address": self.vmMACAddress
                    ])
                    DogStatsDClient.shared.increment("vm.server.ready", tags: ["mac:\(self.vmMACAddress)"])
                }
            }
        }
    }
}
