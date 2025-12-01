//
// BaseVMManagerTests.swift
// SharedTests
//
// Created: 2025-11-25
// Purpose: Comprehensive unit tests for BaseVMManager
//

import XCTest
import Virtualization
@testable import Shared

final class BaseVMManagerTests: XCTestCase {

    // MARK: - Mock VM Manager

    class MockVMManager: BaseVMManager {
        var onVMStartedCalled = false
        var onVMStoppedCalled = false
        var onVMErrorCalled = false
        var onServerReadyCalled = false
        var onIPAddressDetectedCalled = false
        var lastError: Error?
        var lastServerURL: String?
        var lastDetectedIP: String?

        var customCPUCount: Int?
        var customMemorySize: UInt64?
        var customKernelResource: String?
        var customInitramfsResource: String?
        var customKernelCommandLine: String?
        var customNetworkingStrategy: NetworkingStrategy?

        override func getCPUCount() -> Int {
            return customCPUCount ?? super.getCPUCount()
        }

        override func getMemorySize() -> UInt64 {
            return customMemorySize ?? super.getMemorySize()
        }

        override func getKernelResource() -> String {
            return customKernelResource ?? super.getKernelResource()
        }

        override func getInitramfsResource() -> String {
            return customInitramfsResource ?? super.getInitramfsResource()
        }

        override func getKernelCommandLine() -> String {
            return customKernelCommandLine ?? super.getKernelCommandLine()
        }

        override func createNetworkingStrategy() -> NetworkingStrategy {
            return customNetworkingStrategy ?? super.createNetworkingStrategy()
        }

        override func onVMStarted() {
            onVMStartedCalled = true
            super.onVMStarted()
        }

        override func onVMStopped() {
            onVMStoppedCalled = true
            super.onVMStopped()
        }

        override func onVMError(_ error: Error) {
            onVMErrorCalled = true
            lastError = error
            super.onVMError(error)
        }

        override func onServerReady(url: String) {
            onServerReadyCalled = true
            lastServerURL = url
            super.onServerReady(url: url)
        }

        override func onIPAddressDetected(ip: String) {
            onIPAddressDetectedCalled = true
            lastDetectedIP = ip
            super.onIPAddressDetected(ip: ip)
        }
    }

    // MARK: - Mock Networking Strategy

    class MockNetworkingStrategy: NetworkingStrategy {
        let macAddress: String
        var configureCalled = false
        var setupConnectivityCalled = false
        var teardownCalled = false
        var shouldThrowError = false

        init(macAddress: String = "52:54:00:12:34:90") {
            self.macAddress = macAddress
        }

        func configure(_ config: VZVirtualMachineConfiguration) throws {
            configureCalled = true
            if shouldThrowError {
                throw NetworkError.configurationFailed("Mock error")
            }

            let net = VZVirtioNetworkDeviceConfiguration()
            net.macAddress = VZMACAddress(string: macAddress)!
            net.attachment = VZNATNetworkDeviceAttachment()
            config.networkDevices = [net]
        }

        func setupConnectivity(_ manager: BaseVMManager) {
            setupConnectivityCalled = true
        }

        func teardown() {
            teardownCalled = true
        }

        func getMACAddress() -> String {
            return macAddress
        }
    }

    // MARK: - Test Initialization

    func testInitialization() {
        let manager = MockVMManager()

        XCTAssertEqual(manager.status, "Stopped", "Initial status should be 'Stopped'")
        XCTAssertFalse(manager.isRunning, "VM should not be running initially")
        XCTAssertEqual(manager.consoleOutput, "", "Console output should be empty initially")
        XCTAssertNil(manager.serverURL, "Server URL should be nil initially")
        XCTAssertNil(manager.vmIPAddress, "VM IP address should be nil initially")
    }

    // MARK: - Test Template Method Pattern

    func testTemplateMethods_DefaultValues() {
        let manager = MockVMManager()

        XCTAssertEqual(manager.getCPUCount(), 2, "Default CPU count should be 2")
        XCTAssertEqual(manager.getMemorySize(), 1024 * 1024 * 1024, "Default memory should be 1GB")
        XCTAssertEqual(manager.getKernelResource(), "vmlinux-raw", "Default kernel should be 'vmlinux-raw'")
        XCTAssertEqual(manager.getInitramfsResource(), "bun-openvscode", "Default initramfs should be 'bun-openvscode'")
        XCTAssertEqual(manager.getKernelCommandLine(), "console=hvc0 debug loglevel=8 ipv6.disable=1", "Default kernel command line should match")
    }

    func testTemplateMethods_CustomValues() {
        let manager = MockVMManager()
        manager.customCPUCount = 4
        manager.customMemorySize = 2 * 1024 * 1024 * 1024
        manager.customKernelResource = "custom-kernel"
        manager.customInitramfsResource = "custom-initramfs"
        manager.customKernelCommandLine = "console=hvc0 custom=value"

        XCTAssertEqual(manager.getCPUCount(), 4, "Custom CPU count should be 4")
        XCTAssertEqual(manager.getMemorySize(), 2 * 1024 * 1024 * 1024, "Custom memory should be 2GB")
        XCTAssertEqual(manager.getKernelResource(), "custom-kernel", "Custom kernel should be 'custom-kernel'")
        XCTAssertEqual(manager.getInitramfsResource(), "custom-initramfs", "Custom initramfs should be 'custom-initramfs'")
        XCTAssertEqual(manager.getKernelCommandLine(), "console=hvc0 custom=value", "Custom kernel command line should match")
    }

