import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { VectorService } from '../db/vector';

export interface OpenRouterBYOKConfig {
  openrouterApiKey: string;
  openaiApiKey: string;
  model?: string; // e.g. 'openai/text-embedding-3-small' or 'text-embedding-3-small'
  fallbackToDirect?: boolean;
}

export class OpenRouterBYOKEmbeddingService {
  private openai: OpenAI;
  private vectorService: VectorService;
  private model: string;

  constructor(config: OpenRouterBYOKConfig, prisma: PrismaClient) {
    // For now we use direct OpenAI with BYOK key; OpenRouter routing can be added later
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    // Normalize model id if prefixed
    this.model = (config.model || 'text-embedding-3-small').replace(/^openai\//, '');
    this.vectorService = new VectorService(prisma);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await this.openai.embeddings.create({ model: this.model, input: text });
    return res.data[0].embedding;
  }

  async storeDocument(documentId: string, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    await this.vectorService.upsertEmbedding({
      documentId,
      content,
      embedding,
      metadata: {
        ...metadata,
        model: this.model,
        contentLength: content.length,
        updatedAt: new Date().toISOString()
      }
    });
  }

  async findSimilarDocuments(query: string, options: { threshold?: number; limit?: number } = {}) {
    const embedding = await this.generateEmbedding(query);
    return this.vectorService.findSimilarDocuments({
      embedding,
      threshold: options.threshold ?? 0.7,
      limit: options.limit ?? 5
    });
  }

  async ragQuery(query: string, options: { threshold?: number; limit?: number } = {}) {
    const docs = await this.findSimilarDocuments(query, options);
    const context = docs.map((d: any, i: number) => `Document ${i + 1}:\n${d.content}`).join('\n\n');
    return {
      query,
      context,
      documents: docs,
      model: this.model,
      timestamp: new Date().toISOString()
    };
  }

  async getStats() {
    const stats = await this.vectorService.getEmbeddingStats();
    return { stats, model: this.model, timestamp: new Date().toISOString() };
  }

  async cleanupOldEmbeddings(daysToKeep = 30) {
    const result = await this.vectorService.cleanupOldEmbeddings(daysToKeep);
    return { deletedCount: result.deletedCount, model: this.model, timestamp: new Date().toISOString() };
  }
}

export default OpenRouterBYOKEmbeddingService;
