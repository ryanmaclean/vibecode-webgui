#!/usr/bin/env ts-node

/**
 * Thompson Sampling (Multi-Armed Bandit) Example
 *
 * Demonstrates adaptive experimentation with Thompson Sampling:
 * - Beta distribution sampling
 * - Dynamic arm selection
 * - Regret minimization
 * - Convergence tracking
 * - Visualization of learning
 *
 * Run with: npx ts-node examples/experiments/03-thompson-sampling.ts
 */

// ====================
// 1. BANDIT ARM DEFINITION
// ====================

interface BanditArm {
  name: string
  trueWinRate: number    // Ground truth (unknown to algorithm)
  alpha: number          // Beta distribution parameter (successes + 1)
  beta: number           // Beta distribution parameter (failures + 1)
  pulls: number          // Number of times pulled
  wins: number           // Number of successes
  totalReward: number    // Cumulative reward
}

// ====================
// 2. BETA DISTRIBUTION SAMPLING
// ====================

/**
 * Sample from Beta(α, β) distribution
 * Uses Gamma distribution method: Beta(α,β) = Gamma(α) / (Gamma(α) + Gamma(β))
 */
function sampleBeta(alpha: number, beta: number): number {
  const gammaAlpha = sampleGamma(alpha, 1)
  const gammaBeta = sampleGamma(beta, 1)
  return gammaAlpha / (gammaAlpha + gammaBeta)
}

/**
 * Sample from Gamma(shape, scale) distribution
 * Uses Marsaglia and Tsang method
 */
function sampleGamma(shape: number, scale: number): number {
  if (shape < 1) {
    // For shape < 1, use shape + 1 and adjust
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape)
  }

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

/**
 * Generate standard normal random variable
 * Uses Box-Muller transform
 */
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

// ====================
// 3. THOMPSON SAMPLING ALGORITHM
// ====================

/**
 * Select arm using Thompson Sampling
 */
function selectArm(arms: BanditArm[]): {
  selectedArm: BanditArm
  sampledValues: Record<string, number>
} {
  const sampledValues: Record<string, number> = {}

  // Sample from each arm's posterior distribution
  for (const arm of arms) {
    sampledValues[arm.name] = sampleBeta(arm.alpha, arm.beta)
  }

  // Select arm with highest sample
  const selectedArm = arms.reduce((best, arm) => {
    return sampledValues[arm.name] > sampledValues[best.name] ? arm : best
  }, arms[0])

  return { selectedArm, sampledValues }
}

/**
 * Update arm after observing reward
 */
function updateArm(arm: BanditArm, reward: number): BanditArm {
  const success = reward > 0.5 ? 1 : 0

  return {
    ...arm,
    pulls: arm.pulls + 1,
    wins: arm.wins + success,
    totalReward: arm.totalReward + reward,
    alpha: arm.alpha + success,
    beta: arm.beta + (1 - success)
  }
}

/**
 * Simulate pulling an arm (observe reward)
 */
function pullArm(arm: BanditArm): number {
  // Bernoulli trial with true win rate
  return Math.random() < arm.trueWinRate ? 1 : 0
}

// ====================
// 4. REGRET CALCULATION
// ====================

/**
 * Calculate regret for a sequence of arm selections
 */
function calculateRegret(history: { arm: string; reward: number }[], arms: BanditArm[]): {
  total: number
  cumulative: number[]
  average: number
} {
  const bestWinRate = Math.max(...arms.map(a => a.trueWinRate))
  const cumulative: number[] = []
  let totalRegret = 0

  for (const event of history) {
    const arm = arms.find(a => a.name === event.arm)!
    const regret = bestWinRate - arm.trueWinRate
    totalRegret += regret
    cumulative.push(totalRegret)
  }

  return {
    total: totalRegret,
    cumulative,
    average: totalRegret / history.length
  }
}

// ====================
// 5. RUN SIMULATION
// ====================

/**
 * Run Thompson Sampling simulation
 */
function runThompsonSampling(
  arms: BanditArm[],
  numRounds: number
): {
  arms: BanditArm[]
  history: { round: number; arm: string; reward: number; sampledValues: Record<string, number> }[]
  regret: { total: number; cumulative: number[]; average: number }
} {
  const history: { round: number; arm: string; reward: number; sampledValues: Record<string, number> }[] = []

  // Make a mutable copy of arms
  let currentArms = arms.map(a => ({ ...a }))

  for (let round = 1; round <= numRounds; round++) {
    // Select arm using Thompson Sampling
    const { selectedArm, sampledValues } = selectArm(currentArms)

    // Pull arm and observe reward
    const reward = pullArm(selectedArm)

    // Record history
    history.push({
      round,
      arm: selectedArm.name,
      reward,
      sampledValues
    })

    // Update arm
    const armIndex = currentArms.findIndex(a => a.name === selectedArm.name)
    currentArms[armIndex] = updateArm(selectedArm, reward)
  }

  // Calculate regret
  const regret = calculateRegret(
    history.map(h => ({ arm: h.arm, reward: h.reward })),
    arms
  )

  return {
    arms: currentArms,
    history,
    regret
  }
}

