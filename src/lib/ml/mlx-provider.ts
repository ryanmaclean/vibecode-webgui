/**
 * MLX Model Provider
 *
 * TypeScript interface for Apple's MLX machine learning framework.
 * MLX is optimized for Apple Silicon with unified memory architecture,
 * enabling efficient on-device inference for LLMs and embeddings.
 *
 * Features:
 * - Lazy computation and unified memory
 * - Support for quantized models (4-bit, 8-bit)
 * - Streaming text generation
 * - Batch embedding generation
 * - Integration with workspace-rag system
 */

// @ts-ignore - Tauri API only available in Tauri environment
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';

// MARK: - Types

export interface MLXModelConfig {
  /** Model name or path */
  name: string;
  /** Quantization level */
  quantization?: 'float16' | 'int8' | 'int4';
  /** Maximum context length */
  maxContextLength?: number;
  /** Device placement (auto selects optimal device) */
  device?: 'auto' | 'gpu' | 'cpu';
  /** Custom model path for local models */
  modelPath?: string;
}

export interface MLXInferenceOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0.0 - 2.0) */
  temperature?: number;
  /** Top-p (nucleus) sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Repetition penalty */
  repetitionPenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Enable streaming */
  stream?: boolean;
  /** Seed for reproducibility */
  seed?: number;
}

export interface MLXEmbeddingOptions {
  /** Embedding model name */
  model?: string;
  /** Output dimensions (for models that support it) */
  dimensions?: number;
  /** Normalize embeddings to unit length */
  normalize?: boolean;
  /** Batch size for processing */
  batchSize?: number;
}

export interface MLXModelInfo {
  /** Model identifier */
  name: string;
  /** Model type */
  type: 'text-generation' | 'embedding' | 'vision' | 'multimodal';
  /** Parameter count */
  parameterCount: number;
  /** Loaded quantization */
  quantization: string;
  /** Context length */
  contextLength: number;
  /** Vocabulary size */
  vocabSize: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Is model loaded */
  loaded: boolean;
}

export interface MLXInferenceMetrics {
  /** Time to first token in ms */
  firstTokenLatency: number;
  /** Tokens generated per second */
  tokensPerSecond: number;
  /** Total tokens generated */
  totalTokens: number;
  /** Prompt tokens processed */
  promptTokens: number;
  /** Total inference time in ms */
  totalDuration: number;
  /** Memory used during inference */
  peakMemoryUsage: number;
  /** Device used for computation */
  computeDevice: string;
}

export interface MLXGenerationResult {
  /** Generated text */
  text: string;
  /** Generation metrics */
  metrics: MLXInferenceMetrics;
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'error';
}

export interface MLXStreamToken {
  /** Generated token text */
  token: string;
  /** Token probability (if available) */
  probability?: number;
  /** Cumulative text so far */
  cumulativeText?: string;
}

// MARK: - MLX Provider Class

export class MLXProvider {
  private static instance: MLXProvider | null = null;
  private initialized = false;
  private loadedModels: Map<string, MLXModelInfo> = new Map();
  private defaultTextModel = 'mlx-community/Mistral-7B-Instruct-v0.3-4bit';
  private defaultEmbeddingModel = 'mlx-community/bge-small-en-v1.5';

  private constructor() {}

  static getInstance(): MLXProvider {
    if (!this.instance) {
      this.instance = new MLXProvider();
    }
    return this.instance;
  }

  /**
   * Initialize the MLX provider
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      const available = await this.isAvailable();
      if (!available) {
        logger.warn('[MLXProvider] MLX not available on this system');
        return false;
      }

      await invoke('mlx_init');
      this.initialized = true;
      logger.info('[MLXProvider] Initialized successfully');
      return true;
    } catch (error) {
      logger.error('[MLXProvider] Initialization failed:', { error });
      return false;
    }
  }

  /**
   * Check if MLX is available (Apple Silicon required)
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('mlx_is_available');
    } catch {
      return false;
    }
  }

  /**
   * Get system information for MLX
   */
  async getSystemInfo(): Promise<{
    deviceName: string;
    unifiedMemory: number;
    metalVersion: string;
    mlxVersion: string;
    supportsFloat16: boolean;
  }> {
    await this.ensureInitialized();
    return invoke('mlx_get_system_info');
  }

