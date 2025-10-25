# Multi-Armed Bandits for Dynamic Optimization

**Goal:** Implement Thompson Sampling to automatically find the best AI model
**Difficulty:** Advanced
**Time:** 45-60 minutes
**Prerequisites:** Completed Tutorials 1 & 2, understanding of probability, basic statistics

---

## What You'll Learn

By the end of this tutorial, you will:
- ✅ Understand exploration vs exploitation trade-off
- ✅ Implement Thompson Sampling with Beta distributions
- ✅ Create adaptive reward functions for AI models
- ✅ Track convergence and regret
- ✅ Know when to use bandits vs A/B tests
- ✅ Deploy continuous optimization to production

## The Problem with A/B Tests

Traditional A/B tests have limitations:

**A/B Test Approach:**
```
Week 1-2: Collect data (50/50 split)
  - GPT-4:   1000 requests → avg quality 0.82
  - Claude:  1000 requests → avg quality 0.79
Week 3: Analyze and decide
Week 4+: Deploy winner (100% to GPT-4)

Result: 1000 requests sent to suboptimal model
Regret: (0.82 - 0.79) × 1000 = 30 quality points wasted
```

**Multi-Armed Bandit Approach:**
```
Request 1-100:   Explore (random)
Request 101-500: Start exploiting better model
Request 501+:    Heavily favor best model (but still explore)

Result: Automatically shifts traffic to winner
Regret: Much lower (~5-10 quality points wasted)
```

## The Multi-Armed Bandit Analogy

Imagine you're in a casino with 4 slot machines (arms):
- Each has an unknown payout rate
- You have 100 coins to spend
- Goal: Maximize total payout

**Strategies:**

1. **Pure Exploration:** Try each machine 25 times
   - Learn true rates
   - But waste money on bad machines

2. **Pure Exploitation:** Try each once, then only play best
   - Maximize short-term gains
   - But might miss better machine due to luck

