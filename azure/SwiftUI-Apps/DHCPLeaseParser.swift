import Foundation

/// DEPRECATED: Use Shared/Networking/DHCPLeaseMonitor.swift instead
///
/// This legacy parser is replaced by DHCPLeaseMonitor which consolidates
/// both V1 and V2 parser functionality with improved organization and
/// thread-safe operation.
///
/// Migration path:
/// - Replace: DHCPLeaseParser.startMonitoring(...) -> DHCPLeaseMonitor.startMonitoring(...)
/// - Replace: DHCPLeaseParser.findVMIPAddress(macAddress:) -> DHCPLeaseMonitor.findIPAddress(for:)
/// - Replace: DHCPLeaseParser.vmMACAddress -> "52:54:00:12:34:90" (use constructor param instead)
///
/// See: /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/DHCPLeaseMonitor.swift
/// See: MIGRATION-STATUS.md
///
/// Parses DHCP lease information from /var/db/dhcpd_leases
/// MAC addresses are stored in format: hw_address=1,xx:xx:xx:xx:xx:xx
/// where 1 is the hardware type (Ethernet) and xx:xx:xx:xx:xx:xx is the MAC
@available(macOS, deprecated: 14.0, message: "Use DHCPLeaseMonitor from Shared/Networking/DHCPLeaseMonitor.swift instead")
struct DHCPLeaseParser {

    /// Standard location of DHCP leases file on macOS
    static let dhcpLeasesPath = "/var/db/dhcpd_leases"

    /// VM's target MAC address
    static let vmMACAddress = "52:54:00:12:34:90"

    /// Parse DHCP leases file and find IP for the given MAC address
    static func findVMIPAddress(macAddress: String = vmMACAddress) -> String? {
        guard let content = try? String(contentsOfFile: dhcpLeasesPath, encoding: .utf8) else {
            print("DEBUG: Could not read DHCP leases file at \(dhcpLeasesPath)")
            return nil
        }

        print("DEBUG: DHCP leases content:\n\(content)")

        // Split by lease blocks (enclosed in {})
        let leaseBlocks = parseLeaseBlocks(content)
        print("DEBUG: Found \(leaseBlocks.count) lease blocks")

        for block in leaseBlocks {
            if let hwAddress = extractValue(from: block, key: "hw_address"),
               let ipAddress = extractValue(from: block, key: "ip_address") {
                print("DEBUG: Lease - hw_address: \(hwAddress), ip_address: \(ipAddress)")

                // Compare MAC addresses
                // The hw_address format is "1,xx:xx:xx:xx:xx:xx"
                // We need to extract just the MAC part
                let macParts = hwAddress.split(separator: ",")
                let leaseMAC = macParts.count > 1 ? String(macParts[1]) : hwAddress

                if leaseMAC.uppercased() == macAddress.uppercased() {
                    print("DEBUG: MATCH FOUND! VM IP: \(ipAddress)")
                    return ipAddress
                }
            }
        }

        print("DEBUG: No matching MAC address found in leases")
        return nil
    }

    /// Parse individual lease blocks from DHCP file
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
                if braceCount == 0 {
                    blocks.append(currentBlock)
                    currentBlock = ""
                }
            } else if braceCount > 0 {
                currentBlock.append(char)
            }
        }

        return blocks
    }

    /// Extract value for a given key from a lease block
    private static func extractValue(from block: String, key: String) -> String? {
        // Look for pattern: key=value
        let pattern = key + "=([^\\n}]*)"
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
            let nsBlock = block as NSString
            let range = NSRange(location: 0, length: nsBlock.length)
            if let match = regex.firstMatch(in: block, options: [], range: range) {
                if let valueRange = Range(match.range(at: 1), in: block) {
                    var value = String(block[valueRange])
                    // Clean up value (remove quotes, whitespace)
                    value = value.trimmingCharacters(in: .whitespaces)
                    value = value.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                    return value
                }
            }
        }
        return nil
    }

    /// Monitor DHCP leases file for changes
    /// This is useful for detecting when the VM gets an IP address
    static func startMonitoring(
        macAddress: String = vmMACAddress,
        interval: TimeInterval = 1.0,
        onIPFound: @escaping (String) -> Void,
        onNotFound: @escaping () -> Void
    ) -> Timer {
        var lastFoundIP: String? = nil

        let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            if let ip = findVMIPAddress(macAddress: macAddress) {
                if lastFoundIP != ip {
                    lastFoundIP = ip
                    onIPFound(ip)
                }
            } else {
                if lastFoundIP != nil {
                    lastFoundIP = nil
                    onNotFound()
                }
            }
        }

        return timer
    }
}
