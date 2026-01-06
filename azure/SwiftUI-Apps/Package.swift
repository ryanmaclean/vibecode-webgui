// swift-tools-version:5.9
// Package.swift for VibeCode Shared Infrastructure Testing

import PackageDescription

let package = Package(
    name: "VibeCodeShared",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "Shared",
            targets: ["Shared"]
        )
    ],
    dependencies: [
        // No external dependencies - using only Apple frameworks
    ],
    targets: [
        // Shared library target
        .target(
            name: "Shared",
            dependencies: [],
            path: "Shared",
            exclude: [
                "Observability/DatadogProvider.swift",
                "Observability/OpenTelemetryProvider.swift",
                "Networking/VsockNetworkStrategy.swift",
                "Networking/VsockProxyServer.swift",
                "Networking/ProxyConnection.swift",
                "Observability/README.md",
                "Networking/README.md",
                "Core/README.md",
                "Testing/README.md",
                "README.md",
                "ConsoleMonitoring/README.md"
            ],
            sources: [
                "Core/BaseVMManager.swift",
                "Networking/NetworkingStrategy.swift",
                "Networking/NATNetworkStrategy.swift",
                "Networking/DHCPLeaseMonitor.swift",
                "Observability/ObservabilityProvider.swift"
            ],
            linkerSettings: [
                .linkedFramework("Virtualization")
            ]
        ),

        // Test target
        .testTarget(
            name: "SharedTests",
            dependencies: ["Shared"],
            path: "Tests/SharedTests",
            sources: [
                "BaseVMManagerTests.swift",
                "NetworkingStrategyTests.swift",
                "DHCPLeaseMonitorTests.swift",
                "ObservabilityProviderTests.swift"
            ],
            linkerSettings: [
                .linkedFramework("Virtualization")
            ]
        )
    ]
)
