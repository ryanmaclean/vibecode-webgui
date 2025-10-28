/**
 * Simple scale test runner for pgvector
 */

import { VectorSearchService } from '../../src/lib/vector-search';
import { performance } from 'perf_hooks';

interface TestConfig {
  total_embeddings: number;
  batch_size: number;
  search_queries: number;
}

async function generateRandomEmbedding(): Promise<number[]> {
  const embedding = new Array(1536);
  for (let i = 0; i < 1536; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function runQuickScaleTest() {
  const config: TestConfig = {
    total_embeddings: 100,
    batch_size: 10,
    search_queries: 20
  };

  console.log('Starting quick scale test...');
  console.log('Configuration:', config);

  const vectorSearch = new VectorSearchService();

  try {
    // Phase 1: Insert test embeddings
    console.log('\n=== Insertion Phase ===');
    const insertStart = performance.now();
    
    for (let i = 0; i < config.total_embeddings; i += config.batch_size) {
      const batchPromises = [];
      const batchSize = Math.min(config.batch_size, config.total_embeddings - i);
      
      for (let j = 0; j < batchSize; j++) {
        const embedding = await generateRandomEmbedding();
        const promise = vectorSearch.storeEmbedding(
          'code',
          `test_${i + j}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          embedding,
          {
            language: ['typescript', 'javascript', 'python'][j % 3],
            framework: ['react', 'nextjs', 'express'][j % 3],
            test_batch: Math.floor(i / config.batch_size),
            test_index: i + j
          }
        );
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      console.log(`Inserted batch ${Math.floor(i / config.batch_size) + 1}/${Math.ceil(config.total_embeddings / config.batch_size)}`);
    }
    
    const insertTime = performance.now() - insertStart;
    const insertionsPerSecond = (config.total_embeddings / insertTime) * 1000;
    
    console.log(`✓ Inserted ${config.total_embeddings} embeddings in ${(insertTime / 1000).toFixed(2)}s`);
    console.log(`✓ Rate: ${insertionsPerSecond.toFixed(2)} insertions/second`);

    // Phase 2: Search performance test
    console.log('\n=== Search Phase ===');
    const searchTimes: number[] = [];
    
    for (let i = 0; i < config.search_queries; i++) {
      const queryEmbedding = await generateRandomEmbedding();
      
      const searchStart = performance.now();
      const results = await vectorSearch.similaritySearch(queryEmbedding, {
        limit: 5,
        similarity_threshold: 0.8
      });
      const searchTime = performance.now() - searchStart;
      
      searchTimes.push(searchTime);
      
      if ((i + 1) % 5 === 0) {
        console.log(`Completed ${i + 1}/${config.search_queries} searches`);
      }
    }
    
    const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    const minSearchTime = Math.min(...searchTimes);
    const maxSearchTime = Math.max(...searchTimes);
    
    console.log(`✓ Completed ${config.search_queries} searches`);
    console.log(`✓ Avg search time: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`✓ Min search time: ${minSearchTime.toFixed(2)}ms`);
    console.log(`✓ Max search time: ${maxSearchTime.toFixed(2)}ms`);

    // Phase 3: Get statistics
    console.log('\n=== Database Statistics ===');
    const stats = await vectorSearch.getStats();
    console.log(`✓ Total embeddings: ${stats.total_embeddings}`);
    console.log(`✓ By content type:`, stats.by_content_type);
    console.log(`✓ By language:`, stats.by_language);

    console.log('\n🎉 Scale test completed successfully!');
    
  } catch (error) {
    console.error('Scale test failed:', error);
    throw error;
  } finally {
    await vectorSearch.close();
  }
}

// Run the test
if (require.main === module) {
  runQuickScaleTest().catch(console.error);
}
