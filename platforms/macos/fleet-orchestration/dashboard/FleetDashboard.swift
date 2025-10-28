import SwiftUI
import Combine

// MARK: - Fleet Dashboard (SwiftUI)

/// Real-time fleet monitoring and management dashboard
@available(macOS 12.0, *)
public struct FleetDashboard: View {

    @StateObject private var viewModel: FleetDashboardViewModel

    public init(fleetManager: FleetManager) {
        _viewModel = StateObject(wrappedValue: FleetDashboardViewModel(fleetManager: fleetManager))
    }

    public var body: some View {
        NavigationView {
            // Sidebar
            List {
                NavigationLink("Overview", destination: FleetOverviewView(viewModel: viewModel))
                NavigationLink("Hosts", destination: HostListView(viewModel: viewModel))
                NavigationLink("Containers", destination: ContainerListView(viewModel: viewModel))
                NavigationLink("Scheduler", destination: SchedulerView(viewModel: viewModel))
                NavigationLink("Auto-Scaler", destination: AutoScalerView(viewModel: viewModel))
                NavigationLink("Alerts", destination: AlertsView(viewModel: viewModel))
                NavigationLink("Events", destination: EventsView(viewModel: viewModel))
            }
            .listStyle(SidebarListStyle())
            .frame(minWidth: 200)

            // Default content
            FleetOverviewView(viewModel: viewModel)
        }
        .frame(minWidth: 1200, minHeight: 800)
        .navigationTitle("Fleet Manager")
    }
}

// MARK: - Fleet Overview

@available(macOS 12.0, *)
struct FleetOverviewView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Health Status
                FleetHealthCard(health: viewModel.fleetHealth)

                // Quick Stats
                HStack(spacing: 20) {
                    StatCard(
                        title: "Hosts",
                        value: "\(viewModel.totalHosts)",
                        subtitle: "\(viewModel.healthyHosts) healthy",
                        color: .blue
                    )

                    StatCard(
                        title: "Containers",
                        value: "\(viewModel.totalContainers)",
                        subtitle: "\(viewModel.runningContainers) running",
                        color: .green
                    )

                    StatCard(
                        title: "CPU",
                        value: "\(Int(viewModel.cpuUtilization * 100))%",
                        subtitle: "Utilization",
                        color: cpuColor
                    )

                    StatCard(
                        title: "Memory",
                        value: "\(Int(viewModel.memoryUtilization * 100))%",
                        subtitle: "Utilization",
                        color: memoryColor
                    )
                }

                // Resource Charts
                HStack(spacing: 20) {
                    ResourceChart(
                        title: "CPU Utilization",
                        values: viewModel.cpuHistory,
                        color: .blue
                    )

                    ResourceChart(
                        title: "Memory Utilization",
                        values: viewModel.memoryHistory,
                        color: .green
                    )
                }
                .frame(height: 200)

                // Recent Events
                EventsListView(events: viewModel.recentEvents)
            }
            .padding()
        }
    }

    private var cpuColor: Color {
        viewModel.cpuUtilization > 0.9 ? .red : (viewModel.cpuUtilization > 0.7 ? .orange : .green)
    }

    private var memoryColor: Color {
        viewModel.memoryUtilization > 0.9 ? .red : (viewModel.memoryUtilization > 0.7 ? .orange : .green)
    }
}

// MARK: - Host List View

