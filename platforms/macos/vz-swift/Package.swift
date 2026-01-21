// swift-tools-version:5.9
// Standalone OpenVSCode VM - Virtualization.framework only
// Requires: macOS 26.0+ (Tahoe)

import PackageDescription

let package = Package(
    name: "VibeCodeVM",
    platforms: [
        .macOS(.v13) // Tahoe only
    ],
    products: [
        .executable(
            name: "vibecode-vm-standalone",
            targets: ["StandaloneVM"]
        )
    ],
    targets: [
        .executableTarget(
            name: "StandaloneVM",
            path: "Sources/StandaloneVM"
        )
    ]
)
