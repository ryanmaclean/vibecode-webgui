//
// UnifiedServicesVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-27
// Purpose: SwiftUI app for Unified Services VM (OpenVSCode + Valkey + PostgreSQL + SSH)
//

import SwiftUI

@main
struct UnifiedServicesVibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var vmManager = UnifiedServicesVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("Unified Services VM")
                .font(.largeTitle)
                .padding()
                .onAppear {
                    // Auto-start VM when app launches
                    if !vmManager.isRunning {
                        vmManager.startVM()
                    }
                }

            Text(vmManager.status)
                .font(.body)
                .padding()

            if let ipAddress = vmManager.vmIPAddress {
                VStack(alignment: .leading, spacing: 10) {
                    Text("VM IP: \(ipAddress)")
                        .font(.headline)

                    Text("OpenVSCode: http://\(ipAddress):8080")
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)

                    Text("Valkey: redis-cli -h \(ipAddress) -p 6379")
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)

                    Text("PostgreSQL: psql -h \(ipAddress) -U postgres -p 5432")
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)

                    Text("SSH: ssh root@\(ipAddress) (password: vibecode)")
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)
                }
                .padding()
            }

            HStack {
                Button("Start VM") {
                    vmManager.startVM()
                }
                .disabled(vmManager.isRunning)

                Button("Stop VM") {
                    vmManager.stopVM()
                }
                .disabled(!vmManager.isRunning)
            }

            // Console output
            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(height: 400)
            .border(Color.gray, width: 1)
            .padding()
        }
        .frame(width: 900, height: 700)
        .padding()
    }
}
