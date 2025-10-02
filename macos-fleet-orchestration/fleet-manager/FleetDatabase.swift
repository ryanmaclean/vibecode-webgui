import Foundation
import SQLite3

// MARK: - Fleet Database

/// SQLite-based persistence for fleet state
public final class FleetDatabase {

    private let db: OpaquePointer?
    private let dbPath: String

    // MARK: - Initialization

    public init(url: URL) throws {
        self.dbPath = url.path

        var db: OpaquePointer?
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            throw DatabaseError.connectionFailed
        }

        self.db = db

        try createTables()
    }

    deinit {
        sqlite3_close(db)
    }

    // MARK: - Schema Creation

    private func createTables() throws {
        let hostsTable = """
        CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            hostname TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            architecture TEXT NOT NULL,
            total_cpu INTEGER NOT NULL,
            total_memory INTEGER NOT NULL,
            available_cpu INTEGER NOT NULL,
            available_memory INTEGER NOT NULL,
            status TEXT NOT NULL,
            last_heartbeat TEXT NOT NULL,
            registered_at TEXT NOT NULL,
            version TEXT NOT NULL,
            temperature REAL,
            is_throttling INTEGER,
            tags TEXT
        )
        """

        let containersTable = """
        CREATE TABLE IF NOT EXISTS containers (
            id TEXT PRIMARY KEY,
            agent_type TEXT NOT NULL,
            host_id TEXT NOT NULL,
            workspace TEXT NOT NULL,
            cpu INTEGER NOT NULL,
            memory INTEGER NOT NULL,
            qos_class TEXT NOT NULL,
            status TEXT NOT NULL,
            start_time TEXT NOT NULL,
            health_score REAL NOT NULL,
            pid INTEGER,
            exit_code INTEGER,
            restart_count INTEGER NOT NULL,
            FOREIGN KEY (host_id) REFERENCES hosts (id)
        )
        """

        let eventsTable = """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT
        )
        """

        try execute(sql: hostsTable)
        try execute(sql: containersTable)
        try execute(sql: eventsTable)

        // Create indices
        try execute(sql: "CREATE INDEX IF NOT EXISTS idx_hosts_status ON hosts(status)")
        try execute(sql: "CREATE INDEX IF NOT EXISTS idx_containers_host ON containers(host_id)")
        try execute(sql: "CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status)")
        try execute(sql: "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)")
    }

    // MARK: - Host Operations

    public func saveHost(_ host: MacHost) async throws {
        let sql = """
        INSERT OR REPLACE INTO hosts
        (id, hostname, ip_address, architecture, total_cpu, total_memory,
         available_cpu, available_memory, status, last_heartbeat, registered_at,
         version, temperature, is_throttling, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        let tagsJSON = try? JSONEncoder().encode(host.tags)
        let tagsString = tagsJSON.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

        try execute(
            sql: sql,
            parameters: [
                host.id.uuidString,
                host.hostname,
                host.ipAddress,
                host.architecture,
                host.totalCPU,
                host.totalMemory,
                host.availableCPU,
                host.availableMemory,
                host.status.rawValue,
                ISO8601DateFormatter().string(from: host.lastHeartbeat),
                ISO8601DateFormatter().string(from: host.registeredAt),
                host.version,
                host.temperature ?? 0,
                host.isThrottling ? 1 : 0,
                tagsString
            ]
        )
    }

    public func updateHost(_ host: MacHost) async throws {
        try await saveHost(host)
    }

    public func deleteHost(_ id: UUID) async throws {
        let sql = "DELETE FROM hosts WHERE id = ?"
        try execute(sql: sql, parameters: [id.uuidString])
    }

    public func loadHosts() async throws -> [MacHost] {
        let sql = "SELECT * FROM hosts"
        var hosts: [MacHost] = []

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.queryFailed
        }

        defer { sqlite3_finalize(statement) }

        while sqlite3_step(statement) == SQLITE_ROW {
            let host = try parseHost(from: statement!)
            hosts.append(host)
        }

        return hosts
    }

    private func parseHost(from statement: OpaquePointer) throws -> MacHost {
        guard let idString = sqlite3_column_text(statement, 0),
              let id = UUID(uuidString: String(cString: idString)),
              let hostname = sqlite3_column_text(statement, 1),
              let ipAddress = sqlite3_column_text(statement, 2),
              let architecture = sqlite3_column_text(statement, 3) else {
            throw DatabaseError.invalidData
        }

        let totalCPU = Int(sqlite3_column_int(statement, 4))
        let totalMemory = Int(sqlite3_column_int(statement, 5))
        let availableCPU = Int(sqlite3_column_int(statement, 6))
        let availableMemory = Int(sqlite3_column_int(statement, 7))

        let statusString = String(cString: sqlite3_column_text(statement, 8))
        let status = HostStatus(rawValue: statusString) ?? .healthy

        let lastHeartbeatString = String(cString: sqlite3_column_text(statement, 9))
        let lastHeartbeat = ISO8601DateFormatter().date(from: lastHeartbeatString) ?? Date()

        let registeredAtString = String(cString: sqlite3_column_text(statement, 10))
        let registeredAt = ISO8601DateFormatter().date(from: registeredAtString) ?? Date()

        let version = String(cString: sqlite3_column_text(statement, 11))
        let temperature = sqlite3_column_double(statement, 12)
        let isThrottling = sqlite3_column_int(statement, 13) == 1

        let tagsString = String(cString: sqlite3_column_text(statement, 14))
        let tags = try? JSONDecoder().decode([String: String].self, from: Data(tagsString.utf8))

        return MacHost(
            id: id,
            hostname: String(cString: hostname),
            ipAddress: String(cString: ipAddress),
            architecture: String(cString: architecture),
            totalCPU: totalCPU,
            totalMemory: totalMemory,
            availableCPU: availableCPU,
            availableMemory: availableMemory,
            status: status,
            lastHeartbeat: lastHeartbeat,
            tags: tags ?? [:],
            registeredAt: registeredAt,
            version: version,
            temperature: temperature > 0 ? temperature : nil,
            isThrottling: isThrottling
        )
    }

    // MARK: - Container Operations

    public func saveContainer(_ container: Container) async throws {
        let sql = """
        INSERT OR REPLACE INTO containers
        (id, agent_type, host_id, workspace, cpu, memory, qos_class,
         status, start_time, health_score, pid, exit_code, restart_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        try execute(
            sql: sql,
            parameters: [
                container.id.uuidString,
                container.agentType,
                container.hostId.uuidString,
                container.workspace,
                container.resources.cpu,
                container.resources.memory,
                container.resources.qosClass.rawValue,
                container.status.rawValue,
                ISO8601DateFormatter().string(from: container.startTime),
                container.healthScore,
                container.pid ?? 0,
                container.exitCode ?? 0,
                container.restartCount
            ]
        )
    }

    public func updateContainer(_ container: Container) async throws {
        try await saveContainer(container)
    }

    public func deleteContainer(_ id: UUID) async throws {
        let sql = "DELETE FROM containers WHERE id = ?"
        try execute(sql: sql, parameters: [id.uuidString])
    }

    public func loadContainers() async throws -> [Container] {
        let sql = "SELECT * FROM containers"
        var containers: [Container] = []

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.queryFailed
        }

        defer { sqlite3_finalize(statement) }

        while sqlite3_step(statement) == SQLITE_ROW {
            let container = try parseContainer(from: statement!)
            containers.append(container)
        }

        return containers
    }

    private func parseContainer(from statement: OpaquePointer) throws -> Container {
        guard let idString = sqlite3_column_text(statement, 0),
              let id = UUID(uuidString: String(cString: idString)),
              let agentType = sqlite3_column_text(statement, 1),
              let hostIdString = sqlite3_column_text(statement, 2),
              let hostId = UUID(uuidString: String(cString: hostIdString)),
              let workspace = sqlite3_column_text(statement, 3) else {
            throw DatabaseError.invalidData
        }

        let cpu = Int(sqlite3_column_int(statement, 4))
        let memory = Int(sqlite3_column_int(statement, 5))
        let qosString = String(cString: sqlite3_column_text(statement, 6))
        let qos = QoSClass(rawValue: qosString) ?? .normal

        let statusString = String(cString: sqlite3_column_text(statement, 7))
        let status = ContainerStatus(rawValue: statusString) ?? .pending

        let startTimeString = String(cString: sqlite3_column_text(statement, 8))
        let startTime = ISO8601DateFormatter().date(from: startTimeString) ?? Date()

        let healthScore = Float(sqlite3_column_double(statement, 9))
        let pid = Int(sqlite3_column_int(statement, 10))
        let exitCode = Int(sqlite3_column_int(statement, 11))
        let restartCount = Int(sqlite3_column_int(statement, 12))

        return Container(
            id: id,
            agentType: String(cString: agentType),
            hostId: hostId,
            workspace: String(cString: workspace),
            resources: ResourceRequirements(cpu: cpu, memory: memory, qosClass: qos),
            status: status,
            startTime: startTime,
            healthScore: healthScore,
            pid: pid > 0 ? pid : nil,
            exitCode: exitCode > 0 ? exitCode : nil,
            restartCount: restartCount
        )
    }

    // MARK: - Event Operations

    public func logEvent(type: String, entityId: String?, details: String) async throws {
        let sql = """
        INSERT INTO events (timestamp, event_type, entity_id, details)
        VALUES (?, ?, ?, ?)
        """

        try execute(
            sql: sql,
            parameters: [
                ISO8601DateFormatter().string(from: Date()),
                type,
                entityId ?? "",
                details
            ]
        )
    }

    // MARK: - SQL Execution

    private func execute(sql: String, parameters: [Any] = []) throws {
        var statement: OpaquePointer?

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.queryFailed
        }

        defer { sqlite3_finalize(statement) }

        // Bind parameters
        for (index, parameter) in parameters.enumerated() {
            let bindIndex = Int32(index + 1)

            switch parameter {
            case let value as String:
                sqlite3_bind_text(statement, bindIndex, (value as NSString).utf8String, -1, nil)
            case let value as Int:
                sqlite3_bind_int(statement, bindIndex, Int32(value))
            case let value as Double:
                sqlite3_bind_double(statement, bindIndex, value)
            case let value as Float:
                sqlite3_bind_double(statement, bindIndex, Double(value))
            default:
                break
            }
        }

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw DatabaseError.executionFailed
        }
    }
}

// MARK: - Database Error

public enum DatabaseError: Error, LocalizedError {
    case connectionFailed
    case queryFailed
    case executionFailed
    case invalidData

    public var errorDescription: String? {
        switch self {
        case .connectionFailed:
            return "Failed to connect to database"
        case .queryFailed:
            return "Failed to prepare query"
        case .executionFailed:
            return "Failed to execute query"
        case .invalidData:
            return "Invalid data in database"
        }
    }
}