  // MARK: - Model Management

  /**
   * Load a model into memory
   */
  async loadModel(config: MLXModelConfig): Promise<MLXModelInfo> {
    await this.ensureInitialized();

    const modelKey = config.name;
    if (this.loadedModels.has(modelKey)) {
      logger.info('[MLXProvider] Model already loaded:', { model: modelKey });
      return this.loadedModels.get(modelKey)!;
    }

    try {
      logger.info('[MLXProvider] Loading model:', { config });

      const info = await invoke<MLXModelInfo>('mlx_load_model', {
        name: config.name,
        quantization: config.quantization || 'int4',
        maxContextLength: config.maxContextLength || 4096,
        device: config.device || 'auto',
        modelPath: config.modelPath,
      });

      this.loadedModels.set(modelKey, info);
      logger.info('[MLXProvider] Model loaded:', { model: modelKey, info });
      return info;
    } catch (error) {
      logger.error('[MLXProvider] Failed to load model:', { config, error });
      throw error;
    }
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(name: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.loadedModels.has(name)) {
      logger.warn('[MLXProvider] Model not loaded:', { model: name });
      return;
    }

    try {
      await invoke('mlx_unload_model', { name });
      this.loadedModels.delete(name);
      logger.info('[MLXProvider] Model unloaded:', { model: name });
    } catch (error) {
      logger.error('[MLXProvider] Failed to unload model:', { name, error });
      throw error;
    }
  }

