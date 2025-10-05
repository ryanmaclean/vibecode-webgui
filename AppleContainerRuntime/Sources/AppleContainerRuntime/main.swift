import Foundation
import Virtualization
import ArgumentParser

@main
@available(macOS 14.0, *)
struct AppleContainerRuntime: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "apple-container-runtime",
        abstract: "Production Apple Containerization runtime for agentapi deployment",
        version: "2.0.0",
        subcommands: [
            Run.self,
            Stop.self,
            Remove.self,
            List.self,
            Inspect.self,
            Logs.self,
            Pull.self,
        ]
    )
}

// MARK: - Run Command

extension AppleContainerRuntime {
    struct Run: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Start a new container from an OCI image"
        )

        @Argument(help: "OCI image reference (e.g., ghcr.io/org/image:tag)")
        var image: String

        @Option(name: .shortAndLong, help: "Container name")
        var name: String?

        @Option(name: .shortAndLong, parsing: .upToNextOption, help: "Port mappings (host:container)")
        var port: [String] = []

        @Option(name: .shortAndLong, parsing: .upToNextOption, help: "Environment variables (KEY=VALUE)")
        var env: [String] = []

        @Option(name: .shortAndLong, parsing: .upToNextOption, help: "Volume mounts (host:container)")
        var volume: [String] = []

        @Option(help: "CPU count (default: 2)")
        var cpus: Int = 2

        @Option(help: "Memory in MB (default: 2048)")
        var memory: Int = 2048

        @Flag(name: .shortAndLong, help: "Run in detached mode")
        var detach: Bool = false

        @Flag(help: "Remove container after exit")
        var rm: Bool = false

        func run() async throws {
            let runtime = ContainerRuntime.shared

            let config = ContainerConfiguration(
                image: image,
                name: name ?? UUID().uuidString.prefix(12).lowercased(),
                cpuCount: cpus,
                memorySize: UInt64(memory) * 1024 * 1024,
                portMappings: parsePortMappings(port),
                environmentVariables: parseEnvironment(env),
                volumeMounts: parseVolumes(volume),
                removeOnExit: rm
            )

            let containerId = try await runtime.createContainer(config: config)

            if detach {
                print(containerId)
            } else {
                // Attach to container output
                try await runtime.attachContainer(id: containerId)
            }
        }

        private func parsePortMappings(_ ports: [String]) -> [PortMapping] {
            ports.compactMap { portString in
                let parts = portString.split(separator: ":")
                guard parts.count == 2,
                      let host = UInt16(parts[0]),
                      let container = UInt16(parts[1]) else {
                    return nil
                }
                return PortMapping(hostPort: host, containerPort: container)
            }
        }

        private func parseEnvironment(_ envVars: [String]) -> [String: String] {
            var result: [String: String] = [:]
            for envVar in envVars {
                let parts = envVar.split(separator: "=", maxSplits: 1)
                if parts.count == 2 {
                    result[String(parts[0])] = String(parts[1])
                }
            }
            return result
        }

        private func parseVolumes(_ volumes: [String]) -> [VolumeMount] {
            volumes.compactMap { volumeString in
                let parts = volumeString.split(separator: ":")
                guard parts.count == 2 else { return nil }
                return VolumeMount(
                    hostPath: String(parts[0]),
                    containerPath: String(parts[1])
                )
            }
        }
    }
}

// MARK: - Stop Command

extension AppleContainerRuntime {
    struct Stop: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Stop a running container"
        )

        @Argument(help: "Container ID or name")
        var container: String

        @Option(name: .shortAndLong, help: "Seconds to wait before killing (default: 10)")
        var timeout: Int = 10

        func run() async throws {
            let runtime = ContainerRuntime.shared
            try await runtime.stopContainer(id: container, timeout: TimeInterval(timeout))
            print("Container stopped: \(container)")
        }
    }
}

// MARK: - Remove Command

extension AppleContainerRuntime {
    struct Remove: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Remove a container"
        )

        @Argument(help: "Container ID or name")
        var container: String

        @Flag(name: .shortAndLong, help: "Force removal of running container")
        var force: Bool = false

        func run() async throws {
            let runtime = ContainerRuntime.shared

            if force {
                try? await runtime.stopContainer(id: container, timeout: 0)
            }

            try await runtime.removeContainer(id: container)
            print("Container removed: \(container)")
        }
    }
}

// MARK: - List Command

extension AppleContainerRuntime {
    struct List: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "List all containers"
        )

        @Flag(help: "Output as JSON")
        var json: Bool = false

        @Flag(name: .shortAndLong, help: "Show all containers (default shows running)")
        var all: Bool = false

        func run() async throws {
            let runtime = ContainerRuntime.shared
            let containers = try await runtime.listContainers(all: all)

            if json {
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                let data = try encoder.encode(containers)
                if let jsonString = String(data: data, encoding: .utf8) {
                    print(jsonString)
                }
            } else {
                // Table format
                print(String(format: "%-12s %-30s %-15s %-15s %-20s",
                            "ID", "IMAGE", "STATE", "IP", "CREATED"))

                for container in containers {
                    print(String(format: "%-12s %-30s %-15s %-15s %-20s",
                                String(container.id.prefix(12)),
                                String(container.image.prefix(30)),
                                container.state.rawValue,
                                container.ipAddress ?? "N/A",
                                formatDate(container.created)))
                }
            }
        }

        private func formatDate(_ date: Date) -> String {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return formatter.localizedString(for: date, relativeTo: Date())
        }
    }
}

// MARK: - Inspect Command

extension AppleContainerRuntime {
    struct Inspect: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Display detailed information about a container"
        )

        @Argument(help: "Container ID or name")
        var container: String

        func run() async throws {
            let runtime = ContainerRuntime.shared
            let info = try await runtime.inspectContainer(id: container)

            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601

            let data = try encoder.encode(info)
            if let jsonString = String(data: data, encoding: .utf8) {
                print(jsonString)
            }
        }
    }
}

// MARK: - Logs Command

extension AppleContainerRuntime {
    struct Logs: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Fetch logs from a container"
        )

        @Argument(help: "Container ID or name")
        var container: String

        @Flag(name: .shortAndLong, help: "Follow log output")
        var follow: Bool = false

        @Option(help: "Number of lines to show from the end (default: all)")
        var tail: Int?

        func run() async throws {
            let runtime = ContainerRuntime.shared

            if follow {
                try await runtime.streamLogs(id: container) { line in
                    print(line)
                }
            } else {
                let logs = try await runtime.getLogs(id: container, tail: tail)
                print(logs)
            }
        }
    }
}

// MARK: - Pull Command

extension AppleContainerRuntime {
    struct Pull: AsyncParsableCommand {
        static let configuration = CommandConfiguration(
            abstract: "Pull an OCI image from a registry"
        )

        @Argument(help: "OCI image reference")
        var image: String

        @Flag(help: "Show progress output")
        var progress: Bool = true

        func run() async throws {
            let runtime = ContainerRuntime.shared

            try await runtime.pullImage(reference: image) { progress in
                if self.progress {
                    print("Downloading: \(progress.percentComplete)%")
                }
            }

            print("Image pulled: \(image)")
        }
    }
}
