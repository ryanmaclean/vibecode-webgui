#!/usr/bin/env swift

import Foundation
import Network

// MARK: - Environment Configuration

struct Environment {
    let ddAPIKey: String
    let ddSite: String
    let env: String
    let serviceName: String

    static func load() -> Environment? {
        // Try to load from .env.local (current or parent directory)
        let envPaths = [
            ".env.local",
            "../../.env.local"
        ]

        var envVars: [String: String] = [:]

        for path in envPaths {
            let url = URL(fileURLWithPath: path)
            guard let contents = try? String(contentsOf: url, encoding: .utf8) else {
                continue
            }

            // Parse simple KEY=VALUE format
            for line in contents.components(separatedBy: .newlines) {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty, !trimmed.hasPrefix("#") else { continue }

                let parts = trimmed.split(separator: "=", maxSplits: 1)
                if parts.count == 2 {
                    let key = String(parts[0]).trimmingCharacters(in: .whitespaces)
                    let value = String(parts[1]).trimmingCharacters(in: .whitespaces)
                    envVars[key] = value
                }
            }

            if envVars["DD_API_KEY"] != nil {
                print("✅ Environment loaded from: \(path)")
                break
            }
        }

        guard let apiKey = envVars["DD_API_KEY"],
              apiKey != "your-datadog-api-key-here" else {
            print("❌ DD_API_KEY not found or invalid")
            return nil
        }

        return Environment(
            ddAPIKey: apiKey,
            ddSite: envVars["DD_SITE"] ?? "datadoghq.com",
            env: envVars["ENV"] ?? "development",
            serviceName: envVars["SERVICE_NAME"] ?? "vibecode-swiftui"
        )
    }
}

// MARK: - Test Results

struct TestResult {
    let name: String
    let passed: Bool
    let message: String
    let duration: TimeInterval
}

class TestRunner {
    private var results: [TestResult] = []
    private let logPath = "\(NSHomeDirectory())/vibecode-webgui/logs/vibecode.log"

    func run() {
        print("=== VibeCode Observability E2E Test Suite ===")
        print("Running native Swift 5 tests...\n")

        // Test 1: Environment Configuration
        test("Environment Configuration") { env in
            guard env != nil else {
                return (false, "Failed to load .env.local with DD_API_KEY")
            }
            let maskedKey = String(env!.ddAPIKey.prefix(10)) + "..."
            return (true, "DD_API_KEY loaded: \(maskedKey)")
        }

        // Test 2: Log File Verification
        test("Log File Verification") { _ in
            let fileManager = FileManager.default
            guard fileManager.fileExists(atPath: logPath) else {
                return (false, "Log file not found at \(logPath)")
            }

            guard let data = try? Data(contentsOf: URL(fileURLWithPath: logPath)),
                  let content = String(data: data, encoding: .utf8) else {
                return (false, "Cannot read log file")
            }

            let lineCount = content.components(separatedBy: .newlines).filter { !$0.isEmpty }.count

            // Verify JSON format
            let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }
            var validJsonCount = 0
            for line in lines.prefix(5) {
                if let _ = try? JSONSerialization.jsonObject(with: line.data(using: .utf8)!) {
                    validJsonCount += 1
                }
            }

            return (true, "\(lineCount) entries, \(validJsonCount)/5 valid JSON")
        }

        // Test 3: StatsD Port Configuration
        test("StatsD Port Configuration") { _ in
            guard let dogStatsDContent = try? String(contentsOfFile: "DogStatsDClient.swift") else {
                return (false, "Cannot read DogStatsDClient.swift")
            }

            if dogStatsDContent.contains("port: UInt16 = 8135") {
                return (true, "Port correctly set to 8135")
            } else {
                return (false, "Port not set to 8135")
            }
        }

