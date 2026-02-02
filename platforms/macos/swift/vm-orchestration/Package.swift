// swift-tools-version: 5.9
// VM Orchestration for VibeCode AgentAPI Containers
// Production-grade Virtualization.framework integration

import PackageDescription

let package = Package(
    name: "VMOrchestration",
    platforms: [
        .macOS(.v13) // Requires macOS Ventura for Virtualization.framework improvements
    ],
    products: [
        .library(
            name: "VMOrchestration",
            targets: ["VMOrchestration"]
        ),
        .executable(
            name: "vmorchd",
            targets: ["VMOrchestrationCLI"]
        )
    ],
    dependencies: [
        // Logging framework
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.0"),
        // Metrics collection
        .package(url: "https://github.com/apple/swift-metrics.git", from: "2.4.0"),
        // JSON configuration
        .package(url: "https://github.com/Flight-School/AnyCodable.git", from: "0.6.0"),
    ],
    targets: [
        // Main VM orchestration library
        .target(
            name: "VMOrchestration",
            dependencies: [
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Metrics", package: "swift-metrics"),
                .product(name: "AnyCodable", package: "AnyCodable"),
            ],
            path: "Sources/VMOrchestration",
            resources: [
                .copy("Resources/kernels"),
                .copy("Resources/initramfs"),
                .copy("Resources/configs")
            ]
        ),

        // CLI daemon for production deployment
        .executableTarget(
            name: "VMOrchestrationCLI",
            dependencies: ["VMOrchestration"],
            path: "Sources/CLI"
        ),

        // Test suite
        .testTarget(
            name: "VMOrchestrationTests",
            dependencies: ["VMOrchestration"],
            path: "Tests/VMOrchestrationTests"
        ),

        // Performance benchmarks
        .testTarget(
            name: "PerformanceBenchmarks",
            dependencies: ["VMOrchestration"],
            path: "Tests/PerformanceBenchmarks"
        )
    ],
    swiftLanguageVersions: [.v5]
)
