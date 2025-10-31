import Foundation

// Forward declare VMInfo structure
struct VMInfoContext {
    let id: String
    let name: String
    let diskPath: URL
    let efiPath: URL
}

/// Comprehensive observability for VM operations
class VMObservability {
    static let shared = VMObservability()
    
    private let hostname: String
    private let environment: String
    
    init() {
        self.hostname = Host.current().name ?? "unknown"
        self.environment = ProcessInfo.processInfo.environment["ENV"] ?? "development"
    }
    
    /// Track complete VM start operation with distributed context
    func trackVMStart(_ vmId: String, _ vmName: String, operation: () async throws -> Void) async rethrows {
        let vm = (id: vmId, name: vmName)
        let startTime = Date()
        let traceId = UUID().uuidString
        let spanId = UUID().uuidString.prefix(16)
        
        // Start span
        logStructured(.info, "vm.start.initiated", [
            "trace.id": traceId,
            "span.id": String(spanId),
            "vm.id": vm.id,
            "vm.name": vm.name,
            "vm.type": extractVMType(from: vm.name),
            "host.name": hostname,
            "env": environment,
            "operation": "vm.start",
            "timestamp": ISO8601DateFormatter().string(from: startTime)
        ])
        
        // Send metric
        DogStatsDClient.shared.increment("vm.start.attempt", tags: [
            "vm_id:\(vm.id)",
            "vm_name:\(vm.name)",
            "host:\(hostname)",
            "env:\(environment)"
        ])
        
        do {
            // Execute operation
            try await operation()
            
            // Success
            let duration = Date().timeIntervalSince(startTime)
            
            logStructured(.info, "vm.start.completed", [
                "trace.id": traceId,
                "span.id": String(spanId),
                "vm.id": vm.id,
                "duration.seconds": duration,
                "duration.milliseconds": Int(duration * 1000),
                "result": "success",
                "host.name": hostname
            ])
            
            DogStatsDClient.shared.increment("vm.start.success", tags: [
                "vm_id:\(vm.id)",
                "vm_name:\(vm.name)",
                "host:\(hostname)"
            ])
            
            DogStatsDClient.shared.timing("vm.start.duration",
                milliseconds: Int(duration * 1000),
                tags: ["vm_id:\(vm.id)", "host:\(hostname)"])
            
            DogStatsDClient.shared.event("VM Started",
                text: "VM \(vm.name) started successfully in \(String(format: "%.2f", duration))s",
                alertType: "success",
                tags: ["vm_id:\(vm.id)", "host:\(hostname)", "trace_id:\(traceId)"])
            
        } catch {
            // Failure
            let duration = Date().timeIntervalSince(startTime)
            
            logStructured(.error, "vm.start.failed", [
                "trace.id": traceId,
                "span.id": String(spanId),
                "vm.id": vm.id,
                "duration.seconds": duration,
                "result": "failure",
                "error.type": String(describing: type(of: error)),
                "error.message": error.localizedDescription,
                "host.name": hostname
            ])
            
            DogStatsDClient.shared.increment("vm.start.failure", tags: [
                "vm_id:\(vm.id)",
                "vm_name:\(vm.name)",
                "host:\(hostname)",
                "error:\(String(describing: type(of: error)))"
            ])
            
            DogStatsDClient.shared.event("VM Start Failed",
                text: "VM \(vm.name) failed to start: \(error.localizedDescription)",
                alertType: "error",
                tags: ["vm_id:\(vm.id)", "host:\(hostname)", "trace_id:\(traceId)"])
            
            throw error
        }
    }
    
    /// Track VM discovery
    func trackVMDiscovery(discovered: Int) {
        logStructured(.info, "vm.discovery.completed", [
            "vm.count": discovered,
            "host.name": hostname,
            "env": environment
        ])
        
        DogStatsDClient.shared.gauge("vm.discovered.count",
            value: Double(discovered),
            tags: ["host:\(hostname)", "env:\(environment)"])
        
        DogStatsDClient.shared.event("VM Discovery",
            text: "Discovered \(discovered) VMs on \(hostname)",
            alertType: "info",
            tags: ["host:\(hostname)"])
    }
    
    /// Track running VM count
    func trackRunningVMs(count: Int) {
        DogStatsDClient.shared.gauge("vm.running.count",
            value: Double(count),
            tags: ["host:\(hostname)", "env:\(environment)"])
    }
    
    /// Track service availability (e.g., PostgreSQL ready)
    func trackServiceReady(_ service: String, vmId: String, duration: TimeInterval) {
        logStructured(.info, "service.ready", [
            "service": service,
            "vm.id": vmId,
            "duration.seconds": duration,
            "host.name": hostname
        ])
        
        DogStatsDClient.shared.timing("service.ready.duration",
            milliseconds: Int(duration * 1000),
            tags: ["service:\(service)", "vm_id:\(vmId)", "host:\(hostname)"])
        
        DogStatsDClient.shared.serviceCheck("service.available",
            status: .ok,
            tags: ["service:\(service)", "vm_id:\(vmId)", "host:\(hostname)"])
    }
    
    /// Track user interaction latency
    func trackInteractionLatency(_ interaction: String, duration: TimeInterval) {
        DogStatsDClient.shared.timing("gui.interaction.duration",
            milliseconds: Int(duration * 1000),
            tags: ["interaction:\(interaction)", "host:\(hostname)"])
    }
    
    // MARK: - Helpers
    
    private func extractVMType(from name: String) -> String {
        let lowercased = name.lowercased()
        if lowercased.contains("postgresql") || lowercased.contains("pgvector") {
            return "database"
        } else if lowercased.contains("valkey") || lowercased.contains("redis") {
            return "cache"
        } else if lowercased.contains("nodejs") || lowercased.contains("node") {
            return "runtime"
        } else if lowercased.contains("ide") || lowercased.contains("codeserver") || lowercased.contains("vscode") {
            return "ide"
        }
        return "unknown"
    }
    
    private func logStructured(_ level: LogLevel, _ event: String, _ attributes: [String: Any]) {
        var logData: [String: Any] = attributes
        logData["event"] = event
        logData["level"] = level.rawValue
        logData["service"] = "vibecode"
        logData["source"] = "swift"
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: logData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            NSLog("%@", jsonString)
            
            // Also log to file via DatadogLogger
            DatadogLogger.shared.info(event, attributes)
        }
    }
    
    enum LogLevel: String {
        case info = "INFO"
        case error = "ERROR"
        case debug = "DEBUG"
    }
}

