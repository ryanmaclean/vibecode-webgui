//
// PTYManager.swift
// VibeCode
//
// Created: 2025-11-26
// Purpose: PTY (Pseudo-TTY) management for interactive terminal access to VMs
//

import Foundation
import Darwin

/// Manages pseudo-terminal (PTY) operations for VM console access.
///
/// PTYManager provides bidirectional terminal communication between the host
/// and VM guest through a pseudo-terminal device. This enables:
/// - Interactive shell sessions
/// - Terminal emulation (xterm, vt100, etc.)
/// - Terminal resize events (SIGWINCH)
/// - Control sequences (Ctrl+C, Ctrl+Z, etc.)
///
/// ## Usage
///
/// ```swift
/// let ptyManager = PTYManager()
///
/// do {
///     // Create PTY pair
///     try ptyManager.openPTY()
///
///     // Get file handles for VM serial port attachment
///     let readHandle = ptyManager.getSlaveReadHandle()
///     let writeHandle = ptyManager.getSlaveWriteHandle()
///
///     // Configure VM with PTY handles
///     let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
///     serial.attachment = VZFileHandleSerialPortAttachment(
///         fileHandleForReading: readHandle,
///         fileHandleForWriting: writeHandle
///     )
///
///     // Start terminal session
///     ptyManager.startSession { data in
///         print("Received from VM: \(String(data: data, encoding: .utf8) ?? "")")
///     }
/// } catch {
///     print("PTY error: \(error)")
/// }
/// ```
///
public class PTYManager {

    // MARK: - Properties

    /// Master side file descriptor (host side)
    private var masterFD: Int32 = -1

    /// Slave side file descriptor (VM side)
    private var slaveFD: Int32 = -1

    /// Path to the slave PTY device (e.g., /dev/ttys001)
    private var slavePath: String?

    /// File handle for master side reading
    private var masterReadHandle: FileHandle?

    /// File handle for master side writing
    private var masterWriteHandle: FileHandle?

    /// File handle for slave side reading (for VM)
    private var slaveReadHandle: FileHandle?

    /// File handle for slave side writing (for VM)
    private var slaveWriteHandle: FileHandle?

    /// Dispatch source for monitoring master side input
    private var readSource: DispatchSourceRead?

    /// Flag indicating if PTY is currently open
    private var isOpen: Bool = false

    /// Original terminal settings (for restoration)
    private var originalTermios: termios?

    /// Callback for data received from VM
    private var dataReceivedCallback: ((Data) -> Void)?

    // MARK: - Initialization

    /// Initialize a new PTYManager.
    public init() {
        VMLogger.debug("PTYManager initialized")
    }

    deinit {
        closePTY()
    }

    // MARK: - Public Methods

    /// Open a new pseudo-terminal pair.
    ///
    /// Creates a master/slave PTY pair using posix_openpt() and grantpt().
    /// The master side is used by the host, slave side by the VM.
    ///
    /// - Throws: PTYError if PTY creation fails
    public func openPTY() throws {
        guard !isOpen else {
            VMLogger.warning("PTY already open, ignoring openPTY request")
            return
        }

        VMLogger.info("Opening PTY pair")

        // Open master side of PTY
        masterFD = posix_openpt(O_RDWR | O_NOCTTY)
        guard masterFD >= 0 else {
            throw PTYError.failedToOpenMaster(errno: errno)
        }

        // Grant access to slave side
        guard grantpt(masterFD) == 0 else {
            close(masterFD)
            masterFD = -1
            throw PTYError.failedToGrantAccess(errno: errno)
        }

        // Unlock slave side
        guard unlockpt(masterFD) == 0 else {
            close(masterFD)
            masterFD = -1
            throw PTYError.failedToUnlock(errno: errno)
        }

        // Get slave path
        guard let slavePathPtr = ptsname(masterFD) else {
            close(masterFD)
            masterFD = -1
            throw PTYError.failedToGetSlavePath(errno: errno)
        }
        slavePath = String(cString: slavePathPtr)

        VMLogger.info("PTY created", metadata: [
            "master_fd": masterFD,
            "slave_path": slavePath ?? "unknown"
        ])

        // Open slave side
        guard let path = slavePath else {
            throw PTYError.invalidSlavePath
        }
        slaveFD = open(path, O_RDWR | O_NOCTTY)
        guard slaveFD >= 0 else {
            close(masterFD)
            masterFD = -1
            throw PTYError.failedToOpenSlave(errno: errno)
        }

        // Configure PTY settings
        try configurePTY()

        // Create file handles
        masterReadHandle = FileHandle(fileDescriptor: masterFD, closeOnDealloc: false)
        masterWriteHandle = FileHandle(fileDescriptor: masterFD, closeOnDealloc: false)
        slaveReadHandle = FileHandle(fileDescriptor: slaveFD, closeOnDealloc: false)
        slaveWriteHandle = FileHandle(fileDescriptor: slaveFD, closeOnDealloc: false)

        isOpen = true
        VMLogger.info("PTY pair opened successfully", metadata: [
            "master_fd": masterFD,
            "slave_fd": slaveFD,
            "slave_path": path
        ])
    }

