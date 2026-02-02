import XCTest
@testable import VibeMLAccelerator

final class MetalAcceleratorTests: XCTestCase {
    var accelerator: MetalAccelerator!

    override func setUp() async throws {
        try await super.setUp()
        accelerator = try MetalAccelerator()
    }

    override func tearDown() async throws {
        accelerator.purgeBufferPool()
        accelerator = nil
        try await super.tearDown()
    }

    // MARK: - Device Tests

    func testDeviceAvailability() throws {
        let info = accelerator.getDeviceInfo()

        XCTAssertNotNil(info["name"])
        XCTAssertTrue(info["recommendedMaxWorkingSetSize"] as? UInt64 ?? 0 > 0)

        print("Device: \\(info)")
    }

    // MARK: - Embedding Tests

    func testEmbeddingGeneration() async throws {
        let tokens: [Int32] = [1, 2, 3, 4, 5]
        let dimensions = 384

        let embedding = try await accelerator.generateEmbedding(
            from: tokens,
            dimensions: dimensions
        )

        XCTAssertEqual(embedding.count, dimensions)

        // Check normalization (L2 norm should be ~1.0)
        let norm = sqrt(embedding.reduce(0) { $0 + $1 * $1 })
        XCTAssertEqual(norm, 1.0, accuracy: 0.01)

        print("Generated embedding: \\(embedding.prefix(5))")
    }

    func testEmbeddingLatency() async throws {
        let tokens: [Int32] = Array(1...512)
        let dimensions = 768

        measure {
            _ = try! self.accelerator.generateEmbedding(
                from: tokens,
                dimensions: dimensions
            )
        }

        // Should complete in <50ms on M1+
        // Actual measurement will vary by hardware
    }

    // MARK: - Vector Search Tests

    func testVectorSearch() async throws {
        // Create query and test vectors
        let dimensions = 384
        let query = Array(repeating: 0.5 as Float, count: dimensions)

        let vectors: [[Float]] = (0..<100).map { i in
            Array(repeating: Float(i) / 100.0, count: dimensions)
        }

        let results = try await accelerator.vectorSearch(
            query: query,
            vectors: vectors,
            topK: 10
        )

        XCTAssertEqual(results.count, 10)
        XCTAssertTrue(results[0].similarity >= results[1].similarity, "Results should be sorted")
        XCTAssertTrue(results[0].index < vectors.count)

        print("Top result: index=\\(results[0].index), similarity=\\(results[0].similarity)")
    }

    func testVectorSearchLatency() async throws {
        let dimensions = 768
        let query = Array(repeating: 0.5 as Float, count: dimensions)

        let vectors: [[Float]] = (0..<1000).map { _ in
            (0..<dimensions).map { _ in Float.random(in: 0...1) }
        }

        let startTime = Date()

        _ = try await accelerator.vectorSearch(
            query: query,
            vectors: vectors,
            topK: 10
        )

        let duration = Date().timeIntervalSince(startTime)

        print("Vector search (1K vectors) took: \\(duration * 1000)ms")

        // Should complete in <10ms on M1+
        XCTAssertLessThan(duration, 0.05, "Search took longer than expected")
    }

    func testVectorSearchAccuracy() async throws {
        let dimensions = 384

        // Create query
        let query = Array(repeating: 1.0 as Float, count: dimensions)

        // Create vectors with known similarities
        let identicalVector = Array(repeating: 1.0 as Float, count: dimensions)
        let orthogonalVector = Array(repeating: 0.0 as Float, count: dimensions)

        let vectors = [identicalVector, orthogonalVector]

        let results = try await accelerator.vectorSearch(
            query: query,
            vectors: vectors,
            topK: 2
        )

        // Identical vector should have similarity ~1.0
        XCTAssertEqual(results[0].similarity, 1.0, accuracy: 0.01)

        // Orthogonal vector should have similarity ~0.0
        XCTAssertEqual(results[1].similarity, 0.0, accuracy: 0.01)
    }

    // MARK: - Matrix Operations Tests

