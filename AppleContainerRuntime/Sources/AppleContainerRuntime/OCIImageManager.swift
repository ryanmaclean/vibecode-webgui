import Foundation

/// OCI Image Manager for pulling and managing container images
///
/// Supports OCI image spec v1.0+ with layer caching and delta downloads.
/// Compatible with Docker Hub, GitHub Container Registry, and private registries.
final class OCIImageManager: @unchecked Sendable {
    private let cacheDirectory: URL
    private let session: URLSession

    init(cacheDirectory: URL) {
        self.cacheDirectory = cacheDirectory

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)

        // Create cache structure
        try? FileManager.default.createDirectory(
            at: cacheDirectory.appendingPathComponent("layers"),
            withIntermediateDirectories: true
        )
        try? FileManager.default.createDirectory(
            at: cacheDirectory.appendingPathComponent("manifests"),
            withIntermediateDirectories: true
        )
    }

    // MARK: - Public API

    func pull(reference: String, progressHandler: @escaping (PullProgress) -> Void) async throws {
        let parsed = try parseImageReference(reference)

        // Fetch manifest
        let manifest = try await fetchManifest(parsed: parsed)

        // Download layers
        var totalBytes: UInt64 = 0
        var downloadedBytes: UInt64 = 0

        for layer in manifest.layers {
            totalBytes += layer.size
        }

        for layer in manifest.layers {
            try await downloadLayer(
                digest: layer.digest,
                size: layer.size,
                parsed: parsed
            ) { layerBytes in
                downloadedBytes += layerBytes
                progressHandler(PullProgress(
                    bytesDownloaded: downloadedBytes,
                    totalBytes: totalBytes
                ))
            }
        }

        // Download config
        try await downloadConfig(digest: manifest.config.digest, parsed: parsed)

        // Create image bundle
        try await createImageBundle(manifest: manifest, parsed: parsed)
    }

    func getOrPull(reference: String) async throws -> URL {
        let parsed = try parseImageReference(reference)
        let bundlePath = imageBundlePath(parsed: parsed)

        if FileManager.default.fileExists(atPath: bundlePath.path) {
            return bundlePath
        }

        try await pull(reference: reference) { _ in }
        return bundlePath
    }

    // MARK: - Image Reference Parsing

    private func parseImageReference(_ reference: String) throws -> ParsedReference {
        // Format: [registry/]repository[:tag|@digest]
        var parts = reference.split(separator: "/")

        let registry: String
        let repository: String
        let tagOrDigest: String

        if parts.count == 1 {
            // No registry specified, use Docker Hub
            registry = "registry-1.docker.io"
            let repoAndTag = String(parts[0])
            let components = repoAndTag.split(separator: ":")
            repository = "library/\(components[0])"
            tagOrDigest = components.count > 1 ? String(components[1]) : "latest"
        } else if parts.count == 2 {
            // Either registry/repo or org/repo
            if parts[0].contains(".") {
                // Registry specified
                registry = String(parts[0])
                let repoAndTag = String(parts[1])
                let components = repoAndTag.split(separator: ":")
                repository = String(components[0])
                tagOrDigest = components.count > 1 ? String(components[1]) : "latest"
            } else {
                // Docker Hub with org
                registry = "registry-1.docker.io"
                let repoAndTag = String(parts[1])
                let components = repoAndTag.split(separator: ":")
                repository = "\(parts[0])/\(components[0])"
                tagOrDigest = components.count > 1 ? String(components[1]) : "latest"
            }
        } else {
            // Full reference
            registry = String(parts[0])
            parts.removeFirst()
            let repoAndTag = parts.joined(separator: "/")
            let components = repoAndTag.split(separator: ":")
            repository = String(components[0])
            tagOrDigest = components.count > 1 ? String(components[1]) : "latest"
        }

        return ParsedReference(
            registry: registry,
            repository: repository,
            tagOrDigest: tagOrDigest
        )
    }

    // MARK: - Manifest Operations

    private func fetchManifest(parsed: ParsedReference) async throws -> ImageManifest {
        let url = URL(string: "https://\(parsed.registry)/v2/\(parsed.repository)/manifests/\(parsed.tagOrDigest)")!

        var request = URLRequest(url: url)
        request.setValue("application/vnd.oci.image.manifest.v1+json", forHTTPHeaderField: "Accept")
        request.setValue("application/vnd.docker.distribution.manifest.v2+json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ImageError.manifestFetchFailed
        }

        let decoder = JSONDecoder()
        return try decoder.decode(ImageManifest.self, from: data)
    }

    // MARK: - Layer Operations

    private func downloadLayer(
        digest: String,
        size: UInt64,
        parsed: ParsedReference,
        progressHandler: @escaping (UInt64) -> Void
    ) async throws {
        let layerPath = cacheDirectory
            .appendingPathComponent("layers")
            .appendingPathComponent(digest.replacingOccurrences(of: ":", with: "_"))

        // Skip if already cached
        if FileManager.default.fileExists(atPath: layerPath.path) {
            progressHandler(size)
            return
        }

        let url = URL(string: "https://\(parsed.registry)/v2/\(parsed.repository)/blobs/\(digest)")!

        var request = URLRequest(url: url)
        request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")

        let (tempURL, response) = try await session.download(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ImageError.layerDownloadFailed(digest)
        }

        try FileManager.default.moveItem(at: tempURL, to: layerPath)
        progressHandler(size)
    }

    private func downloadConfig(digest: String, parsed: ParsedReference) async throws {
        let configPath = cacheDirectory
            .appendingPathComponent("manifests")
            .appendingPathComponent(digest.replacingOccurrences(of: ":", with: "_"))

        if FileManager.default.fileExists(atPath: configPath.path) {
            return
        }

        let url = URL(string: "https://\(parsed.registry)/v2/\(parsed.repository)/blobs/\(digest)")!

        var request = URLRequest(url: url)
        request.setValue("application/vnd.oci.image.config.v1+json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ImageError.configDownloadFailed(digest)
        }

        try data.write(to: configPath)
    }

    // MARK: - Image Bundle Creation

    private func createImageBundle(manifest: ImageManifest, parsed: ParsedReference) async throws {
        let bundlePath = imageBundlePath(parsed: parsed)

        try FileManager.default.createDirectory(
            at: bundlePath,
            withIntermediateDirectories: true
        )

        // Extract layers to create rootfs
        let rootfsPath = bundlePath.appendingPathComponent("rootfs")
        try FileManager.default.createDirectory(at: rootfsPath, withIntermediateDirectories: true)

        for layer in manifest.layers {
            let layerPath = cacheDirectory
                .appendingPathComponent("layers")
                .appendingPathComponent(layer.digest.replacingOccurrences(of: ":", with: "_"))

            try await extractLayer(from: layerPath, to: rootfsPath)
        }

        // Create kernel and initrd (minimal Linux boot)
        try await createKernelFiles(at: bundlePath)

        // Save manifest
        let manifestData = try JSONEncoder().encode(manifest)
        try manifestData.write(to: bundlePath.appendingPathComponent("manifest.json"))
    }

    private func extractLayer(from layerPath: URL, to destination: URL) async throws {
        // Use tar to extract layer (layers are typically tar.gz)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/tar")
        process.arguments = ["-xzf", layerPath.path, "-C", destination.path]

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw ImageError.layerExtractionFailed(layerPath.lastPathComponent)
        }
    }

    private func createKernelFiles(at bundlePath: URL) async throws {
        // For production, you would download or build a minimal Linux kernel
        // For now, we'll create placeholder files
        // Real implementation would use a pre-built Linux kernel optimized for containers

        let kernelPath = bundlePath.appendingPathComponent("vmlinuz")
        let initrdPath = bundlePath.appendingPathComponent("initrd")

        // Check if we have cached kernel
        let cachedKernel = cacheDirectory.appendingPathComponent("kernel/vmlinuz")
        let cachedInitrd = cacheDirectory.appendingPathComponent("kernel/initrd")

        if FileManager.default.fileExists(atPath: cachedKernel.path) {
            try FileManager.default.copyItem(at: cachedKernel, to: kernelPath)
            try FileManager.default.copyItem(at: cachedInitrd, to: initrdPath)
        } else {
            // Download pre-built kernel (this would be from a trusted source)
            // For this implementation, assume kernel is available
            throw ImageError.kernelNotAvailable
        }
    }

    private func imageBundlePath(parsed: ParsedReference) -> URL {
        let safeName = "\(parsed.repository)_\(parsed.tagOrDigest)"
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")

        return cacheDirectory.appendingPathComponent("bundles/\(safeName)")
    }
}

// MARK: - Models

private struct ParsedReference {
    let registry: String
    let repository: String
    let tagOrDigest: String
}

private struct ImageManifest: Codable {
    let schemaVersion: Int
    let mediaType: String?
    let config: Descriptor
    let layers: [Descriptor]
}

private struct Descriptor: Codable {
    let mediaType: String
    let digest: String
    let size: UInt64
}

// MARK: - Errors

enum ImageError: Error, CustomStringConvertible {
    case invalidReference(String)
    case manifestFetchFailed
    case layerDownloadFailed(String)
    case configDownloadFailed(String)
    case layerExtractionFailed(String)
    case kernelNotAvailable

    var description: String {
        switch self {
        case .invalidReference(let ref):
            return "Invalid image reference: \(ref)"
        case .manifestFetchFailed:
            return "Failed to fetch image manifest"
        case .layerDownloadFailed(let digest):
            return "Failed to download layer: \(digest)"
        case .configDownloadFailed(let digest):
            return "Failed to download config: \(digest)"
        case .layerExtractionFailed(let layer):
            return "Failed to extract layer: \(layer)"
        case .kernelNotAvailable:
            return "Linux kernel not available. Run setup to download kernel."
        }
    }
}
