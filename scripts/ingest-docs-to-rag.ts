#!/usr/bin/env tsx

/**
 * Documentation RAG Ingestion Script
 * 
 * This script processes all consolidated documentation files and stores them
 * in the pgvector database for semantic search and RAG functionality.
 * 
 * Features:
 * - Processes all markdown files in the Astro docs directory
 * - Chunks documents for optimal retrieval
 * - Generates embeddings using Azure OpenAI
 * - Stores in pgvector with metadata
 * - Progress tracking and error handling
 * - Deduplication support
 */

import fs from 'fs/promises';
import path from 'path';
import { AzureEmbeddingService } from '../src/lib/ai/azureEmbeddingService';
import { EmbeddingService } from '../src/lib/ai/embeddingService';
import { VectorService } from '../src/lib/db/vector';
import { PrismaClient } from '@prisma/client';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { datadogMetrics } from '../src/lib/monitoring/datadog-metrics';
import type { MetricData } from '../src/lib/monitoring/metrics-types';
import OpenAI from 'openai';
import { generateLocalEmbedding } from '../src/lib/ai/localEmbedding';
import { llmObservability } from '../src/lib/datadog-llm';

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    description?: string;
    category?: string;
    chunkIndex: number;
    totalChunks: number;
    lastModified?: string;
  };
}

class DocumentationRAGIngester {
  private azureEmbeddingService: AzureEmbeddingService | null = null;
  private openAIEmbeddingService: EmbeddingService | null = null;
  private vectorService: VectorService;
  private prisma: PrismaClient;
  private textSplitter: RecursiveCharacterTextSplitter;
  private ddEnv: string;
  private useOpenRouter: boolean;
  private useOpenAI: boolean;
  private openRouterClient: OpenAI | null = null;
  private openRouterEmbeddingModel: string;
  private useLocalEmbeddings: boolean;
  private localEmbeddingDimensions: number;
  private openAIEmbeddingModel: string;
  private maxConcurrency: number;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.vectorService = new VectorService(this.prisma);

    this.useOpenRouter = process.env.USE_OPENROUTER === 'true';
    this.useLocalEmbeddings = process.env.USE_LOCAL_EMBEDDINGS === 'true';
    this.openAIEmbeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.openRouterEmbeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.localEmbeddingDimensions = parseInt(process.env.LOCAL_EMBEDDING_DIM || '1536', 10);
    const openAIKey = process.env.OPENAI_API_KEY;
    this.useOpenAI = !this.useLocalEmbeddings && !this.useOpenRouter && Boolean(openAIKey);

    if (this.useLocalEmbeddings) {
      console.log(`ℹ️  Using local hashing-based embeddings with dimension ${this.localEmbeddingDimensions}`);
    } else if (this.useOpenRouter) {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        throw new Error('OPENROUTER_API_KEY is required when USE_OPENROUTER=true.');
      }

