//
// BaseVMManager.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Abstract base class for all VM managers, providing common lifecycle management
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization
import Combine

/// Abstract base class for all VM managers in VibeCode applications.
///
/// BaseVMManager provides common VM lifecycle management including:
/// - VM creation and configuration
/// - Start/stop lifecycle with proper error handling
/// - Console output monitoring and parsing
/// - Network configuration via pluggable strategies
/// - DHCP lease monitoring for IP detection
/// - Server readiness detection
///
/// ## Usage
///
/// Subclass BaseVMManager and override template methods to customize behavior:
///
/// ```swift
/// final class MyVMManager: BaseVMManager {
///     override func getKernelCommandLine() -> String {
///         return "console=hvc0 debug loglevel=8 custom=value"
///     }
///
///     override func createNetworkingStrategy() -> NetworkingStrategy {
///         return NATNetworkStrategy()
///     }
///
///     override func onVMStarted() {
///         super.onVMStarted()
///         // Custom startup logic
///     }
/// }
/// ```
///
/// ## Template Method Pattern
///
/// This class uses the Template Method pattern:
/// - Defines the skeleton of VM lifecycle operations
/// - Subclasses override specific steps to customize behavior
/// - Ensures consistent lifecycle management across all VM apps
///
/// ## Observable Pattern
///
/// BaseVMManager is an ObservableObject with @Published properties:
/// - SwiftUI views automatically update when state changes
/// - Use @StateObject to hold the manager in your view
///
/// ```swift
/// struct MyView: View {
///     @StateObject private var vmManager = MyVMManager()
///
///     var body: some View {
///         Text(vmManager.status)
///     }
/// }
/// ```
///
open class BaseVMManager: NSObject, ObservableObject {

    // MARK: - Published Properties

    /// Current VM status: "Stopped", "Starting...", "Running", "Ready", "Stopping...", "Error: ..."
    @Published public var status: String = "Stopped"

    /// True when VM is running (between successful start and stop)
    @Published public var isRunning: Bool = false

    /// Latest console output (tail of log file, approximately last 2000 characters)
    @Published public var consoleOutput: String = ""

    /// Server URL when service is ready (e.g., "http://192.168.64.5:3000")
    /// Nil until server ready pattern detected in console output
    @Published public var serverURL: String? = nil

    /// VM IP address detected via DHCP lease monitoring
    /// Nil until DHCP lease is found for VM's MAC address
    @Published public var vmIPAddress: String? = nil

    // MARK: - Internal Properties

    /// The VZVirtualMachine instance (nil when not running)
    /// Exposed as public with internal setter for networking strategies to access socket devices
    public internal(set) var vm: VZVirtualMachine?

    /// File handle for writing console output
    private var consoleFileHandle: FileHandle?

    /// Path to console log file
    private let consoleLogPath: URL

    /// Timer for polling console output
    private var consoleTimer: Timer?

    // DHCP monitor instance for IP detection
    private var dhcpMonitor: DHCPLeaseMonitor?

    /// Networking strategy for this VM (created via template method)
    private var networkingStrategy: NetworkingStrategy?

    /// Unique identifier for this VM instance
    private let vmID: String

    /// PTY manager for interactive terminal sessions
    private var ptyManager: PTYManager?

    /// Flag indicating if PTY mode is enabled
    private var isPTYEnabled: Bool = false

    // MARK: - Initialization

    /// Initialize a new BaseVMManager.
    ///
    /// Creates unique identifiers and paths for this VM instance.
    /// Subclasses should call super.init() and not override unless necessary.
    public override init() {
        self.vmID = UUID().uuidString
        self.consoleLogPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("vibecode-console-\(self.vmID).log")
        super.init()
    }

    deinit {
        // Cleanup timers and resources
        consoleTimer?.invalidate()
        dhcpMonitor?.stopMonitoring()
        _ = try? consoleFileHandle?.close()
        ptyManager?.closePTY()
    }

    // MARK: - Public Lifecycle Methods

