//
// Network Configuration for VMs
// Based on: https://developer.apple.com/documentation/virtualization/network
//

import Foundation
import Virtualization

@available(macOS 13.0, *)
struct NetworkConfig {
    
    /// Create NAT network device (internet access, port forwarding)
    static func createNATNetwork() -> VZVirtioNetworkDeviceConfiguration {
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        return networkDevice
    }
    
    /// Create bridged network device (direct network access)
    static func createBridgedNetwork(interface: String = "en0") -> VZVirtioNetworkDeviceConfiguration? {
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        
        // Get available network interfaces
        guard let availableInterfaces = VZBridgedNetworkInterface.networkInterfaces as? [VZBridgedNetworkInterface],
              let bridgeInterface = availableInterfaces.first(where: { $0.identifier == interface }) else {
            print("⚠️  Bridge interface \(interface) not found, falling back to NAT")
            return nil
        }
        
        networkDevice.attachment = VZBridgedNetworkDeviceAttachment(interface: bridgeInterface)
        return networkDevice
    }
    
    /// Create file handle network device (custom networking, port forwarding)
    static func createFileHandleNetwork(socketPath: String) -> VZVirtioNetworkDeviceConfiguration? {
        // For advanced use cases like custom port forwarding
        // This allows connecting to Unix domain sockets
        guard let fileHandle = FileHandle(forUpdatingAtPath: socketPath) else {
            print("⚠️  Socket not found: \(socketPath)")
            return nil
        }
        
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZFileHandleNetworkDeviceAttachment(fileHandle: fileHandle)
        return networkDevice
    }
    
    /// Get local IPv4 addresses
    static func getLocalIPAddresses() -> [String] {
        var addresses: [String] = []
        
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0 else { return addresses }
        defer { freeifaddrs(ifaddr) }
        
        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }
            
            guard let interface = ptr?.pointee,
                  interface.ifa_addr.pointee.sa_family == UInt8(AF_INET) else {
                continue
            }
            
            var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(interface.ifa_addr,
                          socklen_t(interface.ifa_addr.pointee.sa_len),
                          &hostname,
                          socklen_t(hostname.count),
                          nil,
                          0,
                          NI_NUMERICHOST) == 0 {
                let address = String(cString: hostname)
                if address != "127.0.0.1" && address != "0.0.0.0" {
                    addresses.append(address)
                }
            }
        }
        
        return addresses
    }
    
    /// Create network configuration with port forwarding hints
    static func createNetworkWithPortForwarding(ports: [Int] = []) -> VZVirtioNetworkDeviceConfiguration {
        let networkDevice = createNATNetwork()
        
        if !ports.isEmpty {
            print("📡 Network configured with NAT")
            print("   Port forwarding needed for: \(ports.map { String($0) }.joined(separator: ", "))")
            print("   Use external tools: socat, ssh tunneling, or bridge mode")
        }
        
        return networkDevice
    }
}

extension NetworkConfig {
    /// Print network diagnostics
    static func printNetworkInfo() {
        print("🌐 Network Configuration")
        print("=" + String(repeating: "=", count: 50))
        
        // Available interfaces
        if let interfaces = VZBridgedNetworkInterface.networkInterfaces as? [VZBridgedNetworkInterface] {
            print("\n📡 Available Bridge Interfaces:")
            for interface in interfaces {
                print("   • \(interface.identifier) (\(interface.localizedDisplayName ?? "Unknown"))")
            }
        }
        
        // Local IPs
        let localIPs = getLocalIPAddresses()
        print("\n🖥️  Host IP Addresses:")
        for ip in localIPs {
            print("   • \(ip)")
        }
        
        print("\n💡 Network Modes:")
        print("   • NAT: Internet access, isolated (default)")
        print("   • Bridge: Direct network access, same subnet as host")
        print("   • FileHandle: Custom networking, sockets")
        print("=" + String(repeating: "=", count: 50))
    }
}

