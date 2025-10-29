// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NodeJSVM",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "nodejs-vm",
            targets: ["NodeJSVM"]
        )
    ],
    targets: [
        .executableTarget(
            name: "NodeJSVM",
            path: "Sources"
        )
    ]
)
