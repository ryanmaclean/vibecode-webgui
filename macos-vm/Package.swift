// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeCodeVM",
    platforms: [
        .macOS(.v13)
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
            path: "Sources"
        )
    ]
)
