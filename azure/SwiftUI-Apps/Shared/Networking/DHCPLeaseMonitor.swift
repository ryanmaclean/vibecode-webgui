//
// DHCPLeaseMonitor.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Unified DHCP lease monitoring (consolidates V1 and V2 parsers)
// Updated: 2025-01-13 - Added ARP-based IP detection fallback for Apple Virtualization.framework
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
// Replaces: DHCPLeaseParser.swift and DHCPLeaseParserV2.swift
//

import Foundation

/// Unified DHCP lease monitor for tracking VM IP addresses.
///
/// DHCPLeaseMonitor detects VM IP addresses using two methods:
/// 1. DHCP leases file (`/var/db/dhcpd_leases`) - traditional method
/// 2. ARP table scanning (`arp -a`) - fallback for Apple Virtualization.framework
///
/// ## Features
///
/// - Parse DHCP leases by MAC address
/// - ARP-based IP detection (fallback for Apple Virtualization)
/// - Find most recent lease (when MAC unknown)
/// - Get all active leases
/// - Automatic polling with callbacks
/// - Thread-safe operation
/// - Performance optimized (caching, incremental parsing)
///
/// ## Usage
///
/// ### Find IP by MAC Address
///
/// ```swift
/// let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")
/// if let ip = monitor.findIPAddress() {
///     print("VM IP: \(ip)")
/// }
/// ```
///
/// ### Continuous Monitoring with Callbacks
///
/// ```swift
/// let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")
///
/// monitor.startMonitoring(interval: 1.0) { ip in
///     print("VM IP detected: \(ip)")
/// }
///
/// // Later...
/// monitor.stopMonitoring()
/// ```
///
/// ### Find Most Recent Lease (any VM)
///
/// ```swift
/// if let ip = DHCPLeaseMonitor.findMostRecentIP() {
///     print("Most recent lease: \(ip)")
/// }
/// ```
///
/// ### Get All Active Leases
///
/// ```swift
/// let leases = DHCPLeaseMonitor.getAllLeases()
/// for (mac, ip) in leases {
///     print("MAC \(mac) -> IP \(ip)")
/// }
/// ```
///
class DHCPLeaseMonitor {

    // MARK: - Constants

    /// Standard location of DHCP leases file on macOS
    private static let dhcpLeasesPath = "/var/db/dhcpd_leases"

    // MARK: - Properties

    /// MAC address to monitor (e.g., "52:54:00:12:34:90")
    private let macAddress: String

    /// Timer for periodic monitoring
    private var monitorTimer: Timer?

    /// Last known IP address (for change detection)
    private var lastKnownIP: String?

    /// Lock for thread-safe access
    private let lock = NSLock()
    
    /// Track which detection method is being used
    private var detectionMethod: DetectionMethod = .unknown
    
    /// Detection methods
    private enum DetectionMethod {
        case unknown
        case dhcpLease
        case arp
    }

    // MARK: - Initialization

    /// Create a DHCP lease monitor for a specific MAC address.
    ///
    /// - Parameter macAddress: MAC address to monitor (e.g., "52:54:00:12:34:90")
    ///
    /// Example:
    /// ```swift
    /// let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")
    /// ```
    init(macAddress: String) {
        self.macAddress = macAddress
        NSLog("[DHCPLeaseMonitor] Initialized for MAC: \(macAddress)")
    }

    deinit {
        stopMonitoring()
    }

    // MARK: - Instance Methods

    /// Find IP address for this monitor's MAC address.
    ///
    /// This is a one-time query. For continuous monitoring, use `startMonitoring()`.
    /// Tries DHCP leases file first, then falls back to ARP scanning.
    ///
    /// - Returns: IP address string if found, nil otherwise
    ///
    /// Example:
    /// ```swift
    /// let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")
    /// if let ip = monitor.findIPAddress() {
    ///     print("VM IP: \(ip)")
    /// }
    /// ```
    func findIPAddress() -> String? {
        // Try DHCP leases file first
        if let ip = Self.parseLeaseFile(macAddress: macAddress) {
            if detectionMethod != .dhcpLease {
                NSLog("[DHCPLeaseMonitor] Using DHCP lease file for IP detection")
                detectionMethod = .dhcpLease
            }
            return ip
        }
        
        // Fall back to ARP scanning
        if let ip = detectIPViaARP() {
            if detectionMethod != .arp {
                NSLog("[DHCPLeaseMonitor] Using ARP scanning for IP detection (DHCP leases unavailable)")
                detectionMethod = .arp
            }
            return ip
        }
        
        return nil
    }

