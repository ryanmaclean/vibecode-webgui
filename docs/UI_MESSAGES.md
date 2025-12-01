# UI Messages for VibeCode Apps

Copy-paste these messages into your SwiftUI views for user-friendly notifications.

---

## 🎯 Welcome Screen

```swift
// MARK: - Welcome Message
let welcomeMessage = """
Welcome to VibeCode!

Starting your development environment...

This will take about 30 seconds.
"""

let welcomeSubtitle = "Powered by Apple Virtualization Framework"
```

---

## ✅ VM Ready Notification

```swift
// MARK: - Ready Message
struct ReadyMessage {
    let title = "OpenVSCode is Ready!"

    let message = """
    Your development environment is running.

    Click below to open in your browser:
    """

    let url = "http://192.168.64.3:8080"

    let copyableCommand = "open http://192.168.64.3:8080"

    let alternativeMessage = """
    Or copy this URL to your browser:
    http://192.168.64.3:8080
    """
}
```

### SwiftUI Example
```swift
struct VMReadyView: View {
    let ready = ReadyMessage()

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text(ready.title)
                .font(.title)
                .bold()

            Text(ready.message)
                .multilineTextAlignment(.center)

            Button(action: {
                NSWorkspace.shared.open(URL(string: ready.url)!)
            }) {
                HStack {
                    Image(systemName: "arrow.up.right.circle.fill")
                    Text("Open OpenVSCode")
                }
                .font(.headline)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .buttonStyle(PlainButtonStyle())

            Button(action: {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(ready.url, forType: .string)
            }) {
                HStack {
                    Image(systemName: "doc.on.doc")
                    Text("Copy URL")
                }
                .padding(8)
            }
        }
        .padding()
    }
}
```

---

## 🔄 Loading States

```swift
// MARK: - Loading Messages
struct LoadingMessages {
    static let booting = "Booting Linux VM..."
    static let network = "Configuring network..."
    static let starting = "Starting OpenVSCode..."
    static let ready = "Almost ready..."

    static let steps = [
        (0...10, booting),
        (11...20, network),
        (21...28, starting),
        (29...30, ready)
    ]
}
```

### SwiftUI Progress View
```swift
struct BootProgressView: View {
    @State private var progress: Double = 0
    @State private var message: String = LoadingMessages.booting

    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: progress, total: 30)
                .progressViewStyle(LinearProgressViewStyle())
                .frame(width: 300)

            Text(message)
                .font(.headline)

            Text("\(Int(progress))/30 seconds")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .onAppear {
            startProgress()
        }
    }

    private func startProgress() {
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            progress += 1

            // Update message based on progress
            for (range, msg) in LoadingMessages.steps {
                if range.contains(Int(progress)) {
                    message = msg
                    break
                }
            }

            if progress >= 30 {
                timer.invalidate()
            }
        }
    }
}
```

---

## ⚠️ Troubleshooting Messages

```swift
// MARK: - Error Messages
struct ErrorMessages {
    static let cannotConnect = """
    Cannot connect to OpenVSCode

    Please check:
    • VM is running
    • Wait 30 seconds after launch
    • Try refreshing your browser
    """

    static let wrongURL = """
    URL not working?

    Try these alternatives:
    1. http://192.168.64.3:8080
    2. http://localhost:3000
    3. Check console logs for token
    """

    static let vmCrashed = """
    VM has stopped

    Would you like to:
    • Restart the VM
    • View console logs
    • Report an issue
    """
}
```

### Alert Example
```swift
.alert("Connection Issue", isPresented: $showError) {
    Button("View Logs") {
        showConsoleLogs()
    }
    Button("Restart VM") {
        restartVM()
    }
    Button("Cancel", role: .cancel) {}
} message: {
    Text(ErrorMessages.cannotConnect)
}
```

---

## 📋 Status Bar Messages

```swift
// MARK: - Status Messages
struct StatusMessages {
    static let idle = "VM not running"
    static let booting = "Booting... (30s)"
    static let running = "Running • http://192.168.64.3:8080"
    static let error = "Error - Click for details"
}
```

### Status Bar Item
```swift
struct StatusBarView: View {
    @ObservedObject var vmManager: VMManager

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(statusMessage)
                .font(.system(size: 12))

            if vmManager.isRunning {
                Button(action: {
                    openBrowser()
                }) {
                    Image(systemName: "arrow.up.right.circle")
                }
            }
        }
    }

    private var statusColor: Color {
        switch vmManager.state {
        case .running: return .green
        case .booting: return .yellow
        case .error: return .red
        default: return .gray
        }
    }

    private var statusMessage: String {
        switch vmManager.state {
        case .idle: return StatusMessages.idle
        case .booting: return StatusMessages.booting
        case .running: return StatusMessages.running
        case .error: return StatusMessages.error
        }
    }
}
```