// ====================
// 6. VISUALIZATION
// ====================

/**
 * Display arm selection distribution over time
 */
function visualizeConvergence(
  history: { round: number; arm: string }[],
  arms: BanditArm[],
  checkpoints: number[] = [100, 250, 500, 750, 1000]
) {
  console.log('=== Convergence Over Time ===\n')

  for (const checkpoint of checkpoints) {
    if (checkpoint > history.length) continue

    const slice = history.slice(0, checkpoint)
    const distribution = calculateDistribution(slice, arms)

    console.log(`After ${checkpoint} rounds:`)

    for (const arm of arms) {
      const percentage = distribution[arm.name] || 0
      const bar = '█'.repeat(Math.floor(percentage / 2))
      const winRate = (arm.trueWinRate * 100).toFixed(1)
      console.log(`  ${arm.name.padEnd(20)} ${bar.padEnd(50)} ${percentage.toFixed(1)}% (true: ${winRate}%)`)
    }
    console.log()
  }
}

function calculateDistribution(
  history: { arm: string }[],
  arms: BanditArm[]
): Record<string, number> {
  const counts: Record<string, number> = {}

  // Initialize counts
  for (const arm of arms) {
    counts[arm.name] = 0
  }

  // Count selections
  for (const event of history) {
    counts[event.arm]++
  }

  // Convert to percentages
  const total = history.length
  const distribution: Record<string, number> = {}

  for (const arm of arms) {
    distribution[arm.name] = (counts[arm.name] / total) * 100
  }

  return distribution
}

/**
 * Display regret over time
 */
function visualizeRegret(regret: { total: number; cumulative: number[] }) {
  console.log('=== Regret Over Time ===\n')

  const checkpoints = [100, 250, 500, 750, 1000]

  console.log('Rounds | Cumulative Regret | Avg per Round')
  console.log('-------|-------------------|---------------')

  for (const checkpoint of checkpoints) {
    if (checkpoint > regret.cumulative.length) continue

    const cumulativeRegret = regret.cumulative[checkpoint - 1]
    const avgRegret = cumulativeRegret / checkpoint

    console.log(
      `${checkpoint.toString().padStart(6)} | ${cumulativeRegret.toFixed(2).padStart(17)} | ${avgRegret.toFixed(4).padStart(13)}`
    )
  }

  console.log()
  console.log(`Total regret: ${regret.total.toFixed(2)}`)
  console.log(`Average regret per round: ${regret.average.toFixed(4)}`)
  console.log()
}

/**
 * Display final arm statistics
 */
function displayArmStatistics(arms: BanditArm[]) {
  console.log('=== Final Arm Statistics ===\n')

  // Sort by total reward
  const sortedArms = [...arms].sort((a, b) => b.totalReward - a.totalReward)

  console.log('Arm                  | Pulls | Win Rate | Estimated | True     | Beta(α, β)')
  console.log('---------------------|-------|----------|-----------|----------|-------------')

  for (const arm of sortedArms) {
    const estimatedWinRate = arm.wins / arm.pulls
    const trueWinRate = arm.trueWinRate

    console.log(
      `${arm.name.padEnd(20)} | ${arm.pulls.toString().padStart(5)} | ${arm.wins.toString().padStart(8)} | ${(estimatedWinRate * 100).toFixed(2)}%`.padEnd(31) +
      ` | ${(trueWinRate * 100).toFixed(2)}%`.padEnd(9) +
      ` | (${arm.alpha.toFixed(1)}, ${arm.beta.toFixed(1)})`
    )
  }

  console.log()

  // Winner
  const winner = sortedArms[0]
  const actualBest = arms.reduce((best, arm) => arm.trueWinRate > best.trueWinRate ? arm : best)

  console.log(`Algorithm selected: ${winner.name} (${winner.pulls} pulls, ${(winner.wins / winner.pulls * 100).toFixed(2)}% win rate)`)
  console.log(`True best arm: ${actualBest.name} (${(actualBest.trueWinRate * 100).toFixed(2)}% win rate)`)
  console.log(`Correct winner: ${winner.name === actualBest.name ? 'YES ✓' : 'NO ✗'}`)
  console.log()
}

// ====================
// 7. COMPARISON WITH A/B TEST
// ====================