  /**
   * List all loaded models
   */
  getLoadedModels(): MLXModelInfo[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * Get available models from MLX community hub
   */
  async listAvailableModels(): Promise<Array<{
    name: string;
    type: string;
    size: string;
    quantization: string;
    downloads: number;
  }>> {
    await this.ensureInitialized();
    return invoke('mlx_list_available_models');
  }

  // MARK: - Text Generation

  /**
   * Generate text completion
   */
  async generateText(
    prompt: string,
    options: MLXInferenceOptions = {}
  ): Promise<MLXGenerationResult> {
    await this.ensureInitialized();

    // Ensure default model is loaded
    if (this.loadedModels.size === 0) {
      await this.loadModel({ name: this.defaultTextModel });
    }

    try {
      return await invoke<MLXGenerationResult>('mlx_generate_text', {
        prompt,
        options: {
          maxTokens: options.maxTokens ?? 512,
          temperature: options.temperature ?? 0.7,
          topP: options.topP ?? 0.9,
          topK: options.topK ?? 50,
          repetitionPenalty: options.repetitionPenalty ?? 1.0,
          stopSequences: options.stopSequences ?? [],
          seed: options.seed,
        },
      });
    } catch (error) {
      logger.error('[MLXProvider] Text generation failed:', { error });
      throw error;
    }
  }

  /**
   * Generate text with streaming
   */
  async *generateTextStream(
    prompt: string,
    options: MLXInferenceOptions = {}
  ): AsyncGenerator<MLXStreamToken, MLXInferenceMetrics, undefined> {
    await this.ensureInitialized();

    // Ensure default model is loaded
    if (this.loadedModels.size === 0) {
      await this.loadModel({ name: this.defaultTextModel });
    }

    const streamId = await invoke<string>('mlx_generate_text_stream', {
      prompt,
      options: {
        maxTokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.7,
        topP: options.topP ?? 0.9,
        topK: options.topK ?? 50,
        repetitionPenalty: options.repetitionPenalty ?? 1.0,
        stopSequences: options.stopSequences ?? [],
        seed: options.seed,
      },
    });

    try {
      while (true) {
        const result = await invoke<{
          token?: MLXStreamToken;
          metrics?: MLXInferenceMetrics;
          done: boolean;
        }>('mlx_read_stream_token', { streamId });

        if (result.token) {
          yield result.token;
        }

        if (result.done && result.metrics) {
          return result.metrics;
        }
      }
    } finally {
      await invoke('mlx_close_stream', { streamId }).catch(() => {});
    }
  }

  // MARK: - Embeddings

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    options: MLXEmbeddingOptions = {}
  ): Promise<number[]> {
    await this.ensureInitialized();

    const modelName = options.model || this.defaultEmbeddingModel;

    // Load embedding model if not loaded
    const modelKey = modelName;
    if (!this.loadedModels.has(modelKey)) {
      await this.loadModel({
        name: modelName,
        quantization: 'float16',
      });
    }

    try {
      return await invoke<number[]>('mlx_generate_embedding', {
        text,
        model: modelName,
        dimensions: options.dimensions,
        normalize: options.normalize ?? true,
      });
    } catch (error) {
      logger.error('[MLXProvider] Embedding generation failed:', { error });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddingsBatch(
    texts: string[],
    options: MLXEmbeddingOptions = {}
  ): Promise<number[][]> {
    await this.ensureInitialized();

    const modelName = options.model || this.defaultEmbeddingModel;
    const batchSize = options.batchSize || 32;

    // Load embedding model if not loaded
    const modelKey = modelName;
    if (!this.loadedModels.has(modelKey)) {
      await this.loadModel({
        name: modelName,
        quantization: 'float16',
      });
    }

    try {
      // Process in batches for memory efficiency
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const embeddings = await invoke<number[][]>('mlx_generate_embeddings_batch', {
          texts: batch,
          model: modelName,
          dimensions: options.dimensions,
          normalize: options.normalize ?? true,
        });
        results.push(...embeddings);
      }
      return results;
    } catch (error) {
      logger.error('[MLXProvider] Batch embedding generation failed:', { error });
      throw error;
    }
  }

  // MARK: - RAG Integration

  /**
   * Generate embedding optimized for RAG search
   * Uses instruction-tuned model for better retrieval
   */
  async generateRAGEmbedding(
    text: string,
    isQuery = false
  ): Promise<number[]> {
    // BGE models use instruction prefixes for queries
    const processedText = isQuery
      ? `Represent this sentence for searching relevant passages: ${text}`
      : text;

    return this.generateEmbedding(processedText, {
      model: this.defaultEmbeddingModel,
      normalize: true,
    });
  }

  /**
   * Generate answer using RAG context
   */
  async generateRAGAnswer(
    query: string,
    context: string[],
    options: MLXInferenceOptions = {}
  ): Promise<MLXGenerationResult> {
    const systemPrompt = `You are a helpful assistant. Answer the question based on the provided context. If the context doesn't contain relevant information, say so.`;

    const contextText = context
      .map((c, i) => `[${i + 1}] ${c}`)
      .join('\n\n');

    const prompt = `${systemPrompt}

Context:
${contextText}

Question: ${query}

Answer:`;

    return this.generateText(prompt, {
      ...options,
      maxTokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.3, // Lower temperature for factual responses
    });
  }

  // MARK: - Memory Management

  /**
   * Get current memory usage
   */
  async getMemoryUsage(): Promise<{
    used: number;
    total: number;
    modelMemory: number;
    cacheMemory: number;
  }> {
    await this.ensureInitialized();
    return invoke('mlx_get_memory_usage');
  }

  /**
   * Clear model cache to free memory
   */
  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    await invoke('mlx_clear_cache');
    logger.info('[MLXProvider] Cache cleared');
  }

  // MARK: - Helpers

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('MLX not available on this system');
      }
    }
  }

  /**
   * Set default text generation model
   */
  setDefaultTextModel(model: string): void {
    this.defaultTextModel = model;
  }

  /**
   * Set default embedding model
   */
  setDefaultEmbeddingModel(model: string): void {
    this.defaultEmbeddingModel = model;
  }
}

// MARK: - Singleton Export

export const mlxProvider = MLXProvider.getInstance();

// MARK: - Convenience Functions

/**
 * Check if MLX is available
 */
export async function isMLXAvailable(): Promise<boolean> {
  return mlxProvider.isAvailable();
}

/**
 * Generate text using MLX
 */
export async function generateText(
  prompt: string,
  options?: MLXInferenceOptions
): Promise<MLXGenerationResult> {
  return mlxProvider.generateText(prompt, options);
}

/**
 * Generate embedding using MLX
 */
export async function generateEmbedding(
  text: string,
  options?: MLXEmbeddingOptions
): Promise<number[]> {
  return mlxProvider.generateEmbedding(text, options);
}

/**
 * Generate embeddings in batch using MLX
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options?: MLXEmbeddingOptions
): Promise<number[][]> {
  return mlxProvider.generateEmbeddingsBatch(texts, options);
}
