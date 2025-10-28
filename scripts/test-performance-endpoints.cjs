#!/usr/bin/env node

/**
 * Performance Endpoints Test Script
 * Tests all vector performance monitoring endpoints
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🔍 Testing ${description}...`)
    console.log(`   GET ${endpoint}`)
    
    const response = await fetch(`${baseUrl}${endpoint}`)
    const data = await response.json()
    
    if (response.ok) {
      console.log(`   ✅ Success (${response.status})`)
      console.log(`   📊 Data keys: ${Object.keys(data).join(', ')}`)
      
      if (data.performance) {
        console.log(`   ⚡ Performance: ${JSON.stringify(data.performance, null, 2)}`)
      }
      
      return true
    } else {
      console.log(`   ❌ Failed (${response.status}): ${data.error || 'Unknown error'}`)
      return false
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`)
    return false
  }
}

async function runPerformanceTests() {
  console.log('🚀 VECTOR PERFORMANCE MONITORING TEST SUITE')
  console.log(`📍 Base URL: ${baseUrl}`)
  
  const tests = [
    ['/api/health/vector-metrics', 'Vector Store Performance Metrics'],
    ['/api/health/connection-pool', 'Connection Pool Optimization'],
    ['/api/health/database/metrics', 'Database Performance Metrics'],
    ['/api/health/db', 'Database Health Check']
  ]
  
  let passed = 0
  let total = tests.length
  
  for (const [endpoint, description] of tests) {
    if (await testEndpoint(endpoint, description)) {
      passed++
    }
  }
  
  console.log(`\n📊 RESULTS: ${passed}/${total} endpoints working`)
  
  if (passed === total) {
    console.log('🎉 All performance monitoring endpoints operational!')
    console.log('\n🔗 Production-ready endpoints:')
    tests.forEach(([endpoint, desc]) => {
      console.log(`   ${baseUrl}${endpoint} - ${desc}`)
    })
  } else {
    console.log('⚠️  Some endpoints need attention')
    process.exit(1)
  }
}

if (require.main === module) {
  runPerformanceTests().catch(console.error)
}

module.exports = { testEndpoint, runPerformanceTests }