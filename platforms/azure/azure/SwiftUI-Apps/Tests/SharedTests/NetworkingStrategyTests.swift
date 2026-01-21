//
// NetworkingStrategyTests.swift
// SharedTests
//
// Created: 2025-11-25
// Purpose: Comprehensive unit tests for NetworkingStrategy and NATNetworkStrategy
//

import XCTest
import Virtualization
@testable import Shared

final class NetworkingStrategyTests: XCTestCase {

    // MARK: - Test NATNetworkStrategy Initialization

    func testNATStrategy_DefaultMACGeneration() {
        let strategy = NATNetworkStrategy()
        let mac = strategy.getMACAddress()

        XCTAssertTrue(mac.hasPrefix("52:54:00:"), "Default MAC should start with 52:54:00")
        XCTAssertEqual(mac.split(separator: ":").count, 6, "MAC should have 6 octets")
    }

    func testNATStrategy_CustomMAC() {
        let customMAC = "52:54:00:AA:BB:CC"
        let strategy = NATNetworkStrategy(macAddress: customMAC)

        XCTAssertEqual(strategy.getMACAddress(), customMAC, "Should use custom MAC address")
    }

    func testNATStrategy_StableMAC() {
        let seed = "test-seed-123"
        let strategy1 = NATNetworkStrategy.withStableMAC(seed: seed)
        let strategy2 = NATNetworkStrategy.withStableMAC(seed: seed)

        XCTAssertEqual(strategy1.getMACAddress(), strategy2.getMACAddress(), "Same seed should produce same MAC")
    }

    func testNATStrategy_StableMAC_DifferentSeeds() {
        let strategy1 = NATNetworkStrategy.withStableMAC(seed: "seed1")
        let strategy2 = NATNetworkStrategy.withStableMAC(seed: "seed2")

        XCTAssertNotEqual(strategy1.getMACAddress(), strategy2.getMACAddress(), "Different seeds should produce different MACs")
    }

    // MARK: - Test MAC Address Validation

    func testMACValidation_ValidFormats() {
        let validMACs = [
            "52:54:00:12:34:56",
            "AA:BB:CC:DD:EE:FF",
            "00:00:00:00:00:00",
            "FF:FF:FF:FF:FF:FF",
            "52:54:00:aa:bb:cc"  // lowercase should be valid
        ]

        for mac in validMACs {
            let strategy = NATNetworkStrategy(macAddress: mac)
            let config = VZVirtualMachineConfiguration()

            XCTAssertNoThrow(try strategy.configure(config), "Valid MAC '\(mac)' should not throw")
        }
    }

    func testMACValidation_InvalidFormats() {
        let invalidMACs = [
            "52:54:00:12:34",      // Too short
            "52:54:00:12:34:56:78", // Too long
            "ZZ:54:00:12:34:56",   // Invalid hex
            "52-54-00-12-34-56",   // Wrong separator
            "52:54:00:12:34:5G",   // Invalid hex digit
            ""                      // Empty
        ]

        for mac in invalidMACs {
            let strategy = NATNetworkStrategy(macAddress: mac)
            let config = VZVirtualMachineConfiguration()

            XCTAssertThrowsError(try strategy.configure(config), "Invalid MAC '\(mac)' should throw") { error in
                XCTAssertTrue(error is NetworkError, "Should throw NetworkError")
            }
        }
    }

    // MARK: - Test Configuration

    func testNATStrategy_Configuration() {
        let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
        let config = VZVirtualMachineConfiguration()

        XCTAssertNoThrow(try strategy.configure(config), "Configuration should succeed")
        XCTAssertEqual(config.networkDevices.count, 1, "Should add one network device")

        let networkDevice = config.networkDevices[0]
        XCTAssertEqual(networkDevice.macAddress.string, "52:54:00:12:34:90", "MAC address should match")
        XCTAssertTrue(networkDevice.attachment is VZNATNetworkDeviceAttachment, "Should use NAT attachment")
    }

    func testNATStrategy_ConfigurationWithInvalidMAC() {
        let strategy = NATNetworkStrategy(macAddress: "invalid-mac")
        let config = VZVirtualMachineConfiguration()

        XCTAssertThrowsError(try strategy.configure(config), "Should throw error for invalid MAC") { error in
            guard let networkError = error as? NetworkError else {
                XCTFail("Expected NetworkError")
                return
            }

            if case .invalidMACAddress(let mac) = networkError {
                XCTAssertEqual(mac, "invalid-mac", "Error should contain invalid MAC")
            } else {
                XCTFail("Expected invalidMACAddress error")
            }
        }
    }

    // MARK: - Test Pre-defined Strategies

    func testPredefinedStrategy_BasicVibeCode() {
        let strategy = NATNetworkStrategy.basicVibeCode

        XCTAssertEqual(strategy.getMACAddress(), "52:54:00:12:34:90", "BasicVibeCode should have predefined MAC")
    }

