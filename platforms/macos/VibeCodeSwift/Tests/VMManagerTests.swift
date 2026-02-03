import XCTest
import Virtualization
@testable import VibeCode

final class VMManagerTests: XCTestCase {
    var vmManager: VMManager!
    
    override func setUp() {
        super.setUp()
        vmManager = VMManager()
    }
    
    override func tearDown() {
        vmManager = nil
        super.tearDown()
    }
    
    func testVMManagerInitialization() {
        XCTAssertNotNil(vmManager, "VMManager should initialize")
        XCTAssertEqual(vmManager.vms.count, 0, "Initial VM count should be 0")
    }
    
    func testVMDiscovery() async {
        vmManager.loadAvailableVMs()
        
        // Wait for async discovery to complete
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        
        XCTAssertGreaterThan(vmManager.vms.count, 0, "Should discover at least one VM")
    }
    
    func testVMInfoStructure() {
        let testURL = URL(fileURLWithPath: "/tmp/test.img")
        let vmInfo = VMInfo(
            id: "test",
            name: "Test VM",
            diskPath: testURL,
            efiPath: testURL,
            port: 8080
        )
        
        XCTAssertEqual(vmInfo.id, "test")
        XCTAssertEqual(vmInfo.name, "Test VM")
        XCTAssertEqual(vmInfo.port, 8080)
    }
    
    func testVMStatusEnum() {
        let statuses: [VMStatus] = [.stopped, .starting, .running, .stopping]
        XCTAssertEqual(statuses.count, 4, "Should have 4 VM states")
    }
    
    func testDefaultPortAssignment() {
        let postgresPort = vmManager.getDefaultPort(for: "vibecode-postgresql")
        let valkeyPort = vmManager.getDefaultPort(for: "vibecode-valkey")
        let nodejsPort = vmManager.getDefaultPort(for: "vibecode-nodejs")
        
        XCTAssertEqual(postgresPort, 5432, "PostgreSQL should use port 5432")
        XCTAssertEqual(valkeyPort, 6379, "Valkey should use port 6379")
        XCTAssertEqual(nodejsPort, 3000, "Node.js should use port 3000")
    }
    
    func testPreferencesInjection() {
        guard let suite = UserDefaults(suiteName: "test.vm.prefs") else {
            XCTFail("Failed to create UserDefaults suite")
            return
        }
        suite.removePersistentDomain(forName: "test.vm.prefs")
        
        let prefs = IDEPreferences(userDefaults: suite)
        vmManager.preferences = prefs
        
        XCTAssertNotNil(vmManager.preferences, "VMManager should accept preferences")
        XCTAssertEqual(vmManager.preferences?.port, 8080, "Preferences should be accessible")
        
        suite.removePersistentDomain(forName: "test.vm.prefs")
    }
    
    func testAutoStartConfiguration() {
        guard let suite = UserDefaults(suiteName: "test.vm.autostart") else {
            XCTFail("Failed to create UserDefaults suite")
            return
        }
        suite.removePersistentDomain(forName: "test.vm.autostart")
        
        let prefs = IDEPreferences(userDefaults: suite)
        vmManager.preferences = prefs
        
        // Configure auto-start for a test VM
        prefs.setAutoStart(for: "test-vm", enabled: true)
        
        XCTAssertTrue(prefs.isAutoStartEnabled(for: "test-vm"), "Auto-start should be enabled")
        XCTAssertFalse(prefs.isAutoStartEnabled(for: "other-vm"), "Other VM should not auto-start")
        
        suite.removePersistentDomain(forName: "test.vm.autostart")
    }
}

// Make getDefaultPort accessible for testing
extension VMManager {
    func getDefaultPort(for vmName: String) -> Int {
        if vmName.contains("postgresql") {
            return 5432
        } else if vmName.contains("valkey") {
            return 6379
        } else if vmName.contains("nodejs") {
            return 3000
        }
        return 8080
    }
}

