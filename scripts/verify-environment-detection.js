#!/usr/bin/env node
/**
 * Manual verification script for environment detection
 * Tests with different NODE_ENV, DD_ENV, and other environment variable combinations
 */

const { EnvironmentDetector } = require('../src/lib/environment/detector.ts');

// Helper to display results
function displayResult(testName, result) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Environment: ${result.environment}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Signals detected: ${result.signals.length}`);

  if (result.signals.length > 0) {
    console.log('\nSignals:');
    result.signals.forEach((signal, idx) => {
      console.log(`  ${idx + 1}. ${signal.type} (${signal.source}): ${signal.value} → ${signal.indicates}`);
      console.log(`     Confidence: ${signal.confidence}, Priority: ${signal.priority}`);
    });
  }

  if (result.primarySignal) {
    console.log(`\nPrimary Signal: ${result.primarySignal.source} → ${result.primarySignal.indicates}`);
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }

  console.log(`\nDetected at: ${result.detectedAt.toISOString()}`);
}

// Test scenarios
const scenarios = [
  {
    name: 'NODE_ENV=development',
    env: { NODE_ENV: 'development' },
    expected: 'development'
  },
  {
    name: 'NODE_ENV=production',
    env: { NODE_ENV: 'production' },
    expected: 'production'
  },
  {
    name: 'NODE_ENV=staging',
    env: { NODE_ENV: 'staging' },
    expected: 'staging'
  },
  {
    name: 'NODE_ENV=test',
    env: { NODE_ENV: 'test' },
    expected: 'test'
  },
  {
    name: 'DD_ENV=development',
    env: { DD_ENV: 'development' },
    expected: 'development'
  },
  {
    name: 'DD_ENV=production',
    env: { DD_ENV: 'production' },
    expected: 'production'
  },
  {
    name: 'DD_ENV=staging',
    env: { DD_ENV: 'staging' },
    expected: 'staging'
  },
  {
    name: 'NODE_ENV=production + DD_ENV=production (agreeing signals)',
    env: { NODE_ENV: 'production', DD_ENV: 'production' },
    expected: 'production',
    expectedConfidence: 'high'
  },
  {
    name: 'NODE_ENV=production + DD_ENV=development (conflicting signals)',
    env: { NODE_ENV: 'production', DD_ENV: 'development' },
    expected: 'production', // NODE_ENV has higher priority
    expectWarning: true
  },
  {
    name: 'ENVIRONMENT=staging',
    env: { ENVIRONMENT: 'staging' },
    expected: 'staging'
  },
  {
    name: 'VERCEL_ENV=production',
    env: { VERCEL_ENV: 'production' },
    expected: 'production'
  },
  {
    name: 'No environment variables (fallback)',
    env: {},
    expected: 'unknown',
    expectWarning: true
  },
  {
    name: 'Multiple agreeing signals (NODE_ENV + DD_ENV + ENVIRONMENT = production)',
    env: { NODE_ENV: 'production', DD_ENV: 'production', ENVIRONMENT: 'production' },
    expected: 'production',
    expectedConfidence: 'high'
  }
];

// Run all scenarios
console.log('\n');
console.log('╔' + '═'.repeat(68) + '╗');
console.log('║' + ' '.repeat(15) + 'ENVIRONMENT DETECTION VERIFICATION' + ' '.repeat(19) + '║');
console.log('╚' + '═'.repeat(68) + '╝');
console.log('\nTesting environment detection across all signals...\n');

let passed = 0;
let failed = 0;

scenarios.forEach((scenario, idx) => {
  // Save original env
  const originalEnv = { ...process.env };

  // Clear detection-related env vars
  const envVarsToClean = [
    'NODE_ENV', 'DD_ENV', 'ENVIRONMENT', 'APP_ENV', 'DEPLOYMENT_ENV',
    'VERCEL_ENV', 'RAILWAY_ENVIRONMENT', 'RENDER_ENV'
  ];
  envVarsToClean.forEach(key => delete process.env[key]);

  // Set test env vars
  Object.assign(process.env, scenario.env);

  // Create fresh detector and run detection
  const detector = new EnvironmentDetector();
  const result = detector.detect();

  // Display results
  displayResult(scenario.name, result);

  // Verify expectations
  const envMatch = result.environment === scenario.expected;
  const confidenceMatch = !scenario.expectedConfidence || result.confidence === scenario.expectedConfidence;
  const warningMatch = !scenario.expectWarning || (result.warnings && result.warnings.length > 0);

  const testPassed = envMatch && confidenceMatch && warningMatch;

  if (testPassed) {
    console.log('\n✅ TEST PASSED');
    passed++;
  } else {
    console.log('\n❌ TEST FAILED');
    if (!envMatch) console.log(`   Expected environment: ${scenario.expected}, got: ${result.environment}`);
    if (!confidenceMatch) console.log(`   Expected confidence: ${scenario.expectedConfidence}, got: ${result.confidence}`);
    if (!warningMatch) console.log(`   Expected warnings but none found`);
    failed++;
  }

  // Restore original env
  process.env = originalEnv;
});

// Summary
console.log('\n');
console.log('╔' + '═'.repeat(68) + '╗');
console.log('║' + ' '.repeat(28) + 'TEST SUMMARY' + ' '.repeat(28) + '║');
console.log('╚' + '═'.repeat(68) + '╝');
console.log(`\nTotal tests: ${scenarios.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success rate: ${((passed / scenarios.length) * 100).toFixed(1)}%\n`);

process.exit(failed > 0 ? 1 : 0);
