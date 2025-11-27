import SwiftUI

@main
struct NetworkTestVibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            NetworkTestContentView()
        }
    }
}

struct NetworkTestContentView: View {
    @StateObject private var vmManager = NetworkTestVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode Network Test")
                .font(.system(size: 36, weight: .bold))

            Text("Testing VZNATNetworkDeviceAttachment")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Configuration selector
            VStack(alignment: .leading, spacing: 10) {
                Text("Test Configuration:")
                    .font(.headline)

                ForEach(NetworkConfig.allCases, id: \.self) { config in
                    Button(action: {
                        vmManager.selectedConfig = config
                    }) {
                        HStack {
                            Image(systemName: vmManager.selectedConfig == config ? "checkmark.circle.fill" : "circle")
                            Text(config.rawValue)
                                .font(.system(.body, design: .monospaced))
                        }
                    }
                }
            }
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(8)

            // Status
            HStack {
                Circle()
                    .fill(vmManager.isRunning ? Color.green : Color.gray)
                    .frame(width: 12, height: 12)
                Text(vmManager.status)
                    .font(.system(.body, design: .monospaced))
            }

            // Console output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(height: 300)
            .background(Color.black.opacity(0.8))
            .foregroundColor(.green)
            .cornerRadius(8)

            // Controls
            HStack(spacing: 20) {
                Button(action: {
                    vmManager.startVM()
                }) {
                    Label("Start VM", systemImage: "play.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vmManager.isRunning)

                Button(action: {
                    vmManager.stopVM()
                }) {
                    Label("Stop VM", systemImage: "stop.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(!vmManager.isRunning)
            }

            Spacer()
        }
        .padding(40)
        .frame(minWidth: 700, minHeight: 700)
    }
}
