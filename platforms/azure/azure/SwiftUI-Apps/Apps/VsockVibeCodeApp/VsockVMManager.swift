//
// VsockVMManager.swift
// VsockVibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: VM Manager for VsockVibeCode app using VirtIO sockets
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import SwiftUI
import Virtualization

/// VM Manager for VsockVibeCode app.
///
/// VsockVMManager extends BaseVMManager to provide vsock-specific configuration:
/// - Uses VsockNetworkStrategy for VirtIO socket networking
/// - Uses vsock-specific initramfs (bun-openvscode-vsock.cpio.gz)
/// - Configures kernel for vsock support
///
/// ## Usage
///
/// ```swift
/// @StateObject private var vmManager = VsockVMManager()
///
/// // In your view:
/// Button("Start") {
///     vmManager.startVM()
/// }
/// ```
///
/// ## Architecture
///
/// - Base lifecycle: BaseVMManager (start/stop/monitoring)
/// - Networking: VsockNetworkStrategy (vsock device + proxy)
/// - Console: Serial port monitoring (inherited)
/// - IP detection: Not needed (direct vsock connection)
///
/// ## Differences from NAT-based Apps
///
/// - No DHCP lease monitoring (not needed)
/// - Direct vsock connection to guest
/// - Localhost proxy for browser access
/// - Faster connection setup (no IP discovery)
///
public final class VsockVMManager: BaseVMManager {

    // MARK: - Published Properties

    /// Vsock-specific status (e.g., "Proxy active on localhost:3000")
    @Published public var vsockStatus: String = "Not initialized"

    // MARK: - Template Method Overrides

    /// Use vsock-specific initramfs.
    override public func getInitramfsResource() -> String {
        return "bun-openvscode-vsock"
    }

    /// Add vsock parameter to kernel command line.
    override public func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 vsock=1"
    }

    /// Use VsockNetworkStrategy for VirtIO socket networking.
    override public func createNetworkingStrategy() -> NetworkingStrategy {
        return VsockNetworkStrategy.vsockVibeCode
    }

    // MARK: - Lifecycle Hook Overrides

    /// Handle VM startup with vsock-specific logic.
    override public func onVMStarted() {
        super.onVMStarted()

        vsockStatus = "VM started, setting up vsock..."
        NSLog("[VsockVMManager] VM started, vsock initialization in progress")
    }

    /// Handle VM stop with vsock cleanup.
    override public func onVMStopped() {
        super.onVMStopped()

        vsockStatus = "Stopped"
        NSLog("[VsockVMManager] VM stopped, vsock cleaned up")
    }

    /// Handle errors with vsock status update.
    override public func onVMError(_ error: Error) {
        super.onVMError(error)

        vsockStatus = "VM error"
        NSLog("[VsockVMManager] VM error, vsock unavailable")
    }

    /// Override server ready detection for vsock.
    ///
    /// For vsock, we always use localhost:3000 (proxy handles forwarding).
    override public func checkServerReady(consoleOutput: String) -> String? {
        guard consoleOutput.contains("Server will be available") else {
            return nil
        }

        // Vsock always uses localhost via proxy
        return "http://localhost:3000"
    }

    /// Handle server ready with vsock status update.
    override public func onServerReady(url: String) {
        super.onServerReady(url: url)

        vsockStatus = "Proxy active on localhost:3000"
        NSLog("[VsockVMManager] Server ready, vsock proxy active")
    }

    // MARK: - Public Helpers

    /// Get vsock connection status for UI display.
    ///
    /// Returns a user-friendly status string:
    /// - "Not initialized" - Before VM starts
    /// - "VM started, setting up vsock..." - VM booting
    /// - "Proxy active on localhost:3000" - Ready for connections
    /// - "Stopped" - VM stopped
    /// - "VM error" - Error occurred
    ///
    /// - Returns: Current vsock status
    public func getVsockStatus() -> String {
        return vsockStatus
    }
}

// MARK: - Documentation

/*
 USAGE GUIDE
 ===========

 1. Basic Usage
 --------------
 struct ContentView: View {
     @StateObject private var vmManager = VsockVMManager()

     var body: some View {
         VStack {
             Text(vmManager.status)
             Text("Vsock: \(vmManager.vsockStatus)")

             Button("Start") {
                 vmManager.startVM()
             }
             .disabled(vmManager.isRunning)

             if let url = vmManager.serverURL {
                 Link("Open Server", destination: URL(string: url)!)
             }
         }
     }
 }


 2. Console Monitoring
 ----------------------
 Text(vmManager.consoleOutput)
     .font(.system(.caption, design: .monospaced))


 3. Status Indicators
 ---------------------
 HStack {
     Circle()
         .fill(vmManager.isRunning ? .green : .gray)
         .frame(width: 12, height: 12)
     Text(vmManager.vsockStatus)
 }


 4. Error Handling
 -----------------
 if vmManager.status.contains("Error") {
     Text(vmManager.status)
         .foregroundColor(.red)
 }


 5. Vsock vs NAT Differences
 ----------------------------
 Vsock:
 - serverURL is always "http://localhost:3000"
 - vmIPAddress is nil (not applicable)
 - vsockStatus shows proxy state
 - Faster connection (no DHCP wait)

 NAT:
 - serverURL uses actual VM IP (e.g., "http://192.168.64.5:3000")
 - vmIPAddress contains DHCP-assigned IP
 - Requires DHCP lease monitoring
 - Slower connection (wait for IP)


 6. Resource Requirements
 -------------------------
 Required in app bundle:
 - vmlinux-raw (kernel)
 - bun-openvscode-vsock.cpio.gz (initramfs with vsock init script)

 Note: Different from NAT apps which use bun-openvscode.cpio.gz


 7. Troubleshooting
 ------------------
 If vsock status stuck at "setting up vsock...":
 - Check console output for errors
 - Verify initramfs has vsock init script
 - Ensure VM has socket device configured

 If "Proxy failed to start":
 - Check if port 3000 is already in use
 - Verify VZVirtioSocketDevice is available
 - Check macOS version (requires macOS 13+)


 8. Performance
 --------------
 Vsock benefits:
 - Lower latency (direct memory-mapped communication)
 - No IP stack overhead
 - Faster connection establishment
 - Better for high-throughput applications

 Vsock limitations:
 - Only host-guest communication (no VM-to-VM)
 - Requires modern macOS (13+)
 - More complex implementation
 */
