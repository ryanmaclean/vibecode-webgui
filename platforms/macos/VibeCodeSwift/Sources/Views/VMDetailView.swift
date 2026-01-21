// MIT License - VM Detail View
import SwiftUI

struct VMDetailView: View {
    let vm: VMInfo
    @EnvironmentObject var vmManager: VMManager
    @State private var isStarting = false
    @State private var errorMessage: String?
    
    var isRunning: Bool {
        vmManager.isVMRunning(vm)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero Section
                VStack(spacing: 16) {
                    Image(systemName: heroIcon)
                        .font(.system(size: 72))
                        .foregroundColor(heroColor)
                    
                    Text(vm.name)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    StatusBadge(isRunning: isRunning, status: vmManager.vmStatus[vm.id])
                }
                .padding(.top, 40)
                
                // Connection Info (if running)
                if isRunning {
                    LiquidGlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Connection Information")
                                .font(.headline)
                            
                            Divider()
                            
                            ConnectionInfoRow(label: "Host", value: "localhost")
                            ConnectionInfoRow(label: "Port", value: "\(vm.port)")
                            
                            if vm.name.lowercased().contains("postgres") {
                                ConnectionInfoRow(label: "Database", value: "postgres")
                                ConnectionInfoRow(label: "Username", value: "postgres")
                            }
                        }
                    }
                }
                
                // VM Information
                LiquidGlassCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Virtual Machine Details")
                            .font(.headline)
                        
                        Divider()
                        
                        InfoRow(label: "CPU Cores", value: "4")
                        InfoRow(label: "Memory", value: "4 GB")
                        InfoRow(label: "Disk", value: diskSizeString)
                        InfoRow(label: "Type", value: "Linux (Alpine)")
                    }
                }
                
                // Actions
                VStack(spacing: 12) {
                    if isRunning {
                        Button(action: stopVM) {
                            HStack {
                                Image(systemName: "stop.fill")
                                Text("Stop VM")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                        .disabled(isStarting)
                    } else {
                        Button(action: startVM) {
                            HStack {
                                if isStarting {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Image(systemName: "play.fill")
                                }
                                Text(isStarting ? "Starting..." : "Start VM")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isStarting)
                    }
                }
                .padding(.horizontal)
                
                // Error message
                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                }
                
                Spacer()
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Actions
    
    private func startVM() {
        isStarting = true
        errorMessage = nil
        
        Task {
            do {
                try await vmManager.startVM(vm)
                isStarting = false
            } catch {
                errorMessage = error.localizedDescription
                isStarting = false
            }
        }
    }
    
    private func stopVM() {
        Task {
            do {
                try await vmManager.stopVM(vm)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
    
    // MARK: - Helpers
    
    private var heroIcon: String {
        if vm.name.lowercased().contains("postgres") {
            return "cylinder.fill"
        } else if vm.name.lowercased().contains("valkey") {
            return "square.stack.3d.up.fill"
        } else if vm.name.lowercased().contains("node") {
            return "chevron.left.forwardslash.chevron.right"
        }
        return "server.rack"
    }
    
    private var heroColor: Color {
        if vm.name.lowercased().contains("postgres") {
            return .blue
        } else if vm.name.lowercased().contains("valkey") {
            return .red
        } else if vm.name.lowercased().contains("node") {
            return .green
        }
        return .gray
    }
    
    private var diskSizeString: String {
        if vm.name.lowercased().contains("postgres") {
            return "10 GB"
        } else if vm.name.lowercased().contains("valkey") {
            return "10 GB"
        } else if vm.name.lowercased().contains("node") {
            return "50 GB"
        }
        return "Unknown"
    }
}

// MARK: - Supporting Views

struct StatusBadge: View {
    let isRunning: Bool
    let status: VMStatus?
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
                .shadow(color: statusColor.opacity(0.5), radius: 4)
            
            Text(statusText)
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(statusColor.opacity(0.1))
        .cornerRadius(20)
    }
    
    private var statusText: String {
        if let status = status {
            switch status {
            case .stopped: return "Stopped"
            case .starting: return "Starting"
            case .running: return "Running"
            case .stopping: return "Stopping"
            }
        }
        return isRunning ? "Running" : "Stopped"
    }
    
    private var statusColor: Color {
        if let status = status {
            switch status {
            case .stopped: return .gray
            case .starting: return .orange
            case .running: return .green
            case .stopping: return .orange
            }
        }
        return isRunning ? .green : .gray
    }
}

struct ConnectionInfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
                .textSelection(.enabled)
        }
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
        }
    }
}

struct LiquidGlassCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
    }
}

// Preview removed for SPM compatibility

