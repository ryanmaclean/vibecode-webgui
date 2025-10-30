/**
 * Synthetic Test Data Generator for Speech-to-Text Experiment
 *
 * Generates realistic test transcriptions with expected latency,
 * cost, and accuracy metrics for both GPT-4 and GPT-4.1 variants.
 */

import { warehouse } from '../warehouse';
import { SPEECH_TO_TEXT_EXPERIMENT } from './speech-to-text';

// ==================== TYPES ====================

export interface SyntheticTranscription {
  id: string;
  audioDescription: string;
  referenceTranscript: string;
  expectedLatency: { gpt4: number; gpt41: number };
  expectedCost: { gpt4: number; gpt41: number };
  expectedWER: { gpt4: number; gpt41: number };
  difficulty: 'easy' | 'medium' | 'hard';
}

// ==================== TEST TRANSCRIPTIONS ====================

export const TEST_TRANSCRIPTIONS: SyntheticTranscription[] = [
  {
    id: 'test_001',
    audioDescription: 'Short customer support call (30 seconds)',
    referenceTranscript: 'Hello, I need help with my account. I cannot log in and I have tried resetting my password three times already. Can you please assist me?',
    expectedLatency: { gpt4: 2500, gpt41: 1800 },
    expectedCost: { gpt4: 0.008, gpt41: 0.010 },
    expectedWER: { gpt4: 0.02, gpt41: 0.018 },
    difficulty: 'easy'
  },
  {
    id: 'test_002',
    audioDescription: 'Medical consultation excerpt (60 seconds)',
    referenceTranscript: 'The patient presents with acute abdominal pain in the lower right quadrant. Symptoms began approximately forty-eight hours ago. Temperature is elevated at thirty-eight point five degrees Celsius. Recommended immediate imaging and bloodwork.',
    expectedLatency: { gpt4: 3200, gpt41: 2100 },
    expectedCost: { gpt4: 0.012, gpt41: 0.014 },
    expectedWER: { gpt4: 0.03, gpt41: 0.025 },
    difficulty: 'hard'
  },
  {
    id: 'test_003',
    audioDescription: 'Conference call introduction (45 seconds)',
    referenceTranscript: 'Good morning everyone, thank you for joining today\'s quarterly review meeting. We have several important topics to discuss including our Q3 performance metrics, upcoming product launches, and strategic initiatives for the next fiscal year.',
    expectedLatency: { gpt4: 2800, gpt41: 1900 },
    expectedCost: { gpt4: 0.010, gpt41: 0.012 },
    expectedWER: { gpt4: 0.015, gpt41: 0.012 },
    difficulty: 'medium'
  },
  {
    id: 'test_004',
    audioDescription: 'Technical support troubleshooting (90 seconds)',
    referenceTranscript: 'First, check if the VPN connection is established properly. Open the network settings and verify the IP configuration. If the connection shows as active but you still cannot access resources, try flushing the DNS cache using the command line. Run ipconfig slash flushdns on Windows or sudo dscacheutil dash flushcache on macOS.',
    expectedLatency: { gpt4: 3800, gpt41: 2600 },
    expectedCost: { gpt4: 0.015, gpt41: 0.018 },
    expectedWER: { gpt4: 0.04, gpt41: 0.032 },
    difficulty: 'hard'
  },
  {
    id: 'test_005',
    audioDescription: 'Podcast interview snippet (120 seconds)',
    referenceTranscript: 'I think the most important thing to understand about artificial intelligence is that it is fundamentally a tool. Like any powerful tool, it can be used for tremendous good or potential harm. The key is ensuring we develop these systems with proper safeguards, ethical considerations, and a deep understanding of the societal implications. We need diverse voices at the table when making decisions about AI development and deployment.',
    expectedLatency: { gpt4: 4200, gpt41: 2900 },
    expectedCost: { gpt4: 0.018, gpt41: 0.021 },
    expectedWER: { gpt4: 0.025, gpt41: 0.020 },
    difficulty: 'medium'
  },
  {
    id: 'test_006',
    audioDescription: 'Voicemail message (20 seconds)',
    referenceTranscript: 'Hi Sarah, this is Mike from accounting. Just wanted to confirm that we received your expense report. Give me a call back when you get a chance. Thanks.',
    expectedLatency: { gpt4: 2000, gpt41: 1400 },
    expectedCost: { gpt4: 0.006, gpt41: 0.007 },
    expectedWER: { gpt4: 0.01, gpt41: 0.008 },
    difficulty: 'easy'
  },
  {
    id: 'test_007',
    audioDescription: 'Legal deposition excerpt (75 seconds)',
    referenceTranscript: 'On the evening of March fifteenth, two thousand twenty-three, I was working late at the office. At approximately nine thirty PM, I heard unusual sounds coming from the parking garage. I proceeded to investigate and observed an individual tampering with vehicle registration tags. I immediately contacted building security and waited for their arrival.',
    expectedLatency: { gpt4: 3500, gpt41: 2400 },
    expectedCost: { gpt4: 0.014, gpt41: 0.016 },
    expectedWER: { gpt4: 0.035, gpt41: 0.028 },
    difficulty: 'hard'
  },
  {
    id: 'test_008',
    audioDescription: 'Product demo narration (60 seconds)',
    referenceTranscript: 'Welcome to the dashboard. On the left side, you will find the main navigation menu with quick access to all features. The center panel displays your current projects and their status. Click on any project card to view detailed analytics, team members, and recent activity. You can customize your view using the filters at the top.',
    expectedLatency: { gpt4: 3000, gpt41: 2000 },
    expectedCost: { gpt4: 0.011, gpt41: 0.013 },
    expectedWER: { gpt4: 0.02, gpt41: 0.015 },
    difficulty: 'medium'
  },
  {
    id: 'test_009',
    audioDescription: 'News broadcast excerpt (55 seconds)',
    referenceTranscript: 'Breaking news this evening: the city council has approved the new infrastructure bill with a vote of seven to four. The twenty-five million dollar project will focus on improving public transportation, upgrading water systems, and expanding broadband internet access to underserved neighborhoods. Construction is expected to begin next quarter.',
    expectedLatency: { gpt4: 2900, gpt41: 2000 },
    expectedCost: { gpt4: 0.010, gpt41: 0.012 },
    expectedWER: { gpt4: 0.022, gpt41: 0.018 },
    difficulty: 'medium'
  },
  {
    id: 'test_010',
    audioDescription: 'Restaurant order with background noise (35 seconds)',
    referenceTranscript: 'I would like to order the grilled salmon with asparagus and mashed potatoes. And can I also get a side salad with balsamic vinaigrette? Oh, and a glass of sparkling water with lemon, please.',
    expectedLatency: { gpt4: 2600, gpt41: 1850 },
    expectedCost: { gpt4: 0.009, gpt41: 0.011 },
    expectedWER: { gpt4: 0.045, gpt41: 0.038 },
    difficulty: 'hard'
  }
];

