import Foundation
import Network
import Combine

// MARK: - Service Discovery

/// Multi-layer service discovery for automatic Mac host detection
@available(macOS 12.0, *)
public final class ServiceDiscovery: ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var discoveredHosts: [MacHost] = []

    // MARK: - Dependencies

    private let config: DiscoveryConfig
    private var bonjourBrowser: NWBrowser?
    private var consulClient: ConsulClient?
    private var dnsResolver: DNSResolver?

    // MARK: - State

    private var activeServices: Set<NWBrowser.Result> = []
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(config: DiscoveryConfig) {
        self.config = config

        if config.enableBonjour {
            setupBonjourBrowser()
        }

        if config.enableConsul, let consulURL = config.consulURL {
            self.consulClient = ConsulClient(baseURL: consulURL)
        }

        if config.enableDNS {
            self.dnsResolver = DNSResolver(domain: config.dnsDomain)
        }
    }

    // MARK: - Public API

    public func start() async throws {
        Logger.info("Starting service discovery...")

        if config.enableBonjour {
            startBonjourDiscovery()
        }

        if config.enableConsul {
            try await startConsulDiscovery()
        }

        if config.enableDNS {
            try await startDNSDiscovery()
        }

        Logger.info("Service discovery started")
    }

    public func stop() async {
        Logger.info("Stopping service discovery...")

        bonjourBrowser?.cancel()
        bonjourBrowser = nil

        if let consul = consulClient {
            await consul.deregisterAll()
        }

        Logger.info("Service discovery stopped")
    }

    // MARK: - Bonjour (mDNS) Discovery

    private func setupBonjourBrowser() {
        let parameters = NWParameters()
        parameters.includePeerToPeer = true

        bonjourBrowser = NWBrowser(
            for: .bonjour(type: config.bonjourServiceType, domain: config.bonjourDomain),
            using: parameters
        )
    }

    private func startBonjourDiscovery() {
        guard let browser = bonjourBrowser else { return }

        browser.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                Logger.info("Bonjour browser ready")
            case .failed(let error):
                Logger.error("Bonjour browser failed: \(error)")
            case .cancelled:
                Logger.info("Bonjour browser cancelled")
            default:
                break
            }
        }

        browser.browseResultsChangedHandler = { [weak self] results, changes in
            self?.handleBonjourResults(results: results, changes: changes)
        }

        browser.start(queue: .main)
    }

    private func handleBonjourResults(
        results: Set<NWBrowser.Result>,
        changes: Set<NWBrowser.Result.Change>
    ) {
        for change in changes {
            switch change {
            case .added(let result):
                Logger.info("Discovered service: \(result)")
                Task {
                    await handleServiceAdded(result)
                }

            case .removed(let result):
                Logger.info("Service removed: \(result)")
                await handleServiceRemoved(result)

            default:
                break
            }
        }

        activeServices = results
    }

    private func handleServiceAdded(_ result: NWBrowser.Result) async {
        guard case .service(let name, let type, let domain, _) = result.endpoint else {
            return
        }

        Logger.info("Resolving service: \(name).\(type).\(domain)")

        // Create connection to resolve endpoint
        let connection = NWConnection(to: result.endpoint, using: .tcp)

        connection.stateUpdateHandler = { [weak self] state in
            if case .ready = state {
                Task {
                    await self?.extractHostInfo(from: result, connection: connection)
                }
            }
        }

        connection.start(queue: .main)
    }

    private func extractHostInfo(from result: NWBrowser.Result, connection: NWConnection) async {
        guard case .service(let name, _, _, _) = result.endpoint else {
            return
        }

        // Extract TXT records for metadata
        let metadata = parseTXTRecords(from: result)

        guard let ipAddress = extractIPAddress(from: connection),
              let architecture = metadata["arch"],
              let totalCPU = metadata["cpu"].flatMap(Int.init),
              let totalMemory = metadata["memory"].flatMap(Int.init) else {
            Logger.warning("Incomplete host metadata for \(name)")
            return
        }

        let host = MacHost(
            hostname: name,
            ipAddress: ipAddress,
            architecture: architecture,
            totalCPU: totalCPU,
            totalMemory: totalMemory,
            tags: metadata
        )

        await MainActor.run {
            if !discoveredHosts.contains(where: { $0.id == host.id }) {
                discoveredHosts.append(host)
                Logger.info("Added host: \(host.hostname) (\(host.ipAddress))")
            }
        }

        connection.cancel()
    }

    private func handleServiceRemoved(_ result: NWBrowser.Result) async {
        guard case .service(let name, _, _, _) = result.endpoint else {
            return
        }

        await MainActor.run {
            discoveredHosts.removeAll { $0.hostname == name }
            Logger.info("Removed host: \(name)")
        }
    }

    private func parseTXTRecords(from result: NWBrowser.Result) -> [String: String] {
        // Parse TXT records from mDNS service
        // This is a simplified version - real implementation would extract from NWEndpoint
        var records: [String: String] = [:]

        // Example TXT records:
        // arch=arm64
        // cpu=8000
        // memory=16384
        // version=1.0.0

        return records
    }

    private func extractIPAddress(from connection: NWConnection) -> String? {
        if case .hostPort(let host, _) = connection.currentPath?.remoteEndpoint {
            switch host {
            case .ipv4(let address):
                return address.debugDescription
            case .ipv6(let address):
                return address.debugDescription
            default:
                return nil
            }
        }
        return nil
    }

    // MARK: - Consul Discovery

    private func startConsulDiscovery() async throws {
        guard let consul = consulClient else {
            throw DiscoveryError.consulNotConfigured
        }

        // Register health check
        try await consul.registerService(
            name: config.serviceName,
            port: config.servicePort,
            tags: config.serviceTags
        )

        // Start periodic service catalog polling
        startConsulPolling()
    }

    private func startConsulPolling() {
        Timer.publish(every: config.consulPollInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task {
                    await self?.pollConsulServices()
                }
            }
            .store(in: &cancellables)
    }

    private func pollConsulServices() async {
        guard let consul = consulClient else { return }

        do {
            let services = try await consul.discoverServices(tag: "vibecode-agent")

            for service in services {
                let host = MacHost(
                    hostname: service.node,
                    ipAddress: service.address,
                    architecture: service.meta["arch"] ?? "unknown",
                    totalCPU: Int(service.meta["cpu"] ?? "0") ?? 0,
                    totalMemory: Int(service.meta["memory"] ?? "0") ?? 0,
                    tags: service.meta
                )

                await MainActor.run {
                    if !discoveredHosts.contains(where: { $0.ipAddress == host.ipAddress }) {
                        discoveredHosts.append(host)
                        Logger.info("Consul: Added host \(host.hostname)")
                    }
                }
            }
        } catch {
            Logger.error("Consul polling failed: \(error)")
        }
    }

    // MARK: - DNS-Based Discovery

    private func startDNSDiscovery() async throws {
        guard let resolver = dnsResolver else {
            throw DiscoveryError.dnsNotConfigured
        }

        let records = try await resolver.resolveSRVRecords(service: config.dnsServiceName)

        for record in records {
            let host = MacHost(
                hostname: record.target,
                ipAddress: record.ipAddress,
                architecture: "unknown", // DNS doesn't provide this
                totalCPU: 8000, // Default assumption
                totalMemory: 16384
            )

            await MainActor.run {
                if !discoveredHosts.contains(where: { $0.ipAddress == host.ipAddress }) {
                    discoveredHosts.append(host)
                    Logger.info("DNS: Added host \(host.hostname)")
                }
            }
        }
    }
}

