import Foundation
import CoreML

// MARK: - Core Types

/// Quantization types for model compression
public enum QuantizationType: String, Codable {
    case float32
    case float16
    case int8
    case int4
}

/// Compute device selection
public enum ComputeDevice: String, Codable {
    case neuralEngine = "ane"
    case gpu = "gpu"
    case cpu = "cpu"
    case auto = "auto"
}

/// Model information
public struct ModelInfo: Codable {
    public let name: String
    public let size: Int64
    public let quantization: QuantizationType
    public let computeUnits: ComputeDevice
    public let parameterCount: Int64?
    public let contextLength: Int?

    public init(
        name: String,
        size: Int64,
        quantization: QuantizationType,
        computeUnits: ComputeDevice,
        parameterCount: Int64? = nil,
        contextLength: Int? = nil
    ) {
        self.name = name
        self.size = size
        self.quantization = quantization
        self.computeUnits = computeUnits
        self.parameterCount = parameterCount
        self.contextLength = contextLength
    }
}

/// Inference options
public struct InferenceOptions: Codable {
    public let maxTokens: Int
    public let temperature: Float
    public let topP: Float
    public let topK: Int
    public let stream: Bool

    public init(
        maxTokens: Int = 512,
        temperature: Float = 0.7,
        topP: Float = 0.9,
        topK: Int = 50,
        stream: Bool = true
    ) {
        self.maxTokens = maxTokens
        self.temperature = temperature
        self.topP = topP
        self.topK = topK
        self.stream = stream
    }
}

/// Embedding options
public struct EmbeddingOptions: Codable {
    public let model: String
    public let normalize: Bool
    public let dimensions: Int?

    public init(
        model: String = "all-minilm-l6-v2",
        normalize: Bool = true,
        dimensions: Int? = nil
    ) {
        self.model = model
        self.normalize = normalize
        self.dimensions = dimensions
    }
}

/// Vector search result
public struct SearchResult: Codable {
    public let index: Int
    public let similarity: Float
    public let metadata: [String: String]?

    public init(index: Int, similarity: Float, metadata: [String: String]? = nil) {
        self.index = index
        self.similarity = similarity
        self.metadata = metadata
    }
}

/// Inference metrics
public struct InferenceMetrics: Codable {
    public let firstTokenLatency: TimeInterval
    public let tokensPerSecond: Double
    public let totalTokens: Int
    public let totalDuration: TimeInterval
    public let computeDevice: ComputeDevice
    public let peakMemoryUsage: Int64

    public init(
        firstTokenLatency: TimeInterval,
        tokensPerSecond: Double,
        totalTokens: Int,
        totalDuration: TimeInterval,
        computeDevice: ComputeDevice,
        peakMemoryUsage: Int64
    ) {
        self.firstTokenLatency = firstTokenLatency
        self.tokensPerSecond = tokensPerSecond
        self.totalTokens = totalTokens
        self.totalDuration = totalDuration
        self.computeDevice = computeDevice
        self.peakMemoryUsage = peakMemoryUsage
    }
}

// MARK: - Error Types

public enum MLAcceleratorError: Error, LocalizedError {
    case modelNotFound(String)
    case modelLoadFailed(String)
    case inferenceError(String)
    case invalidInput(String)
    case memoryError(String)
    case hardwareUnavailable(String)
    case conversionError(String)

    public var errorDescription: String? {
        switch self {
        case .modelNotFound(let model):
            return "Model not found: \(model)"
        case .modelLoadFailed(let reason):
            return "Failed to load model: \(reason)"
        case .inferenceError(let reason):
            return "Inference error: \(reason)"
        case .invalidInput(let reason):
            return "Invalid input: \(reason)"
        case .memoryError(let reason):
            return "Memory error: \(reason)"
        case .hardwareUnavailable(let reason):
            return "Hardware unavailable: \(reason)"
        case .conversionError(let reason):
            return "Conversion error: \(reason)"
        }
    }
}

// MARK: - Configuration

public struct MLAcceleratorConfig: Codable {
    public let modelCachePath: URL
    public let maxConcurrentInferences: Int
    public let enableTelemetry: Bool
    public let preferredComputeDevice: ComputeDevice
    public let maxMemoryUsage: Int64

    public init(
        modelCachePath: URL,
        maxConcurrentInferences: Int = 3,
        enableTelemetry: Bool = true,
        preferredComputeDevice: ComputeDevice = .auto,
        maxMemoryUsage: Int64 = 4_000_000_000 // 4GB
    ) {
        self.modelCachePath = modelCachePath
        self.maxConcurrentInferences = maxConcurrentInferences
        self.enableTelemetry = enableTelemetry
        self.preferredComputeDevice = preferredComputeDevice
        self.maxMemoryUsage = maxMemoryUsage
    }
}
