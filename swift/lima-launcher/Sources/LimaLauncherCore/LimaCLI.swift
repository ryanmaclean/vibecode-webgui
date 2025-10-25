import Foundation

public enum LimaLauncherError: Error, LocalizedError {
  case limactlMissing
  case commandFailed(Int32, String)

  public var errorDescription: String? {
    switch self {
    case .limactlMissing:
      return "limactl not found in PATH. Install Lima: brew install lima"
    case .commandFailed(let code, let output):
      return "limactl exited with code \(code): \(output)"
    }
  }
}

public struct LimaCommandRunner {
  private let limactlPath: String

  public init() throws {
    if let resolved = LimaCommandRunner.resolveLimactl() {
      self.limactlPath = resolved
    } else {
      throw LimaLauncherError.limactlMissing
    }
  }

  public func run(arguments: [String]) throws -> String {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: limactlPath)
    process.arguments = arguments

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    try process.run()
    process.waitUntilExit()

    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    let output = String(data: data, encoding: .utf8) ?? ""

    if process.terminationStatus != 0 {
      throw LimaLauncherError.commandFailed(process.terminationStatus, output.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    return output.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func resolveLimactl() -> String? {
    if let which = try? runWhich("limactl"), !which.isEmpty {
      return which
    }
    let candidates = [
      "/opt/homebrew/bin/limactl",
      "/usr/local/bin/limactl"
    ]
    return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
  }

  private static func runWhich(_ command: String) throws -> String? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
    process.arguments = [command]

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = Pipe()

    try process.run()
    process.waitUntilExit()

    if process.terminationStatus == 0 {
      let data = pipe.fileHandleForReading.readDataToEndOfFile()
      return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return nil
  }
}

public struct LimaOptions {
  public let name: String
  public let configPath: String

  public init(name: String = "ide-lima", configPath: String = "vm-assets/ide-lima.yaml") {
    self.name = name
    self.configPath = configPath
  }
}

public final class LimaLifecycleManager {
  private let runner: LimaCommandRunner
  private let options: LimaOptions

  public init(options: LimaOptions) throws {
    self.runner = try LimaCommandRunner()
    self.options = options
  }

  public func start() throws -> String {
    let path = expandPath(options.configPath)
    var args: [String]
    if FileManager.default.fileExists(atPath: path) && !instanceExists() {
      args = ["start", "--name", options.name, "--tty=false", path]
    } else {
      args = ["start", options.name, "--tty=false"]
    }
    let _ = try runner.run(arguments: args)
    return "Lima VM \(options.name) started"
  }

  public func stop() throws -> String {
    let _ = try runner.run(arguments: ["stop", options.name])
    return "Lima VM \(options.name) stopped"
  }

  public func status() throws -> String {
    return try runner.run(arguments: ["list"])
  }

  public func shell(command: String?) throws -> String {
    var args = ["shell", options.name]
    if let cmd = command {
      args.append(cmd)
    }
    return try runner.run(arguments: args)
  }

  public func forward(localPort: Int, remotePort: Int = 8080) throws -> String {
    let listen = "127.0.0.1:\(localPort)"
    let remote = "localhost:\(remotePort)"
    let output = try runner.run(arguments: ["shell", options.name, "ssh", "-N", "-L", "\(listen):\(remote)"])
    return output
  }

  private func expandPath(_ path: String) -> String {
    if path.hasPrefix("~") {
      let home = FileManager.default.homeDirectoryForCurrentUser.path
      return home + String(path.dropFirst())
    }
    if path.hasPrefix("/") {
      return path
    }
    let repoRoot = FileManager.default.currentDirectoryPath
    return URL(fileURLWithPath: repoRoot).appendingPathComponent(path).path
  }

  private func instanceExists() -> Bool {
    let limaDir = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent(".lima")
      .appendingPathComponent(options.name)
    return FileManager.default.fileExists(atPath: limaDir.path)
  }
}
