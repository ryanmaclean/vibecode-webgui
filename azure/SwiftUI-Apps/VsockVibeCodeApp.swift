//
// VsockVibeCodeApp.swift
// VsockVibeCode
//
// Created: 2025-11-25
// Migration Status: REFACTORED
// Purpose: Main app file for VsockVibeCode (using VirtIO sockets)
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import SwiftUI
import Virtualization

@main
struct VsockVibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            VsockContentView()
        }
    }
}

struct VsockContentView: View {
    @StateObject private var vmManager = VsockVMManager()

    var body: some View {
        VStack(spacing: 20) {
            // Title
            Text("VibeCode - Vsock Edition")
                .font(.system(size: 36, weight: .bold))

            Text("OpenVSCode Server via VirtIO Socket")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Status Indicator
            HStack {
                Circle()
                    .fill(vmManager.isRunning ? Color.green : Color.gray)
                    .frame(width: 12, height: 12)
                Text(vmManager.status)
                    .font(.system(.body, design: .monospaced))
            }

            // Server URL Link
            if let url = vmManager.serverURL {
                Link(destination: URL(string: url)!) {
                    HStack {
                        Image(systemName: "link")
                        Text(url)
                    }
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
                }
            }

            // Vsock Status
            Text("Vsock Status: \(vmManager.vsockStatus)")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.blue)

            // Console Output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(height: 200)
            .background(Color.black.opacity(0.8))
            .foregroundColor(.green)
            .cornerRadius(8)

            // Control Buttons
            HStack(spacing: 20) {
                Button(action: {
                    vmManager.startVM()
                }) {
                    Label("Start", systemImage: "play.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vmManager.isRunning)

                Button(action: {
                    vmManager.stopVM()
                }) {
                    Label("Stop", systemImage: "stop.fill")
                        .frame(width: 120)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(!vmManager.isRunning)
            }

            Spacer()
        }
        .padding(40)
        .frame(minWidth: 600, minHeight: 550)
    }
}