// MARK: - Discovery Configuration

public struct DiscoveryConfig {
    // Bonjour settings
    public let enableBonjour: Bool
    public let bonjourServiceType: String
    public let bonjourDomain: String?

    // Consul settings
    public let enableConsul: Bool
    public let consulURL: URL?
    public let consulPollInterval: TimeInterval
    public let serviceName: String
    public let servicePort: Int
    public let serviceTags: [String]

    // DNS settings
    public let enableDNS: Bool
    public let dnsDomain: String
    public let dnsServiceName: String

    public init(
        enableBonjour: Bool = true,
        bonjourServiceType: String = "_vibecode-agent._tcp",
        bonjourDomain: String? = nil,
        enableConsul: Bool = false,
        consulURL: URL? = nil,
        consulPollInterval: TimeInterval = 30,
        serviceName: String = "vibecode-agent",
        servicePort: Int = 3284,
        serviceTags: [String] = ["vibecode", "agent"],
        enableDNS: Bool = false,
        dnsDomain: String = "local",
        dnsServiceName: String = "vibecode-agent"
    ) {
        self.enableBonjour = enableBonjour
        self.bonjourServiceType = bonjourServiceType
        self.bonjourDomain = bonjourDomain
        self.enableConsul = enableConsul
        self.consulURL = consulURL
        self.consulPollInterval = consulPollInterval
        self.serviceName = serviceName
        self.servicePort = servicePort
        self.serviceTags = serviceTags
        self.enableDNS = enableDNS
        self.dnsDomain = dnsDomain
        self.dnsServiceName = dnsServiceName
    }

    public static let `default` = DiscoveryConfig()
}

// MARK: - Supporting Types

public enum DiscoveryError: Error, LocalizedError {
    case consulNotConfigured
    case dnsNotConfigured
    case serviceResolutionFailed

    public var errorDescription: String? {
        switch self {
        case .consulNotConfigured:
            return "Consul discovery is not configured"
        case .dnsNotConfigured:
            return "DNS discovery is not configured"
        case .serviceResolutionFailed:
            return "Failed to resolve service endpoint"
        }
    }
}

// MARK: - Consul Client (Stub)

private final class ConsulClient {
    let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func registerService(name: String, port: Int, tags: [String]) async throws {
        // HTTP POST to /v1/agent/service/register
        Logger.info("Registering service with Consul: \(name)")
    }

    func deregisterAll() async {
        // HTTP PUT to /v1/agent/service/deregister/:id
        Logger.info("Deregistering all services from Consul")
    }

    func discoverServices(tag: String) async throws -> [ConsulService] {
        // HTTP GET to /v1/catalog/service/:name
        return []
    }
}

private struct ConsulService {
    let node: String
    let address: String
    let meta: [String: String]
}

// MARK: - DNS Resolver (Stub)

private final class DNSResolver {
    let domain: String

    init(domain: String) {
        self.domain = domain
    }

    func resolveSRVRecords(service: String) async throws -> [SRVRecord] {
        // Perform DNS SRV lookup
        // dig SRV _vibecode-agent._tcp.local
        return []
    }
}

private struct SRVRecord {
    let priority: Int
    let weight: Int
    let port: Int
    let target: String
    let ipAddress: String
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[DISCOVERY] [INFO] \(Date()) \(message)")
    }

    static func warning(_ message: String) {
        print("[DISCOVERY] [WARN] \(Date()) \(message)")
    }

    static func error(_ message: String) {
        print("[DISCOVERY] [ERROR] \(Date()) \(message)")
    }
}