3. **Thompson Sampling:** Balance both
   - Start with uncertainty (all machines equally likely)
   - Gradually shift to better machines
   - Never completely ignore any machine (in case it's better)

## Thompson Sampling Explained

Thompson Sampling uses Bayesian inference to balance exploration/exploitation.

**The Math (Simplified):**

For each model (arm), we maintain a Beta distribution:
- `Beta(α, β)` where:
  - `α` = successes + 1
  - `β` = failures + 1

**Algorithm:**
1. For each arm, sample from its Beta distribution
2. Choose arm with highest sample
3. Observe reward (success/failure)
4. Update that arm's Beta distribution
5. Repeat

**Why it works:**
- Initially: All arms have Beta(1,1) = uniform distribution
- After data: Better arms have higher α, worse arms have higher β
- Sampling naturally balances exploration/exploitation

## Step 1: Define the Bandit Configuration (5 min)

```typescript
// experiments/model-selection-bandit.ts

export const MODEL_SELECTION_BANDIT = {
  experimentKey: 'model_selection_bandit_v1',
  name: 'AI Model Selection - Thompson Sampling',
  type: 'multi_arm_bandit',

  // The "arms" (models to choose from)
  arms: [
    {
      key: 'gpt4',
      name: 'GPT-4',
      model: 'gpt-4',
      provider: 'openai',
      // Prior beliefs (start with no data)
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'gpt4_turbo',
      name: 'GPT-4 Turbo',
      model: 'gpt-4-turbo',
      provider: 'openai',
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'claude',
      name: 'Claude 3.5 Sonnet',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      priorAlpha: 1,
      priorBeta: 1
    },
    {
      key: 'gemini',
      name: 'Gemini 1.5 Pro',
      model: 'gemini-1.5-pro',
      provider: 'google',
      priorAlpha: 1,
      priorBeta: 1
    }
  ],

  // Reward function configuration
  rewardFunction: {
    type: 'composite',
    weights: {
      quality: 0.50,     // 50% weight on quality
      cost: 0.30,        // 30% weight on cost efficiency
      latency: 0.20      // 20% weight on speed
    },
    // Normalize to 0-1 range
    normalize: true
  },

  // Exploration settings
  explorationRate: 0.10, // 10% of requests explore randomly
  minSamplesPerArm: 50,  // Minimum samples before heavy exploitation

  // Convergence criteria
  convergenceThreshold: 0.95, // Stop when 95% confident in winner
  minRequests: 1000,          // Minimum total requests before declaring winner
}
```

## Step 2: Implement Thompson Sampling (10 min)

```typescript
// lib/experiments/multi-arm-bandit.ts

export interface BanditArm {
  key: string
  name: string
  model: string
  provider: string
  alpha: number  // Successes + prior
  beta: number   // Failures + prior
  totalPulls: number
  totalReward: number
  averageReward: number
}

export interface BanditState {
  experimentKey: string
  arms: BanditArm[]
  totalRequests: number
  hasConverged: boolean
  winner?: string
}

/**
 * Sample from Beta distribution
 * Using approximation for computational efficiency
 */
function sampleBeta(alpha: number, beta: number): number {
  // For large alpha, beta, use normal approximation
  if (alpha > 100 && beta > 100) {
    const mean = alpha / (alpha + beta)
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))
    const stdDev = Math.sqrt(variance)

    // Box-Muller transform for normal distribution
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    return Math.max(0, Math.min(1, mean + z * stdDev))
  }

  // For small alpha, beta, use Gamma distribution method
  const gammaAlpha = gammaRandom(alpha, 1)
  const gammaBeta = gammaRandom(beta, 1)
  return gammaAlpha / (gammaAlpha + gammaBeta)
}

/**
 * Generate Gamma-distributed random variable
 */
function gammaRandom(shape: number, scale: number): number {
  // Marsaglia and Tsang method
  const d = shape - 1/3
  const c = 1 / Math.sqrt(9 * d)

  while (true) {
    let x: number
    let v: number

    do {
      x = randomNormal(0, 1)
      v = 1 + c * x
    } while (v <= 0)

    v = v * v * v
    const u = Math.random()

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale
    }
  }
}

function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

/**
 * Select arm using Thompson Sampling
 */
export function selectArm(bandit: BanditState): {
  selectedArm: BanditArm
  sampledValues: Record<string, number>
  reason: 'thompson_sampling' | 'exploration' | 'min_samples'
} {
  // Force exploration if any arm has too few samples
  const needsExploration = bandit.arms.some(
    arm => arm.totalPulls < MODEL_SELECTION_BANDIT.minSamplesPerArm
  )

  if (needsExploration) {
    const undersampled = bandit.arms
      .filter(arm => arm.totalPulls < MODEL_SELECTION_BANDIT.minSamplesPerArm)
      .sort((a, b) => a.totalPulls - b.totalPulls)

    return {
      selectedArm: undersampled[0],
      sampledValues: {},
      reason: 'min_samples'
    }
  }

  // Random exploration with probability ε
  if (Math.random() < MODEL_SELECTION_BANDIT.explorationRate) {
    const randomArm = bandit.arms[Math.floor(Math.random() * bandit.arms.length)]
    return {
      selectedArm: randomArm,
      sampledValues: {},
      reason: 'exploration'
    }
  }

  // Thompson Sampling: sample from each arm's Beta distribution
  const sampledValues: Record<string, number> = {}

  for (const arm of bandit.arms) {
    sampledValues[arm.key] = sampleBeta(arm.alpha, arm.beta)
  }

  // Select arm with highest sampled value
  const selectedArm = bandit.arms.reduce((best, arm) => {
    return sampledValues[arm.key] > sampledValues[best.key] ? arm : best
  }, bandit.arms[0])

  return {
    selectedArm,
    sampledValues,
    reason: 'thompson_sampling'
  }
}

/**
 * Update arm after observing reward
 */
export function updateArm(
  arm: BanditArm,
  reward: number,
  metadata?: {
    quality?: number
    cost?: number
    latency?: number
  }
): BanditArm {
  // Update counts
  const totalPulls = arm.totalPulls + 1
  const totalReward = arm.totalReward + reward

  // Update Beta distribution
  // Treat reward as probability of success
  const success = reward > 0.5 ? 1 : 0
  const alpha = arm.alpha + success
  const beta = arm.beta + (1 - success)

  return {
    ...arm,
    alpha,
    beta,
    totalPulls,
    totalReward,
    averageReward: totalReward / totalPulls
  }
}

/**
 * Check if bandit has converged
 */
export function hasConverged(bandit: BanditState): boolean {
  if (bandit.totalRequests < MODEL_SELECTION_BANDIT.minRequests) {
    return false
  }

  // Find best arm by average reward
  const bestArm = bandit.arms.reduce((best, arm) =>
    arm.averageReward > best.averageReward ? arm : best
  )

  // Calculate probability that bestArm is actually best
  // by comparing its Beta distribution to others
  const samples = 10000
  let bestCount = 0

  for (let i = 0; i < samples; i++) {
    const bestSample = sampleBeta(bestArm.alpha, bestArm.beta)

    const isActuallyBest = bandit.arms.every(arm => {
      if (arm.key === bestArm.key) return true
      const armSample = sampleBeta(arm.alpha, arm.beta)
      return bestSample >= armSample
    })

    if (isActuallyBest) bestCount++
  }

  const probability = bestCount / samples
  return probability >= MODEL_SELECTION_BANDIT.convergenceThreshold
}
```

## Step 3: Define Reward Function (10 min)

The reward function is critical. It must balance multiple objectives:

```typescript
// lib/experiments/multi-arm-bandit.ts

export interface RewardInputs {
  qualityScore: number    // 0-1 (higher is better)
  latencyMs: number       // milliseconds (lower is better)
  costUsd: number         // USD (lower is better)
  tokensGenerated: number
}

export function calculateReward(inputs: RewardInputs): number {
  const weights = MODEL_SELECTION_BANDIT.rewardFunction.weights

  // 1. Quality component (0-1, already normalized)
  const qualityReward = inputs.qualityScore

  // 2. Cost component (0-1, inverted and normalized)
  // Assume max acceptable cost is $0.05 per request
  const maxCost = 0.05
  const costReward = Math.max(0, 1 - (inputs.costUsd / maxCost))

  // 3. Latency component (0-1, inverted and normalized)
  // Assume max acceptable latency is 5000ms
  const maxLatency = 5000
  const latencyReward = Math.max(0, 1 - (inputs.latencyMs / maxLatency))

  // Weighted combination
  const compositeReward = (
    qualityReward * weights.quality +
    costReward * weights.cost +
    latencyReward * weights.latency
  )

  // Ensure 0-1 range
  return Math.max(0, Math.min(1, compositeReward))
}

/**
 * Example reward calculations:
 *
 * GPT-4 (high quality, expensive, slow):
 *   quality: 0.85, cost: $0.028, latency: 1850ms
 *   reward = 0.85 * 0.5 + 0.44 * 0.3 + 0.63 * 0.2 = 0.683
 *
 * Claude (good quality, cheap, fast):
 *   quality: 0.79, cost: $0.011, latency: 1200ms
 *   reward = 0.79 * 0.5 + 0.78 * 0.3 + 0.76 * 0.2 = 0.781
 *
 * GPT-4 Turbo (good quality, moderate cost, fast):
 *   quality: 0.81, cost: $0.015, latency: 1100ms
 *   reward = 0.81 * 0.5 + 0.70 * 0.3 + 0.78 * 0.2 = 0.771
 *
 * Result: Claude wins! (highest composite reward)
 */
```

## Step 4: Implement Request Handler (10 min)

```typescript
// app/api/ai/bandit-explain-code/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { selectArm, updateArm, calculateReward } from '@/lib/experiments/multi-arm-bandit'
import { getBanditState, saveBanditState } from '@/lib/experiments/warehouse'

export async function POST(req: NextRequest) {
  const { userId, code, language } = await req.json()

  // Load current bandit state
  const bandit = await getBanditState('model_selection_bandit_v1')

  // Select arm using Thompson Sampling
  const { selectedArm, sampledValues, reason } = selectArm(bandit)

  console.log(`Selected ${selectedArm.name} via ${reason}`)
  console.log('Sampled values:', sampledValues)

  // Execute request with selected model
  const startTime = Date.now()
  const result = await callModel(selectedArm.model, code, language)
  const latencyMs = Date.now() - startTime

  // Evaluate quality
  const qualityScore = evaluateQuality(result.explanation, code)

  // Calculate cost
  const costUsd = calculateCost(
    selectedArm.model,
    result.inputTokens,
    result.outputTokens
  )

  // Calculate composite reward
  const reward = calculateReward({
    qualityScore,
    latencyMs,
    costUsd,
    tokensGenerated: result.outputTokens
  })

  // Update arm
  const updatedArm = updateArm(selectedArm, reward, {
    quality: qualityScore,
    cost: costUsd,
    latency: latencyMs
  })

  // Update bandit state
  const updatedBandit = {
    ...bandit,
    arms: bandit.arms.map(arm =>
      arm.key === selectedArm.key ? updatedArm : arm
    ),
    totalRequests: bandit.totalRequests + 1
  }

  // Check convergence
  const converged = hasConverged(updatedBandit)
  if (converged && !updatedBandit.hasConverged) {
    const winner = updatedBandit.arms.reduce((best, arm) =>
      arm.averageReward > best.averageReward ? arm : best
    )

    updatedBandit.hasConverged = true
    updatedBandit.winner = winner.key

    console.log(`🎉 Bandit converged! Winner: ${winner.name}`)
    console.log(`Average reward: ${winner.averageReward.toFixed(3)}`)
  }

  // Save updated state
  await saveBanditState(updatedBandit)

  // Log detailed metrics
  await logBanditMetrics({
    experimentKey: 'model_selection_bandit_v1',
    userId,
    armKey: selectedArm.key,
    reward,
    quality: qualityScore,
    cost: costUsd,
    latency: latencyMs,
    selectionReason: reason,
    sampledValues
  })

  return NextResponse.json({
    explanation: result.explanation,
    selectedModel: selectedArm.name,
    metrics: {
      quality: qualityScore,
      cost: costUsd,
      latency: latencyMs,
      reward
    },
    banditInfo: {
      totalRequests: updatedBandit.totalRequests,
      hasConverged: updatedBandit.hasConverged,
      winner: updatedBandit.winner
    }
  })
}
```

## Step 5: Monitor Convergence (5 min)

```typescript
// scripts/monitor-bandit-convergence.ts

import { getBanditState, getBanditHistory } from '@/lib/experiments/warehouse'

async function monitorBanditConvergence() {
  const bandit = await getBanditState('model_selection_bandit_v1')
  const history = await getBanditHistory('model_selection_bandit_v1', 1000)

  console.log('=== Multi-Armed Bandit Status ===\n')

  // Current state
  console.log(`Total requests: ${bandit.totalRequests}`)
  console.log(`Has converged: ${bandit.hasConverged}`)
  if (bandit.winner) {
    console.log(`Winner: ${bandit.arms.find(a => a.key === bandit.winner)?.name}`)
  }

  console.log('\n=== Arm Performance ===\n')

  // Sort arms by average reward
  const sortedArms = [...bandit.arms].sort((a, b) =>
    b.averageReward - a.averageReward
  )

  for (const arm of sortedArms) {
    const selectionRate = arm.totalPulls / bandit.totalRequests
    const confidence = calculateConfidence(arm.alpha, arm.beta)

    console.log(`${arm.name}:`)
    console.log(`  Pulls: ${arm.totalPulls} (${(selectionRate * 100).toFixed(1)}%)`)
    console.log(`  Average reward: ${arm.averageReward.toFixed(3)}`)
    console.log(`  Beta params: α=${arm.alpha.toFixed(1)}, β=${arm.beta.toFixed(1)}`)
    console.log(`  95% CI: [${confidence.lower.toFixed(3)}, ${confidence.upper.toFixed(3)}]`)
    console.log()
  }

  // Plot convergence over time
  console.log('=== Convergence Timeline ===\n')

  const snapshots = [100, 250, 500, 750, 1000].filter(n => n <= bandit.totalRequests)

  for (const requestCount of snapshots) {
    const snapshot = history.slice(0, requestCount)
    const distribution = calculateArmDistribution(snapshot)

    console.log(`After ${requestCount} requests:`)
    for (const [armKey, percentage] of Object.entries(distribution)) {
      const armName = bandit.arms.find(a => a.key === armKey)?.name
      const bar = '█'.repeat(Math.floor(percentage / 2))
      console.log(`  ${armName?.padEnd(20)} ${bar} ${percentage.toFixed(1)}%`)
    }
    console.log()
  }

  // Calculate regret
  const regret = calculateRegret(history)
  console.log(`\nTotal regret: ${regret.total.toFixed(2)}`)
  console.log(`Average regret per request: ${regret.average.toFixed(4)}`)
}

function calculateConfidence(alpha: number, beta: number): {
  lower: number
  upper: number
} {
  // 95% confidence interval for Beta distribution
  // Using approximation
  const mean = alpha / (alpha + beta)
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))
  const stdDev = Math.sqrt(variance)

  return {
    lower: Math.max(0, mean - 1.96 * stdDev),
    upper: Math.min(1, mean + 1.96 * stdDev)
  }
}

function calculateArmDistribution(history: BanditEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const event of history) {
    counts[event.armKey] = (counts[event.armKey] || 0) + 1
  }

  const total = history.length
  const percentages: Record<string, number> = {}

  for (const [key, count] of Object.entries(counts)) {
    percentages[key] = (count / total) * 100
  }

  return percentages
}

function calculateRegret(history: BanditEvent[]): {
  total: number
  average: number
} {
  // Regret = sum of (best_reward - actual_reward)
  const bestReward = Math.max(...history.map(e => e.reward))

  const totalRegret = history.reduce((sum, event) => {
    return sum + (bestReward - event.reward)
  }, 0)

  return {
    total: totalRegret,
    average: totalRegret / history.length
  }
}

// Run monitoring
setInterval(monitorBanditConvergence, 60000) // Every minute
```

**Example Output:**

```
=== Multi-Armed Bandit Status ===

Total requests: 1247
Has converged: true
Winner: Claude 3.5 Sonnet

=== Arm Performance ===

Claude 3.5 Sonnet:
  Pulls: 567 (45.5%)
  Average reward: 0.781
  Beta params: α=456.2, β=112.8
  95% CI: [0.765, 0.797]

GPT-4 Turbo:
  Pulls: 389 (31.2%)
  Average reward: 0.771
  Beta params: α=312.4, β=78.6
  95% CI: [0.753, 0.789]

GPT-4:
  Pulls: 201 (16.1%)
  Average reward: 0.683
  Beta params: α=143.2, β=59.8
  95% CI: [0.658, 0.708]

Gemini 1.5 Pro:
  Pulls: 90 (7.2%)
  Average reward: 0.654
  Beta params: α=61.3, β=30.7
  95% CI: [0.618, 0.690]

=== Convergence Timeline ===

After 100 requests:
  Claude 3.5 Sonnet    ██████ 27.0%
  GPT-4 Turbo          █████ 24.0%
  GPT-4                ██████ 26.0%
  Gemini 1.5 Pro       █████ 23.0%

After 250 requests:
  Claude 3.5 Sonnet    ████████ 35.2%
  GPT-4 Turbo          ███████ 30.4%
  GPT-4                ████ 20.8%
  Gemini 1.5 Pro       ███ 13.6%

After 500 requests:
  Claude 3.5 Sonnet    ██████████ 42.8%
  GPT-4 Turbo          ████████ 32.6%
  GPT-4                ████ 16.4%
  Gemini 1.5 Pro       ██ 8.2%

After 750 requests:
  Claude 3.5 Sonnet    ███████████ 44.7%
  GPT-4 Turbo          ████████ 31.5%
  GPT-4                ████ 16.3%
  Gemini 1.5 Pro       ██ 7.5%

After 1000 requests:
  Claude 3.5 Sonnet    ███████████ 45.3%
  GPT-4 Turbo          ████████ 31.4%
  GPT-4                ████ 16.2%
  Gemini 1.5 Pro       ██ 7.1%

Total regret: 27.34
Average regret per request: 0.0219
```

## When to Use Bandits vs A/B Tests

### Use A/B Tests When:

1. **You need definitive statistical proof**
   - Regulatory requirements
   - High-stakes decisions
   - Need to explain to non-technical stakeholders

2. **You have 2-3 variants**
   - Bandits shine with 4+ arms
   - A/B tests are simpler for few variants

3. **Variants are expensive to switch**
   - Infrastructure changes
   - One-time implementation costs
   - Can't easily revert

### Use Bandits When:

1. **You have many variants (4+)**
   - Testing multiple models
   - Many feature combinations
   - Continuous optimization

2. **Cost of exploration is high**
   - Expensive API calls
   - Limited user base
   - Time-sensitive optimization

3. **Environment changes over time**
   - Model performance drifts
   - User preferences evolve
   - Seasonal variations

4. **You want continuous optimization**
   - Always learning
   - Automatic adaptation
   - No manual intervention needed

## Advanced: Contextual Bandits (5 min)

Take it further: select models based on request context.

```typescript
// Contextual bandit: Choose model based on code complexity

interface Context {
  codeLength: number
  language: string
  hasLoops: boolean
  hasClasses: boolean
  complexity: 'simple' | 'medium' | 'complex'
}

function classifyComplexity(code: string, language: string): Context {
  const codeLength = code.length
  const hasLoops = /\b(for|while|forEach)\b/.test(code)
  const hasClasses = /\bclass\b/.test(code)

  let complexity: 'simple' | 'medium' | 'complex'

  if (codeLength < 100 && !hasClasses) {
    complexity = 'simple'
  } else if (codeLength > 500 || (hasClasses && hasLoops)) {
    complexity = 'complex'
  } else {
    complexity = 'medium'
  }

  return { codeLength, language, hasLoops, hasClasses, complexity }
}

// Maintain separate bandits for each context
const contextualBandits = {
  simple: createBandit(['gpt-3.5-turbo', 'claude-haiku']),
  medium: createBandit(['gpt-4-turbo', 'claude-sonnet']),
  complex: createBandit(['gpt-4', 'claude-opus'])
}

async function selectModelContextual(code: string, language: string) {
  const context = classifyComplexity(code, language)
  const bandit = contextualBandits[context.complexity]
  const { selectedArm } = selectArm(bandit)

  return selectedArm.model
}
```

## Troubleshooting

### Issue: Bandit not converging

**Symptoms:** After 1000+ requests, traffic still split evenly

**Causes:**
1. Models perform similarly (no clear winner)
2. High variance in rewards
3. Reward function is too noisy

**Solutions:**
```typescript
// Reduce exploration rate
explorationRate: 0.05 // from 0.10

// Increase minimum samples
minSamplesPerArm: 100 // from 50

// Smooth rewards (running average)
function smoothReward(newReward: number, oldAverage: number, alpha: number = 0.3): number {
  return alpha * newReward + (1 - alpha) * oldAverage
}
```

### Issue: Premature convergence

**Symptoms:** Bandit "converges" too quickly, picks suboptimal arm

**Causes:**
1. Lucky early samples
2. Insufficient exploration
3. Reward function bias

**Solutions:**
```typescript
// Increase minimum requests
minRequests: 2000 // from 1000

// Higher convergence threshold
convergenceThreshold: 0.98 // from 0.95

// Force minimum pulls per arm
minSamplesPerArm: 200 // from 50
```

## Next Steps

Congratulations! You've implemented Thompson Sampling. 🎉

**What you learned:**
- ✅ Exploration vs exploitation trade-off
- ✅ Thompson Sampling algorithm
- ✅ Composite reward functions
- ✅ Convergence monitoring
- ✅ When to use bandits vs A/B tests

**Next tutorial:**
- [Experiment Guardrails](./04-experiment-guardrails.md) - Prevent disasters

**Challenges:**
1. Implement contextual bandits (choose by request type)
2. Add time-decay to rewards (recent performance matters more)
3. Create A/A test to validate bandit implementation
4. Implement Upper Confidence Bound (UCB) alternative

---

**Tutorial word count:** 3,982 words
