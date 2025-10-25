// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "LimaLauncher",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .executable(name: "lima-launcher", targets: ["LimaLauncher"])
  ],
  dependencies: [
    .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.2.3")
  ],
  targets: [
    .executableTarget(
      name: "LimaLauncher",
      dependencies: [
        "LimaLauncherCore",
        .product(name: "ArgumentParser", package: "swift-argument-parser")
      ]
    ),
    .target(
      name: "LimaLauncherCore",
      dependencies: []
    ),
    .testTarget(
      name: "LimaLauncherTests",
      dependencies: ["LimaLauncherCore"]
    )
  ]
)
