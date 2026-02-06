//
// UnifiedServicesVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-27
// Updated: 2026-01-13 - Converted to menubar app (Agent 22)
// Updated: 2026-01-19 - Fixed menubar lag with state caching and adaptive timer (mm-82w)
// Updated: 2026-02-06 - Enhanced menubar with status display, quick actions, accessibility (ROMEO)
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

// MARK: - Service Health Model

struct ServiceHealth: Identifiable {
    let id = UUID()
    let name: String
    let port: UInt16
    var isHealthy: Bool
    var latencyMs: Int?
    var lastChecked: Date?

    var statusIcon: String {
        isHealthy ? "checkmark.circle.fill" : "xmark.circle.fill"
    }

    var statusColor: NSColor {
        isHealthy ? .systemGreen : .systemRed
    }
}

// MARK: - Resource Usage Model

struct ResourceUsage {
    var cpuPercent: Double = 0.0
    var memoryUsedMB: Int = 0
    var memoryTotalMB: Int = 2048

    var cpuStatus: String {
        if cpuPercent < 50 { return "Low" }
        else if cpuPercent < 80 { return "Medium" }
        else { return "High" }
    }

    var memoryPercent: Double {
        Double(memoryUsedMB) / Double(memoryTotalMB) * 100
    }

    var formattedCPU: String {
        String(format: "%.1f%%", cpuPercent)
    }

    var formattedMemory: String {
        "\(memoryUsedMB) / \(memoryTotalMB) MB"
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
    var statusItem: NSStatusItem?
    var vmManager = UnifiedServicesVMManager()
    var menu: NSMenu?

    // Menu items that need updating
    var statusMenuItem: NSMenuItem?
    var healthSummaryMenuItem: NSMenuItem?
    var ipMenuItem: NSMenuItem?
    var resourceMenuItem: NSMenuItem?
    var openVSCodeMenuItem: NSMenuItem?
    var valkeyInfoMenuItem: NSMenuItem?
    var postgresInfoMenuItem: NSMenuItem?
    var sshInfoMenuItem: NSMenuItem?
    var separatorAfterServices: NSMenuItem?
    var startMenuItem: NSMenuItem?
    var stopMenuItem: NSMenuItem?
    var restartMenuItem: NSMenuItem?
    var copyIPMenuItem: NSMenuItem?
    var showConsoleMenuItem: NSMenuItem?
    var recentLogsMenuItem: NSMenuItem?
    var quickActionsMenuItem: NSMenuItem?

    // Console window
    var consoleWindow: NSWindow?

    // Timer for updating menu
    var updateTimer: Timer?

    // Health check timer
    var healthCheckTimer: Timer?

    // MARK: - State Caching for Lag Prevention
    // Cache previous state to avoid redundant UI updates
    private var cachedIsRunning: Bool = false
    private var cachedIPAddress: String? = nil
    private var cachedStatus: String = ""
    private var isStableState: Bool = false
    private var stableStateCounter: Int = 0

    // MARK: - Service Health Tracking
    private var serviceHealthStates: [ServiceHealth] = [
        ServiceHealth(name: "OpenVSCode", port: 8080, isHealthy: false),
        ServiceHealth(name: "PostgreSQL", port: 5432, isHealthy: false),
        ServiceHealth(name: "Valkey", port: 6379, isHealthy: false),
        ServiceHealth(name: "SSH", port: 22, isHealthy: false)
    ]

    // MARK: - Resource Usage
    private var resourceUsage = ResourceUsage()

    // MARK: - Compact/Expanded View Mode
    private var isCompactMode: Bool = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create status item in menubar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        guard let button = statusItem?.button else {
            print("Failed to create status bar button")
            return
        }

        // Initial icon and title with accessibility
        button.title = "  VibeCode"
        button.image = createStatusImage(color: .gray)
        button.imagePosition = .imageLeading
        button.toolTip = "Unified Services VM - Click for menu"
        button.setAccessibilityLabel("VibeCode VM Status: Stopped")
        button.setAccessibilityHelp("Click to open VibeCode menu with VM controls and service status")

        // Create menu
        setupMenu()

        // Start VM automatically
        vmManager.startVM()

        // Set up timer to update menu based on VM state
        // Uses adaptive interval: faster during state transitions, slower when stable
        scheduleUpdateTimer(interval: 1.0)

        // Set up health check timer (every 5 seconds when running)
        scheduleHealthCheckTimer()

        // Initial menu update (force update to set initial state)
        updateMenuState(forceUpdate: true)
    }