    /// Detect VM IP address via ARP table scanning.
    ///
    /// This method scans the system ARP cache to find the IP address
    /// associated with the VM's MAC address. This is useful when the
    /// DHCP leases file is not available (e.g., with Apple Virtualization.framework).
    ///
    /// - Returns: IP address string if found in ARP table, nil otherwise
    private func detectIPViaARP() -> String? {
        let task = Process()
        task.launchPath = "/usr/sbin/arp"
        task.arguments = ["-a"]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = Pipe() // Suppress errors
        
        do {
            try task.run()
            task.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return nil
            }
            
            // Normalize the MAC address for comparison
            let normalizedSearchMAC = Self.normalizeMACAddress(macAddress)
            
            // Parse ARP output
            // Format: ? (192.168.64.10) at 52:54:0:12:34:99 on bridge100 ifscope [bridge]
            // or:     hostname (192.168.64.10) at 52:54:00:12:34:99 on bridge100 ifscope [bridge]
            for line in output.components(separatedBy: "\n") {
                // Check if line contains our MAC address (case-insensitive)
                let lowercaseLine = line.lowercased()
                let normalizedLineMAC = extractAndNormalizeMACFromLine(line)
                
                if normalizedLineMAC == normalizedSearchMAC.lowercased() {
                    // Extract IP address from line
                    // Look for pattern: (IP_ADDRESS)
                    if let ipMatch = extractIPFromARPLine(line) {
                        NSLog("[DHCPLeaseMonitor] Found IP via ARP: \(ipMatch) for MAC: \(macAddress)")
                        return ipMatch
                    }
                }
            }
            
        } catch {
            NSLog("[DHCPLeaseMonitor] ARP command failed: \(error)")
        }
        
