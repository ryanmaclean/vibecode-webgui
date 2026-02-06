#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Root Tests Runner
 * 
 * This script runs all the root-level test files that were moved to tests/root-tests/
 * These are integration and validation tests that need to be run separately from the main test suite.
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize log aggregation
const logAggregation = new LogAggregation();


const ROOT_TESTS_DIR = join(__dirname, '..', 'tests', 'root-tests');

// Load environment variables from .env.local if it exists
const envLocalPath = join(__dirname, '..', '.env.local');
if (existsSync(envLocalPath)) {
  console.log('📄 Loading environment variables from .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('📄 No .env.local file found, using system environment variables');
}

// Datadog CI Visibility configuration
const DD_CI_VISIBILITY_ENABLED = process.env.DD_CI_VISIBILITY_ENABLED === 'true';
const DD_SERVICE = process.env.DD_SERVICE || 'vibecode-webgui';
const DD_ENV = process.env.DD_ENV || 'test';
const DD_VERSION = process.env.DD_VERSION || '1.0.0';

// Test categories and their configurations
const TEST_CATEGORIES = {
  'azure-embedding': {
    description: 'Azure OpenAI Embedding Service Tests',
    timeout: 30000,
    required: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
    tags: ['test.type:integration', 'test.category:azure', 'test.service:embedding']
  },
  'database': {
    description: 'Database Connection and Performance Tests',
    timeout: 15000,
    required: ['DATABASE_URL'],
    tags: ['test.type:integration', 'test.category:database', 'test.service:postgresql']
  },
  'ai-embedding': {
    description: 'AI and Embedding Service Tests',
    timeout: 20000,
    required: ['OPENAI_API_KEY'],
    tags: ['test.type:integration', 'test.category:ai', 'test.service:openai']
  },
  'infrastructure': {
    description: 'Infrastructure and Health Check Tests',
    timeout: 10000,
    required: [],
    tags: ['test.type:integration', 'test.category:infrastructure', 'test.service:health']
  },
  'workflow': {
    description: 'End-to-End Workflow Tests',
    timeout: 25000,
    required: ['DATABASE_URL', 'REDIS_URL'],
    tags: ['test.type:e2e', 'test.category:workflow', 'test.service:application']
  },
  'credentials': {
    description: 'Credential and Authentication Tests',
    timeout: 5000,
    required: ['NEXTAUTH_SECRET'],
    tags: ['test.type:unit', 'test.category:security', 'test.service:auth']
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Datadog CI Visibility functions
function startDatadogSpan(testName, category) {
  if (!DD_CI_VISIBILITY_ENABLED) return null;
  
  const spanId = Math.random().toString(36).substr(2, 9);
  const traceId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[DD_TRACE] Starting span: ${testName} (${spanId})`);
  console.log(`[DD_TRACE] Trace ID: ${traceId}`);
  
  return { spanId, traceId, startTime: Date.now() };
}

function finishDatadogSpan(span, testName, success, error = null) {
  if (!DD_CI_VISIBILITY_ENABLED || !span) return;
  
  const duration = Date.now() - span.startTime;
  const status = success ? 'pass' : 'fail';
  
  console.log(`[DD_TRACE] Finishing span: ${testName} (${span.spanId}) - ${status} (${duration}ms)`);
  
  if (error) {
    console.log(`[DD_TRACE] Error: ${error}`);
  }
}

function sendDatadogTestResult(testName, category, success, duration, error = null) {
  if (!DD_CI_VISIBILITY_ENABLED) return;
  
  const testResult = {
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    test_name: testName,
    test_category: category,
    test_suite: `root-tests-${category}`,
    test_session_name: `root-tests-${category}`,
    status: success ? 'pass' : 'fail',
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    tags: [
      `test.name:${testName}`,
      `test.category:${category}`,
      `test.suite:root-tests-${category}`,
      `test.session:root-tests-${category}`,
      `test.status:${success ? 'pass' : 'fail'}`,
      `service:${DD_SERVICE}`,
      `env:${DD_ENV}`,
      `version:${DD_VERSION}`
    ]
  };
  
  if (error) {
    testResult.error = error;
    testResult.tags.push(`test.error:${error}`);
  }
  
  // Send to Datadog via stdout (will be picked up by Datadog agent)
  console.log(`[DD_TEST_RESULT] ${JSON.stringify(testResult)}`);
}

function checkEnvironmentVariables(required) {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    log(`⚠️  Missing required environment variables: ${missing.join(', ')}`, 'yellow');
    return false;
  }
  return true;
}

function getTestFiles(category) {
  const categoryDir = join(ROOT_TESTS_DIR, category);
  try {
    return readdirSync(categoryDir)
      .filter(file => {
        const fullPath = join(categoryDir, file);
        return statSync(fullPath).isFile() && 
               (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.ts'));
      })
      .map(file => join(categoryDir, file));
  } catch (error) {
    log(`❌ Error reading ${category} directory: ${error.message}`, 'red');
    return [];
  }
}

function runTestFile(filePath) {
  const testName = filePath.split('/').pop();
  const category = filePath.split('/').slice(-2, -1)[0];
  
  // Start Datadog span
  const span = startDatadogSpan(testName, category);
  
  try {
    log(`  Running: ${testName}`, 'cyan');
    const startTime = Date.now();
    
    // Set up test environment
    const testEnv = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret-key',
      PORT: '3001', // Use different port to avoid conflicts
      NEXT_DISABLE_SWC: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      // Datadog CI Visibility environment variables
      DD_CI_VISIBILITY_ENABLED: DD_CI_VISIBILITY_ENABLED.toString(),
      DD_SERVICE: DD_SERVICE,
      DD_ENV: DD_ENV,
      DD_VERSION: DD_VERSION,
      // Stabilize test session fingerprint
      DD_TEST_SESSION_NAME: `root-tests-${category}`
    };
    
    execSync(`node "${filePath}"`, { 
      stdio: 'inherit',
      timeout: 30000,
      env: testEnv
    });
    
    const duration = Date.now() - startTime;
    log(`  ✅ Passed (${duration}ms)`, 'green');
    
    // Send success to Datadog
    finishDatadogSpan(span, testName, true);
    sendDatadogTestResult(testName, category, true, duration);
    
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - (span?.startTime || Date.now());
    log(`  ❌ Failed: ${error.message}`, 'red');
    
    // Send failure to Datadog
    finishDatadogSpan(span, testName, false, error.message);
    sendDatadogTestResult(testName, category, false, duration, error.message);
    
    return { success: false, error: error.message };
  }
}

function runCategory(category, config) {
  log(`\n${colors.bright}🧪 ${config.description}${colors.reset}`);
  
  // Check environment variables
  if (!checkEnvironmentVariables(config.required)) {
    log(`⏭️  Skipping ${category} - missing environment variables`, 'yellow');
    return { skipped: true };
  }
  
  const testFiles = getTestFiles(category);
  if (testFiles.length === 0) {
    log(`⏭️  No test files found in ${category}`, 'yellow');
    return { skipped: true };
  }
  
  log(`📁 Found ${testFiles.length} test file(s)`, 'blue');
  
  const results = {
    total: testFiles.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };
  
  for (const filePath of testFiles) {
    const result = runTestFile(filePath);
    if (result.success) {
      results.passed++;
      results.duration += result.duration;
    } else {
      results.failed++;
    }
  }
  
  return results;
}

function checkServices() {
  log(`🔍 Checking required services...`);
  
  // Check if we can connect to PostgreSQL
  try {
    execSync('pg_isready -h localhost -p 5432', { stdio: 'pipe' });
    log(`✅ PostgreSQL is running`, 'green');
  } catch (error) {
    log(`⚠️  PostgreSQL not available - some tests may fail`, 'yellow');
  }
  
  // Check if we can connect to Redis
  try {
    execSync('redis-cli -h localhost -p 6379 ping', { stdio: 'pipe' });
    log(`✅ Redis is running`, 'green');
  } catch (error) {
    log(`⚠️  Redis not available - some tests may fail`, 'yellow');
  }
}

function main() {
  log(`${colors.bright}🚀 VibeCode Root Tests Runner${colors.reset}`);
  log(`📂 Test directory: ${ROOT_TESTS_DIR}`);
  
  // Check services before running tests
  checkServices();
  
  const args = process.argv.slice(2);
  const categories = args.length > 0 ? args : Object.keys(TEST_CATEGORIES);
  
  log(`🎯 Running categories: ${categories.join(', ')}`);
  
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };
  
  for (const category of categories) {
    if (!TEST_CATEGORIES[category]) {
      log(`❌ Unknown category: ${category}`, 'red');
      continue;
    }
    
    const result = runCategory(category, TEST_CATEGORIES[category]);
    
    if (result.skipped) {
      summary.skipped++;
    } else {
      summary.total += result.total;
      summary.passed += result.passed;
      summary.failed += result.failed;
      summary.duration += result.duration;
    }
  }
  
  // Print summary
  log(`\n${colors.bright}📊 Test Summary${colors.reset}`);
  log(`Total tests: ${summary.total}`);
  log(`Passed: ${summary.passed}`, 'green');
  log(`Failed: ${summary.failed}`, summary.failed > 0 ? 'red' : 'green');
  log(`Skipped: ${summary.skipped}`, 'yellow');
  log(`Duration: ${summary.duration}ms`);
  
  if (summary.failed > 0) {
    log(`\n❌ Some tests failed!`, 'red');
    process.exit(1);
  } else {
    log(`\n✅ All tests passed!`, 'green');
    process.exit(0);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`\n💥 Unhandled Rejection: ${reason}`, 'red');
  process.exit(1);
});

main();
