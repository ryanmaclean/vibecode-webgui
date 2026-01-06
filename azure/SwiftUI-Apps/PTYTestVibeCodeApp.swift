//
// PTYTestVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-26
// Purpose: Example app demonstrating PTY/TTY terminal functionality
//

import SwiftUI

/// Example SwiftUI app demonstrating PTY/TTY terminal access to VM.
///
/// This app shows how to:
/// - Enable PTY mode for interactive terminal
/// - Display PTY connection information
/// - Connect to VM console via terminal tools
@main
struct PTYTestVibeCodeApp: App {
    @StateObject private var vmManager = PTYTestVMManager()

    var body: some Scene {
        WindowGroup {
            PTYTestContentView(vmManager: vmManager)
        }
    }
}

struct PTYTestContentView: View {
    @ObservedObject var vmManager: PTYTestVMManager

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode PTY Test")
                .font(.largeTitle)
                .fontWeight(.bold)

            // Status display
            HStack {
                Text("Status:")
                    .fontWeight(.semibold)
                Text(vmManager.status)
                    .foregroundColor(statusColor)
            }

            // PTY information
            if vmManager.isRunning, let ptyPath = vmManager.getPTYPath() {
                VStack(alignment: .leading, spacing: 10) {
                    Text("PTY Console")
                        .font(.headline)

                    HStack {
                        Text("Device:")
                        Text(ptyPath)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                    }

                    Divider()

                    Text("Connect via terminal:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 5) {
                        CommandText("screen \(ptyPath)")
                        Text("or")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        CommandText("bash scripts/connect-vm-terminal.sh \(ptyPath)")
                    }

                    Divider()

                    Text("Controls:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 3) {
                        Text("• Ctrl+A, D - Detach from screen")
                        Text("• Ctrl+A, K - Kill screen session")
                        Text("• Ctrl+C - Interrupt")
                    }
                    .font(.caption)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(10)
            }

            // VM controls
            HStack(spacing: 20) {
                Button(action: {
                    vmManager.startVM()
                }) {
                    Label("Start VM", systemImage: "play.circle.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vmManager.isRunning)

                Button(action: {
                    vmManager.stopVM()
                }) {
                    Label("Stop VM", systemImage: "stop.circle.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.bordered)
                .disabled(!vmManager.isRunning)
            }

            Spacer()
        }
        .padding()
        .frame(minWidth: 600, minHeight: 400)
    }

    private var statusColor: Color {
        if vmManager.status.contains("Error") {
            return .red
        } else if vmManager.status == "Ready" || vmManager.status == "Running" {
            return .green
        } else {
            return .primary
        }
    }
}

struct CommandText: View {
    let command: String

    init(_ command: String) {
        self.command = command
    }

    var body: some View {
        HStack {
            Text(command)
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.black.opacity(0.1))
                .cornerRadius(5)

            Button(action: {
                copyToClipboard(command)
            }) {
                Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.borderless)
            .help("Copy to clipboard")
        }
    }

    private func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }
}
