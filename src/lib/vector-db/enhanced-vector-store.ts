/**
 * Enhanced Vector Store - Multi-Provider Interface
 * Moved and adapted from src/lib/vector-stores/enhanced-vector-store.ts
 * Provides unified access to multiple vector database providers with intelligent routing
 */

import { vectorStore as pgVectorStore } from '../vector-store';
import { weaviateStore } from './weaviate-adapter';
import { VectorStoreService } from './vector-store-service';
import { getDatabaseMetricsCollector } from '../db/db-metrics';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';

export interface VectorStoreProvider {
  id: 'pgvector' | 'weaviate' | 'postgres-adapter';
  name: string;
  available: boolean;
  features: {
    semanticSearch: boolean;
    hybridSearch: boolean;
    generativeSearch: boolean;
    clustering: boolean;
    multiTenancy: boolean;
  };
  performance: {
    avgQueryTime: number;
    indexSize: number;
    throughput: number;
  };
}

export interface UnifiedSearchOptions extends SearchOptions {
  query: string;
  provider?: 'pgvector' | 'weaviate' | 'postgres-adapter' | 'auto';
  searchType?: 'semantic' | 'hybrid' | 'generative';
  generativePrompt?: string;
  preferredProviders?: ('pgvector' | 'weaviate' | 'postgres-adapter')[];
}

export interface UnifiedSearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: {
    fileId: number;
    fileName: string;
    startLine?: number;
    endLine?: number;
    language?: string;
    tokens: number;
    provider: 'pgvector' | 'weaviate' | 'postgres-adapter';
  };
  generatedText?: string;
}

export interface VectorStoreStats {
  providers: VectorStoreProvider[];
  totalDocuments: number;
  totalWorkspaces: number;
  storageUsed: string;
  performance: {
    avgQueryTime: number;
    queriesPerSecond: number;
    errorRate: number;
  };
}

/**
 * Enhanced Vector Store providing unified access to multiple providers
 */
export class EnhancedVectorStore {
  private providers: Map<string, boolean> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 300000; // 5 minutes
  private dbMetricsCollector = getDatabaseMetricsCollector();
  private mainVectorStore: VectorStoreService;

  constructor() {
    this.mainVectorStore = new VectorStoreService();
    this.initializeProviders();
  }

