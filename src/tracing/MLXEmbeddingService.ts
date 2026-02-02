import * as tracer from 'dd-trace';

/**
 * MLX Embedding Service with ddtrace Integration
 * Provides local MLX embedding generation with fallback to OpenAI
 */

export interface EmbeddingConfig {
  model: string;
  dimension: number;
  batchSize: number;
  fallbackProvider: 'openai' | 'none';
}

export interface EmbeddingRequest {
  texts: string[];
  chunkSize?: number;
  normalize?: boolean;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  dimension: number;
  usage: {
    totalTokens: number;
    provider: 'mlx' | 'openai';
    processingTimeMs: number;
  };
}

export class MLXEmbeddingService {
  private config: EmbeddingConfig;
  private tracer: typeof tracer;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.tracer = tracer;
  }

  /**
   * Generate embeddings for input texts
   */
  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.tracer.trace('mlx.embedding.generate', async (span) => {
      span.setTag('service.name', 'mlx-embedding');
      span.setTag('ml.model', this.config.model);
      span.setTag('ml.dimension', this.config.dimension);
      span.setTag('batch.size', request.texts.length);
      
      const startTime = Date.now();
      
      try {
        // Chunk texts if needed
        const chunks = await this.chunkTexts(request.texts, request.chunkSize || 100);
        span.setTag('chunk.count', chunks.length);
        
        // Process chunks
        const allEmbeddings: number[][] = [];
        let totalTokens = 0;
        let provider: 'mlx' | 'openai' = 'mlx';
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          const chunkResult = await this.tracer.trace('mlx.embedding.process_chunk', async (chunkSpan) => {
            chunkSpan.setTag('chunk.index', i);
            chunkSpan.setTag('chunk.size', chunk.length);
            
            try {
              // Try MLX first
              const mlxResult = await this.generateWithMLX(chunk);
              totalTokens += mlxResult.tokens;
              return { embeddings: mlxResult.embeddings, provider: 'mlx' as const };
            } catch (error) {
              chunkSpan.setTag('error', true);
              chunkSpan.setTag('error.message', error.message);
              
              // Fallback to OpenAI if configured
              if (this.config.fallbackProvider === 'openai') {
                span.setTag('fallback.used', true);
                const openaiResult = await this.generateWithOpenAI(chunk);
                totalTokens += openaiResult.tokens;
                return { embeddings: openaiResult.embeddings, provider: 'openai' as const };
              }
              
              throw error;
            }
          });
          
          allEmbeddings.push(...chunkResult.embeddings);
          provider = chunkResult.provider;
        }
        
        // Normalize if requested
        if (request.normalize) {
          await this.tracer.trace('mlx.embedding.normalize', async (normSpan) => {
            normSpan.setTag('embedding.count', allEmbeddings.length);
            this.normalizeEmbeddings(allEmbeddings);
          });
        }
        
        const processingTime = Date.now() - startTime;
        
        span.setTag('provider.used', provider);
        span.setTag('tokens.total', totalTokens);
        span.setTag('processing.time_ms', processingTime);
        span.setTag('success', true);
        
        return {
          embeddings: allEmbeddings,
          dimension: this.config.dimension,
          usage: {
            totalTokens,
            provider,
            processingTimeMs: processingTime
          }
        };
        
      } catch (error) {
        span.setTag('success', false);
        span.setTag('error.message', error.message);
        throw error;
      }
    });
  }

  /**
   * Generate embeddings using local MLX
   */
  private async generateWithMLX(texts: string[]): Promise<{ embeddings: number[][], tokens: number }> {
    return this.tracer.trace('mlx.embedding.mlx_generate', async (span) => {
      span.setTag('provider', 'mlx');
      
      // Simulate MLX inference (replace with actual MLX implementation)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const embeddings = texts.map(text => 
        Array(this.config.dimension).fill(0).map(() => Math.random())
      );
      
      const tokens = texts.reduce((sum, text) => sum + text.split(' ').length, 0);
      
      span.setTag('inference.time_ms', 100);
      span.setTag('tokens.estimated', tokens);
      
      return { embeddings, tokens };
    });
  }

  /**
   * Generate embeddings using OpenAI fallback
   */
  private async generateWithOpenAI(texts: string[]): Promise<{ embeddings: number[][], tokens: number }> {
    return this.tracer.trace('mlx.embedding.openai_fallback', async (span) => {
      span.setTag('provider', 'openai');
      
      // Simulate OpenAI API call (replace with actual OpenAI implementation)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const embeddings = texts.map(text => 
        Array(this.config.dimension).fill(0).map(() => Math.random())
      );
      
      const tokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
      
      span.setTag('api.time_ms', 200);
      span.setTag('tokens.estimated', tokens);
      
      return { embeddings, tokens };
    });
  }

  /**
   * Chunk texts into smaller batches
   */
  private async chunkTexts(texts: string[], chunkSize: number): Promise<string[][]> {
    return this.tracer.trace('mlx.embedding.chunk_texts', async (span) => {
      const chunks: string[][] = [];
      
      for (let i = 0; i < texts.length; i += chunkSize) {
        chunks.push(texts.slice(i, i + chunkSize));
      }
      
      span.setTag('original.count', texts.length);
      span.setTag('chunk.size', chunkSize);
      span.setTag('chunks.created', chunks.length);
      
      return chunks;
    });
  }

  /**
   * Normalize embeddings to unit vectors
   */
  private normalizeEmbeddings(embeddings: number[][]): void {
    for (const embedding of embeddings) {
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) {
          embedding[i] = embedding[i] / norm;
        }
      }
    }
  }
}
