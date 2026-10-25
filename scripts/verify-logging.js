#!/usr/bin/env node

/**
 * End-to-end logging verification script
 * Tests all logging requirements across all services
 */

const { execSync } = require('child_process');
const fs = require('fs');

const VERIFICATION_RESULTS = [];

function log(message) {
  console.log(`\n✓ ${message}`);
}

function error(message) {
  console.error(`\n✗ ${message}`);
}

function verify(testName, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testName}`);
  console.log('='.repeat(60));

  try {
    testFn();
    log(`PASS: ${testName}`);
    VERIFICATION_RESULTS.push({ test: testName, result: 'PASS' });
    return true;
  } catch (err) {
    error(`FAIL: ${testName}`);
    error(`Error: ${err.message}`);
    VERIFICATION_RESULTS.push({ test: testName, result: 'FAIL', error: err.message });
    return false;
  }
}

// Test 1: Main app logger (TypeScript/ES modules)
verify('Main app Pino logger loads and logs', () => {
  const output = execSync(`node -e "
    const { logger } = require('./src/lib/logger.ts');
    logger.info('Main app test log', { test: true });
    console.log('LOGGER_OK');
  "`, { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });

  if (!output.includes('LOGGER_OK')) {
    throw new Error('Logger failed to initialize');
  }
  log('Main app logger initialized successfully');
});

// Test 2: CommonJS Node.js logger
verify('CommonJS logger (logger-node.js) works', () => {
  const output = execSync(`node -e "
    const { logger } = require('./src/lib/logger-node.js');
    logger.info('CommonJS test log', { test: true, service: 'test' });
    logger.debug('Debug message');
    logger.warn('Warning message');
    logger.error('Error message');
    console.log('NODE_LOGGER_OK');
  "`, { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });

  if (!output.includes('NODE_LOGGER_OK')) {
    throw new Error('CommonJS logger failed');
  }
  log('CommonJS logger works correctly');
});

// Test 3: WebSocket server logger with service context
verify('WebSocket server uses Pino with service context', () => {
  // Check that WebSocket server imports the correct logger
  const wsServerContent = fs.readFileSync('./tools/server/index.js', 'utf8');

  if (!wsServerContent.includes("require('../../src/lib/logger-node')")) {
    throw new Error('WebSocket server not using logger-node');
  }

  if (!wsServerContent.includes("child({ service: 'websocket-server' })")) {
    throw new Error('WebSocket server missing service context');
  }

  if (wsServerContent.includes('winston')) {
    throw new Error('WebSocket server still references winston');
  }

  log('WebSocket server correctly uses Pino logger with service context');
});

// Test 4: AI Gateway logger with service context
verify('AI Gateway uses Pino with service context', () => {
  const aiGatewayContent = fs.readFileSync(
    './infrastructure/services/ai-gateway/src/utils/logger.ts',
    'utf8'
  );

  if (!aiGatewayContent.includes("import pino from 'pino'")) {
    throw new Error('AI Gateway not using Pino');
  }

  if (!aiGatewayContent.includes("serviceName: 'ai-gateway'")) {
    throw new Error('AI Gateway missing service name');
  }

  if (aiGatewayContent.includes('winston')) {
    throw new Error('AI Gateway still references winston');
  }

  log('AI Gateway correctly uses Pino logger with service context');
});

// Test 5: JSON format in production
verify('Production mode uses JSON format', () => {
  const output = execSync(`node -e "
    const { logger } = require('./src/lib/logger-node.js');
    logger.info('Production log test', { environment: 'production', structured: true });
  "`, { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });

  // In production, logs should be JSON
  const lines = output.trim().split('\n');
  const logLine = lines.find(line => line.includes('Production log test'));

  if (!logLine) {
    throw new Error('No log output found');
  }

  // Should be valid JSON in production
  try {
    const parsed = JSON.parse(logLine);
    if (parsed.msg !== 'Production log test') {
      throw new Error('Log message not found in JSON');
    }
    if (parsed.environment !== 'production') {
      throw new Error('Metadata not structured correctly');
    }
  } catch (e) {
    throw new Error(`Production logs not in JSON format: ${e.message}`);
  }

  log('Production mode outputs structured JSON logs');
});

// Test 6: Pretty format in development
verify('Development mode uses pretty format', () => {
  const loggerContent = fs.readFileSync('./src/lib/logger.ts', 'utf8');

  // Check that pretty print is configured for dev
  if (!loggerContent.includes("prettyPrint: process.env.NODE_ENV !== 'production'")) {
    throw new Error('Pretty print not configured for development');
  }

  if (!loggerContent.includes("target: 'pino-pretty'")) {
    throw new Error('pino-pretty transport not configured');
  }

  log('Development mode configured for pretty printing');
});

