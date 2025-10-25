/**
 * Script to Generate Synthetic Chatbot Data
 *
 * Usage: npx tsx scripts/generate-chatbot-data.ts [count]
 */

import { generateChatbotSyntheticData, generateExpectedResults } from '../src/lib/experiments/scenarios/chatbot-test-data'
import { getChatbotExperimentSummary } from '../src/lib/experiments/scenarios/chatbot-speed'

async function main() {
  const count = parseInt(process.argv[2] || '1000', 10)

  console.log('='.repeat(60))
  console.log('Chatbot Performance Experiment - Synthetic Data Generation')
  console.log('='.repeat(60))
  console.log()

  // Generate expected results
  const expected = generateExpectedResults(count)
  console.log('Expected Results:')
  console.log('-'.repeat(60))
  console.log(`Total sessions: ${expected.totalSessions}`)
  console.log(`Variant distribution:`)
  console.log(`  - Lazy Load: ${expected.variantDistribution.lazy_load}`)
  console.log(`  - Preload: ${expected.variantDistribution.preload}`)
  console.log()
  console.log('Expected Metrics:')
  console.log(`  TTFT:`)
  console.log(`    Lazy: ${expected.expectedMetrics.ttft.lazy_load}ms`)
  console.log(`    Preload: ${expected.expectedMetrics.ttft.preload}ms`)
  console.log(`    Improvement: ${expected.expectedMetrics.ttft.improvement.toFixed(1)}%`)
  console.log()
  console.log(`  Cold Start:`)
  console.log(`    Lazy: ${expected.expectedMetrics.coldStart.lazy_load}ms`)
  console.log(`    Preload: ${expected.expectedMetrics.coldStart.preload}ms`)
  console.log()
  console.log(`  Messages/Session:`)
  console.log(`    Lazy: ${expected.expectedMetrics.messagesPerSession.lazy_load.toFixed(1)}`)
  console.log(`    Preload: ${expected.expectedMetrics.messagesPerSession.preload.toFixed(1)}`)
  console.log(`    Improvement: ${expected.expectedMetrics.messagesPerSession.improvement.toFixed(1)}%`)
  console.log()
  console.log(`  Engagement:`)
  console.log(`    Lazy: ${expected.expectedMetrics.engagement.lazy_load.toFixed(2)}`)
  console.log(`    Preload: ${expected.expectedMetrics.engagement.preload.toFixed(2)}`)
  console.log(`    Improvement: ${expected.expectedMetrics.engagement.improvement.toFixed(1)}%`)
  console.log()

  // Generate data
  console.log('Generating synthetic data...')
  console.log()

  try {
    await generateChatbotSyntheticData(count)
    console.log()
    console.log('✓ Data generation complete!')
    console.log()

    // Get actual results
    console.log('Analyzing results...')
    const summary = await getChatbotExperimentSummary()

    console.log()
    console.log('='.repeat(60))
    console.log('Actual Results:')
    console.log('-'.repeat(60))
    console.log(`Total sessions: ${summary.totalSessions}`)
    console.log(`Variant distribution:`)
    console.log(`  - Lazy Load: ${summary.variantDistribution.lazy_load || 0}`)
    console.log(`  - Preload: ${summary.variantDistribution.preload || 0}`)
    console.log()

    console.log('Metrics Comparison:')
    console.log('-'.repeat(60))

    // TTFT
    console.log('Time to First Token (TTFT):')
    console.log(`  Lazy Load: ${summary.metrics.ttft.lazy_load.toFixed(0)}ms`)
    console.log(`  Preload: ${summary.metrics.ttft.preload.toFixed(0)}ms`)
    console.log(`  Improvement: ${summary.metrics.ttft.improvement.toFixed(1)}%`)
    console.log(`  P-value: ${summary.metrics.ttft.pValue.toFixed(4)}`)
    console.log()

    // Cold Start
    console.log('Cold Start Latency:')
    console.log(`  Lazy Load: ${summary.metrics.coldStart.lazy_load.toFixed(0)}ms`)
    console.log(`  Preload: ${summary.metrics.coldStart.preload.toFixed(0)}ms`)
    console.log(`  Difference: ${summary.metrics.coldStart.difference.toFixed(0)}ms eliminated`)
    console.log()

    // Messages per Session
    const msgSignificant = summary.statisticalSignificance.messagesPerSession.significant
    console.log('Messages per Session:')
    console.log(`  Lazy Load: ${summary.metrics.messagesPerSession.lazy_load.toFixed(2)}`)
    console.log(`  Preload: ${summary.metrics.messagesPerSession.preload.toFixed(2)}`)
    console.log(`  Improvement: ${summary.metrics.messagesPerSession.improvement.toFixed(1)}%`)
    console.log(`  P-value: ${summary.metrics.messagesPerSession.pValue.toFixed(4)}`)
    console.log(`  Significant: ${msgSignificant ? '✓ YES' : '✗ NO'}`)
    console.log()

    // Engagement
    const engSignificant = summary.statisticalSignificance.engagement.significant
    console.log('Engagement Score:')
    console.log(`  Lazy Load: ${summary.metrics.engagement.lazy_load.toFixed(3)}`)
    console.log(`  Preload: ${summary.metrics.engagement.preload.toFixed(3)}`)
    console.log(`  Improvement: ${summary.metrics.engagement.improvement.toFixed(1)}%`)
    console.log(`  P-value: ${summary.metrics.engagement.pValue.toFixed(4)}`)
    console.log(`  Significant: ${engSignificant ? '✓ YES' : '✗ NO'}`)
    console.log()

    // SRM Check
    console.log('Sample Ratio Mismatch (SRM):')
    console.log(`  Has mismatch: ${summary.srmStatus.hasMismatch ? '✗ YES' : '✓ NO'}`)
    console.log(`  P-value: ${summary.srmStatus.pValue.toFixed(4)}`)
    console.log()

    // Decision
    console.log('='.repeat(60))
    console.log('DECISION RECOMMENDATION:')
    console.log('-'.repeat(60))

    if (summary.srmStatus.hasMismatch) {
      console.log('⚠️  WARNING: Sample Ratio Mismatch detected!')
      console.log('   Investigate randomization before making decision.')
      console.log()
    }

    if (msgSignificant || engSignificant) {
      console.log('✓ SHIP PRELOAD VARIANT')
      console.log()
      console.log('Justification:')
      if (msgSignificant) {
        console.log(`  • Messages/session improved by ${summary.metrics.messagesPerSession.improvement.toFixed(1)}% (p=${summary.metrics.messagesPerSession.pValue.toFixed(4)})`)
      }
      if (engSignificant) {
        console.log(`  • Engagement improved by ${summary.metrics.engagement.improvement.toFixed(1)}% (p=${summary.metrics.engagement.pValue.toFixed(4)})`)
      }
      console.log(`  • TTFT improved by ${summary.metrics.ttft.improvement.toFixed(1)}%`)
      console.log(`  • Cold start eliminated (${summary.metrics.coldStart.difference.toFixed(0)}ms saved)`)
      console.log()
      console.log('The performance benefits outweigh the minimal initialization overhead.')
    } else {
      console.log('⏳ CONTINUE EXPERIMENT')
      console.log()
      console.log('Results are not yet statistically significant.')
      console.log(`Need approximately ${Math.ceil((800 - summary.totalSessions) / 2)} more sessions per variant.`)
    }

    console.log()
    console.log('='.repeat(60))

  } catch (error) {
    console.error('Error generating data:', error)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
