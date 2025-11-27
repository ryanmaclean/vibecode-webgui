import SwiftUI
import Virtualization

@main
struct VibeCodeApp: App {
    init() {
        // Initialize observability on app launch
        DatadogLogger.shared.info("VibeCode app launching", ["version": "1.0.0", "os": "macOS"])
        DogStatsDClient.shared.increment("app.launch", tags: ["version:1.0.0"])
        NSLog("✅ Observability initialized: Datadog + StatsD")
    }

    var body: some Scene {
        WindowGroup {
            LiquidGlassContentView()
        }
        .windowStyle(.hiddenTitleBar)
    }
}

struct LiquidGlassContentView: View {
    @StateObject private var vmManager = LiquidGlassVMManager()
    @State private var isHoveringStart = false
    @State private var isHoveringStop = false

    var body: some View {
        ZStack {
            // Animated gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.2),
                    Color(red: 0.2, green: 0.1, blue: 0.3),
                    Color(red: 0.1, green: 0.2, blue: 0.3)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Glass card
            VStack(spacing: 0) {
                // Header
                VStack(spacing: 12) {
                    HStack {
                        // Logo/Icon area
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [.blue, .purple, .pink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 60, height: 60)
                            .overlay(
                                Image(systemName: "chevron.left.forwardslash.chevron.right")
                                    .foregroundColor(.white)
                                    .font(.system(size: 24, weight: .semibold))
                            )

                        VStack(alignment: .leading, spacing: 4) {
                            Text("VibeCode")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.white, .white.opacity(0.8)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )

                            Text("OpenVSCode Server")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                        }

                        Spacer()

                        // Status indicator
                        StatusPill(status: vmManager.status, isRunning: vmManager.isRunning)
                    }
                }
                .padding(30)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: [.white.opacity(0.3), .white.opacity(0.1)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1
                                )
                        )
                )

                // VM IP Address display
                if let vmIP = vmManager.vmIPAddress {
                    HStack(spacing: 12) {
                        Image(systemName: "network")
                            .font(.system(size: 18))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.green, .teal],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text("VM Network Address")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white.opacity(0.7))

                            Text(vmIP)
                                .font(.system(size: 14, weight: .medium, design: .monospaced))
                                .foregroundColor(.white.opacity(0.9))
                        }

                        Spacer()
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.green.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .padding(.top, 20)
                }

                // URL Card
                if let url = vmManager.serverURL {
                    URLCard(url: url)
                        .padding(.top, 20)
                }

                // Console
                ConsoleView(output: vmManager.consoleOutput)
                    .padding(.top, 20)

                // Controls
                HStack(spacing: 16) {
                    GlassButton(
                        title: "Start VM",
                        icon: "play.fill",
                        gradient: [.green, .blue],
                        isEnabled: !vmManager.isRunning,
                        isHovering: $isHoveringStart
                    ) {
                        vmManager.startVM()
                    }

                    GlassButton(
                        title: "Stop VM",
                        icon: "stop.fill",
                        gradient: [.red, .orange],
                        isEnabled: vmManager.isRunning,
                        isHovering: $isHoveringStop
                    ) {
                        vmManager.stopVM()
                    }
                }
                .padding(.top, 24)
            }
            .padding(40)
        }
        .frame(minWidth: 700, minHeight: 650)
    }
}

struct StatusPill: View {
    let status: String
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isRunning ? Color.green : Color.gray)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .fill(isRunning ? Color.green : Color.clear)
                        .blur(radius: 4)
                        .scaleEffect(1.5)
                )

            Text(status)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay(
                    Capsule()
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

struct URLCard: View {
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 12) {
                Image(systemName: "link.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text(url)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.9))

                Spacer()

                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.5))
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [.blue.opacity(0.5), .cyan.opacity(0.3)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

struct ConsoleView: View {
    let output: String

    var body: some View {
        ScrollView {
            Text(output)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.green.opacity(0.9))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
        }
        .frame(height: 200)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.black.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.green.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

struct GlassButton: View {
    let title: String
    let icon: String
    let gradient: [Color]
    let isEnabled: Bool
    @Binding var isHovering: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(title)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        isEnabled
                            ? LinearGradient(
                                colors: isHovering ? gradient.map { $0.opacity(0.8) } : gradient.map { $0.opacity(0.6) },
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            : LinearGradient(
                                colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                isEnabled
                                    ? LinearGradient(
                                        colors: [.white.opacity(0.3), .white.opacity(0.1)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                    : LinearGradient(
                                        colors: [.white.opacity(0.1), .white.opacity(0.05)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                lineWidth: 1
                            )
                    )
                    .shadow(color: isHovering && isEnabled ? gradient[0].opacity(0.5) : .clear, radius: 20, x: 0, y: 10)
            )
            .scaleEffect(isHovering && isEnabled ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isHovering = hovering
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovering)
    }
}
