/**
 * Scale Testing Framework for pgvector
 * Tests performance with 100K+ embeddings
 */

import { VectorSearchService } from '@/lib/vector-search';
import { EmbeddingGenerator } from '@/lib/embedding-generator';
import { performance } from 'perf_hooks';

interface ScaleTestConfig {
  total_embeddings: number;
  batch_size: number;
  search_queries: number;
  concurrent_searches: number;
}

interface PerformanceMetrics {
  insertion_time_ms: number;
  avg_insertion_per_second: number;
  search_time_ms: number;
  avg_search_time_ms: number;
  memory_usage_mb: number;
  index_size_mb: number;
}

export class VectorScaleTest {
  private vectorSearch: VectorSearchService;
  private embeddingGenerator: EmbeddingGenerator;

  constructor() {
    this.vectorSearch = new VectorSearchService();
    this.embeddingGenerator = new EmbeddingGenerator();
  }

  /**
   * Run comprehensive scale test
   */
  async runScaleTest(config: ScaleTestConfig): Promise<{
    config: ScaleTestConfig;
    metrics: PerformanceMetrics;
    results: {
      insertion_phase: any;
      search_phase: any;
      concurrent_phase: any;
    };
  }> {
    console.log(`Starting scale test with ${config.total_embeddings} embeddings...`);

    // Phase 1: Bulk insertion test
    const insertionResults = await this.testBulkInsertion(
      config.total_embeddings,
      config.batch_size
    );

    // Phase 2: Search performance test
    const searchResults = await this.testSearchPerformance(
      config.search_queries
    );

    // Phase 3: Concurrent search test
    const concurrentResults = await this.testConcurrentSearches(
      config.concurrent_searches
    );

    // Collect metrics
    const metrics = await this.collectMetrics();

    return {
      config,
      metrics,
      results: {
        insertion_phase: insertionResults,
        search_phase: searchResults,
        concurrent_phase: concurrentResults
      }
    };
  }

  /**
   * Test bulk insertion performance
   */
  private async testBulkInsertion(totalEmbeddings: number, batchSize: number) {
    console.log(`Testing bulk insertion: ${totalEmbeddings} embeddings in batches of ${batchSize}`);
    
    const startTime = performance.now();
    let insertedCount = 0;
    const batchTimes: number[] = [];

    for (let i = 0; i < totalEmbeddings; i += batchSize) {
      const batchStart = performance.now();
      const batch = this.generateTestEmbeddings(
        Math.min(batchSize, totalEmbeddings - i),
        i
      );

      // Insert batch
      const promises = batch.map(async (embedding, idx) => {
        return this.vectorSearch.storeEmbedding(
          'code',
          `test_${i + idx}_${Date.now()}`,
          embedding.vector,
          {
            language: embedding.language,
            framework: embedding.framework,
            test_batch: Math.floor(i / batchSize),
            test_index: i + idx
          }
        );
      });

      await Promise.all(promises);
      
      const batchTime = performance.now() - batchStart;
      batchTimes.push(batchTime);
      insertedCount += batch.length;

      if (insertedCount % (batchSize * 10) === 0) {
        console.log(`Inserted ${insertedCount}/${totalEmbeddings} embeddings`);
      }
    }

    const totalTime = performance.now() - startTime;
    
    return {
      total_time_ms: totalTime,
      total_inserted: insertedCount,
      avg_insertion_per_second: (insertedCount / totalTime) * 1000,
      batch_times: batchTimes,
      avg_batch_time_ms: batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length
    };
  }

  /**
   * Test search performance
   */
  private async testSearchPerformance(searchQueries: number) {
    console.log(`Testing search performance: ${searchQueries} queries`);
    
    const searchTimes: number[] = [];
    const resultCounts: number[] = [];
    
    for (let i = 0; i < searchQueries; i++) {
      const queryEmbedding = this.generateRandomEmbedding();
      
      const startTime = performance.now();
      const results = await this.vectorSearch.similaritySearch(queryEmbedding, {
        limit: 10,
        similarity_threshold: 0.8
      });
      const searchTime = performance.now() - startTime;
      
      searchTimes.push(searchTime);
      resultCounts.push(results.length);
      
      if ((i + 1) % 100 === 0) {
        console.log(`Completed ${i + 1}/${searchQueries} search queries`);
      }
    }

    return {
      total_queries: searchQueries,
      search_times: searchTimes,
      avg_search_time_ms: searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length,
      min_search_time_ms: Math.min(...searchTimes),
      max_search_time_ms: Math.max(...searchTimes),
      p95_search_time_ms: this.percentile(searchTimes, 95),
      p99_search_time_ms: this.percentile(searchTimes, 99),
      avg_results_per_query: resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length
    };
  }

