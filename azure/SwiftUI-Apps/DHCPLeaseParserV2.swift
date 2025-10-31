import Foundation

/// Enhanced DHCP Lease Parser that can auto-discover VM MAC address
/// or use a specific target MAC
struct DHCPLeaseParserV2 {

    /// Standard location of DHCP leases file on macOS
    static let dhcpLeasesPath = "/var/db/dhcpd_leases"

    /// Primary target MAC address for VibeCode VM
    static let vmMACAddress = "52:54:00:12:34:90"

    /// Alternative: Find the most recent lease (useful when MAC is unknown)
    static func findMostRecentIP() -> String? {
        guard let content = try? String(contentsOfFile: dhcpLeasesPath, encoding: .utf8) else {
            print("DEBUG: Could not read DHCP leases file at \(dhcpLeasesPath)")
            return nil
        }

        print("DEBUG: DHCP leases content:\n\(content)")

        // Split by lease blocks
        let leaseBlocks = parseLeaseBlocks(content)
        print("DEBUG: Found \(leaseBlocks.count) lease block(s)")

        // Return the IP from the last (most recent) lease
        for block in leaseBlocks.reversed() {
            if let ipAddress = extractValue(from: block, key: "ip_address") {
                print("DEBUG: Found most recent IP: \(ipAddress)")
                return ipAddress
            }
        }

        return nil
    }

    /// Get all MAC addresses currently in DHCP leases
    static func getAllLeasedMACs() -> [String: String] {
        var result: [String: String] = [:]

        guard let content = try? String(contentsOfFile: dhcpLeasesPath, encoding: .utf8) else {
            return result
        }

        let leaseBlocks = parseLeaseBlocks(content)

        for block in leaseBlocks {
            if let hwAddress = extractValue(from: block, key: "hw_address"),
               let ipAddress = extractValue(from: block, key: "ip_address") {
                let macParts = hwAddress.split(separator: ",")
                let mac = macParts.count > 1 ? String(macParts[1]).trimmingCharacters(in: .whitespaces) : hwAddress
                result[mac] = ipAddress
            }
        }

        return result
    }

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
                let macParts = hwAddress.split(separator: ",")
                let leaseMAC = macParts.count > 1 ? String(macParts[1]).trimmingCharacters(in: .whitespaces) : hwAddress

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
        let pattern = key + "=([^\\n}]*)"
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
            let nsBlock = block as NSString
            let range = NSRange(location: 0, length: nsBlock.length)
            if let match = regex.firstMatch(in: block, options: [], range: range) {
                if let valueRange = Range(match.range(at: 1), in: block) {
                    var value = String(block[valueRange])
                    value = value.trimmingCharacters(in: .whitespaces)
                    value = value.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                    value = value.trimmingCharacters(in: CharacterSet(charactersIn: "\t"))
                    return value
                }
            }
        }
        return nil
    }

    /// Monitor DHCP leases file for changes with fallback to most recent IP
    static func startMonitoringWithFallback(
        macAddress: String = vmMACAddress,
        useFallback: Bool = true,
        interval: TimeInterval = 1.0,
        onIPFound: @escaping (String) -> Void,
        onNotFound: @escaping () -> Void
    ) -> Timer {
        var lastFoundIP: String? = nil

        let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            var foundIP: String? = nil

            // First try to find by specific MAC
            if let ip = findVMIPAddress(macAddress: macAddress) {
                foundIP = ip
            }
            // Fallback to most recent IP if enabled and specific MAC not found
            else if useFallback, let ip = findMostRecentIP() {
                foundIP = ip
            }

            if let ip = foundIP {
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
