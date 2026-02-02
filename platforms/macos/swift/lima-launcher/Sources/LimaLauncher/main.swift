import ArgumentParser
import Foundation
import LimaLauncherCore

@main
struct LimaLauncher: ParsableCommand {
  static var configuration = CommandConfiguration(
    commandName: "lima-launcher",
    abstract: "Swift wrapper for limactl to manage code-server VMs",
    subcommands: [Start.self, Stop.self, Status.self, Shell.self, Forward.self]
  )
}

struct CommonOptions: ParsableArguments {
  @Option(name: .shortAndLong, help: "Name of the Lima instance")
  var name: String = "ide-lima"

  @Option(name: .shortAndLong, help: "Path to Lima YAML config")
  var config: String = "vm-assets/ide-lima.yaml"
}

struct Start: ParsableCommand {
  static var configuration = CommandConfiguration(abstract: "Start the Lima VM using the provided config")
  @OptionGroup var options: CommonOptions

  func run() throws {
    let manager = try LimaLifecycleManager(options: LimaOptions(name: options.name, configPath: options.config))
    print(try manager.start())
  }
}

struct Stop: ParsableCommand {
  static var configuration = CommandConfiguration(abstract: "Stop the Lima VM")
  @OptionGroup var options: CommonOptions

  func run() throws {
    let manager = try LimaLifecycleManager(options: LimaOptions(name: options.name, configPath: options.config))
    print(try manager.stop())
  }
}

struct Status: ParsableCommand {
  static var configuration = CommandConfiguration(abstract: "Show lima info output for the instance")
  @OptionGroup var options: CommonOptions

  func run() throws {
    let manager = try LimaLifecycleManager(options: LimaOptions(name: options.name, configPath: options.config))
    print(try manager.status())
  }
}

struct Shell: ParsableCommand {
  static var configuration = CommandConfiguration(abstract: "Open a shell inside the lima VM")
  @OptionGroup var options: CommonOptions

  @Argument(help: "Optional shell command to execute")
  var command: String?

  func run() throws {
    let manager = try LimaLifecycleManager(options: LimaOptions(name: options.name, configPath: options.config))
    print(try manager.shell(command: command))
  }
}

struct Forward: ParsableCommand {
  static var configuration = CommandConfiguration(abstract: "Create an SSH tunnel for code-server port 8080")
  @OptionGroup var options: CommonOptions

  @Option(name: .shortAndLong, help: "Local port to expose (defaults to 8080)")
  var port: Int = 8080

  func run() throws {
    let manager = try LimaLifecycleManager(options: LimaOptions(name: options.name, configPath: options.config))
    _ = try manager.forward(localPort: port, remotePort: 8080)
    print("Port forwarded. Open http://127.0.0.1:\(port) to reach code-server.")
  }
}