// ==================== DATA GENERATION FUNCTIONS ====================

/**
 * Generate synthetic experiment data
 *
 * Creates realistic assignment and metric data for testing statistical analysis.
 * Simulates the expected 30% latency improvement and 16% cost increase.
 *
 * @param count - Number of synthetic assignments to generate
 */
export async function generateSyntheticData(count: number): Promise<void> {
  const { experimentKey } = SPEECH_TO_TEXT_EXPERIMENT;

  console.log(`Generating ${count} synthetic experiment records...`);

  const batchSize = 100;
  let generated = 0;

  while (generated < count) {
    const remaining = count - generated;
    const batchCount = Math.min(batchSize, remaining);

    await generateBatch(experimentKey, batchCount, generated);

    generated += batchCount;
    console.log(`Generated ${generated}/${count} records`);
  }

  // Flush all pending data
  await warehouse.flush();

  console.log(`Successfully generated ${count} synthetic records`);
}

/**
 * Generate a batch of synthetic data
 */
async function generateBatch(
  experimentKey: string,
  count: number,
  offset: number
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const userId = `synthetic_user_${offset + i}`;

    // Randomly assign to variant (50/50 split)
    const variantKey = Math.random() < 0.5 ? 'gpt4' : 'gpt41';

    // Select random test transcription
    const testCase = TEST_TRANSCRIPTIONS[
      Math.floor(Math.random() * TEST_TRANSCRIPTIONS.length)
    ];

    // Generate metrics with realistic variation
    const metrics = generateMetrics(variantKey, testCase);

    // Log assignment
    promises.push(
      warehouse.logAssignment(experimentKey, userId, variantKey)
    );

    // Log metrics
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'latency_ms', metrics.latencyMs)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'ttft_ms', metrics.ttftMs)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'cost_per_request', metrics.costUsd)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'word_error_rate', metrics.wordErrorRate)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'confidence_score', metrics.confidenceScore)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'tokens_used', metrics.tokensUsed)
    );
    promises.push(
      warehouse.logMetric(experimentKey, userId, 'transcript_length', metrics.transcriptLength)
    );
  }

  await Promise.all(promises);
}

