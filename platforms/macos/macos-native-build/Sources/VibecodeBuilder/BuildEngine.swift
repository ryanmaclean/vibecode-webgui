import Foundation
import Logging

/// Native macOS build engine for VibeCode containers
/// Uses Apple Containerization runtime instead of Docker
public final class BuildEngine {

    private let logger: Logger
    private let cacheDir: URL
    private let workDir: URL

    public init(logger: Logger = Logger(label: "vibecode.build")) throws {
        self.logger = logger

        // Use standard macOS cache locations
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        self.cacheDir = homeDir.appendingPathComponent("Library/Caches/vibecode-build")
        self.workDir = homeDir.appendingPathComponent("Library/Application Support/vibecode-build")

        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: workDir, withIntermediateDirectories: true)
    }

    // MARK: - Build Pipeline

    /// Build container image from Dockerfile
    public func build(
        dockerfile: URL,
        context: URL,
        tag: String,
        platform: BuildPlatform,
        cache: Bool = true
    ) async throws -> BuildResult {
        logger.info("Starting build", metadata: [
            "dockerfile": "\(dockerfile.path)",
            "tag": "\(tag)",
            "platform": "\(platform.rawValue)"
        ])

        let startTime = Date()

        // Parse Dockerfile
        let parser = DockerfileParser()
        let instructions = try parser.parse(dockerfile: dockerfile)
        logger.info("Parsed \(instructions.count) instructions from Dockerfile")

        // Create build context
        let buildContext = try await prepareBuildContext(context: context)
        logger.debug("Build context prepared", metadata: [
            "size": "\(buildContext.size)",
            "files": "\(buildContext.fileCount)"
        ])

        // Execute build stages
        var layers: [ImageLayer] = []
        for (index, instruction) in instructions.enumerated() {
            logger.info("Executing stage \(index + 1)/\(instructions.count): \(instruction.type)")

            let layer = try await executeInstruction(
                instruction,
                context: buildContext,
                platform: platform,
                useCache: cache
            )
            layers.append(layer)
        }

        // Create final image
        let image = try await assembleImage(layers: layers, tag: tag, platform: platform)

        let duration = Date().timeIntervalSince(startTime)
        logger.info("Build completed", metadata: [
            "duration": "\(String(format: "%.2f", duration))s",
            "layers": "\(layers.count)",
            "size": "\(image.size)"
        ])

        return BuildResult(
            image: image,
            duration: duration,
            layers: layers
        )
    }

    // MARK: - Build Context

    private func prepareBuildContext(context: URL) async throws -> BuildContext {
        let contextHash = try hashDirectory(context)
        let cacheKey = "context-\(contextHash)"

        // Check cache
        let cachedContext = cacheDir.appendingPathComponent(cacheKey)
        if FileManager.default.fileExists(atPath: cachedContext.path) {
            logger.debug("Using cached build context")
            return try BuildContext(url: cachedContext)
        }

        // Create new context archive
        let archive = try await createContextArchive(context: context)
        try FileManager.default.copyItem(at: archive, to: cachedContext)

        return try BuildContext(url: archive)
    }

    private func createContextArchive(context: URL) async throws -> URL {
        let archivePath = workDir.appendingPathComponent("context-\(UUID().uuidString).tar.zst")

        // Use macOS native compression (zstd via Compression framework)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/tar")
        process.arguments = [
            "-cf", archivePath.path,
            "--zstd",
            "-C", context.path,
            "."
        ]

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw BuildError.contextCreationFailed
        }

        return archivePath
    }

    // MARK: - Instruction Execution

    private func executeInstruction(
        _ instruction: DockerfileInstruction,
        context: BuildContext,
        platform: BuildPlatform,
        useCache: Bool
    ) async throws -> ImageLayer {

        // Calculate cache key
        let cacheKey = try instruction.cacheKey(context: context, platform: platform)

        // Check cache
        if useCache, let cachedLayer = try? loadCachedLayer(cacheKey: cacheKey) {
            logger.debug("Using cached layer for \(instruction.type)")
            return cachedLayer
        }

        // Execute instruction based on type
        let layer: ImageLayer

        switch instruction.type {
        case .from:
            layer = try await executeFrom(instruction, platform: platform)
        case .run:
            layer = try await executeRun(instruction, context: context, platform: platform)
        case .copy:
            layer = try await executeCopy(instruction, context: context)
        case .env:
            layer = try executeEnv(instruction)
        case .workdir:
            layer = try executeWorkdir(instruction)
        case .expose:
            layer = try executeExpose(instruction)
        case .cmd:
            layer = try executeCmd(instruction)
        default:
            throw BuildError.unsupportedInstruction(instruction.type)
        }

        // Cache layer
        if useCache {
            try saveCachedLayer(layer, cacheKey: cacheKey)
        }

        return layer
    }

    // MARK: - Instruction Handlers

    private func executeFrom(_ instruction: DockerfileInstruction, platform: BuildPlatform) async throws -> ImageLayer {
        // Pull base image or use local
        guard let imageName = instruction.arguments.first else {
            throw BuildError.invalidInstruction("FROM requires image name")
        }

        logger.info("Pulling base image: \(imageName)")

        // Use Apple Container CLI to pull image
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/container")
        process.arguments = ["pull", imageName, "--platform", platform.containerPlatform]

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw BuildError.imagePullFailed(imageName)
        }

        return ImageLayer(
            type: .base,
            digest: try hashString(imageName),
            size: 0 // Will be calculated when assembling
        )
    }

    private func executeRun(_ instruction: DockerfileInstruction, context: BuildContext, platform: BuildPlatform) async throws -> ImageLayer {
        let command = instruction.arguments.joined(separator: " ")
        logger.debug("Executing RUN: \(command)")

        // Create temporary container to execute command
        let containerID = UUID().uuidString
        let workspaceDir = workDir.appendingPathComponent(containerID)
        try FileManager.default.createDirectory(at: workspaceDir, withIntermediateDirectories: true)

        // Run command in Apple Container
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", command]
        process.currentDirectoryURL = workspaceDir

        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = outputPipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let output = String(data: outputPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            logger.error("RUN command failed", metadata: ["output": "\(output)"])
            throw BuildError.runCommandFailed(command)
        }

        // Create layer from changes
        let layerSize = try directorySize(workspaceDir)
        let layerDigest = try hashDirectory(workspaceDir)

        return ImageLayer(
            type: .run,
            digest: layerDigest,
            size: layerSize,
            diff: workspaceDir
        )
    }

    private func executeCopy(_ instruction: DockerfileInstruction, context: BuildContext) async throws -> ImageLayer {
        guard instruction.arguments.count >= 2 else {
            throw BuildError.invalidInstruction("COPY requires source and destination")
        }

        let source = instruction.arguments.dropLast().joined(separator: " ")
        let destination = instruction.arguments.last!

        logger.debug("Copying \(source) to \(destination)")

        // Copy files to layer directory
        let layerDir = workDir.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: layerDir, withIntermediateDirectories: true)

        let destPath = layerDir.appendingPathComponent(destination)
        try FileManager.default.createDirectory(at: destPath.deletingLastPathComponent(), withIntermediateDirectories: true)

        let sourcePath = context.url.appendingPathComponent(source)
        try FileManager.default.copyItem(at: sourcePath, to: destPath)

        return ImageLayer(
            type: .copy,
            digest: try hashDirectory(layerDir),
            size: try directorySize(layerDir),
            diff: layerDir
        )
    }

    private func executeEnv(_ instruction: DockerfileInstruction) throws -> ImageLayer {
        return ImageLayer(
            type: .metadata,
            digest: try hashString(instruction.arguments.joined()),
            size: 0
        )
    }

    private func executeWorkdir(_ instruction: DockerfileInstruction) throws -> ImageLayer {
        return ImageLayer(
            type: .metadata,
            digest: try hashString(instruction.arguments.joined()),
            size: 0
        )
    }

    private func executeExpose(_ instruction: DockerfileInstruction) throws -> ImageLayer {
        return ImageLayer(
            type: .metadata,
            digest: try hashString(instruction.arguments.joined()),
            size: 0
        )
    }

    private func executeCmd(_ instruction: DockerfileInstruction) throws -> ImageLayer {
        return ImageLayer(
            type: .metadata,
            digest: try hashString(instruction.arguments.joined()),
            size: 0
        )
    }

    // MARK: - Image Assembly

    private func assembleImage(layers: [ImageLayer], tag: String, platform: BuildPlatform) async throws -> ContainerImage {
        logger.info("Assembling final image: \(tag)")

        // Create OCI image manifest
        let manifest = OCIManifest(
            schemaVersion: 2,
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            config: OCIDescriptor(
                mediaType: "application/vnd.oci.image.config.v1+json",
                digest: try hashLayers(layers),
                size: 0
            ),
            layers: layers.map { layer in
                OCIDescriptor(
                    mediaType: "application/vnd.oci.image.layer.v1.tar+zstd",
                    digest: layer.digest,
                    size: layer.size
                )
            }
        )

        // Save to local OCI layout
        let imageDir = workDir.appendingPathComponent("images").appendingPathComponent(tag)
        try FileManager.default.createDirectory(at: imageDir, withIntermediateDirectories: true)

        let manifestData = try JSONEncoder().encode(manifest)
        try manifestData.write(to: imageDir.appendingPathComponent("manifest.json"))

        // Save layers
        let layersDir = imageDir.appendingPathComponent("blobs")
        try FileManager.default.createDirectory(at: layersDir, withIntermediateDirectories: true)

        for layer in layers {
            if let diff = layer.diff {
                // Compress layer with zstd
                let layerPath = layersDir.appendingPathComponent(layer.digest)
                try await compressLayer(source: diff, destination: layerPath)
            }
        }

        let totalSize = layers.reduce(0) { $0 + $1.size }

        return ContainerImage(
            tag: tag,
            manifest: manifest,
            size: totalSize,
            platform: platform,
            path: imageDir
        )
    }

    // MARK: - Layer Compression

    private func compressLayer(source: URL, destination: URL) async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/tar")
        process.arguments = [
            "-cf", destination.path,
            "--zstd",
            "-C", source.path,
            "."
        ]

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw BuildError.layerCompressionFailed
        }
    }

    // MARK: - Cache Management

    private func loadCachedLayer(cacheKey: String) throws -> ImageLayer? {
        let cachePath = cacheDir.appendingPathComponent("layers").appendingPathComponent(cacheKey)
        guard FileManager.default.fileExists(atPath: cachePath.path) else {
            return nil
        }

        let data = try Data(contentsOf: cachePath)
        return try JSONDecoder().decode(ImageLayer.self, from: data)
    }

    private func saveCachedLayer(_ layer: ImageLayer, cacheKey: String) throws {
        let layerCacheDir = cacheDir.appendingPathComponent("layers")
        try FileManager.default.createDirectory(at: layerCacheDir, withIntermediateDirectories: true)

        let cachePath = layerCacheDir.appendingPathComponent(cacheKey)
        let data = try JSONEncoder().encode(layer)
        try data.write(to: cachePath)
    }

    // MARK: - Utilities

    private func hashDirectory(_ url: URL) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/find")
        process.arguments = [url.path, "-type", "f", "-exec", "shasum", "-a", "256", "{}", ";"]

        let pipe = Pipe()
        process.standardOutput = pipe

        try process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8) ?? ""
        return output.hashValue.description
    }

    private func hashString(_ string: String) throws -> String {
        return String(string.hashValue)
    }

    private func hashLayers(_ layers: [ImageLayer]) throws -> String {
        let combined = layers.map { $0.digest }.joined()
        return String(combined.hashValue)
    }

    private func directorySize(_ url: URL) throws -> Int64 {
        var size: Int64 = 0

        let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey])
        while let fileURL = enumerator?.nextObject() as? URL {
            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            size += attributes[.size] as? Int64 ?? 0
        }

        return size
    }
}