@available(macOS 12.0, *)
struct HostListView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel
    @State private var selectedHost: MacHost?

    var body: some View {
        HSplitView {
            // Host list
            List(viewModel.hosts, selection: $selectedHost) { host in
                HostRow(host: host)
                    .tag(host)
            }
            .frame(minWidth: 300)

            // Host detail
            if let host = selectedHost {
                HostDetailView(host: host, viewModel: viewModel)
            } else {
                Text("Select a host")
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Host Row

struct HostRow: View {
    let host: MacHost

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)

                Text(host.hostname)
                    .font(.headline)

                Spacer()

                Text(host.architecture)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(4)
            }

            Text(host.ipAddress)
                .font(.caption)
                .foregroundColor(.secondary)

            HStack {
                Label("\(Int(host.cpuUtilization * 100))%", systemImage: "cpu")
                Label("\(Int(host.memoryUtilization * 100))%", systemImage: "memorychip")
                Label("\(host.containers.count)", systemImage: "cube.box")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch host.status {
        case .healthy: return .green
        case .degraded: return .orange
        case .failed: return .red
        case .maintenance: return .gray
        case .draining: return .yellow
        }
    }
}

// MARK: - Host Detail View

@available(macOS 12.0, *)
struct HostDetailView: View {
    let host: MacHost
    @ObservedObject var viewModel: FleetDashboardViewModel
    @State private var showingDrainConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading) {
                        Text(host.hostname)
                            .font(.title)
                        Text(host.ipAddress)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    // Actions
                    HStack {
                        Button("Drain") {
                            showingDrainConfirmation = true
                        }
                        .disabled(host.status == .draining)

                        Button("Maintenance Mode") {
                            viewModel.setMaintenanceMode(hostId: host.id)
                        }
                    }
                }

                Divider()

                // Resources
                VStack(alignment: .leading, spacing: 10) {
                    Text("Resources")
                        .font(.headline)

                    ProgressView(value: host.cpuUtilization) {
                        HStack {
                            Text("CPU")
                            Spacer()
                            Text("\(Int(host.cpuUtilization * 100))%")
                        }
                    }

                    ProgressView(value: host.memoryUtilization) {
                        HStack {
                            Text("Memory")
                            Spacer()
                            Text("\(Int(host.memoryUtilization * 100))%")
                        }
                    }

                    HStack {
                        VStack(alignment: .leading) {
                            Text("Total CPU")
                            Text("\(host.totalCPU)m")
                                .font(.caption)
                        }

                        Spacer()

                        VStack(alignment: .leading) {
                            Text("Total Memory")
                            Text("\(host.totalMemory)MB")
                                .font(.caption)
                        }
                    }
                }

                Divider()

                // Containers
                VStack(alignment: .leading) {
                    Text("Containers (\(host.containers.count))")
                        .font(.headline)

                    if host.containers.isEmpty {
                        Text("No containers running")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(host.containers, id: \.self) { containerId in
                            if let container = viewModel.getContainer(id: containerId) {
                                ContainerCard(container: container, viewModel: viewModel)
                            }
                        }
                    }
                }

                Divider()

                // Metadata
                VStack(alignment: .leading) {
                    Text("Metadata")
                        .font(.headline)

                    ForEach(Array(host.tags.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text(key)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(host.tags[key] ?? "")
                        }
                        .font(.caption)
                    }
                }
            }
            .padding()
        }
        .alert("Drain Host", isPresented: $showingDrainConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Drain", role: .destructive) {
                viewModel.drainHost(hostId: host.id)
            }
        } message: {
            Text("This will migrate all containers off this host. Continue?")
        }
    }
}

// MARK: - Container List View

@available(macOS 12.0, *)
struct ContainerListView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel

    var body: some View {
        List(viewModel.containers) { container in
            ContainerCard(container: container, viewModel: viewModel)
        }
    }
}

// MARK: - Container Card

@available(macOS 12.0, *)
struct ContainerCard: View {
    let container: Container
    @ObservedObject var viewModel: FleetDashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)

                Text(container.agentType)
                    .font(.headline)

                Spacer()

                Menu {
                    Button("View Logs") {
                        viewModel.viewContainerLogs(containerId: container.id)
                    }

                    Button("Restart") {
                        viewModel.restartContainer(containerId: container.id)
                    }

                    Button("Migrate") {
                        viewModel.migrateContainer(containerId: container.id)
                    }

                    Divider()

                    Button("Stop", role: .destructive) {
                        viewModel.stopContainer(containerId: container.id)
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }

            Text(container.workspace)
                .font(.caption)
                .foregroundColor(.secondary)

            HStack {
                Label("\(container.resources.cpu)m", systemImage: "cpu")
                Label("\(container.resources.memory)MB", systemImage: "memorychip")
                Label(formatUptime(container.uptime), systemImage: "clock")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }

    private var statusColor: Color {
        switch container.status {
        case .running: return .green
        case .pending: return .yellow
        case .stopped: return .gray
        case .failed: return .red
        case .migrating: return .blue
        }
    }

    private func formatUptime(_ seconds: TimeInterval) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60
        return "\(hours)h \(minutes)m"
    }
}

