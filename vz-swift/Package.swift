// swift-tools-version: 5.9
// Direct Apple Virtualization.framework integration for VibeCode

import PackageDescription

let package = Package(
    name: "VibeCodeVM",
    platforms: [
        .macOS(.v13) // Ventura+, full VZ support
    ],
    products: [
        .executable(
            name: "vibecode-vm",
            targets: ["VibeCodeVM"]
        )
    ],
    targets: [
        .executableTarget(
            name: "VibeCodeVM",
            dependencies: [],
            path: "Sources/VibeCodeVM",
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ]
        )
    ]
)

