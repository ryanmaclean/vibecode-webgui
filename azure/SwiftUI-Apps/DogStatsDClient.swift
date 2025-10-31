import Foundation
import Network

class DogStatsDClient {
    static let shared = DogStatsDClient()
    
    private let host: String
    private let port: UInt16
    private var connection: NWConnection?
    
    init(host: String = "127.0.0.1", port: UInt16 = 8135) {
        self.host = host
        self.port = port
        setupConnection()
    }
    
    private func setupConnection() {
        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(integerLiteral: port)
        )
        
        connection = NWConnection(to: endpoint, using: .udp)
        connection?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                NSLog("✅ DogStatsD: Connection ready to \(self.host):\(self.port)")
            case .failed(let error):
                NSLog("❌ DogStatsD: Connection failed: \(error)")
            case .waiting(let error):
                NSLog("⏳ DogStatsD: Connection waiting: \(error)")
            default:
                NSLog("📡 DogStatsD: Connection state: \(state)")
            }
        }
        connection?.start(queue: .global())
        NSLog("🚀 DogStatsD: Client initialized for \(host):\(port)")
    }
    
    func increment(_ metric: String, tags: [String] = []) {
        sendMetric("\(metric):1|c|\(formatTags(tags))")
    }
    
    func gauge(_ metric: String, value: Double, tags: [String] = []) {
        sendMetric("\(metric):\(value)|g|\(formatTags(tags))")
    }
    
    func timing(_ metric: String, milliseconds: Int, tags: [String] = []) {
        sendMetric("\(metric):\(milliseconds)|ms|\(formatTags(tags))")
    }
    
    func histogram(_ metric: String, value: Double, tags: [String] = []) {
        sendMetric("\(metric):\(value)|h|\(formatTags(tags))")
    }
    
    private func formatTags(_ tags: [String]) -> String {
        guard !tags.isEmpty else { return "" }
        return "#" + tags.joined(separator: ",")
    }
    
    private func sendMetric(_ metric: String) {
        guard let connection = connection else {
            NSLog("❌ DogStatsD: No connection available")
            return
        }
        
        NSLog("📊 DogStatsD: Sending metric: \(metric)")
        let data = metric.data(using: .utf8)!
        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                NSLog("❌ DogStatsD send error: \(error)")
            } else {
                NSLog("✅ DogStatsD: Metric sent successfully")
            }
        })
    }
    
    func event(_ title: String, text: String, alertType: String = "info", tags: [String] = []) {
        let timestamp = Int(Date().timeIntervalSince1970)
        let formattedTitle = title.replacingOccurrences(of: "\n", with: "\\n")
        let formattedText = text.replacingOccurrences(of: "\n", with: "\\n")
        let metric = "_e{\(formattedTitle.count),\(formattedText.count)}:\(formattedTitle)|\(formattedText)|d:\(timestamp)|t:\(alertType)|\(formatTags(tags))"
        sendMetric(metric)
    }
    
    func serviceCheck(_ name: String, status: ServiceCheckStatus, tags: [String] = []) {
        let metric = "_sc|\(name)|\(status.rawValue)|\(formatTags(tags))"
        sendMetric(metric)
    }
    
    enum ServiceCheckStatus: Int {
        case ok = 0
        case warning = 1
        case critical = 2
        case unknown = 3
    }
}

