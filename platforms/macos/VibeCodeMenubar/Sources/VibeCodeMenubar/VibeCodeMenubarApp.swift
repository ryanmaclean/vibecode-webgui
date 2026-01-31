import SwiftUI
import AppKit

@main
struct VibeCodeMenubarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "desktopcomputer", accessibilityDescription: "VibeCode")
        }
        setupMenu()
    }
    
    func setupMenu() {
        let menu = NSMenu()
        menu.addItem(withTitle: "VibeCode VM", action: nil, keyEquivalent: "")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Start VM", action: #selector(startVM), keyEquivalent: "s")
        menu.addItem(withTitle: "Stop VM", action: #selector(stopVM), keyEquivalent: ".")
        menu.addItem(withTitle: "Open Dashboard", action: #selector(openDashboard), keyEquivalent: "o")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Quit", action: #selector(quit), keyEquivalent: "q")
        statusItem.menu = menu
    }
    
    func runCommand(_ args: [String]) {
        let process = Process()
        
        // Look for bin/vibecode-vm relative to user home
        // Default: ~/Documents/vibecode-webgui/bin/vibecode-vm
        let home = FileManager.default.homeDirectoryForCurrentUser
        let cliPath = home.appendingPathComponent("Documents/vibecode-webgui/bin/vibecode-vm").path
        
        guard FileManager.default.fileExists(atPath: cliPath) else {
            print("Error: vibecode-vm not found at \(cliPath)")
            // Fallback to searching PATH or showing alert
            let alert = NSAlert()
            alert.messageText = "VibeCode CLI Not Found"
            alert.informativeText = "Could not find 'bin/vibecode-vm' at expected location: \(cliPath)"
            alert.runModal()
            return
        }
        
        process.executableURL = URL(fileURLWithPath: cliPath)
        process.arguments = args
        
        do {
            try process.run()
        } catch {
            print("Failed to run command: \(error)")
        }
    }
    
    @objc func startVM() {
        if let button = statusItem.button {
            // Change icon to indicate activity
            button.image = NSImage(systemSymbolName: "desktopcomputer.play", accessibilityDescription: "Starting")
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            self.runCommand(["start"])
            
            // After start command returns (assuming it blocks or we just wait a bit)
            // Actually launch_ubuntu_vm.py blocks if run directly, but vibecode-vm might detach?
            // The current implementation blocks.
            
            DispatchQueue.main.async {
                if let button = self.statusItem.button {
                    button.image = NSImage(systemSymbolName: "desktopcomputer", accessibilityDescription: "Running")
                }
            }
        }
    }
    
    @objc func stopVM() {
        runCommand(["stop"])
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "desktopcomputer", accessibilityDescription: "Stopped")
        }
    }
    
    @objc func openDashboard() {
        if let url = URL(string: "http://localhost:3000") {
            NSWorkspace.shared.open(url)
        }
    }
    
    @objc func quit() {
        NSApplication.shared.terminate(nil)
    }
}
