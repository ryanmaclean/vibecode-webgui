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

        // Mutate
        prefs.binaryPath = "/opt/bin/ide"
        prefs.workspacePath = "/tmp/work"
        prefs.port = 9090
        prefs.ddTraceEnabled = true
        prefs.launchAtLogin = true

        // Reload
        let prefs2 = IDEPreferences(userDefaults: suite)
        XCTAssertEqual(prefs2.binaryPath, "/opt/bin/ide")
        XCTAssertEqual(prefs2.workspacePath, "/tmp/work")
        XCTAssertEqual(prefs2.port, 9090)
        XCTAssertEqual(prefs2.ddTraceEnabled, true)
        XCTAssertEqual(prefs2.launchAtLogin, true)

        suite.removePersistentDomain(forName: "test.ide.preferences")
    }
}
#endif
