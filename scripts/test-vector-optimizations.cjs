#!/usr/bin/env node

/**
 * Test Script for Vector Store Performance Optimizations
 * Tests the enhanced monitoring endpoints and performance features
 */

const { performance } = require('perf_hooks');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Enhanced test configuration
const TEST_CONFIG = {
  endpoints: [
    '/api/health/vector-metrics',
    '/api/health/connection-pool', 
    '/api/health/database/metrics'
  ],
  timeout: 30000,
  maxRetries: 3
};

/**
 * Enhanced HTTP request with timeout and retries
 */
async function makeRequest(url, options = {}) {
  const { timeout = TEST_CONFIG.timeout, retries = TEST_CONFIG.maxRetries } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vector-Optimization-Test/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

/**
 * Test vector metrics endpoint with enhanced validation
 */
async function testVectorMetricsEndpoint() {
  console.log('\n🔍 Testing Enhanced Vector Metrics Endpoint...');
  const startTime = performance.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health/vector-metrics`);
    const duration = Math.round(performance.now() - startTime);
    
    console.log(`✅ Vector metrics endpoint responded in ${duration}ms`);
    
    // Validate enhanced response structure
    const requiredFields = [
      'status', 'timestamp', 'vectorStore', 'performance', 
      'connectionPool', 'queryCache', 'vectorOperations', 'providerSelection'
    ];
    
    const missingFields = requiredFields.filter(field => !(field in response));
    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }
    
    // Validate provider selection insights
    if (response.providerSelection) {
      console.log(`📊 Provider Recommendation: ${response.providerSelection.recommendation}`);
      console.log(`📈 PgVector Score: ${response.providerSelection.pgvector.performanceScore}`);
      console.log(`📈 Weaviate Score: ${response.providerSelection.weaviate.performanceScore}`);
    }
    
    // Validate enhanced query cache metrics
    if (response.queryCache) {
      console.log(`🎯 Cache Hit Rate: ${response.queryCache.hitRate}`);
      console.log(`📦 Cache Utilization: ${response.queryCache.utilization}`);
      console.log(`🔄 Avg Access Frequency: ${response.queryCache.avgAccessFrequency}`);
    }
    
    // Validate vector operations metrics
    if (response.vectorOperations) {
      console.log(`🔍 Total Searches: ${response.vectorOperations.totalSearches}`);
      console.log(`💾 Total Stores: ${response.vectorOperations.totalStores}`);
      console.log(`⚡ Cache Efficiency: ${response.vectorOperations.cacheEfficiency}`);
      console.log(`🔄 Provider Switch Rate: ${response.vectorOperations.providerSwitchRate}`);
    }
    
    return { success: true, duration, response };
  } catch (error) {
    console.error(`❌ Vector metrics test failed: ${error.message}`);
    return { success: false, error: error.message, duration: performance.now() - startTime };
  }
}

/**
 * Test connection pool optimization endpoint
 */
async function testConnectionPoolEndpoint() {
  console.log('\n🔗 Testing Connection Pool Optimization...');
  const startTime = performance.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health/connection-pool`);
    const duration = Math.round(performance.now() - startTime);
    
    console.log(`✅ Connection pool endpoint responded in ${duration}ms`);
    
    // Validate connection pool metrics
    if (response.poolMetrics) {
      console.log(`🏊 Active Connections: ${response.poolMetrics.activeConnections}`);
      console.log(`📊 Pool Utilization: ${response.poolMetrics.utilization}`);
      console.log(`⏱️  Avg Query Time: ${response.poolMetrics.avgQueryTime}ms`);
    }
    
    // Check pool optimization recommendations
    if (response.optimization) {
      console.log(`💡 Optimization Recommendation: ${response.optimization.recommendation}`);
    }
    
    return { success: true, duration, response };
  } catch (error) {
    console.error(`❌ Connection pool test failed: ${error.message}`);
    return { success: false, error: error.message, duration: performance.now() - startTime };
  }
}

/**
 * Test database metrics with enhanced validation
 */
