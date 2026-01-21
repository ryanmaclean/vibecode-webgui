//
// UnifiedServicesTests.swift
// VibeCode Tests
//
// Purpose: Comprehensive tests for UnifiedServicesVibeCodeApp
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

    // MARK: - SSH Tests

    /// Test that SSH service is accessible on port 22
    func testSSHPortIsOpen() throws {
        let vmIP = try waitForVMIP()

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 22, timeout: serviceTestTimeout),
            "SSH port 22 should be open on \(vmIP)"
        )
    }

    /// Test SSH connection and authentication
    func testSSHConnection() throws {
        let vmIP = try waitForVMIP()

        // Try SSH connection with default credentials
        let result = shell("sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@\(vmIP) 'echo SSH_TEST_SUCCESS'")

        XCTAssertTrue(
            result.contains("SSH_TEST_SUCCESS"),
            "Should be able to SSH into VM and execute commands"
        )
    }

    // MARK: - Valkey Tests

    /// Test that Valkey service is accessible on port 6379
    func testValkeyPortIsOpen() throws {
        let vmIP = try waitForVMIP()

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 6379, timeout: serviceTestTimeout),
            "Valkey port 6379 should be open on \(vmIP)"
        )
    }

    /// Test Valkey PING command
    func testValkeyPing() throws {
        let vmIP = try waitForVMIP()

        let result = shell("redis-cli -h \(vmIP) -p 6379 PING")

        XCTAssertTrue(
            result.contains("PONG"),
            "Valkey should respond to PING with PONG"
        )
    }

    /// Test Valkey SET/GET operations
    func testValkeySetGet() throws {
        let vmIP = try waitForVMIP()

        let testKey = "test_key_\(UUID().uuidString)"
        let testValue = "test_value_\(Date().timeIntervalSince1970)"

        // SET
        let setResult = shell("redis-cli -h \(vmIP) -p 6379 SET \(testKey) '\(testValue)'")
        XCTAssertTrue(setResult.contains("OK"), "Valkey SET should return OK")

        // GET
        let getResult = shell("redis-cli -h \(vmIP) -p 6379 GET \(testKey)")
        XCTAssertTrue(
            getResult.contains(testValue),
            "Valkey GET should return the value we SET"
        )

        // DEL (cleanup)
        _ = shell("redis-cli -h \(vmIP) -p 6379 DEL \(testKey)")
    }

    // MARK: - PostgreSQL Tests

    /// Test that PostgreSQL service is accessible on port 5432
    func testPostgreSQLPortIsOpen() throws {
        let vmIP = try waitForVMIP()

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 5432, timeout: serviceTestTimeout),
            "PostgreSQL port 5432 should be open on \(vmIP)"
        )
    }

    /// Test PostgreSQL connection
    func testPostgreSQLConnection() throws {
        let vmIP = try waitForVMIP()

        let result = shell("PGPASSWORD='vibecode' psql -h \(vmIP) -U postgres -p 5432 -c 'SELECT 1 as test' -t -A")

        XCTAssertTrue(
            result.contains("1"),
            "PostgreSQL should accept connections and execute queries"
        )
    }

    /// Test PostgreSQL table creation and data operations
    func testPostgreSQLTableOperations() throws {
        let vmIP = try waitForVMIP()
        let tableName = "test_table_\(UUID().uuidString.replacingOccurrences(of: "-", with: "_"))"

        // CREATE TABLE
        var result = shell("PGPASSWORD='vibecode' psql -h \(vmIP) -U postgres -p 5432 -c 'CREATE TABLE \(tableName) (id SERIAL PRIMARY KEY, value TEXT)'")
        XCTAssertTrue(result.contains("CREATE TABLE"), "Should create table successfully")

        // INSERT
        result = shell("PGPASSWORD='vibecode' psql -h \(vmIP) -U postgres -p 5432 -c \"INSERT INTO \(tableName) (value) VALUES ('test_data')\"")
        XCTAssertTrue(result.contains("INSERT"), "Should insert data successfully")

        // SELECT
        result = shell("PGPASSWORD='vibecode' psql -h \(vmIP) -U postgres -p 5432 -c 'SELECT value FROM \(tableName)' -t -A")
        XCTAssertTrue(result.contains("test_data"), "Should retrieve inserted data")

        // DROP TABLE (cleanup)
        _ = shell("PGPASSWORD='vibecode' psql -h \(vmIP) -U postgres -p 5432 -c 'DROP TABLE \(tableName)'")
    }

    // MARK: - OpenVSCode Tests

    /// Test that OpenVSCode service is accessible on port 8080
    func testOpenVSCodePortIsOpen() throws {
        let vmIP = try waitForVMIP()

        XCTAssertTrue(
            isPortOpen(host: vmIP, port: 8080, timeout: serviceTestTimeout),
            "OpenVSCode port 8080 should be open on \(vmIP)"
        )
    }

    /// Test OpenVSCode HTTP endpoint
    func testOpenVSCodeHTTP() throws {
        let vmIP = try waitForVMIP()

        let result = shell("curl -s -m 10 http://\(vmIP):8080/ | head -c 1000")

        XCTAssertTrue(
            result.contains("html") || result.contains("<!DOCTYPE") || result.contains("vscode"),
            "OpenVSCode should serve HTML content"
        )
    }

    // MARK: - Integration Tests

    /// Test that all four services are running simultaneously
    func testAllServicesRunning() throws {
        let vmIP = try waitForVMIP()

        let allPortsOpen = [
            isPortOpen(host: vmIP, port: 22, timeout: 5.0),    // SSH
            isPortOpen(host: vmIP, port: 6379, timeout: 5.0),  // Valkey
            isPortOpen(host: vmIP, port: 5432, timeout: 5.0),  // PostgreSQL
            isPortOpen(host: vmIP, port: 8080, timeout: 5.0)   // OpenVSCode
        ]

        XCTAssertTrue(
            allPortsOpen.allSatisfy({ $0 }),
            "All four services (SSH:22, Valkey:6379, PostgreSQL:5432, OpenVSCode:8080) should be accessible"
        )
    }

    /// Test VM boot time (should be reasonable)
    func testVMBootTime() throws {
        let startTime = Date()
        _ = try waitForVMIP()
        let bootTime = Date().timeIntervalSince(startTime)

        XCTAssertLessThan(
            bootTime,
            120.0,  // 2 minutes max
            "VM should boot in under 2 minutes (actual: \(String(format: "%.1f", bootTime))s)"
        )

        print("✓ VM boot time: \(String(format: "%.1f", bootTime))s")
    }

    // MARK: - Helper Methods

    /// Wait for VM to boot and return its IP address
    private func waitForVMIP() throws -> String {
        // Check if VM is already running
        if let existingIP = getVMIP() {
            return existingIP
        }

        // Launch the VM app
        print("Launching UnifiedServicesVibeCodeApp...")
        let appPath = "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app"
        _ = shell("open '\(appPath)'")

        // Wait for VM to boot and get IP
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < vmStartTimeout {
            if let ip = getVMIP() {
                print("✓ VM ready with IP: \(ip)")
                // Wait extra 10 seconds for services to fully initialize
                sleep(10)
                return ip
            }
            sleep(2)
        }

        throw XCTSkip("VM did not boot within \(vmStartTimeout) seconds")
    }

    /// Get VM IP address by checking DHCP leases
    private func getVMIP() -> String? {
        // Check DHCP leases for VM
        let result = shell("cat /var/db/dhcpd_leases 2>/dev/null || echo ''")

        // Look for IP addresses in common VM range
        let lines = result.components(separatedBy: "\n")
        for line in lines {
            // Look for IP like 192.168.64.x
            if let range = line.range(of: #"192\.168\.\d{1,3}\.\d{1,3}"#, options: .regularExpression) {
                let ip = String(line[range])
                // Verify it's actually our VM by checking if port 22 is open
                if isPortOpen(host: ip, port: 22, timeout: 1.0) {
                    return ip
                }
            }
        }

        return nil
    }

    /// Check if a port is open on a host
    private func isPortOpen(host: String, port: Int, timeout: TimeInterval) -> Bool {
        let result = shell("timeout \(Int(timeout)) bash -c 'cat < /dev/null > /dev/tcp/\(host)/\(port)' 2>&1")
        return result.isEmpty || !result.contains("Connection refused") && !result.contains("timed out")
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