/**
 * Simulate traditional A/B test for comparison
 */
function runABTest(
  arms: BanditArm[],
  numRounds: number
): {
  arms: BanditArm[]
  regret: { total: number; average: number }
} {
  const pullsPerArm = Math.floor(numRounds / arms.length)
  let totalRegret = 0
  const bestWinRate = Math.max(...arms.map(a => a.trueWinRate))

  const updatedArms = arms.map(arm => {
    let wins = 0

    for (let i = 0; i < pullsPerArm; i++) {
      const reward = pullArm(arm)
      wins += reward
      totalRegret += bestWinRate - arm.trueWinRate
    }

    return {
      ...arm,
      pulls: pullsPerArm,
      wins,
      totalReward: wins,
      alpha: arm.alpha + wins,
      beta: arm.beta + (pullsPerArm - wins)
    }
  })

  return {
    arms: updatedArms,
    regret: {
      total: totalRegret,
      average: totalRegret / numRounds
    }
  }
}

function compareWithABTest(arms: BanditArm[], numRounds: number) {
  console.log('=== Thompson Sampling vs A/B Test ===\n')

  // Run Thompson Sampling
  const thompsonResult = runThompsonSampling([...arms], numRounds)

  // Run A/B Test
  const abResult = runABTest([...arms], numRounds)

  console.log(`Rounds: ${numRounds}`)
  console.log()

  console.log('Thompson Sampling:')
  console.log(`  Total regret: ${thompsonResult.regret.total.toFixed(2)}`)
  console.log(`  Average regret: ${thompsonResult.regret.average.toFixed(4)}`)
  console.log()

  console.log('A/B Test (equal allocation):')
  console.log(`  Total regret: ${abResult.regret.total.toFixed(2)}`)
  console.log(`  Average regret: ${abResult.regret.average.toFixed(4)}`)
  console.log()

  const regretReduction = (1 - thompsonResult.regret.total / abResult.regret.total) * 100

  console.log(`Regret reduction: ${regretReduction.toFixed(1)}% (Thompson Sampling is better!)`)
  console.log()
}

// ====================
// 8. MAIN EXECUTION
// ====================

function main() {
  console.log('\n' + '='.repeat(70))
  console.log('  THOMPSON SAMPLING (MULTI-ARMED BANDIT) EXAMPLE')
  console.log('='.repeat(70) + '\n')

  // Define arms (4 models with different true win rates)
  const arms: BanditArm[] = [
    {
      name: 'GPT-4',
      trueWinRate: 0.65,
      alpha: 1,
      beta: 1,
      pulls: 0,
      wins: 0,
      totalReward: 0
    },
    {
      name: 'GPT-4 Turbo',
      trueWinRate: 0.72,
      alpha: 1,
      beta: 1,
      pulls: 0,
      wins: 0,
      totalReward: 0
    },
    {
      name: 'Claude 3.5 Sonnet',
      trueWinRate: 0.78, // Best model!
      alpha: 1,
      beta: 1,
      pulls: 0,
      wins: 0,
      totalReward: 0
    },
    {
      name: 'Gemini 1.5 Pro',
      trueWinRate: 0.61,
      alpha: 1,
      beta: 1,
      pulls: 0,
      wins: 0,
      totalReward: 0
    }
  ]

  console.log('Scenario: Selecting best AI model for code explanations')
  console.log('Metric: User satisfaction (1 = satisfied, 0 = not satisfied)')
  console.log()

  console.log('True win rates (unknown to algorithm):')
  for (const arm of arms) {
    console.log(`  ${arm.name}: ${(arm.trueWinRate * 100).toFixed(1)}%`)
  }
  console.log()

  // Run simulation
  const numRounds = 1000
  console.log(`Running ${numRounds} rounds of Thompson Sampling...\n`)

  const result = runThompsonSampling(arms, numRounds)

  // Display results
  visualizeConvergence(result.history, arms)
  displayArmStatistics(result.arms)
  visualizeRegret(result.regret)

  // Compare with A/B test
  compareWithABTest(arms, numRounds)

  console.log('=== Key Insights ===\n')
  console.log('1. Thompson Sampling automatically shifts traffic to better arms')
  console.log('2. Regret is minimized by exploiting good arms while still exploring')
  console.log('3. No need to wait for statistical significance - continuously optimizes')
  console.log('4. Much lower regret than traditional A/B testing')
  console.log('5. Works well even with many arms (4+ variants)')
  console.log()

  console.log('='.repeat(70) + '\n')
}

// Run if executed directly
if (require.main === module) {
  main()
}

// Export for testing
export {
  sampleBeta,
  selectArm,
  updateArm,
  pullArm,
  runThompsonSampling,
  calculateRegret
}
