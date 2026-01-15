//
// UnifiedServicesVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-27
// Updated: 2026-01-13 - Converted to menubar app (Agent 22)
// Purpose: Menubar app for Unified Services VM (OpenVSCode + Valkey + PostgreSQL + SSH)
//

import SwiftUI
import AppKit

@main
struct UnifiedServicesVibeCodeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
    var statusItem: NSStatusItem?
    var vmManager = UnifiedServicesVMManager()
    var menu: NSMenu?
    
    // Menu items that need updating
    var statusMenuItem: NSMenuItem?
    var ipMenuItem: NSMenuItem?
    var openVSCodeMenuItem: NSMenuItem?
    var valkeyInfoMenuItem: NSMenuItem?
    var postgresInfoMenuItem: NSMenuItem?
    var sshInfoMenuItem: NSMenuItem?
    var separatorAfterServices: NSMenuItem?
    var startMenuItem: NSMenuItem?
    var stopMenuItem: NSMenuItem?
    var copyIPMenuItem: NSMenuItem?
    var showConsoleMenuItem: NSMenuItem?
    
    // Console window
    var consoleWindow: NSWindow?
    
    // Timer for updating menu
    var updateTimer: Timer?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create status item in menubar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        guard let button = statusItem?.button else {
            print("Failed to create status bar button")
            return
        }
        
        // Initial icon and title
        button.title = "⚫ VibeCode"
        button.toolTip = "Unified Services VM - Click for menu"
        
        // Create menu
        setupMenu()
        
        // Start VM automatically
        vmManager.startVM()
        
        // Set up timer to update menu based on VM state
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateMenuState()
        }
        
        // Initial menu update
        updateMenuState()
    }
    
    func setupMenu() {
        menu = NSMenu()
        
        // Status item
        statusMenuItem = NSMenuItem(title: "VM Status: Starting...", action: nil, keyEquivalent: "")
        statusMenuItem?.isEnabled = false
        menu?.addItem(statusMenuItem!)
        
        // IP address item (hidden initially)
        ipMenuItem = NSMenuItem(title: "VM IP: Not available", action: nil, keyEquivalent: "")
        ipMenuItem?.isEnabled = false
        ipMenuItem?.isHidden = true
        menu?.addItem(ipMenuItem!)
        
        menu?.addItem(NSMenuItem.separator())
        
        // Copy IP (hidden initially)
        copyIPMenuItem = NSMenuItem(title: "Copy IP Address", action: #selector(copyIPAddress), keyEquivalent: "c")
        copyIPMenuItem?.target = self
        copyIPMenuItem?.isHidden = true
        menu?.addItem(copyIPMenuItem!)
        
        menu?.addItem(NSMenuItem.separator())
        
        // Service links (hidden until VM is running)
        openVSCodeMenuItem = NSMenuItem(title: "Open OpenVSCode Server in Browser", action: #selector(openOpenVSCode), keyEquivalent: "o")
        openVSCodeMenuItem?.target = self
        openVSCodeMenuItem?.isHidden = true
        menu?.addItem(openVSCodeMenuItem!)
        
        valkeyInfoMenuItem = NSMenuItem(title: "Valkey: redis-cli -h [IP] -p 6379", action: nil, keyEquivalent: "")
        valkeyInfoMenuItem?.isEnabled = false
        valkeyInfoMenuItem?.isHidden = true
        menu?.addItem(valkeyInfoMenuItem!)
        
        postgresInfoMenuItem = NSMenuItem(title: "PostgreSQL: psql -h [IP] -U postgres", action: nil, keyEquivalent: "")
        postgresInfoMenuItem?.isEnabled = false
        postgresInfoMenuItem?.isHidden = true
        menu?.addItem(postgresInfoMenuItem!)
        
        sshInfoMenuItem = NSMenuItem(title: "SSH: ssh root@[IP] (password: vibecode)", action: nil, keyEquivalent: "")
        sshInfoMenuItem?.isEnabled = false
        sshInfoMenuItem?.isHidden = true
        menu?.addItem(sshInfoMenuItem!)
        
        separatorAfterServices = NSMenuItem.separator()
        separatorAfterServices?.isHidden = true
        menu?.addItem(separatorAfterServices!)
        
        menu?.addItem(NSMenuItem.separator())
        
        // Start/Stop controls
        startMenuItem = NSMenuItem(title: "Start VM", action: #selector(startVM), keyEquivalent: "")
        startMenuItem?.target = self
        menu?.addItem(startMenuItem!)
        
        stopMenuItem = NSMenuItem(title: "Stop VM", action: #selector(stopVM), keyEquivalent: "")
        stopMenuItem?.target = self
        stopMenuItem?.isEnabled = false
        menu?.addItem(stopMenuItem!)
        
        menu?.addItem(NSMenuItem.separator())
        
        // Show console
        showConsoleMenuItem = NSMenuItem(title: "Show Console Output", action: #selector(showConsole), keyEquivalent: "l")
        showConsoleMenuItem?.target = self
        menu?.addItem(showConsoleMenuItem!)
        
        menu?.addItem(NSMenuItem.separator())
        
        // Quit
        let quitItem = NSMenuItem(title: "Quit VibeCode", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu?.addItem(quitItem)
        
        statusItem?.menu = menu
    }
    
    func updateMenuState() {
        guard let button = statusItem?.button else { return }
        
        let isRunning = vmManager.isRunning
        let ipAddress = vmManager.vmIPAddress
        let status = vmManager.status
        
        // Update menubar icon based on state
        if isRunning && ipAddress != nil && ipAddress != "Starting..." {
            button.title = "🟢 VibeCode"
            button.toolTip = "Unified Services VM - Running\nIP: \(ipAddress ?? "unknown")"
        } else if isRunning {
            button.title = "🟡 VibeCode"
            button.toolTip = "Unified Services VM - Starting..."
        } else {
            button.title = "⚫ VibeCode"
            button.toolTip = "Unified Services VM - Stopped"
        }
        
        // Update status text
        if let ip = ipAddress, ip != "Starting..." {
            statusMenuItem?.title = "VM Status: Running ✓"
        } else if isRunning {
            statusMenuItem?.title = "VM Status: \(status)"
        } else {
            statusMenuItem?.title = "VM Status: Stopped"
        }
        
        // Update IP display
        if let ip = ipAddress, ip != "Starting..." {
            ipMenuItem?.title = "VM IP: \(ip)"
            ipMenuItem?.isHidden = false
            copyIPMenuItem?.isHidden = false
            
            // Show service links
            openVSCodeMenuItem?.title = "Open OpenVSCode Server (http://\(ip):8080)"
            openVSCodeMenuItem?.isHidden = false
            
            valkeyInfoMenuItem?.title = "Valkey: redis-cli -h \(ip) -p 6379"
            valkeyInfoMenuItem?.isHidden = false
            
            postgresInfoMenuItem?.title = "PostgreSQL: psql -h \(ip) -U postgres"
            postgresInfoMenuItem?.isHidden = false
            
            sshInfoMenuItem?.title = "SSH: ssh root@\(ip) (password: vibecode)"
            sshInfoMenuItem?.isHidden = false
            
            separatorAfterServices?.isHidden = false
        } else {
            ipMenuItem?.isHidden = true
            copyIPMenuItem?.isHidden = true
            openVSCodeMenuItem?.isHidden = true
            valkeyInfoMenuItem?.isHidden = true
            postgresInfoMenuItem?.isHidden = true
            sshInfoMenuItem?.isHidden = true
            separatorAfterServices?.isHidden = true
        }
        
        // Update start/stop buttons
        startMenuItem?.isEnabled = !isRunning
        stopMenuItem?.isEnabled = isRunning
    }
    
    // MARK: - Menu Actions
    
    @objc func startVM() {
        vmManager.startVM()
    }
    
    @objc func stopVM() {
        vmManager.stopVM()
    }
    
    @objc func copyIPAddress() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(ip, forType: .string)
            
            // Show temporary notification in menu
            let originalTitle = statusMenuItem?.title
            statusMenuItem?.title = "✓ IP Address copied to clipboard!"
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.updateMenuState()
            }
        }
    }
    
    @objc func openOpenVSCode() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            let url = URL(string: "http://\(ip):8080")!
            NSWorkspace.shared.open(url)
        }
    }
    
    @objc func showConsole() {
        if consoleWindow == nil {
            // Create console window
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered,
                defer: false
            )
            window.title = "VibeCode - Console Output"
            window.center()
            
            // Create console view
            let consoleView = ConsoleView(vmManager: vmManager)
            let hostingView = NSHostingView(rootView: consoleView)
            window.contentView = hostingView
            
            // Set close behavior
            window.isReleasedWhenClosed = false
            
            consoleWindow = window
        }
        
        consoleWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    @objc func quit() {
        updateTimer?.invalidate()
        if vmManager.isRunning {
            vmManager.stopVM()
        }
        NSApplication.shared.terminate(nil)
    }
}

// Console view for showing VM output
struct ConsoleView: View {
    @ObservedObject var vmManager: UnifiedServicesVMManager
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Console Output")
                    .font(.headline)
                Spacer()
                Text(vmManager.status)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            
            Divider()
            
            // Console output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(Color(red: 0, green: 1, blue: 0))  // Green text
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding()
            }
            .background(Color.black)  // Black background
            
            Divider()
            
            // Footer with controls
            HStack {
                if let ip = vmManager.vmIPAddress, ip != "Starting..." {
                    Text("VM IP: \(ip)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button("Clear") {
                    // Note: Would need to add clearConsole() method to VM manager
                }
                .disabled(vmManager.consoleOutput.isEmpty)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
        }
    }
}
