#!/usr/bin/env node
/**
 * ValKey Vector Cache Benchmark Runner
 * 
 * Run this script to evaluate the performance improvements from the ValKey caching layer
 * for pgVector similarity searches in the VibeCode WebGUI platform.
 * 
 * Usage:
 *   node scripts/benchmark-valkey-cache.js [options]
 * 
 * Options:
 *   --runs=N          Number of benchmark iterations (default: 20)
 *   --clear-cache     Clear the cache before each test
 *   --dimensions=N    Vector dimensions for test (default: 1536)
 *   --threshold=N     Similarity threshold (default: 0.7)
 *   --limit=N         Result limit (default: 10)
 *   --verbose         Show detailed results
 */

// Import required modules
const { VectorCacheBenchmark } = require('../dist/lib/cache/vector-cache-benchmark');
const { VectorCacheManager } = require('../dist/lib/cache/vector-cache-strategy');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  runs: 20,
  clearCache: false,
  dimensions: 1536,
  threshold: 0.7,
  limit: 10,
  verbose: false
};

// Process arguments
args.forEach(arg => {
  if (arg === '--clear-cache') {
    options.clearCache = true;
  } else if (arg === '--verbose') {
    options.verbose = true;
  } else if (arg.startsWith('--runs=')) {
    options.runs = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--dimensions=')) {
    options.dimensions = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--threshold=')) {
    options.threshold = parseFloat(arg.split('=')[1]);
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  }
});

// Display banner
console.log('\n==============================================');
console.log('🚀 ValKey Vector Cache Benchmark Suite');
console.log('==============================================\n');
console.log('Configuration:');
console.log(`- Benchmark Runs: ${options.runs}`);
console.log(`- Vector Dimensions: ${options.dimensions}`);
console.log(`- Similarity Threshold: ${options.threshold}`);
console.log(`- Result Limit: ${options.limit}`);
console.log(`- Clear Cache Before Test: ${options.clearCache ? 'Yes' : 'No'}`);
console.log(`- Verbose Output: ${options.verbose ? 'Yes' : 'No'}`);
console.log('\n==============================================\n');

// Run the benchmark
async function runBenchmark() {
  try {
    console.log('Starting benchmark...\n');
    
    // Get initial cache stats
    const initialStats = VectorCacheManager.getCacheStats();
    console.log('Initial Cache Stats:');
    console.log(`- Hit Rate: ${(initialStats.hitRate * 100).toFixed(2)}%`);
    console.log(`- Hit Count: ${initialStats.hitCount}`);
    console.log(`- Miss Count: ${initialStats.missCount}`);
    console.log(`- Skip Count: ${initialStats.skipCount}`);
    console.log('');
    
    // Run comprehensive benchmark
    console.log('Running comprehensive benchmark suite...');
    const results = await VectorCacheBenchmark.runComprehensiveBenchmark();
    
    // Display summary
    console.log('\n==============================================');
    console.log('📊 Benchmark Results');
    console.log('==============================================\n');
    console.log(results.summary);
    
    // Display detailed results if verbose
    if (options.verbose) {
      console.log('\n==============================================');
      console.log('📈 Detailed Performance Metrics');
      console.log('==============================================\n');
      
      console.log('Vector Search Performance (Without Cache):');
      console.table({
        'Average Time (ms)': results.similaritySearch.withoutCache.averageTimeMs,
        'Min Time (ms)': results.similaritySearch.withoutCache.minTimeMs,
        'Max Time (ms)': results.similaritySearch.withoutCache.maxTimeMs,
        'Median Time (ms)': results.similaritySearch.withoutCache.medianTimeMs,
        'P95 Time (ms)': results.similaritySearch.withoutCache.p95TimeMs,
        'Total Time (ms)': results.similaritySearch.withoutCache.totalTimeMs,
        'Run Count': results.similaritySearch.withoutCache.runCount
      });
      
      console.log('\nVector Search Performance (With Cache):');
      console.table({
        'Average Time (ms)': results.similaritySearch.withCache.averageTimeMs,
        'Min Time (ms)': results.similaritySearch.withCache.minTimeMs,
        'Max Time (ms)': results.similaritySearch.withCache.maxTimeMs,
        'Median Time (ms)': results.similaritySearch.withCache.medianTimeMs,
        'P95 Time (ms)': results.similaritySearch.withCache.p95TimeMs,
        'Total Time (ms)': results.similaritySearch.withCache.totalTimeMs,
        'Run Count': results.similaritySearch.withCache.runCount,
        'Cache Hit Rate': results.similaritySearch.withCache.cacheHitRate || 0
      });
      
      console.log('\nCache Invalidation Performance:');
      console.table({
        'Average Time (ms)': results.invalidation.averageTimeMs,
        'Min Time (ms)': results.invalidation.minTimeMs,
        'Max Time (ms)': results.invalidation.maxTimeMs,
        'Median Time (ms)': results.invalidation.medianTimeMs,
        'P95 Time (ms)': results.invalidation.p95TimeMs,
        'Run Count': results.invalidation.runCount
      });
    }
    
    // Final cache stats
    const finalStats = VectorCacheManager.getCacheStats();
    console.log('\nFinal Cache Stats:');
    console.log(`- Hit Rate: ${(finalStats.hitRate * 100).toFixed(2)}%`);
    console.log(`- Hit Count: ${finalStats.hitCount}`);
    console.log(`- Miss Count: ${finalStats.missCount}`);
    console.log(`- Skip Count: ${finalStats.skipCount}`);
    
    console.log('\n==============================================');
    console.log(`✅ Benchmark completed successfully with ${options.runs} runs`);
    console.log(`🔍 Performance improvement: ${results.similaritySearch.improvement.toFixed(2)}%`);
    console.log('==============================================\n');
    
  } catch (error) {
    console.error('Error running benchmark:', error);
    process.exit(1);
  }
}

// Execute the benchmark
runBenchmark().catch(console.error);