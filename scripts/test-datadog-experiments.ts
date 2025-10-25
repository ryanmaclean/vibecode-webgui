/**
 * Test Datadog Experiments
 *
 * Runs all experiments and tracks to Datadog LLM Observability
 */

import { runAllExperimentsForUser } from '../src/lib/experiments/run-datadog-experiments';

async function main() {
  const numUsers = process.argv[2] ? parseInt(process.argv[2]) : 5;

  console.log(`Running all experiments for ${numUsers} test users...\n`);

  for (let i = 1; i <= numUsers; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`User ${i}/${numUsers}: test-user-${i}`);
    console.log('='.repeat(60));

    try {
      await runAllExperimentsForUser(`test-user-${i}`);
    } catch (error) {
      console.error(`Error for user ${i}:`, error);
    }

    // Small delay between users
    if (i < numUsers) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All experiments complete!');
  console.log('='.repeat(60));
  console.log('\n📊 View results in Datadog:');
  console.log('   → LLM Observability: https://app.datadoghq.com/llm');
  console.log('   → Feature Flags: https://app.datadoghq.com/rum/feature-flags');
  console.log('   → RUM Analytics: https://app.datadoghq.com/rum');
  console.log('');
}

main().catch(console.error);
