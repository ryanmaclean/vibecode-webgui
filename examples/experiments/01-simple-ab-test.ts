#!/usr/bin/env ts-node

/**
 * Simple A/B Test Example
 *
 * This is a minimal working example of an A/B test that you can run locally.
 * It demonstrates:
 * - Variant assignment
 * - Metric tracking
 * - Statistical analysis
 * - Decision making
 *
 * Run with: npx ts-node examples/experiments/01-simple-ab-test.ts
 */

// ====================
// 1. CONFIGURATION
// ====================

interface User {
  id: string
  variant: 'control' | 'treatment'
  clicked: boolean
}

const EXPERIMENT_CONFIG = {
  name: 'Button Color Test',
  hypothesis: 'Green button increases clicks by 15% vs blue',
  variants: {
    control: { name: 'Blue Button', color: '#0066CC' },
    treatment: { name: 'Green Button', color: '#28A745' }
  },
  targetSampleSize: 1000 // users per variant
}

// ====================
// 2. VARIANT ASSIGNMENT
// ====================

/**
 * Assign user to variant using deterministic hash
 * Same user always gets same variant (sticky assignment)
 */
function assignVariant(userId: string): 'control' | 'treatment' {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }

  // 50/50 split
  return Math.abs(hash) % 2 === 0 ? 'control' : 'treatment'
}

// ====================
// 3. SIMULATE EXPERIMENT
// ====================

/**
 * Simulate user behavior
 * Green button has slightly higher click rate
 */
function simulateUser(userId: string): User {
  const variant = assignVariant(userId)

  // Base click rates (ground truth for simulation)
  const clickRates = {
    control: 0.050,    // 5.0% click rate
    treatment: 0.058   // 5.8% click rate (+16% relative lift)
  }

  // Simulate click based on variant
  const clicked = Math.random() < clickRates[variant]

  return { id: userId, variant, clicked }
}

/**
 * Run experiment simulation
 */
function runExperiment(totalUsers: number): User[] {
  console.log('=== Running Experiment ===\n')
  console.log(`Simulating ${totalUsers} users...`)

  const users: User[] = []

  for (let i = 0; i < totalUsers; i++) {
    const userId = `user_${i}`
    const user = simulateUser(userId)
    users.push(user)
  }

  console.log(`✓ Generated ${users.length} users\n`)

  return users
}

// ====================
// 4. STATISTICAL ANALYSIS
// ====================

interface VariantStats {
  name: string
  users: number
  clicks: number
  clickRate: number
}

interface TestResult {
  control: VariantStats
  treatment: VariantStats
  absoluteDifference: number
  relativeLift: number
  pValue: number
  significant: boolean
  confidenceInterval: { lower: number; upper: number }
}

/**
 * Calculate click rate for variant
 */
function calculateStats(users: User[], variant: 'control' | 'treatment'): VariantStats {
  const variantUsers = users.filter(u => u.variant === variant)
  const clicks = variantUsers.filter(u => u.clicked).length

  return {
    name: EXPERIMENT_CONFIG.variants[variant].name,
    users: variantUsers.length,
    clicks,
    clickRate: clicks / variantUsers.length
  }
}

/**
 * Two-sample Z-test for proportions
 */
function twoProportionZTest(
  p1: number, n1: number,
  p2: number, n2: number,
  alpha: number = 0.05
): { pValue: number; significant: boolean } {
  // Pooled proportion
  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2)

  // Standard error
  const se = Math.sqrt(pooled * (1 - pooled) * (1/n1 + 1/n2))

  // Z-score
  const z = (p2 - p1) / se

  // Two-tailed p-value (approximation)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))

  return {
    pValue,
    significant: pValue < alpha
  }
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return z > 0 ? 1 - probability : probability
}

/**
 * Calculate confidence interval for proportion
 */
function confidenceInterval(p: number, n: number, confidence: number = 0.95): { lower: number; upper: number } {
  const z = confidence === 0.95 ? 1.96 : 2.58 // Z-score for 95% or 99%
  const se = Math.sqrt((p * (1 - p)) / n)

  return {
    lower: Math.max(0, p - z * se),
    upper: Math.min(1, p + z * se)
  }
}

/**
 * Perform full analysis
 */
function analyzeResults(users: User[]): TestResult {
  const control = calculateStats(users, 'control')
  const treatment = calculateStats(users, 'treatment')

  const absoluteDifference = treatment.clickRate - control.clickRate
  const relativeLift = (absoluteDifference / control.clickRate) * 100

  const { pValue, significant } = twoProportionZTest(
    control.clickRate, control.users,
    treatment.clickRate, treatment.users
  )

  const ci = confidenceInterval(treatment.clickRate, treatment.users)

  return {
    control,
    treatment,
    absoluteDifference,
    relativeLift,
    pValue,
    significant,
    confidenceInterval: ci
  }
}

// ====================
// 5. DISPLAY RESULTS
// ====================

