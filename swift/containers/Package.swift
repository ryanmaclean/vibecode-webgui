// swift-tools-version: 5.9
// ContainerManager - Swift-based container management for PostgreSQL and services
// Integrates with Apple Virtualization.framework for native macOS performance

import PackageDescription

let package = Package(
    name: "ContainerManager",
    platforms: [
        .macOS(.v14) // Requires macOS 14+ for Virtualization.framework improvements
    ],
    products: [
        .library(
            name: "ContainerManager",
            targets: ["ContainerManager"]
        ),
        .executable(
            name: "container-cli",
            targets: ["ContainerCLI"]
        )
    ],
    targets: [
        .target(
            name: "ContainerManager",
            dependencies: [],
            path: "Sources/ContainerManager"
        ),
        .executableTarget(
            name: "ContainerCLI",
            dependencies: ["ContainerManager"],
            path: "Sources/ContainerCLI"
        ),
        .testTarget(
            name: "ContainerManagerTests",
            dependencies: ["ContainerManager"],
            path: "Tests/ContainerManagerTests"
        )
    ]
)
