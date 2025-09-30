#!/usr/bin/env node

/**
 * RAG Regression Test Runner for CI/CD
 * 
 * Runs RAG regression tests with Datadog telemetry and artifact collection.
 * Designed to be run nightly or post-deploy in CI environments.
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// Configuration
const CONFIG = {
  testTimeout: 300000, // 5 minutes
  maxRetries: 2,
  outputDir: 'rag-regression-results',
  datadogEnabled: process.env.DD_API_KEY && process.env.DD_SITE,
  enableRealAI: process.env.ENABLE_REAL_AI_TESTS === 'true',
  ciEnvironment: process.env.CI === 'true'
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function createOutputDirectory() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
    log(`📁 Created output directory: ${CONFIG.outputDir}`, 'blue')
  }
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'blue')
  
  const required = []
  const optional = []

  // Required for any testing
  if (!fs.existsSync('data/rag-azure-demo/demo-documents.json')) {
    required.push('Demo documents not found at data/rag-azure-demo/demo-documents.json')
  }
  
  if (!fs.existsSync('data/rag-azure-demo/test-scenarios.json')) {
    required.push('Test scenarios not found at data/rag-azure-demo/test-scenarios.json')
  }

  // Optional for enhanced testing
  if (!process.env.DATABASE_URL) {
    optional.push('DATABASE_URL not set - vector search tests will be limited')
  }

  if (!CONFIG.datadogEnabled) {
    optional.push('Datadog not configured - metrics will be logged only')
  }

  if (!CONFIG.enableRealAI) {
    optional.push('Real AI tests disabled - using mock responses')
  }

  if (required.length > 0) {
    log('❌ Missing required prerequisites:', 'red')
    required.forEach(req => log(`   - ${req}`, 'red'))
    return false
  }

  if (optional.length > 0) {
    log('⚠️ Optional features not available:', 'yellow')
    optional.forEach(opt => log(`   - ${opt}`, 'yellow'))
  }

  log('✅ Prerequisites check passed', 'green')
  return true
}

function runRegressionTests() {
  log('🧪 Running RAG regression tests...', 'blue')
  
  const testCommand = [
    'npx', 'jest',
    'tests/integration/rag-regression-datadog.test.ts',
    '--testTimeout', CONFIG.testTimeout.toString(),
    '--verbose',
    '--detectOpenHandles',
    '--forceExit'
  ]

  const testEnv = {
    ...process.env,
    ENABLE_RAG_REGRESSION_TESTS: 'true',
    NODE_ENV: 'test',
    JEST_TIMEOUT: CONFIG.testTimeout.toString()
  }

  try {
    log(`📋 Running command: ${testCommand.join(' ')}`, 'blue')
    
    const result = execSync(testCommand.join(' '), {
      stdio: 'pipe',
      env: testEnv,
      timeout: CONFIG.testTimeout + 30000 // Extra buffer
    })

    const output = result.toString()
    
    // Save test output
    const outputFile = path.join(CONFIG.outputDir, 'regression-test-output.txt')
    fs.writeFileSync(outputFile, output)
    
    log('✅ RAG regression tests completed successfully', 'green')
    return { success: true, output }
    
  } catch (error) {
    const errorOutput = error.stdout ? error.stdout.toString() : error.message
    const errorFile = path.join(CONFIG.outputDir, 'regression-test-errors.txt')
    fs.writeFileSync(errorFile, errorOutput)
    
    log('❌ RAG regression tests failed', 'red')
    log(`Error details saved to: ${errorFile}`, 'red')
    return { success: false, output: errorOutput, error }
  }
}

function runE2ETests() {
  log('🎭 Running RAG E2E tests...', 'blue')
  
  const e2eCommand = [
    'npx', 'playwright', 'test',
    'tests/e2e/rag-regression-e2e.test.ts',
    '--timeout', '60000',
    '--project', 'chromium'
  ]

  const e2eEnv = {
    ...process.env,
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000'
  }

  try {
    log(`📋 Running command: ${e2eCommand.join(' ')}`, 'blue')
    
    const result = execSync(e2eCommand.join(' '), {
      stdio: 'pipe',
      env: e2eEnv,
      timeout: 180000 // 3 minutes
    })

    const output = result.toString()
    
    // Save E2E output
    const outputFile = path.join(CONFIG.outputDir, 'e2e-test-output.txt')
    fs.writeFileSync(outputFile, output)
    
    log('✅ RAG E2E tests completed successfully', 'green')
    return { success: true, output }
    
  } catch (error) {
    const errorOutput = error.stdout ? error.stdout.toString() : error.message
    const errorFile = path.join(CONFIG.outputDir, 'e2e-test-errors.txt')
    fs.writeFileSync(errorFile, errorOutput)
    
    log('⚠️ RAG E2E tests failed (non-critical)', 'yellow')
    log(`Error details saved to: ${errorFile}`, 'yellow')
    return { success: false, output: errorOutput, error }
  }
}

function collectArtifacts() {
  log('📦 Collecting test artifacts...', 'blue')
  
  const artifacts = []
  
  // Test results
  const resultFiles = [
    'rag-regression-results/regression-test-output.txt',
    'rag-regression-results/regression-test-errors.txt',
    'rag-regression-results/e2e-test-output.txt',
    'rag-regression-results/e2e-test-errors.txt'
  ]
  
  resultFiles.forEach(file => {
    if (fs.existsSync(file)) {
      artifacts.push(file)
      log(`   📄 ${file}`, 'blue')
    }
  })
  
  // Playwright artifacts
  const playwrightDirs = ['test-results', 'playwright-report']
  playwrightDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      artifacts.push(dir)
      log(`   📁 ${dir}/`, 'blue')
    }
  })
  
  // Screenshots
  const screenshotFiles = ['rag-e2e-debug.png']
  screenshotFiles.forEach(file => {
    if (fs.existsSync(file)) {
      artifacts.push(file)
      log(`   🖼️ ${file}`, 'blue')
    }
  })
  
  // Create artifact summary
  const summary = {
    timestamp: new Date().toISOString(),
    environment: {
      ci: CONFIG.ciEnvironment,
      datadogEnabled: CONFIG.datadogEnabled,
      realAIEnabled: CONFIG.enableRealAI,
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    },
    artifacts,
    testConfiguration: CONFIG
  }
  
  const summaryFile = path.join(CONFIG.outputDir, 'artifact-summary.json')
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
  
  log(`📋 Artifact summary saved to: ${summaryFile}`, 'green')
  return artifacts
}

function sendDatadogSummary(regressionResult, e2eResult) {
  if (!CONFIG.datadogEnabled) {
    log('⚠️ Datadog not configured, skipping summary', 'yellow')
    return
  }
  
  log('📊 Sending test summary to Datadog...', 'blue')
  
  // This would integrate with the Datadog API to send a test run summary
  const summary = {
    regression_success: regressionResult.success,
    e2e_success: e2eResult.success,
    environment: CONFIG.ciEnvironment ? 'ci' : 'local',
    real_ai_enabled: CONFIG.enableRealAI,
    timestamp: new Date().toISOString()
  }
  
  log('📊 Test run summary:', 'blue')
  log(JSON.stringify(summary, null, 2), 'blue')
  
  // In a real implementation, this would call the Datadog API
  // For now, we'll log the summary for monitoring systems to pick up
  console.log('DATADOG_TEST_SUMMARY:', JSON.stringify(summary))
}

function main() {
  log('🚀 Starting RAG Regression Test Suite', 'magenta')
  log('='.repeat(50), 'magenta')
  
  try {
    // Setup
    createOutputDirectory()
    
    if (!checkPrerequisites()) {
      process.exit(1)
    }
    
    // Run tests
    const regressionResult = runRegressionTests()
    const e2eResult = runE2ETests()
    
    // Collect artifacts
    const artifacts = collectArtifacts()
    
    // Send summary to Datadog
    sendDatadogSummary(regressionResult, e2eResult)
    
    // Final status
    log('='.repeat(50), 'magenta')
    if (regressionResult.success) {
      log('✅ RAG Regression Test Suite completed successfully', 'green')
      
      if (!e2eResult.success) {
        log('⚠️ E2E tests failed but regression tests passed', 'yellow')
        process.exit(0) // E2E failures are non-critical
      }
      
      process.exit(0)
    } else {
      log('❌ RAG Regression Test Suite failed', 'red')
      process.exit(1)
    }
    
  } catch (error) {
    log(`💥 Unexpected error: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught exception: ${error.message}`, 'red')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log(`💥 Unhandled rejection at: ${promise}, reason: ${reason}`, 'red')
  process.exit(1)
})

// Run the main function
if (require.main === module) {
  main()
}

module.exports = { main, CONFIG }