function displayResults(result: TestResult): void {
  console.log('=== Experiment Results ===\n')

  // Sample sizes
  console.log('Sample Sizes:')
  console.log(`  ${result.control.name}: ${result.control.users} users`)
  console.log(`  ${result.treatment.name}: ${result.treatment.users} users\n`)

  // Click rates
  console.log('Click Rates:')
  console.log(`  ${result.control.name}: ${(result.control.clickRate * 100).toFixed(2)}% (${result.control.clicks} clicks)`)
  console.log(`  ${result.treatment.name}: ${(result.treatment.clickRate * 100).toFixed(2)}% (${result.treatment.clicks} clicks)\n`)

  // Differences
  console.log('Effect Size:')
  console.log(`  Absolute: ${(result.absoluteDifference * 100).toFixed(2)} percentage points`)
  console.log(`  Relative: ${result.relativeLift >= 0 ? '+' : ''}${result.relativeLift.toFixed(1)}%\n`)

  // Statistical significance
  console.log('Statistical Test:')
  console.log(`  P-value: ${result.pValue.toFixed(4)}`)
  console.log(`  Significant (α=0.05): ${result.significant ? 'YES ✓' : 'NO ✗'}\n`)

  // Confidence interval
  console.log('95% Confidence Interval:')
  console.log(`  Treatment click rate: ${(result.confidenceInterval.lower * 100).toFixed(2)}% - ${(result.confidenceInterval.upper * 100).toFixed(2)}%\n`)

  // Decision
  console.log('=== RECOMMENDATION ===\n')
  const recommendation = makeDecision(result)
  console.log(recommendation)
}

function makeDecision(result: TestResult): string {
  if (!result.significant) {
    if (result.relativeLift > 5) {
      return '⏸️ CONTINUE EXPERIMENT\n' +
        'Trending positive but not yet statistically significant.\n' +
        'Collect more data before making a decision.'
    }
    return '❌ KEEP CONTROL\n' +
      'No statistically significant difference detected.\n' +
      `Current lift: ${result.relativeLift.toFixed(1)}% (p=${result.pValue.toFixed(4)})`
  }

  if (result.relativeLift > 10) {
    return '✅ SHIP TREATMENT\n' +
      `Statistically significant ${result.relativeLift.toFixed(1)}% improvement!\n` +
      `This represents a meaningful increase in click-through rate.`
  }

  if (result.relativeLift > 0 && result.relativeLift < 5) {
    return '🤔 BORDERLINE\n' +
      'Statistically significant but small effect size.\n' +
      `Is a ${result.relativeLift.toFixed(1)}% improvement worth the implementation cost?`
  }

  if (result.relativeLift < 0) {
    return '❌ KEEP CONTROL\n' +
      'Treatment performs WORSE than control.\n' +
      'Do not ship.'
  }

  return '🤔 REVIEW MANUALLY\n' +
    'Results are ambiguous. Discuss with team.'
}

// ====================
// 6. VALIDATE EXPERIMENT
// ====================

/**
 * Check for Sample Ratio Mismatch (SRM)
 */
function checkSRM(users: User[]): void {
  const controlCount = users.filter(u => u.variant === 'control').length
  const treatmentCount = users.filter(u => u.variant === 'treatment').length
  const total = users.length

  const controlRatio = controlCount / total
  const treatmentRatio = treatmentCount / total

  console.log('=== Sample Ratio Mismatch Check ===\n')
  console.log(`Control: ${controlCount} (${(controlRatio * 100).toFixed(1)}%)`)
  console.log(`Treatment: ${treatmentCount} (${(treatmentRatio * 100).toFixed(1)}%)`)

  // Chi-square test for 50/50 split
  const expected = total / 2
  const chiSquare = (
    Math.pow(controlCount - expected, 2) / expected +
    Math.pow(treatmentCount - expected, 2) / expected
  )

  // Critical value for χ²(1, α=0.001) ≈ 10.83
  const hasSRM = chiSquare > 10.83

  console.log(`Chi-square: ${chiSquare.toFixed(2)}`)
  console.log(`SRM Detected: ${hasSRM ? 'YES ⚠️' : 'NO ✓'}\n`)

  if (hasSRM) {
    console.log('WARNING: Sample ratio mismatch detected!')
    console.log('This indicates broken randomization. Results may be invalid.\n')
  }
}

// ====================
// 7. MAIN EXECUTION
// ====================

function main() {
  console.log('\n' + '='.repeat(50))
  console.log('  SIMPLE A/B TEST EXAMPLE')
  console.log('='.repeat(50) + '\n')

  console.log(`Experiment: ${EXPERIMENT_CONFIG.name}`)
  console.log(`Hypothesis: ${EXPERIMENT_CONFIG.hypothesis}\n`)

  // Run experiment
  const users = runExperiment(EXPERIMENT_CONFIG.targetSampleSize * 2)

  // Check for SRM
  checkSRM(users)

  // Analyze results
  const result = analyzeResults(users)

  // Display results
  displayResults(result)

  console.log('\n' + '='.repeat(50) + '\n')
}

// Run if executed directly
if (require.main === module) {
  main()
}

// Export for testing
export {
  assignVariant,
  simulateUser,
  calculateStats,
  twoProportionZTest,
  analyzeResults,
  makeDecision
}
