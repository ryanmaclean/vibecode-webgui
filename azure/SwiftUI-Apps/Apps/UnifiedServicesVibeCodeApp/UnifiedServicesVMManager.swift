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

    // MARK: - Port Forwarding

    /// Port forwarder for accessing services on localhost
    private var portForwarder: VMPortForwarder?

    // MARK: - Template Method Overrides

    /// Create NAT networking strategy - auto-generate MAC like working Valkey app.
    ///
    /// Uses auto-generated MAC for compatibility.
    /// No vsock - use VMPortForwarder instead (like ValkeyVibeCode.app which works).
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy(
            macAddress: nil,  // Auto-generate like working apps
            enableVsock: false  // Disabled - use VMPortForwarder instead
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
    /// Returns: "console=hvc0 debug loglevel=8 ipv6.disable=1 virtio_net.napi_tx=0"
    ///
    /// - console=hvc0: Enable serial console output
    /// - debug loglevel=8: Verbose kernel logging for debugging
    /// - ipv6.disable=1: Force IPv4-only for better DHCP reliability
    /// - virtio_net.napi_tx=0: Disable TX NAPI (may help with carrier detection)
    override func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 ipv6.disable=1 virtio_net.napi_tx=0"
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

    /// Enable PTY for interactive terminal access.
    ///
    /// Allows typing into the VM console and using SSH interactively.
    /// DISABLED for debugging - use file logging to see kernel boot messages
    override func enablePTY() -> Bool {
        return false
    }

    /// Configure VirtioFS file sharing for persistent storage.
    ///
    /// Mounts ~/Library/Application Support/VibeCode/vm-data/ to the VM with tag "hostshare".
    /// The init script will mount this at /mnt/host and use it for:
    /// - PostgreSQL data directory: /mnt/host/postgresql
    /// - Valkey AOF files: /mnt/host/valkey
    /// - OpenVSCode user data: /mnt/host/vscode-data
    override func configureFileSharing() -> [(tag: String, url: URL)]? {
        // Get Application Support directory
        guard let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            VMLogger.warning("Could not locate Application Support directory")
            return nil
        }

        // Create vm-data directory
        let vmDataDir = appSupport
            .appendingPathComponent("VibeCode")
            .appendingPathComponent("vm-data")

        do {
            try FileManager.default.createDirectory(
                at: vmDataDir,
                withIntermediateDirectories: true,
                attributes: nil
            )

            // Create subdirectories expected by init script
            let postgresDir = vmDataDir.appendingPathComponent("postgresql")
            let valkeyDir = vmDataDir.appendingPathComponent("valkey")
            let vscodeDir = vmDataDir.appendingPathComponent("vscode-data")

            try FileManager.default.createDirectory(at: postgresDir, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: valkeyDir, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: vscodeDir, withIntermediateDirectories: true)

            VMLogger.info("Configured persistent storage", metadata: [
                "path": vmDataDir.path,
                "tag": "hostshare",
                "subdirs": ["postgresql", "valkey", "vscode-data"]
            ])

            return [("hostshare", vmDataDir)]
        } catch {
            VMLogger.logError(error, context: "Failed to create vm-data directory")
            return nil
        }
    }
}