  /**
   * Initialize and check availability of all providers
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Check main vector store (PostgreSQL adapter pattern)
      await this.mainVectorStore.initialize();
      const mainStats = await this.mainVectorStore.getStats();
      this.providers.set('postgres-adapter', mainStats.totalChunks >= 0);
    } catch (error) {
      console.warn('Main vector store not available:', error);
      this.providers.set('postgres-adapter', false);
    }

    try {
      // Check legacy PostgreSQL pgvector
      const pgStats = await pgVectorStore.getStats();
      this.providers.set('pgvector', pgStats.totalChunks >= 0);
    } catch (error) {
      console.warn('PostgreSQL pgvector not available:', error);
      this.providers.set('pgvector', false);
    }

    try {
      // Check Weaviate
      const weaviateAvailable = await weaviateStore.isAvailable();
      this.providers.set('weaviate', weaviateAvailable);
    } catch (error) {
      console.warn('Weaviate not available:', error);
      this.providers.set('weaviate', false);
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<VectorStoreStats> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      // Use cached results if recent
    } else {
      await this.initializeProviders();
      this.lastHealthCheck = now;
    }

    const providers: VectorStoreProvider[] = [];
    let totalDocuments = 0;

    // Main PostgreSQL adapter stats
    if (this.providers.get('postgres-adapter')) {
      try {
        const mainStats = await this.mainVectorStore.getStats();
        providers.push({
          id: 'postgres-adapter',
          name: 'PostgreSQL Vector Adapter',
          available: true,
          features: {
            semanticSearch: true,
            hybridSearch: false,
            generativeSearch: false,
            clustering: false,
            multiTenancy: true
          },
          performance: {
            avgQueryTime: this.getAvgMetric('postgres_adapter_query_time', 150),
            indexSize: mainStats.totalChunks,
            throughput: this.getAvgMetric('postgres_adapter_throughput', 60)
          }
        });
        totalDocuments += mainStats.totalChunks;
      } catch {
        this.providers.set('postgres-adapter', false);
      }
    }

    // Legacy PostgreSQL pgvector stats
    if (this.providers.get('pgvector')) {
      try {
        const pgStats = await pgVectorStore.getStats();
        providers.push({
          id: 'pgvector',
          name: 'PostgreSQL pgvector (Legacy)',
          available: true,
          features: {
            semanticSearch: true,
            hybridSearch: false,
            generativeSearch: false,
            clustering: false,
            multiTenancy: true
          },
          performance: {
            avgQueryTime: this.getAvgMetric('pgvector_query_time', 150),
            indexSize: pgStats.totalChunks,
            throughput: this.getAvgMetric('pgvector_throughput', 50)
          }
        });
        totalDocuments += pgStats.totalChunks;
      } catch {
        this.providers.set('pgvector', false);
      }
    }

    // Weaviate stats
    if (this.providers.get('weaviate')) {
      try {
        const weaviateStats = await weaviateStore.isAvailable();
        if (weaviateStats) {
          providers.push({
            id: 'weaviate',
            name: 'Weaviate Vector Database',
            available: true,
            features: {
              semanticSearch: true,
              hybridSearch: true,
              generativeSearch: true,
              clustering: true,
              multiTenancy: true
            },
            performance: {
              avgQueryTime: this.getAvgMetric('weaviate_query_time', 200),
              indexSize: 0, // Would need to query Weaviate for actual stats
              throughput: this.getAvgMetric('weaviate_throughput', 80)
            }
          });
        }
      } catch {
        this.providers.set('weaviate', false);
      }
    }

    return {
      providers,
      totalDocuments,
      totalWorkspaces: 1, // Placeholder
      storageUsed: `${Math.round(totalDocuments * 0.5)}KB`, // Rough estimate
      performance: {
        avgQueryTime: this.getAvgMetric('overall_query_time', 175),
        queriesPerSecond: this.getAvgMetric('overall_qps', 5.7),
        errorRate: this.getAvgMetric('overall_error_rate', 0.02)
      }
    };
  }

  /**
   * Unified search across providers with intelligent routing
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const provider = await this.selectOptimalProvider(options);
    const startTime = Date.now();

    try {
      let results: UnifiedSearchResult[] = [];

      switch (provider) {
        case 'postgres-adapter':
          results = await this.searchWithPostgresAdapter(options);
          break;
        case 'pgvector':
          results = await this.searchWithPGVector(options);
          break;
        case 'weaviate':
          results = await this.searchWithWeaviate(options);
          break;
        default:
          // Auto-select or fallback
          results = await this.searchWithFallback(options);
      }

      // Record performance metrics
      const queryTime = Date.now() - startTime;
      this.recordMetric(`${provider}_query_time`, queryTime);
      this.recordMetric('overall_query_time', queryTime);

      return results;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.recordMetric(`${provider}_error`, 1);
      this.recordMetric('overall_error_rate', 1);
      
      console.error(`Search failed with provider ${provider}:`, error);
      
      // Try fallback if main provider failed
      if (provider !== 'auto') {
        return this.searchWithFallback(options);
      }
      
      throw error;
    }
  }

  /**
   * Store chunks using the optimal provider
   */
  async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    // Always use the main vector store for storing
    await this.mainVectorStore.storeChunks(fileId, chunks);
    
