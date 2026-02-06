#if canImport(XCTest)
import XCTest
@testable import VibeCodeCore

final class IDEPreferencesTests: XCTestCase {
    func testDefaultsAndPersistence() {
        guard let suite = UserDefaults(suiteName: "test.ide.preferences") else {
            XCTFail("Failed to create UserDefaults suite")
            return
        }
        suite.removePersistentDomain(forName: "test.ide.preferences")

        var prefs = IDEPreferences(userDefaults: suite)
        // Defaults
        XCTAssertEqual(prefs.binaryPath, "")
        XCTAssertEqual(prefs.workspacePath, "")
        XCTAssertEqual(prefs.port, 8080)
        XCTAssertEqual(prefs.ddTraceEnabled, false)
        XCTAssertEqual(prefs.launchAtLogin, false)
        XCTAssertEqual(prefs.autoStartVMs.count, 0)

        // Mutate
        prefs.binaryPath = "/opt/bin/ide"
        prefs.workspacePath = "/tmp/work"
        prefs.port = 9090
        prefs.ddTraceEnabled = true
        prefs.launchAtLogin = true
        prefs.setAutoStart(for: "test-vm", enabled: true)

        // Reload
        let prefs2 = IDEPreferences(userDefaults: suite)
        XCTAssertEqual(prefs2.binaryPath, "/opt/bin/ide")
        XCTAssertEqual(prefs2.workspacePath, "/tmp/work")
        XCTAssertEqual(prefs2.port, 9090)
        XCTAssertEqual(prefs2.ddTraceEnabled, true)
        XCTAssertEqual(prefs2.launchAtLogin, true)
        XCTAssertTrue(prefs2.isAutoStartEnabled(for: "test-vm"))

        suite.removePersistentDomain(forName: "test.ide.preferences")
    }
    
    func testAutoStartHelperMethods() {
        guard let suite = UserDefaults(suiteName: "test.ide.autostart") else {
            XCTFail("Failed to create UserDefaults suite")
            return
        }
        suite.removePersistentDomain(forName: "test.ide.autostart")
        
        let prefs = IDEPreferences(userDefaults: suite)
        
        // Test default state
        XCTAssertFalse(prefs.isAutoStartEnabled(for: "vm1"))
        XCTAssertFalse(prefs.isAutoStartEnabled(for: "vm2"))
        
        // Enable auto-start for vm1
        prefs.setAutoStart(for: "vm1", enabled: true)
        XCTAssertTrue(prefs.isAutoStartEnabled(for: "vm1"))
        XCTAssertFalse(prefs.isAutoStartEnabled(for: "vm2"))
        
        // Enable auto-start for vm2
        prefs.setAutoStart(for: "vm2", enabled: true)
        XCTAssertTrue(prefs.isAutoStartEnabled(for: "vm1"))
        XCTAssertTrue(prefs.isAutoStartEnabled(for: "vm2"))
        
        // Disable auto-start for vm1
        prefs.setAutoStart(for: "vm1", enabled: false)
        XCTAssertFalse(prefs.isAutoStartEnabled(for: "vm1"))
        XCTAssertTrue(prefs.isAutoStartEnabled(for: "vm2"))
        
        suite.removePersistentDomain(forName: "test.ide.autostart")
    }
    
    func testAutoStartPersistence() {
        guard let suite = UserDefaults(suiteName: "test.ide.autostart.persist") else {
            XCTFail("Failed to create UserDefaults suite")
            return
        }
        suite.removePersistentDomain(forName: "test.ide.autostart.persist")
        
        // Set auto-start preferences
        var prefs1 = IDEPreferences(userDefaults: suite)
        prefs1.setAutoStart(for: "postgresql", enabled: true)
        prefs1.setAutoStart(for: "valkey", enabled: false)
        prefs1.setAutoStart(for: "nodejs", enabled: true)
        
        // Create new instance and verify persistence
        let prefs2 = IDEPreferences(userDefaults: suite)
        XCTAssertTrue(prefs2.isAutoStartEnabled(for: "postgresql"))
        XCTAssertFalse(prefs2.isAutoStartEnabled(for: "valkey"))
        XCTAssertTrue(prefs2.isAutoStartEnabled(for: "nodejs"))
        
        suite.removePersistentDomain(forName: "test.ide.autostart.persist")
    }
}
#endif
