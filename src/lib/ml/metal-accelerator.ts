/**
 * TypeScript API for Metal/Core ML Acceleration on Apple Silicon
 *
 * Provides high-performance on-device inference for:
 * - Text generation (LLMs)
 * - Embedding generation
 * - Vector similarity search
 *
 * Performance targets:
 * - Embedding: <50ms
 * - Inference: <100ms first token (small models), <2s (large models)
 * - Vector search: <10ms (1K vectors)
 * - Power: <10W
 */

// @ts-ignore - Tauri API only available in Tauri environment
import { invoke } from '@tauri-apps/api/core';

// MARK: - Types

export interface InferenceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  model?: string;
  normalize?: boolean;
  dimensions?: number;
}

export interface ModelInfo {
  name: string;
  size: number;
  quantization: 'float32' | 'float16' | 'int8' | 'int4';
  computeUnits: 'ane' | 'gpu' | 'cpu' | 'auto';
  parameterCount?: number;
  contextLength?: number;
}

export interface SearchResult {
  index: number;
  similarity: number;
  metadata?: Record<string, string>;
}

export interface InferenceMetrics {
  firstTokenLatency: number;
  tokensPerSecond: number;
  totalTokens: number;
  totalDuration: number;
  computeDevice: string;
  peakMemoryUsage: number;
}

export interface DeviceInfo {
  name: string;
  metalAvailable: boolean;
  coreMLAvailable: boolean;
  neuralEngineAvailable: boolean;
  apple8Family: boolean; // M2+
  apple9Family: boolean; // M3+
  recommendedMaxWorkingSetSize: number;
  maxThreadsPerThreadgroup: {
    width: number;
    height: number;
    depth: number;
  };
}

// MARK: - MetalAccelerator Class

export class MetalAccelerator {
  private static instance: MetalAccelerator | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): MetalAccelerator {
    if (!this.instance) {
      this.instance = new MetalAccelerator();
    }
    return this.instance;
  }

  /**
   * Initialize the Metal accelerator
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      const available = await invoke<boolean>('ml_is_available');
      if (!available) {
        console.warn('[MetalAccelerator] Metal/Core ML not available on this system');
        return false;
      }

      await invoke('ml_init');
      this.isInitialized = true;
      console.log('[MetalAccelerator] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[MetalAccelerator] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if Metal/Core ML acceleration is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('ml_is_available');
    } catch {
      return false;
    }
  }

  /**
   * Get device capabilities
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    await this.ensureInitialized();
    return invoke<DeviceInfo>('ml_get_device_info');
  }

  // MARK: - Text Generation

  /**
   * Generate text with streaming support
   *
   * Example:
   * ```typescript
   * for await (const token of accelerator.generateText("Hello")) {
   *   console.log(token);
   * }
   * ```
   */
  async *generateText(
    prompt: string,
    options: InferenceOptions = {}
  ): AsyncGenerator<string, InferenceMetrics, undefined> {
    await this.ensureInitialized();

    const streamId = await invoke<number>('ml_generate_text_stream', {
      prompt,
      model: options.model || 'mistral-7b-int8',
      maxTokens: options.maxTokens || 512,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
      topK: options.topK || 50,
    });

    try {
      while (true) {
        const result = await invoke<{ token?: string; metrics?: InferenceMetrics }>('ml_read_token', {
          streamId,
        });

        if (result.token !== undefined) {
          yield result.token;
        }

        if (result.metrics) {
          return result.metrics;
        }
      }
    } finally {
      // Clean up stream
      await invoke('ml_close_stream', { streamId }).catch(() => {});
    }
  }

  /**
   * Generate text without streaming (simpler API)
   */
  async generateTextComplete(
    prompt: string,
    options: InferenceOptions = {}
  ): Promise<{ text: string; metrics: InferenceMetrics }> {
    await this.ensureInitialized();

    return invoke<{ text: string; metrics: InferenceMetrics }>('ml_generate_text_complete', {
      prompt,
      options: {
        model: options.model || 'mistral-7b-int8',
        maxTokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        topP: options.topP || 0.9,
        topK: options.topK || 50,
      },
    });
  }

  // MARK: - Embeddings

  /**
   * Generate embedding vector for text
   *
   * Performance: <50ms for 512 tokens
   */
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    await this.ensureInitialized();

    return invoke<number[]>('ml_generate_embedding', {
      text,
      model: options?.model || 'all-minilm-l6-v2',
      dimensions: options?.dimensions || 384,
    });
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    await this.ensureInitialized();

    return invoke<number[][]>('ml_generate_embeddings_batch', {
      texts,
      model: options?.model || 'all-minilm-l6-v2',
      dimensions: options?.dimensions || 384,
    });
  }

  // MARK: - Vector Search

  /**
   * GPU-accelerated vector similarity search
   *
   * Performance: <10ms for 1000 vectors
   */
  async vectorSearch(
    query: number[],
    vectors: number[][],
    topK: number = 10
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();

    return invoke<SearchResult[]>('ml_vector_search', {
      query,
      vectors,
      topK,
    });
  }

  /**
   * Batch vector search (multiple queries)
   */
  async vectorSearchBatch(
    queries: number[][],
    vectors: number[][],
    topK: number = 10
  ): Promise<SearchResult[][]> {
    await this.ensureInitialized();

    return invoke<SearchResult[][]>('ml_vector_search_batch', {
      queries,
      vectors,
      topK,
    });
  }

  // MARK: - Model Management

  /**
   * List available models in cache
   */
  async listModels(): Promise<ModelInfo[]> {
    await this.ensureInitialized();
    return invoke<ModelInfo[]>('ml_list_models');
  }

  /**
   * Load a model into memory
   */
  async loadModel(name: string, quantization: 'int8' | 'int4' = 'int8'): Promise<void> {
    await this.ensureInitialized();
    return invoke('ml_load_model', { name, quantization });
  }

  /**
   * Unload a model to free memory
   */
  async unloadModel(name: string): Promise<void> {
    await this.ensureInitialized();
    return invoke('ml_unload_model', { name });
  }

  /**
   * Download a model (future implementation)
   */
  async downloadModel(
    name: string,
    quantization: 'int8' | 'int4' = 'int8',
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await this.ensureInitialized();

    // Would implement progress streaming
    return invoke('ml_download_model', { name, quantization });
  }

  // MARK: - System Monitoring

  /**
   * Get current memory usage
   */
  async getMemoryUsage(): Promise<number> {
    await this.ensureInitialized();
    return invoke<number>('ml_get_memory_usage');
  }

  /**
   * Get active inference count
   */
  async getActiveInferenceCount(): Promise<number> {
    await this.ensureInitialized();
    return invoke<number>('ml_get_active_inference_count');
  }

  // MARK: - Helpers

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Metal/Core ML acceleration not available');
      }
    }
  }
}

// MARK: - Singleton Export

export const metalAccelerator = MetalAccelerator.getInstance();

// MARK: - Convenience Functions

/**
 * Check if running on Apple Silicon with Metal support
 */
export async function isMetalAvailable(): Promise<boolean> {
  return metalAccelerator.isAvailable();
}

/**
 * Get system capabilities
 */
export async function getMLCapabilities(): Promise<DeviceInfo> {
  return metalAccelerator.getDeviceInfo();
}

/**
 * Quick embedding generation
 */
export async function embed(text: string): Promise<number[]> {
  return metalAccelerator.generateEmbedding(text);
}

/**
 * Quick vector search
 */
export async function search(
  query: number[],
  vectors: number[][],
  topK: number = 10
): Promise<SearchResult[]> {
  return metalAccelerator.vectorSearch(query, vectors, topK);
}
