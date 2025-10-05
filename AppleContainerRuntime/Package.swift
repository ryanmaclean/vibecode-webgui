// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AppleContainerRuntime",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "apple-container-runtime",
            targets: ["AppleContainerRuntime"]
        ),
    ],
    dependencies: [
        // Apple Containerization framework
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.3.0"),
    ],
    targets: [
        .executableTarget(
            name: "AppleContainerRuntime",
            dependencies: [
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
                .unsafeFlags(["-parse-as-library"])
            ]
        ),
        .testTarget(
            name: "AppleContainerRuntimeTests",
            dependencies: ["AppleContainerRuntime"]
        ),
    ]
)
