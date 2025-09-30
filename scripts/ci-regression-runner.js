#!/usr/bin/env node

/**
 * CI-friendly wrapper for the master test runner
 * Provides JSON output, exit codes, and Datadog integration
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  baseDir: process.cwd(),
  testScript: 'scripts/run-all-tests.sh',
  outputFile: 'test-results/regression-test-results.json',
  timeout: 30 * 60 * 1000, // 30 minutes
};

// Ensure test results directory exists
const testResultsDir = path.dirname(CONFIG.outputFile);
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

// Datadog metric reporting
function sendDatadogMetric(metricName, value, tags = []) {
  if (!process.env.DD_API_KEY) {
    console.log('⚠️ DD_API_KEY not set, skipping Datadog metrics');
    return;
  }
  
  const url = `https://api.${process.env.DD_SITE || 'datadoghq.com'}/api/v1/series`;
  const data = {
    series: [{
      metric: `regression_test.master_suite.${metricName}`,
      points: [[Math.floor(Date.now() / 1000), value]],
      tags: [`environment:${process.env.DD_ENV || 'test'}`, ...tags]
    }]
  };
  
  try {
    execSync(`curl -X POST "${url}" \
      -H "Content-Type: application/json" \
      -H "DD-API-KEY: ${process.env.DD_API_KEY}" \
      -d '${JSON.stringify(data)}'`, { stdio: 'ignore' });
  } catch (err) {
    console.log('⚠️ Failed to send Datadog metrics');
  }
}

// Test execution
async function runMasterTestSuite() {
  console.log('🚀 Starting CI-friendly Master Test Suite');
  console.log('========================================');
  
  const startTime = Date.now();
  let testResults = {
    startTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    testSuites: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  sendDatadogMetric('suite_started', 1, ['suite_type:master']);

  try {
    // Check if the test script exists and is executable
    const testScriptPath = path.join(CONFIG.baseDir, CONFIG.testScript);
    if (!fs.existsSync(testScriptPath)) {
      throw new Error(`Test script not found: ${testScriptPath}`);
    }

    // Make script executable
    try {
      execSync(`chmod +x "${testScriptPath}"`);
    } catch (err) {
      console.log('⚠️ Could not make test script executable');
    }

    console.log(`📁 Running test script: ${CONFIG.testScript}`);
    
    // Run the test script and capture output
    const child = spawn('bash', [CONFIG.testScript], {
      cwd: CONFIG.baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        BASE_DIR: CONFIG.baseDir
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      stdout += output;
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);
      stderr += output;
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      console.log('\n⏰ Test suite timed out, terminating...');
      child.kill('SIGTERM');
    }, CONFIG.timeout);

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    // Parse test results from output
    const suitePattern = /📋 Test Suite: (.+)/g;
    const passPattern = /✅ (.+): PASSED/g;
    const failPattern = /❌ (.+): FAILED/g;

    let match;
    const suites = new Set();
    
    while ((match = suitePattern.exec(stdout)) !== null) {
      suites.add(match[1]);
    }

    const passed = new Set();
    while ((match = passPattern.exec(stdout)) !== null) {
      passed.add(match[1]);
    }

    const failed = new Set();
    while ((match = failPattern.exec(stdout)) !== null) {
      failed.add(match[1]);
    }

    // Build test results
    suites.forEach(suite => {
      let status = 'skipped';
      if (passed.has(suite)) status = 'passed';
      if (failed.has(suite)) status = 'failed';
      
      testResults.testSuites.push({
        name: suite,
        status: status,
        duration: null // Would need to parse this from output
      });
    });

    testResults.summary.total = suites.size;
    testResults.summary.passed = passed.size;
    testResults.summary.failed = failed.size;
    testResults.summary.skipped = suites.size - passed.size - failed.size;

    const duration = Date.now() - startTime;
    testResults.endTime = new Date().toISOString();
    testResults.duration = duration;
    testResults.exitCode = exitCode;

    // Write results to file
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(testResults, null, 2));

    // Send metrics to Datadog
    sendDatadogMetric('suite_completed', 1, ['suite_type:master', `status:${exitCode === 0 ? 'success' : 'failure'}`]);
    sendDatadogMetric('suite_duration_ms', duration, ['suite_type:master']);
    sendDatadogMetric('tests_total', testResults.summary.total, ['suite_type:master']);
    sendDatadogMetric('tests_passed', testResults.summary.passed, ['suite_type:master']);
    sendDatadogMetric('tests_failed', testResults.summary.failed, ['suite_type:master']);

    // Output summary
    console.log('\n📊 Test Suite Summary');
    console.log('====================');
    console.log(`Total suites: ${testResults.summary.total}`);
    console.log(`Passed: ${testResults.summary.passed}`);
    console.log(`Failed: ${testResults.summary.failed}`);
    console.log(`Skipped: ${testResults.summary.skipped}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Results saved to: ${CONFIG.outputFile}`);

    if (exitCode === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some tests failed!');
    }

    process.exit(exitCode);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    testResults.endTime = new Date().toISOString();
    testResults.duration = duration;
    testResults.error = error.message;
    testResults.exitCode = 1;

    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(testResults, null, 2));

    sendDatadogMetric('suite_completed', 1, ['suite_type:master', 'status:error']);
    sendDatadogMetric('suite_duration_ms', duration, ['suite_type:master']);

    console.error(`\n❌ Test suite execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMasterTestSuite().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}

export { runMasterTestSuite };