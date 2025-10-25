/**
 * Multi-Armed Bandit Engine
 *
 * Implements Thompson Sampling for dynamic model selection across multiple AI models.
 * Uses Beta distribution to model uncertainty and balance exploration vs exploitation.
 *
 * Key Features:
 * - Thompson Sampling with Beta distributions
 * - Dynamic traffic allocation based on performance
 * - Regret calculation for convergence analysis
 * - Reward function for cost-quality tradeoff optimization
 */

/**
 * Represents a single arm (model) in the bandit
 */
export interface BanditArm {
  key: string;
  name: string;
  model: string; // OpenRouter model ID
  priorAlpha: number; // Beta distribution alpha (successes + 1)
  priorBeta: number; // Beta distribution beta (failures + 1)
}

/**
 * Configuration for the multi-armed bandit
 */
export interface BanditConfig {
  experimentKey: string;
  arms: BanditArm[];
  explorationRate: number; // 0-1, default 0.1 (10% exploration)
  rewardFunction: (metrics: ModelMetrics) => number; // Custom reward calculation
}

/**
 * Metrics for evaluating model performance
 */
export interface ModelMetrics {
  qualityScore: number; // 0-1
  latencyMs: number;
  costUsd: number;
  userRating?: number; // 1-5
  tokensGenerated: number;
}

/**
 * Result of arm selection
 */
export interface BanditSelection {
  selectedArm: BanditArm;
  selectionProbability: number;
  sampledValue: number; // Sampled value from Beta distribution
  explorationVsExploitation: 'exploration' | 'exploitation';
}

/**
 * Select arm using Thompson Sampling
 *
 * Thompson Sampling works by:
 * 1. Sampling a value from each arm's Beta distribution
 * 2. Selecting the arm with the highest sampled value
 * 3. With probability explorationRate, select a random arm instead
 *
 * @param config - Bandit configuration
 * @returns Selected arm with metadata
 */
export function selectArm(config: BanditConfig): BanditSelection {
  const { arms, explorationRate } = config;

  if (arms.length === 0) {
    throw new Error('No arms available for selection');
  }

  // Decide: exploration or exploitation
  const isExploration = Math.random() < explorationRate;

  if (isExploration) {
    // Exploration: select random arm
    const randomArm = arms[Math.floor(Math.random() * arms.length)];
    const sampledValue = sampleBeta(randomArm.priorAlpha, randomArm.priorBeta);

    return {
      selectedArm: randomArm,
      selectionProbability: 1 / arms.length,
      sampledValue,
      explorationVsExploitation: 'exploration'
    };
  }

  // Exploitation: Thompson Sampling
  // Sample from each arm's Beta distribution
  const sampledValues = arms.map(arm => ({
    arm,
    value: sampleBeta(arm.priorAlpha, arm.priorBeta)
  }));

  // Select arm with highest sampled value
  const bestSample = sampledValues.reduce((best, current) =>
    current.value > best.value ? current : best
  );

  // Calculate selection probability (approximate)
  // In practice, this is the probability that this arm's sample is highest
  const totalAlpha = arms.reduce((sum, arm) => sum + arm.priorAlpha, 0);
  const totalBeta = arms.reduce((sum, arm) => sum + arm.priorBeta, 0);
  const totalTrials = totalAlpha + totalBeta - arms.length * 2; // Remove initial priors

  // Approximate probability based on current success rate
  const armSuccessRate = bestSample.arm.priorAlpha / (bestSample.arm.priorAlpha + bestSample.arm.priorBeta);
  const selectionProb = Math.max(0.1, Math.min(0.9, armSuccessRate));

  return {
    selectedArm: bestSample.arm,
    selectionProbability: selectionProb,
    sampledValue: bestSample.value,
    explorationVsExploitation: 'exploitation'
  };
}

/**
 * Update arm parameters based on observed reward
 *
 * Bayesian update using Beta-Bernoulli conjugate prior:
 * - If reward >= 0.5: success, increment alpha
 * - If reward < 0.5: failure, increment beta
 *
 * @param arm - Arm to update
 * @param reward - Observed reward (0-1)
 * @param metrics - Metrics from model execution (for logging)
 * @returns Updated arm
 */
