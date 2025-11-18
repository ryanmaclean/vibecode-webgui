// swift-tools-version: 5.9
// MIT License - VibeCode Native macOS Application

import PackageDescription

let package = Package(
    name: "VibeCode",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "VibeCodeCore", targets: ["VibeCodeCore"]),
        .library(name: "EFIBootManager", targets: ["EFIBootManager"]),
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
            path: "Sources/Core"
        ),
        .target(
            name: "EFIBootManager",
            path: "Sources/EFIBootManager"
        ),
        .executableTarget(
            name: "VibeCode",
            dependencies: ["VibeCodeCore"],
            path: "Sources",
            exclude: [
                "Core",
                "DockerVM",
                "EFIBootManager"
            ]
        ),
        .executableTarget(
            name: "DockerAlpineVM",
            path: "Sources/DockerVM"
        ),
        .testTarget(
            name: "VibeCodeTests",
            dependencies: ["VibeCodeCore"],
            path: "Tests",
            sources: [
                "IDEProcessManagerTests.swift",
                "IDEPreferencesTests.swift"
            ]
        )
    ]
)
