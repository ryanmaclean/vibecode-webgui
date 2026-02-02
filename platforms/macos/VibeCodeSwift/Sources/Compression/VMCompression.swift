import Foundation
import Compression

// MARK: - ZSTD Availability
// COMPRESSION_ZSTD (value 5) requires macOS 12.0+ SDK
// Use conditional compilation to handle older SDKs
#if compiler(>=5.5) && canImport(Compression)
    private let compressionZstd: compression_algorithm = {
        if #available(macOS 12.0, iOS 15.0, *) {
            // ZSTD algorithm value is 5 in the Compression framework
            return compression_algorithm(rawValue: 5)
        }
        return COMPRESSION_LZFSE
    }()
#else
    private let compressionZstd = COMPRESSION_LZFSE
#endif

/// Compression algorithms supported for VM operations
/// Issue #964: Add zstd compression for VM disk images
/// Note: ZSTD requires macOS 12.0+, falls back to LZFSE on older systems
public enum CompressionAlgorithm: Sendable {
    case zstd       // Best ratio, fast decompression (macOS 12.0+)
    case lzfse      // Apple native, good balance
    case lz4        // Fastest, lower ratio
    case zlib       // Wide compatibility

    var algorithm: compression_algorithm {
        switch self {
        case .zstd:  return compressionZstd
        case .lzfse: return COMPRESSION_LZFSE
        case .lz4:   return COMPRESSION_LZ4
        case .zlib:  return COMPRESSION_ZLIB
        }
    }

    /// Check if ZSTD is available on this system
    public static var isZstdAvailable: Bool {
        if #available(macOS 12.0, iOS 15.0, *) {
            return true
        }
        return false
    }
}

/// Compression errors
public enum CompressionError: LocalizedError {
    case compressionFailed
    case decompressionFailed
    case insufficientBuffer
    case invalidData

    public var errorDescription: String? {
        switch self {
        case .compressionFailed:
            return "Failed to compress data"
        case .decompressionFailed:
            return "Failed to decompress data"
        case .insufficientBuffer:
            return "Insufficient buffer size for operation"
        case .invalidData:
            return "Invalid or corrupted compressed data"
        }
    }
}

/// High-performance compression utilities for VM operations
/// Optimized for Apple M-series unified memory architecture
public struct VMCompression {

    /// Default algorithm for VM disk images (best compression)
    public static let defaultAlgorithm: CompressionAlgorithm = .zstd

    /// Compress data using specified algorithm
    /// - Parameters:
    ///   - data: Source data to compress
    ///   - algorithm: Compression algorithm to use
    /// - Returns: Compressed data
    public static func compress(
        _ data: Data,
        algorithm: CompressionAlgorithm = .zstd
    ) throws -> Data {
        guard !data.isEmpty else { return Data() }

        // Allocate destination buffer (worst case: slightly larger than source)
        let destinationCapacity = data.count + 64
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: destinationCapacity)
        defer { destinationBuffer.deallocate() }

        let compressedSize = data.withUnsafeBytes { sourceBuffer in
            compression_encode_buffer(
                destinationBuffer,
                destinationCapacity,
                sourceBuffer.baseAddress!.assumingMemoryBound(to: UInt8.self),
                data.count,
                nil,
                algorithm.algorithm
            )
        }

        guard compressedSize > 0 else {
            throw CompressionError.compressionFailed
        }