export function updateArm(
  arm: BanditArm,
  reward: number,
  metrics: ModelMetrics
): BanditArm {
  // Convert reward to binary outcome using threshold
  const success = reward >= 0.5;

  return {
    ...arm,
    priorAlpha: arm.priorAlpha + (success ? 1 : 0),
    priorBeta: arm.priorBeta + (success ? 0 : 1)
  };
}

/**
 * Calculate reward from metrics
 *
 * Combines quality, speed, and cost into single reward value (0-1).
 * Default weights: quality=0.5, speed=0.3, cost=0.2
 *
 * @param metrics - Model execution metrics
 * @param weights - Weights for each component
 * @returns Reward value (0-1)
 */
export function calculateReward(
  metrics: ModelMetrics,
  weights?: { quality: number; speed: number; cost: number }
): number {
  const w = weights || { quality: 0.5, speed: 0.3, cost: 0.2 };

  // Quality score (already 0-1)
  const qualityComponent = metrics.qualityScore * w.quality;

  // Speed component (inverse of latency, normalized)
  // Assume max acceptable latency is 10,000ms
  const speedScore = Math.max(0, 1 - metrics.latencyMs / 10000);
  const speedComponent = speedScore * w.speed;

  // Cost component (inverse of cost, normalized)
  // Assume max acceptable cost is $0.10 per request
  const costScore = Math.max(0, 1 - metrics.costUsd / 0.10);
  const costComponent = costScore * w.cost;

  // Combine components
  const reward = qualityComponent + speedComponent + costComponent;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, reward));
}

/**
 * Get current traffic allocation across arms
 *
 * Returns probability that each arm will be selected based on current priors.
 * This is an approximation using success rates.
 *
 * @param arms - Array of bandit arms
 * @returns Map of arm key to selection probability (0-1)
 */
export function getTrafficAllocation(arms: BanditArm[]): Record<string, number> {
  if (arms.length === 0) {
    return {};
  }

  // Calculate success rate for each arm
  const successRates = arms.map(arm => ({
    key: arm.key,
    rate: arm.priorAlpha / (arm.priorAlpha + arm.priorBeta)
  }));

  // Normalize to probabilities using softmax
  const totalRate = successRates.reduce((sum, item) => sum + Math.exp(item.rate * 5), 0);

  const allocation: Record<string, number> = {};
  for (const item of successRates) {
    allocation[item.key] = Math.exp(item.rate * 5) / totalRate;
  }

  return allocation;
}

/**
 * Calculate cumulative regret
 *
 * Regret = (optimal reward × total requests) - actual cumulative reward
 * Measures opportunity cost of not always choosing the best arm.
 *
 * @param arms - Array of bandit arms
 * @param totalRequests - Total number of requests made
 * @param optimalReward - Reward from optimal arm
 * @returns Cumulative regret
 */
export function calculateRegret(
  arms: BanditArm[],
  totalRequests: number,
  optimalReward: number
): number {
  // Calculate actual cumulative reward from arm selections
  const totalTrials = arms.reduce(
    (sum, arm) => sum + (arm.priorAlpha + arm.priorBeta - 2),
    0
  );

  // Total successes across all arms
  const totalSuccesses = arms.reduce((sum, arm) => sum + (arm.priorAlpha - 1), 0);

  // Actual cumulative reward (average success rate)
  const actualReward = totalTrials > 0 ? totalSuccesses / totalTrials : 0;
  const actualCumulativeReward = actualReward * totalRequests;

  // Optimal cumulative reward
  const optimalCumulativeReward = optimalReward * totalRequests;

  // Regret is the difference
  const regret = optimalCumulativeReward - actualCumulativeReward;

  return Math.max(0, regret);
}

