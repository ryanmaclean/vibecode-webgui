import ArgumentParser
import Foundation
import Logging
import VibecodeBuilder

@main
struct VibeBuild: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "vibe-build",
        abstract: "Native macOS build system for VibeCode containers",
        discussion: """
        Built by Agent 23 - Staff Engineer from Shopify's macOS CI team.

        Native macOS tooling for building container images without Docker Desktop.
        Uses Apple Container runtime and Swift Package Manager.

        Features:
        - No Docker daemon required
        - Native macOS performance
        - Universal binary support (arm64 + x86_64)
        - Layer caching for fast rebuilds
        - <5 minute full rebuild target
        """,
        version: "1.0.0",
        subcommands: [Build.self, Cache.self, Clean.self, Info.self]
    )
}

// MARK: - Build Command

struct Build: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Build container image from Dockerfile"
    )

    @Option(name: .shortAndLong, help: "Path to Dockerfile")
    var file: String = "Dockerfile"

    @Option(name: .shortAndLong, help: "Build context directory")
    var context: String = "."

    @Option(name: .shortAndLong, help: "Image tag (e.g., vibecode/agentapi:latest)")
    var tag: String

    @Option(name: .long, help: "Target platform (amd64, arm64, or both)")
    var platform: String = "arm64"

    @Flag(name: .long, help: "Disable build cache")
    var noCache: Bool = false

    @Flag(name: .long, help: "Enable verbose logging")
    var verbose: Bool = false

    mutating func run() async throws {
        // Setup logger
        var logger = Logger(label: "vibe-build")
        logger.logLevel = verbose ? .debug : .info

        logger.info("=== VibeCode Native Build System ===")
        logger.info("Agent 23 - macOS CI Infrastructure")

        // Resolve paths
        let dockerfilePath = URL(fileURLWithPath: file)
        let contextPath = URL(fileURLWithPath: context)

        guard FileManager.default.fileExists(atPath: dockerfilePath.path) else {
            logger.error("Dockerfile not found", metadata: ["path": "\(dockerfilePath.path)"])
            throw ExitCode.failure
        }

        guard FileManager.default.fileExists(atPath: contextPath.path) else {
            logger.error("Build context not found", metadata: ["path": "\(contextPath.path)"])
            throw ExitCode.failure
        }

        // Parse platform
        let platforms = parsePlatforms(platform)
        logger.info("Building for platforms: \(platforms.map { $0.rawValue }.joined(separator: ", "))")

        // Create build engine
        let engine = try BuildEngine(logger: logger)

        // Build for each platform
        for buildPlatform in platforms {
            let platformTag = platforms.count > 1 ? "\(tag)-\(buildPlatform.rawValue.split(separator: "/").last!)" : tag

            logger.info("Building \(platformTag) for \(buildPlatform.rawValue)")

            let result = try await engine.build(
                dockerfile: dockerfilePath,
                context: contextPath,
                tag: platformTag,
                platform: buildPlatform,
                cache: !noCache
            )

            logger.info("✅ Build successful!", metadata: [
                "tag": "\(platformTag)",
                "size": "\(ByteCountFormatter.string(fromByteCount: result.image.size, countStyle: .file))",
                "duration": "\(String(format: "%.2f", result.duration))s",
                "layers": "\(result.layers.count)"
            ])
        }

        // If building for multiple platforms, create manifest list
        if platforms.count > 1 {
            logger.info("Creating multi-arch manifest: \(tag)")
            try await createManifestList(tag: tag, platforms: platforms)
            logger.info("✅ Multi-arch manifest created")
        }
    }

    private func parsePlatforms(_ input: String) -> [BuildPlatform] {
        switch input.lowercased() {
        case "amd64", "x86_64":
            return [.amd64]
        case "arm64", "aarch64":
            return [.arm64]
        case "both", "all", "multi":
            return [.amd64, .arm64]
        default:
            return [.arm64] // Default to native platform
        }
    }

    private func createManifestList(tag: String, platforms: [BuildPlatform]) async throws {
        // Use container CLI to create manifest list
        var args = ["manifest", "create", tag]

        for platform in platforms {
            let platformTag = "\(tag)-\(platform.rawValue.split(separator: "/").last!)"
            args.append(platformTag)
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/container")
        process.arguments = args

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw NSError(domain: "vibe-build", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Failed to create manifest list"
            ])
        }
    }
}

// MARK: - Cache Command

