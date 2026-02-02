//
// PostgreSQLVibeCodeApp.swift
// VibeCode
//
// Created: 2025-11-27
// Purpose: SwiftUI app for PostgreSQL VM
//

import SwiftUI

@main
struct PostgreSQLVibeCodeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var vmManager = PostgreSQLVMManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("PostgreSQL VM")
                .font(.largeTitle)
                .padding()

            Text(vmManager.status)
                .font(.body)
                .padding()

            if let ipAddress = vmManager.vmIPAddress {
                Text("VM IP: \(ipAddress)")
                    .font(.headline)

                Text("PostgreSQL: psql -h \(ipAddress) -U postgres -p 5432")
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
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
            .frame(height: 300)
            .border(Color.gray, width: 1)
            .padding()
        }
        .frame(width: 800, height: 600)
        .padding()
        .onAppear {
            // Autostart VM when app launches
            vmManager.startVM()
        }
    }
}