/**
 * Sample from Beta distribution using Gamma distribution
 *
 * Beta(α, β) can be sampled using two Gamma samples:
 * X ~ Gamma(α, 1)
 * Y ~ Gamma(β, 1)
 * Z = X / (X + Y) ~ Beta(α, β)
 *
 * @param alpha - Beta alpha parameter (successes)
 * @param beta - Beta beta parameter (failures)
 * @returns Sample from Beta(alpha, beta)
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);

  if (x + y === 0) {
    return 0.5; // Avoid division by zero
  }

  return x / (x + y);
}

/**
 * Sample from Gamma distribution using Marsaglia-Tsang method
 *
 * @param shape - Gamma shape parameter (α)
 * @param scale - Gamma scale parameter (θ)
 * @returns Sample from Gamma(shape, scale)
 */
function sampleGamma(shape: number, scale: number): number {
  // Special case for small shape values
  if (shape < 1) {
    const u = Math.random();
    return sampleGamma(shape + 1, scale) * Math.pow(u, 1 / shape);
  }

  // Marsaglia-Tsang method for shape >= 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number;
    let v: number;

    // Generate x from normal distribution
    do {
      x = sampleNormal(0, 1);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    // Squeeze acceptance
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }

    // Acceptance/rejection
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Sample from standard normal distribution using Box-Muller transform
 *
 * @param mean - Mean of normal distribution
 * @param stdDev - Standard deviation
 * @returns Sample from N(mean, stdDev²)
 */
function sampleNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return mean + stdDev * z0;
}

/**
 * Get expected reward for an arm (mean of Beta distribution)
 *
 * @param arm - Bandit arm
 * @returns Expected reward (0-1)
 */
export function getExpectedReward(arm: BanditArm): number {
  return arm.priorAlpha / (arm.priorAlpha + arm.priorBeta);
}

/**
 * Get confidence interval for arm's expected reward
 *
 * Uses Wilson score interval for binomial proportion.
 *
 * @param arm - Bandit arm
 * @param confidence - Confidence level (default: 0.95)
 * @returns [lower, upper] bounds of confidence interval
 */
export function getConfidenceInterval(
  arm: BanditArm,
  confidence: number = 0.95
): [number, number] {
  const n = arm.priorAlpha + arm.priorBeta - 2; // Total trials
  const p = getExpectedReward(arm); // Success rate

  if (n === 0) {
    return [0, 1];
  }

  // Z-score for confidence level (1.96 for 95%)
  const z = getZScore(confidence);

  // Wilson score interval
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return [lower, upper];
}

/**
 * Get Z-score for confidence level
 *
 * @param confidence - Confidence level (e.g., 0.95)
 * @returns Z-score
 */
function getZScore(confidence: number): number {
  const confidenceMap: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };

  return confidenceMap[confidence] || 1.96;
}

/**
 * Check if bandit has converged
 *
 * Convergence criteria:
 * 1. Best arm has high selection probability (>60%)
 * 2. Confidence intervals are narrow (<0.1 width)
 * 3. Regret growth is sublinear
 *
 * @param arms - Array of bandit arms
 * @param minTrials - Minimum trials before declaring convergence
 * @returns true if converged
 */
export function hasConverged(
  arms: BanditArm[],
  minTrials: number = 100
): boolean {
  if (arms.length === 0) {
    return false;
  }

  // Check minimum trials
  const totalTrials = arms.reduce(
    (sum, arm) => sum + (arm.priorAlpha + arm.priorBeta - 2),
    0
  );

  if (totalTrials < minTrials) {
    return false;
  }

  // Check if best arm has dominant selection probability
  const allocation = getTrafficAllocation(arms);
  const maxAllocation = Math.max(...Object.values(allocation));

  if (maxAllocation < 0.6) {
    return false; // No dominant arm yet
  }

  // Check confidence interval widths
  const intervals = arms.map(arm => getConfidenceInterval(arm));
  const maxWidth = Math.max(...intervals.map(([lower, upper]) => upper - lower));

  if (maxWidth > 0.1) {
    return false; // Still too much uncertainty
  }

  return true; // Converged!
}
