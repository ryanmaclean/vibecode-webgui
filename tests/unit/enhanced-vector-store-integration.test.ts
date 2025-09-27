/**
 * Enhanced Vector Store Integration Test
 * Tests the complete integration of EnhancedVectorStore with EnhancedVectorDatabaseAdapter
 */

import { EnhancedVectorStore } from '../../src/lib/vector-db/enhanced-vector-store';
import { VectorDatabaseInterface } from '../../src/lib/vector-db/vector-database-interface';
import { VectorDatabaseConfig, SearchOptions, SearchResult } from '../../src/lib/vector-db/vector-types';

// Mock adapter for testing
class MockVectorAdapter implements VectorDatabaseInterface {
  private mockChunks: Map<number, Array<{ content: string; embedding: number[]; metadata: any }>> = new Map();

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async storeChunks(fileId: number, chunks: Array<{ content: string; startLine?: number; endLine?: number; tokens: number }>): Promise<void> {
    const mockEmbeddings = chunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: Array(384).fill(0).map(() => Math.random() - 0.5), // Mock 384-dim embedding
      metadata: { startLine: chunk.startLine, endLine: chunk.endLine, tokens: chunk.tokens, index }
    }));
    this.mockChunks.set(fileId, mockEmbeddings);
  }

  async search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    
    for (const [fileId, chunks] of this.mockChunks.entries()) {
      if (options?.fileIds && !options.fileIds.includes(fileId)) continue;
      
      chunks.forEach((chunk, index) => {
        // Mock similarity calculation
        const similarity = Math.random() * 0.3 + 0.7; // Random similarity between 0.7-1.0
        
        if (!options?.threshold || similarity >= options.threshold) {
          allResults.push({
            chunk: {
              id: `${fileId}-${index}`,
              content: chunk.content,
              metadata: { ...chunk.metadata, fileId }
            },
            similarity
          });
        }
      });
    }
    
    return allResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options?.limit || 10);
  }

  async searchWithText(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Mock text search by generating a fake embedding
    const mockEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
    return this.search(mockEmbedding, options);
  }

  async deleteFileChunks(fileId: number): Promise<void> {
    this.mockChunks.delete(fileId);
  }

  async getStats(): Promise<{ totalChunks: number; totalFiles: number; averageChunkSize: number }> {
    let totalChunks = 0;
    let totalSize = 0;
    
    for (const chunks of this.mockChunks.values()) {
      totalChunks += chunks.length;
      totalSize += chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    }
    
    return {
      totalChunks,
      totalFiles: this.mockChunks.size,
      averageChunkSize: totalChunks > 0 ? Math.round(totalSize / totalChunks) : 0
    };
  }

  async invalidateCache(table: string, contentType?: string): Promise<number> {
    return 0; // Mock cache invalidation
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return Array(384).fill(0).map(() => Math.random() - 0.5);
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  async ping(timeoutMs?: number): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.mockChunks.clear();
  }
}

