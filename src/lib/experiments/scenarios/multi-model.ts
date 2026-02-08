/**
 * Multi-Model Experiment Scenario
 *
 * Implements dynamic model selection using multi-armed bandit (Thompson Sampling)
 * to optimize cost-quality tradeoff across 4+ AI models.
 */

import { OpenRouter } from '@/lib/openrouter-client';
import {
  BanditArm,
  BanditConfig,
  selectArm,
  updateArm,
  calculateReward,
  getTrafficAllocation,
  calculateRegret,
  getExpectedReward,
  ModelMetrics
} from '../multi-arm-bandit';
import { evaluateQuality, QualityEvaluation } from '../quality-evaluation';
import { experimentWarehouse } from '../warehouse';

/**
 * Model configurations
 */
export const MODELS = {
  gpt4: {
    key: 'gpt4',
    name: 'GPT-4 Turbo',
    model: 'openai/gpt-4-turbo',
    description: 'High quality, higher cost',
    expectedMetrics: {
      quality: 0.85,
      latencyMs: 2000,
      costPer1kTokens: 0.03
    }
  },
  claude: {
    key: 'claude',
    name: 'Claude 3.5 Sonnet',
    model: 'anthropic/claude-3.5-sonnet',
    description: 'Excellent reasoning, moderate cost',
    expectedMetrics: {
      quality: 0.88,
      latencyMs: 1800,
      costPer1kTokens: 0.015
    }
  },
  gemini: {
    key: 'gemini',
    name: 'Gemini 1.5 Pro',
    model: 'google/gemini-1.5-pro',
    description: 'Good quality, low cost',
    expectedMetrics: {
      quality: 0.80,
      latencyMs: 1500,
      costPer1kTokens: 0.007
    }
  },
  llama: {
    key: 'llama',
    name: 'Llama 3.1 70B',
    model: 'meta-llama/llama-3.1-70b-instruct',
    description: 'Decent quality, very low cost',
    expectedMetrics: {
      quality: 0.75,
      latencyMs: 1200,
      costPer1kTokens: 0.0015
    }
  }
};

/**
 * Multi-model experiment configuration
 */
export interface MultiModelExperiment {
  experimentKey: string;
  hypothesis: string;
  models: {
    gpt4: { model: string; initialPrior: { alpha: number; beta: number } };
    claude: { model: string; initialPrior: { alpha: number; beta: number } };
    gemini: { model: string; initialPrior: { alpha: number; beta: number } };
    llama: { model: string; initialPrior: { alpha: number; beta: number } };
  };
  rewardWeights: { quality: number; speed: number; cost: number };
}

/**
 * Model request
 */
export interface ModelRequest {
  userId: string;
  question: string;
  context?: string;
  expectedAnswer?: string; // For quality evaluation
}

/**
 * Model response
 */
export interface ModelResponse {
  selectedModel: string;
  modelKey: string;
  answer: string;
  metrics: ModelMetrics;
  reward: number;
  selectionProbability: number;
  qualityEvaluation: QualityEvaluation;
}

/**
 * In-memory bandit state
 * In production, this would be stored in a database
 */
let banditArms: BanditArm[] = [
  {
    key: 'gpt4',
    name: 'GPT-4 Turbo',
    model: 'openai/gpt-4-turbo',
    priorAlpha: 1, // Uniform prior (no initial bias)
    priorBeta: 1
  },
  {
    key: 'claude',
    name: 'Claude 3.5 Sonnet',
    model: 'anthropic/claude-3.5-sonnet',
    priorAlpha: 1,
    priorBeta: 1
  },
  {
    key: 'gemini',
    name: 'Gemini 1.5 Pro',
    model: 'google/gemini-1.5-pro',
    priorAlpha: 1,
    priorBeta: 1
  },
  {
    key: 'llama',
    name: 'Llama 3.1 70B',
    model: 'meta-llama/llama-3.1-70b-instruct',
    priorAlpha: 1,
    priorBeta: 1
  }
];

/**
 * Default experiment configuration
 */
