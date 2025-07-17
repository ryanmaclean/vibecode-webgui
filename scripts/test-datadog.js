#!/usr/bin/env node
/**
 * Test script to validate Datadog API key and send test metrics
 * This verifies our monitoring integration works with the provided API key
 */

// Load environment variables from .env.local
const fs = require('fs')
const path = require('path')

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
} catch (error) {
  console.log('No .env.local file found, using system environment variables')
}

const https = require('https')

const API_KEY = process.env.DD_API_KEY
const DD_SITE = process.env.DD_SITE || 'datadoghq.com'

if (!API_KEY) {
  console.error('❌ DD_API_KEY not found in environment')
  process.exit(1)
}

console.log('🔍 Testing Datadog Integration...')
console.log(`📍 Site: ${DD_SITE}`)
console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(24)}`)

// Test 1: Validate API Key
async function validateApiKey() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `api.${DD_SITE}`,
      port: 443,
      path: '/api/v1/validate',
      method: 'GET',
      headers: {
        'DD-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 200) {
            resolve({ success: true, data: result })
          } else {
            resolve({ success: false, status: res.statusCode, data: result })
          }
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

// Test 2: Send Test Metric
async function sendTestMetric() {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const metric = {
      series: [
        {
          metric: 'vibecode.test.integration',
          points: [[timestamp, 1]],
          type: 'count',
          tags: [
            'test:integration',
            'environment:development',
            'service:vibecode-webgui',
            'source:staff-engineer-validation'
          ]
        }
      ]
    }

    const postData = JSON.stringify(metric)

    const options = {
      hostname: `api.${DD_SITE}`,
      port: 443,
      path: '/api/v1/series',
      method: 'POST',
      headers: {
        'DD-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 202) {
            resolve({ success: true, data: result })
          } else {
            resolve({ success: false, status: res.statusCode, data: result })
          }
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.write(postData)
    req.end()
  })
}

// Test 3: Send Test Event
async function sendTestEvent() {
  return new Promise((resolve, reject) => {
    const event = {
      title: 'VibeCode Monitoring Integration Test',
      text: 'Staff Engineer validation of Datadog integration for VibeCode WebGUI monitoring system',
      date_happened: Math.floor(Date.now() / 1000),
      priority: 'normal',
      tags: [
        'test:integration',
        'service:vibecode-webgui',
        'environment:development',
        'validation:staff-engineer'
      ],
      alert_type: 'info'
    }

    const postData = JSON.stringify(event)

    const options = {
      hostname: `api.${DD_SITE}`,
      port: 443,
      path: '/api/v1/events',
      method: 'POST',
      headers: {
        'DD-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 202) {
            resolve({ success: true, data: result })
          } else {
            resolve({ success: false, status: res.statusCode, data: result })
          }
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.write(postData)
    req.end()
  })
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Running Datadog Integration Tests...\n')

  // Test 1: Validate API Key
  console.log('1️⃣  Testing API Key Validation...')
  try {
    const validation = await validateApiKey()
    if (validation.success) {
      console.log('✅ API Key is valid!')
      console.log(`   Valid: ${validation.data.valid}`)
    } else {
      console.log(`❌ API Key validation failed: ${validation.status}`)
      console.log(`   Response: ${JSON.stringify(validation.data)}`)
      return false
    }
  } catch (error) {
    console.log(`❌ API Key validation error: ${error.message}`)
    return false
  }

  // Test 2: Send Test Metric
  console.log('\n2️⃣  Testing Metric Submission...')
  try {
    const metric = await sendTestMetric()
    if (metric.success) {
      console.log('✅ Test metric sent successfully!')
      console.log(`   Status: ${metric.data.status}`)
    } else {
      console.log(`❌ Metric submission failed: ${metric.status}`)
      console.log(`   Response: ${JSON.stringify(metric.data)}`)
    }
  } catch (error) {
    console.log(`❌ Metric submission error: ${error.message}`)
  }

  // Test 3: Send Test Event
  console.log('\n3️⃣  Testing Event Submission...')
  try {
    const event = await sendTestEvent()
    if (event.success) {
      console.log('✅ Test event sent successfully!')
      console.log(`   Status: ${event.data.status}`)
    } else {
      console.log(`❌ Event submission failed: ${event.status}`)
      console.log(`   Response: ${JSON.stringify(event.data)}`)
    }
  } catch (error) {
    console.log(`❌ Event submission error: ${error.message}`)
  }

  console.log('\n🎉 Datadog integration test completed!')
  console.log('\n📊 Check your Datadog dashboard for:')
  console.log('   📈 Metric: vibecode.test.integration')
  console.log('   📅 Event: "VibeCode Monitoring Integration Test"')
  console.log('   🏷️  Tags: test:integration, service:vibecode-webgui')

  return true
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error)
  process.exit(1)
})
