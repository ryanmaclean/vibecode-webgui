#!/usr/bin/env node

/**
 * Scale Test Runner for pgvector
 * Executable script to run scale tests from command line
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const TEST_CONFIGS = {
  'quick': {
    total_embeddings: 1000,
    batch_size: 100,
    search_queries: 50,
    concurrent_searches: 5
  },
  'standard': {
    total_embeddings: 10000,
    batch_size: 500,
    search_queries: 200,
    concurrent_searches: 20
  },
  'production': {
    total_embeddings: 100000,
    batch_size: 1000,
    search_queries: 1000,
    concurrent_searches: 50
  }
};

async function runScaleTest(testType = 'quick') {
  const config = TEST_CONFIGS[testType];
  if (!config) {
    console.error(`Invalid test type: ${testType}`);
    console.error(`Available types: ${Object.keys(TEST_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Starting ${testType} scale test...`);
  console.log(`Configuration:`, config);
  
  // Create test script
  const testScript = `
import { VectorScaleTest } from './scale-test';

async function main() {
  const scaleTest = new VectorScaleTest();
  
  try {
    const result = await scaleTest.runScaleTest(${JSON.stringify(config)});
    
    console.log('\\n=== SCALE TEST RESULTS ===');
    console.log('Configuration:', result.config);
    console.log('\\nInsertion Phase:');
    console.log(\`- Total time: \${(result.results.insertion_phase.total_time_ms / 1000).toFixed(2)}s\`);
    console.log(\`- Insertions/sec: \${result.results.insertion_phase.avg_insertion_per_second.toFixed(2)}\`);
    
    console.log('\\nSearch Phase:');
    console.log(\`- Avg search time: \${result.results.search_phase.avg_search_time_ms.toFixed(2)}ms\`);
    console.log(\`- P95 search time: \${result.results.search_phase.p95_search_time_ms.toFixed(2)}ms\`);
    
    console.log('\\nConcurrent Phase:');
    console.log(\`- Queries/sec: \${result.results.concurrent_phase.queries_per_second.toFixed(2)}\`);
    console.log(\`- Avg concurrent time: \${result.results.concurrent_phase.avg_query_time_ms.toFixed(2)}ms\`);
    
    // Generate and save report
    const report = scaleTest.generateReport([{
      scenario_name: '${testType.charAt(0).toUpperCase() + testType.slice(1)} Scale Test',
      ...result
    }]);
    
    const reportPath = \`./scale-test-report-\${testType}-\${Date.now()}.md\`;
    require('fs').writeFileSync(reportPath, report);
    console.log(\`\\nReport saved to: \${reportPath}\`);
    
  } catch (error) {
    console.error('Scale test failed:', error);
    process.exit(1);
  } finally {
    await scaleTest.close();
  }
}

main().catch(console.error);
`;

  // Write temporary test file
  const tempTestFile = path.join(__dirname, `temp-scale-test-${testType}.mjs`);
  fs.writeFileSync(tempTestFile, testScript);

  try {
    // Run the test
    const child = spawn('node', [tempTestFile], {
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--experimental-modules' }
    });

    return new Promise((resolve, reject) => {
      child.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempTestFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    // Clean up temp file on error
    try {
      fs.unlinkSync(tempTestFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function checkPrerequisites() {
  console.log('Checking prerequisites...');
  
  // Check if pgvector pod is running
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', [
      'get', 'pods', '-n', 'vibecode-webgui', 
      '-l', 'app.kubernetes.io/name=vibecode-pgvector',
      '--no-headers'
    ]);

    let output = '';
    kubectl.stdout.on('data', (data) => {
      output += data.toString();
    });

    kubectl.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Failed to check pgvector pod status'));
        return;
      }

      const lines = output.trim().split('\n').filter(line => line.trim());
      const runningPods = lines.filter(line => line.includes('Running')).length;
      
      if (runningPods === 0) {
        reject(new Error('No running pgvector pods found. Please deploy pgvector first.'));
        return;
      }

      console.log(`✓ Found ${runningPods} running pgvector pod(s)`);
      resolve();
    });
  });
}

async function main() {
  const testType = process.argv[2] || 'quick';
  
  console.log('pgvector Scale Test Runner');
  console.log('==========================');
  
  try {
    await checkPrerequisites();
    await runScaleTest(testType);
    console.log('\\n✓ Scale test completed successfully!');
  } catch (error) {
    console.error('\\n✗ Scale test failed:', error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runScaleTest, checkPrerequisites };
