// main.swift - ContainerManager CLI

import Foundation
import ContainerManager

@available(macOS 14.0, *)
@main
struct ContainerCLI {
    static func main() async {
        let args = Array(CommandLine.arguments.dropFirst())
        guard !args.isEmpty else { printUsage(); return }
        switch args[0] {
        case "start": await handleStart(args: Array(args.dropFirst()))
        case "stop": await handleStop(args: Array(args.dropFirst()))
        case "restart": await handleRestart(args: Array(args.dropFirst()))
        case "status": await handleStatus(args: Array(args.dropFirst()))
        case "logs": await handleLogs(args: Array(args.dropFirst()))
        case "health": await handleHealth(args: Array(args.dropFirst()))
        case "query": await handleQuery(args: Array(args.dropFirst()))
        case "info": await handleInfo(args: Array(args.dropFirst()))
        case "help", "--help", "-h": printUsage()
        default: print("Unknown command: \(args[0])"); printUsage()
        }
    }

    static func handleStart(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        print("Starting \(containerType) container...")
        do {
            switch containerType {
            case "postgresql", "postgres", "pg":
                let container = PostgreSQLContainer()
                try await container.create()
                try await container.start()
                print("PostgreSQL container started successfully")
                print("Connection string: \(container.connectionString)")
                print("Password: \(container.password)")
            default: print("Unknown container type: \(containerType)")
            }
        } catch { print("Error starting container: \(error.localizedDescription)") }
    }

    static func handleStop(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        print("Stopping \(containerType) container...")
        do {
            switch containerType {
            case "postgresql", "postgres", "pg": let container = PostgreSQLContainer(); try await container.stop(); print("PostgreSQL container stopped")
            default: print("Unknown container type: \(containerType)")
            }
        } catch { print("Error stopping container: \(error.localizedDescription)") }
    }

    static func handleRestart(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        print("Restarting \(containerType) container...")
        do {
            switch containerType {
            case "postgresql", "postgres", "pg": let container = PostgreSQLContainer(); try await container.restart(); print("PostgreSQL container restarted")
            default: print("Unknown container type: \(containerType)")
            }
        } catch { print("Error restarting container: \(error.localizedDescription)") }
    }

    static func handleStatus(args: [String]) async {
        if let type = args.first {
            switch type {
            case "postgresql", "postgres", "pg": let container = PostgreSQLContainer(); print("PostgreSQL Status: \(container.status.description)")
            default: print("Unknown container type: \(type)")
            }
        } else {
            print("Container Status:")
            let pgContainer = PostgreSQLContainer()
            let pgHealthy = await pgContainer.healthCheck()
            print("  PostgreSQL: \(pgHealthy ? "healthy" : "not running")")
        }
    }

    static func handleLogs(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        let tailCount = args.count > 1 ? Int(args[1]) : 100
        do {
            switch containerType {
            case "postgresql", "postgres", "pg":
                let container = PostgreSQLContainer()
                let logs = try await container.logs(tail: tailCount)
                print(logs.isEmpty ? "No logs available" : logs)
            default: print("Unknown container type: \(containerType)")
            }
        } catch { print("Error fetching logs: \(error.localizedDescription)") }
    }

    static func handleHealth(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        switch containerType {
        case "postgresql", "postgres", "pg":
            let container = PostgreSQLContainer()
            let healthy = await container.healthCheck()
            print("PostgreSQL health: \(healthy ? "healthy" : "unhealthy")")
        default: print("Unknown container type: \(containerType)")
        }
    }

    static func handleQuery(args: [String]) async {
        guard !args.isEmpty else { print("Usage: container-cli query <SQL>"); return }
        do {
            let container = PostgreSQLContainer()
            print(try await container.query(args.joined(separator: " ")))
        } catch { print("Query error: \(error.localizedDescription)") }
    }

    static func handleInfo(args: [String]) async {
        let containerType = args.first ?? "postgresql"
        switch containerType {
        case "postgresql", "postgres", "pg":
            let container = PostgreSQLContainer()
            print("PostgreSQL Container Information")
            print("================================")
            print("Name: \(container.name)")
            print("Status: \(container.status.description)")
            print("Connection String: \(container.connectionString)")
            print("DSN: \(container.dsn)")
            print("\nConnection Info:")
            for (key, value) in container.connectionInfo { print("  \(key): \(value)") }
        default: print("Unknown container type: \(containerType)")
        }
    }

    static func printUsage() {
        print("""
        ContainerManager CLI - Swift-based container management

        Usage: container-cli <command> [container-type] [options]

        Commands:
          start <type>      Start a container
          stop <type>       Stop a container
          restart <type>    Restart a container
          status [type]     Show container status
          logs <type> [n]   Show container logs (last n lines)
          health <type>     Run health check
          query <SQL>       Execute SQL query (PostgreSQL)
          info <type>       Show container information
          help              Show this help message

        Container Types:
          postgresql, postgres, pg    PostgreSQL with pgvector

        Environment:
          Requires macOS 14+ and Apple silicon (M1/M2/M3/M4).
        """)
    }
}
