import Foundation
import CoreML
import NaturalLanguage
import os.log

/// High-performance Core ML inference engine for LLMs and embeddings
public actor CoreMLInferenceEngine {
    private let modelManager: ModelManager
    private let metalAccelerator: MetalAccelerator
    private let tokenizer: SimpleTokenizer
    private let logger = Logger(subsystem: "com.vibecode.ml", category: "CoreMLEngine")

    private var activeInferences: [UUID: Task<Void, Error>] = [:]

    public init(config: MLAcceleratorConfig) throws {
        self.modelManager = ModelManager(config: config)
        self.metalAccelerator = try MetalAccelerator()
        self.tokenizer = SimpleTokenizer()
    }

    // MARK: - Text Generation

    /// Generate text with streaming support
    public func generateText(
        prompt: String,
        modelName: String = "mistral-7b-int8",
        options: InferenceOptions = InferenceOptions()
    ) -> AsyncThrowingStream<String, Error> {
        let inferenceId = UUID()

        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    logger.info("Starting inference: \(inferenceId) with model: \(modelName)")
                    let startTime = Date()

                    // Load model
                    let model = try await modelManager.loadModel(name: modelName)

                    // Tokenize input
                    let tokens = tokenizer.encode(prompt)
                    logger.debug("Tokenized \(tokens.count) tokens")

                    var generatedTokens: [Int32] = []
                    var firstTokenTime: TimeInterval?

                    // Generate tokens
                    for tokenIndex in 0..<options.maxTokens {
                        // Check for cancellation
                        try Task.checkCancellation()

                        // Prepare input
                        let inputTokens = tokens + generatedTokens
                        let input = try createMLInput(tokens: inputTokens)

                        // Run inference
                        let output = try model.prediction(from: input)

                        // Extract logits
                        guard let logitsArray = output.featureValue(for: "logits")?.multiArrayValue else {
                            throw MLAcceleratorError.inferenceError("No logits in output")
                        }

                        // Sample next token
                        let nextToken = try sampleToken(
                            from: logitsArray,
                            temperature: options.temperature,
                            topP: options.topP,
                            topK: options.topK
                        )

                        // Record first token latency
                        if firstTokenTime == nil {
                            firstTokenTime = Date().timeIntervalSince(startTime)
                            logger.debug("First token latency: \(firstTokenTime! * 1000)ms")
                        }

                        // Decode token
                        let tokenText = tokenizer.decode([nextToken])

                        // Stream token
                        continuation.yield(tokenText)

                        generatedTokens.append(nextToken)

                        // Check for EOS
                        if nextToken == tokenizer.eosTokenId {
                            logger.debug("EOS token generated")
                            break
                        }
                    }

                    // Calculate metrics
                    let totalDuration = Date().timeIntervalSince(startTime)
                    let tokensPerSecond = Double(generatedTokens.count) / totalDuration

                    logger.info("""
                    Inference complete: \(inferenceId)
                    - Tokens: \(generatedTokens.count)
                    - Duration: \(totalDuration)s
                    - Tokens/sec: \(tokensPerSecond)
                    - First token: \(firstTokenTime ?? 0)ms
                    """)

                    continuation.finish()
                } catch is CancellationError {
                    logger.info("Inference cancelled: \(inferenceId)")
                    continuation.finish(throwing: CancellationError())
                } catch {
                    logger.error("Inference error: \(error.localizedDescription)")
                    continuation.finish(throwing: error)
                }

                await removeInference(id: inferenceId)
            }

            activeInferences[inferenceId] = task
        }
    }

    /// Generate embeddings for text
    public func generateEmbedding(
        text: String,
        modelName: String = "all-minilm-l6-v2",
        dimensions: Int = 384
    ) async throws -> [Float] {
        logger.info("Generating embedding with model: \(modelName)")
        let startTime = Date()

        // Try Metal acceleration first (faster for simple embeddings)
        if modelName.contains("minilm") || modelName.contains("simple") {
            let tokens = tokenizer.encode(text)
            let embedding = try await metalAccelerator.generateEmbedding(
                from: tokens.map { Int32($0) },
                dimensions: dimensions
            )

            let duration = Date().timeIntervalSince(startTime)
            logger.info("Metal embedding generated in \(duration * 1000)ms")

            return embedding
        }

        // Use Core ML for complex embeddings
        let model = try await modelManager.loadModel(name: modelName)

        // Tokenize
        let tokens = tokenizer.encode(text)
        let input = try createMLInput(tokens: tokens)

        // Run inference
        let output = try model.prediction(from: input)

        // Extract embedding
        guard let embeddingArray = output.featureValue(for: "embeddings")?.multiArrayValue else {
            throw MLAcceleratorError.inferenceError("No embeddings in output")
        }

        let embedding = try embeddingArray.toFloatArray()

        let duration = Date().timeIntervalSince(startTime)
        logger.info("Core ML embedding generated in \(duration * 1000)ms")

        return embedding
    }

    // MARK: - Vector Search

    /// Perform GPU-accelerated vector similarity search
    public func vectorSearch(
        query: [Float],
        vectors: [[Float]],
        topK: Int = 10
    ) async throws -> [SearchResult] {
        return try await metalAccelerator.vectorSearch(
            query: query,
            vectors: vectors,
            topK: topK
        )
    }

    // MARK: - Inference Management

    /// Cancel a specific inference
    public func cancelInference(id: UUID) {
        activeInferences[id]?.cancel()
    }

    /// Cancel all active inferences
    public func cancelAllInferences() {
        for (_, task) in activeInferences {
            task.cancel()
        }
        activeInferences.removeAll()
    }

    /// Get count of active inferences
    public func getActiveInferenceCount() -> Int {
        return activeInferences.count
    }

    private func removeInference(id: UUID) {
        activeInferences.removeValue(forKey: id)
    }

    // MARK: - Model Management

    /// List available models
    public func listModels() async throws -> [ModelInfo] {
        return try await modelManager.listAvailableModels()
    }

    /// Load a model explicitly
    public func loadModel(name: String, quantization: QuantizationType = .int8) async throws {
        _ = try await modelManager.loadModel(name: name, quantization: quantization)
    }

    /// Unload a model to free memory
    public func unloadModel(name: String) async {
        await modelManager.unloadModel(name: name)
    }

    // MARK: - Metrics

    /// Get current memory usage
    public func getMemoryUsage() async -> Int64 {
        return await modelManager.getMemoryUsage()
    }

    /// Get device information
    public func getDeviceInfo() -> [String: Any] {
        return metalAccelerator.getDeviceInfo()
    }

    // MARK: - Private Helpers

    private func createMLInput(tokens: [Int]) throws -> MLFeatureProvider {
        // Create MLMultiArray for input_ids
        let inputArray = try MLMultiArray(shape: [1, NSNumber(value: tokens.count)], dataType: .int32)

        for (index, token) in tokens.enumerated() {
            inputArray[index] = NSNumber(value: token)
        }

        return try MLDictionaryFeatureProvider(dictionary: [
            "input_ids": MLFeatureValue(multiArray: inputArray)
        ])
    }

    private func sampleToken(
        from logits: MLMultiArray,
        temperature: Float,
        topP: Float,
        topK: Int
    ) throws -> Int32 {
        let vocabSize = logits.count

        // Extract logits as floats
        var logitsArray = [Float](repeating: 0, count: vocabSize)
        for i in 0..<vocabSize {
            logitsArray[i] = logits[i].floatValue
        }

        // Apply temperature
        if temperature != 1.0 {
            logitsArray = logitsArray.map { $0 / temperature }
        }

        // Apply top-k filtering
        if topK > 0 && topK < vocabSize {
            let sortedIndices = logitsArray.enumerated()
                .sorted { $0.element > $1.element }
                .prefix(topK)
                .map { $0.offset }

            let kthValue = logitsArray[sortedIndices.last!]
            for i in 0..<vocabSize {
                if logitsArray[i] < kthValue {
                    logitsArray[i] = -Float.infinity
                }
            }
        }

        // Softmax
        let maxLogit = logitsArray.max() ?? 0
        let expSum = logitsArray.reduce(0) { $0 + exp($1 - maxLogit) }
        let probs = logitsArray.map { exp($0 - maxLogit) / expSum }

        // Apply top-p (nucleus) sampling
        if topP < 1.0 {
            let sortedIndices = probs.enumerated()
                .sorted { $0.element > $1.element }

            var cumulativeProb: Float = 0
            var nucleusIndices = Set<Int>()

            for (index, prob) in sortedIndices {
                cumulativeProb += prob
                nucleusIndices.insert(index)

                if cumulativeProb >= topP {
                    break
                }
            }

            // Zero out non-nucleus probabilities
            for i in 0..<vocabSize {
                if !nucleusIndices.contains(i) {
                    logitsArray[i] = -Float.infinity
                }
            }

            // Renormalize
            let newExpSum = logitsArray.reduce(0) { $0 + exp($1 - maxLogit) }
            let normalizedProbs = logitsArray.map { exp($0 - maxLogit) / newExpSum }

            // Sample from normalized distribution
            return Int32(sampleFromDistribution(normalizedProbs))
        }

        // Sample from distribution
        return Int32(sampleFromDistribution(probs))
    }

    private func sampleFromDistribution(_ probs: [Float]) -> Int {
        let random = Float.random(in: 0..<1)
        var cumulative: Float = 0

        for (index, prob) in probs.enumerated() {
            cumulative += prob
            if random < cumulative {
                return index
            }
        }

        return probs.count - 1
    }
}

// MARK: - Simple Tokenizer

/// Simple tokenizer for development (would use SentencePiece in production)
class SimpleTokenizer {
    let eosTokenId: Int32 = 2
    private let vocabSize = 32000

    func encode(_ text: String) -> [Int] {
        // Simple word-based tokenization
        // In production, use SentencePiece or tiktoken
        let words = text.lowercased()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }

        return words.map { word in
            let hash = abs(word.hashValue % vocabSize)
            return hash
        }
    }

    func decode(_ tokens: [Int32]) -> String {
        // Simple decoding (placeholder)
        // In production, use proper vocabulary mapping
        return tokens.map { String(describing: $0) }.joined(separator: " ")
    }
}

// MARK: - MLMultiArray Extensions

extension MLMultiArray {
    func toFloatArray() throws -> [Float] {
        var result = [Float](repeating: 0, count: self.count)

        for i in 0..<self.count {
            result[i] = self[i].floatValue
        }

        return result
    }
}
