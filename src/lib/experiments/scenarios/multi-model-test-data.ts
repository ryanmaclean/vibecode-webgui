/**
 * Multi-Model Synthetic Test Data Generator
 *
 * Generates realistic synthetic data to demonstrate bandit convergence
 * without making actual API calls.
 */

import { setBanditState, resetBandit, getBanditState, MODELS } from './multi-model';
import { updateArm, calculateReward, BanditArm, ModelMetrics } from '../multi-arm-bandit';
import { experimentWarehouse } from '../warehouse';

/**
 * Model performance profiles
 * These define the "true" performance of each model
 */
const MODEL_PROFILES = {
  gpt4: {
    qualityMean: 0.85,
    qualityStdDev: 0.08,
    latencyMean: 2000,
    latencyStdDev: 300,
    costPer1kTokens: 0.03,
    tokensPerRequestMean: 400,
    tokensPerRequestStdDev: 100
  },
  claude: {
    qualityMean: 0.88, // Best quality
    qualityStdDev: 0.06,
    latencyMean: 1800,
    latencyStdDev: 250,
    costPer1kTokens: 0.015,
    tokensPerRequestMean: 380,
    tokensPerRequestStdDev: 90
  },
  gemini: {
    qualityMean: 0.80,
    qualityStdDev: 0.10,
    latencyMean: 1500,
    latencyStdDev: 200,
    costPer1kTokens: 0.007,
    tokensPerRequestMean: 350,
    tokensPerRequestStdDev: 80
  },
  llama: {
    qualityMean: 0.75, // Lowest quality but cheapest
    qualityStdDev: 0.12,
    latencyMean: 1200,
    latencyStdDev: 150,
    costPer1kTokens: 0.0015,
    tokensPerRequestMean: 320,
    tokensPerRequestStdDev: 70
  }
};

/**
 * Generate synthetic metrics for a model
 *
 * @param modelKey - Model identifier
 * @returns Simulated metrics
 */
function generateModelMetrics(modelKey: keyof typeof MODEL_PROFILES): ModelMetrics {
  const profile = MODEL_PROFILES[modelKey];

  // Generate quality score (normal distribution, clamped to [0, 1])
  const quality = Math.max(
    0,
    Math.min(1, sampleNormal(profile.qualityMean, profile.qualityStdDev))
  );

  // Generate latency (normal distribution, minimum 500ms)
  const latency = Math.max(500, sampleNormal(profile.latencyMean, profile.latencyStdDev));

  // Generate token count (normal distribution, minimum 50)
  const tokens = Math.max(50, Math.round(sampleNormal(profile.tokensPerRequestMean, profile.tokensPerRequestStdDev)));

  // Calculate cost
  const cost = (tokens / 1000) * profile.costPer1kTokens;

  return {
    qualityScore: quality,
    latencyMs: latency,
    costUsd: cost,
    tokensGenerated: tokens
  };
}

/**
 * Sample from normal distribution using Box-Muller transform
 */
function sampleNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z0;
}

/**
 * Simulate one bandit request
 *
 * @param arms - Current bandit state
 * @param explorationRate - Exploration probability
 * @returns Updated arms and metrics
 */
function simulateRequest(
  arms: BanditArm[],
  explorationRate: number = 0.1
): {
  arms: BanditArm[];
  selectedKey: string;
  metrics: ModelMetrics;
  reward: number;
} {
  // Simple Thompson Sampling selection
  const isExploration = Math.random() < explorationRate;

  let selectedArm: BanditArm;

  if (isExploration) {
    // Random exploration
    selectedArm = arms[Math.floor(Math.random() * arms.length)];
  } else {
    // Exploitation: sample from Beta distributions
    const samples = arms.map(arm => ({
      arm,
      value: sampleBeta(arm.priorAlpha, arm.priorBeta)
    }));
    selectedArm = samples.reduce((best, curr) => curr.value > best.value ? curr : best).arm;
  }

  // Generate synthetic metrics for selected model
  const metrics = generateModelMetrics(selectedArm.key as keyof typeof MODEL_PROFILES);

  // Calculate reward
  const reward = calculateReward(metrics, { quality: 0.5, speed: 0.3, cost: 0.2 });

  // Update arm
  const updatedArm = updateArm(selectedArm, reward, metrics);

  // Replace in arms array
  const updatedArms = arms.map(arm =>
    arm.key === selectedArm.key ? updatedArm : arm
  );

  return {
    arms: updatedArms,
    selectedKey: selectedArm.key,
    metrics,
    reward
  };
}

/**
 * Sample from Beta distribution
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x + y === 0 ? 0.5 : x / (x + y);
}

/**
 * Sample from Gamma distribution
 */