      this.openRouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openRouterKey,
        defaultHeaders: {
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://vibecode.ai',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'VibeCode WebGUI'
        }
      });

      if (openAIKey) {
        console.log('ℹ️  OpenRouter embeddings enabled with OpenAI fallback');
        this.openAIEmbeddingService = new EmbeddingService(openAIKey, this.openAIEmbeddingModel, this.prisma);
      }
    } else if (this.useOpenAI) {
      if (!openAIKey) {
        throw new Error('OPENAI_API_KEY must be provided for OpenAI embedding mode.');
      }

      console.log(`ℹ️  Using OpenAI embeddings model: ${this.openAIEmbeddingModel}`);
      this.openAIEmbeddingService = new EmbeddingService(openAIKey, this.openAIEmbeddingModel, this.prisma);
    } else {
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-ada-002';
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

      if (!apiKey || !endpoint) {
        throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required when USE_OPENROUTER is not true.');
      }

      this.azureEmbeddingService = new AzureEmbeddingService(
        apiKey,
        endpoint,
        deploymentName,
        apiVersion,
        this.prisma,
        false,
        false
      );
    }
    
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });

    this.ddEnv = process.env.DD_ENV || process.env.NODE_ENV || 'development';
    const defaultConcurrency = this.useOpenAI ? '4' : this.useOpenRouter ? '3' : '2';
    this.maxConcurrency = Math.max(1, parseInt(process.env.RAG_MAX_CONCURRENCY || defaultConcurrency, 10));

    if (this.maxConcurrency > 1) {
      console.log(`⚡ Concurrent ingestion enabled (max ${this.maxConcurrency} chunks at a time)`);
    }
  }

  /**
   * Extract frontmatter and content from markdown file
   */
  private parseFrontmatter(content: string): { frontmatter: any; content: string } {
    const frontmatterRegex = /^---\n(.*?)\n---\n(.*)$/s;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, content };
    }
    
    const frontmatterText = match[1];
    const bodyContent = match[2];
    
    // Simple YAML parsing for common frontmatter fields
    const frontmatter: any = {};
    frontmatterText.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
        frontmatter[key] = value;
      }
    });
    
    return { frontmatter, content: bodyContent };
  }

  /**
   * Get category from file path
   */
  private getCategory(filePath: string): string {
    const relativePath = path.relative('/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs', filePath);
    const segments = relativePath.split('/');
    
    if (segments.length > 1) {
      return segments[0]; // First directory is the category
    }
    
    // Categorize based on filename patterns
    const filename = path.basename(filePath, '.md');
    if (filename.startsWith('mcp-')) return 'MCP Framework';
    if (filename.includes('test')) return 'Testing';
    if (filename.includes('deploy') || filename.includes('production')) return 'Deployment';
    if (filename.includes('security')) return 'Security';
    if (filename.includes('ai') || filename.includes('genai')) return 'AI Integration';
    if (filename.includes('kubernetes') || filename.includes('k8s')) return 'Kubernetes';
    if (filename.includes('docker')) return 'Docker';
    
    return 'General';
  }

  /**
   * Process a single markdown file
   */
  private async processMarkdownFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, content: bodyContent } = this.parseFrontmatter(content);
      
      // Get file stats for metadata
      const stats = await fs.stat(filePath);
      
      // Split content into chunks
      const chunks = await this.textSplitter.createDocuments([bodyContent]);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        id: `docs:${path.basename(filePath, '.md')}:chunk:${index}`,
        content: chunk.pageContent,
        metadata: {
          source: filePath,
          title: frontmatter.title || path.basename(filePath, '.md'),
          description: frontmatter.description,
          category: this.getCategory(filePath),
          chunkIndex: index,
          totalChunks: chunks.length,
          lastModified: stats.mtime.toISOString()
        }
      }));
      
      return documentChunks;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get all markdown files from the docs directory
   */
  private async getMarkdownFiles(): Promise<string[]> {
    const docsEnv = process.env.RAG_DOCS_PATH || '/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs';
    const docsTarget = path.isAbsolute(docsEnv) ? docsEnv : path.join(process.cwd(), docsEnv);

    const stats = await fs.stat(docsTarget);

    if (stats.isFile()) {
      if (docsTarget.endsWith('.md') || docsTarget.endsWith('.mdx')) {
        return [docsTarget];
      }
      console.warn(`⚠️  RAG_DOCS_PATH points to a non-markdown file: ${docsTarget}`);
      return [];
    }

    const includeRegex = process.env.RAG_INCLUDE_REGEX ? new RegExp(process.env.RAG_INCLUDE_REGEX, 'i') : null;
    const excludeRegex = process.env.RAG_EXCLUDE_REGEX ? new RegExp(process.env.RAG_EXCLUDE_REGEX, 'i') : null;
    const docsRoot = docsTarget;
    const files: string[] = [];

    async function walkDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          const relativePath = path.relative(docsRoot, fullPath);
          if (includeRegex && !includeRegex.test(relativePath)) {
            continue;
          }
          if (excludeRegex && excludeRegex.test(relativePath)) {
            continue;
          }
          files.push(fullPath);
        }
      }
    }

    await walkDir(docsTarget);
    return files;
  }

  /**
   * Sanitize values so they are safe for Datadog tags
   */
  private sanitizeTagValue(value?: string): string {
    if (!value) {
      return 'unknown';
    }
    return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64) || 'unknown';
  }

  private getActiveEmbeddingModel(): string {
    if (this.useLocalEmbeddings) {
      return `local-${this.localEmbeddingDimensions}`;
    }

    if (this.useOpenRouter) {
      return this.openRouterEmbeddingModel;
    }

    if (this.useOpenAI && this.openAIEmbeddingService) {
      return this.openAIEmbeddingModel;
    }

    if (this.azureEmbeddingService) {
      const azureDeployment = (this.azureEmbeddingService as any)?.deploymentName;
      return (
        azureDeployment ||
        process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME ||
        process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING ||
        'azure-openai-embedding'
      );
    }

    return 'unknown';
  }

  /**
   * Emit Datadog metrics for each processed chunk so ingestion progress is observable
   */
  private async recordChunkMetric(
    chunk: DocumentChunk,
    durationMs: number,
    success: boolean,
    attempt: number,
    error?: Error
  ): Promise<void> {
    const tags: Record<string, string> = {
      component: 'rag_ingest',
      env: this.ddEnv,
      chunk_status: success ? 'success' : 'error',
      category: this.sanitizeTagValue(chunk.metadata.category),
      source: this.sanitizeTagValue(path.basename(chunk.metadata.source)),
      chunk_index: String(chunk.metadata.chunkIndex),
      total_chunks: String(chunk.metadata.totalChunks),
      retry_count: String(Math.max(attempt - 1, 0))
    };

    tags.embedding_model = this.sanitizeTagValue(this.getActiveEmbeddingModel());

    if (error) {
      tags.error_type = this.sanitizeTagValue(error.name || 'error');
    }

    const metrics: MetricData[] = [
      {
        name: 'rag.ingest.chunks_processed',
        value: 1,
        tags
      },
      {
        name: 'rag.ingest.chunk_duration_ms',
        value: durationMs,
        tags
      }
    ];

    try {
      await datadogMetrics.sendBatchMetrics(metrics);
    } catch (metricError) {
      console.warn('⚠️  Failed to emit Datadog chunk metrics:', metricError);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimitError(error: unknown): boolean {
    const err = error as any;
    if (!err) return false;
    if (err.response?.status === 429) return true;
    const message: string = err.message || '';
    return message.toLowerCase().includes('rate limit');
  }

  private extractRetryAfter(error: any): number | null {
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (!retryAfter) return null;
    const numeric = Number(retryAfter);
    if (!Number.isNaN(numeric)) {
      return numeric * 1000;
    }
    return null;
  }

  private async createEmbedding(text: string): Promise<number[]> {
    if (this.useLocalEmbeddings) {
      return generateLocalEmbedding(text, this.localEmbeddingDimensions);
    }

    if (this.useOpenRouter) {
      if (!this.openRouterClient) {
        throw new Error('OpenRouter client not initialised');
      }

      try {
        const response = await this.openRouterClient.embeddings.create({
          model: this.openRouterEmbeddingModel,
          input: text,
        });

        const embedding = response.data?.[0]?.embedding;
        if (embedding && embedding.length) {
          return embedding;
        }

        console.warn(`⚠️  OpenRouter returned no embedding data (model ${this.openRouterEmbeddingModel}); falling back.`);
      } catch (error) {
        console.warn(`⚠️  OpenRouter embedding request failed: ${(error as Error).message}`);
      }

      if (this.openAIEmbeddingService) {
        return this.openAIEmbeddingService.generateEmbedding(text);
      }

      if (!this.azureEmbeddingService && !this.useLocalEmbeddings) {
        throw new Error('OpenRouter embedding failed and no fallback provider is configured');
      }
    }

    if (this.openAIEmbeddingService) {
      return this.openAIEmbeddingService.generateEmbedding(text);
    }

    if (!this.azureEmbeddingService) {
      throw new Error('Azure embedding service not initialised');
    }

    return this.azureEmbeddingService.generateEmbedding(text);
  }

  private async processChunk(chunk: DocumentChunk): Promise<void> {
    const maxAttempts = parseInt(process.env.RAG_CHUNK_MAX_ATTEMPTS || '5', 10);
    const baseRateLimitDelayMs = parseInt(process.env.RAG_RATE_LIMIT_DELAY_MS || '8000', 10);
    const backoffBaseMs = parseInt(process.env.RAG_RETRY_BACKOFF_MS || '2000', 10);

    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      const chunkStart = Date.now();

      try {
        const embedding = await this.createEmbedding(chunk.content);

        await this.vectorService.upsertEmbedding({
          documentId: chunk.id,
          content: chunk.content,
          embedding,
          metadata: chunk.metadata
        });

        llmObservability.annotate({
          metadata: {
            chunk_id: chunk.id,
            embedding_model: this.getActiveEmbeddingModel(),
            chunk_index: chunk.metadata.chunkIndex,
            total_chunks: chunk.metadata.totalChunks,
          },
          tags: ['rag_ingest', 'embedding'],
        });

        console.log(`✅ Stored chunk: ${chunk.id}`);
        await this.recordChunkMetric(chunk, Date.now() - chunkStart, true, attempt);
        return;
      } catch (error: any) {
        const duration = Date.now() - chunkStart;
        console.error(`❌ Failed to store chunk ${chunk.id} (attempt ${attempt}):`, error?.message || error);
        await this.recordChunkMetric(
          chunk,
          duration,
          false,
          attempt,
          error instanceof Error ? error : undefined
        );

        if (this.isRateLimitError(error)) {
          const retryDelay = this.extractRetryAfter(error) ?? baseRateLimitDelayMs * attempt;
          console.warn(`⏳ Rate limit encountered; waiting ${retryDelay}ms before retrying chunk ${chunk.id}`);

          datadogMetrics.recordError('rate_limit', 'rag_ingest', 'azure_openai_embeddings', {
            tags: {
              component: 'rag_ingest',
              env: this.ddEnv,
              chunk_id: this.sanitizeTagValue(chunk.id),
              attempt: String(attempt)
            }
          });

          await this.sleep(retryDelay);
          continue;
        }

        if (attempt < maxAttempts) {
          const backoff = Math.min(backoffBaseMs * attempt * attempt, 30000);
          console.warn(`🔄 Retrying chunk ${chunk.id} in ${backoff}ms`);
          await this.sleep(backoff);
        } else {
          console.error(`🚫 Giving up on chunk ${chunk.id} after ${attempt} attempts.`);
        }
      }
    }
  }

  /**
   * Store document chunks in the vector database sequentially with rate-limit awareness
   */
  private async storeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    const interChunkDelayMs = parseInt(process.env.RAG_INTER_CHUNK_DELAY_MS || '250', 10);
    const concurrency = this.maxConcurrency;

    if (concurrency <= 1) {
      for (const chunk of chunks) {
        await this.processChunk(chunk);
        if (interChunkDelayMs > 0) {
          await this.sleep(interChunkDelayMs);
        }
      }
      return;
    }

    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);

      await Promise.all(
        batch.map(chunk =>
          this.processChunk(chunk).catch(error => {
            console.error(`Chunk ${chunk.id} encountered an unexpected error`, error);
          })
        )
      );

      if (interChunkDelayMs > 0) {
        await this.sleep(interChunkDelayMs);
      }
    }
  }

  /**
   * Main ingestion process
   */
  async ingestDocumentation(): Promise<void> {
    console.log('🚀 Starting documentation RAG ingestion...');
    
    try {
      // Get all markdown files
      let markdownFiles = await this.getMarkdownFiles();
      const maxFiles = parseInt(process.env.RAG_MAX_FILES || '0', 10);
      if (maxFiles > 0 && markdownFiles.length > maxFiles) {
        console.warn(`⚠️  Limiting ingestion to first ${maxFiles} file(s) out of ${markdownFiles.length}`);
        markdownFiles = markdownFiles.slice(0, maxFiles);
      }
      console.log(`📚 Using ${markdownFiles.length} documentation file(s) for ingestion`);
      console.log(`🧠 Embedding model: ${this.getActiveEmbeddingModel()}`);
      
      // Process all files and collect chunks
      const allChunks: DocumentChunk[] = [];
      
      for (const filePath of markdownFiles) {
        console.log(`📄 Processing: ${path.basename(filePath)}`);
        const chunks = await this.processMarkdownFile(filePath);
        allChunks.push(...chunks);
      }
      
      console.log(`📦 Generated ${allChunks.length} document chunks`);

      const maxChunks = parseInt(process.env.RAG_MAX_CHUNKS || '0', 10);
      let chunksToIngest = allChunks;
      if (maxChunks > 0 && allChunks.length > maxChunks) {
        console.warn(`⚠️  Limiting ingestion to first ${maxChunks} chunk(s) out of ${allChunks.length}`);
        chunksToIngest = allChunks.slice(0, maxChunks);
      }
      
      // Store chunks in vector database
      console.log('💾 Storing chunks in vector database...');
      await this.storeDocumentChunks(chunksToIngest);
      
      // Generate summary statistics
      const categories = [...new Set(allChunks.map(chunk => chunk.metadata.category))];
      const categoryCounts = categories.map(category => ({
        category,
        count: allChunks.filter(chunk => chunk.metadata.category === category).length
      }));
      
      console.log('\n📊 Ingestion Summary:');
      console.log(`Total files processed: ${markdownFiles.length}`);
      console.log(`Total chunks generated: ${allChunks.length}`);
      console.log(`Categories:`);
      categoryCounts.forEach(({ category, count }) => {
        console.log(`  - ${category}: ${count} chunks`);
      });
      
      console.log('\n✅ Documentation RAG ingestion completed successfully!');
      
    } catch (error) {
      console.error('❌ Error during ingestion:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Test the ingested data by performing a sample search
   */
  async testSearch(query: string = 'How to deploy to production'): Promise<void> {
    console.log(`\n🔍 Testing search with query: "${query}"`);
    
    try {
      const queryEmbedding = await this.createEmbedding(query);
      const results = await this.vectorService.findSimilarDocuments({
        embedding: queryEmbedding,
        threshold: 0.7,
        limit: 5
      });
      
      console.log(`Found ${results.length} relevant documents:`);
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.document_id} (similarity: ${result.similarity?.toFixed(3)})`);
        console.log(`   Content preview: ${result.content.substring(0, 100)}...`);
      });
      
    } catch (error) {
      console.error('❌ Error during search test:', error);
    }
  }
}

// Main execution
async function main() {
  const ingester = new DocumentationRAGIngester();
  
  try {
    await ingester.ingestDocumentation();
    if (process.env.RAG_SKIP_TEST_SEARCH === 'true') {
      console.log('ℹ️  Skipping post-ingestion search validation (RAG_SKIP_TEST_SEARCH=true).');
    } else {
      await ingester.testSearch();
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DocumentationRAGIngester };
