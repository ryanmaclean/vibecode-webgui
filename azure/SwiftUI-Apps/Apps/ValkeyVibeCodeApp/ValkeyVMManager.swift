//
// ValkeyVMManager.swift
// VibeCode
//
// Created: 2025-11-27
// Purpose: VM manager for ValkeyVibeCodeApp using BaseVMManager infrastructure
//

import Foundation
import Virtualization
import Network

/// VM manager for ValkeyVibeCodeApp.
///
/// ValkeyVMManager extends BaseVMManager to provide a VM configuration
/// with NAT networking and Valkey server on Alpine Linux.
///
/// ## Configuration
///
/// This VM manager uses:
/// - 2 CPUs, 1GB RAM (defaults from BaseVMManager)
/// - NAT networking with stable MAC address (52:54:00:12:34:92)
/// - vmlinux-raw kernel
/// - valkey-complete.cpio.gz initramfs (not bun-openvscode)
/// - Console on hvc0 with verbose logging
/// - IPv6 disabled for better DHCP reliability
///
final class ValkeyVMManager: BaseVMManager {

    // MARK: - Port Forwarding

    /// Port forwarder for accessing Valkey on localhost
    private var portForwarder: VMPortForwarder?

    // MARK: - Template Method Overrides

    /// Create NAT networking strategy with stable MAC address.
    ///
    /// Uses a fixed MAC address (52:54:00:12:34:92) for stable DHCP leases.
    /// This ensures the VM gets the same IP address across restarts.
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy.valkey
    }

    /// Get kernel command line parameters.
    ///
    /// Returns: "console=hvc0 debug loglevel=8 ipv6.disable=1"
    ///
    /// - console=hvc0: Enable serial console output
    /// - debug loglevel=8: Verbose kernel logging for debugging
    /// - ipv6.disable=1: Force IPv4-only for better DHCP reliability
    override func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 ipv6.disable=1"
    }

    /// Get initramfs resource name (without .cpio.gz extension).
    ///
    /// Returns: "valkey-standalone" (will look for valkey-standalone.cpio.gz)
    override func getInitramfsResource() -> String {
        return "valkey-standalone"
    }

    /// Check if server is ready by looking for specific console output.
    ///
    /// Returns VM IP when Valkey startup message is detected in console output.
    override func checkServerReady(consoleOutput: String) -> String? {
        // Look for Valkey startup message
        if consoleOutput.contains("SUCCESS: Valkey server started") ||
           consoleOutput.contains("Listening on port 6379") {
            // Extract IP address from console output
            let lines = consoleOutput.components(separatedBy: "\n")
            for line in lines {
                if line.contains("VM IP address:") {
                    let parts = line.components(separatedBy: "VM IP address:")
                    if parts.count > 1 {
                        let ip = parts[1].trimmingCharacters(in: .whitespaces)
                        return ip
                    }
                }
            }
            // If we can't extract IP but Valkey started, return a placeholder
            return "Starting..."
        }
        return nil
    }

    // MARK: - Lifecycle Hooks for Port Forwarding

    /// Called when VM IP is detected via DHCP - start port forwarding to localhost.
    ///
    /// This enables accessing Valkey on localhost:6379 instead of VM_IP:6379,
    /// providing a consistent development experience similar to Docker/Podman.
    override func onIPAddressDetected(ip: String) {
        super.onIPAddressDetected(ip: ip)

        // Start port forwarding for Valkey service
        print("[ValkeyVM] Starting port forwarding for \(ip):6379 → localhost:6379")
        portForwarder = VMPortForwarder.forwardService(vmIP: ip, serviceName: "Valkey")

        if portForwarder != nil {
            print("[ValkeyVM] Port forwarding enabled - access Valkey via: redis-cli -h localhost -p 6379")
        } else {
            print("[ValkeyVM] Warning: Port forwarding failed to start")
        }
    }

    /// Called when VM stops - clean up port forwarding.
    override func onVMStopped() {
        super.onVMStopped()

        // Stop port forwarding
        if portForwarder != nil {
            print("[ValkeyVM] Stopping port forwarding")
            portForwarder?.stopAll()
            portForwarder = nil
        }
    }
}

// MARK: - NAT Network Strategy Extension for Valkey

extension NATNetworkStrategy {
    /// NAT networking strategy for Valkey VM with fixed MAC address.
    ///
    /// MAC: 52:54:00:12:34:92 (ensures stable DHCP lease)
    /// VSOCK disabled since Valkey uses regular TCP
    static let valkey = NATNetworkStrategy(
        macAddress: "52:54:00:12:34:92",
        enableVsock: false
    )
}