    func testCreateNetworkingStrategy_Default() {
        let manager = MockVMManager()
        let strategy = manager.createNetworkingStrategy()

        XCTAssertTrue(strategy is NATNetworkStrategy, "Default strategy should be NATNetworkStrategy")
    }

    func testCreateNetworkingStrategy_Custom() {
        let manager = MockVMManager()
        let customStrategy = MockNetworkingStrategy()
        manager.customNetworkingStrategy = customStrategy

        let strategy = manager.createNetworkingStrategy()
        XCTAssertTrue(strategy is MockNetworkingStrategy, "Custom strategy should be MockNetworkingStrategy")
        XCTAssertEqual(strategy.getMACAddress(), customStrategy.getMACAddress(), "Should return custom strategy")
    }

    // MARK: - Test Lifecycle Hooks

    func testOnVMStarted_Hook() {
        let manager = MockVMManager()

        XCTAssertFalse(manager.onVMStartedCalled, "Hook should not be called initially")

        // Simulate VM start
        manager.onVMStarted()

        XCTAssertTrue(manager.onVMStartedCalled, "onVMStarted hook should be called")
        XCTAssertTrue(manager.isRunning, "VM should be marked as running")
        XCTAssertEqual(manager.status, "Running", "Status should be 'Running'")
    }

    func testOnVMStopped_Hook() {
        let manager = MockVMManager()

        XCTAssertFalse(manager.onVMStoppedCalled, "Hook should not be called initially")

        // Simulate VM stop
        manager.onVMStopped()

        XCTAssertTrue(manager.onVMStoppedCalled, "onVMStopped hook should be called")
    }

    func testOnVMError_Hook() {
        let manager = MockVMManager()
        let testError = NSError(domain: "test", code: 123, userInfo: [NSLocalizedDescriptionKey: "Test error"])

        XCTAssertFalse(manager.onVMErrorCalled, "Hook should not be called initially")

        manager.onVMError(testError)

        XCTAssertTrue(manager.onVMErrorCalled, "onVMError hook should be called")
        XCTAssertNotNil(manager.lastError, "Error should be captured")
        XCTAssertFalse(manager.isRunning, "VM should not be running after error")
        XCTAssertTrue(manager.status.contains("Error"), "Status should contain 'Error'")
    }

    func testOnServerReady_Hook() {
        let manager = MockVMManager()
        let testURL = "http://192.168.64.5:3000"

        XCTAssertFalse(manager.onServerReadyCalled, "Hook should not be called initially")

        manager.onServerReady(url: testURL)

        XCTAssertTrue(manager.onServerReadyCalled, "onServerReady hook should be called")
        XCTAssertEqual(manager.lastServerURL, testURL, "Server URL should be captured")
        XCTAssertEqual(manager.status, "Ready", "Status should be 'Ready'")
    }

    func testOnIPAddressDetected_Hook() {
        let manager = MockVMManager()
        let testIP = "192.168.64.5"

        XCTAssertFalse(manager.onIPAddressDetectedCalled, "Hook should not be called initially")

        manager.onIPAddressDetected(ip: testIP)

        XCTAssertTrue(manager.onIPAddressDetectedCalled, "onIPAddressDetected hook should be called")
        XCTAssertEqual(manager.lastDetectedIP, testIP, "IP address should be captured")
    }

    // MARK: - Test @Published Properties

    func testPublishedProperties_Updates() {
        let manager = MockVMManager()
        let expectation = XCTestExpectation(description: "Published property updates")

        var statusChanges: [String] = []
        var isRunningChanges: [Bool] = []

        let cancellable = manager.objectWillChange.sink {
            statusChanges.append(manager.status)
            isRunningChanges.append(manager.isRunning)

            if statusChanges.count >= 2 {
                expectation.fulfill()
            }
        }

        // Change properties
        manager.status = "Starting..."
        manager.isRunning = true

        wait(for: [expectation], timeout: 1.0)

        XCTAssertTrue(statusChanges.contains("Starting..."), "Status changes should be published")
        XCTAssertTrue(isRunningChanges.contains(true), "isRunning changes should be published")

        cancellable.cancel()
    }

    // MARK: - Test Server Ready Detection

    func testCheckServerReady_WithIP() {
        let manager = MockVMManager()
        manager.vmIPAddress = "192.168.64.5"

        let consoleOutput = "Server will be available at http://localhost:3000"
        let result = manager.checkServerReady(consoleOutput: consoleOutput)

        XCTAssertNotNil(result, "Should detect server ready")
        XCTAssertEqual(result, "http://192.168.64.5:3000", "Should use VM IP address")
    }

