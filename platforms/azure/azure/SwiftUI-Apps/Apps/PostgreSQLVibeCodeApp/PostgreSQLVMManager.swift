//
// PostgreSQLVMManager.swift
// VibeCode
//
// Created: 2025-11-27
// Purpose: VM manager for PostgreSQLVibeCodeApp using BaseVMManager infrastructure
//

import Foundation
import Virtualization

/// VM manager for PostgreSQLVibeCodeApp.
///
/// PostgreSQLVMManager extends BaseVMManager to provide a VM configuration
/// with NAT networking and PostgreSQL server on Alpine Linux.
///
/// ## Configuration
///
/// This VM manager uses:
/// - 2 CPUs, 1GB RAM (defaults from BaseVMManager)
/// - NAT networking with stable MAC address (52:54:00:12:34:93)
/// - vmlinux-raw kernel
/// - postgresql-complete.cpio.gz initramfs (not bun-openvscode)
/// - Console on hvc0 with verbose logging
/// - IPv6 disabled for better DHCP reliability
///
final class PostgreSQLVMManager: BaseVMManager {

    // MARK: - Template Method Overrides

    /// Create NAT networking strategy with stable MAC address.
    ///
    /// Uses a fixed MAC address (52:54:00:12:34:93) for stable DHCP leases.
    /// This ensures the VM gets the same IP address across restarts.
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy.postgresql
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
    /// Returns: "postgresql-standalone" (will look for postgresql-standalone.cpio.gz)
    override func getInitramfsResource() -> String {
        return "postgresql-standalone"
    }

    /// Check if server is ready by looking for specific console output.
    ///
    /// Returns VM IP when PostgreSQL startup message is detected in console output.
    override func checkServerReady(consoleOutput: String) -> String? {
        // Look for PostgreSQL startup message
        if consoleOutput.contains("PostgreSQL server started") ||
           consoleOutput.contains("database system is ready to accept connections") ||
           consoleOutput.contains("Listening on port 5432") {
            // Extract IP address from console output
            let lines = consoleOutput.components(separatedBy: "\n")
            for line in lines {
                if line.contains("Network configured:") {
                    let parts = line.components(separatedBy: "Network configured:")
                    if parts.count > 1 {
                        let ip = parts[1].trimmingCharacters(in: .whitespaces)
                        return ip
                    }
                }
            }
            // If we can't extract IP but PostgreSQL started, return a placeholder
            return "Starting..."
        }
        return nil
    }
}

// MARK: - NAT Network Strategy Extension for PostgreSQL

extension NATNetworkStrategy {
    /// NAT networking strategy for PostgreSQL VM with fixed MAC address.
    ///
    /// MAC: 52:54:00:12:34:93 (ensures stable DHCP lease)
    /// VSOCK disabled since PostgreSQL uses regular TCP
    static let postgresql = NATNetworkStrategy(
        macAddress: "52:54:00:12:34:93",
        enableVsock: false
    )
}
