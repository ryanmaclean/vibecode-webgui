import Foundation
import Combine

public final class IDEPreferences: ObservableObject {
    private let defaults: UserDefaults

    @Published public var binaryPath: String { didSet { save() } }
    @Published public var workspacePath: String { didSet { save() } }
    @Published public var port: Int { didSet { save() } }
    @Published public var ddTraceEnabled: Bool { didSet { save() } }
    @Published public var launchAtLogin: Bool { didSet { save() } }
    @Published public var autoStartVMs: [String: Bool] { didSet { save() } }

    public init(userDefaults: UserDefaults = .standard) {
        self.defaults = userDefaults
        self.binaryPath = userDefaults.string(forKey: "ide.binaryPath") ?? ""
        self.workspacePath = userDefaults.string(forKey: "ide.workspacePath") ?? ""
        let p = userDefaults.integer(forKey: "ide.port")
        self.port = p > 0 ? p : 8080
        self.ddTraceEnabled = userDefaults.object(forKey: "ide.ddTraceEnabled") as? Bool ?? false
        self.launchAtLogin = userDefaults.object(forKey: "ide.launchAtLogin") as? Bool ?? false
        self.autoStartVMs = userDefaults.dictionary(forKey: "vm.autoStart") as? [String: Bool] ?? [:]
    }

    public func save() {
        defaults.set(binaryPath, forKey: "ide.binaryPath")
        defaults.set(workspacePath, forKey: "ide.workspacePath")
        defaults.set(port, forKey: "ide.port")
        defaults.set(ddTraceEnabled, forKey: "ide.ddTraceEnabled")
        defaults.set(launchAtLogin, forKey: "ide.launchAtLogin")
        defaults.set(autoStartVMs, forKey: "vm.autoStart")
    }
    
    // Helper methods for VM auto-start
    public func isAutoStartEnabled(for vmId: String) -> Bool {
        return autoStartVMs[vmId] ?? false
    }
    
    public func setAutoStart(for vmId: String, enabled: Bool) {
        autoStartVMs[vmId] = enabled
    }
}
