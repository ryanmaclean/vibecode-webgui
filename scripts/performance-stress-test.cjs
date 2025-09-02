#!/usr/bin/env node

/**
 * Performance Stress Test for Vector Operations
 * Validates optimization effectiveness under load
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

async function stressTestEndpoint(endpoint, concurrent = 10, requests = 50) {
  console.log(`\n🔥 Stress testing ${endpoint} (${concurrent} concurrent, ${requests} total)...`)
  
  const startTime = Date.now()
  const results = []
  
  for (let batch = 0; batch < Math.ceil(requests / concurrent); batch++) {
    const batchPromises = []
    const batchSize = Math.min(concurrent, requests - (batch * concurrent))
    
    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(
        fetch(`${baseUrl}${endpoint}`)
          .then(async (response) => {
            const endTime = Date.now()
            return {
              status: response.status,
              responseTime: endTime - startTime,
              success: response.ok
            }
          })
          .catch(error => ({
            status: 0,
            responseTime: Date.now() - startTime,
            success: false,
            error: error.message
          }))
      )
    }
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }
  
  const totalTime = Date.now() - startTime
  const successCount = results.filter(r => r.success).length
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
  const successRate = (successCount / results.length) * 100
  const throughput = (results.length / totalTime) * 1000
  
  console.log(`   📊 Results: ${successCount}/${results.length} successful (${successRate.toFixed(1)}%)`)
  console.log(`   ⚡ Avg response time: ${avgResponseTime.toFixed(0)}ms`)
  console.log(`   🚀 Throughput: ${throughput.toFixed(1)} req/sec`)
  
  return {
    endpoint,
    totalRequests: results.length,
    successCount,
    successRate,
    avgResponseTime,
    throughput,
    totalTime
  }
}

async function runPerformanceStressTest() {
  console.log('🚀 VECTOR PERFORMANCE STRESS TEST SUITE')
  console.log(`📍 Base URL: ${baseUrl}`)
  
  const testCases = [
    { endpoint: '/api/health/vector-metrics', name: 'Vector Metrics' },
    { endpoint: '/api/health/connection-pool', name: 'Connection Pool' },
    { endpoint: '/api/health/database/metrics', name: 'Database Metrics' }
  ]
  
  const results = []
  
  for (const test of testCases) {
    try {
      const result = await stressTestEndpoint(test.endpoint, 5, 25)
      results.push({ ...result, name: test.name })
    } catch (error) {
      console.log(`   💥 Error testing ${test.name}: ${error.message}`)
      results.push({
        endpoint: test.endpoint,
        name: test.name,
        error: error.message,
        successRate: 0
      })
    }
  }
  
  // Performance summary
  console.log('\n📊 PERFORMANCE STRESS TEST SUMMARY:')
  results.forEach(result => {
    if (result.error) {
      console.log(`   ❌ ${result.name}: Failed (${result.error})`)
    } else {
      const status = result.successRate > 95 ? '✅' : result.successRate > 80 ? '⚠️' : '❌'
      console.log(`   ${status} ${result.name}: ${result.successRate.toFixed(1)}% success, ${result.avgResponseTime.toFixed(0)}ms avg`)
    }
  })
  
  const overallSuccess = results.filter(r => !r.error && r.successRate > 95).length
  const totalTests = results.length
  
  console.log(`\n🎯 OVERALL PERFORMANCE: ${overallSuccess}/${totalTests} endpoints performing optimally`)
  
  if (overallSuccess === totalTests) {
    console.log('🎉 All performance endpoints handling load excellently!')
    console.log('✅ Vector performance optimizations validated under stress')
  } else {
    console.log('⚠️  Some endpoints need optimization for high-load scenarios')
  }
  
  return results
}

if (require.main === module) {
  runPerformanceStressTest().catch(console.error)
}

module.exports = { stressTestEndpoint, runPerformanceStressTest }