    func testPredefinedStrategy_LiquidGlass() {
        let strategy = NATNetworkStrategy.liquidGlass

        XCTAssertEqual(strategy.getMACAddress(), "52:54:00:12:34:91", "LiquidGlass should have predefined MAC")
    }

    func testPredefinedStrategy_NetworkTest() {
        let strategy = NATNetworkStrategy.networkTest

        XCTAssertEqual(strategy.getMACAddress(), "52:54:00:12:34:92", "NetworkTest should have predefined MAC")
    }

    func testPredefinedStrategies_Uniqueness() {
        let basic = NATNetworkStrategy.basicVibeCode.getMACAddress()
        let liquid = NATNetworkStrategy.liquidGlass.getMACAddress()
        let test = NATNetworkStrategy.networkTest.getMACAddress()

        XCTAssertNotEqual(basic, liquid, "BasicVibeCode and LiquidGlass should have different MACs")
        XCTAssertNotEqual(basic, test, "BasicVibeCode and NetworkTest should have different MACs")
        XCTAssertNotEqual(liquid, test, "LiquidGlass and NetworkTest should have different MACs")
    }

    // MARK: - Test Connectivity Setup

    func testNATStrategy_SetupConnectivity() {
        let strategy = NATNetworkStrategy()

        // Create a mock manager
        class MockVMManager: BaseVMManager {}
        let manager = MockVMManager()

        // Should not throw or crash
        XCTAssertNoThrow(strategy.setupConnectivity(manager), "setupConnectivity should succeed")
    }

    // MARK: - Test Teardown

    func testNATStrategy_Teardown() {
        let strategy = NATNetworkStrategy()

        // Should not throw or crash
        XCTAssertNoThrow(strategy.teardown(), "teardown should succeed")
    }

    // MARK: - Test NetworkError Types

    func testNetworkError_InterfaceNotFound() {
        let error = NetworkError.interfaceNotFound("eth0")

        XCTAssertEqual(error.errorDescription, "Network interface 'eth0' not found", "Error description should match")
    }

    func testNetworkError_InvalidMACAddress() {
        let error = NetworkError.invalidMACAddress("invalid")

        XCTAssertEqual(error.errorDescription, "Invalid MAC address 'invalid' (expected format: XX:XX:XX:XX:XX:XX)", "Error description should match")
    }

    func testNetworkError_BridgeNetworkingRequiresEntitlement() {
        let error = NetworkError.bridgeNetworkingRequiresEntitlement

        XCTAssertTrue(error.errorDescription?.contains("entitlement") ?? false, "Error should mention entitlement")
    }

    func testNetworkError_ConfigurationFailed() {
        let error = NetworkError.configurationFailed("Test reason")

        XCTAssertEqual(error.errorDescription, "Network configuration failed: Test reason", "Error description should match")
    }

    // MARK: - Test MAC Address Generation Helpers

    func testGenerateRandomMAC_Format() {
        // Test via protocol extension by creating a mock strategy
        class TestStrategy: NetworkingStrategy {
            func configure(_ config: VZVirtualMachineConfiguration) throws {}
            func setupConnectivity(_ manager: BaseVMManager) {}
            func teardown() {}
            func getMACAddress() -> String { return "" }
        }

        let strategy = TestStrategy()
        let mac = strategy.generateRandomMAC()

        XCTAssertTrue(mac.hasPrefix("52:54:00:"), "Generated MAC should start with 52:54:00")
        XCTAssertEqual(mac.split(separator: ":").count, 6, "Generated MAC should have 6 octets")

        // Verify format matches XX:XX:XX:XX:XX:XX
        let pattern = "^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(mac.startIndex..., in: mac)
        XCTAssertNotNil(regex?.firstMatch(in: mac, range: range), "Generated MAC should match format")
    }

    func testGenerateStableMAC_Consistency() {
        class TestStrategy: NetworkingStrategy {
            func configure(_ config: VZVirtualMachineConfiguration) throws {}
            func setupConnectivity(_ manager: BaseVMManager) {}
            func teardown() {}
            func getMACAddress() -> String { return "" }
        }

        let strategy = TestStrategy()
        let seed = "test-seed"

        let mac1 = strategy.generateStableMAC(seed: seed)
        let mac2 = strategy.generateStableMAC(seed: seed)

        XCTAssertEqual(mac1, mac2, "Same seed should generate same MAC")
        XCTAssertTrue(mac1.hasPrefix("52:54:00:"), "Generated MAC should start with 52:54:00")
    }

    func testGenerateStableMAC_Uniqueness() {
        class TestStrategy: NetworkingStrategy {
            func configure(_ config: VZVirtualMachineConfiguration) throws {}
            func setupConnectivity(_ manager: BaseVMManager) {}
            func teardown() {}
            func getMACAddress() -> String { return "" }
        }

        let strategy = TestStrategy()

        let mac1 = strategy.generateStableMAC(seed: "seed1")
        let mac2 = strategy.generateStableMAC(seed: "seed2")
        let mac3 = strategy.generateStableMAC(seed: "seed3")

        XCTAssertNotEqual(mac1, mac2, "Different seeds should generate different MACs")
        XCTAssertNotEqual(mac2, mac3, "Different seeds should generate different MACs")
        XCTAssertNotEqual(mac1, mac3, "Different seeds should generate different MACs")
    }

