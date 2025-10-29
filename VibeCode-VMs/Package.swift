// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "VibeCode-VMs",
    platforms: [
        .macOS(.v14) // Requires macOS 14+ for Virtualization.framework features
    ],
    products: [
        .executable(
            name: "vibecode-vms",
            targets: ["VibeCodeVMs"]
        )
    ],
    dependencies: [
        // Add dependencies here if needed
    ],
    targets: [
        .executableTarget(
            name: "VibeCodeVMs",
            path: "Sources/VibeCodeVMs"
        )
    ]
)