    /// Start the VM.
    ///
    /// This method:
    /// 1. Creates VM configuration via template methods
    /// 2. Creates VZVirtualMachine instance
    /// 3. Starts the VM asynchronously
    /// 4. Sets up console and network monitoring on success
    ///
    /// Safe to call multiple times (ignores if already running).
    /// Updates `status` and `isRunning` properties.
    public func startVM() {
        guard !isRunning else {
            VMLogger.warning("VM already running, ignoring start request", metadata: ["vm_id": vmID])
            return
        }

        VMLogger.info("Starting VM", metadata: ["vm_id": vmID])
        status = "Starting..."
        consoleOutput = ""

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            do {
                VMLogger.debug("Creating networking strategy", metadata: ["vm_id": self.vmID])
                // Create networking strategy first (needed for configuration)
                let strategy = self.createNetworkingStrategy()
                VMLogger.debug("Networking strategy created", metadata: [
                    "vm_id": self.vmID,
                    "strategy_type": String(describing: type(of: strategy)),
                    "mac_address": strategy.getMACAddress()
                ])

                VMLogger.debug("Creating VM configuration", metadata: ["vm_id": self.vmID])
                // Create VM configuration using template methods
                let config = try self.createVMConfiguration(networkingStrategy: strategy)
                VMLogger.debug("VM configuration created successfully", metadata: [
                    "vm_id": self.vmID,
                    "cpu_count": config.cpuCount,
                    "memory_gb": Double(config.memorySize) / (1024.0 * 1024.0 * 1024.0)
                ])

                DispatchQueue.main.async {
                    VMLogger.debug("Creating VZVirtualMachine instance", metadata: ["vm_id": self.vmID])
                    // Create VM instance
                    self.vm = VZVirtualMachine(configuration: config)
                    self.networkingStrategy = strategy

                    VMLogger.info("Starting VZVirtualMachine", metadata: ["vm_id": self.vmID])
                    // Start VM
                    self.vm?.start { result in
                        switch result {
                        case .success:
                            VMLogger.info("VZVirtualMachine started successfully", metadata: ["vm_id": self.vmID])
                            self.handleVMStartSuccess()
                        case .failure(let error):
                            VMLogger.logError(error, context: "VZVirtualMachine start failed", metadata: ["vm_id": self.vmID])
                            self.handleVMStartFailure(error)
                        }
                    }
                }
            } catch {
                VMLogger.logError(error, context: "VM configuration failed", metadata: ["vm_id": self.vmID])
                DispatchQueue.main.async {
                    self.handleVMConfigurationError(error)
                }
            }
        }
    }

    /// Stop the VM.
    ///
    /// This method:
    /// 1. Stops monitoring (console, DHCP)
    /// 2. Requests VM stop
    /// 3. Cleans up resources
    ///
    /// Safe to call multiple times (ignores if not running).
    /// Updates `status` and `isRunning` properties.
    public func stopVM() {
        guard isRunning else {
            VMLogger.warning("VM not running, ignoring stop request", metadata: ["vm_id": vmID])
            return
        }

        VMLogger.info("Stopping VM", metadata: ["vm_id": vmID])
        status = "Stopping..."

        // Stop monitoring
        stopMonitoring()

        // Stop VM
        vm?.stop { [weak self] error in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if let error = error {
                    VMLogger.logError(error, context: "VM stop failed", metadata: ["vm_id": self.vmID])
                    self.status = "Error stopping: \(error.localizedDescription)"
                } else {
                    VMLogger.info("VM stopped successfully", metadata: ["vm_id": self.vmID])
                    self.isRunning = false
                    self.status = "Stopped"
                    self.serverURL = nil
                    self.vmIPAddress = nil
                }

                // Cleanup
                _ = try? self.consoleFileHandle?.close()
                self.consoleFileHandle = nil
                self.networkingStrategy?.teardown()
                self.networkingStrategy = nil
                self.ptyManager?.closePTY()
                self.ptyManager = nil

                // Call hook
                self.onVMStopped()
            }
        }
    }

    /// Get the PTY slave device path if PTY is enabled.
    ///
    /// Use this path to connect to the VM console with terminal tools.
    ///
    /// Example:
    /// ```swift
    /// if let ptyPath = vmManager.getPTYPath() {
    ///     print("Connect to VM: screen \(ptyPath)")
    /// }
    /// ```
    ///
    /// - Returns: PTY device path (e.g., "/dev/ttys001") or nil if PTY not enabled
    public func getPTYPath() -> String? {
        return ptyManager?.getSlavePath()
    }

    // MARK: - Template Methods (Configuration)

    /// Get the number of CPUs for the VM.
    ///
    /// Default: 2 CPUs
    ///
    /// Override to customize:
    /// ```swift
    /// override func getCPUCount() -> Int {
    ///     return 4
    /// }
    /// ```
    open func getCPUCount() -> Int {
        return 2
    }

    /// Get the memory size in bytes for the VM.
    ///
    /// Default: 1 GB (1024 * 1024 * 1024 bytes)
    ///
    /// Override to customize:
    /// ```swift
    /// override func getMemorySize() -> UInt64 {
    ///     return 2 * 1024 * 1024 * 1024  // 2GB
    /// }
    /// ```
    open func getMemorySize() -> UInt64 {
        return 1024 * 1024 * 1024  // 1GB
    }

    /// Get the kernel resource name in the app bundle.
    ///
    /// Default: "vmlinux-raw"
    ///
    /// The kernel file should be in the app bundle root with this exact name.
    /// Override if you have a different kernel file name.
    open func getKernelResource() -> String {
        return "vmlinux-raw"
    }

    /// Get the initramfs resource name (without .cpio.gz extension) in the app bundle.
    ///
    /// Default: "bun-openvscode"
    ///
    /// The initramfs file should be named "{resource}.cpio.gz" in the app bundle.
    /// Override to use a different initramfs:
    /// ```swift
    /// override func getInitramfsResource() -> String {
    ///     return "custom-initramfs"  // looks for custom-initramfs.cpio.gz
    /// }
    /// ```
    open func getInitramfsResource() -> String {
        return "bun-openvscode"
    }

    /// Get the kernel command line parameters.
    ///
    /// Default: "console=hvc0 debug loglevel=8 ipv6.disable=1"
    ///
    /// Override to customize:
    /// ```swift
    /// override func getKernelCommandLine() -> String {
    ///     return "console=hvc0 debug loglevel=8 custom_param=value"
    /// }
    /// ```
    ///
    /// Common parameters:
    /// - `console=hvc0`: Enable serial console output
    /// - `debug loglevel=8`: Verbose kernel logging
    /// - `ipv6.disable=1`: Force IPv4-only (better DHCP reliability)
    /// - `DD_API_KEY=...`: Datadog API key (optional, for observability)
    /// - `DD_SITE=...`: Datadog site region (optional, default: datadoghq.com)
    open func getKernelCommandLine() -> String {
        var cmdline = "console=hvc0 debug loglevel=8 ipv6.disable=1"

        // Add Datadog configuration if available
        if let ddAPIKey = getDatadogAPIKey(), !ddAPIKey.isEmpty {
            cmdline += " DD_API_KEY=\(ddAPIKey)"
        }

        if let ddSite = getDatadogSite(), !ddSite.isEmpty {
            cmdline += " DD_SITE=\(ddSite)"
        }

        return cmdline
    }

    /// Create the networking strategy for this VM.
    ///
    /// Default: NATNetworkStrategy with random MAC address
    ///
    /// Override to use different networking:
    /// ```swift
    /// override func createNetworkingStrategy() -> NetworkingStrategy {
    ///     return VsockNetworkStrategy()
    /// }
    /// ```
    ///
    /// - Returns: A NetworkingStrategy instance
    open func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy()
    }

    /// Enable PTY (pseudo-terminal) for interactive console access.
    ///
    /// Default: false (uses file-based logging only)
    ///
    /// Override to enable interactive terminal:
    /// ```swift
    /// override func enablePTY() -> Bool {
    ///     return true
    /// }
    /// ```
    ///
    /// When enabled, the VM console is attached to a PTY instead of a log file,
    /// enabling bidirectional terminal access. Use `connect-vm-terminal.sh` to
    /// connect to the VM console.
    ///
    /// - Returns: true to enable PTY, false for file-based logging
    open func enablePTY() -> Bool {
        return false
    }

    // MARK: - Template Methods (Lifecycle Hooks)

    /// Called when VM successfully starts.
    ///
    /// Default implementation:
    /// - Updates status to "Running"
    /// - Starts console monitoring
    /// - Starts DHCP monitoring
    /// - Sets up networking connectivity
    ///
    /// Override to add custom behavior (always call super first):
    /// ```swift
    /// override func onVMStarted() {
    ///     super.onVMStarted()
    ///     // Custom startup logic
    ///     print("My custom VM started!")
    /// }
    /// ```
    open func onVMStarted() {
        VMLogger.info("VM started successfully", metadata: ["vm_id": vmID])
        isRunning = true
        status = "Running"

        // Start console monitoring
        startConsoleMonitoring()

        // Start DHCP monitoring
        startDHCPMonitoring()

        // Setup networking connectivity (proxies, port forwarding, etc.)
        networkingStrategy?.setupConnectivity(self)
    }

    /// Called when VM stops (either requested or crashed).
    ///
    /// Default implementation: No-op (status already updated in stopVM())
    ///
    /// Override to add custom cleanup:
    /// ```swift
    /// override func onVMStopped() {
    ///     super.onVMStopped()
    ///     // Custom cleanup
    /// }
    /// ```
    open func onVMStopped() {
        VMLogger.info("VM stopped", metadata: ["vm_id": vmID])
    }

    /// Called when VM encounters an error.
    ///
    /// Default implementation: Updates status with error message
    ///
    /// Override to add custom error handling (always call super first):
    /// ```swift
    /// override func onVMError(_ error: Error) {
    ///     super.onVMError(error)
    ///     // Custom error handling
    ///     logErrorToExternalService(error)
    /// }
    /// ```
    open func onVMError(_ error: Error) {
        VMLogger.logError(error, context: "VM error occurred", metadata: ["vm_id": vmID])
        isRunning = false
        status = "Error: \(error.localizedDescription)"
    }

    /// Called when server becomes ready (detected from console output).
    ///
    /// Default implementation: Updates status to "Ready"
    ///
    /// Override to add custom behavior (always call super first):
    /// ```swift
    /// override func onServerReady(url: String) {
    ///     super.onServerReady(url: url)
    ///     // Open browser automatically
    ///     NSWorkspace.shared.open(URL(string: url)!)
    /// }
    /// ```
    ///
    /// - Parameter url: The server URL (e.g., "http://192.168.64.5:3000")
    open func onServerReady(url: String) {
        VMLogger.info("Server ready", metadata: ["vm_id": vmID, "server_url": url])
        status = "Ready"
    }

    /// Called when VM IP address is detected via DHCP.
    ///
    /// Default implementation: Logs the IP address
    ///
    /// Override to add custom behavior:
    /// ```swift
    /// override func onIPAddressDetected(ip: String) {
    ///     super.onIPAddressDetected(ip: ip)
    ///     // Update DNS record
    ///     updateDNS(ip)
    /// }
    /// ```
    ///
    /// - Parameter ip: The detected IP address (e.g., "192.168.64.5")
    open func onIPAddressDetected(ip: String) {
        VMLogger.info("IP address detected", metadata: ["vm_id": vmID, "ip_address": ip])
    }

    /// Check if server is ready from console output.
    ///
    /// Default implementation: Checks for "Server will be available" and constructs URL
    ///
    /// Override to customize server detection:
    /// ```swift
    /// override func checkServerReady(consoleOutput: String) -> String? {
    ///     if consoleOutput.contains("My custom ready message") {
    ///         if let ip = vmIPAddress {
    ///             return "http://\(ip):8080"
    ///         }
    ///     }
    ///     return nil
    /// }
    /// ```
    ///
    /// - Parameter consoleOutput: Current console output text
    /// - Returns: Server URL if ready, nil otherwise
    open func checkServerReady(consoleOutput: String) -> String? {
        guard consoleOutput.contains("Server will be available") else {
            return nil
        }

        // Use actual VM IP if available, otherwise fallback to localhost
        if let vmIP = vmIPAddress {
            return "http://\(vmIP):3000"
        } else {
            return "http://localhost:3000"
        }
    }

    // MARK: - Datadog API Key Management

    /// Get Datadog API key from environment or local file.
    ///
    /// Attempts to retrieve Datadog API key from multiple sources in order:
    /// 1. DD_API_KEY environment variable
    /// 2. DATADOG_API_KEY environment variable
    /// 3. ~/.datadog/api_key file
    ///
    /// Returns nil if no key found.
    ///
    /// - Returns: Datadog API key string, or nil if not found
    open func getDatadogAPIKey() -> String? {
        // Try DD_API_KEY environment variable
        if let key = ProcessInfo.processInfo.environment["DD_API_KEY"], !key.isEmpty {
            return key
        }

        // Try DATADOG_API_KEY environment variable
        if let key = ProcessInfo.processInfo.environment["DATADOG_API_KEY"], !key.isEmpty {
            return key
        }

        // Try reading from ~/.datadog/api_key file
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let ddFile = homeDir.appendingPathComponent(".datadog/api_key")
        if let key = try? String(contentsOf: ddFile, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !key.isEmpty {
            return key
        }

        return nil
    }

    /// Get Datadog site region from environment.
    ///
    /// Attempts to retrieve Datadog site from environment or uses default:
    /// 1. DD_SITE environment variable
    /// 2. Default: "datadoghq.com"
    ///
    /// Common values:
    /// - "datadoghq.com" (US)
    /// - "datadoghq.eu" (EU)
    /// - "ddog-gov.com" (US FedRAMP)
    ///
    /// - Returns: Datadog site string
    open func getDatadogSite() -> String? {
        return ProcessInfo.processInfo.environment["DD_SITE"] ?? "datadoghq.com"
    }

    /// Configure VirtioFS file sharing for persistent storage.
    ///
    /// Default implementation: No file sharing (returns nil)
    ///
    /// Override to enable persistent storage:
    /// ```swift
    /// override func configureFileSharing() -> [(tag: String, url: URL)]? {
    ///     let appSupport = FileManager.default.urls(
    ///         for: .applicationSupportDirectory,
    ///         in: .userDomainMask
    ///     ).first!
    ///     let vmData = appSupport.appendingPathComponent("VibeCode/vm-data")
    ///     try? FileManager.default.createDirectory(at: vmData, withIntermediateDirectories: true)
    ///     return [("vmdata", vmData)]
    /// }
    /// ```
    ///
    /// The mount tag is used in the guest to mount the share:
    /// ```
    /// mount -t virtiofs vmdata /mnt/host
    /// ```
    ///
    /// - Returns: Array of (tag, url) tuples for shared directories, or nil for no sharing
    open func configureFileSharing() -> [(tag: String, url: URL)]? {
        return nil
    }

    // MARK: - Private Implementation

    /// Create VM configuration.
    ///
    /// This method assembles the VZVirtualMachineConfiguration using template methods
    /// and the provided networking strategy.
    ///
    /// - Parameter networkingStrategy: The networking strategy to use
    /// - Returns: Validated VZVirtualMachineConfiguration
    /// - Throws: Configuration errors (missing resources, validation failures)
    private func createVMConfiguration(networkingStrategy: NetworkingStrategy) throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU and Memory (from template methods)
        config.cpuCount = getCPUCount()
        config.memorySize = getMemorySize()

        // Bootloader
        let bootloader = try createBootloader()
        config.bootLoader = bootloader

        // Networking (from strategy)
        try networkingStrategy.configure(config)

        // Serial console
        try configureSerialConsole(config)

        // Standard devices
        configureStandardDevices(config)

        // File sharing (VirtioFS)
        if let shares = configureFileSharing() {
            try configureVirtioFS(config, shares: shares)
        }

        // Validate configuration
        try config.validate()

        return config
    }

    /// Create bootloader configuration.
    private func createBootloader() throws -> VZLinuxBootLoader {
        let kernelName = getKernelResource()
        let initramfsName = getInitramfsResource()

        VMLogger.debug("Loading kernel and initramfs", metadata: [
            "vm_id": vmID,
            "kernel_name": kernelName,
            "initramfs_name": "\(initramfsName).cpio.gz",
            "bundle_path": Bundle.main.bundlePath
        ])

        // Get kernel
        guard let kernel = Bundle.main.url(forResource: kernelName, withExtension: nil) else {
            VMLogger.critical("Kernel not found in bundle", metadata: [
                "vm_id": vmID,
                "kernel_name": kernelName,
                "bundle_path": Bundle.main.bundlePath,
                "bundle_resources": (try? FileManager.default.contentsOfDirectory(atPath: Bundle.main.resourcePath ?? "")) ?? []
            ])
            throw VMError.kernelNotFound(kernelName)
        }
        VMLogger.debug("Kernel found", metadata: [
            "vm_id": vmID,
            "kernel_path": kernel.path
        ])

        // Get initramfs
        guard let initrd = Bundle.main.url(forResource: initramfsName, withExtension: "cpio.gz") else {
            VMLogger.critical("Initramfs not found in bundle", metadata: [
                "vm_id": vmID,
                "initramfs_name": "\(initramfsName).cpio.gz",
                "bundle_path": Bundle.main.bundlePath,
                "bundle_resources": (try? FileManager.default.contentsOfDirectory(atPath: Bundle.main.resourcePath ?? "")) ?? []
            ])
            throw VMError.initramfsNotFound(initramfsName)
        }
        VMLogger.debug("Initramfs found", metadata: [
            "vm_id": vmID,
            "initramfs_path": initrd.path
        ])

        let cmdline = getKernelCommandLine()
        VMLogger.debug("Bootloader configured", metadata: [
            "vm_id": vmID,
            "kernel_cmdline": cmdline
        ])

        let bootloader = VZLinuxBootLoader(kernelURL: kernel)
        bootloader.initialRamdiskURL = initrd
        bootloader.commandLine = cmdline

        return bootloader
    }

    /// Configure serial console for output logging or PTY.
    private func configureSerialConsole(_ config: VZVirtualMachineConfiguration) throws {
        isPTYEnabled = enablePTY()

        let serial = VZVirtioConsoleDeviceSerialPortConfiguration()

        if isPTYEnabled {
            // PTY mode: bidirectional terminal access
            VMLogger.info("Configuring serial console with PTY", metadata: ["vm_id": vmID])

            let pty = PTYManager()
            try pty.openPTY()

            guard let slaveRead = pty.getSlaveReadHandle(),
                  let slaveWrite = pty.getSlaveWriteHandle() else {
                throw VMError.ptyConfigurationFailed
            }

            serial.attachment = VZFileHandleSerialPortAttachment(
                fileHandleForReading: slaveRead,
                fileHandleForWriting: slaveWrite
            )

            ptyManager = pty

            VMLogger.info("PTY configured", metadata: [
                "vm_id": vmID,
                "slave_path": pty.getSlavePath() ?? "unknown"
            ])
        } else {
            // File mode: write-only logging
            VMLogger.debug("Configuring serial console with file logging", metadata: ["vm_id": vmID])

            FileManager.default.createFile(atPath: consoleLogPath.path, contents: nil)
            // Use forUpdating instead of forWritingTo to allow the VM framework to write properly
            consoleFileHandle = try FileHandle(forUpdating: consoleLogPath)

            serial.attachment = VZFileHandleSerialPortAttachment(
                fileHandleForReading: nil,
                fileHandleForWriting: consoleFileHandle
            )
        }

        config.serialPorts = [serial]
    }

    /// Configure standard devices (entropy, platform).
    /// Note: Network and socket devices are configured by the NetworkingStrategy.
    private func configureStandardDevices(_ config: VZVirtualMachineConfiguration) {
        // Entropy device for random number generation
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Platform configuration
        let platform = VZGenericPlatformConfiguration()
        platform.machineIdentifier = VZGenericMachineIdentifier()
        config.platform = platform
    }

    /// Configure VirtioFS file sharing devices.
    ///
    /// - Parameters:
    ///   - config: The VM configuration
    ///   - shares: Array of (tag, url) tuples for shared directories
    /// - Throws: Configuration errors
    private func configureVirtioFS(_ config: VZVirtualMachineConfiguration, shares: [(tag: String, url: URL)]) throws {
        VMLogger.info("Configuring VirtioFS file sharing", metadata: [
            "vm_id": vmID,
            "share_count": shares.count
        ])

        var devices: [VZVirtioFileSystemDeviceConfiguration] = []

        for (tag, directoryURL) in shares {
            VMLogger.debug("Adding file share", metadata: [
                "vm_id": vmID,
                "tag": tag,
                "path": directoryURL.path
            ])

            // Create directory if it doesn't exist
            try FileManager.default.createDirectory(
                at: directoryURL,
                withIntermediateDirectories: true,
                attributes: nil
            )

            // Create shared directory configuration
            let sharedDirectory = VZSharedDirectory(url: directoryURL, readOnly: false)

            // Create file system device
            let fileSystemDevice = VZVirtioFileSystemDeviceConfiguration(tag: tag)
            fileSystemDevice.share = VZSingleDirectoryShare(directory: sharedDirectory)

            devices.append(fileSystemDevice)

            VMLogger.info("File share configured", metadata: [
                "vm_id": vmID,
                "tag": tag,
                "path": directoryURL.path,
                "read_only": false
            ])
        }

        config.directorySharingDevices = devices
        VMLogger.info("VirtioFS configuration complete", metadata: [
            "vm_id": vmID,
            "device_count": devices.count
        ])
    }

    /// Handle successful VM start.
    private func handleVMStartSuccess() {
        DispatchQueue.main.async {
            self.onVMStarted()
        }
    }

    /// Handle VM start failure.
    private func handleVMStartFailure(_ error: Error) {
        DispatchQueue.main.async {
            self.onVMError(error)
        }
    }

    /// Handle VM configuration error.
    private func handleVMConfigurationError(_ error: Error) {
        DispatchQueue.main.async {
            self.status = "Configuration error: \(error.localizedDescription)"
            VMLogger.logError(error, context: "VM configuration error", metadata: ["vm_id": self.vmID])
        }
    }

    /// Start console output monitoring.
    private func startConsoleMonitoring() {
        consoleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.updateConsoleOutput()
        }
    }

    /// Start DHCP lease monitoring.
    private func startDHCPMonitoring() {
        guard let strategy = networkingStrategy else { return }

        let macAddress = strategy.getMACAddress()
        
        // Create monitor instance with reference to self for console parsing
        dhcpMonitor = DHCPLeaseMonitor(macAddress: macAddress, vmManager: self)

        dhcpMonitor?.startMonitoring(interval: 1.0) { [weak self] ip in
            DispatchQueue.main.async {
                self?.vmIPAddress = ip
                self?.onIPAddressDetected(ip: ip)
            }
        } onNotFound: { [weak self] in
            DispatchQueue.main.async {
                self?.vmIPAddress = nil
            }
        }
    }

    /// Stop all monitoring.
    private func stopMonitoring() {
        consoleTimer?.invalidate()
        consoleTimer = nil

        dhcpMonitor?.stopMonitoring()
        dhcpMonitor = nil
    }

    /// Update console output from log file.
    private func updateConsoleOutput() {
        guard let output = try? String(contentsOf: consoleLogPath, encoding: .utf8) else {
            return
        }

        DispatchQueue.main.async {
            // Keep last 2000 characters for display
            self.consoleOutput = String(output.suffix(2000))

            // Check if server is ready
            if self.serverURL == nil {
                if let url = self.checkServerReady(consoleOutput: output) {
                    self.serverURL = url
                    self.onServerReady(url: url)
                }
            }
        }
    }
}

// MARK: - Error Types

/// Errors that can occur during VM management.
enum VMError: LocalizedError {
    case kernelNotFound(String)
    case initramfsNotFound(String)
    case configurationInvalid
    case ptyConfigurationFailed

    var errorDescription: String? {
        switch self {
        case .kernelNotFound(let name):
            return "Kernel '\(name)' not found in app bundle"
        case .initramfsNotFound(let name):
            return "Initramfs '\(name).cpio.gz' not found in app bundle"
        case .configurationInvalid:
            return "VM configuration is invalid"
        case .ptyConfigurationFailed:
            return "Failed to configure PTY for VM console"
        }
    }
}

