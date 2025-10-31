// swift-tools-version: 5.9
// MIT License - VibeCode Native macOS Application

import PackageDescription

let package = Package(
    name: "VibeCode",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "VibeCode",
            targets: ["VibeCode"]
        )
    ],
    targets: [
        .executableTarget(
            name: "VibeCode",
            dependencies: [],
            path: "Sources",
            resources: [
                .copy("Resources")
            ]
        )
    ]
)
