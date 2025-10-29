// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ValkeyVM",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "ValkeyVM",
            path: "Sources"
        )
    ]
)
