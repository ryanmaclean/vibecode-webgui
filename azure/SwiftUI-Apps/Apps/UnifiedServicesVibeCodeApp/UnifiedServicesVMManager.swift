//
// UnifiedServicesVMManager.swift
// VibeCode
//
// Created: 2025-11-27
// Purpose: VM manager for UnifiedServicesVibeCodeApp with multiple services
//

import Foundation
import Virtualization

/// VM manager for UnifiedServicesVibeCodeApp.
///
/// UnifiedServicesVMManager extends BaseVMManager to provide a VM configuration
/// with NAT networking and multiple services: OpenVSCode, Valkey, PostgreSQL, SSH.
///
/// ## Configuration
///
/// This VM manager uses:
/// - 4 CPUs, 2GB RAM
/// - NAT networking with stable MAC address (52:54:00:12:34:99)
/// - vmlinux-raw kernel
/// - unified-vm-initramfs (OpenVSCode + Valkey + PostgreSQL + SSH)
/// - Console on hvc0 with verbose logging
/// - IPv6 disabled for better DHCP reliability
/// - **Multiple port forwards**: 3000 (OpenVSCode internal), 8080 (OpenVSCode external)
///
final class UnifiedServicesVMManager: BaseVMManager {

    // MARK: - Template Method Overrides

    /// Create NAT networking strategy with stable MAC address and multiple port forwards.
    ///
    /// Uses a fixed MAC address (52:54:00:12:34:99) for stable DHCP leases.
    /// Forwards both port 3000 (OpenVSCode internal) and port 8080 (external access).
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy(
            macAddress: "52:54:00:12:34:99",
            enableVsock: true,
            portForwards: [
                (guestPort: 3000, hostPort: 3000),  // OpenVSCode internal server
                (guestPort: 8080, hostPort: 8080)   // Bun TCP relay for external access
            ]
        )
    }

    /// Configure VM CPU count (4 CPUs).
    ///
    /// UnifiedServices VM needs more resources than basic VMs.
    override func getCPUCount() -> Int {
        return 4
    }

    /// Configure VM memory size (2GB).
    ///
    /// UnifiedServices VM needs more memory for multiple services.
    override func getMemorySize() -> UInt64 {
        return 2 * 1024 * 1024 * 1024  // 2GB
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
    /// Returns: "unified-vm-initramfs" (will look for unified-vm-initramfs.cpio.gz)
    override func getInitramfsResource() -> String {
        return "unified-vm-initramfs"
    }

    /// Check if servers are ready by looking for specific console output.
    ///
    /// Returns VM IP when OpenVSCode startup message is detected in console output.
    override func checkServerReady(consoleOutput: String) -> String? {
        // Look for OpenVSCode or unified services startup message
        if consoleOutput.contains("Unified Multi-Service VM Ready") ||
           consoleOutput.contains("OpenVSCode Server listening") ||
           consoleOutput.contains("TCP relay active") {
            // Extract IP address from console output
            let lines = consoleOutput.components(separatedBy: "\n")
            for line in lines {
                if line.contains("VM IP address:") || line.contains("VM IP:") {
                    let parts = line.components(separatedBy: CharacterSet(charactersIn: ":"))
                    if parts.count > 1 {
                        let ip = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                        return ip
                    }
                }
            }
            // If we can't extract IP but services started, return a placeholder
            return "Starting..."
        }
        return nil
    }
}
