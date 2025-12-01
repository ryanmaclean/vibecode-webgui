//
// PTYTestVMManager.swift
// VibeCode
//
// Created: 2025-11-26
// Purpose: Example VM manager demonstrating PTY/TTY functionality
//

import Foundation

/// Example VM manager that enables PTY for interactive terminal access.
///
/// This demonstrates how to enable PTY mode for a VM, allowing
/// interactive terminal sessions via serial console.
///
/// Usage:
/// ```swift
/// let vmManager = PTYTestVMManager()
/// vmManager.startVM()
///
/// // Get PTY path after VM starts
/// if let ptyPath = vmManager.getPTYPath() {
///     print("Connect with: screen \(ptyPath)")
/// }
/// ```
final class PTYTestVMManager: BaseVMManager {

    /// Enable PTY mode for this VM
    override func enablePTY() -> Bool {
        return true  // Enable PTY for interactive terminal
    }

    /// Use 2 CPUs for better performance
    override func getCPUCount() -> Int {
        return 2
    }

    /// Use 2GB RAM
    override func getMemorySize() -> UInt64 {
        return 2 * 1024 * 1024 * 1024
    }

    /// Custom kernel command line for PTY testing
    override func getKernelCommandLine() -> String {
        // Basic console setup for PTY
        var cmdline = "console=hvc0 loglevel=7"

        // Add Datadog configuration if available
        if let ddAPIKey = getDatadogAPIKey(), !ddAPIKey.isEmpty {
            cmdline += " DD_API_KEY=\(ddAPIKey)"
        }

        if let ddSite = getDatadogSite(), !ddSite.isEmpty {
            cmdline += " DD_SITE=\(ddSite)"
        }

        return cmdline
    }

    /// Called when VM starts successfully
    override func onVMStarted() {
        super.onVMStarted()

        // Print PTY path for connection
        if let ptyPath = getPTYPath() {
            VMLogger.info("VM console available via PTY", metadata: [
                "pty_path": ptyPath
            ])
            print("═══════════════════════════════════════════════════════")
            print("VM Started with PTY Console")
            print("═══════════════════════════════════════════════════════")
            print("PTY Device: \(ptyPath)")
            print("")
            print("Connect to VM console with:")
            print("  screen \(ptyPath)")
            print("  OR")
            print("  bash scripts/connect-vm-terminal.sh \(ptyPath)")
            print("")
            print("Detach from screen: Ctrl+A, D")
            print("Kill screen session: Ctrl+A, K")
            print("═══════════════════════════════════════════════════════")
        }
    }

    /// Called when VM stops
    override func onVMStopped() {
        super.onVMStopped()
        print("VM stopped - PTY connection closed")
    }
}
