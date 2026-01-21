// swift-tools-version: 5.10
// MIT License - VibeCode Native macOS Application
// Target: Apple M-series Silicon, macOS 14+ (Tahoe path)

import PackageDescription

// M-series optimization flags
let swiftSettings: [SwiftSetting] = [
    .unsafeFlags(["-O", "-whole-module-optimization"], .when(configuration: .release)),
    .enableExperimentalFeature("StrictConcurrency")
]

let package = Package(
    name: "VibeCode",
    platforms: [
        .macOS(.v14) // macOS Sonoma minimum, Tahoe (26) path
    ],
    products: [
        .library(name: "VibeCodeCore", targets: ["VibeCodeCore"]),
        .library(name: "EFIBootManager", targets: ["EFIBootManager"]),
        .library(name: "VMCompression", targets: ["VMCompression"]),
        .executable(
            name: "VibeCode",
            targets: ["VibeCode"]
        ),
        .executable(
            name: "docker-alpine-vm",
            targets: ["DockerAlpineVM"]
        )
    ],
    targets: [
        .target(
            name: "VibeCodeCore",
            path: "Sources/Core",
            swiftSettings: swiftSettings
        ),
        .target(
            name: "EFIBootManager",
            path: "Sources/EFIBootManager",
            swiftSettings: swiftSettings
        ),
        .target(
            name: "VMCompression",
            path: "Sources/Compression",
            swiftSettings: swiftSettings
        ),
        .executableTarget(
            name: "VibeCode",
            dependencies: ["VibeCodeCore", "VMCompression"],
            path: "Sources",
            exclude: [
                "Core",
                "DockerVM",
                "EFIBootManager",
                "Compression",
                "VM"
            ],
            swiftSettings: swiftSettings
        ),
        .executableTarget(
            name: "DockerAlpineVM",
            path: "Sources/DockerVM",
            swiftSettings: swiftSettings
        ),
        .testTarget(
            name: "VibeCodeTests",
            dependencies: ["VibeCodeCore", "VMCompression"],
            path: "Tests",
            sources: [
                "IDEProcessManagerTests.swift",
                "IDEPreferencesTests.swift"
            ]
        )
    ]
)
