//
// BasicVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-25 (Migrated from inline VMManager)
// Migration Status: MIGRATED
// Purpose: SwiftUI app for VibeCode with OpenVSCode Server
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
// Previously: Lines 107-284 contained inline VMManager (now removed)
// Now uses: Apps/BasicVibeCodeApp/BasicVMManager.swift
//

import SwiftUI
import Virtualization

@main
struct VibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var vmManager = BasicVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("VibeCode")
                .font(.system(size: 36, weight: .bold))

            Text("OpenVSCode Server on Alpine Linux")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            // Status
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(vmManager.isRunning ? Color.green : Color.gray)
                        .frame(width: 12, height: 12)
                    Text(vmManager.status)
                        .font(.system(.body, design: .monospaced))
                }

                // VM IP Address if detected
                if let vmIP = vmManager.vmIPAddress {
                    HStack(spacing: 8) {
                        Image(systemName: "network")
                            .foregroundColor(.blue)
                        Text("VM IP: \(vmIP)")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }
            }

            // URL if available
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

            // Console output
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

            // Controls
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
        .frame(minWidth: 600, minHeight: 500)
        .onAppear {
            // Autostart VM when app launches
            vmManager.startVM()
        }
    }
}