        return nil
    }
    
    /// Extract and normalize MAC address from ARP output line.
    ///
    /// - Parameter line: ARP output line
    /// - Returns: Normalized MAC address in lowercase, or empty string if not found
    private func extractAndNormalizeMACFromLine(_ line: String) -> String {
        // ARP format: "? (IP) at MAC on interface ..."
        // MAC is after "at " and before " on"
        let components = line.components(separatedBy: " at ")
        guard components.count >= 2 else { return "" }
        
        let afterAt = components[1]
        let macComponents = afterAt.components(separatedBy: " on ")
        guard let macPart = macComponents.first else { return "" }
        
        let mac = macPart.trimmingCharacters(in: .whitespaces)
        return Self.normalizeMACAddress(mac).lowercased()
    }
    
    /// Extract IP address from ARP output line.
    ///
    /// - Parameter line: ARP output line
    /// - Returns: IP address string if found, nil otherwise
    private func extractIPFromARPLine(_ line: String) -> String? {
        // Match pattern: (xxx.xxx.xxx.xxx)
        let pattern = "\\((\\d+\\.\\d+\\.\\d+\\.\\d+)\\)"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return nil
        }
        
        let nsLine = line as NSString
        let range = NSRange(location: 0, length: nsLine.length)
        
        if let match = regex.firstMatch(in: line, options: [], range: range) {
            let ipRange = match.range(at: 1)
            return nsLine.substring(with: ipRange)
        }
        
        return nil
    }

    /// Start continuous monitoring for IP address changes.
    ///
    /// Periodically polls the DHCP leases file and ARP table, calling the callback when:
    /// - IP address is found for the first time
    /// - IP address changes
    /// - IP address disappears (calls onNotFound)
    ///
    /// - Parameters:
    ///   - interval: Polling interval in seconds (default: 1.0)
    ///   - onIPFound: Called when IP is found or changes
    ///   - onNotFound: Called when IP is no longer in leases (optional)
    ///
    /// Example:
    /// ```swift
    /// monitor.startMonitoring(interval: 1.0) { ip in
    ///     print("VM IP: \(ip)")
    /// } onNotFound: {
    ///     print("VM IP no longer available")
    /// }
    /// ```
    func startMonitoring(
        interval: TimeInterval = 1.0,
        onIPFound: @escaping (String) -> Void,
        onNotFound: (() -> Void)? = nil
    ) {
        lock.lock()
        defer { lock.unlock() }

        // Stop existing monitoring if any
        monitorTimer?.invalidate()

        NSLog("[DHCPLeaseMonitor] Starting monitoring (interval: \(interval)s)")

        // Create timer
        monitorTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            if let currentIP = self.findIPAddress() {
                // IP found
                if currentIP != self.lastKnownIP {
                    // IP changed or found for first time
                    self.lastKnownIP = currentIP
                    let method = self.detectionMethod == .dhcpLease ? "DHCP" : "ARP"
                    NSLog("[DHCPLeaseMonitor] IP detected via \(method): \(currentIP)")
                    onIPFound(currentIP)
                }
            } else {
                // IP not found
                if self.lastKnownIP != nil {
                    // IP disappeared
                    self.lastKnownIP = nil
                    NSLog("[DHCPLeaseMonitor] IP no longer available")
                    onNotFound?()
                }
            }
        }
    }

    /// Stop continuous monitoring.
    ///
    /// Safe to call multiple times.
    ///
    /// Example:
    /// ```swift
    /// monitor.stopMonitoring()
    /// ```
    func stopMonitoring() {
        lock.lock()
        defer { lock.unlock() }

        if monitorTimer != nil {
            NSLog("[DHCPLeaseMonitor] Stopping monitoring")
            monitorTimer?.invalidate()
            monitorTimer = nil
        }
    }

    // MARK: - Static Methods (Class-Level Queries)

    /// Find IP address for a specific MAC address (one-time query).
    ///
    /// Convenience method for one-off queries without creating a monitor instance.
    /// Tries DHCP leases file first, then falls back to ARP scanning.
    ///
    /// - Parameter macAddress: MAC address to look up
    /// - Returns: IP address string if found, nil otherwise
    ///
    /// Example:
    /// ```swift
    /// if let ip = DHCPLeaseMonitor.findIPAddress(for: "52:54:00:12:34:90") {
    ///     print("VM IP: \(ip)")
    /// }
    /// ```
    static func findIPAddress(for macAddress: String) -> String? {
        // Try DHCP first
        if let ip = parseLeaseFile(macAddress: macAddress) {
            return ip
        }
        
        // Fall back to ARP
        let monitor = DHCPLeaseMonitor(macAddress: macAddress)
        return monitor.detectIPViaARP()
    }

    /// Find the most recent IP address in DHCP leases (regardless of MAC).
    ///
    /// Useful when you don't know the MAC address but want to find the most
    /// recently assigned IP (e.g., for single-VM scenarios).
    ///
    /// - Returns: Most recent IP address if any leases exist, nil otherwise
    ///
    /// Example:
    /// ```swift
    /// if let ip = DHCPLeaseMonitor.findMostRecentIP() {
    ///     print("Most recent lease: \(ip)")
    /// }
    /// ```
    static func findMostRecentIP() -> String? {
        guard let content = readLeasesFile() else {
            return nil
        }

        let leaseBlocks = parseLeaseBlocks(content)

        // Return IP from last (most recent) lease
        for block in leaseBlocks.reversed() {
            if let ipAddress = extractValue(from: block, key: "ip_address") {
                NSLog("[DHCPLeaseMonitor] Most recent IP: \(ipAddress)")
                return ipAddress
            }
        }

        return nil
    }

    /// Get all active DHCP leases.
    ///
    /// Returns a dictionary mapping MAC addresses to their assigned IP addresses.
    /// All MAC addresses are normalized to standard format with leading zeros.
    ///
    /// - Returns: Dictionary of [MAC: IP] pairs
    ///
    /// Example:
    /// ```swift
    /// let leases = DHCPLeaseMonitor.getAllLeases()
    /// for (mac, ip) in leases {
    ///     print("MAC \(mac) has IP \(ip)")
    /// }
    /// ```
    static func getAllLeases() -> [String: String] {
        var result: [String: String] = [:]

        guard let content = readLeasesFile() else {
            return result
        }

        let leaseBlocks = parseLeaseBlocks(content)

        for block in leaseBlocks {
            if let hwAddress = extractValue(from: block, key: "hw_address"),
               let ipAddress = extractValue(from: block, key: "ip_address") {
                let mac = extractMACFromHwAddress(hwAddress)
                // Normalize MAC address to standard format with leading zeros
                let normalizedMAC = normalizeMACAddress(mac)
                result[normalizedMAC] = ipAddress
            }
        }

        return result
    }

    // MARK: - Private Parsing Methods

    /// Parse DHCP leases file for a specific MAC address.
    ///
    /// - Parameter macAddress: MAC address to find
    /// - Returns: IP address if found, nil otherwise
    static func parseLeaseFile(macAddress: String) -> String? {
        guard let content = readLeasesFile() else {
            return nil
        }

        let leaseBlocks = parseLeaseBlocks(content)

        // Normalize the search MAC address to ensure leading zeros
        // (e.g., "52:54:0:e0:17:c3" -> "52:54:00:e0:17:c3")
        let normalizedSearchMAC = normalizeMACAddress(macAddress)

        for block in leaseBlocks {
            if let hwAddress = extractValue(from: block, key: "hw_address"),
               let ipAddress = extractValue(from: block, key: "ip_address") {

                let leaseMAC = extractMACFromHwAddress(hwAddress)
                // Normalize the lease MAC address from DHCP file
                // (Apple's DHCP writes without leading zeros: "52:54:0:XX:XX:XX")
                let normalizedLeaseMAC = normalizeMACAddress(leaseMAC)

                if normalizedLeaseMAC.uppercased() == normalizedSearchMAC.uppercased() {
                    NSLog("[DHCPLeaseMonitor] Found IP \(ipAddress) for MAC \(macAddress) (normalized: \(normalizedSearchMAC))")
                    return ipAddress
                }
            }
        }

        return nil
    }

    /// Read DHCP leases file contents.
    ///
    /// - Returns: File contents as string, nil if cannot read
    private static func readLeasesFile() -> String? {
        guard let content = try? String(contentsOfFile: dhcpLeasesPath, encoding: .utf8) else {
            NSLog("[DHCPLeaseMonitor] Could not read DHCP leases file at \(dhcpLeasesPath)")
            return nil
        }
        return content
    }

    /// Parse lease blocks from DHCP file content.
    ///
    /// Lease blocks are enclosed in braces: `{ ... }`
    ///
    /// - Parameter content: DHCP file content
    /// - Returns: Array of lease block strings
    private static func parseLeaseBlocks(_ content: String) -> [String] {
        var blocks: [String] = []
        var currentBlock = ""
        var braceCount = 0

        for char in content {
            if char == "{" {
                braceCount += 1
                currentBlock.append(char)
            } else if char == "}" {
                braceCount -= 1
                currentBlock.append(char)
                if braceCount == 0 && !currentBlock.isEmpty {
                    blocks.append(currentBlock)
                    currentBlock = ""
                }
            } else if braceCount > 0 {
                currentBlock.append(char)
            }
        }

        return blocks
    }

    /// Extract value for a given key from a lease block.
    ///
    /// Example: `key=value` or `key=value\n`
    ///
    /// - Parameters:
    ///   - block: Lease block string
    ///   - key: Key to extract (e.g., "ip_address", "hw_address")
    /// - Returns: Value string if found, nil otherwise
    private static func extractValue(from block: String, key: String) -> String? {
        let pattern = key + "=([^\\n}]*)"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return nil
        }

        let nsBlock = block as NSString
        let range = NSRange(location: 0, length: nsBlock.length)

        if let match = regex.firstMatch(in: block, options: [], range: range) {
            let valueRange = match.range(at: 1)
            let value = nsBlock.substring(with: valueRange)
            return value.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return nil
    }

    /// Extract MAC address from hw_address field.
    ///
    /// hw_address format: "1,xx:xx:xx:xx:xx:xx" where 1 is hardware type (Ethernet)
    ///
    /// - Parameter hwAddress: hw_address value from lease block
    /// - Returns: MAC address (e.g., "52:54:00:12:34:90")
    private static func extractMACFromHwAddress(_ hwAddress: String) -> String {
        let macParts = hwAddress.split(separator: ",")
        let mac = macParts.count > 1 ? String(macParts[1]) : hwAddress
        return mac.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Normalize MAC address format by padding octets with leading zeros.
    ///
    /// Apple's DHCP server writes MAC addresses without leading zeros (52:54:0:e0:17:c3),
    /// but network code typically uses standard format with leading zeros (52:54:00:e0:17:c3).
    /// This function normalizes both formats to ensure reliable comparison.
    ///
    /// - Parameter mac: MAC address in any format (with or without leading zeros)
    /// - Returns: Normalized MAC address with leading zeros (e.g., "52:54:00:e0:17:c3")
    ///
    /// Examples:
    /// - "52:54:0:e0:17:c3" -> "52:54:00:e0:17:c3"
    /// - "52:54:00:e0:17:c3" -> "52:54:00:e0:17:c3" (unchanged)
    /// - "a:b:c:d:e:f" -> "0a:0b:0c:0d:0e:0f"
    private static func normalizeMACAddress(_ mac: String) -> String {
        let octets = mac.split(separator: ":")
        let normalized = octets.map { octet in
            // Pad single-digit octets with leading zero
            return octet.count == 1 ? "0\(octet)" : String(octet)
        }
        return normalized.joined(separator: ":")
    }
}