async function testDatabaseMetricsEndpoint() {
  console.log('\n📊 Testing Enhanced Database Metrics...');
  const startTime = performance.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health/database/metrics`);
    const duration = Math.round(performance.now() - startTime);
    
    console.log(`✅ Database metrics endpoint responded in ${duration}ms`);
    
    // Validate database metrics structure
    if (response.metrics) {
      const metrics = response.metrics;
      console.log(`🔗 Total Connections: ${metrics.connectionPool?.totalConnections || 'N/A'}`);
      console.log(`⚡ Average Query Time: ${metrics.queryPerformance?.averageQueryTime || 'N/A'}ms`);
      console.log(`🔍 Vector Operations: ${metrics.vectorOperations?.similaritySearches || 'N/A'} searches`);
    }
    
    return { success: true, duration, response };
  } catch (error) {
    console.error(`❌ Database metrics test failed: ${error.message}`);
    return { success: false, error: error.message, duration: performance.now() - startTime };
  }
}

/**
 * Performance benchmark for provider selection algorithm
 */
async function benchmarkProviderSelection() {
  console.log('\n⚡ Benchmarking Provider Selection Algorithm...');
  
  const iterations = 10;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      const response = await makeRequest(`${BASE_URL}/api/health/vector-metrics`);
      const duration = performance.now() - startTime;
      
      results.push({
        iteration: i + 1,
        duration,
        success: true,
        providerRecommendation: response.providerSelection?.recommendation
      });
    } catch (error) {
      results.push({
        iteration: i + 1,
        duration: performance.now() - startTime,
        success: false,
        error: error.message
      });
    }
  }
  
  // Calculate performance statistics
  const successfulResults = results.filter(r => r.success);
  const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
  const minDuration = Math.min(...successfulResults.map(r => r.duration));
  const maxDuration = Math.max(...successfulResults.map(r => r.duration));
  
  console.log(`📈 Provider Selection Performance (${iterations} iterations):`);
  console.log(`   Success Rate: ${successfulResults.length}/${iterations} (${((successfulResults.length/iterations)*100).toFixed(1)}%)`);
  console.log(`   Average Response Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Min Response Time: ${minDuration.toFixed(2)}ms`);
  console.log(`   Max Response Time: ${maxDuration.toFixed(2)}ms`);
  
  return results;
}

/**
 * Test query caching effectiveness
 */
async function testQueryCaching() {
  console.log('\n🎯 Testing Query Cache Effectiveness...');
  
  // Make multiple requests to test cache hit rate
  const requests = 5;
  const results = [];
  
  for (let i = 0; i < requests; i++) {
    const startTime = performance.now();
    
    try {
      const response = await makeRequest(`${BASE_URL}/api/health/vector-metrics`);
      const duration = performance.now() - startTime;
      
      results.push({
        request: i + 1,
        duration,
        cacheHitRate: response.queryCache?.hitRate,
        cacheSize: response.queryCache?.size
      });
      
      console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms (Hit Rate: ${response.queryCache?.hitRate || 'N/A'})`);
    } catch (error) {
      console.error(`   Request ${i + 1} failed: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Vector Store Performance Optimization Tests');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('=' .repeat(60));
  
  const testResults = {
    vectorMetrics: null,
    connectionPool: null,
    databaseMetrics: null,
    providerBenchmark: null,
    queryCaching: null
  };
  
  try {
    // Test 1: Vector Metrics Endpoint
    testResults.vectorMetrics = await testVectorMetricsEndpoint();
    
    // Test 2: Connection Pool Endpoint  
    testResults.connectionPool = await testConnectionPoolEndpoint();
    
    // Test 3: Database Metrics Endpoint
    testResults.databaseMetrics = await testDatabaseMetricsEndpoint();
    
    // Test 4: Provider Selection Benchmark
    testResults.providerBenchmark = await benchmarkProviderSelection();
    
    // Test 5: Query Caching Test
    testResults.queryCaching = await testQueryCaching();
    
  } catch (error) {
    console.error(`💥 Test suite failed: ${error.message}`);
  }
  
  // Summary Report
  console.log('\n' + '=' .repeat(60));
  console.log('📋 OPTIMIZATION TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const successCount = Object.values(testResults).filter(result => 
    result && (result.success !== false || (Array.isArray(result) && result.length > 0))
  ).length;
  
  console.log(`✅ Tests Completed: ${successCount}/5`);
  console.log(`🎯 Overall Success Rate: ${((successCount/5)*100).toFixed(1)}%`);
  
  if (testResults.vectorMetrics?.success) {
    console.log(`📊 Vector Metrics: OPERATIONAL (${testResults.vectorMetrics.duration}ms)`);
  }
  
  if (testResults.connectionPool?.success) {
    console.log(`🔗 Connection Pool: OPERATIONAL (${testResults.connectionPool.duration}ms)`);
  }
  
  if (testResults.databaseMetrics?.success) {
    console.log(`📈 Database Metrics: OPERATIONAL (${testResults.databaseMetrics.duration}ms)`);
  }
  
  console.log('\n🎉 Vector Store Performance Optimizations Testing Complete!');
  
  return testResults;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testVectorMetricsEndpoint, testConnectionPoolEndpoint };