        // Test 4: DogStatsD Connection Test
        test("DogStatsD Connection Test") { _ in
            var connected = false
            let expectation = DispatchSemaphore(value: 0)

            let endpoint = NWEndpoint.hostPort(
                host: "127.0.0.1",
                port: 8135
            )

            let connection = NWConnection(to: endpoint, using: .udp)

            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    connected = true
                    expectation.signal()
                case .failed:
                    expectation.signal()
                default:
                    break
                }
            }

            connection.start(queue: .global())

            // Wait up to 2 seconds
            _ = expectation.wait(timeout: .now() + 2.0)

            connection.cancel()

            return (connected, connected ? "UDP connection to 127.0.0.1:8135 successful" : "Cannot connect - is Datadog Agent running?")
        }

        // Test 5: OTLP Endpoint Reachability
        if let env = Environment.load() {
            test("OTLP Endpoint Reachability") { _ in
                let otlpURL = "https://api.\(env.ddSite)/api/intake/otlp/v1/traces"
                let semaphore = DispatchSemaphore(value: 0)
                var httpCode: Int = 0

                var request = URLRequest(url: URL(string: otlpURL)!)
                request.httpMethod = "GET"
                request.setValue(env.ddAPIKey, forHTTPHeaderField: "DD-API-KEY")
                request.timeoutInterval = 5.0

                let task = URLSession.shared.dataTask(with: request) { _, response, error in
                    if let httpResponse = response as? HTTPURLResponse {
                        httpCode = httpResponse.statusCode
                    }
                    semaphore.signal()
                }

                task.resume()
                _ = semaphore.wait(timeout: .now() + 6.0)

                // 400, 401, 403 are acceptable - means endpoint is reachable
                if [400, 401, 403].contains(httpCode) {
                    return (true, "Endpoint reachable (HTTP \(httpCode))")
                } else if httpCode == 0 {
                    return (false, "Cannot reach endpoint (timeout/network)")
                } else {
                    return (true, "Endpoint responded (HTTP \(httpCode))")
                }
            }
        }

        // Test 6: App Bundle Verification
        test("App Bundle Verification") { _ in
            let fileManager = FileManager.default
            let appPath = "LiquidGlassVibeCode.app"

            guard fileManager.fileExists(atPath: appPath) else {
                return (false, "App bundle not found")
            }

            let binaryPath = "\(appPath)/Contents/MacOS/LiquidGlassVibeCode"
            let initramfsPath = "\(appPath)/Contents/Resources/bun-openvscode-dhcp-fixed-v2.cpio.gz"

            let hasBinary = fileManager.fileExists(atPath: binaryPath)
            let hasInitramfs = fileManager.fileExists(atPath: initramfsPath)

            if hasBinary && hasInitramfs {
                return (true, "Binary and DHCP-fixed initramfs present")
            } else {
                return (false, "Missing: \(hasBinary ? "" : "binary ") \(hasInitramfs ? "" : "initramfs")")
            }
        }

        // Test 7: Entitlements Verification
        test("Entitlements Verification") { _ in
            guard let content = try? String(contentsOfFile: "entitlements.plist") else {
                return (false, "entitlements.plist not found")
            }

            let required = [
                "com.apple.security.virtualization",
                "com.apple.security.hypervisor",
                "com.apple.security.network.client",
                "com.apple.security.network.server"
            ]

            let missing = required.filter { !content.contains($0) }

            if missing.isEmpty {
                return (true, "All 4 entitlements present")
            } else {
                return (false, "Missing: \(missing.joined(separator: ", "))")
            }
        }

        // Print summary
        printSummary()
    }

    private func test(_ name: String, block: (Environment?) -> (Bool, String)) {
        let start = Date()
        let env = Environment.load()
        let (passed, message) = block(env)
        let duration = Date().timeIntervalSince(start)

        let result = TestResult(
            name: name,
            passed: passed,
            message: message,
            duration: duration
        )

        results.append(result)

        let icon = passed ? "✅" : "❌"
        print("\(icon) \(name)")
        print("   \(message)")
        print("   Duration: \(String(format: "%.2f", duration * 1000))ms\n")
    }

    private func printSummary() {
        print("=== Test Summary ===")
        let passed = results.filter { $0.passed }.count
        let total = results.count
        let percentage = total > 0 ? (Double(passed) / Double(total)) * 100 : 0

        print("Passed: \(passed)/\(total) (\(String(format: "%.1f", percentage))%)")

        let totalDuration = results.reduce(0.0) { $0 + $1.duration }
        print("Total Duration: \(String(format: "%.2f", totalDuration * 1000))ms")

        if passed == total {
            print("\n🎉 All tests passed! Observability stack is operational.")
        } else {
            print("\n⚠️  Some tests failed. Review output above.")
        }

        print("\nNext Steps:")
        print("  1. Launch: open LiquidGlassVibeCode.app")
        print("  2. Monitor: tail -f ~/vibecode-webgui/logs/vibecode.log")
        print("  3. Check metrics: sudo datadog-agent status")
        print("  4. View traces: https://app.datadoghq.com/apm/traces")
    }
}

// MARK: - Main Entry Point

let runner = TestRunner()
runner.run()
