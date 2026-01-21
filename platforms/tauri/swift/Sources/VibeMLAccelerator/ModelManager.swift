import Foundation
import CoreML
import os.log

/// Manages Core ML model lifecycle, caching, and hardware selection
public actor ModelManager {
    private let config: MLAcceleratorConfig
    private var loadedModels: [String: MLModel] = [:]
    private var modelInfo: [String: ModelInfo] = [:]
    private let logger = Logger(subsystem: "com.vibecode.ml", category: "ModelManager")

    // Hardware selector
    private let hardwareSelector: HardwareSelector

    // Model download manager
    private let downloadManager: ModelDownloadManager

    public init(config: MLAcceleratorConfig) {
        self.config = config
        self.hardwareSelector = HardwareSelector()
        self.downloadManager = ModelDownloadManager(cachePath: config.modelCachePath)
    }

    // MARK: - Model Loading

    /// Load a Core ML model with automatic hardware selection
    public func loadModel(name: String, quantization: QuantizationType = .int8) async throws -> MLModel {
        logger.info("Loading model: \(name) with quantization: \(quantization.rawValue)")

        // Check if already loaded
        if let cached = loadedModels[name] {
            logger.debug("Model \(name) already loaded")
            return cached
        }

        // Check model count limit
        if loadedModels.count >= config.maxConcurrentInferences {
            logger.warning("Model cache full, evicting least recently used")
            try await evictLRUModel()
        }

        // Get model path
        let modelPath = try await downloadManager.getModelPath(name: name, quantization: quantization)

        // Compile if needed
        let compiledURL = try await compileModelIfNeeded(modelPath)

        // Select optimal compute device
        let computeDevice = hardwareSelector.selectOptimalDevice(for: name)

        // Create ML configuration
        let mlConfig = MLModelConfiguration()
        mlConfig.computeUnits = computeDevice.toMLComputeUnits()
        mlConfig.allowLowPrecisionAccumulationOnGPU = true

        // Load model
        let model = try MLModel(contentsOf: compiledURL, configuration: mlConfig)

        // Cache model
        loadedModels[name] = model

        // Store model info
        modelInfo[name] = try await getModelInfo(name: name, modelURL: compiledURL, quantization: quantization)

        logger.info("Successfully loaded model: \(name) on \(computeDevice.rawValue)")

        return model
    }

    /// Unload a specific model to free memory
    public func unloadModel(name: String) {
        if loadedModels.removeValue(forKey: name) != nil {
            modelInfo.removeValue(forKey: name)
            logger.info("Unloaded model: \(name)")
        }
    }

    /// Unload all models
    public func unloadAllModels() {
        let count = loadedModels.count
        loadedModels.removeAll()
        modelInfo.removeAll()
        logger.info("Unloaded \(count) models")
    }

    // MARK: - Model Information

    /// Get information about a loaded model
    public func getInfo(for name: String) -> ModelInfo? {
        return modelInfo[name]
    }

    /// List all loaded models
    public func listLoadedModels() -> [String] {
        return Array(loadedModels.keys)
    }

    /// Get available models from cache
    public func listAvailableModels() async throws -> [ModelInfo] {
        return try await downloadManager.listCachedModels()
    }

    // MARK: - Model Compilation

    private func compileModelIfNeeded(_ modelURL: URL) async throws -> URL {
        // Check if already compiled
        if modelURL.pathExtension == "mlmodelc" {
            return modelURL
        }

        logger.info("Compiling model: \(modelURL.lastPathComponent)")

        // Create compiled directory
        let compiledURL = modelURL.deletingPathExtension().appendingPathExtension("mlmodelc")

        // Check if compilation exists
        if FileManager.default.fileExists(atPath: compiledURL.path) {
            logger.debug("Using existing compiled model")
            return compiledURL
        }

        // Compile model
        return try await withCheckedThrowingContinuation { continuation in
            do {
                let compiled = try MLModel.compileModel(at: modelURL)
                continuation.resume(returning: compiled)
            } catch {
                logger.error("Model compilation failed: \(error.localizedDescription)")
                continuation.resume(throwing: MLAcceleratorError.conversionError(error.localizedDescription))
            }
        }
    }

    // MARK: - Memory Management

    private func evictLRUModel() async throws {
        // Simple LRU: remove first model
        // In production, track access times and evict least recently used
        guard let firstKey = loadedModels.keys.first else { return }

        logger.info("Evicting model: \(firstKey)")
        unloadModel(name: firstKey)
    }

    public func getMemoryUsage() -> Int64 {
        // Estimate based on loaded models
        return modelInfo.values.reduce(0) { $0 + $1.size }
    }

    public func checkMemoryPressure() -> Bool {
        return getMemoryUsage() > (config.maxMemoryUsage * 80 / 100)
    }

    // MARK: - Helper Methods

    private func getModelInfo(name: String, modelURL: URL, quantization: QuantizationType) async throws -> ModelInfo {
        // Get file size
        let attributes = try FileManager.default.attributesOfItem(atPath: modelURL.path)
        let size = attributes[.size] as? Int64 ?? 0

        // Determine compute device
        let computeDevice = hardwareSelector.selectOptimalDevice(for: name)

        return ModelInfo(
            name: name,
            size: size,
            quantization: quantization,
            computeUnits: computeDevice,
            parameterCount: nil, // Would need to parse model
            contextLength: nil   // Would need to parse model
        )
    }
}