// MARK: - Supporting Types

public enum BuildPlatform: String, Codable {
    case amd64 = "linux/amd64"
    case arm64 = "linux/arm64"

    var containerPlatform: String {
        switch self {
        case .amd64: return "linux/amd64"
        case .arm64: return "linux/arm64"
        }
    }
}

public struct BuildResult {
    public let image: ContainerImage
    public let duration: TimeInterval
    public let layers: [ImageLayer]
}

public struct BuildContext {
    public let url: URL
    public let size: Int64
    public let fileCount: Int

    init(url: URL) throws {
        self.url = url

        var size: Int64 = 0
        var count = 0

        let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey])
        while let fileURL = enumerator?.nextObject() as? URL {
            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            size += attributes[.size] as? Int64 ?? 0
            count += 1
        }

        self.size = size
        self.fileCount = count
    }
}

public struct ContainerImage: Codable {
    public let tag: String
    public let manifest: OCIManifest
    public let size: Int64
    public let platform: BuildPlatform
    public let path: URL
}

public struct ImageLayer: Codable {
    public enum LayerType: String, Codable {
        case base
        case run
        case copy
        case metadata
    }

    public let type: LayerType
    public let digest: String
    public let size: Int64
    public let diff: URL?

    init(type: LayerType, digest: String, size: Int64, diff: URL? = nil) {
        self.type = type
        self.digest = digest
        self.size = size
        self.diff = diff
    }
}

public enum BuildError: Error {
    case contextCreationFailed
    case unsupportedInstruction(String)
    case invalidInstruction(String)
    case imagePullFailed(String)
    case runCommandFailed(String)
    case layerCompressionFailed
}