---

## 🎨 Notification Center Messages

```swift
// MARK: - System Notifications
struct NotificationMessages {
    static func vmReady(url: String) -> (title: String, body: String) {
        return (
            "OpenVSCode is Ready",
            "Click to open: \(url)"
        )
    }

    static func vmStopped() -> (title: String, body: String) {
        return (
            "VM Stopped",
            "Your development environment has stopped"
        )
    }

    static func connectionLost() -> (title: String, body: String) {
        return (
            "Connection Lost",
            "Attempting to reconnect..."
        )
    }
}
```

### Send Notification
```swift
func sendReadyNotification() {
    let notification = NSUserNotification()
    let msg = NotificationMessages.vmReady(url: "http://192.168.64.3:8080")

    notification.title = msg.title
    notification.informativeText = msg.body
    notification.soundName = NSUserNotificationDefaultSoundName
    notification.hasActionButton = true
    notification.actionButtonTitle = "Open"
    notification.userInfo = ["url": "http://192.168.64.3:8080"]

    NSUserNotificationCenter.default.deliver(notification)
}
```

---

## 💬 Tooltip Messages

```swift
// MARK: - Tooltips
struct Tooltips {
    static let openBrowser = "Open OpenVSCode in browser"
    static let copyURL = "Copy URL to clipboard"
    static let restartVM = "Restart the VM"
    static let viewLogs = "View console logs"
    static let stopVM = "Stop the VM"
}
```

---

## 🎯 Onboarding Messages

```swift
// MARK: - First Launch
struct OnboardingMessages {
    static let welcome = """
    Welcome to VibeCode!

    A lightweight VS Code environment
    running in a local Linux VM.

    No cloud required. All your data stays local.
    """

    static let howItWorks = """
    How it works:

    1. Launch the app
    2. Wait 30 seconds
    3. Open your browser
    4. Start coding!
    """

    static let features = """
    Features:

    • Full VS Code experience
    • Linux development environment
    • Extensions support
    • Localhost access
    • Fast boot time
    """
}
```

---

## 📱 Menu Bar Messages

```swift
// MARK: - Menu Items
struct MenuMessages {
    static let open = "Open OpenVSCode"
    static let copyURL = "Copy URL"
    static let restart = "Restart VM"
    static let viewLogs = "View Console Logs"
    static let about = "About VibeCode"
    static let quit = "Quit"

    static let openTooltip = "Opens OpenVSCode in your default browser"
    static let copyTooltip = "Copies the access URL to clipboard"
}
```

---

## 🔗 URL Building

```swift
// MARK: - URL Builder
struct URLBuilder {
    static func buildAccessURL(ip: String = "192.168.64.3",
                               port: Int = 8080,
                               token: String? = nil) -> String {
        var url = "http://\(ip):\(port)"
        if let token = token {
            url += "?tkn=\(token)"
        }
        return url
    }

    static func buildLocalURL(port: Int = 3000,
                              token: String? = nil) -> String {
        var url = "http://localhost:\(port)"
        if let token = token {
            url += "?tkn=\(token)"
        }
        return url
    }
}
```

---

## ✨ Copy-Paste Integration

```swift
// MARK: - Clipboard Utilities
extension String {
    func copyToClipboard() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(self, forType: .string)
    }
}

// Usage:
"http://192.168.64.3:8080".copyToClipboard()
```

### With User Feedback
```swift
func copyURLWithFeedback(_ url: String) {
    url.copyToClipboard()

    // Show toast
    showToast(message: "URL copied to clipboard")

    // Or haptic feedback
    NSHapticFeedbackManager.defaultPerformer.perform(
        .alignment,
        performanceTime: .now
    )
}
```

---

## 🎉 Summary

All UI messages are designed to be:
- ✅ Copy-pastable
- ✅ User-friendly
- ✅ One-click actions
- ✅ Clear and concise
- ✅ Actionable

### Quick Implementation Checklist

```swift
// 1. VM Ready - Show notification
sendReadyNotification()

// 2. Add open button
Button("Open OpenVSCode") {
    NSWorkspace.shared.open(URL(string: "http://192.168.64.3:8080")!)
}

// 3. Add copy button
Button("Copy URL") {
    "http://192.168.64.3:8080".copyToClipboard()
    showToast(message: "Copied!")
}

// 4. Status bar indicator
StatusBarView(vmManager: vmManager)
```

**Result:** One-click experience with clear feedback at every step.
