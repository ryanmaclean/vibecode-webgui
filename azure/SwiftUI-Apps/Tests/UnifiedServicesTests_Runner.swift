#!/usr/bin/env swift
//
// UnifiedServicesTests_Runner.swift
// Test Runner for UnifiedServicesVibeCodeApp
//
// This is a modified version that works without timeout command and /dev/tcp
//

import XCTest
import Foundation

/// Comprehensive test suite for UnifiedServicesVibeCodeApp
///
/// Tests all four services:
/// - SSH (port 22)
/// - Valkey (port 6379)
/// - PostgreSQL (port 5432)
/// - OpenVSCode (port 8080)
final class UnifiedServicesTests: XCTestCase {

    // MARK: - Test Configuration

    private let vmStartTimeout: TimeInterval = 120.0  // 2 minutes for VM to boot
    private let serviceTestTimeout: TimeInterval = 30.0  // 30 seconds per service test
    private let vmIP = "192.168.64.10"  // Fixed IP since VM is already running

    // MARK: - SSH Tests

    /// Test that SSH service is accessible on port 22
    func testSSHPortIsOpen() throws {
        print("\n[TEST] Testing SSH port accessibility...")

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 22, timeout: serviceTestTimeout),
            "SSH port 22 should be open on \(vmIP)"
        )

        print("✓ SSH port 22 is open")
    }

    /// Test SSH connection and authentication
    func testSSHConnection() throws {
        print("\n[TEST] Testing SSH connection...")

        // Try SSH connection with default credentials
        let result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@\(vmIP) 'echo SSH_TEST_SUCCESS'")

        XCTAssertTrue(
            result.contains("SSH_TEST_SUCCESS"),
            "Should be able to SSH into VM and execute commands. Got: \(result)"
        )

        print("✓ SSH connection successful")
    }

    // MARK: - Valkey Tests

    /// Test that Valkey service is accessible on port 6379
    func testValkeyPortIsOpen() throws {
        print("\n[TEST] Testing Valkey port accessibility...")

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 6379, timeout: serviceTestTimeout),
            "Valkey port 6379 should be open on \(vmIP)"
        )

        print("✓ Valkey port 6379 is open")
    }

    /// Test Valkey PING command
    func testValkeyPing() throws {
        print("\n[TEST] Testing Valkey PING...")

        let result = shell("redis-cli -h \(vmIP) -p 6379 PING")

        XCTAssertTrue(
            result.contains("PONG"),
            "Valkey should respond to PING with PONG. Got: \(result)"
        )

        print("✓ Valkey PING successful")
    }

    /// Test Valkey SET/GET operations
    func testValkeySetGet() throws {
        print("\n[TEST] Testing Valkey SET/GET operations...")

        let testKey = "test_key_\(UUID().uuidString)"
        let testValue = "test_value_\(Date().timeIntervalSince1970)"

        // SET
        let setResult = shell("redis-cli -h \(vmIP) -p 6379 SET \(testKey) '\(testValue)'")
        XCTAssertTrue(setResult.contains("OK"), "Valkey SET should return OK. Got: \(setResult)")
        print("  - SET operation successful")

        // GET
        let getResult = shell("redis-cli -h \(vmIP) -p 6379 GET \(testKey)")
        XCTAssertTrue(
            getResult.contains(testValue),
            "Valkey GET should return the value we SET. Expected: \(testValue), Got: \(getResult)"
        )
        print("  - GET operation successful")

        // DEL (cleanup)
        _ = shell("redis-cli -h \(vmIP) -p 6379 DEL \(testKey)")
        print("✓ Valkey SET/GET/DEL operations successful")
    }

    // MARK: - PostgreSQL Tests

    /// Test that PostgreSQL service is accessible on port 5432
    func testPostgreSQLPortIsOpen() throws {
        print("\n[TEST] Testing PostgreSQL port accessibility...")

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 5432, timeout: serviceTestTimeout),
            "PostgreSQL port 5432 should be open on \(vmIP)"
        )

        print("✓ PostgreSQL port 5432 is open")
    }

    /// Test PostgreSQL connection
    func testPostgreSQLConnection() throws {
        print("\n[TEST] Testing PostgreSQL connection...")

        // Use SSH to run psql inside the VM since psql is not installed on host
        let result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no root@\(vmIP) \"PGPASSWORD='vibecode' psql -h localhost -U postgres -p 5432 -c 'SELECT 1 as test' -t -A\"")

        XCTAssertTrue(
            result.contains("1"),
            "PostgreSQL should accept connections and execute queries. Got: \(result)"
        )

        print("✓ PostgreSQL connection successful")
    }

    /// Test PostgreSQL table creation and data operations
    func testPostgreSQLTableOperations() throws {
        print("\n[TEST] Testing PostgreSQL table operations...")

        let tableName = "test_table_\(UUID().uuidString.replacingOccurrences(of: "-", with: "_"))"

        // CREATE TABLE
        var result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no root@\(vmIP) \"PGPASSWORD='vibecode' psql -h localhost -U postgres -p 5432 -c 'CREATE TABLE \(tableName) (id SERIAL PRIMARY KEY, value TEXT)'\"")
        XCTAssertTrue(result.contains("CREATE TABLE"), "Should create table successfully. Got: \(result)")
        print("  - CREATE TABLE successful")

        // INSERT
        result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no root@\(vmIP) \"PGPASSWORD='vibecode' psql -h localhost -U postgres -p 5432 -c \\\"INSERT INTO \(tableName) (value) VALUES ('test_data')\\\"\"")
        XCTAssertTrue(result.contains("INSERT"), "Should insert data successfully. Got: \(result)")
        print("  - INSERT successful")

        // SELECT
        result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no root@\(vmIP) \"PGPASSWORD='vibecode' psql -h localhost -U postgres -p 5432 -c 'SELECT value FROM \(tableName)' -t -A\"")
        XCTAssertTrue(result.contains("test_data"), "Should retrieve inserted data. Got: \(result)")
        print("  - SELECT successful")

        // DROP TABLE (cleanup)
        _ = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no root@\(vmIP) \"PGPASSWORD='vibecode' psql -h localhost -U postgres -p 5432 -c 'DROP TABLE \(tableName)'\"")
        print("✓ PostgreSQL table operations successful")
    }

    // MARK: - OpenVSCode Tests

    /// Test that OpenVSCode service is accessible on port 8080
    func testOpenVSCodePortIsOpen() throws {
        print("\n[TEST] Testing OpenVSCode port accessibility...")

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 8080, timeout: serviceTestTimeout),
            "OpenVSCode port 8080 should be open on \(vmIP)"
        )

        print("✓ OpenVSCode port 8080 is open")
    }

    /// Test OpenVSCode HTTP endpoint
    func testOpenVSCodeHTTP() throws {
        print("\n[TEST] Testing OpenVSCode HTTP endpoint...")

        let result = shell("curl -s -m 10 http://\(vmIP):8080/ | head -c 1000")

        XCTAssertTrue(
            result.contains("html") || result.contains("<!DOCTYPE") || result.contains("vscode"),
            "OpenVSCode should serve HTML content. Got: \(result.prefix(200))"
        )

        print("✓ OpenVSCode HTTP endpoint responding")
    }

    // MARK: - Integration Tests

    /// Test that all four services are running simultaneously
    func testAllServicesRunning() throws {
        print("\n[TEST] Testing all services simultaneously...")

        let services = [
            ("SSH", 22),
            ("Valkey", 6379),
            ("PostgreSQL", 5432),
            ("OpenVSCode", 8080)
        ]

        var allOpen = true
        for (name, port) in services {
            let isOpen = isPortOpen(host: vmIP, port: port, timeout: 5.0)
            print("  - \(name) (port \(port)): \(isOpen ? "✓ OPEN" : "✗ CLOSED")")
            if !isOpen {
                allOpen = false
            }
        }

        XCTAssertTrue(
            allOpen,
            "All four services (SSH:22, Valkey:6379, PostgreSQL:5432, OpenVSCode:8080) should be accessible"
        )

        print("✓ All services are running simultaneously")
    }

    // MARK: - Helper Methods

    /// Check if a port is open on a host using nc (netcat)
    private func isPortOpen(host: String, port: Int, timeout: TimeInterval) -> Bool {
        let result = shell("nc -z -G \(Int(timeout)) \(host) \(port) 2>&1")
        return result.contains("succeeded")
    }

    /// Execute a shell command and return output
    private func shell(_ command: String) -> String {
        let task = Process()
        task.launchPath = "/bin/bash"
        task.arguments = ["-c", command]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        task.launch()
        task.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8) ?? ""
    }
}

// MARK: - Test Execution

class TestRunner {
    static func main() {
        print("=" * 80)
        print("UnifiedServicesVibeCodeApp Test Suite")
        print("=" * 80)
        print("\nVM IP: 192.168.64.10")
        print("Date: \(Date())")
        print("\n" + "=" * 80)

        let suite = UnifiedServicesTests.defaultTestSuite
        let runner = XCTestSuiteRun(test: suite)

        suite.run()

        print("\n" + "=" * 80)
        print("Test Results Summary")
        print("=" * 80)
        print("Total Tests: \(suite.testCaseCount)")
        print("Passed: \(suite.testRun!.testCaseCount - suite.testRun!.failureCount)")
        print("Failed: \(suite.testRun!.failureCount)")
        print("Execution Time: \(String(format: "%.2f", suite.testRun!.totalDuration))s")
        print("=" * 80)

        exit(suite.testRun!.failureCount == 0 ? 0 : 1)
    }
}

TestRunner.main()
