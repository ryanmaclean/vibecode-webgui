import SwiftUI
import VibeCodeCore

struct PreferencesView: View {
    @ObservedObject var preferences: IDEPreferences
    var ideManager: IDEProcessManager

    var body: some View {
        Form {
            Section(header: Text("IDE")) {
                HStack {
                    Text("Binary Path")
                    TextField("/opt/homebrew/bin/openvscode-server", text: $preferences.binaryPath)
                        .textFieldStyle(.roundedBorder)
                }
                HStack {
                    Text("Workspace")
                    TextField("/path/to/workspace", text: $preferences.workspacePath)
                        .textFieldStyle(.roundedBorder)
                }
                HStack {
                    Text("Port")
                    TextField("8080", value: $preferences.port, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 100)
                }
            }

            Section(header: Text("Telemetry")) {
                Toggle("Enable dd-trace (Node)", isOn: $preferences.ddTraceEnabled)
            }

            Section(header: Text("Startup")) {
                Toggle("Start at login", isOn: $preferences.launchAtLogin)
                    .onChange(of: preferences.launchAtLogin) { _ in
                        ideManager.updateLoginItem()
                    }
            }
        }
        .padding()
    }
}