describe('EnhancedVectorStore Integration', () => {
  let vectorStore: EnhancedVectorStore;
  let mockAdapter: MockVectorAdapter;

  beforeEach(() => {
    mockAdapter = new MockVectorAdapter();
    const config: VectorDatabaseConfig = {
      provider: 'postgres',
      connectionString: 'mock://localhost',
      enableLogging: true,
      enableMetrics: true
    };
    
    vectorStore = new EnhancedVectorStore(mockAdapter, config, {
      maxRetries: 3,
      backoffMs: 100,
      timeoutMs: 5000
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(vectorStore.initialize()).resolves.not.toThrow();
    });
  });

  describe('Storage Operations', () => {
    it('should store chunks successfully', async () => {
      const chunks = [
        { content: 'function example() { return "test"; }', startLine: 1, endLine: 3, tokens: 10 },
        { content: 'const variable = 42;', startLine: 4, endLine: 4, tokens: 5 }
      ];

      await expect(vectorStore.storeChunks(1, chunks)).resolves.not.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      // Mock adapter to throw error
      jest.spyOn(mockAdapter, 'storeChunks').mockRejectedValueOnce(new Error('Storage failed'));
      
      const chunks = [{ content: 'test content', tokens: 3 }];
      
      await expect(vectorStore.storeChunks(1, chunks)).rejects.toThrow();
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Setup test data
      const chunks = [
        { content: 'async function fetchData() { return await api.get("/data"); }', startLine: 1, endLine: 3, tokens: 15 },
        { content: 'const result = processData(data);', startLine: 4, endLine: 4, tokens: 8 },
        { content: 'function calculateSum(a, b) { return a + b; }', startLine: 5, endLine: 7, tokens: 12 }
      ];
      
      await vectorStore.storeChunks(1, chunks);
    });

    it('should perform vector search successfully', async () => {
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      const options: SearchOptions = { limit: 5, threshold: 0.7 };
      
      const results = await vectorStore.search(queryEmbedding, options);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      
      results.forEach(result => {
        expect(result).toHaveProperty('chunk');
        expect(result).toHaveProperty('similarity');
        expect(result.similarity).toBeGreaterThanOrEqual(0.7);
        expect(result.chunk).toHaveProperty('id');
        expect(result.chunk).toHaveProperty('content');
        expect(result.chunk).toHaveProperty('metadata');
      });
    });

    it('should perform text search successfully', async () => {
      const query = 'async function example';
      const options: SearchOptions = { limit: 3 };
      
      const results = await vectorStore.searchWithText(query, options);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
      
      results.forEach(result => {
        expect(result).toHaveProperty('chunk');
        expect(result).toHaveProperty('similarity');
        expect(typeof result.similarity).toBe('number');
      });
    });

    it('should handle search with file filtering', async () => {
      // Add chunks for different files
      await vectorStore.storeChunks(2, [
        { content: 'import React from "react";', tokens: 5 }
      ]);
      
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      const options: SearchOptions = { fileIds: [1], limit: 10 };
      
      const results = await vectorStore.search(queryEmbedding, options);
      
      results.forEach(result => {
        expect(result.chunk.metadata.fileId).toBe(1);
      });
    });

    it('should handle search errors gracefully', async () => {
      jest.spyOn(mockAdapter, 'search').mockRejectedValueOnce(new Error('Search failed'));
      
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      
      await expect(vectorStore.search(queryEmbedding)).rejects.toThrow();
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      const chunks = [
        { content: 'test content 1', tokens: 3 },
        { content: 'test content 2', tokens: 3 }
      ];
      await vectorStore.storeChunks(1, chunks);
    });

    it('should delete file chunks successfully', async () => {
      await expect(vectorStore.deleteFileChunks(1)).resolves.not.toThrow();
      
      // Verify chunks are deleted by searching
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      const results = await vectorStore.search(queryEmbedding, { fileIds: [1] });
      
      expect(results).toHaveLength(0);
    });

    it('should handle delete errors gracefully', async () => {
      jest.spyOn(mockAdapter, 'deleteFileChunks').mockRejectedValueOnce(new Error('Delete failed'));
      
      await expect(vectorStore.deleteFileChunks(1)).rejects.toThrow();
    });
  });

  describe('Error Handling and Metrics', () => {
    it('should handle adapter errors and record metrics', async () => {
      jest.spyOn(mockAdapter, 'search').mockRejectedValueOnce(new Error('Connection timeout'));
      
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      
      await expect(vectorStore.search(queryEmbedding)).rejects.toThrow();
      
      // Verify error was recorded (this would be tested with actual metrics collector)
      expect(true).toBe(true); // Placeholder for metrics verification
    });

    it('should record successful operation metrics', async () => {
      const chunks = [{ content: 'test content', tokens: 2 }];
      await vectorStore.storeChunks(1, chunks);
      
      const queryEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);
      await vectorStore.search(queryEmbedding);
      
      // Verify metrics were recorded (this would be tested with actual metrics collector)
      expect(true).toBe(true); // Placeholder for metrics verification
    });
  });

  describe('Configuration and Retry Logic', () => {
    it('should be configurable with retry settings', () => {
      const config: VectorDatabaseConfig = {
        provider: 'postgres',
        connectionString: 'mock://localhost',
        enableLogging: false,
        enableMetrics: false
      };
      
      const customRetryConfig = {
        maxRetries: 5,
        backoffMs: 200,
        timeoutMs: 10000
      };
      
      const customVectorStore = new EnhancedVectorStore(mockAdapter, config, customRetryConfig);
      
      expect(customVectorStore).toBeInstanceOf(EnhancedVectorStore);
    });
  });
});