const DEFAULT_EXPERIMENT: MultiModelExperiment = {
  experimentKey: 'multi_model_bandit',
  hypothesis: 'Thompson Sampling optimizes cost-quality tradeoff, achieving 95% of GPT-4 quality at 60% of the cost',
  models: {
    gpt4: {
      model: 'openai/gpt-4-turbo',
      initialPrior: { alpha: 1, beta: 1 }
    },
    claude: {
      model: 'anthropic/claude-3.5-sonnet',
      initialPrior: { alpha: 1, beta: 1 }
    },
    gemini: {
      model: 'google/gemini-1.5-pro',
      initialPrior: { alpha: 1, beta: 1 }
    },
    llama: {
      model: 'meta-llama/llama-3.1-70b-instruct',
      initialPrior: { alpha: 1, beta: 1 }
    }
  },
  rewardWeights: {
    quality: 0.5,
    speed: 0.3,
    cost: 0.2
  }
};

/**
 * Main multi-model function
 *
 * Selects a model using Thompson Sampling, queries it, evaluates quality,
 * and updates the bandit state.
 *
 * @param request - Model request
 * @returns Model response with metrics
 */
export async function askMultiModel(
  request: ModelRequest
): Promise<ModelResponse> {
  const config: BanditConfig = {
    experimentKey: DEFAULT_EXPERIMENT.experimentKey,
    arms: banditArms,
    explorationRate: 0.1,
    rewardFunction: (metrics) =>
      calculateReward(metrics, DEFAULT_EXPERIMENT.rewardWeights)
  };

  // 1. Select model using Thompson Sampling
  const selection = selectArm(config);
  const selectedArm = selection.selectedArm;

  // Log assignment
  await experimentWarehouse.logAssignment(
    DEFAULT_EXPERIMENT.experimentKey,
    request.userId,
    selectedArm.key,
    {
      probability: selection.selectionProbability,
      sampledValue: selection.sampledValue,
      strategy: selection.explorationVsExploitation
    }
  );

  // 2. Query selected model
  const apiKey = process.env.OPENROUTER_API_KEY || 'mock-key-for-testing';
  const client = new OpenRouter(apiKey);

  const startTime = Date.now();

  let answer = '';
  let tokensGenerated = 0;

  try {
    const response = await client.createChatCompletion({
      model: selectedArm.model,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: request.question }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    answer = response.choices[0]?.message?.content || '';
    tokensGenerated = response.usage?.total_tokens || 0;
  } catch (error) {
    console.error('Model query failed:', error);
    answer = 'Error: Failed to get response from model';
    tokensGenerated = 0;
  }

  const latencyMs = Date.now() - startTime;

  // 3. Estimate cost
  const modelConfig = MODELS[selectedArm.key as keyof typeof MODELS];
  const costUsd = (tokensGenerated / 1000) * modelConfig.expectedMetrics.costPer1kTokens;

  // 4. Evaluate quality
  const qualityEvaluation = await evaluateQuality(
    request.question,
    answer,
    request.expectedAnswer,
    undefined,
    false // Don't use LLM judge by default (expensive)
  );

  // 5. Calculate metrics and reward
  const metrics: ModelMetrics = {
    qualityScore: qualityEvaluation.score,
    latencyMs,
    costUsd,
    tokensGenerated
  };

  const reward = calculateReward(metrics, DEFAULT_EXPERIMENT.rewardWeights);

  // 6. Update bandit state
  const updatedArm = updateArm(selectedArm, reward, metrics);

  // Replace arm in global state
  const armIndex = banditArms.findIndex(arm => arm.key === selectedArm.key);
  if (armIndex !== -1) {
    banditArms[armIndex] = updatedArm;
  }

  // 7. Log metrics
  await experimentWarehouse.logMetric(
    DEFAULT_EXPERIMENT.experimentKey,
    request.userId,
    'reward',
    reward,
    metrics as unknown as import('@prisma/client').Prisma.InputJsonValue
  );

  await experimentWarehouse.logMetric(
    DEFAULT_EXPERIMENT.experimentKey,
    request.userId,
    'quality_score',
    qualityEvaluation.score
  );

  await experimentWarehouse.logMetric(
    DEFAULT_EXPERIMENT.experimentKey,
    request.userId,
    'latency_ms',
    latencyMs
  );

  await experimentWarehouse.logMetric(
    DEFAULT_EXPERIMENT.experimentKey,
    request.userId,
    'cost_usd',
    costUsd
  );

  return {
    selectedModel: selectedArm.model,
    modelKey: selectedArm.key,
    answer,
    metrics,
    reward,
    selectionProbability: selection.selectionProbability,
    qualityEvaluation
  };
}

/**
 * Get experiment leaderboard
 *
 * @returns Leaderboard with model rankings and stats
 */
export async function getModelLeaderboard(): Promise<{
  models: Array<{
    key: string;
    name: string;
    score: number;
    traffic: number; // percentage
    totalRequests: number;
    avgQuality: number;
    avgLatency: number;
    avgCost: number;
    expectedReward: number;
  }>;
  totalRequests: number;
  cumulativeReward: number;
  cumulativeRegret: number;
}> {
  // Get traffic allocation
  const allocation = getTrafficAllocation(banditArms);

  // Calculate total requests
  const totalRequests = banditArms.reduce(
    (sum, arm) => sum + (arm.priorAlpha + arm.priorBeta - 2),
    0
  );

  // Calculate cumulative reward
  const totalSuccesses = banditArms.reduce(
    (sum, arm) => sum + (arm.priorAlpha - 1),
    0
  );
  const cumulativeReward = totalRequests > 0 ? totalSuccesses / totalRequests : 0;

  // Calculate regret (assuming optimal reward is 0.9)
  const optimalReward = 0.9;
  const regret = calculateRegret(banditArms, totalRequests, optimalReward);

  // Get metrics from warehouse
  const results = await experimentWarehouse.getExperimentResults(
    DEFAULT_EXPERIMENT.experimentKey
  );

  // Build model stats
  const models = banditArms.map(arm => {
    const armRequests = arm.priorAlpha + arm.priorBeta - 2;
    const modelConfig = MODELS[arm.key as keyof typeof MODELS];

    // Get average metrics from warehouse
    const qualityKey = `${arm.key}_quality_score`;
    const latencyKey = `${arm.key}_latency_ms`;
    const costKey = `${arm.key}_cost_usd`;

    const avgQuality = results.metrics[qualityKey]?.mean || modelConfig.expectedMetrics.quality;
    const avgLatency = results.metrics[latencyKey]?.mean || modelConfig.expectedMetrics.latencyMs;
    const avgCost = results.metrics[costKey]?.mean || 0;

    return {
      key: arm.key,
      name: arm.name,
      score: getExpectedReward(arm),
      traffic: (allocation[arm.key] || 0) * 100,
      totalRequests: armRequests,
      avgQuality,
      avgLatency,
      avgCost,
      expectedReward: getExpectedReward(arm)
    };
  });

  // Sort by score (descending)
  models.sort((a, b) => b.score - a.score);

  return {
    models,
    totalRequests,
    cumulativeReward: cumulativeReward * totalRequests,
    cumulativeRegret: regret
  };
}

/**
 * Reset bandit state (for testing)
 */
export function resetBandit(): void {
  banditArms = [
    {
      key: 'gpt4',
      name: 'GPT-4 Turbo',
      model: 'openai/gpt-4-turbo',
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'claude',
      name: 'Claude 3.5 Sonnet',
      model: 'anthropic/claude-3.5-sonnet',
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'gemini',
      name: 'Gemini 1.5 Pro',
      model: 'google/gemini-1.5-pro',
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'llama',
      name: 'Llama 3.1 70B',
      model: 'meta-llama/llama-3.1-70b-instruct',
      priorAlpha: 1,
      priorBeta: 1
    }
  ];
}

/**
 * Get current bandit state (for debugging)
 */
export function getBanditState(): BanditArm[] {
  return [...banditArms];
}

/**
 * Set bandit state (for testing)
 */
export function setBanditState(arms: BanditArm[]): void {
  banditArms = [...arms];
}
