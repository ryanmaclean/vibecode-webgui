// DashboardView.swift
// VibeCode - macOS 26 Tahoe Exclusive
//
// Native SwiftUI dashboard for VM and container management

import SwiftUI

@available(macOS 26.0, *)
struct DashboardView: View {
    @EnvironmentObject var containerManager: ContainerManager
    @EnvironmentObject var vzManager: VZManager

    @State private var selectedTab: Tab = .containers

    enum Tab {
        case containers
        case virtualMachines
        case settings
    }

    var body: some View {
        NavigationSplitView {
            // Sidebar
            List(selection: $selectedTab) {
                Section("Quick Start") {
                    NavigationLink(value: Tab.containers) {
                        Label("Containers", systemImage: "cube.fill")
                    }

                    NavigationLink(value: Tab.virtualMachines) {
                        Label("Virtual Machines", systemImage: "server.rack")
                    }
                }

                Section("Configuration") {
                    NavigationLink(value: Tab.settings) {
                        Label("Settings", systemImage: "gearshape.fill")
                    }
                }
            }
            .navigationTitle("VibeCode")
            .toolbar {
                ToolbarItem(placement: .navigation) {
                    Button(action: {}) {
                        Image(systemName: "sidebar.left")
                    }
                }
            }

        } detail: {
            // Main content
            switch selectedTab {
            case .containers:
                ContainerListView()
            case .virtualMachines:
                VMListView()
            case .settings:
                SettingsView()
            }
        }
        .frame(minWidth: 1000, minHeight: 600)
    }
}

// MARK: - Container List View

@available(macOS 26.0, *)
struct ContainerListView: View {
    @EnvironmentObject var containerManager: ContainerManager
    @State private var showingQuickStart = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Containers")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Powered by Apple Containerization framework")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button(action: {
                    Task {
                        try? await containerManager.startAllContainers()
                    }
                }) {
                    Label("Quick Start All", systemImage: "play.circle.fill")
                        .font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(containerManager.status == .starting)
            }
            .padding()

            Divider()

            // Container grid or empty state
            if containerManager.containers.isEmpty {
                ContainerEmptyState(showingQuickStart: $showingQuickStart)
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 300, maximum: 400), spacing: 16)
                    ], spacing: 16) {
                        ForEach(containerManager.containers) { container in
                            ContainerCard(container: container)
                        }
                    }
                    .padding()
                }
            }
        }
        .sheet(isPresented: $showingQuickStart) {
            QuickStartSheet()
        }
    }
}

// MARK: - Container Card

@available(macOS 26.0, *)
struct ContainerCard: View {
    let container: ContainerManager.ManagedContainer
    @EnvironmentObject var containerManager: ContainerManager

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                // Icon based on type
                Image(systemName: containerIcon)
                    .font(.title2)
                    .foregroundStyle(containerColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(container.name)
                        .font(.headline)

                    Text(container.image)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
            }

            Divider()

            // Details
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Ports", value: portsString)
                DetailRow(label: "Started", value: container.created, format: .relative(presentation: .numeric))
                DetailRow(label: "Type", value: container.type.description)
            }
            .font(.caption)

            // Actions
            HStack(spacing: 8) {
                Button("Stop") {
                    Task {
                        try? await containerManager.stopContainer(container.id)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button("Logs") {
                    // Show logs
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button("Shell") {
                    // Open shell
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, y: 2)
    }

    var containerIcon: String {
        switch container.type {
        case .valkey: return "square.stack.3d.up.fill"
        case .postgresql: return "cylinder.fill"
        case .nodejs: return "chevron.left.forwardslash.chevron.right"
        case .custom: return "cube.fill"
        }
    }

    var containerColor: Color {
        switch container.type {
        case .valkey: return .red
        case .postgresql: return .blue
        case .nodejs: return .green
        case .custom: return .purple
        }
    }

    var statusColor: Color {
        switch container.status {
        case .running: return .green
        case .stopped: return .gray
        case .starting: return .orange
        default: return .red
        }
    }

    var portsString: String {
        container.ports.map { "\($0.key):\($0.value)" }.joined(separator: ", ")
    }
}

// MARK: - Empty State

@available(macOS 26.0, *)
struct ContainerEmptyState: View {
    @Binding var showingQuickStart: Bool

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 72))
                .foregroundStyle(.tertiary)

            VStack(spacing: 8) {
                Text("No Containers Running")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Start your development environment with one click")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Button(action: {
                showingQuickStart = true
            }) {
                Label("Quick Start", systemImage: "play.circle.fill")
                    .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Helper Views

struct DetailRow<Value: CVarArg>: View {
    let label: String
    let value: Value
    var format: Date.FormatStyle? = nil

    init(label: String, value: Value, format: Date.FormatStyle? = nil) {
        self.label = label
        self.value = value
        self.format = format
    }

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            if let date = value as? Date, let format = format {
                Text(date, format: format)
            } else {
                Text("\(value)")
            }
        }
    }
}

// MARK: - Quick Start Sheet

@available(macOS 26.0, *)
struct QuickStartSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var containerManager: ContainerManager

    var body: some View {
        VStack(spacing: 24) {
            Text("Quick Start")
                .font(.title)
                .fontWeight(.bold)

            Text("Start all containers optimized for VibeCode development")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 16) {
                ServiceRow(icon: "square.stack.3d.up.fill", name: "Valkey", description: "Redis-compatible cache", color: .red)
                ServiceRow(icon: "cylinder.fill", name: "PostgreSQL + pgvector", description: "Database with vector search", color: .blue)
                ServiceRow(icon: "chevron.left.forwardslash.chevron.right", name: "Node.js 22 LTS", description: "Development environment", color: .green)
            }

            Button("Start All Containers") {
                Task {
                    try? await containerManager.startAllContainers()
                    dismiss()
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(32)
        .frame(width: 500)
    }
}

struct ServiceRow: View {
    let icon: String
    let name: String
    let description: String
    let color: Color

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.headline)
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text("< 1s")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.green)
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(8)
    }
}

// MARK: - Placeholder Views

@available(macOS 26.0, *)
struct VMListView: View {
    var body: some View {
        Text("Virtual Machines")
            .font(.largeTitle)
    }
}

@available(macOS 26.0, *)
struct SettingsView: View {
    var body: some View {
        Text("Settings")
            .font(.largeTitle)
    }
}

// MARK: - Type Extensions

extension ContainerManager.ManagedContainer.ContainerType: CustomStringConvertible {
    public var description: String {
        switch self {
        case .valkey: return "Valkey"
        case .postgresql: return "PostgreSQL"
        case .nodejs: return "Node.js"
        case .custom: return "Custom"
        }
    }
}
