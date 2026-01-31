// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeCodeMenubar",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "VibeCodeMenubar", targets: ["VibeCodeMenubar"])
    ],
    targets: [
        .executableTarget(
            name: "VibeCodeMenubar",
            path: "Sources/VibeCodeMenubar"
        )
    ]
)
