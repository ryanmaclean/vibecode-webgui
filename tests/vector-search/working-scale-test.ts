/**
 * Working scale test for pgvector with proper connection
 */

import { Pool } from 'pg';
import { performance } from 'perf_hooks';

async function generateRandomEmbedding(): Promise<number[]> {
  const embedding = new Array(1536);
  for (let i = 0; i < 1536; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function runScaleTest() {
  console.log('Starting pgvector scale test...');
  
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibecode',
    user: 'vibecode',
    password: 'vibecode123',
    max: 10,
    connectionTimeoutMillis: 5000
  });

  const config = {
    total_embeddings: 500,
    batch_size: 50,
    search_queries: 100,
    concurrent_searches: 10
  };

  console.log('Configuration:', config);

  try {
    // Phase 1: Bulk insertion test
    console.log('\n=== Insertion Phase ===');
    const insertStart = performance.now();
    let totalInserted = 0;

    for (let i = 0; i < config.total_embeddings; i += config.batch_size) {
      const batchSize = Math.min(config.batch_size, config.total_embeddings - i);
      const batchPromises = [];

      for (let j = 0; j < batchSize; j++) {
        const embedding = await generateRandomEmbedding();
        const contentHash = `scale_test_${i + j}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const promise = pool.query(`
          INSERT INTO embeddings (content_type, content_hash, embedding, metadata)
          VALUES ($1, $2, $3, $4)
        `, [
          'code',
          contentHash,
          `[${embedding.join(',')}]`,
          JSON.stringify({
            language: ['typescript', 'javascript', 'python', 'go', 'rust'][j % 5],
            framework: ['react', 'nextjs', 'express', 'fastapi', 'gin'][j % 5],
            test_batch: Math.floor(i / config.batch_size),
            test_index: i + j,
            generated_at: new Date().toISOString()
          })
        ]);
        
        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);
      totalInserted += batchSize;
      
      console.log(`Inserted batch ${Math.floor(i / config.batch_size) + 1}/${Math.ceil(config.total_embeddings / config.batch_size)} (${totalInserted}/${config.total_embeddings})`);
    }

    const insertTime = performance.now() - insertStart;
    const insertionsPerSecond = (totalInserted / insertTime) * 1000;
    
    console.log(`✓ Inserted ${totalInserted} embeddings in ${(insertTime / 1000).toFixed(2)}s`);
    console.log(`✓ Rate: ${insertionsPerSecond.toFixed(2)} insertions/second`);

    // Phase 2: Search performance test
    console.log('\n=== Search Performance Test ===');
    const searchTimes: number[] = [];
    const resultCounts: number[] = [];

    for (let i = 0; i < config.search_queries; i++) {
      const queryEmbedding = await generateRandomEmbedding();
      
      const searchStart = performance.now();
      const result = await pool.query(`
        SELECT 
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        WHERE content_type = 'code'
        ORDER BY embedding <-> $1
        LIMIT 10
      `, [`[${queryEmbedding.join(',')}]`]);
      
      const searchTime = performance.now() - searchStart;
      searchTimes.push(searchTime);
      resultCounts.push(result.rows.length);

      if ((i + 1) % 20 === 0) {
        console.log(`Completed ${i + 1}/${config.search_queries} searches`);
      }
    }

    const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    const minSearchTime = Math.min(...searchTimes);
    const maxSearchTime = Math.max(...searchTimes);
    const p95SearchTime = searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)];

    console.log(`✓ Completed ${config.search_queries} searches`);
    console.log(`✓ Avg search time: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`✓ Min search time: ${minSearchTime.toFixed(2)}ms`);
    console.log(`✓ Max search time: ${maxSearchTime.toFixed(2)}ms`);
    console.log(`✓ P95 search time: ${p95SearchTime.toFixed(2)}ms`);
    console.log(`✓ Avg results per query: ${(resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length).toFixed(1)}`);

    // Phase 3: Concurrent search test
    console.log('\n=== Concurrent Search Test ===');
    const concurrentStart = performance.now();

    const concurrentPromises = Array.from({ length: config.concurrent_searches }, async (_, i) => {
      const queryEmbedding = await generateRandomEmbedding();
      const queryStart = performance.now();
      
      const result = await pool.query(`
        SELECT 
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        WHERE content_type = 'code'
        ORDER BY embedding <-> $1
        LIMIT 5
      `, [`[${queryEmbedding.join(',')}]`]);
      
      const queryTime = performance.now() - queryStart;
      
      return {
        query_id: i,
        query_time_ms: queryTime,
        result_count: result.rows.length
      };
    });

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentTime = performance.now() - concurrentStart;
    const concurrentTimes = concurrentResults.map(r => r.query_time_ms);
    const avgConcurrentTime = concurrentTimes.reduce((a, b) => a + b, 0) / concurrentTimes.length;

    console.log(`✓ Completed ${config.concurrent_searches} concurrent searches in ${concurrentTime.toFixed(2)}ms`);
    console.log(`✓ Queries per second: ${((config.concurrent_searches / concurrentTime) * 1000).toFixed(2)}`);
    console.log(`✓ Avg concurrent query time: ${avgConcurrentTime.toFixed(2)}ms`);

    // Phase 4: Database statistics
    console.log('\n=== Database Statistics ===');
    const totalCount = await pool.query('SELECT COUNT(*) as count FROM embeddings');
    const typeStats = await pool.query(`
      SELECT content_type, COUNT(*) as count 
      FROM embeddings 
      GROUP BY content_type
    `);
    const langStats = await pool.query(`
      SELECT metadata->>'language' as language, COUNT(*) as count 
      FROM embeddings 
      WHERE metadata->>'language' IS NOT NULL
      GROUP BY metadata->>'language'
      ORDER BY count DESC
    `);

    console.log(`✓ Total embeddings: ${totalCount.rows[0].count}`);
    console.log('✓ By content type:');
    typeStats.rows.forEach(row => {
      console.log(`  - ${row.content_type}: ${row.count}`);
    });
    console.log('✓ By language:');
    langStats.rows.forEach(row => {
      console.log(`  - ${row.language}: ${row.count}`);
    });

    // Performance summary
    console.log('\n=== Performance Summary ===');
    console.log(`📊 Insertion Rate: ${insertionsPerSecond.toFixed(2)} embeddings/second`);
    console.log(`🔍 Search Performance: ${avgSearchTime.toFixed(2)}ms avg, ${p95SearchTime.toFixed(2)}ms P95`);
    console.log(`⚡ Concurrent Throughput: ${((config.concurrent_searches / concurrentTime) * 1000).toFixed(2)} queries/second`);
    console.log(`💾 Database Size: ${totalCount.rows[0].count} total embeddings`);

    console.log('\n🎉 Scale test completed successfully!');

  } catch (error) {
    console.error('Scale test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runScaleTest().catch(console.error);
}