    func testCheckServerReady_WithoutIP() {
        let manager = MockVMManager()
        manager.vmIPAddress = nil

        let consoleOutput = "Server will be available at http://localhost:3000"
        let result = manager.checkServerReady(consoleOutput: consoleOutput)

        XCTAssertNotNil(result, "Should detect server ready")
        XCTAssertEqual(result, "http://localhost:3000", "Should fallback to localhost")
    }

    func testCheckServerReady_NotReady() {
        let manager = MockVMManager()

        let consoleOutput = "Server is starting..."
        let result = manager.checkServerReady(consoleOutput: consoleOutput)

        XCTAssertNil(result, "Should not detect server ready")
    }

    // MARK: - Test Error Handling

    func testVMError_KernelNotFound() {
        let error = VMError.kernelNotFound("test-kernel")

        XCTAssertEqual(error.errorDescription, "Kernel 'test-kernel' not found in app bundle", "Error description should match")
    }

    func testVMError_InitramfsNotFound() {
        let error = VMError.initramfsNotFound("test-initramfs")

        XCTAssertEqual(error.errorDescription, "Initramfs 'test-initramfs.cpio.gz' not found in app bundle", "Error description should match")
    }

    func testVMError_ConfigurationInvalid() {
        let error = VMError.configurationInvalid

        XCTAssertEqual(error.errorDescription, "VM configuration is invalid", "Error description should match")
    }

    // MARK: - Test Start/Stop Behavior

    func testStartVM_IgnoresMultipleCalls() {
        let manager = MockVMManager()

        // First start sets isRunning to true (simulated)
        manager.isRunning = true
        manager.status = "Running"

        // Second start should be ignored
        manager.startVM()

        // Status should not change to "Starting..."
        XCTAssertEqual(manager.status, "Running", "Should ignore start when already running")
    }

    func testStopVM_IgnoresMultipleCalls() {
        let manager = MockVMManager()

        // VM not running
        manager.isRunning = false
        manager.status = "Stopped"

        // Stop should be ignored
        manager.stopVM()

        // Status should not change to "Stopping..."
        XCTAssertEqual(manager.status, "Stopped", "Should ignore stop when not running")
    }

    // MARK: - Test Networking Strategy Integration

    func testNetworkingStrategy_MACAddressTracking() {
        let manager = MockVMManager()
        let strategy = MockNetworkingStrategy(macAddress: "52:54:00:AA:BB:CC")
        manager.customNetworkingStrategy = strategy

        let createdStrategy = manager.createNetworkingStrategy()
        XCTAssertEqual(createdStrategy.getMACAddress(), "52:54:00:AA:BB:CC", "MAC address should match custom strategy")
    }

    // MARK: - Test Console Output

    func testConsoleOutput_InitiallyEmpty() {
        let manager = MockVMManager()

        XCTAssertEqual(manager.consoleOutput, "", "Console output should be empty initially")
    }

    func testConsoleOutput_Updates() {
        let manager = MockVMManager()

        manager.consoleOutput = "Test output"
        XCTAssertEqual(manager.consoleOutput, "Test output", "Console output should be updatable")
    }

    // MARK: - Test State Transitions

    func testStateTransition_StoppedToStarting() {
        let manager = MockVMManager()

        XCTAssertEqual(manager.status, "Stopped")
        manager.status = "Starting..."
        XCTAssertEqual(manager.status, "Starting...")
    }

    func testStateTransition_StartingToRunning() {
        let manager = MockVMManager()

        manager.status = "Starting..."
        manager.onVMStarted()
        XCTAssertEqual(manager.status, "Running")
        XCTAssertTrue(manager.isRunning)
    }

    func testStateTransition_RunningToReady() {
        let manager = MockVMManager()

        manager.status = "Running"
        manager.onServerReady(url: "http://192.168.64.5:3000")
        XCTAssertEqual(manager.status, "Ready")
    }

    func testStateTransition_RunningToError() {
        let manager = MockVMManager()

        manager.status = "Running"
        manager.isRunning = true

        let error = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Test failure"])
        manager.onVMError(error)

        XCTAssertTrue(manager.status.contains("Error"))
        XCTAssertFalse(manager.isRunning)
    }

    // MARK: - Performance Tests

    func testPerformance_TemplateMethodCalls() {
        let manager = MockVMManager()

        measure {
            for _ in 0..<1000 {
                _ = manager.getCPUCount()
                _ = manager.getMemorySize()
                _ = manager.getKernelResource()
                _ = manager.getInitramfsResource()
                _ = manager.getKernelCommandLine()
            }
        }
    }

    func testPerformance_ServerReadyDetection() {
        let manager = MockVMManager()
        manager.vmIPAddress = "192.168.64.5"
        let consoleOutput = "Server will be available at http://localhost:3000\n" + String(repeating: "log line\n", count: 100)

        measure {
            for _ in 0..<100 {
                _ = manager.checkServerReady(consoleOutput: consoleOutput)
            }
        }
    }
}
