#!/usr/bin/env ts-node

/**
 * Statistical Analysis Example
 *
 * Demonstrates core statistical concepts for experimentation:
 * - Sample size calculation
 * - T-tests
 * - Confidence intervals
 * - P-values
 * - Effect size (Cohen's d)
 * - Power analysis
 *
 * Run with: npx ts-node examples/experiments/02-statistical-analysis.ts
 */

// ====================
// 1. SAMPLE SIZE CALCULATION
// ====================

/**
 * Calculate minimum sample size for detecting a given effect
 *
 * Uses the formula for comparing two proportions:
 * n = [(Zα/2 + Zβ)² × (p1(1-p1) + p2(1-p2))] / (p2 - p1)²
 */
function calculateSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  power: number = 0.80,
  alpha: number = 0.05
): number {
  // Calculate treatment rate
  const treatmentRate = baselineRate * (1 + minimumDetectableEffect)

  // Z-scores
  const zAlpha = 1.96  // For α = 0.05 (two-tailed)
  const zBeta = 0.84   // For power = 0.80

  // Variance
  const p1 = baselineRate
  const p2 = treatmentRate
  const variance = p1 * (1 - p1) + p2 * (1 - p2)

  // Sample size per variant
  const n = Math.pow(zAlpha + zBeta, 2) * variance / Math.pow(p2 - p1, 2)

  return Math.ceil(n)
}

/**
 * Interactive sample size calculator
 */
function demonstrateSampleSizeCalculation() {
  console.log('=== Sample Size Calculation ===\n')

  const scenarios = [
    { baseline: 0.05, mde: 0.10, name: '5% baseline, 10% MDE' },
    { baseline: 0.05, mde: 0.20, name: '5% baseline, 20% MDE' },
    { baseline: 0.05, mde: 0.50, name: '5% baseline, 50% MDE' },
    { baseline: 0.10, mde: 0.10, name: '10% baseline, 10% MDE' },
    { baseline: 0.10, mde: 0.20, name: '10% baseline, 20% MDE' },
  ]

  console.log('Scenario                        | Samples Needed | Total Users')
  console.log('-----------------------------------------------------------')

  for (const scenario of scenarios) {
    const n = calculateSampleSize(scenario.baseline, scenario.mde)
    const total = n * 2 // Both variants

    console.log(
      `${scenario.name.padEnd(30)} | ${n.toLocaleString().padStart(14)} | ${total.toLocaleString().padStart(11)}`
    )
  }

  console.log()
  console.log('Key Insights:')
  console.log('- Smaller effects require MUCH larger samples')
  console.log('- Doubling MDE reduces sample size by ~75%')
  console.log('- Higher baseline rates need fewer samples\n')
}

// ====================
// 2. T-TEST
// ====================

/**
 * Welch's t-test (unequal variances)
 * More robust than Student's t-test
 */
function tTest(
  sample1: number[],
  sample2: number[],
  alpha: number = 0.05
): {
  tStatistic: number
  pValue: number
  significant: boolean
  degreesOfFreedom: number
} {
  const n1 = sample1.length
  const n2 = sample2.length

  const mean1 = calculateMean(sample1)
  const mean2 = calculateMean(sample2)

  const var1 = calculateVariance(sample1, mean1)
  const var2 = calculateVariance(sample2, mean2)

  // Welch's t-statistic
  const tStatistic = (mean2 - mean1) / Math.sqrt(var1/n1 + var2/n2)

  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(var1/n1 + var2/n2, 2) / (
    Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1)
  )

  // Approximate p-value using normal distribution for large samples
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)))

  return {
    tStatistic,
    pValue,
    significant: pValue < alpha,
    degreesOfFreedom: df
  }
}

function calculateMean(arr: number[]): number {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length
}

function calculateVariance(arr: number[], mean?: number): number {
  const m = mean ?? calculateMean(arr)
  const squaredDiffs = arr.map(x => Math.pow(x - m, 2))
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / (arr.length - 1)
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return z > 0 ? 1 - probability : probability
}

/**
 * Demonstrate t-test
 */
function demonstrateTTest() {
  console.log('=== T-Test Example ===\n')

  // Generate sample data
  const control = generateNormalData(500, 5.0, 1.5)   // Mean 5.0, SD 1.5
  const treatment = generateNormalData(500, 5.5, 1.5) // Mean 5.5, SD 1.5

  const result = tTest(control, treatment)

  console.log('Sample Data:')
  console.log(`  Control:   n=${control.length}, mean=${calculateMean(control).toFixed(2)}, sd=${Math.sqrt(calculateVariance(control)).toFixed(2)}`)
  console.log(`  Treatment: n=${treatment.length}, mean=${calculateMean(treatment).toFixed(2)}, sd=${Math.sqrt(calculateVariance(treatment)).toFixed(2)}`)
  console.log()

  console.log('T-Test Results:')
  console.log(`  t-statistic: ${result.tStatistic.toFixed(3)}`)
  console.log(`  p-value: ${result.pValue.toFixed(4)}`)
  console.log(`  Degrees of freedom: ${result.degreesOfFreedom.toFixed(1)}`)
  console.log(`  Significant (α=0.05): ${result.significant ? 'YES ✓' : 'NO ✗'}`)
  console.log()
}