    // Optionally replicate to other providers for redundancy
    // This could be made configurable
    if (this.providers.get('weaviate') && process.env.VECTOR_STORE_REPLICATION === 'true') {
      try {
        // Convert chunks to Weaviate format and store
        console.log('Replicating to Weaviate (not implemented yet)');
      } catch (error) {
        console.warn('Failed to replicate to Weaviate:', error);
      }
    }
  }

  /**
   * Delete file chunks from all providers
   */
  async deleteFileChunks(fileId: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.providers.get('postgres-adapter')) {
      promises.push(this.mainVectorStore.deleteFileChunks(fileId));
    }
    
    if (this.providers.get('pgvector')) {
      promises.push(pgVectorStore.deleteFileChunks(fileId));
    }
    
    // Add Weaviate deletion when implemented
    
    await Promise.allSettled(promises);
  }

  /**
   * Select optimal provider based on options and availability
   */
  private async selectOptimalProvider(options: UnifiedSearchOptions): Promise<string> {
    if (options.provider && options.provider !== 'auto') {
      return options.provider;
    }

    // Prefer postgres-adapter as it's the most complete
    if (this.providers.get('postgres-adapter')) {
      return 'postgres-adapter';
    }

    // Fallback to legacy pgvector
    if (this.providers.get('pgvector')) {
      return 'pgvector';
    }

    // Use Weaviate for advanced features
    if (options.searchType === 'hybrid' || options.searchType === 'generative') {
      if (this.providers.get('weaviate')) {
        return 'weaviate';
      }
    }

    return 'auto'; // Will trigger fallback logic
  }

  private async searchWithPostgresAdapter(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const results = await this.mainVectorStore.search(options.query, {
      workspaceId: options.workspaceId,
      limit: options.limit,
      threshold: options.threshold,
    });

    return results.map(result => ({
      id: result.chunk.id,
      content: result.chunk.content,
      similarity: result.similarity,
      metadata: {
        ...result.chunk.metadata,
        provider: 'postgres-adapter' as const,
      },
    }));
  }

  private async searchWithPGVector(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const context = await pgVectorStore.getContext(
      options.query,
      options.workspaceId,
      4000,
      options.threshold
    );

    // This is simplified - would need to parse the context back to individual results
    return [{
      id: 'pgvector-context',
      content: context,
      similarity: 0.8, // Placeholder
      metadata: {
        fileId: 0,
        fileName: 'context',
        tokens: context.length / 4,
        provider: 'pgvector' as const,
      },
    }];
  }

  private async searchWithWeaviate(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const results = await weaviateStore.search({
      query: options.query,
      limit: options.limit,
      certainty: options.threshold,
      workspaceId: options.workspaceId,
      hybrid: options.searchType === 'hybrid',
      generative: options.generativePrompt ? {
        singlePrompt: options.generativePrompt
      } : undefined,
    });

    return results.map(result => ({
      id: result.id,
      content: result.content,
      similarity: result.certainty,
      metadata: {
        fileId: result.metadata.fileId,
        fileName: result.metadata.fileName,
        startLine: result.metadata.startLine,
        endLine: result.metadata.endLine,
        language: result.metadata.language,
        tokens: result.metadata.tokens,
        provider: 'weaviate' as const,
      },
      generatedText: result.generatedText,
    }));
  }

  private async searchWithFallback(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    // Try providers in order of preference
    const fallbackOrder = ['postgres-adapter', 'pgvector', 'weaviate'];
    
    for (const provider of fallbackOrder) {
      if (this.providers.get(provider)) {
        try {
          switch (provider) {
            case 'postgres-adapter':
              return await this.searchWithPostgresAdapter(options);
            case 'pgvector':
              return await this.searchWithPGVector(options);
            case 'weaviate':
              return await this.searchWithWeaviate(options);
          }
        } catch (error) {
          console.warn(`Fallback provider ${provider} failed:`, error);
          continue;
        }
      }
    }

    throw new Error('No available vector database providers');
  }

  private getAvgMetric(key: string, defaultValue: number): number {
    const metrics = this.performanceMetrics.get(key);
    if (!metrics || metrics.length === 0) {
      return defaultValue;
    }
    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
  }

  private recordMetric(key: string, value: number): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(value);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  async close(): Promise<void> {
    await this.mainVectorStore.close();
    await weaviateStore.close();
  }
}

// Export singleton instance
export const enhancedVectorStore = new EnhancedVectorStore();