// swift-tools-version: 5.9
// VibeCode Native macOS Build System
// Agent 23 - Staff Engineer (Shopify macOS CI)

import PackageDescription

let package = Package(
    name: "VibecodeNativeBuild",
    platforms: [
        .macOS(.v13) // macOS 13+ for modern Virtualization.framework
    ],
    products: [
        .executable(
            name: "vibe-build",
            targets: ["VibeBuild"]
        ),
        .executable(
            name: "vibe-oci",
            targets: ["VibeOCI"]
        ),
        .library(
            name: "VibecodeBuilder",
            targets: ["VibecodeBuilder"]
        )
    ],
    dependencies: [
        // Apple's native container runtime
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.3.0"),
        .package(url: "https://github.com/apple/swift-log", from: "1.5.0"),
        .package(url: "https://github.com/apple/swift-crypto", from: "3.0.0"),
        // OCI image manipulation
        .package(url: "https://github.com/weichsel/ZIPFoundation", from: "0.9.0")
    ],
    targets: [
        // Main build orchestrator
        .executableTarget(
            name: "VibeBuild",
            dependencies: [
                "VibecodeBuilder",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
                .product(name: "Logging", package: "swift-log")
            ]
        ),
        // OCI image builder (no Docker daemon)
        .executableTarget(
            name: "VibeOCI",
            dependencies: [
                "VibecodeBuilder",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
                .product(name: "Crypto", package: "swift-crypto"),
                "ZIPFoundation"
            ]
        ),
        // Core build library
        .target(
            name: "VibecodeBuilder",
            dependencies: [
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Crypto", package: "swift-crypto"),
                "ZIPFoundation"
            ]
        ),
        // Tests
        .testTarget(
            name: "VibecodeBuilderTests",
            dependencies: ["VibecodeBuilder"]
        )
    ]
)
