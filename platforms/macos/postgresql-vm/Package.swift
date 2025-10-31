// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PostgreSQLVM",
    platforms: [
        .macOS(.v14)  // Virtualization framework improvements in macOS 14+
    ],
    products: [
        .executable(
            name: "postgresql-vm",
            targets: ["PostgreSQLVM"]
        )
    ],
    targets: [
        .executableTarget(
            name: "PostgreSQLVM",
            dependencies: [],
            path: "Sources"
        )
    ]
)