/**
 * Generate normal distributed data (Box-Muller transform)
 */
function generateNormalData(n: number, mean: number, stdDev: number): number[] {
  const data: number[] = []

  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random()
    const u2 = Math.random()

    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)

    data.push(mean + z1 * stdDev)
    if (i + 1 < n) {
      data.push(mean + z2 * stdDev)
    }
  }

  return data
}

// ====================
// 3. CONFIDENCE INTERVALS
// ====================

/**
 * Calculate confidence interval for mean
 */
function confidenceInterval(
  data: number[],
  confidence: number = 0.95
): { mean: number; lower: number; upper: number; marginOfError: number } {
  const mean = calculateMean(data)
  const variance = calculateVariance(data, mean)
  const stdDev = Math.sqrt(variance)
  const n = data.length

  // Z-score for confidence level
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.58 : 1.645

  // Standard error
  const se = stdDev / Math.sqrt(n)

  // Margin of error
  const marginOfError = z * se

  return {
    mean,
    lower: mean - marginOfError,
    upper: mean + marginOfError,
    marginOfError
  }
}

/**
 * Demonstrate confidence intervals
 */
function demonstrateConfidenceIntervals() {
  console.log('=== Confidence Intervals ===\n')

  const data = generateNormalData(1000, 10.0, 2.5)

  const ci95 = confidenceInterval(data, 0.95)
  const ci99 = confidenceInterval(data, 0.99)

  console.log('Sample Data:')
  console.log(`  True mean: 10.0`)
  console.log(`  Sample size: ${data.length}`)
  console.log(`  Sample mean: ${ci95.mean.toFixed(2)}`)
  console.log()

  console.log('95% Confidence Interval:')
  console.log(`  Range: [${ci95.lower.toFixed(2)}, ${ci95.upper.toFixed(2)}]`)
  console.log(`  Margin of error: ±${ci95.marginOfError.toFixed(2)}`)
  console.log(`  Interpretation: We're 95% confident the true mean is in this range`)
  console.log()

  console.log('99% Confidence Interval:')
  console.log(`  Range: [${ci99.lower.toFixed(2)}, ${ci99.upper.toFixed(2)}]`)
  console.log(`  Margin of error: ±${ci99.marginOfError.toFixed(2)}`)
  console.log(`  Note: Wider interval for higher confidence`)
  console.log()
}

// ====================
// 4. EFFECT SIZE (COHEN'S D)
// ====================

/**
 * Calculate Cohen's d (standardized effect size)
 */
function cohensD(sample1: number[], sample2: number[]): number {
  const mean1 = calculateMean(sample1)
  const mean2 = calculateMean(sample2)

  const var1 = calculateVariance(sample1, mean1)
  const var2 = calculateVariance(sample2, mean2)

  const n1 = sample1.length
  const n2 = sample2.length

  // Pooled standard deviation
  const pooledSD = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))

  // Cohen's d
  return (mean2 - mean1) / pooledSD
}

/**
 * Interpret Cohen's d
 */
function interpretCohensD(d: number): string {
  const absD = Math.abs(d)

  if (absD < 0.2) return 'Negligible effect'
  if (absD < 0.5) return 'Small effect'
  if (absD < 0.8) return 'Medium effect'
  return 'Large effect'
}

/**
 * Demonstrate effect size
 */
function demonstrateEffectSize() {
  console.log('=== Effect Size (Cohen\'s d) ===\n')

  const scenarios = [
    { diff: 0.1, name: 'Tiny difference' },
    { diff: 0.5, name: 'Small difference' },
    { diff: 1.0, name: 'Medium difference' },
    { diff: 2.0, name: 'Large difference' }
  ]

  for (const scenario of scenarios) {
    const control = generateNormalData(500, 5.0, 1.0)
    const treatment = generateNormalData(500, 5.0 + scenario.diff, 1.0)

    const d = cohensD(control, treatment)
    const interpretation = interpretCohensD(d)

    console.log(`${scenario.name}:`)
    console.log(`  Mean difference: ${scenario.diff.toFixed(1)}`)
    console.log(`  Cohen's d: ${d.toFixed(3)}`)
    console.log(`  Interpretation: ${interpretation}`)
    console.log()
  }

  console.log('Key Insight:')
  console.log('Cohen\'s d standardizes effect size, making it comparable across different scales')
  console.log()
}

// ====================
// 5. POWER ANALYSIS
// ====================

/**
 * Calculate statistical power
 * Power = P(reject H0 | H1 is true)
 */
function calculatePower(
  effectSize: number,
  sampleSize: number,
  alpha: number = 0.05
): number {
  const zAlpha = 1.96 // For α = 0.05 (two-tailed)

  // Non-centrality parameter
  const ncp = effectSize * Math.sqrt(sampleSize / 2)

  // Power = P(|Z| > zα - ncp) + P(|Z| > zα + ncp)
  const power = 1 - normalCDF(zAlpha - ncp) + normalCDF(-zAlpha - ncp)

  return Math.min(1, Math.max(0, power))
}

