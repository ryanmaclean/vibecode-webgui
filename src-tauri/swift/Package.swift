// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeMLAccelerator",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "VibeMLAccelerator",
            type: .dynamic,
            targets: ["VibeMLAccelerator"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "VibeMLAccelerator",
            dependencies: []
        ),
        .testTarget(
            name: "VibeMLAcceleratorTests",
            dependencies: ["VibeMLAccelerator"]
        ),
    ]
)
