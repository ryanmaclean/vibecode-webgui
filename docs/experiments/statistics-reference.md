# Statistical Analysis Reference

## Overview

This comprehensive statistical engine provides advanced A/B testing and experimentation capabilities for the VibeCODE platform. It includes classical frequentist tests, Bayesian methods, sequential testing, and quality assurance tools.

## Table of Contents

1. [Core Statistical Tests](#core-statistical-tests)
2. [Sample Ratio Mismatch Detection](#sample-ratio-mismatch-detection)
3. [Bayesian Analysis](#bayesian-analysis)
4. [Sequential Testing](#sequential-testing)
5. [Best Practices](#best-practices)
6. [Common Pitfalls](#common-pitfalls)

---

## Core Statistical Tests

### Z-Test for Proportions

**When to use:** Comparing conversion rates between two groups with large sample sizes (n > 30).

```typescript
import { zTest } from '@/lib/experiments/statistics';

// Example: Testing if new checkout flow improves conversion
const control = Array(1000).fill(0).map((_, i) => i < 100 ? 1 : 0);  // 10% conversion
const treatment = Array(1000).fill(0).map((_, i) => i < 150 ? 1 : 0); // 15% conversion

const result = zTest(control, treatment, 0.05);

console.log(`P-value: ${result.pValue}`);
console.log(`Significant: ${result.significant}`);
console.log(`Z-score: ${result.zScore}`);
```

**Output:**
- `pValue`: Probability of observing this difference by chance
- `significant`: True if p-value < alpha (typically 0.05)
- `zScore`: Standardized test statistic

**Interpretation:**
- p < 0.05: Strong evidence of a real difference
- p < 0.01: Very strong evidence
- p > 0.05: Insufficient evidence to conclude difference exists

**Limitations:**
- Requires large sample sizes
- Assumes independence between observations
- Sensitive to multiple testing (use corrections)

---

### T-Test for Continuous Metrics

**When to use:** Comparing means of continuous metrics (revenue, time-on-site, page views) especially with smaller samples or unequal variances.

```typescript
import { tTest } from '@/lib/experiments/statistics';

// Example: Testing if premium feature increases average revenue
const controlRevenue = [23.50, 45.20, 12.30, 67.80, 34.10];
const treatmentRevenue = [52.10, 68.40, 45.60, 71.20, 58.30];

const result = tTest(controlRevenue, treatmentRevenue, 0.05);

console.log(`T-statistic: ${result.tStatistic}`);
console.log(`P-value: ${result.pValue}`);
console.log(`Degrees of freedom: ${result.degreesOfFreedom}`);
```

**When to use t-test vs z-test:**
- **T-test:** Small samples (n < 30), unknown population variance, continuous metrics
- **Z-test:** Large samples (n > 30), binary outcomes, known population variance

---

### Chi-Square Test

**When to use:** Testing if observed frequencies match expected frequencies (e.g., variant assignment ratios).

```typescript
import { chiSquareTest } from '@/lib/experiments/statistics';

// Example: Checking if variant assignment is balanced
const observed = [520, 480];  // Actual assignments
const expected = [500, 500];  // Expected 50/50 split

const result = chiSquareTest(observed, expected, 0.05);

console.log(`Chi-square: ${result.chiSquare}`);
console.log(`P-value: ${result.pValue}`);
console.log(`Degrees of freedom: ${result.degreesOfFreedom}`);
```

---

### Confidence Intervals

**Purpose:** Estimate range of plausible values for a metric with specified confidence level.

```typescript
import { confidenceInterval } from '@/lib/experiments/statistics';

const data = [23, 25, 22, 24, 26, 23, 25];
const ci = confidenceInterval(data, 0.95);

console.log(`Mean: ${ci.mean}`);
console.log(`95% CI: [${ci.lower}, ${ci.upper}]`);
console.log(`Margin of error: ${ci.marginOfError}`);
```

**Interpretation:**
- "We are 95% confident the true mean lies between X and Y"
- **NOT** "There's a 95% probability the mean is between X and Y" (that's Bayesian)

---

### Effect Size: Cohen's d

**Purpose:** Measure practical significance (how big is the effect?), independent of sample size.

```typescript
import { cohensD } from '@/lib/experiments/statistics';

const control = [20, 22, 19, 23, 21];
const treatment = [28, 30, 27, 31, 29];

const d = cohensD(control, treatment);

console.log(`Cohen's d: ${d}`);
```

**Interpretation:**
- **Small effect:** d = 0.2
- **Medium effect:** d = 0.5
- **Large effect:** d = 0.8

**Why it matters:**
- P-value tells you *if* there's an effect
- Effect size tells you *how large* the effect is
- With huge samples, tiny effects can be "significant" but not meaningful

---

### Relative Uplift

**Purpose:** Express improvement as a percentage of baseline.

```typescript
import { relativeUplift } from '@/lib/experiments/statistics';

const controlMean = 10;
const treatmentMean = 12;

const uplift = relativeUplift(controlMean, treatmentMean);

console.log(`Relative uplift: ${uplift}%`); // 20%
```

---

### Power Analysis

**Purpose:** Determine required sample size before starting experiment.

```typescript
import { calculateMinimumSampleSize } from '@/lib/experiments/statistics';

// Want to detect 10% relative improvement on 5% baseline with 80% power
const baselineRate = 0.05;
const minimumDetectableEffect = 0.10;  // 10% relative improvement
const power = 0.80;
const alpha = 0.05;

const requiredN = calculateMinimumSampleSize(
  baselineRate,
  minimumDetectableEffect,
  power,
  alpha
);

console.log(`Need ${requiredN} samples per variant`);
```

**Key concepts:**
- **Power (1 - β):** Probability of detecting a real effect (typically 80%)
- **Alpha (α):** Probability of false positive (typically 5%)
- **MDE:** Smallest effect you want to reliably detect
- Higher power or smaller MDE → need more samples

---

### Multiple Testing Correction

**Problem:** Testing multiple hypotheses inflates false positive rate.

#### Bonferroni Correction (Conservative)

```typescript
import { bonferroniCorrection } from '@/lib/experiments/statistics';

const pValues = [0.01, 0.03, 0.04, 0.06];
const significant = bonferroniCorrection(pValues, 0.05);

console.log(significant); // [true, false, false, false]
```

**When to use:** When false positives are very costly (medical, safety-critical).

#### Benjamini-Hochberg (Less Conservative)

```typescript
import { benjaminiHochberg } from '@/lib/experiments/statistics';

const pValues = [0.01, 0.03, 0.04, 0.06];
const significant = benjaminiHochberg(pValues, 0.05);

console.log(significant); // More permissive than Bonferroni
```

**When to use:** Exploratory analysis, many hypotheses, want to control false discovery rate.

---

## Sample Ratio Mismatch Detection

### What is SRM?

Sample Ratio Mismatch occurs when the observed ratio of users assigned to variants differs significantly from the expected ratio. This indicates a **data quality issue** that can invalidate experiment results.

**Common causes:**
- Bot traffic
- Randomization bugs
- Client-side caching issues
- Network failures during assignment
- Browser redirects

### Basic SRM Detection

```typescript
import { detectSampleRatioMismatch } from '@/lib/experiments/srm-detector';

const assignments = {
  control: 5200,
  treatment: 4800
};

const expectedWeights = {
  control: 50,
  treatment: 50
};

const result = detectSampleRatioMismatch(assignments, expectedWeights);

if (result.hasMismatch) {
  console.error('SRM DETECTED!');
  console.error(result.diagnosis);
  console.error('Recommendations:', result.recommendations);
}
```

### SRM Severity Levels

| Severity | P-value Range | Action |
|----------|---------------|---------|
| **None** | p > 0.001 | No action needed |
| **Low** | 0.0001 < p ≤ 0.001 | Monitor for 24 hours |
| **Medium** | 0.00001 < p ≤ 0.0001 | Investigate immediately |
| **High** | 0.000001 < p ≤ 0.00001 | Pause experiment, results questionable |
| **Critical** | p ≤ 0.000001 | STOP experiment, results invalid |

### Continuous SRM Monitoring

```typescript
import { detectSRMTimeSeries } from '@/lib/experiments/srm-detector';

const timeSeries = [
  { timestamp: '2025-01-01T00:00:00Z', assignments: { control: 500, treatment: 500 } },
  { timestamp: '2025-01-01T01:00:00Z', assignments: { control: 520, treatment: 480 } },
  { timestamp: '2025-01-01T02:00:00Z', assignments: { control: 550, treatment: 450 } }
];

const results = detectSRMTimeSeries(timeSeries, expectedWeights);

results.forEach(r => {
  if (r.hasMismatch) {
    console.warn(`SRM at ${r.timestamp}: ${r.severity}`);
  }
});
```

### SRM Sensitivity

```typescript
import { estimateSRMSensitivity } from '@/lib/experiments/srm-detector';

// With 10,000 total samples, what's the smallest imbalance we can detect?
const sensitivity = estimateSRMSensitivity(10000, 2, 0.001);

console.log(`Can detect ${(sensitivity * 100).toFixed(1)}% relative imbalance`);
```

---

## Bayesian Analysis

### Why Bayesian?

**Advantages over frequentist methods:**
- ✅ Can peek at results anytime without inflating error rates
- ✅ Provides probability statements: "95% probability treatment is better"
- ✅ Incorporates prior knowledge
- ✅ Calculates expected loss to inform decisions
- ✅ No need for multiple testing corrections

**Disadvantages:**
- ❌ Results depend on choice of prior
- ❌ More computationally intensive (Monte Carlo simulation)
- ❌ Less familiar to some stakeholders

### Basic Bayesian Test (Proportions)

```typescript
import { bayesianTest, shouldStopExperiment } from '@/lib/experiments/bayesian';

// Control: 450 conversions out of 5000 users (9%)
// Treatment: 520 conversions out of 5000 users (10.4%)
const result = bayesianTest(450, 5000, 520, 5000);

console.log(`Posterior mean: ${result.posteriorMean}`);
console.log(`95% Credible interval: [${result.credibleInterval.lower}, ${result.credibleInterval.upper}]`);
console.log(`P(Treatment > Control): ${(result.probabilityBetter * 100).toFixed(1)}%`);
console.log(`Expected loss: ${(result.expectedLoss * 100).toFixed(3)}%`);

// Should we ship?
const decision = shouldStopExperiment(result, 0.95, 0.01);

if (decision.shouldStop) {
  if (decision.decision === 'ship_treatment') {
    console.log('✅ Ship treatment!');
  } else if (decision.decision === 'keep_control') {
    console.log('❌ Keep control, treatment is worse');
  } else if (decision.decision === 'no_difference') {
    console.log('⚪ No meaningful difference');
  }
}
```

### Bayesian T-Test (Continuous Metrics)

```typescript
import { bayesianTTest } from '@/lib/experiments/bayesian';

const controlRevenue = [23.50, 45.20, 12.30, 67.80, 34.10];
const treatmentRevenue = [52.10, 68.40, 45.60, 71.20, 58.30];

const result = bayesianTTest(controlRevenue, treatmentRevenue);

console.log(`P(Treatment > Control): ${(result.probabilityBetter * 100).toFixed(1)}%`);
```

### Decision Criteria

**When to ship:**
1. P(Treatment > Control) ≥ 95% **AND**
2. Expected loss < 1% (or your risk tolerance)

**Example:**
- P(Better) = 98%, Loss = 0.3% → **Ship it!** High confidence, low risk
- P(Better) = 96%, Loss = 5% → **Wait!** High confidence but high risk if wrong
- P(Better) = 80%, Loss = 0.1% → **Wait!** Low risk but not confident enough

### Prior Selection

```typescript
// Uninformative prior (default): Beta(1, 1) = Uniform distribution
const uninformed = bayesianTest(100, 1000, 120, 1000, 1, 1);

// Informative prior: Beta(10, 90) = Expect ~10% conversion
const informed = bayesianTest(100, 1000, 120, 1000, 10, 90);
```

**When to use informative priors:**
- You have historical data
- Similar features have known performance
- Industry benchmarks exist

**When to use uninformative priors:**
- Novel feature with no precedent
- Want to "let the data speak"
- Skeptical audience (easier to explain)

---

## Sequential Testing

### Why Sequential Testing?

Traditional A/B tests require:
- Fixed sample size determined upfront
- No peeking (inflates Type I error)
- Run to completion even if effect is obvious

Sequential testing allows:
- ✅ Stop early when sufficient evidence accumulated
- ✅ Peek at results anytime
- ✅ Minimize expected sample size
- ✅ Reduce opportunity cost

### SPRT (Sequential Probability Ratio Test)

**Optimal** sequential test - minimizes expected sample size for given error rates.

```typescript
import { sprt } from '@/lib/experiments/sequential';

// Test if conversion rate improved from 10% to 11%
const conversions = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1]; // Binary outcomes

const result = sprt(
  conversions,
  0.10,  // H0: null hypothesis value
  0.11,  // H1: alternative hypothesis value
  0.05,  // alpha (Type I error)
  0.20   // beta (Type II error)
);

if (result.canStop) {
  if (result.decision === 'accept_h1') {
    console.log('✅ Treatment is better! Ship it.');
  } else {
    console.log('❌ No significant improvement detected.');
  }
} else {
  console.log(`⏳ Continue testing. Need ~${result.estimatedSamplesNeeded} more samples.`);
}
```

**When to use SPRT:**
- Can specify H0 and H1 values precisely
- Want to minimize expected sample size
- Binary outcomes (conversions, clicks)

### Confidence Sequences

**Always-valid confidence intervals** that can be checked at any time.

```typescript
import { confidenceSequence } from '@/lib/experiments/sequential';

// Daily average revenue: can check any day without inflating error
const dailyRevenue = [100, 105, 98, 103, 101, 107, 102];
const cs = confidenceSequence(dailyRevenue, 0.95);

// Check each day
for (let day = 0; day < cs.mean.length; day++) {
  console.log(`Day ${day + 1}:`);
  console.log(`  Mean: ${cs.mean[day]}`);
  console.log(`  95% CS: [${cs.lower[day]}, ${cs.upper[day]}]`);

  // Safe to stop if CI doesn't contain baseline
  if (cs.lower[day] > 100) {
    console.log(`  ✅ Significantly above baseline!`);
  }
}
```

### Always-Valid P-Values

```typescript
import { alwaysValidPValue } from '@/lib/experiments/sequential';

const observations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const pValue = alwaysValidPValue(observations, 0); // Test if mean > 0

if (pValue < 0.05) {
  console.log('Significant at any time point!');
}
```

---

## Best Practices

### 1. Sample Size Planning

**Always** calculate required sample size before starting:

```typescript
const requiredN = calculateMinimumSampleSize(
  baselineRate,
  minimumDetectableEffect,
  power,
  alpha
);
```

**Red flags:**
- "We'll just run it for a week and see"
- Starting experiment without power calculation
- Stopping as soon as p < 0.05 (without correction)

### 2. Check for SRM Daily

```typescript
import { recommendedCheckFrequency } from '@/lib/experiments/srm-detector';

const checkFrequency = recommendedCheckFrequency(dailyTraffic);
console.log(`Check SRM every ${checkFrequency} hours`);
```

### 3. Use Multiple Metrics

```typescript
// Primary metric (one)
const conversion = zTest(controlConversion, treatmentConversion);

// Guardrail metrics (many - use correction)
const revenue = tTest(controlRevenue, treatmentRevenue);
const loadTime = tTest(controlLoadTime, treatmentLoadTime);
const errorRate = zTest(controlErrors, treatmentErrors);

const pValues = [revenue.pValue, loadTime.pValue, errorRate.pValue];
const significant = benjaminiHochberg(pValues, 0.05);
```

### 4. Report Effect Sizes

```typescript
const d = cohensD(control, treatment);
const uplift = relativeUplift(controlMean, treatmentMean);

console.log(`Uplift: ${uplift.toFixed(1)}% (Cohen's d = ${d.toFixed(2)})`);
```

### 5. Choose the Right Method

| Scenario | Recommended Method |
|----------|-------------------|
| Fixed sample size, no peeking | Z-test or T-test |
| Want to peek periodically | Group Sequential Test |
| Want to peek anytime | Confidence Sequences or Bayesian |
| Minimize sample size | SPRT |
| Multiple metrics | Benjamini-Hochberg correction |
| Stakeholders want probability | Bayesian |
| Regulatory/medical | Frequentist with Bonferroni |

---

## Common Pitfalls

### ❌ Peeking Without Correction

**Wrong:**
```typescript
// Check every day and stop when p < 0.05
while (running) {
  const result = zTest(control, treatment);
  if (result.pValue < 0.05) {
    stop(); // INFLATED TYPE I ERROR!
  }
}
```

**Right:**
```typescript
// Use sequential methods or Bayesian
const result = sprt(observations, h0, h1, alpha, beta);
if (result.canStop) {
  stop(); // Valid!
}
```

### ❌ Ignoring SRM

**Wrong:**
```typescript
// Never check assignment ratios
const result = zTest(control, treatment);
if (result.significant) {
  ship(); // MIGHT BE INVALID!
}
```

**Right:**
```typescript
// Always check SRM first
const srm = detectSampleRatioMismatch(assignments, expectedWeights);
if (srm.hasMismatch) {
  console.error('SRM detected! Results invalid.');
  return;
}

const result = zTest(control, treatment);
```

### ❌ Multiple Testing Without Correction

**Wrong:**
```typescript
// Test 10 different features, ship any with p < 0.05
// FALSE POSITIVE RATE = 40% not 5%!
for (const feature of features) {
  const result = zTest(control[feature], treatment[feature]);
  if (result.pValue < 0.05) {
    ship(feature); // INFLATED FDR!
  }
}
```

**Right:**
```typescript
const pValues = features.map(f => zTest(control[f], treatment[f]).pValue);
const significant = benjaminiHochberg(pValues, 0.05);

features.forEach((feature, i) => {
  if (significant[i]) {
    ship(feature); // FDR controlled at 5%
  }
});
```

### ❌ Confusing Statistical and Practical Significance

**Wrong:**
```typescript
const result = zTest(hugeControl, hugeTreatment);
if (result.significant) {
  ship(); // P < 0.05 but effect might be tiny!
}
```

**Right:**
```typescript
const result = zTest(hugeControl, hugeTreatment);
const d = cohensD(hugeControl, hugeTreatment);
const uplift = relativeUplift(controlMean, treatmentMean);

if (result.significant && d > 0.2 && uplift > 5) {
  ship(); // Statistically AND practically significant
}
```

### ❌ Sample Imbalance

**Wrong:**
```typescript
// 1000 in control, 100 in treatment
const result = tTest(largeControl, smallTreatment); // LOW POWER!
```

**Right:**
```typescript
// Keep groups balanced unless strong reason not to
// Control: 1000, Treatment: 1000
```

---

## Mathematical References

### Statistical Tests

1. **Z-test:** Altman, D. G. (1991). *Practical statistics for medical research*
2. **Welch's t-test:** Welch, B. L. (1947). "The generalization of Student's problem"
3. **Chi-square:** Pearson, K. (1900). "On the criterion that a given system of deviations"

### Multiple Testing

1. **Bonferroni:** Dunn, O. J. (1961). "Multiple comparisons among means"
2. **Benjamini-Hochberg:** Benjamini, Y., & Hochberg, Y. (1995). "Controlling the false discovery rate"

### Bayesian Methods

1. **Beta-Binomial:** VWO SmartStats Technical Whitepaper
2. **Posterior Credible Intervals:** Kruschke, J. K. (2014). *Doing Bayesian Data Analysis*

### Sequential Testing

1. **SPRT:** Wald, A. (1945). "Sequential tests of statistical hypotheses"
2. **Confidence Sequences:** Howard, S. R. et al. (2021). "Time-uniform, nonparametric confidence sequences"
3. **Group Sequential:** O'Brien, P. C., & Fleming, T. R. (1979). "A multiple testing procedure"

### SRM Detection

1. **Sample Ratio Mismatch:** Fabijan et al. (2019). "Diagnosing Sample Ratio Mismatch in Online Controlled Experiments"
   https://www.microsoft.com/en-us/research/publication/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments/

---

## Quick Reference

| Need to... | Use... |
|-----------|---------|
| Compare conversion rates (large samples) | `zTest()` |
| Compare means (any size) | `tTest()` |
| Check assignment ratio | `detectSampleRatioMismatch()` |
| Get probability treatment is better | `bayesianTest()` |
| Peek safely at results | `confidenceSequence()` or `sprt()` |
| Test multiple metrics | `benjaminiHochberg()` |
| Calculate sample size | `calculateMinimumSampleSize()` |
| Measure effect size | `cohensD()` |
| Express improvement | `relativeUplift()` |
| Continuous monitoring | `alwaysValidPValue()` |
| Minimize test duration | `sprt()` |
| Make risk-aware decisions | `shouldStopExperiment()` |

---

## Support

For questions or issues:
- Check test files for examples: `/tests/lib/experiments/`
- Review source code: `/src/lib/experiments/`
- File issues on GitHub

---

**Last Updated:** 2025-01-24
**Version:** 1.0.0