    // MARK: - Test Multiple Network Devices

    func testMultipleStrategies_Configuration() {
        let strategy1 = NATNetworkStrategy(macAddress: "52:54:00:12:34:01")
        let strategy2 = NATNetworkStrategy(macAddress: "52:54:00:12:34:02")

        let config1 = VZVirtualMachineConfiguration()
        let config2 = VZVirtualMachineConfiguration()

        XCTAssertNoThrow(try strategy1.configure(config1))
        XCTAssertNoThrow(try strategy2.configure(config2))

        XCTAssertEqual(config1.networkDevices[0].macAddress.string, "52:54:00:12:34:01")
        XCTAssertEqual(config2.networkDevices[0].macAddress.string, "52:54:00:12:34:02")
    }

    // MARK: - Test Integration with VZVirtualMachine

    func testNATStrategy_VZIntegration() {
        let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
        let config = VZVirtualMachineConfiguration()

        // Add minimal required configuration
        config.cpuCount = 1
        config.memorySize = 512 * 1024 * 1024
        config.bootLoader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: "/dev/null"))
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        config.socketDevices = [VZVirtioSocketDeviceConfiguration()]

        let platform = VZGenericPlatformConfiguration()
        platform.machineIdentifier = VZGenericMachineIdentifier()
        config.platform = platform

        // Configure networking
        XCTAssertNoThrow(try strategy.configure(config))

        // Note: config.validate() will fail without proper kernel/initramfs,
        // but we can verify the network device was added correctly
        XCTAssertEqual(config.networkDevices.count, 1)
        XCTAssertTrue(config.networkDevices[0].attachment is VZNATNetworkDeviceAttachment)
    }

    // MARK: - Test Case Insensitivity

    func testMACAddress_CaseInsensitivity() {
        let macLower = "52:54:00:aa:bb:cc"
        let macUpper = "52:54:00:AA:BB:CC"
        let macMixed = "52:54:00:Aa:Bb:Cc"

        let strategy1 = NATNetworkStrategy(macAddress: macLower)
        let strategy2 = NATNetworkStrategy(macAddress: macUpper)
        let strategy3 = NATNetworkStrategy(macAddress: macMixed)

        let config1 = VZVirtualMachineConfiguration()
        let config2 = VZVirtualMachineConfiguration()
        let config3 = VZVirtualMachineConfiguration()

        XCTAssertNoThrow(try strategy1.configure(config1), "Lowercase MAC should be valid")
        XCTAssertNoThrow(try strategy2.configure(config2), "Uppercase MAC should be valid")
        XCTAssertNoThrow(try strategy3.configure(config3), "Mixed case MAC should be valid")
    }

    // MARK: - Performance Tests

    func testPerformance_MACGeneration() {
        measure {
            for _ in 0..<1000 {
                _ = NATNetworkStrategy()
            }
        }
    }

    func testPerformance_StableMACGeneration() {
        measure {
            for i in 0..<1000 {
                _ = NATNetworkStrategy.withStableMAC(seed: "seed-\(i)")
            }
        }
    }

    func testPerformance_Configuration() {
        let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:90")

        measure {
            for _ in 0..<100 {
                let config = VZVirtualMachineConfiguration()
                _ = try? strategy.configure(config)
            }
        }
    }

    // MARK: - Test Strategy Protocol Conformance

    func testStrategyProtocol_AllMethodsImplemented() {
        let strategy: NetworkingStrategy = NATNetworkStrategy()

        // Verify all protocol methods are callable
        XCTAssertNoThrow(strategy.getMACAddress())

        let config = VZVirtualMachineConfiguration()
        XCTAssertNoThrow(try strategy.configure(config))

        class MockVMManager: BaseVMManager {}
        let manager = MockVMManager()
        XCTAssertNoThrow(strategy.setupConnectivity(manager))

        XCTAssertNoThrow(strategy.teardown())
    }

    // MARK: - Test Edge Cases

    func testNATStrategy_EmptyMACString() {
        let strategy = NATNetworkStrategy(macAddress: "")
        let config = VZVirtualMachineConfiguration()

        XCTAssertThrowsError(try strategy.configure(config), "Empty MAC should throw")
    }

    func testNATStrategy_WhitespaceMACString() {
        let strategy = NATNetworkStrategy(macAddress: "   ")
        let config = VZVirtualMachineConfiguration()

        XCTAssertThrowsError(try strategy.configure(config), "Whitespace MAC should throw")
    }

    func testNATStrategy_MACWithSpaces() {
        let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:56 ")
        let config = VZVirtualMachineConfiguration()

        // VZMACAddress might be lenient with trailing spaces, or it might fail
        // Either way, our validation should catch it
        XCTAssertThrowsError(try strategy.configure(config), "MAC with spaces should throw")
    }
}
