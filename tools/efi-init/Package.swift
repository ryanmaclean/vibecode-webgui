// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "efi-init",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "efi-init",
            path: "Sources"
        )
    ]
)