// Test 7: LOG_LEVEL environment variable
verify('LOG_LEVEL environment variable is respected', () => {
  // Test with debug level
  const debugOutput = execSync(`node -e "
    const { logger } = require('./src/lib/logger-node.js');
    logger.debug('Debug message', { level: 'debug' });
    logger.info('Info message', { level: 'info' });
  "`, { encoding: 'utf8', env: { ...process.env, LOG_LEVEL: 'debug', NODE_ENV: 'production' } });

  if (!debugOutput.includes('Debug message')) {
    throw new Error('Debug logs not appearing with LOG_LEVEL=debug');
  }

  // Test with info level (should not show debug)
  const infoOutput = execSync(`node -e "
    const { logger } = require('./src/lib/logger-node.js');
    logger.debug('Debug message should not appear');
    logger.info('Info message should appear', { level: 'info' });
  "`, { encoding: 'utf8', env: { ...process.env, LOG_LEVEL: 'info', NODE_ENV: 'production' } });

  if (infoOutput.includes('Debug message should not appear')) {
    throw new Error('Debug logs appearing with LOG_LEVEL=info');
  }

  if (!infoOutput.includes('Info message should appear')) {
    throw new Error('Info logs not appearing with LOG_LEVEL=info');
  }

  log('LOG_LEVEL environment variable controls log verbosity correctly');
});

// Test 8: Datadog integration configuration
verify('Datadog integration is properly configured', () => {
  const mainLoggerContent = fs.readFileSync('./src/lib/logger.ts', 'utf8');
  const aiGatewayContent = fs.readFileSync(
    './infrastructure/services/ai-gateway/src/utils/logger.ts',
    'utf8'
  );

  // Check main logger
  if (!mainLoggerContent.includes("target: 'pino-datadog'")) {
    throw new Error('Main logger missing pino-datadog transport');
  }

  if (!mainLoggerContent.includes('datadogEnabled: isServer && !!process.env.DD_API_KEY')) {
    throw new Error('Main logger Datadog not conditioned on DD_API_KEY');
  }

  // Check AI Gateway
  if (!aiGatewayContent.includes("target: 'pino-datadog'")) {
    throw new Error('AI Gateway missing pino-datadog transport');
  }

  if (!aiGatewayContent.includes('datadogEnabled: !!process.env.DD_API_KEY')) {
    throw new Error('AI Gateway Datadog not conditioned on DD_API_KEY');
  }

  log('Datadog integration properly configured (activates when DD_API_KEY is set)');
});

// Test 9: No Winston dependencies remain
verify('Winston completely removed from codebase', () => {
  // Check package.json
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

  if (packageJson.dependencies?.winston) {
    throw new Error('winston still in dependencies');
  }

  if (packageJson.devDependencies?.winston) {
    throw new Error('winston still in devDependencies');
  }

  // Check node_modules
  if (fs.existsSync('./node_modules/winston')) {
    throw new Error('winston still in node_modules');
  }

  log('Winston completely removed from dependencies and node_modules');
});

// Test 10: Consistent logger API across all services
verify('Logger API is consistent across all services', () => {
  const mainLogger = fs.readFileSync('./src/lib/logger.ts', 'utf8');
  const nodeLogger = fs.readFileSync('./src/lib/logger-node.js', 'utf8');
  const aiGatewayLogger = fs.readFileSync(
    './infrastructure/services/ai-gateway/src/utils/logger.ts',
    'utf8'
  );

  const requiredMethods = ['error', 'warn', 'info', 'debug', 'http', 'log', 'child'];

  for (const method of requiredMethods) {
    if (!mainLogger.includes(`${method}:`)) {
      throw new Error(`Main logger missing ${method} method`);
    }
    if (!nodeLogger.includes(`${method}:`)) {
      throw new Error(`Node logger missing ${method} method`);
    }
    if (!aiGatewayLogger.includes(`${method}:`)) {
      throw new Error(`AI Gateway logger missing ${method} method`);
    }
  }

  log('All loggers expose consistent API (error, warn, info, debug, http, log, child)');
});

// Print summary
console.log('\n\n' + '='.repeat(60));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(60));

const passed = VERIFICATION_RESULTS.filter(r => r.result === 'PASS').length;
const failed = VERIFICATION_RESULTS.filter(r => r.result === 'FAIL').length;

VERIFICATION_RESULTS.forEach(result => {
  const icon = result.result === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${result.test}: ${result.result}`);
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`Total: ${VERIFICATION_RESULTS.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}

console.log('\n✓ All logging verification tests passed!\n');
