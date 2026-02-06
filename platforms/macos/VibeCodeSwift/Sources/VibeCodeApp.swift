// MIT License - VibeCode Main Application
import SwiftUI
import VibeCodeCore

@main
struct VibeCodeApp: App {
    @StateObject private var vmManager = VMManager()
    @StateObject private var ideManager = IDEProcessManager()
    @StateObject private var idePreferences = IDEPreferences()
    
    init() {
        DatadogLogger.shared.info("VibeCode application starting", [
            "version": "1.0.0",
            "platform": "macOS",
            "event": "app_launch"
        ])
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(vmManager)
                .environmentObject(ideManager)
                .environmentObject(idePreferences)
                .frame(minWidth: 800, minHeight: 600)
                .onAppear {
                    NSLog("🟢 VIBECODE: ContentView.onAppear called!")
                    print("🟢 ContentView.onAppear called!")
                    // inject shared preferences into managers
                    vmManager.preferences = idePreferences
                    ideManager.preferences = idePreferences
                    vmManager.loadAvailableVMs()
                }
        }
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About VibeCode") {
                    // Show about window
                }
            }
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified)

        MenuBarExtra("VibeCode", systemImage: "hammer") {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(ideManager.isRunning ? Color.green : Color.gray)
                        .frame(width: 8, height: 8)
                    Text(ideManager.status)
                        .font(.caption)
                }
                Divider()
                if ideManager.isRunning {
                    Button("Stop IDE") {
                        ideManager.stop()
                    }
                    Button("Open IDE") {
                        ideManager.openInBrowser()
                    }
                    Button("Open Logs") {
                        ideManager.openLogs()
                    }
                } else {
                    Button("Start IDE") {
                        ideManager.start()
                    }
                }
                Divider()
                Button("Preferences…") {
                    NSApp.sendAction(Selector(("showPreferencesWindow:")), to: nil, from: nil)
                }
            }
            .padding(8)
        }

        Settings {
            PreferencesView(preferences: idePreferences, ideManager: ideManager)
                .environmentObject(vmManager)
                .frame(width: 520, height: 480)
        }
    }
}

