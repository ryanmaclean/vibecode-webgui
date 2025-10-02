import Foundation
import Metal
import MetalPerformanceShaders

/// High-performance Metal-based acceleration for ML operations
public class MetalAccelerator {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let library: MTLLibrary

    // Kernel pipelines
    private var embeddingPipeline: MTLComputePipelineState?
    private var vectorSearchPipeline: MTLComputePipelineState?
    private var matrixMultiplyPipeline: MTLComputePipelineState?

    // Buffer pool for memory reuse
    private var bufferPool: [String: MTLBuffer] = [:]
    private let poolLock = NSLock()

    public init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw MLAcceleratorError.hardwareUnavailable("Metal device not available")
        }

        self.device = device

        guard let commandQueue = device.makeCommandQueue() else {
            throw MLAcceleratorError.hardwareUnavailable("Failed to create command queue")
        }

        self.commandQueue = commandQueue

        // Load Metal shaders
        // Note: In production, load from bundle. For now, create library from default sources.
        guard let library = device.makeDefaultLibrary() else {
            throw MLAcceleratorError.hardwareUnavailable("Failed to load Metal library")
        }

        self.library = library

        try initializePipelines()
    }

    private func initializePipelines() throws {
        // Embedding generation pipeline
        if let embeddingFunction = library.makeFunction(name: "generate_embedding") {
            self.embeddingPipeline = try device.makeComputePipelineState(function: embeddingFunction)
        }

        // Vector search pipeline
        if let searchFunction = library.makeFunction(name: "cosine_similarity_batch") {
            self.vectorSearchPipeline = try device.makeComputePipelineState(function: searchFunction)
        }

        // Matrix multiplication pipeline
        if let matmulFunction = library.makeFunction(name: "matrix_multiply") {
            self.matrixMultiplyPipeline = try device.makeComputePipelineState(function: matmulFunction)
        }
    }

    // MARK: - Embedding Generation

    /// Generate embeddings using Metal GPU acceleration
    public func generateEmbedding(from tokens: [Int32], dimensions: Int) async throws -> [Float] {
        guard let pipeline = embeddingPipeline else {
            throw MLAcceleratorError.hardwareUnavailable("Embedding pipeline not initialized")
        }

        let startTime = Date()

        // Prepare input buffer
        let tokensBuffer = getOrCreateBuffer(
            name: "tokens_\(tokens.count)",
            data: tokens.withUnsafeBytes { Data($0) },
            options: .storageModeShared
        )

        // Prepare output buffer
        let embeddingSize = dimensions * MemoryLayout<Float>.stride
        let embeddingBuffer = getOrCreateBuffer(
            name: "embedding_\(dimensions)",
            length: embeddingSize,
            options: .storageModeShared
        )

        // Create command buffer
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeComputeCommandEncoder() else {
            throw MLAcceleratorError.hardwareUnavailable("Failed to create command encoder")
        }

        encoder.setComputePipelineState(pipeline)
        encoder.setBuffer(tokensBuffer, offset: 0, index: 0)
        encoder.setBuffer(embeddingBuffer, offset: 0, index: 1)

        // Set parameters
        var tokenCount = UInt32(tokens.count)
        var embeddingDim = UInt32(dimensions)
        encoder.setBytes(&tokenCount, length: MemoryLayout<UInt32>.stride, index: 2)
        encoder.setBytes(&embeddingDim, length: MemoryLayout<UInt32>.stride, index: 3)

        // Dispatch threads
        let threadsPerGrid = MTLSize(width: dimensions, height: 1, depth: 1)
        let threadsPerThreadgroup = MTLSize(
            width: min(pipeline.maxTotalThreadsPerThreadgroup, dimensions),
            height: 1,
            depth: 1
        )

        encoder.dispatchThreads(threadsPerGrid, threadsPerThreadgroup: threadsPerThreadgroup)
        encoder.endEncoding()

        // Execute and wait
        commandBuffer.commit()
        await commandBuffer.waitUntilCompleted()

        // Extract results
        let resultPointer = embeddingBuffer.contents().bindMemory(to: Float.self, capacity: dimensions)
        let embedding = Array(UnsafeBufferPointer(start: resultPointer, count: dimensions))

        let duration = Date().timeIntervalSince(startTime)
        print("[MetalAccelerator] Generated \(dimensions)d embedding in \(duration * 1000)ms")

        return embedding
    }

    // MARK: - Vector Search

    /// Perform GPU-accelerated cosine similarity search
    public func vectorSearch(
        query: [Float],
        vectors: [[Float]],
        topK: Int
    ) async throws -> [SearchResult] {
        guard let pipeline = vectorSearchPipeline else {
            throw MLAcceleratorError.hardwareUnavailable("Vector search pipeline not initialized")
        }

        let startTime = Date()
        let dimensions = query.count
        let vectorCount = vectors.count

        // Flatten vectors for GPU processing
        let flatVectors = vectors.flatMap { $0 }

        // Create buffers
        let queryBuffer = getOrCreateBuffer(
            name: "query_\(dimensions)",
            data: query.withUnsafeBytes { Data($0) },
            options: .storageModeShared
        )

        let vectorsBuffer = getOrCreateBuffer(
            name: "vectors_\(vectorCount)x\(dimensions)",
            data: flatVectors.withUnsafeBytes { Data($0) },
            options: .storageModeShared
        )

        let similaritiesBuffer = getOrCreateBuffer(
            name: "similarities_\(vectorCount)",
            length: vectorCount * MemoryLayout<Float>.stride,
            options: .storageModeShared
        )

        // Create command
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeComputeCommandEncoder() else {
            throw MLAcceleratorError.hardwareUnavailable("Failed to create command encoder")
        }

        encoder.setComputePipelineState(pipeline)
        encoder.setBuffer(queryBuffer, offset: 0, index: 0)
        encoder.setBuffer(vectorsBuffer, offset: 0, index: 1)
        encoder.setBuffer(similaritiesBuffer, offset: 0, index: 2)

        var count = UInt32(vectorCount)
        var dim = UInt32(dimensions)
        encoder.setBytes(&count, length: MemoryLayout<UInt32>.stride, index: 3)
        encoder.setBytes(&dim, length: MemoryLayout<UInt32>.stride, index: 4)

        // Dispatch
        let threadsPerGrid = MTLSize(width: vectorCount, height: 1, depth: 1)
        let threadsPerThreadgroup = MTLSize(
            width: min(pipeline.maxTotalThreadsPerThreadgroup, vectorCount),
            height: 1,
            depth: 1
        )

        encoder.dispatchThreads(threadsPerGrid, threadsPerThreadgroup: threadsPerThreadgroup)
        encoder.endEncoding()

        commandBuffer.commit()
        await commandBuffer.waitUntilCompleted()

        // Extract and sort results
        let similaritiesPointer = similaritiesBuffer.contents().bindMemory(to: Float.self, capacity: vectorCount)
        let similarities = Array(UnsafeBufferPointer(start: similaritiesPointer, count: vectorCount))

        let indexedResults = similarities.enumerated().map { (index, similarity) in
            SearchResult(index: index, similarity: similarity)
        }

        let topResults = indexedResults
            .sorted { $0.similarity > $1.similarity }
            .prefix(topK)

        let duration = Date().timeIntervalSince(startTime)
        print("[MetalAccelerator] Searched \(vectorCount) vectors in \(duration * 1000)ms")

        return Array(topResults)
    }

    // MARK: - Matrix Operations

    /// GPU-accelerated matrix multiplication
    public func matrixMultiply(
        matrixA: [Float],
        matrixB: [Float],
        rowsA: Int,
        colsA: Int,
        colsB: Int
    ) async throws -> [Float] {
        // Use Metal Performance Shaders for optimized GEMM
        let mpsMatrixA = MPSMatrix(
            device: device,
            descriptor: MPSMatrixDescriptor(
                rows: rowsA,
                columns: colsA,
                rowBytes: colsA * MemoryLayout<Float>.stride,
                dataType: .float32
            )
        )

        let mpsMatrixB = MPSMatrix(
            device: device,
            descriptor: MPSMatrixDescriptor(
                rows: colsA,
                columns: colsB,
                rowBytes: colsB * MemoryLayout<Float>.stride,
                dataType: .float32
            )
        )

        let mpsMatrixC = MPSMatrix(
            device: device,
            descriptor: MPSMatrixDescriptor(
                rows: rowsA,
                columns: colsB,
                rowBytes: colsB * MemoryLayout<Float>.stride,
                dataType: .float32
            )
        )

        // Copy data
        memcpy(mpsMatrixA.data.contents(), matrixA, matrixA.count * MemoryLayout<Float>.stride)
        memcpy(mpsMatrixB.data.contents(), matrixB, matrixB.count * MemoryLayout<Float>.stride)

        // Perform multiplication
        let matrixMultiplication = MPSMatrixMultiplication(
            device: device,
            transposeLeft: false,
            transposeRight: false,
            resultRows: rowsA,
            resultColumns: colsB,
            interiorColumns: colsA,
            alpha: 1.0,
            beta: 0.0
        )

        guard let commandBuffer = commandQueue.makeCommandBuffer() else {
            throw MLAcceleratorError.hardwareUnavailable("Failed to create command buffer")
        }

        matrixMultiplication.encode(
            commandBuffer: commandBuffer,
            leftMatrix: mpsMatrixA,
            rightMatrix: mpsMatrixB,
            resultMatrix: mpsMatrixC
        )

        commandBuffer.commit()
        await commandBuffer.waitUntilCompleted()

        // Extract result
        let resultPointer = mpsMatrixC.data.contents().bindMemory(to: Float.self, capacity: rowsA * colsB)
        return Array(UnsafeBufferPointer(start: resultPointer, count: rowsA * colsB))
    }

    // MARK: - Buffer Management

    private func getOrCreateBuffer(
        name: String,
        data: Data,
        options: MTLResourceOptions
    ) -> MTLBuffer {
        poolLock.lock()
        defer { poolLock.unlock() }

        if let cached = bufferPool[name], cached.length == data.count {
            // Reuse existing buffer
            memcpy(cached.contents(), (data as NSData).bytes, data.count)
            return cached
        }

        // Create new buffer
        guard let buffer = device.makeBuffer(bytes: (data as NSData).bytes, length: data.count, options: options) else {
            fatalError("Failed to create Metal buffer")
        }

        buffer.label = name
        bufferPool[name] = buffer

        return buffer
    }

    private func getOrCreateBuffer(
        name: String,
        length: Int,
        options: MTLResourceOptions
    ) -> MTLBuffer {
        poolLock.lock()
        defer { poolLock.unlock() }

        if let cached = bufferPool[name], cached.length == length {
            return cached
        }

        guard let buffer = device.makeBuffer(length: length, options: options) else {
            fatalError("Failed to create Metal buffer")
        }

        buffer.label = name
        bufferPool[name] = buffer

        return buffer
    }

    /// Clear buffer pool to free memory
    public func purgeBufferPool() {
        poolLock.lock()
        defer { poolLock.unlock() }

        bufferPool.removeAll()
        print("[MetalAccelerator] Buffer pool purged")
    }

    // MARK: - Device Information

    public func getDeviceInfo() -> [String: Any] {
        return [
            "name": device.name,
            "supportsFamily": [
                "apple8": device.supportsFamily(.apple8),
                "apple7": device.supportsFamily(.apple7),
            ],
            "recommendedMaxWorkingSetSize": device.recommendedMaxWorkingSetSize,
            "maxThreadsPerThreadgroup": device.maxThreadsPerThreadgroup,
            "registryID": device.registryID,
        ]
    }
}