    /// Close the pseudo-terminal pair.
    ///
    /// Closes both master and slave file descriptors and cleans up resources.
    public func closePTY() {
        guard isOpen else { return }

        VMLogger.info("Closing PTY pair")

        // Stop reading
        stopSession()

        // Close file handles
        masterReadHandle = nil
        masterWriteHandle = nil
        slaveReadHandle = nil
        slaveWriteHandle = nil

        // Close file descriptors
        if masterFD >= 0 {
            close(masterFD)
            masterFD = -1
        }

        if slaveFD >= 0 {
            close(slaveFD)
            slaveFD = -1
        }

        isOpen = false
        slavePath = nil

        VMLogger.info("PTY pair closed")
    }

    /// Start an interactive terminal session.
    ///
    /// Begins monitoring the master side for data from the VM and invokes
    /// the callback when data is received.
    ///
    /// - Parameter callback: Closure called when data is received from VM
    public func startSession(onDataReceived callback: @escaping (Data) -> Void) {
        guard isOpen else {
            VMLogger.warning("Cannot start session: PTY not open")
            return
        }

        VMLogger.info("Starting PTY session")
        dataReceivedCallback = callback

        // Create dispatch source for reading from master
        let queue = DispatchQueue(label: "com.vibecode.pty.read", qos: .userInitiated)
        readSource = DispatchSource.makeReadSource(fileDescriptor: masterFD, queue: queue)

        readSource?.setEventHandler { [weak self] in
            self?.handleMasterInput()
        }

        readSource?.setCancelHandler { [weak self] in
            VMLogger.debug("PTY read source cancelled")
            self?.readSource = nil
        }

        readSource?.resume()
        VMLogger.info("PTY session started")
    }

    /// Stop the interactive terminal session.
    ///
    /// Stops monitoring for data from the VM.
    public func stopSession() {
        guard readSource != nil else { return }

        VMLogger.info("Stopping PTY session")
        readSource?.cancel()
        readSource = nil
        dataReceivedCallback = nil
    }

    /// Write data to the VM (from host terminal input).
    ///
    /// Sends data to the VM through the master side of the PTY.
    ///
    /// - Parameter data: Data to send to VM
    /// - Throws: PTYError if write fails
    public func writeToVM(_ data: Data) throws {
        guard isOpen else {
            throw PTYError.notOpen
        }

        guard let handle = masterWriteHandle else {
            throw PTYError.invalidHandle
        }

        try handle.write(contentsOf: data)
    }

    /// Write string to the VM (from host terminal input).
    ///
    /// Convenience method to send text to the VM.
    ///
    /// - Parameter string: String to send to VM
    /// - Throws: PTYError if write fails
    public func writeToVM(_ string: String) throws {
        guard let data = string.data(using: .utf8) else {
            throw PTYError.invalidString
        }
        try writeToVM(data)
    }

    /// Get the slave side read file handle (for VM configuration).
    ///
    /// Use this handle for VZFileHandleSerialPortAttachment.fileHandleForReading
    ///
    /// - Returns: FileHandle for slave side reading
    public func getSlaveReadHandle() -> FileHandle? {
        return slaveReadHandle
    }

    /// Get the slave side write file handle (for VM configuration).
    ///
    /// Use this handle for VZFileHandleSerialPortAttachment.fileHandleForWriting
    ///
    /// - Returns: FileHandle for slave side writing
    public func getSlaveWriteHandle() -> FileHandle? {
        return slaveWriteHandle
    }

    /// Get the path to the slave PTY device.
    ///
    /// - Returns: Path like "/dev/ttys001" or nil if not open
    public func getSlavePath() -> String? {
        return slavePath
    }

