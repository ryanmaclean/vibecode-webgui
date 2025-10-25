/**
 * Embedding Generation
 * OpenAI text-embedding-3-small
 */

import OpenAI from 'openai';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export class EmbeddingService {
  private readonly defaultModel = 'text-embedding-3-small';
  private readonly defaultDimensions = 1536;
  
  /**
   * Generate embedding for a single text
   */
  async generate(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const { model = this.defaultModel, dimensions = this.defaultDimensions } = options;
    
    try {
      const response = await openai.embeddings.create({
        model,
        input: text,
        dimensions
      });
      
      const embedding = response.data[0].embedding;
      
      logger.debug('Embedding generated', {
        textLength: text.length,
        model,
        dimensions: embedding.length
      });
      
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error, textLength: text.length });
      throw error;
    }
  }
  
  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatch(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    const { model = this.defaultModel, dimensions = this.defaultDimensions } = options;
    
    try {
      const response = await openai.embeddings.create({
        model,
        input: texts,
        dimensions
      });
      
      const embeddings = response.data.map(item => item.embedding);
      
      logger.debug('Batch embeddings generated', {
        count: texts.length,
        model,
        dimensions
      });
      
      return embeddings;
    } catch (error) {
      logger.error('Failed to generate batch embeddings', { error, count: texts.length });
      throw error;
    }
  }
  
  /**
   * Chunk text into smaller pieces for embedding
   */
  chunkText(
    text: string,
    options: {
      maxTokens?: number;
      overlap?: number;
    } = {}
  ): string[] {
    const { maxTokens = 512, overlap = 50 } = options;
    
    // Simple chunking by characters (approximate)
    // In production, use a proper tokenizer
    const charsPerToken = 4; // Rough estimate
    const maxChars = maxTokens * charsPerToken;
    const overlapChars = overlap * charsPerToken;
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const chunk = text.substring(start, end);
      chunks.push(chunk);
      
      start = end - overlapChars;
      if (start >= text.length) break;
    }
    
    logger.debug('Text chunked', {
      originalLength: text.length,
      chunkCount: chunks.length,
      maxTokens,
      overlap
    });
    
    return chunks;
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
