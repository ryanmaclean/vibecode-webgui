//
// ProxyConnection.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Bidirectional proxy for TCP to VZVirtioSocket connections
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization
import Network

/// Bidirectional proxy connection handler.
///
/// ProxyConnection bridges a TCP connection (from browser) to a VZVirtioSocket connection (to guest VM).
/// It forwards data in both directions until either side closes.
///
/// ## Architecture
///
/// ```
/// TCP Connection (Browser) <---> ProxyConnection <---> VZVirtioSocket (Guest)
/// ```
///
/// ## Data Flow
///
/// 1. TCP -> Vsock: Receives data from TCP, sends to vsock
/// 2. Vsock -> TCP: Receives data from vsock, sends to TCP
/// 3. Either side closes: Cleanup both connections
///
/// ## Modern API Usage (macOS 13+)
///
/// The old synchronous read/write methods on VZVirtioSocketConnection are no longer available.
/// Modern implementation uses:
/// - FileDescriptor for vsock I/O
/// - NWConnection for TCP
/// - Async dispatch queues for concurrency
///
/// ## Lifecycle
///
/// 1. Create ProxyConnection with TCP and vsock connections
/// 2. Call start() to begin forwarding
/// 3. Forwarding continues until error or connection close
/// 4. Call stop() to cleanup (or happens automatically on error)
///
public class ProxyConnection {

    // MARK: - Properties

    /// TCP connection (from browser)
    private let tcpConnection: NWConnection

    /// Vsock connection (to guest)
    private let vsockConnection: VZVirtioSocketConnection

    /// File descriptor for vsock I/O
    private let vsockFileDescriptor: FileDescriptor

    /// Whether this connection is active
    private var isActive = false

    /// Queue for connection operations
    private let queue: DispatchQueue

    // MARK: - Initialization

    /// Create a proxy connection between TCP and vsock.
    ///
    /// - Parameters:
    ///   - tcpConnection: The NWConnection from browser/client
    ///   - vsockConnection: The VZVirtioSocketConnection to guest
    ///   - queue: DispatchQueue for operations (should be concurrent)
    public init(tcpConnection: NWConnection, vsockConnection: VZVirtioSocketConnection, queue: DispatchQueue) {
        self.tcpConnection = tcpConnection
        self.vsockConnection = vsockConnection
        self.queue = queue

        // Get file descriptor from vsock connection
        // Note: VZVirtioSocketConnection provides a fileDescriptor property
        self.vsockFileDescriptor = FileDescriptor(rawValue: vsockConnection.fileDescriptor)

        NSLog("[ProxyConnection] Created proxy connection")
    }

    // MARK: - Public Methods

    /// Start forwarding data between TCP and vsock.
    ///
    /// This begins two concurrent forwarding loops:
    /// - TCP -> Vsock forwarding
    /// - Vsock -> TCP forwarding
    ///
    /// Both loops run until error or connection close.
    public func start() {
        guard !isActive else {
            NSLog("[ProxyConnection] Already active, ignoring start")
            return
        }

        isActive = true
        NSLog("[ProxyConnection] Starting proxy")

        // Start TCP connection
        tcpConnection.start(queue: queue)

        // Start bidirectional forwarding
        forwardTCPToVsock()
        forwardVsockToTCP()
    }

    /// Stop the proxy connection and cleanup.
    ///
    /// Cancels both TCP and vsock connections and marks inactive.
    public func stop() {
        guard isActive else { return }

        isActive = false
        NSLog("[ProxyConnection] Stopping proxy")

        // Cancel TCP connection
        tcpConnection.cancel()

        // Close vsock connection
        vsockConnection.close()
    }

    // MARK: - Private Forwarding