    /// Set terminal window size.
    ///
    /// Sends SIGWINCH to update terminal dimensions for proper display.
    ///
    /// - Parameters:
    ///   - rows: Number of rows (height)
    ///   - cols: Number of columns (width)
    /// - Throws: PTYError if ioctl fails
    public func setWindowSize(rows: UInt16, cols: UInt16) throws {
        guard isOpen else {
            throw PTYError.notOpen
        }

        var winsize = Darwin.winsize(
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0
        )

        let result = ioctl(masterFD, TIOCSWINSZ, &winsize)
        guard result == 0 else {
            throw PTYError.failedToSetWindowSize(errno: errno)
        }

        VMLogger.debug("Window size updated", metadata: [
            "rows": rows,
            "cols": cols
        ])
    }

    /// Configure the PTY for raw mode terminal operation.
    ///
    /// Sets terminal to raw mode for proper handling of control sequences.
    ///
    /// - Throws: PTYError if configuration fails
    private func configurePTY() throws {
        var term = termios()

        // Get current settings
        guard tcgetattr(masterFD, &term) == 0 else {
            throw PTYError.failedToGetTermios(errno: errno)
        }

        // Save original settings
        originalTermios = term

        // Configure for raw mode
        // Input: no processing
        term.c_iflag &= ~tcflag_t(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL | IXON)

        // Output: no processing
        term.c_oflag &= ~tcflag_t(OPOST)

        // Control: 8-bit chars
        term.c_cflag &= ~tcflag_t(CSIZE | PARENB)
        term.c_cflag |= tcflag_t(CS8)

        // Local: raw mode
        term.c_lflag &= ~tcflag_t(ECHO | ECHONL | ICANON | ISIG | IEXTEN)

        // Set min chars and timeout
        term.c_cc.16 = 1  // VMIN
        term.c_cc.17 = 0  // VTIME

        // Apply settings
        guard tcsetattr(masterFD, TCSANOW, &term) == 0 else {
            throw PTYError.failedToSetTermios(errno: errno)
        }

        VMLogger.debug("PTY configured for raw mode")
    }

    /// Handle input from master side (data from VM).
    private func handleMasterInput() {
        guard let handle = masterReadHandle else { return }

        // Read available data (non-blocking)
        let bufferSize = 4096
        var buffer = Data(count: bufferSize)

        let bytesRead = buffer.withUnsafeMutableBytes { ptr -> Int in
            guard let baseAddress = ptr.baseAddress else { return 0 }
            return read(masterFD, baseAddress, bufferSize)
        }

        if bytesRead > 0 {
            let data = buffer.prefix(bytesRead)
            dataReceivedCallback?(data)
        } else if bytesRead < 0 && errno != EAGAIN && errno != EWOULDBLOCK {
            VMLogger.warning("PTY read error", metadata: ["errno": errno])
        }
    }
}

// MARK: - Error Types

/// Errors that can occur during PTY operations.
public enum PTYError: LocalizedError {
    case failedToOpenMaster(errno: Int32)
    case failedToGrantAccess(errno: Int32)
    case failedToUnlock(errno: Int32)
    case failedToGetSlavePath(errno: Int32)
    case failedToOpenSlave(errno: Int32)
    case failedToGetTermios(errno: Int32)
    case failedToSetTermios(errno: Int32)
    case failedToSetWindowSize(errno: Int32)
    case invalidSlavePath
    case notOpen
    case invalidHandle
    case invalidString

    public var errorDescription: String? {
        switch self {
        case .failedToOpenMaster(let errno):
            return "Failed to open PTY master: errno=\(errno)"
        case .failedToGrantAccess(let errno):
            return "Failed to grant PTY access: errno=\(errno)"
        case .failedToUnlock(let errno):
            return "Failed to unlock PTY: errno=\(errno)"
        case .failedToGetSlavePath(let errno):
            return "Failed to get PTY slave path: errno=\(errno)"
        case .failedToOpenSlave(let errno):
            return "Failed to open PTY slave: errno=\(errno)"
        case .failedToGetTermios(let errno):
            return "Failed to get terminal settings: errno=\(errno)"
        case .failedToSetTermios(let errno):
            return "Failed to set terminal settings: errno=\(errno)"
        case .failedToSetWindowSize(let errno):
            return "Failed to set window size: errno=\(errno)"
        case .invalidSlavePath:
            return "Invalid PTY slave path"
        case .notOpen:
            return "PTY is not open"
        case .invalidHandle:
            return "Invalid file handle"
        case .invalidString:
            return "Invalid string encoding"
        }
    }
}