        return Data(bytes: destinationBuffer, count: compressedSize)
    }

    /// Decompress data using specified algorithm
    /// - Parameters:
    ///   - data: Compressed data
    ///   - algorithm: Algorithm used for compression
    ///   - expectedSize: Expected decompressed size (optional, improves performance)
    /// - Returns: Decompressed data
    public static func decompress(
        _ data: Data,
        algorithm: CompressionAlgorithm = .zstd,
        expectedSize: Int? = nil
    ) throws -> Data {
        guard !data.isEmpty else { return Data() }

        // Use expected size or estimate (4x compression ratio typical)
        let destinationCapacity = expectedSize ?? (data.count * 4)
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: destinationCapacity)
        defer { destinationBuffer.deallocate() }

        let decompressedSize = data.withUnsafeBytes { sourceBuffer in
            compression_decode_buffer(
                destinationBuffer,
                destinationCapacity,
                sourceBuffer.baseAddress!.assumingMemoryBound(to: UInt8.self),
                data.count,
                nil,
                algorithm.algorithm
            )
        }

        guard decompressedSize > 0 else {
            throw CompressionError.decompressionFailed
        }

        return Data(bytes: destinationBuffer, count: decompressedSize)
    }

    /// Compress file at path
    /// - Parameters:
    ///   - source: Source file URL
    ///   - destination: Destination file URL for compressed output
    ///   - algorithm: Compression algorithm
    public static func compressFile(
        at source: URL,
        to destination: URL,
        algorithm: CompressionAlgorithm = .zstd
    ) throws {
        let sourceData = try Data(contentsOf: source)
        let compressedData = try compress(sourceData, algorithm: algorithm)
        try compressedData.write(to: destination)
    }

    /// Decompress file at path
    /// - Parameters:
    ///   - source: Compressed file URL
    ///   - destination: Destination file URL for decompressed output
    ///   - algorithm: Algorithm used for compression
    public static func decompressFile(
        at source: URL,
        to destination: URL,
        algorithm: CompressionAlgorithm = .zstd
    ) throws {
        let compressedData = try Data(contentsOf: source)
        let decompressedData = try decompress(compressedData, algorithm: algorithm)
        try decompressedData.write(to: destination)
    }
}

/// Streaming compression for large files (>100MB)
/// Uses chunked processing to minimize memory footprint
public class StreamingCompressor {

    /// Default chunk size (1MB)
    public static let defaultChunkSize = 1024 * 1024

    private let algorithm: CompressionAlgorithm
    private let chunkSize: Int

    public init(algorithm: CompressionAlgorithm = .zstd, chunkSize: Int = defaultChunkSize) {
        self.algorithm = algorithm
        self.chunkSize = chunkSize
    }

    /// Compress large file using streaming
    /// - Parameters:
    ///   - source: Source file URL
    ///   - destination: Destination file URL
    ///   - progress: Progress callback (0.0 to 1.0)
    public func compress(
        source: URL,
        destination: URL,
        progress: ((Double) -> Void)? = nil
    ) throws {
        let sourceHandle = try FileHandle(forReadingFrom: source)
        defer { try? sourceHandle.close() }

        let attrs = try FileManager.default.attributesOfItem(atPath: source.path)
        let totalSize = attrs[.size] as? Int64 ?? 0

        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let destHandle = try FileHandle(forWritingTo: destination)
        defer { try? destHandle.close() }

        var processedBytes: Int64 = 0

        while let chunk = try sourceHandle.read(upToCount: chunkSize), !chunk.isEmpty {
            let compressed = try VMCompression.compress(chunk, algorithm: algorithm)

            // Write size header (4 bytes) + compressed chunk
            var size = UInt32(compressed.count)
            let sizeData = Data(bytes: &size, count: 4)
            try destHandle.write(contentsOf: sizeData)
            try destHandle.write(contentsOf: compressed)

            processedBytes += Int64(chunk.count)
            progress?(Double(processedBytes) / Double(totalSize))
        }
    }

    /// Decompress large file using streaming
    /// - Parameters:
    ///   - source: Compressed file URL
    ///   - destination: Destination file URL
    ///   - progress: Progress callback (0.0 to 1.0)
    public func decompress(
        source: URL,
        destination: URL,
        progress: ((Double) -> Void)? = nil
    ) throws {
        let sourceHandle = try FileHandle(forReadingFrom: source)
        defer { try? sourceHandle.close() }

        let attrs = try FileManager.default.attributesOfItem(atPath: source.path)
        let totalSize = attrs[.size] as? Int64 ?? 0

        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let destHandle = try FileHandle(forWritingTo: destination)
        defer { try? destHandle.close() }

        var processedBytes: Int64 = 0

        while let sizeData = try sourceHandle.read(upToCount: 4), sizeData.count == 4 {
            let size = sizeData.withUnsafeBytes { $0.load(as: UInt32.self) }

            guard let chunk = try sourceHandle.read(upToCount: Int(size)) else {
                throw CompressionError.invalidData
            }

            let decompressed = try VMCompression.decompress(chunk, algorithm: algorithm)
            try destHandle.write(contentsOf: decompressed)

            processedBytes += Int64(4 + size)
            progress?(Double(processedBytes) / Double(totalSize))
        }
    }
}
