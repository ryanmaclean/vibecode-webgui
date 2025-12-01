import Foundation

/// Comprehensive logging for VM operations with Datadog integration
public class VMLogger {
    private static let logFile = FileManager.default.temporaryDirectory
        .appendingPathComponent("vibecode-vm.log")

    private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    public enum Level: String {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARN"
        case error = "ERROR"
        case critical = "CRITICAL"
    }

    /// Log a message with level, category, and optional metadata
    public static func log(
        _ level: Level,
        _ message: String,
        category: String = "VM",
        file: String = #file,
        function: String = #function,
        line: Int = #line,
        metadata: [String: Any]? = nil
    ) {
        let timestamp = dateFormatter.string(from: Date())
        let fileName = (file as NSString).lastPathComponent

        // Format: [TIMESTAMP] [LEVEL] [CATEGORY] Message (file:line function)
        var logMessage = "[\(timestamp)] [\(level.rawValue)] [\(category)] \(message)"
        logMessage += " (\(fileName):\(line) \(function))"

        if let metadata = metadata {
            logMessage += " metadata=\(metadata)"
        }

        // Write to file
        writeToFile(logMessage)

        // NSLog for system console
        NSLog("[VM] \(logMessage)")

        // Send to Datadog if available
        sendToDatadog(level: level, message: message, metadata: metadata)
    }

    /// Convenience methods
    public static func debug(_ message: String, category: String = "VM", metadata: [String: Any]? = nil) {
        log(.debug, message, category: category, metadata: metadata)
    }

    public static func info(_ message: String, category: String = "VM", metadata: [String: Any]? = nil) {
        log(.info, message, category: category, metadata: metadata)
    }

    public static func warning(_ message: String, category: String = "VM", metadata: [String: Any]? = nil) {
        log(.warning, message, category: category, metadata: metadata)
    }

    public static func error(_ message: String, category: String = "VM", metadata: [String: Any]? = nil) {
        log(.error, message, category: category, metadata: metadata)
    }

    public static func critical(_ message: String, category: String = "VM", metadata: [String: Any]? = nil) {
        log(.critical, message, category: category, metadata: metadata)
    }

    /// Log an error with full stack trace
    public static func logError(_ error: Error, context: String, metadata: [String: Any]? = nil) {
        var fullMetadata = metadata ?? [:]
        fullMetadata["error_type"] = String(describing: type(of: error))
        fullMetadata["error_description"] = error.localizedDescription

        if let nsError = error as NSError? {
            fullMetadata["domain"] = nsError.domain
            fullMetadata["code"] = nsError.code
            fullMetadata["userInfo"] = nsError.userInfo
        }

        self.error("\(context): \(error)", metadata: fullMetadata)
    }

    // MARK: - File Writing

    private static func writeToFile(_ message: String) {
        let line = message + "\n"

        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: logFile.path) {
                // Append to existing file
                if let fileHandle = try? FileHandle(forWritingTo: logFile) {
                    fileHandle.seekToEndOfFile()
                    fileHandle.write(data)
                    fileHandle.closeFile()
                }
            } else {
                // Create new file
                try? data.write(to: logFile)
            }
        }
    }

    // MARK: - Datadog Integration

    private static func sendToDatadog(level: Level, message: String, metadata: [String: Any]?) {
        // Check if DD_API_KEY is available
        guard let ddApiKey = ProcessInfo.processInfo.environment["DD_API_KEY"],
              !ddApiKey.isEmpty else {
            return // Silently skip if no DD key
        }

        let ddSite = ProcessInfo.processInfo.environment["DD_SITE"] ?? "datadoghq.com"

        // Construct Datadog log entry
        var logEntry: [String: Any] = [
            "message": message,
            "level": level.rawValue.lowercased(),
            "ddsource": "vibecode-vm",
            "service": "vibecode",
            "hostname": Host.current().localizedName ?? "unknown",
            "timestamp": Date().timeIntervalSince1970 * 1000 // milliseconds
        ]

        if let metadata = metadata {
            logEntry.merge(metadata) { (_, new) in new }
        }

        // Send to Datadog Logs API (async, don't block)
        DispatchQueue.global(qos: .utility).async {
            sendToDatadogAPI(apiKey: ddApiKey, site: ddSite, logEntry: logEntry)
        }
    }

    private static func sendToDatadogAPI(apiKey: String, site: String, logEntry: [String: Any]) {
        guard let url = URL(string: "https://http-intake.logs.\(site)/api/v2/logs") else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "DD-API-KEY")

        guard let jsonData = try? JSONSerialization.data(withJSONObject: [logEntry]) else {
            return
        }

        request.httpBody = jsonData

        let task = URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                NSLog("[VMLogger] Failed to send to Datadog: \(error)")
            } else if let httpResponse = response as? HTTPURLResponse,
                      !(200...299).contains(httpResponse.statusCode) {
                NSLog("[VMLogger] Datadog returned status: \(httpResponse.statusCode)")
            }
        }
        task.resume()
    }

    // MARK: - Log File Access

    /// Get the path to the log file
    public static func getLogFilePath() -> String {
        return logFile.path
    }

    /// Read the last N lines from the log file
    public static func tailLog(lines: Int = 100) -> String? {
        guard let content = try? String(contentsOf: logFile, encoding: .utf8) else {
            return nil
        }

        let allLines = content.components(separatedBy: .newlines)
        let lastLines = allLines.suffix(lines)
        return lastLines.joined(separator: "\n")
    }

    /// Clear the log file
    public static func clearLog() {
        try? FileManager.default.removeItem(at: logFile)
    }
}