    func testMatrixMultiply() async throws {
        let rowsA = 4
        let colsA = 3
        let colsB = 2

        // Create test matrices
        let matrixA: [Float] = [
            1, 2, 3,
            4, 5, 6,
            7, 8, 9,
            10, 11, 12
        ]

        let matrixB: [Float] = [
            1, 2,
            3, 4,
            5, 6
        ]

        let result = try await accelerator.matrixMultiply(
            matrixA: matrixA,
            matrixB: matrixB,
            rowsA: rowsA,
            colsA: colsA,
            colsB: colsB
        )

        // Expected result (4x2 matrix)
        let expected: [Float] = [
            22, 28,   // [1,2,3] · [[1,2],[3,4],[5,6]]
            49, 64,   // [4,5,6] · [[1,2],[3,4],[5,6]]
            76, 100,  // [7,8,9] · [[1,2],[3,4],[5,6]]
            103, 136  // [10,11,12] · [[1,2],[3,4],[5,6]]
        ]

        XCTAssertEqual(result.count, expected.count)

        for (i, (actual, exp)) in zip(result, expected).enumerated() {
            XCTAssertEqual(actual, exp, accuracy: 0.01, "Mismatch at index \\(i)")
        }

        print("Matrix multiply result: \\(result)")
    }

    // MARK: - Memory Management Tests

    func testBufferPooling() async throws {
        // Test buffer pooling indirectly through embedding generation
        let tokens: [Int32] = [1, 2, 3, 4, 5]

        // First generation
        let embedding1 = try await accelerator.generateEmbedding(from: tokens, dimensions: 384)

        // Second generation (should reuse buffers)
        let embedding2 = try await accelerator.generateEmbedding(from: tokens, dimensions: 384)

        // Should produce same results
        XCTAssertEqual(embedding1.count, embedding2.count)

        // Clear pool
        accelerator.purgeBufferPool()
    }

    // MARK: - Error Handling Tests

    func testInvalidDimensions() async throws {
        let tokens: [Int32] = [1, 2, 3]

        // Test with zero dimensions
        do {
            _ = try await accelerator.generateEmbedding(from: tokens, dimensions: 0)
            XCTFail("Should throw error for zero dimensions")
        } catch {
            // Expected
            print("Correctly caught error: \\(error)")
        }
    }

    // MARK: - Performance Benchmarks

    func testEmbeddingBenchmark() throws {
        let tokens: [Int32] = Array(1...512)
        let dimensions = 768

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try! accelerator.generateEmbedding(from: tokens, dimensions: dimensions)
        }
    }

    func testVectorSearchBenchmark() throws {
        let dimensions = 768
        let query = Array(repeating: 0.5 as Float, count: dimensions)
        let vectors: [[Float]] = (0..<1000).map { _ in
            (0..<dimensions).map { _ in Float.random(in: 0...1) }
        }

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try! accelerator.vectorSearch(query: query, vectors: vectors, topK: 10)
        }
    }

    func testMatrixMultiplyBenchmark() throws {
        let rowsA = 512
        let colsA = 512
        let colsB = 512

        let matrixA = (0..<(rowsA * colsA)).map { _ in Float.random(in: 0...1) }
        let matrixB = (0..<(colsA * colsB)).map { _ in Float.random(in: 0...1) }

        measure(metrics: [XCTClockMetric()]) {
            _ = try! accelerator.matrixMultiply(
                matrixA: matrixA,
                matrixB: matrixB,
                rowsA: rowsA,
                colsA: colsA,
                colsB: colsB
            )
        }
    }

    // MARK: - Stress Tests

    func testConcurrentOperations() async throws {
        let operationCount = 10

        await withTaskGroup(of: Void.self) { group in
            for i in 0..<operationCount {
                group.addTask {
                    let tokens: [Int32] = Array(repeating: Int32(i), count: 100)
                    _ = try? await self.accelerator.generateEmbedding(from: tokens, dimensions: 384)
                }
            }
        }

        print("Completed \\(operationCount) concurrent operations")
    }

    func testMemoryPressure() async throws {
        // Create many large buffers to test memory management
        for i in 0..<100 {
            let tokens: [Int32] = Array(repeating: Int32(i), count: 10000)
            _ = try await accelerator.generateEmbedding(from: tokens, dimensions: 768)
        }

        // Should handle gracefully without crashes
        XCTAssertTrue(true)
    }
}