/**
 * Generate realistic metrics with statistical variation
 */
function generateMetrics(
  variantKey: 'gpt4' | 'gpt41',
  testCase: SyntheticTranscription
): {
  latencyMs: number;
  ttftMs: number;
  costUsd: number;
  wordErrorRate: number;
  confidenceScore: number;
  tokensUsed: number;
  transcriptLength: number;
} {
  // Base values from test case
  const baseLatency = testCase.expectedLatency[variantKey];
  const baseCost = testCase.expectedCost[variantKey];
  const baseWER = testCase.expectedWER[variantKey];

  // Add realistic variation using normal distribution
  const latencyMs = Math.round(normalRandom(baseLatency, baseLatency * 0.15));
  const ttftMs = Math.round(latencyMs * 0.2); // TTFT is ~20% of total latency

  const costUsd = normalRandom(baseCost, baseCost * 0.1);
  const wordErrorRate = Math.max(0, Math.min(0.1, normalRandom(baseWER, baseWER * 0.3)));

  const confidenceScore = Math.max(0, Math.min(1, 1 - wordErrorRate + normalRandom(0, 0.05)));

  // Estimate tokens and transcript length
  const transcriptLength = Math.round(
    normalRandom(testCase.referenceTranscript.split(/\s+/).length, 10)
  );
  const tokensUsed = Math.round(transcriptLength * 1.3); // ~1.3 tokens per word

  return {
    latencyMs,
    ttftMs,
    costUsd,
    wordErrorRate,
    confidenceScore,
    tokensUsed,
    transcriptLength
  };
}

/**
 * Generate normally distributed random number using Box-Muller transform
 */
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return mean + z0 * stdDev;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate test data for demo purposes (smaller dataset)
 */
export async function generateDemoData(): Promise<void> {
  console.log('Generating demo data (1000 records)...');
  await generateSyntheticData(1000);
  console.log('Demo data generated successfully!');
}

/**
 * Generate full test dataset
 */
export async function generateFullTestData(): Promise<void> {
  console.log('Generating full test data (10,000 records)...');
  await generateSyntheticData(10000);
  console.log('Full test data generated successfully!');
}

/**
 * Clear all experiment data (for testing)
 */
export async function clearExperimentData(): Promise<void> {
  console.log('Note: Clear function requires database access');
  console.log('Use SQL: DELETE FROM experiment_assignments WHERE experiment_id = ...');
  console.log('        DELETE FROM experiment_metrics WHERE experiment_id = ...');
}

/**
 * Get expected results based on hypothesis
 *
 * Returns what we expect to see if hypothesis is true:
 * - GPT-4.1 is 30% faster
 * - GPT-4.1 is 16% more expensive
 * - Similar accuracy
 */
export function getExpectedResults() {
  return {
    latency: {
      gpt4Mean: 2800, // ms
      gpt41Mean: 1960, // 30% faster
      improvement: 30,
      significant: true
    },
    cost: {
      gpt4Mean: 0.011, // USD
      gpt41Mean: 0.0128, // 16% more expensive
      difference: 16,
      significant: true
    },
    accuracy: {
      gpt4Mean: 0.025, // WER
      gpt41Mean: 0.022, // Slightly better
      difference: -12,
      significant: false // Not statistically significant
    }
  };
}
