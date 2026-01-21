#!/usr/bin/env node
const { runTestWithTracing, dogstatsd, tracer } = require('./test-with-datadog');

async function main() {
  console.log('============================================');
  console.log('VibeCode Test Suite with Datadog Telemetry');
  console.log('============================================');
  console.log('Service: vibecode-tests');
  console.log('Version: 3.3.0');
  console.log('APM Port: 8136');
  console.log('StatsD Port: 8135');
  console.log('============================================\n');
  
  dogstatsd.increment('test.suite.started');
  const suiteStartTime = Date.now();
  
  const tests = [
    { 
      file: 'test-terminal-functionality-post-build.js', 
      name: 'terminal-functionality',
      description: 'Terminal functionality and command execution'
    },
    { 
      file: 'test-datadog-extension-post-build.js', 
      name: 'datadog-extension',
      description: 'Datadog extension SSH connectivity and monitoring'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const test of tests) {
    console.log(`\n=== Test: ${test.name} ===`);
    console.log(`Description: ${test.description}`);
    console.log(`File: ${test.file}\n`);
    
    const result = await runTestWithTracing(test.file, test.name);
    results.push({ ...test, ...result });
    
    if (result.success) {
      passed++;
      console.log(`✓ PASSED (${result.duration}ms)\n`);
    } else {
      failed++;
      console.error(`✗ FAILED (${result.duration}ms)\n`);
    }
  }
  
  const suiteDuration = Date.now() - suiteStartTime;
  
  console.log('\n============================================');
  console.log('Test Suite Summary');
  console.log('============================================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${suiteDuration}ms`);
  console.log('============================================\n');
  
  // Send summary metrics
  dogstatsd.gauge('test.suite.passed', passed);
  dogstatsd.gauge('test.suite.failed', failed);
  dogstatsd.gauge('test.suite.total', tests.length);
  dogstatsd.gauge('test.suite.success_rate', (passed / tests.length) * 100);
  dogstatsd.timing('test.suite.duration', suiteDuration);
  dogstatsd.increment('test.suite.completed');
  
  // Detailed results
  console.log('\nDetailed Results:');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}: ${r.success ? '✓ PASSED' : '✗ FAILED'} (${r.duration}ms)`);
  });
  
  // Flush and close
  console.log('\nFlushing traces to Datadog...');
  await tracer.flush();
  dogstatsd.close();
  console.log('Done. Check Datadog APM for traces and metrics.\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  dogstatsd.increment('test.suite.error');
  dogstatsd.close();
  process.exit(1);
});