struct Cache: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Manage build cache"
    )

    @Option(name: .long, help: "Cache operation (list, prune, clear)")
    var operation: String = "list"

    func run() throws {
        let logger = Logger(label: "vibe-build.cache")

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let cacheDir = homeDir.appendingPathComponent("Library/Caches/vibecode-build")

        switch operation.lowercased() {
        case "list":
            listCache(cacheDir: cacheDir, logger: logger)
        case "prune":
            try pruneCache(cacheDir: cacheDir, logger: logger)
        case "clear":
            try clearCache(cacheDir: cacheDir, logger: logger)
        default:
            logger.error("Unknown cache operation", metadata: ["operation": "\(operation)"])
            throw ExitCode.failure
        }
    }

    private func listCache(cacheDir: URL, logger: Logger) {
        guard let enumerator = FileManager.default.enumerator(at: cacheDir, includingPropertiesForKeys: [.fileSizeKey]) else {
            logger.info("Cache is empty")
            return
        }

        var totalSize: Int64 = 0
        var fileCount = 0

        while let fileURL = enumerator.nextObject() as? URL {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
               let size = attributes[.size] as? Int64 {
                totalSize += size
                fileCount += 1
            }
        }

        logger.info("Cache statistics", metadata: [
            "files": "\(fileCount)",
            "size": "\(ByteCountFormatter.string(fromByteCount: totalSize, countStyle: .file))"
        ])
    }

    private func pruneCache(cacheDir: URL, logger: Logger) throws {
        logger.info("Pruning old cache entries...")

        let cutoffDate = Date().addingTimeInterval(-7 * 24 * 60 * 60) // 7 days

        guard let enumerator = FileManager.default.enumerator(at: cacheDir, includingPropertiesForKeys: [.contentModificationDateKey]) else {
            return
        }

        var removedCount = 0
        var reclaimedSize: Int64 = 0

        while let fileURL = enumerator.nextObject() as? URL {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
               let modDate = attributes[.modificationDate] as? Date,
               modDate < cutoffDate {

                let size = attributes[.size] as? Int64 ?? 0
                try FileManager.default.removeItem(at: fileURL)
                removedCount += 1
                reclaimedSize += size
            }
        }

        logger.info("Cache pruned", metadata: [
            "removed": "\(removedCount)",
            "reclaimed": "\(ByteCountFormatter.string(fromByteCount: reclaimedSize, countStyle: .file))"
        ])
    }

    private func clearCache(cacheDir: URL, logger: Logger) throws {
        logger.warning("Clearing entire cache...")

        if FileManager.default.fileExists(atPath: cacheDir.path) {
            try FileManager.default.removeItem(at: cacheDir)
            logger.info("✅ Cache cleared")
        } else {
            logger.info("Cache already empty")
        }
    }
}

// MARK: - Clean Command

struct Clean: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Clean build artifacts and temporary files"
    )

    @Flag(name: .long, help: "Remove all build artifacts (including cache)")
    var all: Bool = false

    func run() throws {
        let logger = Logger(label: "vibe-build.clean")

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let workDir = homeDir.appendingPathComponent("Library/Application Support/vibecode-build")
        let cacheDir = homeDir.appendingPathComponent("Library/Caches/vibecode-build")

        logger.info("Cleaning build artifacts...")

        // Remove work directory
        if FileManager.default.fileExists(atPath: workDir.path) {
            try FileManager.default.removeItem(at: workDir)
            logger.info("Removed work directory")
        }

        // Remove cache if --all flag is set
        if all, FileManager.default.fileExists(atPath: cacheDir.path) {
            try FileManager.default.removeItem(at: cacheDir)
            logger.info("Removed cache directory")
        }

        logger.info("✅ Clean complete")
    }
}

// MARK: - Info Command

struct Info: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Display build system information"
    )

    func run() throws {
        let logger = Logger(label: "vibe-build.info")

        logger.info("""

        ==============================================
        VibeCode Native macOS Build System
        ==============================================

        Version: 1.0.0
        Built by: Agent 23 - Staff Engineer
        Team: Shopify macOS CI Infrastructure

        System Information:
        -------------------
        Platform: macOS
        Architecture: \(ProcessInfo.processInfo.machineType)
        CPU Cores: \(ProcessInfo.processInfo.processorCount)
        Memory: \(ByteCountFormatter.string(fromByteCount: Int64(ProcessInfo.processInfo.physicalMemory), countStyle: .memory))

        Build System:
        -------------
        - Swift Package Manager
        - Apple Virtualization.framework
        - Apple Container runtime
        - Native macOS compression (zstd)

        Features:
        ---------
        ✓ No Docker daemon required
        ✓ Universal binary support (arm64 + x86_64)
        ✓ Layer caching for fast rebuilds
        ✓ <5 minute full rebuild target
        ✓ <30 second incremental rebuild
        ✓ Offline build support

        Cache Locations:
        ----------------
        Build Cache: ~/Library/Caches/vibecode-build
        Work Directory: ~/Library/Application Support/vibecode-build
        Images: ~/Library/Application Support/vibecode-build/images

        Dependencies:
        -------------
        - Apple Container (container CLI)
        - Swift 5.9+
        - macOS 13+

        For more information:
        https://github.com/ryanmaclean/vibecode-webgui

        ==============================================
        """)
    }
}

extension ProcessInfo {
    var machineType: String {
        var size = 0
        sysctlbyname("hw.machine", nil, &size, nil, 0)
        var machine = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.machine", &machine, &size, nil, 0)
        return String(cString: machine)
    }
}
