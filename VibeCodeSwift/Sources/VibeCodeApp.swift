// MIT License - VibeCode Main Application
import SwiftUI

@main
struct VibeCodeApp: App {
    @StateObject private var vmManager = VMManager()
    
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
                .frame(minWidth: 800, minHeight: 600)
                .onAppear {
                    NSLog("🟢 VIBECODE: ContentView.onAppear called!")
                    print("🟢 ContentView.onAppear called!")
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
    }
}