    /// Forward data from TCP to vsock.
    private func forwardTCPToVsock() {
        guard isActive else { return }

        tcpConnection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self, self.isActive else { return }

            // Handle error
            if let error = error {
                NSLog("[ProxyConnection] TCP receive error: \(error)")
                self.stop()
                return
            }

            // Handle connection close
            if isComplete {
                NSLog("[ProxyConnection] TCP connection closed")
                self.stop()
                return
            }

            // Forward data to vsock
            if let data = data, !data.isEmpty {
                self.writeToVsock(data)
            }

            // Continue receiving
            self.forwardTCPToVsock()
        }
    }

    /// Forward data from vsock to TCP.
    private func forwardVsockToTCP() {
        guard isActive else { return }

        queue.async { [weak self] in
            guard let self = self, self.isActive else { return }

            // Read from vsock using FileDescriptor
            var buffer = [UInt8](repeating: 0, count: 65536)

            do {
                let bytesRead = try self.vsockFileDescriptor.read(into: &buffer, maxLength: buffer.count)

                if bytesRead > 0 {
                    // Forward data to TCP
                    let data = Data(buffer[..<bytesRead])
                    self.writeToTCP(data)

                    // Continue receiving
                    self.forwardVsockToTCP()
                } else {
                    // Connection closed
                    NSLog("[ProxyConnection] Vsock connection closed (read 0 bytes)")
                    self.stop()
                }
            } catch {
                NSLog("[ProxyConnection] Vsock read error: \(error)")
                self.stop()
            }
        }
    }

    /// Write data to vsock.
    private func writeToVsock(_ data: Data) {
        queue.async { [weak self] in
            guard let self = self, self.isActive else { return }

            do {
                var buffer = [UInt8](repeating: 0, count: data.count)
                data.copyBytes(to: &buffer, count: data.count)

                let bytesWritten = try self.vsockFileDescriptor.write(buffer, maxLength: buffer.count)

                if bytesWritten != buffer.count {
                    NSLog("[ProxyConnection] Warning: Partial write to vsock (\(bytesWritten)/\(buffer.count) bytes)")
                }
            } catch {
                NSLog("[ProxyConnection] Vsock write error: \(error)")
                self.stop()
            }
        }
    }

    /// Write data to TCP.
    private func writeToTCP(_ data: Data) {
        tcpConnection.send(content: data, completion: .contentProcessed({ [weak self] error in
            if let error = error {
                NSLog("[ProxyConnection] TCP send error: \(error)")
                self?.stop()
            }
        }))
    }
}

// MARK: - FileDescriptor Extension for Vsock I/O

/// FileDescriptor wrapper for vsock I/O operations.
///
/// VZVirtioSocketConnection provides a raw file descriptor for I/O.
/// This extension provides convenient read/write methods.
private struct FileDescriptor {
    let rawValue: Int32

    /// Read data from the file descriptor.
    ///
    /// - Parameters:
    ///   - buffer: Buffer to read into
    ///   - maxLength: Maximum bytes to read
    /// - Returns: Number of bytes read, or 0 if EOF
    /// - Throws: POSIX errors
    func read(into buffer: inout [UInt8], maxLength: Int) throws -> Int {
        let bytesRead = Darwin.read(rawValue, &buffer, maxLength)

        if bytesRead < 0 {
            throw POSIXError(errno)
        }

        return bytesRead
    }

    /// Write data to the file descriptor.
    ///
    /// - Parameters:
    ///   - buffer: Buffer to write from
    ///   - maxLength: Maximum bytes to write
    /// - Returns: Number of bytes written
    /// - Throws: POSIX errors
    func write(_ buffer: [UInt8], maxLength: Int) throws -> Int {
        let bytesWritten = Darwin.write(rawValue, buffer, maxLength)

        if bytesWritten < 0 {
            throw POSIXError(errno)
        }

        return bytesWritten
    }
}

// MARK: - POSIXError Extension

private extension POSIXError {
    init(_ errorCode: Int32) {
        self.init(POSIXError.Code(rawValue: errorCode) ?? .ENODEV)
    }
}
