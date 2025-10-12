/**
 * Embedding Generator for VibeCode Platform
 * Generates embeddings from code, documentation, and chat content
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { VectorSearchService } from './vector-search';
import { logger } from '@/lib/logger';
interface EmbeddingRequest {
  content: string;
  content_type: 'code' | 'documentation' | 'chat';
  metadata?: Record<string, any>;
}

interface EmbeddingResponse {
  embedding: number[];
  content_hash: string;
  token_count: number;
}

export class EmbeddingGenerator {
  private openai: OpenAI;
  private vectorSearch: VectorSearchService;
  private readonly MODEL = 'text-embedding-3-small';
  private readonly DIMENSIONS = 1536;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorSearch = new VectorSearchService();
  }

  /**
   * Generate embedding for any content type
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const content_hash = this.generateContentHash(request.content);
    
    try {
      const response = await this.openai.embeddings.create({
        model: this.MODEL,
        input: this.preprocessContent(request.content, request.content_type),
        dimensions: this.DIMENSIONS,
      });

      const embedding = response.data[0].embedding;
      const token_count = response.usage?.total_tokens || 0;

      // Store in vector database
      await this.vectorSearch.storeEmbedding(
        request.content_type,
        content_hash,
        embedding,
        {
          ...request.metadata,
          token_count,
          model: this.MODEL,
          generated_at: new Date().toISOString()
        }
      );

      return {
        embedding,
        content_hash,
        token_count
      };
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for code files
   */
  async generateCodeEmbedding(
    code: string,
    language: string,
    framework?: string,
    file_path?: string
  ): Promise<EmbeddingResponse> {
    const metadata = {
      language,
      framework,
      file_path,
      lines_of_code: code.split('\n').length,
      char_count: code.length
    };

    return this.generateEmbedding({
      content: code,
      content_type: 'code',
      metadata
    });
  }

  /**
   * Generate embeddings for documentation
   */
  async generateDocumentationEmbedding(
    content: string,
    section: string,
    title?: string,
    tags?: string[]
  ): Promise<EmbeddingResponse> {
    const metadata = {
      section,
      title,
      tags,
      word_count: content.split(/\s+/).length,
      char_count: content.length
    };

    return this.generateEmbedding({
      content: content,
      content_type: 'documentation',
      metadata
    });
  }

  /**
   * Generate embeddings for chat messages
   */
  async generateChatEmbedding(
    message: string,
    user_id: string,
    session_id: string,
    context?: string
  ): Promise<EmbeddingResponse> {
    const metadata = {
      user_id,
      session_id,
      context,
      message_length: message.length,
      word_count: message.split(/\s+/).length
    };

    return this.generateEmbedding({
      content: message,
      content_type: 'chat',
      metadata
    });
  }

  /**
   * Batch generate embeddings for multiple items
   */
  async batchGenerateEmbeddings(
    requests: EmbeddingRequest[]
  ): Promise<EmbeddingResponse[]> {
    const results: EmbeddingResponse[] = [];
    
    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(request => this.generateEmbedding(request));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logger.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
        // Continue with next batch
      }
      
      // Rate limiting delay
      if (i + BATCH_SIZE < requests.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }
    
    return results;
  }

  /**
   * Generate embeddings for an entire project structure
   */
  async generateProjectEmbeddings(
    projectFiles: Array<{
      path: string;
      content: string;
      language: string;
    }>,
    framework?: string
  ): Promise<{
    embeddings: EmbeddingResponse[];
    project_summary: {
      total_files: number;
      languages: string[];
      total_tokens: number;
    };
  }> {
    const requests: EmbeddingRequest[] = projectFiles.map(file => ({
      content: file.content,
      content_type: 'code' as const,
      metadata: {
        language: file.language,
        framework,
        file_path: file.path,
        project_context: true
      }
    }));

    const embeddings = await this.batchGenerateEmbeddings(requests);
    
    const languages = [...new Set(projectFiles.map(f => f.language))];
    const total_tokens = embeddings.reduce((sum, emb) => sum + emb.token_count, 0);

    return {
      embeddings,
      project_summary: {
        total_files: projectFiles.length,
        languages,
        total_tokens
      }
    };
  }

  /**
   * Find or generate embedding (with caching)
   */
  async getOrGenerateEmbedding(
    content: string,
    content_type: 'code' | 'documentation' | 'chat',
    metadata?: Record<string, any>
  ): Promise<{ embedding: number[]; from_cache: boolean }> {
    const content_hash = this.generateContentHash(content);
    
    // Try to find existing embedding
    try {
      const existing = await this.vectorSearch.similaritySearch(
        [], // Empty query for exact hash match
        { content_type, limit: 1 }
      );
      
      const cached = existing.find(e => e.content_hash === content_hash);
      if (cached) {
        // Retrieve full embedding from database
        const embedding = await this.getEmbeddingByHash(content_hash);
        if (embedding) {
          return { embedding, from_cache: true };
        }
      }
    } catch (error) {
      logger.warn('Cache lookup failed, generating new embedding:', error);
    }

    // Generate new embedding
    const result = await this.generateEmbedding({
      content,
      content_type,
      metadata
    });
    
    return { embedding: result.embedding, from_cache: false };
  }

  /**
   * Preprocess content based on type for better embeddings
   */
  private preprocessContent(content: string, content_type: string): string {
    switch (content_type) {
      case 'code':
        // Remove excessive whitespace but preserve structure
        return content
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple blank lines
          .replace(/\s+$/gm, '') // Remove trailing whitespace
          .trim();
      
      case 'documentation':
        // Clean up markdown and formatting
        return content
          .replace(/#{1,6}\s*/g, '') // Remove markdown headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
          .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
          .replace(/`(.*?)`/g, '$1') // Remove inline code formatting
          .trim();
      
      case 'chat':
        // Minimal preprocessing for chat
        return content.trim();
      
      default:
        return content.trim();
    }
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content.trim())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Retrieve embedding by content hash
   */
  private async getEmbeddingByHash(content_hash: string): Promise<number[] | null> {
    // This would require a direct database query to get the full embedding
    // For now, return null to force regeneration
    return null;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.vectorSearch.close();
  }
}