  /**
   * Test concurrent search performance
   */
  private async testConcurrentSearches(concurrentSearches: number) {
    console.log(`Testing concurrent searches: ${concurrentSearches} concurrent queries`);
    
    const startTime = performance.now();
    
    const searchPromises = Array.from({ length: concurrentSearches }, async (_, i) => {
      const queryEmbedding = this.generateRandomEmbedding();
      const queryStart = performance.now();
      
      const results = await this.vectorSearch.similaritySearch(queryEmbedding, {
        limit: 5,
        similarity_threshold: 0.7
      });
      
      const queryTime = performance.now() - queryStart;
      
      return {
        query_id: i,
        query_time_ms: queryTime,
        result_count: results.length
      };
    });

    const results = await Promise.all(searchPromises);
    const totalTime = performance.now() - startTime;
    
    const queryTimes = results.map(r => r.query_time_ms);
    
    return {
      concurrent_queries: concurrentSearches,
      total_time_ms: totalTime,
      queries_per_second: (concurrentSearches / totalTime) * 1000,
      avg_query_time_ms: queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length,
      min_query_time_ms: Math.min(...queryTimes),
      max_query_time_ms: Math.max(...queryTimes),
      p95_query_time_ms: this.percentile(queryTimes, 95),
      results
    };
  }

  /**
   * Collect database and system metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const stats = await this.vectorSearch.getStats();
    
    // Get memory usage (simplified)
    const memoryUsage = process.memoryUsage();
    
    return {
      insertion_time_ms: 0, // Will be filled by caller
      avg_insertion_per_second: 0, // Will be filled by caller
      search_time_ms: 0, // Will be filled by caller
      avg_search_time_ms: 0, // Will be filled by caller
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
      index_size_mb: 0 // TODO: Query database for actual index size
    };
  }

  /**
   * Generate test embeddings with realistic patterns
   */
  private generateTestEmbeddings(count: number, startIndex: number) {
    const languages = ['typescript', 'javascript', 'python', 'go', 'rust'];
    const frameworks = ['react', 'nextjs', 'express', 'fastapi', 'gin'];
    
    return Array.from({ length: count }, (_, i) => ({
      vector: this.generateRandomEmbedding(),
      language: languages[(startIndex + i) % languages.length],
      framework: frameworks[(startIndex + i) % frameworks.length]
    }));
  }

  /**
   * Generate realistic random embedding
   */
  private generateRandomEmbedding(): number[] {
    const embedding = new Array(1536);
    for (let i = 0; i < 1536; i++) {
      // Generate values with normal distribution around 0
      embedding[i] = (Math.random() - 0.5) * 2;
    }
    
    // Normalize to unit vector (common for embeddings)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Run predefined scale test scenarios
   */
  async runStandardTests() {
    const scenarios = [
      {
        name: 'Small Scale Test',
        config: {
          total_embeddings: 1000,
          batch_size: 100,
          search_queries: 100,
          concurrent_searches: 10
        }
      },
      {
        name: 'Medium Scale Test',
        config: {
          total_embeddings: 10000,
          batch_size: 500,
          search_queries: 500,
          concurrent_searches: 25
        }
      },
      {
        name: 'Large Scale Test',
        config: {
          total_embeddings: 100000,
          batch_size: 1000,
          search_queries: 1000,
          concurrent_searches: 50
        }
      }
    ];

    const results = [];
    
    for (const scenario of scenarios) {
      console.log(`\n=== Running ${scenario.name} ===`);
      const result = await this.runScaleTest(scenario.config);
      results.push({
        scenario_name: scenario.name,
        ...result
      });
      
      // Brief pause between scenarios
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return results;
  }

  /**
   * Generate performance report
   */
  generateReport(results: any[]): string {
    let report = '# pgvector Scale Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    results.forEach(result => {
      report += `## ${result.scenario_name}\n\n`;
      report += `**Configuration:**\n`;
      report += `- Total Embeddings: ${result.config.total_embeddings.toLocaleString()}\n`;
      report += `- Batch Size: ${result.config.batch_size}\n`;
      report += `- Search Queries: ${result.config.search_queries}\n`;
      report += `- Concurrent Searches: ${result.config.concurrent_searches}\n\n`;
      
      report += `**Insertion Performance:**\n`;
      report += `- Total Time: ${(result.results.insertion_phase.total_time_ms / 1000).toFixed(2)}s\n`;
      report += `- Insertions/sec: ${result.results.insertion_phase.avg_insertion_per_second.toFixed(2)}\n`;
      report += `- Avg Batch Time: ${result.results.insertion_phase.avg_batch_time_ms.toFixed(2)}ms\n\n`;
      
      report += `**Search Performance:**\n`;
      report += `- Avg Search Time: ${result.results.search_phase.avg_search_time_ms.toFixed(2)}ms\n`;
      report += `- P95 Search Time: ${result.results.search_phase.p95_search_time_ms.toFixed(2)}ms\n`;
      report += `- P99 Search Time: ${result.results.search_phase.p99_search_time_ms.toFixed(2)}ms\n`;
      report += `- Avg Results/Query: ${result.results.search_phase.avg_results_per_query.toFixed(1)}\n\n`;
      
      report += `**Concurrent Performance:**\n`;
      report += `- Queries/sec: ${result.results.concurrent_phase.queries_per_second.toFixed(2)}\n`;
      report += `- Avg Concurrent Time: ${result.results.concurrent_phase.avg_query_time_ms.toFixed(2)}ms\n`;
      report += `- P95 Concurrent Time: ${result.results.concurrent_phase.p95_query_time_ms.toFixed(2)}ms\n\n`;
      
      report += '---\n\n';
    });
    
    return report;
  }

  async close() {
    await this.vectorSearch.close();
    await this.embeddingGenerator.close();
  }
}