// MARK: - Hardware Selector

class HardwareSelector {
    private let device: MTLDevice?

    init() {
        self.device = MTLCreateSystemDefaultDevice()
    }

    func selectOptimalDevice(for modelName: String) -> ComputeDevice {
        guard let device = device else {
            return .cpu
        }

        // Small embedding models: prefer ANE
        if modelName.contains("minilm") || modelName.contains("embedding") {
            return .neuralEngine
        }

        // Large LLMs: prefer GPU
        if modelName.contains("llama") || modelName.contains("mistral") || modelName.contains("qwen") {
            if device.supportsFamily(.apple8) { // M2+
                return .gpu
            }
        }

        // Default to ANE for efficiency
        return .neuralEngine
    }
}

// MARK: - Model Download Manager

actor ModelDownloadManager {
    private let cachePath: URL

    init(cachePath: URL) {
        self.cachePath = cachePath

        // Ensure cache directory exists
        try? FileManager.default.createDirectory(at: cachePath, withIntermediateDirectories: true)
    }

    func getModelPath(name: String, quantization: QuantizationType) async throws -> URL {
        let fileName = "\(name)-\(quantization.rawValue).mlpackage"
        let localPath = cachePath.appendingPathComponent(fileName)

        // Check if already cached
        if FileManager.default.fileExists(atPath: localPath.path) {
            return localPath
        }

        // Would download from remote in production
        throw MLAcceleratorError.modelNotFound("Model \(name) not found in cache")
    }

    func listCachedModels() throws -> [ModelInfo] {
        let contents = try FileManager.default.contentsOfDirectory(
            at: cachePath,
            includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]
        )

        return try contents.compactMap { url -> ModelInfo? in
            guard url.pathExtension == "mlpackage" || url.pathExtension == "mlmodelc" else {
                return nil
            }

            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            let size = attributes[.size] as? Int64 ?? 0

            let name = url.deletingPathExtension().lastPathComponent

            return ModelInfo(
                name: name,
                size: size,
                quantization: .int8, // Would parse from filename
                computeUnits: .auto
            )
        }
    }

    func deleteModel(name: String) throws {
        let files = try FileManager.default.contentsOfDirectory(at: cachePath, includingPropertiesForKeys: nil)

        for file in files where file.lastPathComponent.hasPrefix(name) {
            try FileManager.default.removeItem(at: file)
        }
    }
}

// MARK: - ComputeDevice Extensions

extension ComputeDevice {
    func toMLComputeUnits() -> MLComputeUnits {
        switch self {
        case .neuralEngine:
            return .all  // Use all available (ANE + GPU + CPU)
        case .gpu:
            return .cpuAndGPU
        case .cpu:
            return .cpuOnly
        case .auto:
            return .all
        }
    }
}
