import Foundation
import SwiftUI
import AppKit
import ServiceManagement

public final class IDEProcessManager: ObservableObject {
    @Published public var isRunning = false
    @Published public var status = "Stopped"
    @Published public var port: Int = 8080

    public var preferences: IDEPreferences = IDEPreferences()

    private var process: Process?
    private var logHandle: FileHandle?
    private var healthTimer: Timer?

    public init() {}

    public func start(workspace: String? = nil) {
        if isRunning { return }
        let ws = workspace ?? preferences.workspacePath
        self.port = preferences.port
        guard let bin = locateBinary() else {
            status = "IDE binary not found"
            return
        }
        let fm = FileManager.default
        let supportDir = fm.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/VibeCode/ide")
        let userDataDir = supportDir.appendingPathComponent("user-data")
        let extDir = supportDir.appendingPathComponent("extensions")
        try? fm.createDirectory(at: userDataDir, withIntermediateDirectories: true)
        try? fm.createDirectory(at: extDir, withIntermediateDirectories: true)
        let logsDir = fm.homeDirectoryForCurrentUser
            .appendingPathComponent("vibecode-webgui/logs")
        try? fm.createDirectory(at: logsDir, withIntermediateDirectories: true)
        let logURL = logsDir.appendingPathComponent("vibecode-server.log")
        if !fm.fileExists(atPath: logURL.path) { fm.createFile(atPath: logURL.path, contents: nil) }
        logHandle = try? FileHandle(forWritingTo: logURL)
        logHandle?.seekToEndOfFile()

        let (args, env) = buildLaunch(
            binary: bin,
            port: port,
            userDataDir: userDataDir.path,
            extensionsDir: extDir.path,
            workspace: ws
        )
        let p = Process()
        p.executableURL = bin
        p.arguments = args
        p.environment = env
        let pipe = Pipe()
        p.standardOutput = pipe
        p.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] fh in
            let data = fh.availableData
            if data.count > 0 {
                self?.logHandle?.write(data)
            }
        }
        p.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                self?.isRunning = false
                self?.status = "Stopped"
                self?.healthTimer?.invalidate()
            }
        }
        do {
            try p.run()
            process = p
            isRunning = true
            status = "Running on http://127.0.0.1:\(port)"
            scheduleHealthChecks()
        } catch {
            status = "Failed to start: \(error.localizedDescription)"
        }
    }

    public func stop() {
        guard let p = process, isRunning else { return }
        p.terminate()
        process = nil
        isRunning = false
        status = "Stopped"
        healthTimer?.invalidate()
    }

    public func openInBrowser() {
        let url = URL(string: "http://127.0.0.1:\(port)")!
        NSWorkspace.shared.open(url)
    }

    public func openLogs() {
        let logsDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("vibecode-webgui/logs")
        NSWorkspace.shared.open(logsDir)
    }

    public func updateLoginItem() {
        if preferences.launchAtLogin {
            try? SMAppService.mainApp.register()
        } else {
            try? SMAppService.mainApp.unregister()
        }
    }

    private func locateBinary() -> URL? {
        if !preferences.binaryPath.isEmpty {
            return URL(fileURLWithPath: preferences.binaryPath)
        }

        if let custom = ProcessInfo.processInfo.environment["VIBECODE_IDE_BIN"], !custom.isEmpty {
            return URL(fileURLWithPath: custom)
        }

        var candidateURLs: [URL] = []

        if let auxiliary = Bundle.main.url(forAuxiliaryExecutable: "vibecode") {
            candidateURLs.append(auxiliary)
        }

        if let bundled = Bundle.main.bundleURL
            .appendingPathComponent("Contents/MacOS/vibecode", isDirectory: false)
            .existingFileURL
        {
            candidateURLs.append(bundled)
        }

        let supportBin = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/VibeCode/bin/vibecode")
        candidateURLs.append(supportBin)

        let searchPaths = [
            "/opt/homebrew/bin/vibecode",
            "/usr/local/bin/vibecode",
            "/opt/homebrew/bin/openvscode-server",
            "/usr/local/bin/openvscode-server",
            "/opt/homebrew/bin/code-server",
            "/usr/local/bin/code-server"
        ]
        candidateURLs.append(contentsOf: searchPaths.map { URL(fileURLWithPath: $0) })

        for url in candidateURLs where FileManager.default.isExecutableFile(atPath: url.path) {
            return url
        }

        return nil
    }

    private func scheduleHealthChecks() {
        healthTimer?.invalidate()
        healthTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            let url = URL(string: "http://127.0.0.1:\(self.port)/")!
            var req = URLRequest(url: url)
            req.timeoutInterval = 2.0
            URLSession.shared.dataTask(with: req) { _, resp, _ in
                DispatchQueue.main.async {
                    if (resp as? HTTPURLResponse)?.statusCode ?? 0 > 0 {
                        self.status = "Running on http://127.0.0.1:\(self.port)"
                    }
                }
            }.resume()
        }
    }

    public func buildLaunch(binary: URL, port: Int, userDataDir: String, extensionsDir: String, workspace: String?) -> ([String], [String:String]) {
        let host = "127.0.0.1"
        var args: [String] = []
        if binary.lastPathComponent.contains("vibecode") {
            args = [
                "serve-web",
                "--host", host,
                "--port", String(port),
                "--without-connection-token",
                "--disable-telemetry",
                "--user-data-dir", userDataDir,
                "--extensions-dir", extensionsDir
            ]
            if let ws = workspace, !ws.isEmpty {
                args += ["--", ws]
            }
        } else if binary.lastPathComponent.contains("openvscode-server") {
            args = ["--host", host, "--port", String(port), "--without-connection-token", "--disable-telemetry", "--user-data-dir", userDataDir, "--extensions-dir", extensionsDir]
            if let ws = workspace, !ws.isEmpty { args += ["--", ws] }
        } else if binary.lastPathComponent.contains("code-server") {
            args = ["--bind-addr", "\(host):\(port)", "--disable-telemetry", "--user-data-dir", userDataDir, "--extensions-dir", extensionsDir]
            if let ws = workspace, !ws.isEmpty { args += [ws] }
        }
        var env = ProcessInfo.processInfo.environment
        env["DD_SERVICE"] = env["DD_SERVICE"] ?? "vibecode"
        env["DD_ENV"] = env["DD_ENV"] ?? "vibecode"
        env["DD_LOGS_INJECTION"] = env["DD_LOGS_INJECTION"] ?? "true"
        if preferences.ddTraceEnabled {
            env["DD_TRACE_ENABLED"] = "true"
            env["NODE_OPTIONS"] = [env["NODE_OPTIONS"], "-r", "dd-trace/init"].compactMap { $0 }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        }
        return (args, env)
    }
}

private extension URL {
    var existingFileURL: URL? {
        FileManager.default.isExecutableFile(atPath: path) ? self : nil
    }
}
