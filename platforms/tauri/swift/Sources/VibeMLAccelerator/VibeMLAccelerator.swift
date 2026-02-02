import Foundation
import CoreML

/// Main public API for VibeCode ML Acceleration
public class VibeMLAccelerator {
    private let engine: CoreMLInferenceEngine
    private let config: MLAcceleratorConfig

    public static let shared: VibeMLAccelerator = {
        let cachePath = FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("VibeMLModels")

        let config = MLAcceleratorConfig(
            modelCachePath: cachePath,
            maxConcurrentInferences: 3,
            enableTelemetry: true,
            preferredComputeDevice: .auto,
            maxMemoryUsage: 4_000_000_000 // 4GB
        )

        return try! VibeMLAccelerator(config: config)
    }()

    public init(config: MLAcceleratorConfig) throws {
        self.config = config
        self.engine = try CoreMLInferenceEngine(config: config)
    }

    // MARK: - Public API

    /// Generate text with streaming
    public func generateText(
        prompt: String,
        model: String = "mistral-7b-int8",
        options: InferenceOptions = InferenceOptions(),
        onToken: @escaping (String) -> Void,
        onComplete: @escaping (InferenceMetrics) -> Void,
        onError: @escaping (Error) -> Void
    ) {
        Task {
            let startTime = Date()
            var firstTokenTime: TimeInterval?
            var tokenCount = 0

            do {
                let stream = await engine.generateText(prompt: prompt, modelName: model, options: options)

                for try await token in stream {
                    if firstTokenTime == nil {
                        firstTokenTime = Date().timeIntervalSince(startTime)
                    }

                    tokenCount += 1
                    onToken(token)
                }

                let totalDuration = Date().timeIntervalSince(startTime)
                let metrics = InferenceMetrics(
                    firstTokenLatency: firstTokenTime ?? 0,
                    tokensPerSecond: Double(tokenCount) / totalDuration,
                    totalTokens: tokenCount,
                    totalDuration: totalDuration,
                    computeDevice: config.preferredComputeDevice,
                    peakMemoryUsage: await engine.getMemoryUsage()
                )

                onComplete(metrics)
            } catch {
                onError(error)
            }
        }
    }

    /// Generate embedding for text
    public func generateEmbedding(
        text: String,
        model: String = "all-minilm-l6-v2",
        dimensions: Int = 384
    ) async throws -> [Float] {
        return try await engine.generateEmbedding(text: text, modelName: model, dimensions: dimensions)
    }

    /// Perform vector similarity search
    public func vectorSearch(
        query: [Float],
        vectors: [[Float]],
        topK: Int = 10
    ) async throws -> [SearchResult] {
        return try await engine.vectorSearch(query: query, vectors: vectors, topK: topK)
    }

    // MARK: - Model Management

    /// List available models
    public func listModels() async throws -> [ModelInfo] {
        return try await engine.listModels()
    }

    /// Load model explicitly
    public func loadModel(name: String, quantization: QuantizationType = .int8) async throws {
        try await engine.loadModel(name: name, quantization: quantization)
    }

    /// Unload model
    public func unloadModel(name: String) async {
        await engine.unloadModel(name: name)
    }

    // MARK: - System Info

    /// Get device information
    public func getDeviceInfo() async -> [String: Any] {
        return await engine.getDeviceInfo()
    }

    /// Get current memory usage
    public func getMemoryUsage() async -> Int64 {
        return await engine.getMemoryUsage()
    }

    /// Get active inference count
    public func getActiveInferenceCount() async -> Int {
        return await engine.getActiveInferenceCount()
    }

    // MARK: - Health Check

    /// Check if ML acceleration is available
    public static func isAvailable() -> Bool {
        // Check for Metal support
        guard MTLCreateSystemDefaultDevice() != nil else {
            return false
        }

        // Check for Core ML support (always true on macOS 13+)
        return true
    }

    /// Get system capabilities
    public static func getCapabilities() -> [String: Bool] {
        let device = MTLCreateSystemDefaultDevice()

        return [
            "metalAvailable": device != nil,
            "coreMLAvailable": true,
            "neuralEngineAvailable": device?.supportsFamily(.apple7) ?? false,
            "apple8Family": device?.supportsFamily(.apple8) ?? false, // M2+
            "apple9Family": device?.supportsFamily(.apple9) ?? false, // M3+
        ]
    }
}

// MARK: - C-Compatible API for Rust FFI

@_cdecl("vibe_ml_init")
public func vibe_ml_init() -> UnsafeMutableRawPointer? {
    guard VibeMLAccelerator.isAvailable() else {
        return nil
    }

    let accelerator = VibeMLAccelerator.shared
    return Unmanaged.passRetained(accelerator as AnyObject).toOpaque()
}

@_cdecl("vibe_ml_is_available")
public func vibe_ml_is_available() -> Bool {
    return VibeMLAccelerator.isAvailable()
}

@_cdecl("vibe_ml_get_device_info")
public func vibe_ml_get_device_info() -> UnsafePointer<CChar>? {
    // Return a simple status for now
    let info: [String: Any] = [
        "metalAvailable": true,
        "coreMLAvailable": true,
        "device": "macOS"
    ]
    
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: info)
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
        return strdup(jsonString)
    } catch {
        return strdup("{\"error\": \"Failed to serialize device info\"}")
    }
}

// Helper to duplicate C strings
private func strdup(_ string: String) -> UnsafePointer<CChar>? {
    return string.withCString { cString in
        let length = strlen(cString) + 1
        let copy = UnsafeMutablePointer<CChar>.allocate(capacity: length)
        memcpy(copy, cString, length)
        return UnsafePointer(copy)
    }
}
