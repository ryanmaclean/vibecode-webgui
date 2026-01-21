// MIT License - Main Content View
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vmManager: VMManager
    @State private var selectedVM: VMInfo?
    
    init() {
        DatadogLogger.shared.debug("ContentView.init() called", ["event": "view_init"])
    }
    
    var body: some View {
        let _ = DatadogLogger.shared.debug("ContentView body evaluated", ["vm_count": vmManager.vms.count])
        return         NavigationSplitView {
            // Sidebar - VM List
            List(vmManager.vms, selection: $selectedVM) { vm in
                VMListRow(vm: vm)
                    .tag(vm)
            }
            .navigationTitle("Virtual Machines")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        vmManager.loadAvailableVMs()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .status) {
                    Text("\(vmManager.vms.count) VMs")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .overlay {
                if vmManager.vms.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "server.rack")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        
                        Text("No Virtual Machines")
                            .font(.title3)
                            .bold()
                        
                        Text("No VMs found. Click the refresh button to reload.")
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        
                        Button("Reload VMs") {
                            vmManager.loadAvailableVMs()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                }
            }
            .frame(minWidth: 250)
        } detail: {
            // Detail View
            if let vm = selectedVM {
                VMDetailView(vm: vm)
            } else {
                EmptyStateView()
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

// MARK: - VM List Row

struct VMListRow: View {
    let vm: VMInfo
    @EnvironmentObject var vmManager: VMManager
    
    var isRunning: Bool {
        vmManager.isVMRunning(vm)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: iconName)
                .font(.title2)
                .foregroundColor(iconColor)
                .frame(width: 32)
            
            // Name and status
            VStack(alignment: .leading, spacing: 4) {
                Text(vm.name)
                    .font(.body)
                
                Text(statusText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Status indicator
            Circle()
                .fill(isRunning ? Color.green : Color.gray)
                .frame(width: 8, height: 8)
                .shadow(color: isRunning ? .green.opacity(0.5) : .clear, radius: 4)
        }
        .padding(.vertical, 8)
    }
    
    private var iconName: String {
        if vm.name.lowercased().contains("postgres") {
            return "cylinder.fill"
        } else if vm.name.lowercased().contains("valkey") {
            return "square.stack.3d.up.fill"
        } else if vm.name.lowercased().contains("node") {
            return "chevron.left.forwardslash.chevron.right"
        }
        return "server.rack"
    }
    
    private var iconColor: Color {
        if vm.name.lowercased().contains("postgres") {
            return .blue
        } else if vm.name.lowercased().contains("valkey") {
            return .red
        } else if vm.name.lowercased().contains("node") {
            return .green
        }
        return .gray
    }
    
    private var statusText: String {
        if let status = vmManager.vmStatus[vm.id] {
            switch status {
            case .stopped: return "Stopped"
            case .starting: return "Starting..."
            case .running: return "Running"
            case .stopping: return "Stopping..."
            }
        }
        return "Ready"
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "server.rack")
                .font(.system(size: 64))
                .foregroundColor(.secondary)
            
            Text("No VM Selected")
                .font(.title2)
            
            Text("Select a virtual machine from the sidebar to view details")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
    }
}

// Preview removed for SPM compatibility