// MARK: - Supporting Views

struct FleetHealthCard: View {
    let health: FleetHealth

    var body: some View {
        HStack {
            Image(systemName: healthIcon)
                .font(.largeTitle)
                .foregroundColor(healthColor)

            VStack(alignment: .leading) {
                Text("Fleet Health")
                    .font(.headline)
                Text(health.rawValue.capitalized)
                    .font(.title)
                    .foregroundColor(healthColor)
            }

            Spacer()
        }
        .padding()
        .background(healthColor.opacity(0.1))
        .cornerRadius(12)
    }

    private var healthColor: Color {
        switch health {
        case .healthy: return .green
        case .degraded: return .orange
        case .critical: return .red
        case .unknown: return .gray
        }
    }

    private var healthIcon: String {
        switch health {
        case .healthy: return "checkmark.circle.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .critical: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.title)
                .foregroundColor(color)

            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

struct ResourceChart: View {
    let title: String
    let values: [Double]
    let color: Color

    var body: some View {
        VStack(alignment: .leading) {
            Text(title)
                .font(.headline)

            GeometryReader { geometry in
                Path { path in
                    guard !values.isEmpty else { return }

                    let width = geometry.size.width
                    let height = geometry.size.height
                    let stepX = width / CGFloat(values.count - 1)

                    path.move(to: CGPoint(x: 0, y: height * (1 - CGFloat(values[0]))))

                    for (index, value) in values.enumerated().dropFirst() {
                        let x = CGFloat(index) * stepX
                        let y = height * (1 - CGFloat(value))
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                }
                .stroke(color, lineWidth: 2)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

struct EventsListView: View {
    let events: [FleetEvent]

    var body: some View {
        VStack(alignment: .leading) {
            Text("Recent Events")
                .font(.headline)

            if events.isEmpty {
                Text("No recent events")
                    .foregroundColor(.secondary)
            } else {
                ForEach(events.indices, id: \.self) { index in
                    Text(formatEvent(events[index]))
                        .font(.caption)
                        .padding(.vertical, 2)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }

    private func formatEvent(_ event: FleetEvent) -> String {
        switch event {
        case .systemStarted:
            return "System started"
        case .systemStopped:
            return "System stopped"
        case .hostRegistered(let host):
            return "Host registered: \(host.hostname)"
        case .hostUnregistered(let host):
            return "Host unregistered: \(host.hostname)"
        case .hostFailed(let host):
            return "Host failed: \(host.hostname)"
        case .containerStarted(let container):
            return "Container started: \(container.agentType)"
        case .containerStopped(let container):
            return "Container stopped: \(container.agentType)"
        case .containerMigrated(let container, let from, let to):
            return "Container migrated from \(from.hostname) to \(to.hostname)"
        case .containerFailedToReschedule(let container, _):
            return "Failed to reschedule container: \(container.agentType)"
        case .autoScaleOut(let count):
            return "Auto-scaled out: +\(count) hosts"
        case .autoScaleIn(let count):
            return "Auto-scaled in: -\(count) hosts"
        }
    }
}

// Placeholder views
struct SchedulerView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel
    var body: some View { Text("Scheduler View") }
}

struct AutoScalerView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel
    var body: some View { Text("Auto-Scaler View") }
}

struct AlertsView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel
    var body: some View { Text("Alerts View") }
}

struct EventsView: View {
    @ObservedObject var viewModel: FleetDashboardViewModel
    var body: some View { Text("Events View") }
}