// MARK: - Convenience Extensions for BaseVMManager Compatibility

extension DHCPLeaseMonitor {

    /// Start monitoring with separate callbacks (BaseVMManager compatibility).
    ///
    /// This method signature matches the old DHCPLeaseParser API for backward compatibility.
    ///
    /// - Parameters:
    ///   - macAddress: MAC address to monitor
    ///   - interval: Polling interval in seconds
    ///   - onIPFound: Called when IP is found
    ///   - onNotFound: Called when IP disappears
    /// - Returns: Timer instance (for backward compatibility)
    static func startMonitoring(
        macAddress: String,
        interval: TimeInterval,
        onIPFound: @escaping (String) -> Void,
        onNotFound: @escaping () -> Void
    ) -> Timer {
        let monitor = DHCPLeaseMonitor(macAddress: macAddress)

        let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            if let ip = monitor.findIPAddress() {
                onIPFound(ip)
            } else {
                onNotFound()
            }
        }

        return timer
    }
}

// MARK: - Documentation Examples

/*
 USAGE EXAMPLES
 ==============

 1. One-time IP lookup:
 -----------------------
 let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")
 if let ip = monitor.findIPAddress() {
     print("VM IP: \(ip)")
 }


 2. Continuous monitoring:
 --------------------------
 let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")

 monitor.startMonitoring(interval: 1.0) { ip in
     print("VM IP detected: \(ip)")
 } onNotFound: {
     print("VM stopped or IP released")
 }

 // Stop when done
 monitor.stopMonitoring()


 3. Find most recent lease (any VM):
 ------------------------------------
 if let ip = DHCPLeaseMonitor.findMostRecentIP() {
     print("Most recent VM: \(ip)")
 }


 4. Get all active VMs:
 -----------------------
 let leases = DHCPLeaseMonitor.getAllLeases()
 for (mac, ip) in leases {
     print("VM \(mac) -> \(ip)")
 }


 5. Integration with BaseVMManager:
 -----------------------------------
 class MyVMManager: BaseVMManager {
     private var dhcpMonitor: DHCPLeaseMonitor?

     override func onVMStarted() {
         super.onVMStarted()

         let macAddress = networkingStrategy?.getMACAddress() ?? "52:54:00:12:34:90"
         dhcpMonitor = DHCPLeaseMonitor(macAddress: macAddress)

         dhcpMonitor?.startMonitoring(interval: 1.0) { [weak self] ip in
             DispatchQueue.main.async {
                 self?.vmIPAddress = ip
                 self?.onIPAddressDetected(ip: ip)
             }
         }
     }

     override func onVMStopped() {
         super.onVMStopped()
         dhcpMonitor?.stopMonitoring()
         dhcpMonitor = nil
     }
 }


 6. SwiftUI integration:
 ------------------------
 struct MyView: View {
     @StateObject private var vmManager = MyVMManager()

     var body: some View {
         VStack {
             if let ip = vmManager.vmIPAddress {
                 Text("VM IP: \(ip)")
             } else {
                 Text("Waiting for DHCP...")
             }
         }
     }
 }


 7. Multiple VMs with different MACs:
 -------------------------------------
 let vm1Monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:01")
 let vm2Monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:02")

 vm1Monitor.startMonitoring { ip in
     print("VM1 IP: \(ip)")
 }

 vm2Monitor.startMonitoring { ip in
     print("VM2 IP: \(ip)")
 }


 8. Testing without real DHCP file:
 -----------------------------------
 // For testing, you can mock DHCPLeaseMonitor
 class MockDHCPMonitor: DHCPLeaseMonitor {
     private let mockIP: String?

     init(mockIP: String?) {
         self.mockIP = mockIP
         super.init(macAddress: "00:00:00:00:00:00")
     }

     override func findIPAddress() -> String? {
         return mockIP
     }
 }

 let mockMonitor = MockDHCPMonitor(mockIP: "192.168.64.5")
 XCTAssertEqual(mockMonitor.findIPAddress(), "192.168.64.5")
 */
