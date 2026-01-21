// MIT License - Datadog Integration
import Foundation
import os.log

/// Centralized logging that writes to both Console and Datadog-monitored file
class DatadogLogger {
    static let shared = DatadogLogger()
    
    private let logFilePath = "/Users/ryan.maclean/vibecode-webgui/logs/vibecode.log"
    private let fileHandle: FileHandle?
    private let osLogger = Logger(subsystem: "com.vibecode.app", category: "main")
    
    private init() {
        // Ensure log directory exists
        let logDir = (logFilePath as NSString).deletingLastPathComponent
        try? FileManager.default.createDirectory(atPath: logDir, withIntermediateDirectories: true)
        
        // Create or open log file
        if !FileManager.default.fileExists(atPath: logFilePath) {
            FileManager.default.createFile(atPath: logFilePath, contents: nil)
        }
        
        fileHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: logFilePath))
        fileHandle?.seekToEndOfFile()
        
        // Write init message directly to verify file works
        let initMsg = "{\"timestamp\":\"\(Date())\",\"level\":\"INFO\",\"message\":\"DatadogLogger initialized\",\"service\":\"vibecode\"}\n"
        if let data = initMsg.data(using: .utf8) {
            fileHandle?.write(data)
        }
        
        log("info", "DatadogLogger fully initialized", [:])
    }
    
    deinit {
        try? fileHandle?.close()
    }
    
    /// Log a structured message
    /// - Parameters:
    ///   - level: Log level (debug, info, warning, error)
    ///   - message: Log message
    ///   - attributes: Additional structured data
    func log(_ level: String, _ message: String, _ attributes: [String: Any] = [:]) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        
        // Build JSON log entry
        var logEntry: [String: Any] = [
            "timestamp": timestamp,
            "level": level.uppercased(),
            "message": message,
            "service": "vibecode",
            "source": "swift"
        ]
        
        // Merge attributes
        logEntry.merge(attributes) { _, new in new }
        
        // Convert to JSON
        if let jsonData = try? JSONSerialization.data(withJSONObject: logEntry, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            
            // Write to file for Datadog agent
            if let data = (jsonString + "\n").data(using: .utf8) {
                fileHandle?.write(data)
            }
            
            // Also log to macOS unified logging
            switch level.lowercased() {
            case "debug":
                osLogger.debug("\(message)")
            case "info":
                osLogger.info("\(message)")
            case "warning":
                osLogger.warning("\(message)")
            case "error":
                osLogger.error("\(message)")
            default:
                osLogger.log("\(message)")
            }
            
            // Also NSLog for Console.app
            NSLog("[\(level.uppercased())] \(message)")
        }
    }
    
    // Convenience methods
    func debug(_ message: String, _ attributes: [String: Any] = [:]) {
        log("debug", message, attributes)
    }
    
    func info(_ message: String, _ attributes: [String: Any] = [:]) {
        log("info", message, attributes)
    }
    
    func warning(_ message: String, _ attributes: [String: Any] = [:]) {
        log("warning", message, attributes)
    }
    
    func error(_ message: String, _ attributes: [String: Any] = [:]) {
        log("error", message, attributes)
    }
}