/**
 * Demonstrate power analysis
 */
function demonstratePowerAnalysis() {
  console.log('=== Power Analysis ===\n')

  console.log('How sample size affects power (effect size = 0.3):')
  console.log('Sample Size | Power')
  console.log('------------|-------')

  const sampleSizes = [50, 100, 200, 500, 1000, 2000, 5000]

  for (const n of sampleSizes) {
    const power = calculatePower(0.3, n)
    console.log(`${n.toString().padStart(11)} | ${(power * 100).toFixed(1)}%`)
  }

  console.log()
  console.log('How effect size affects power (n = 500):')
  console.log('Effect Size | Power')
  console.log('------------|-------')

  const effectSizes = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0]

  for (const d of effectSizes) {
    const power = calculatePower(d, 500)
    console.log(`${d.toFixed(1).padStart(11)} | ${(power * 100).toFixed(1)}%`)
  }

  console.log()
  console.log('Key Insights:')
  console.log('- Power increases with sample size')
  console.log('- Power increases with effect size')
  console.log('- Target 80% power for most experiments')
  console.log()
}

// ====================
// 6. COMPREHENSIVE EXAMPLE
// ====================

function comprehensiveExample() {
  console.log('=== Comprehensive Statistical Analysis ===\n')

  // Scenario: Testing a new feature
  console.log('Scenario: New checkout flow experiment')
  console.log('Metric: Time to complete checkout (seconds)\n')

  // Generate data
  const control = generateNormalData(800, 45.0, 12.0)   // Mean 45s, SD 12s
  const treatment = generateNormalData(800, 41.0, 11.0) // Mean 41s, SD 11s (improvement!)

  // 1. Descriptive statistics
  const controlMean = calculateMean(control)
  const treatmentMean = calculateMean(treatment)
  const controlSD = Math.sqrt(calculateVariance(control))
  const treatmentSD = Math.sqrt(calculateVariance(treatment))

  console.log('Descriptive Statistics:')
  console.log(`  Control:   mean=${controlMean.toFixed(1)}s, sd=${controlSD.toFixed(1)}s, n=${control.length}`)
  console.log(`  Treatment: mean=${treatmentMean.toFixed(1)}s, sd=${treatmentSD.toFixed(1)}s, n=${treatment.length}`)
  console.log(`  Difference: ${(controlMean - treatmentMean).toFixed(1)}s faster (${((1 - treatmentMean/controlMean) * 100).toFixed(1)}% improvement)`)
  console.log()

  // 2. Confidence intervals
  const controlCI = confidenceInterval(control)
  const treatmentCI = confidenceInterval(treatment)

  console.log('95% Confidence Intervals:')
  console.log(`  Control:   [${controlCI.lower.toFixed(1)}s, ${controlCI.upper.toFixed(1)}s]`)
  console.log(`  Treatment: [${treatmentCI.lower.toFixed(1)}s, ${treatmentCI.upper.toFixed(1)}s]`)
  console.log()

  // 3. T-test
  const test = tTest(control, treatment)

  console.log('Statistical Significance:')
  console.log(`  t-statistic: ${test.tStatistic.toFixed(3)}`)
  console.log(`  p-value: ${test.pValue.toFixed(4)}`)
  console.log(`  Result: ${test.significant ? 'SIGNIFICANT ✓' : 'NOT SIGNIFICANT ✗'}`)
  console.log()

  // 4. Effect size
  const effectSize = cohensD(control, treatment)

  console.log('Effect Size:')
  console.log(`  Cohen's d: ${effectSize.toFixed(3)}`)
  console.log(`  Interpretation: ${interpretCohensD(effectSize)}`)
  console.log()

  // 5. Decision
  console.log('=== DECISION ===')
  if (test.significant && Math.abs(effectSize) > 0.2) {
    console.log('✅ SHIP TREATMENT')
    console.log('Both statistically and practically significant improvement.')
    console.log(`Users save an average of ${(controlMean - treatmentMean).toFixed(1)} seconds per checkout.`)
  } else if (test.significant && Math.abs(effectSize) <= 0.2) {
    console.log('🤔 BORDERLINE')
    console.log('Statistically significant but small effect size.')
    console.log('Consider business value vs implementation cost.')
  } else {
    console.log('⏸️ CONTINUE EXPERIMENT')
    console.log('Not yet significant. Collect more data.')
  }
  console.log()
}

// ====================
// 7. MAIN EXECUTION
// ====================

function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  STATISTICAL ANALYSIS FOR EXPERIMENTS')
  console.log('='.repeat(60) + '\n')

  demonstrateSampleSizeCalculation()
  demonstrateTTest()
  demonstrateConfidenceIntervals()
  demonstrateEffectSize()
  demonstratePowerAnalysis()
  comprehensiveExample()

  console.log('='.repeat(60) + '\n')
}

// Run if executed directly
if (require.main === module) {
  main()
}

// Export for testing
export {
  calculateSampleSize,
  tTest,
  confidenceInterval,
  cohensD,
  calculatePower,
  interpretCohensD
}
