// PostgreSQLContainerTests.swift

import XCTest
@testable import ContainerManager

@available(macOS 14.0, *)
final class PostgreSQLContainerTests: XCTestCase {
    func testDefaultConfiguration() {
        let config = PostgreSQLConfiguration()
        XCTAssertEqual(config.database, "vibecode")
        XCTAssertEqual(config.username, "vibecode")
        XCTAssertEqual(config.port, 5432)
        XCTAssertEqual(config.maxConnections, 100)
        XCTAssertTrue(config.enablePgVector)
        XCTAssertFalse(config.password.isEmpty)
    }

    func testCustomConfiguration() {
        let config = PostgreSQLConfiguration(database: "testdb", username: "testuser", password: "testpass", port: 5433, maxConnections: 50, enablePgVector: false)
        XCTAssertEqual(config.database, "testdb")
        XCTAssertEqual(config.username, "testuser")
        XCTAssertEqual(config.password, "testpass")
        XCTAssertEqual(config.port, 5433)
        XCTAssertEqual(config.maxConnections, 50)
        XCTAssertFalse(config.enablePgVector)
    }

    func testPasswordGeneration() {
        let p1 = PostgreSQLConfiguration.generateSecurePassword()
        let p2 = PostgreSQLConfiguration.generateSecurePassword()
        XCTAssertEqual(p1.count, 32)
        XCTAssertNotEqual(p1, p2)
        XCTAssertEqual(PostgreSQLConfiguration.generateSecurePassword(length: 16).count, 16)
    }

    func testContainerCreation() {
        let container = PostgreSQLContainer()
        XCTAssertEqual(container.name, "postgresql")
        XCTAssertEqual(container.status, .notCreated)
        XCTAssertNotNil(container.healthCheckConfig)
    }

    func testConnectionString() {
        let config = PostgreSQLConfiguration(database: "mydb", username: "myuser", password: "mypass", port: 5432)
        let container = PostgreSQLContainer(name: "test", pgConfig: config)
        XCTAssertTrue(container.connectionString.contains("mydb"))
        XCTAssertTrue(container.connectionString.contains("myuser"))
        XCTAssertTrue(container.connectionString.contains("mypass"))
    }

    func testDSN() {
        let config = PostgreSQLConfiguration(database: "mydb", username: "myuser", password: "mypass", port: 5432)
        let container = PostgreSQLContainer(name: "test", pgConfig: config)
        XCTAssertTrue(container.dsn.contains("host=127.0.0.1"))
        XCTAssertTrue(container.dsn.contains("dbname=mydb"))
    }

    func testBuilder() {
        let container = PostgreSQLContainer.builder().name("custom-pg").database("customdb").port(5433).build()
        XCTAssertEqual(container.name, "custom-pg")
        XCTAssertTrue(container.connectionString.contains("customdb"))
        XCTAssertTrue(container.connectionString.contains("5433"))
    }

    func testContainerStatus() {
        XCTAssertEqual(ContainerStatus.notCreated.description, "Not Created")
        XCTAssertEqual(ContainerStatus.running.description, "Running")
        XCTAssertTrue(ContainerStatus.running.isActive)
        XCTAssertFalse(ContainerStatus.stopped.isActive)
    }

    func testPortMapping() {
        let mapping = PortMapping.port(3000)
        XCTAssertEqual(mapping.hostPort, 3000)
        XCTAssertEqual(mapping.containerPort, 3000)
    }

    func testVolumeMount() {
        let mount = VolumeMount(hostPath: URL(fileURLWithPath: "/tmp/data"), containerPath: "/var/lib/postgresql/data", readOnly: false)
        XCTAssertEqual(mount.containerPath, "/var/lib/postgresql/data")
        XCTAssertFalse(mount.readOnly)
    }

    func testResourceUsage() {
        let usage = ResourceUsage(cpuPercent: 25.5, memoryUsed: 512 * 1024 * 1024, memoryLimit: 2 * 1024 * 1024 * 1024, diskUsed: 1 * 1024 * 1024 * 1024, diskLimit: 20 * 1024 * 1024 * 1024)
        XCTAssertEqual(usage.cpuPercent, 25.5)
        XCTAssertEqual(usage.memoryPercent, 25.0, accuracy: 0.1)
        XCTAssertEqual(usage.diskPercent, 5.0, accuracy: 0.1)
    }

    func testContainerErrors() {
        XCTAssertTrue(ContainerError.notFound("test").localizedDescription.contains("test"))
        XCTAssertTrue(ContainerError.alreadyExists("test").localizedDescription.contains("already exists"))
        XCTAssertTrue(ContainerError.portBindingFailed(5432).localizedDescription.contains("5432"))
    }

    func testConnectionInfo() {
        let container = PostgreSQLContainer()
        let info = container.connectionInfo
        XCTAssertEqual(info["host"], "127.0.0.1")
        XCTAssertEqual(info["port"], "5432")
        XCTAssertNotNil(info["password"])
    }
}