function sampleGamma(shape: number, scale: number): number {
  if (shape < 1) {
    const u = Math.random();
    return sampleGamma(shape + 1, scale) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number;
    let v: number;

    do {
      x = sampleNormal(0, 1);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Generate synthetic bandit data
 *
 * Simulates N requests to demonstrate convergence.
 * Expected result: Claude should win (highest quality-cost ratio).
 *
 * @param requests - Number of requests to simulate
 * @param verbose - Whether to log progress
 * @returns Summary statistics
 */
export async function generateMultiModelSyntheticData(
  requests: number = 5000,
  verbose: boolean = false
): Promise<{
  totalRequests: number;
  armSelections: Record<string, number>;
  finalArms: BanditArm[];
  convergencePoint: number | null;
  avgRewardByArm: Record<string, number>;
}> {
  // Reset bandit to initial state
  resetBandit();

  const armSelections: Record<string, number> = {
    gpt4: 0,
    claude: 0,
    gemini: 0,
    llama: 0
  };

  const rewardsByArm: Record<string, number[]> = {
    gpt4: [],
    claude: [],
    gemini: [],
    llama: []
  };

  let convergencePoint: number | null = null;
  let arms = getBanditState();

  // Simulate requests
  for (let i = 0; i < requests; i++) {
    const result = simulateRequest(arms, 0.1);

    arms = result.arms;
    armSelections[result.selectedKey]++;
    rewardsByArm[result.selectedKey].push(result.reward);

    // Check for convergence (dominant arm with >60% traffic after 100 requests)
    if (convergencePoint === null && i >= 100) {
      const totalSoFar = i + 1;
      const maxSelections = Math.max(...Object.values(armSelections));

      if (maxSelections / totalSoFar > 0.6) {
        convergencePoint = i + 1;
      }
    }

    // Log progress
    if (verbose && (i + 1) % 500 === 0) {
      const totalSoFar = i + 1;
      console.log(`\nProgress: ${totalSoFar}/${requests} requests`);
      console.log('Traffic allocation:');
      Object.entries(armSelections).forEach(([key, count]) => {
        const pct = ((count / totalSoFar) * 100).toFixed(1);
        console.log(`  ${key}: ${pct}% (${count} requests)`);
      });
    }
  }

  // Update global state
  setBanditState(arms);

  // Calculate average rewards
  const avgRewardByArm: Record<string, number> = {};
  Object.entries(rewardsByArm).forEach(([key, rewards]) => {
    avgRewardByArm[key] = rewards.length > 0
      ? rewards.reduce((sum, r) => sum + r, 0) / rewards.length
      : 0;
  });

  return {
    totalRequests: requests,
    armSelections,
    finalArms: arms,
    convergencePoint,
    avgRewardByArm
  };
}

/**
 * Generate and display test data summary
 */
export async function generateAndDisplayTestData(
  requests: number = 5000
): Promise<void> {
  console.log('Generating synthetic multi-model bandit data...\n');
  console.log(`Simulating ${requests} requests across 4 models:\n`);

  console.log('Model Performance Profiles:');
  Object.entries(MODEL_PROFILES).forEach(([key, profile]) => {
    console.log(`  ${key}:`);
    console.log(`    Quality: ${(profile.qualityMean * 100).toFixed(1)}% ± ${(profile.qualityStdDev * 100).toFixed(1)}%`);
    console.log(`    Latency: ${profile.latencyMean}ms ± ${profile.latencyStdDev}ms`);
    console.log(`    Cost: $${profile.costPer1kTokens}/1k tokens`);
  });

  console.log('\nRunning Thompson Sampling...\n');

  const result = await generateMultiModelSyntheticData(requests, true);

  console.log('\n=== FINAL RESULTS ===\n');

  // Traffic allocation
  console.log('Final Traffic Allocation:');
  const sortedByTraffic = Object.entries(result.armSelections)
    .sort(([, a], [, b]) => b - a);

  sortedByTraffic.forEach(([key, count], index) => {
    const pct = ((count / result.totalRequests) * 100).toFixed(1);
    const model = MODELS[key as keyof typeof MODELS];
    const rank = ['🥇', '🥈', '🥉', ''][index] || `${index + 1}.`;
    console.log(`  ${rank} ${model.name}: ${pct}% (${count} requests)`);
  });

  // Average rewards
  console.log('\nAverage Reward by Model:');
  const sortedByReward = Object.entries(result.avgRewardByArm)
    .sort(([, a], [, b]) => b - a);

  sortedByReward.forEach(([key, avgReward]) => {
    const model = MODELS[key as keyof typeof MODELS];
    console.log(`  ${model.name}: ${(avgReward * 100).toFixed(2)}%`);
  });

  // Convergence
  if (result.convergencePoint) {
    console.log(`\nConvergence Point: Request #${result.convergencePoint}`);
  } else {
    console.log('\nNo convergence detected (dominant arm needs >60% traffic)');
  }

  // Final arm states
  console.log('\nFinal Bandit State (Beta parameters):');
  result.finalArms.forEach(arm => {
    const model = MODELS[arm.key as keyof typeof MODELS];
    const successRate = arm.priorAlpha / (arm.priorAlpha + arm.priorBeta);
    console.log(`  ${model.name}: α=${arm.priorAlpha.toFixed(1)}, β=${arm.priorBeta.toFixed(1)}, p=${(successRate * 100).toFixed(1)}%`);
  });

  console.log('\nExperiment complete!');
}