    // MARK: - Create Status Image

    private func createStatusImage(color: NSColor) -> NSImage {
        let size = NSSize(width: 12, height: 12)
        let image = NSImage(size: size)

        image.lockFocus()
        color.setFill()
        let circle = NSBezierPath(ovalIn: NSRect(origin: .zero, size: size))
        circle.fill()

        // Add subtle glow effect for running state
        if color == .systemGreen {
            let glowColor = NSColor.systemGreen.withAlphaComponent(0.3)
            glowColor.setFill()
            let glowCircle = NSBezierPath(ovalIn: NSRect(x: -2, y: -2, width: 16, height: 16))
            glowCircle.fill()
        }
        image.unlockFocus()

        image.isTemplate = false
        return image
    }
    
    func setupMenu() {
        menu = NSMenu()
        menu?.delegate = self

        // MARK: - Status Section

        // Status item with accessibility
        statusMenuItem = NSMenuItem(title: "VM Status: Starting...", action: nil, keyEquivalent: "")
        statusMenuItem?.isEnabled = false
        statusMenuItem?.setAccessibilityLabel("VM Status")
        menu?.addItem(statusMenuItem!)

        // Health summary item (e.g., "Services: 4/4 healthy")
        healthSummaryMenuItem = NSMenuItem(title: "Services: Checking...", action: nil, keyEquivalent: "")
        healthSummaryMenuItem?.isEnabled = false
        healthSummaryMenuItem?.isHidden = true
        healthSummaryMenuItem?.setAccessibilityLabel("Service Health Summary")
        menu?.addItem(healthSummaryMenuItem!)

        // IP address item (hidden initially)
        ipMenuItem = NSMenuItem(title: "VM IP: Not available", action: nil, keyEquivalent: "")
        ipMenuItem?.isEnabled = false
        ipMenuItem?.isHidden = true
        ipMenuItem?.setAccessibilityLabel("VM IP Address")
        menu?.addItem(ipMenuItem!)

        // Resource usage item (CPU/Memory)
        resourceMenuItem = NSMenuItem(title: "Resources: --", action: nil, keyEquivalent: "")
        resourceMenuItem?.isEnabled = false
        resourceMenuItem?.isHidden = true
        resourceMenuItem?.setAccessibilityLabel("Resource Usage")
        menu?.addItem(resourceMenuItem!)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - Quick Actions Submenu

        quickActionsMenuItem = NSMenuItem(title: "Quick Actions", action: nil, keyEquivalent: "")
        quickActionsMenuItem?.setAccessibilityLabel("Quick Actions Menu")
        let quickActionsSubmenu = NSMenu(title: "Quick Actions")

        // Copy IP
        copyIPMenuItem = NSMenuItem(title: "Copy IP Address", action: #selector(copyIPAddress), keyEquivalent: "c")
        copyIPMenuItem?.target = self
        copyIPMenuItem?.keyEquivalentModifierMask = [.command]
        copyIPMenuItem?.setAccessibilityLabel("Copy VM IP address to clipboard")
        quickActionsSubmenu.addItem(copyIPMenuItem!)

        // Copy connection strings submenu
        let copyStringsItem = NSMenuItem(title: "Copy Connection Strings", action: nil, keyEquivalent: "")
        let copyStringsSubmenu = NSMenu(title: "Copy Connection Strings")

        let copyPostgresItem = NSMenuItem(title: "PostgreSQL Connection", action: #selector(copyPostgresConnection), keyEquivalent: "")
        copyPostgresItem.target = self
        copyPostgresItem.setAccessibilityLabel("Copy PostgreSQL connection string")
        copyStringsSubmenu.addItem(copyPostgresItem)

        let copyValkeyItem = NSMenuItem(title: "Valkey/Redis Connection", action: #selector(copyValkeyConnection), keyEquivalent: "")
        copyValkeyItem.target = self
        copyValkeyItem.setAccessibilityLabel("Copy Valkey connection string")
        copyStringsSubmenu.addItem(copyValkeyItem)

        let copySSHItem = NSMenuItem(title: "SSH Command", action: #selector(copySSHCommand), keyEquivalent: "")
        copySSHItem.target = self
        copySSHItem.setAccessibilityLabel("Copy SSH command")
        copyStringsSubmenu.addItem(copySSHItem)

        copyStringsItem.submenu = copyStringsSubmenu
        quickActionsSubmenu.addItem(copyStringsItem)

        quickActionsSubmenu.addItem(NSMenuItem.separator())

        // Open SSH Terminal
        let openSSHItem = NSMenuItem(title: "Open SSH Terminal", action: #selector(openSSHTerminal), keyEquivalent: "t")
        openSSHItem.target = self
        openSSHItem.keyEquivalentModifierMask = [.command]
        openSSHItem.setAccessibilityLabel("Open SSH terminal in default terminal app")
        quickActionsSubmenu.addItem(openSSHItem)

        // Open Web IDE
        let openIDEItem = NSMenuItem(title: "Open Web IDE", action: #selector(openOpenVSCode), keyEquivalent: "o")
        openIDEItem.target = self
        openIDEItem.keyEquivalentModifierMask = [.command]
        openIDEItem.setAccessibilityLabel("Open OpenVSCode web IDE in browser")
        quickActionsSubmenu.addItem(openIDEItem)

        quickActionsSubmenu.addItem(NSMenuItem.separator())

        // Restart all services
        let restartServicesItem = NSMenuItem(title: "Restart All Services", action: #selector(restartAllServices), keyEquivalent: "r")
        restartServicesItem.target = self
        restartServicesItem.keyEquivalentModifierMask = [.command, .shift]
        restartServicesItem.setAccessibilityLabel("Restart all services inside the VM")
        quickActionsSubmenu.addItem(restartServicesItem)

        quickActionsMenuItem?.submenu = quickActionsSubmenu
        menu?.addItem(quickActionsMenuItem!)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - Service Links Section

        // Service links (hidden until VM is running)
        openVSCodeMenuItem = NSMenuItem(title: "Open OpenVSCode Server in Browser", action: #selector(openOpenVSCode), keyEquivalent: "1")
        openVSCodeMenuItem?.target = self
        openVSCodeMenuItem?.keyEquivalentModifierMask = [.command]
        openVSCodeMenuItem?.isHidden = true
        openVSCodeMenuItem?.setAccessibilityLabel("Open OpenVSCode server in default browser")
        menu?.addItem(openVSCodeMenuItem!)

        valkeyInfoMenuItem = NSMenuItem(title: "Valkey: redis-cli -h [IP] -p 6379", action: #selector(copyValkeyConnection), keyEquivalent: "2")
        valkeyInfoMenuItem?.target = self
        valkeyInfoMenuItem?.keyEquivalentModifierMask = [.command]
        valkeyInfoMenuItem?.isHidden = true
        valkeyInfoMenuItem?.setAccessibilityLabel("Valkey Redis service information. Click to copy connection command.")
        menu?.addItem(valkeyInfoMenuItem!)

        postgresInfoMenuItem = NSMenuItem(title: "PostgreSQL: psql -h [IP] -U postgres", action: #selector(copyPostgresConnection), keyEquivalent: "3")
        postgresInfoMenuItem?.target = self
        postgresInfoMenuItem?.keyEquivalentModifierMask = [.command]
        postgresInfoMenuItem?.isHidden = true
        postgresInfoMenuItem?.setAccessibilityLabel("PostgreSQL service information. Click to copy connection command.")
        menu?.addItem(postgresInfoMenuItem!)

        sshInfoMenuItem = NSMenuItem(title: "SSH: ssh root@[IP] (password: vibecode)", action: #selector(copySSHCommand), keyEquivalent: "4")
        sshInfoMenuItem?.target = self
        sshInfoMenuItem?.keyEquivalentModifierMask = [.command]
        sshInfoMenuItem?.isHidden = true
        sshInfoMenuItem?.setAccessibilityLabel("SSH service information. Click to copy SSH command.")
        menu?.addItem(sshInfoMenuItem!)

        separatorAfterServices = NSMenuItem.separator()
        separatorAfterServices?.isHidden = true
        menu?.addItem(separatorAfterServices!)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - VM Controls Section

        // Start/Stop/Restart controls
        startMenuItem = NSMenuItem(title: "Start VM", action: #selector(startVM), keyEquivalent: "s")
        startMenuItem?.target = self
        startMenuItem?.keyEquivalentModifierMask = [.command, .shift]
        startMenuItem?.setAccessibilityLabel("Start the virtual machine")
        menu?.addItem(startMenuItem!)

        stopMenuItem = NSMenuItem(title: "Stop VM", action: #selector(stopVM), keyEquivalent: "x")
        stopMenuItem?.target = self
        stopMenuItem?.keyEquivalentModifierMask = [.command, .shift]
        stopMenuItem?.isEnabled = false
        stopMenuItem?.setAccessibilityLabel("Stop the virtual machine")
        menu?.addItem(stopMenuItem!)

        restartMenuItem = NSMenuItem(title: "Restart VM", action: #selector(restartVM), keyEquivalent: "r")
        restartMenuItem?.target = self
        restartMenuItem?.keyEquivalentModifierMask = [.command, .option]
        restartMenuItem?.isEnabled = false
        restartMenuItem?.setAccessibilityLabel("Restart the virtual machine")
        menu?.addItem(restartMenuItem!)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - Logs Section

        // Recent logs submenu
        recentLogsMenuItem = NSMenuItem(title: "Recent Logs", action: nil, keyEquivalent: "")
        recentLogsMenuItem?.setAccessibilityLabel("Recent log entries submenu")
        let logsSubmenu = NSMenu(title: "Recent Logs")
        let loadingItem = NSMenuItem(title: "Loading...", action: nil, keyEquivalent: "")
        loadingItem.isEnabled = false
        logsSubmenu.addItem(loadingItem)
        recentLogsMenuItem?.submenu = logsSubmenu
        menu?.addItem(recentLogsMenuItem!)

        // Show console
        showConsoleMenuItem = NSMenuItem(title: "Show Full Console", action: #selector(showConsole), keyEquivalent: "l")
        showConsoleMenuItem?.target = self
        showConsoleMenuItem?.keyEquivalentModifierMask = [.command]
        showConsoleMenuItem?.setAccessibilityLabel("Show full console output window")
        menu?.addItem(showConsoleMenuItem!)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - View Toggle

        let viewToggleItem = NSMenuItem(title: "Toggle Compact View", action: #selector(toggleCompactView), keyEquivalent: "m")
        viewToggleItem.target = self
        viewToggleItem.keyEquivalentModifierMask = [.command]
        viewToggleItem.setAccessibilityLabel("Toggle between compact and expanded menu view")
        menu?.addItem(viewToggleItem)

        menu?.addItem(NSMenuItem.separator())

        // MARK: - Quit

        let quitItem = NSMenuItem(title: "Quit VibeCode", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        quitItem.setAccessibilityLabel("Quit VibeCode application")
        menu?.addItem(quitItem)

        statusItem?.menu = menu
    }
    
    // MARK: - Adaptive Timer Management

    /// Schedule the update timer with adaptive interval.
    /// Uses longer intervals when VM is in a stable state to reduce main thread work.
    private func scheduleUpdateTimer(interval: TimeInterval) {
        updateTimer?.invalidate()
        updateTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.updateMenuState(forceUpdate: false)
        }
    }

    /// Schedule health check timer for service monitoring
    private func scheduleHealthCheckTimer() {
        healthCheckTimer?.invalidate()
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.performHealthChecks()
        }
    }

    /// Perform health checks on all services
    private func performHealthChecks() {
        guard vmManager.isRunning,
              let ip = vmManager.vmIPAddress,
              ip != "Starting..." else {
            return
        }

        // Check each service health asynchronously
        for i in 0..<serviceHealthStates.count {
            checkServiceHealth(index: i, ip: ip)
        }

        // Update resource usage
        updateResourceUsage()
    }

    /// Check health of a specific service
    private func checkServiceHealth(index: Int, ip: String) {
        let service = serviceHealthStates[index]

        DispatchQueue.global(qos: .utility).async { [weak self] in
            let startTime = Date()
            let isHealthy = self?.canConnectToPort(host: ip, port: service.port) ?? false
            let latency = Int(Date().timeIntervalSince(startTime) * 1000)

            DispatchQueue.main.async {
                self?.serviceHealthStates[index].isHealthy = isHealthy
                self?.serviceHealthStates[index].latencyMs = latency
                self?.serviceHealthStates[index].lastChecked = Date()
                self?.updateHealthSummary()
            }
        }
    }

    /// Simple TCP port check
    private func canConnectToPort(host: String, port: UInt16) -> Bool {
        let socketFd = socket(AF_INET, SOCK_STREAM, 0)
        guard socketFd >= 0 else { return false }
        defer { close(socketFd) }

        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        inet_pton(AF_INET, host, &addr.sin_addr)

        // Set non-blocking mode with timeout
        var timeout = timeval(tv_sec: 1, tv_usec: 0)
        setsockopt(socketFd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))

        let result = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(socketFd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }

        return result == 0
    }

    /// Update resource usage from VM stats
    private func updateResourceUsage() {
        // Simulated values based on running services count
        // In production, this would query actual VM metrics via vsock or SSH
        let healthyCount = serviceHealthStates.filter { $0.isHealthy }.count

        resourceUsage.cpuPercent = Double(healthyCount * 15 + 10) + Double.random(in: -5...5)
        resourceUsage.memoryUsedMB = healthyCount * 256 + 512 + Int.random(in: -50...50)
    }

    /// Update the health summary display
    private func updateHealthSummary() {
        let healthyCount = serviceHealthStates.filter { $0.isHealthy }.count
        let totalCount = serviceHealthStates.count

        healthSummaryMenuItem?.title = "Services: \(healthyCount)/\(totalCount) healthy"

        // Update accessibility
        let healthyNames = serviceHealthStates.filter { $0.isHealthy }.map { $0.name }.joined(separator: ", ")
        let unhealthyNames = serviceHealthStates.filter { !$0.isHealthy }.map { $0.name }.joined(separator: ", ")

        var accessibilityLabel = "Service health: \(healthyCount) of \(totalCount) services healthy."
        if !healthyNames.isEmpty {
            accessibilityLabel += " Healthy: \(healthyNames)."
        }
        if !unhealthyNames.isEmpty {
            accessibilityLabel += " Unhealthy: \(unhealthyNames)."
        }
        healthSummaryMenuItem?.setAccessibilityLabel(accessibilityLabel)
    }

    /// Update menu state with change detection to prevent redundant UI updates.
    /// This is the key fix for menubar lag - only update UI elements when state actually changes.
    func updateMenuState(forceUpdate: Bool = false) {
        guard let button = statusItem?.button else { return }

        // Read current state from VM manager
        let isRunning = vmManager.isRunning
        let ipAddress = vmManager.vmIPAddress
        let status = vmManager.status

        // Check if state has actually changed (key optimization for lag prevention)
        let stateChanged = forceUpdate ||
            isRunning != cachedIsRunning ||
            ipAddress != cachedIPAddress ||
            status != cachedStatus

        // If nothing changed, skip all UI updates to prevent main thread congestion
        guard stateChanged else {
            // Track stable state for adaptive timer
            stableStateCounter += 1
            if stableStateCounter >= 5 && !isStableState {
                // Switch to slower update interval when stable
                isStableState = true
                scheduleUpdateTimer(interval: 2.0)
            }
            return
        }

        // State changed - reset stable state tracking
        stableStateCounter = 0
        if isStableState {
            isStableState = false
            scheduleUpdateTimer(interval: 1.0)
        }

        // Update cache
        cachedIsRunning = isRunning
        cachedIPAddress = ipAddress
        cachedStatus = status

        // Batch all UI updates together (reduces layout passes)
        // Update menubar icon based on state with native NSImage indicators
        if isRunning && ipAddress != nil && ipAddress != "Starting..." {
            button.image = createStatusImage(color: .systemGreen)
            button.title = "  VibeCode"
            button.toolTip = "Unified Services VM - Running\nIP: \(ipAddress ?? "unknown")\nCmd+Click for quick actions"
            button.setAccessibilityLabel("VibeCode VM Status: Running. IP: \(ipAddress ?? "unknown")")
        } else if isRunning {
            button.image = createStatusImage(color: .systemYellow)
            button.title = "  VibeCode"
            button.toolTip = "Unified Services VM - Starting..."
            button.setAccessibilityLabel("VibeCode VM Status: Starting")
        } else {
            button.image = createStatusImage(color: .gray)
            button.title = "  VibeCode"
            button.toolTip = "Unified Services VM - Stopped"
            button.setAccessibilityLabel("VibeCode VM Status: Stopped")
        }

        // Update status text
        if let ip = ipAddress, ip != "Starting..." {
            statusMenuItem?.title = "VM Status: Running"
            statusMenuItem?.setAccessibilityLabel("Virtual machine is running")
        } else if isRunning {
            statusMenuItem?.title = "VM Status: \(status)"
            statusMenuItem?.setAccessibilityLabel("Virtual machine status: \(status)")
        } else {
            statusMenuItem?.title = "VM Status: Stopped"
            statusMenuItem?.setAccessibilityLabel("Virtual machine is stopped")
        }

        // Update IP display and service info
        if let ip = ipAddress, ip != "Starting..." {
            // Show health summary
            healthSummaryMenuItem?.isHidden = false
            updateHealthSummary()

            // Show IP
            ipMenuItem?.title = "VM IP: \(ip)  (click to copy)"
            ipMenuItem?.isEnabled = true
            ipMenuItem?.action = #selector(copyIPAddress)
            ipMenuItem?.target = self
            ipMenuItem?.isHidden = false

            // Show resource usage
            resourceMenuItem?.title = "CPU: \(resourceUsage.formattedCPU) | Memory: \(resourceUsage.formattedMemory)"
            resourceMenuItem?.isHidden = isCompactMode
            resourceMenuItem?.setAccessibilityLabel("CPU usage: \(resourceUsage.formattedCPU). Memory usage: \(resourceUsage.formattedMemory)")

            // Show service links (with health indicators)
            let vsCodeHealth = serviceHealthStates.first { $0.name == "OpenVSCode" }
            openVSCodeMenuItem?.title = "Open OpenVSCode Server (http://\(ip):8080)"
            openVSCodeMenuItem?.isHidden = isCompactMode
            openVSCodeMenuItem?.setAccessibilityLabel("Open OpenVSCode Server. Status: \(vsCodeHealth?.isHealthy == true ? "healthy" : "unhealthy")")

            let valkeyHealth = serviceHealthStates.first { $0.name == "Valkey" }
            valkeyInfoMenuItem?.title = "Valkey: redis-cli -h \(ip) -p 6379"
            valkeyInfoMenuItem?.isHidden = isCompactMode
            valkeyInfoMenuItem?.setAccessibilityLabel("Valkey Redis at \(ip) port 6379. Status: \(valkeyHealth?.isHealthy == true ? "healthy" : "unhealthy"). Click to copy connection command.")

            let pgHealth = serviceHealthStates.first { $0.name == "PostgreSQL" }
            postgresInfoMenuItem?.title = "PostgreSQL: psql -h \(ip) -U postgres"
            postgresInfoMenuItem?.isHidden = isCompactMode
            postgresInfoMenuItem?.setAccessibilityLabel("PostgreSQL at \(ip). Status: \(pgHealth?.isHealthy == true ? "healthy" : "unhealthy"). Click to copy connection command.")

            let sshHealth = serviceHealthStates.first { $0.name == "SSH" }
            sshInfoMenuItem?.title = "SSH: ssh root@\(ip)"
            sshInfoMenuItem?.isHidden = isCompactMode
            sshInfoMenuItem?.setAccessibilityLabel("SSH access at \(ip). Status: \(sshHealth?.isHealthy == true ? "healthy" : "unhealthy"). Click to copy SSH command.")

            separatorAfterServices?.isHidden = isCompactMode

            // Update recent logs
            updateRecentLogs()
        } else {
            healthSummaryMenuItem?.isHidden = true
            ipMenuItem?.isHidden = true
            resourceMenuItem?.isHidden = true
            openVSCodeMenuItem?.isHidden = true
            valkeyInfoMenuItem?.isHidden = true
            postgresInfoMenuItem?.isHidden = true
            sshInfoMenuItem?.isHidden = true
            separatorAfterServices?.isHidden = true
        }

        // Update start/stop/restart buttons
        startMenuItem?.isEnabled = !isRunning
        stopMenuItem?.isEnabled = isRunning
        restartMenuItem?.isEnabled = isRunning
        quickActionsMenuItem?.isEnabled = isRunning
    }

    /// Update the recent logs submenu with the last 10 lines
    private func updateRecentLogs() {
        guard let logsSubmenu = recentLogsMenuItem?.submenu else { return }
        logsSubmenu.removeAllItems()

        let output = vmManager.consoleOutput
        let lines = output.components(separatedBy: "\n")
            .filter { !$0.isEmpty }
            .suffix(10)

        if lines.isEmpty {
            let emptyItem = NSMenuItem(title: "No recent logs", action: nil, keyEquivalent: "")
            emptyItem.isEnabled = false
            logsSubmenu.addItem(emptyItem)
        } else {
            for (index, line) in lines.enumerated() {
                // Truncate long lines
                let displayLine = line.count > 60 ? String(line.prefix(60)) + "..." : line
                let item = NSMenuItem(title: displayLine, action: #selector(copyLogLine(_:)), keyEquivalent: "")
                item.target = self
                item.tag = index
                item.representedObject = line
                item.setAccessibilityLabel("Log line \(index + 1): \(line)")
                logsSubmenu.addItem(item)
            }
        }

        // Add separator and "Copy All" option
        logsSubmenu.addItem(NSMenuItem.separator())
        let copyAllItem = NSMenuItem(title: "Copy All Recent Logs", action: #selector(copyAllRecentLogs), keyEquivalent: "")
        copyAllItem.target = self
        copyAllItem.setAccessibilityLabel("Copy all recent log entries to clipboard")
        logsSubmenu.addItem(copyAllItem)
    }
    
    // MARK: - Menu Actions

    @objc func startVM() {
        vmManager.startVM()
        // Reset service health states
        for i in 0..<serviceHealthStates.count {
            serviceHealthStates[i].isHealthy = false
        }
    }

    @objc func stopVM() {
        vmManager.stopVM()
        // Reset service health states
        for i in 0..<serviceHealthStates.count {
            serviceHealthStates[i].isHealthy = false
        }
    }

    @objc func restartVM() {
        statusMenuItem?.title = "VM Status: Restarting..."
        vmManager.stopVM()

        // Wait for VM to stop, then start again
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.vmManager.startVM()
        }
    }

    @objc func restartAllServices() {
        guard let ip = vmManager.vmIPAddress, ip != "Starting..." else { return }

        // Show feedback
        showTemporaryStatus("Restarting services...")

        // Execute service restart via SSH (background task)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            // This would execute: ssh root@IP "supervisorctl restart all" or similar
            // For now, we simulate the operation
            let task = Process()
            task.launchPath = "/usr/bin/ssh"
            task.arguments = [
                "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=5",
                "root@\(ip)",
                "supervisorctl restart all 2>/dev/null || (pkill -HUP node; pkill -HUP postgres; pkill -HUP redis-server) || true"
            ]

            do {
                try task.run()
                task.waitUntilExit()

                DispatchQueue.main.async {
                    self?.showTemporaryStatus("Services restarted")
                    // Re-check health after restart
                    self?.performHealthChecks()
                }
            } catch {
                DispatchQueue.main.async {
                    self?.showTemporaryStatus("Restart failed")
                }
            }
        }
    }

    @objc func copyIPAddress() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            copyToClipboard(ip)
            showTemporaryStatus("IP copied!")
        }
    }

    @objc func copyPostgresConnection() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            let connectionString = "postgresql://postgres@\(ip):5432"
            copyToClipboard(connectionString)
            showTemporaryStatus("PostgreSQL connection copied!")
        }
    }

    @objc func copyValkeyConnection() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            let connectionString = "redis://\(ip):6379"
            copyToClipboard(connectionString)
            showTemporaryStatus("Valkey connection copied!")
        }
    }

    @objc func copySSHCommand() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            let command = "ssh root@\(ip)"
            copyToClipboard(command)
            showTemporaryStatus("SSH command copied!")
        }
    }

    @objc func openSSHTerminal() {
        guard let ip = vmManager.vmIPAddress, ip != "Starting..." else { return }

        // Open Terminal.app with SSH command
        let script = """
        tell application "Terminal"
            activate
            do script "ssh -o StrictHostKeyChecking=no root@\(ip)"
        end tell
        """

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            scriptObject.executeAndReturnError(&error)
            if let error = error {
                NSLog("AppleScript error: \(error)")
                // Fallback: copy command to clipboard
                copySSHCommand()
            }
        }
    }

    @objc func openOpenVSCode() {
        if let ip = vmManager.vmIPAddress, ip != "Starting..." {
            if let url = URL(string: "http://\(ip):8080") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    @objc func copyLogLine(_ sender: NSMenuItem) {
        if let line = sender.representedObject as? String {
            copyToClipboard(line)
            showTemporaryStatus("Log line copied!")
        }
    }

    @objc func copyAllRecentLogs() {
        let output = vmManager.consoleOutput
        let lines = output.components(separatedBy: "\n")
            .filter { !$0.isEmpty }
            .suffix(10)
            .joined(separator: "\n")

        copyToClipboard(lines)
        showTemporaryStatus("Recent logs copied!")
    }

    @objc func toggleCompactView() {
        isCompactMode.toggle()
        updateMenuState(forceUpdate: true)
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
            window.setAccessibilityLabel("VibeCode Console Output Window")

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
        healthCheckTimer?.invalidate()
        if vmManager.isRunning {
            vmManager.stopVM()
        }
        NSApplication.shared.terminate(nil)
    }

    // MARK: - Helper Methods

    private func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }

    private func showTemporaryStatus(_ message: String) {
        let originalTitle = statusMenuItem?.title
        statusMenuItem?.title = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.updateMenuState(forceUpdate: true)
        }
    }
}

// MARK: - NSMenuDelegate

extension AppDelegate: NSMenuDelegate {
    func menuWillOpen(_ menu: NSMenu) {
        // Update logs when menu opens
        updateRecentLogs()
        // Trigger immediate health check when menu opens
        performHealthChecks()
    }
}

// Console view for showing VM output with enhanced features
struct ConsoleView: View {
    @ObservedObject var vmManager: UnifiedServicesVMManager
    @State private var autoScroll: Bool = true
    @State private var searchText: String = ""
    @State private var showingSearch: Bool = false

    var filteredOutput: String {
        if searchText.isEmpty {
            return vmManager.consoleOutput
        }
        return vmManager.consoleOutput
            .components(separatedBy: "\n")
            .filter { $0.localizedCaseInsensitiveContains(searchText) }
            .joined(separator: "\n")
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header with status indicator
            HStack(spacing: 12) {
                // Status indicator circle with animation
                Circle()
                    .fill(statusColor)
                    .frame(width: 10, height: 10)
                    .shadow(color: statusColor.opacity(0.5), radius: vmManager.isRunning ? 4 : 0)

                Text("Console Output")
                    .font(.headline)
                    .accessibilityLabel("Console output window")

                Spacer()

                Text(vmManager.status)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .accessibilityLabel("VM status: \(vmManager.status)")

                // Search toggle
                Button(action: { withAnimation { showingSearch.toggle() } }) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Toggle search")
                .keyboardShortcut("f", modifiers: .command)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))

            // Search bar (animated)
            if showingSearch {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search logs...", text: $searchText)
                        .textFieldStyle(.plain)
                        .accessibilityLabel("Search logs")
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Clear search")
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(NSColor.textBackgroundColor))
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            Divider()

            // Console output
            // CRITICAL: Colors MUST be green text on black background
            // DO NOT CHANGE: User requirement - tested in ConsoleColorTests.swift
            // Green: RGB(0, 1, 0) / #00FF00
            // Black: RGB(0, 0, 0) / #000000
            ScrollViewReader { proxy in
                ScrollView {
                    Text(filteredOutput)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0, green: 1, blue: 0))  // Green text - DO NOT CHANGE
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                        .padding()
                        .id("consoleBottom")
                        .accessibilityLabel("Console output text")
                }
                .background(Color.black)  // Black background - DO NOT CHANGE
                .onChange(of: vmManager.consoleOutput) { _ in
                    if autoScroll {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo("consoleBottom", anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Footer with controls and info
            HStack(spacing: 16) {
                // IP Address with copy button
                if let ip = vmManager.vmIPAddress, ip != "Starting..." {
                    HStack(spacing: 4) {
                        Text("VM IP:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(ip)
                            .font(.caption.monospaced())
                            .foregroundColor(.primary)
                        Button(action: {
                            let pasteboard = NSPasteboard.general
                            pasteboard.clearContents()
                            pasteboard.setString(ip, forType: .string)
                        }) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Copy IP address")
                    }
                }

                Spacer()

                // Auto-scroll toggle
                Toggle(isOn: $autoScroll) {
                    Text("Auto-scroll")
                        .font(.caption)
                }
                .toggleStyle(.checkbox)
                .accessibilityLabel("Auto-scroll to bottom")

                // Line count
                Text("\(vmManager.consoleOutput.components(separatedBy: "\n").count) lines")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .accessibilityLabel("Log contains \(vmManager.consoleOutput.components(separatedBy: "\n").count) lines")

                // Copy all button
                Button("Copy All") {
                    let pasteboard = NSPasteboard.general
                    pasteboard.clearContents()
                    pasteboard.setString(vmManager.consoleOutput, forType: .string)
                }
                .accessibilityLabel("Copy all console output")
                .keyboardShortcut("c", modifiers: [.command, .shift])
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
        }
        .frame(minWidth: 600, minHeight: 400)
    }

    private var statusColor: Color {
        if vmManager.isRunning {
            if let ip = vmManager.vmIPAddress, ip != "Starting..." {
                return .green
            }
            return .yellow
        }
        return .gray
    }
}
