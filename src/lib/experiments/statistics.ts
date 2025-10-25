/**
 * Enhanced Statistical Analysis for Experimentation
 *
 * This module provides comprehensive statistical methods for A/B testing and experimentation,
 * including classical frequentist tests, effect size calculations, power analysis, and
 * multiple testing corrections.
 *
 * References:
 * - Altman, D. G. (1991). Practical statistics for medical research.
 * - Cohen, J. (1988). Statistical power analysis for the behavioral sciences.
 * - Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate.
 */

/**
 * Result of a Z-test for proportions or means
 */
export interface ZTestResult {
  zScore: number;
  pValue: number;
  significant: boolean;
  alpha?: number;
}

/**
 * Result of a t-test for means with small samples
 */
export interface TTestResult {
  tStatistic: number;
  pValue: number;
  degreesOfFreedom: number;
  significant: boolean;
  alpha?: number;
}

/**
 * Result of a chi-square goodness-of-fit test
 */
export interface ChiSquareResult {
  chiSquare: number;
  pValue: number;
  degreesOfFreedom: number;
  significant?: boolean;
}

/**
 * Confidence interval result
 */
export interface ConfidenceIntervalResult {
  mean: number;
  lower: number;
  upper: number;
  marginOfError: number;
}

// ==================== CORE STATISTICAL TESTS ====================

/**
 * Z-test for comparing two proportions or means with large samples (n > 30)
 *
 * Uses the standard normal approximation. For proportions, this is a two-proportion z-test.
 * For continuous data with known population variance, this is a z-test for means.
 *
 * Formula: z = (p1 - p2) / SE where SE = sqrt(p_pooled * (1 - p_pooled) * (1/n1 + 1/n2))
 *
 * @param control - Array of numeric values for control group (0/1 for proportions, continuous for means)
 * @param treatment - Array of numeric values for treatment group
 * @param alpha - Significance level (default: 0.05)
 * @returns ZTestResult with z-score, p-value, and significance
 *
 * @example
 * // Test conversion rates
 * const control = [1, 0, 1, 1, 0, ...];  // Binary outcomes
 * const treatment = [1, 1, 1, 1, 0, ...];
 * const result = zTest(control, treatment);
 * console.log(`P-value: ${result.pValue}, Significant: ${result.significant}`);
 */
export function zTest(
  control: number[],
  treatment: number[],
  alpha: number = 0.05
): ZTestResult {
  if (control.length === 0 || treatment.length === 0) {
    return {
      zScore: 0,
      pValue: 1,
      significant: false,
      alpha
    };
  }

  const n1 = control.length;
  const n2 = treatment.length;
  const mean1 = calculateMean(control);
  const mean2 = calculateMean(treatment);

  // Check if data is binary (proportions test) or continuous (means test)
  const isBinary = control.every(x => x === 0 || x === 1) &&
                   treatment.every(x => x === 0 || x === 1);

  let standardError: number;

  if (isBinary) {
    // Two-proportion z-test using pooled proportion
    const pooledProportion = (mean1 * n1 + mean2 * n2) / (n1 + n2);
    standardError = Math.sqrt(
      pooledProportion * (1 - pooledProportion) * (1/n1 + 1/n2)
    );
  } else {
    // Z-test for means (assuming known or large sample variance)
    const var1 = calculateVariance(control);
    const var2 = calculateVariance(treatment);
    standardError = Math.sqrt(var1/n1 + var2/n2);
  }

  // Avoid division by zero
  if (standardError === 0) {
    return {
      zScore: 0,
      pValue: 1,
      significant: false,
      alpha
    };
  }

  const zScore = (mean2 - mean1) / standardError;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore))); // Two-tailed test

  return {
    zScore,
    pValue,
    significant: pValue < alpha,
    alpha
  };
}

/**
 * Welch's t-test for comparing two means with unequal variances
 *
 * More robust than Student's t-test when variances are unequal or sample sizes differ.
 * Uses Welch-Satterthwaite equation for degrees of freedom.
 *
 * Formula: t = (mean1 - mean2) / sqrt(s1²/n1 + s2²/n2)
 * df = (s1²/n1 + s2²/n2)² / ((s1²/n1)²/(n1-1) + (s2²/n2)²/(n2-1))
 *
 * @param control - Array of continuous values for control group
 * @param treatment - Array of continuous values for treatment group
 * @param alpha - Significance level (default: 0.05)
 * @returns TTestResult with t-statistic, p-value, df, and significance
 *
 * @example
 * const control = [23.1, 25.3, 22.8, 24.5, ...];
 * const treatment = [26.2, 28.1, 27.3, 25.9, ...];
 * const result = tTest(control, treatment);
 */
export function tTest(
  control: number[],
  treatment: number[],
  alpha: number = 0.05
): TTestResult {
  if (control.length < 2 || treatment.length < 2) {
    return {
      tStatistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      significant: false,
      alpha
    };
  }

  const n1 = control.length;
  const n2 = treatment.length;
  const mean1 = calculateMean(control);
  const mean2 = calculateMean(treatment);
  const var1 = calculateVariance(control);
  const var2 = calculateVariance(treatment);

  // Welch's t-test (doesn't assume equal variances)
  const standardError = Math.sqrt(var1/n1 + var2/n2);

  if (standardError === 0) {
    return {
      tStatistic: 0,
      pValue: 1,
      degreesOfFreedom: Math.max(n1 + n2 - 2, 1),
      significant: false,
      alpha
    };
  }

  const tStatistic = (mean2 - mean1) / standardError;

  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(var1/n1 + var2/n2, 2) /
             (Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1));

  const pValue = 2 * (1 - studentTCDF(Math.abs(tStatistic), df)); // Two-tailed

  return {
    tStatistic,
    pValue,
    degreesOfFreedom: df,
    significant: pValue < alpha,
    alpha
  };
}

/**
 * Chi-square goodness-of-fit test
 *
 * Tests whether observed frequencies differ significantly from expected frequencies.
 * Useful for categorical data and contingency table analysis.
 *
 * Formula: χ² = Σ((O - E)² / E) where O = observed, E = expected
 *
 * @param observed - Array of observed frequencies
 * @param expected - Array of expected frequencies (must sum to same as observed)
 * @param alpha - Significance level (default: 0.05)
 * @returns ChiSquareResult with chi-square statistic, p-value, and df
 *
 * @example
 * // Test if variant assignments match expected 50/50 split
 * const observed = [520, 480];  // Actual assignments
 * const expected = [500, 500];  // Expected 50/50
 * const result = chiSquareTest(observed, expected);
 */
export function chiSquareTest(
  observed: number[],
  expected: number[],
  alpha: number = 0.05
): ChiSquareResult {
  if (observed.length !== expected.length || observed.length === 0) {
    throw new Error('Observed and expected arrays must have same non-zero length');
  }

  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] === 0) {
      throw new Error('Expected frequencies cannot be zero');
    }
    chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
  }

  const degreesOfFreedom = observed.length - 1;
  const pValue = 1 - chiSquareCDF(chiSquare, degreesOfFreedom);

  return {
    chiSquare,
    pValue,
    degreesOfFreedom,
    significant: pValue < alpha
  };
}

// ==================== CONFIDENCE INTERVALS ====================

/**
 * Calculate confidence interval for a dataset
 *
 * Uses t-distribution for sample standard deviation (more conservative than z).
 * For large samples (n > 30), t-distribution approximates normal distribution.
 *
 * Formula: CI = mean ± t(α/2, df) * (s / sqrt(n))
 *
 * @param data - Array of numeric values
 * @param confidence - Confidence level (default: 0.95 for 95% CI)
 * @returns ConfidenceIntervalResult with mean, bounds, and margin of error
 *
 * @example
 * const data = [23, 25, 22, 24, 26, 23, 25];
 * const ci = confidenceInterval(data, 0.95);
 * console.log(`95% CI: [${ci.lower}, ${ci.upper}]`);
 */
export function confidenceInterval(
  data: number[],
  confidence: number = 0.95
): ConfidenceIntervalResult {
  if (data.length === 0) {
    return {
      mean: 0,
      lower: 0,
      upper: 0,
      marginOfError: 0
    };
  }

  if (data.length === 1) {
    const value = data[0];
    return {
      mean: value,
      lower: value,
      upper: value,
      marginOfError: 0
    };
  }

  const mean = calculateMean(data);
  const stdDev = calculateStdDev(data);
  const n = data.length;
  const df = n - 1;

  // Use t-distribution critical value
  const alpha = 1 - confidence;
  const tCritical = studentTInverse(1 - alpha/2, df);

  const standardError = stdDev / Math.sqrt(n);
  const marginOfError = tCritical * standardError;

  return {
    mean,
    lower: mean - marginOfError,
    upper: mean + marginOfError,
    marginOfError
  };
}

// ==================== EFFECT SIZE ====================

/**
 * Calculate Cohen's d effect size
 *
 * Measures standardized difference between two means. Effect size interpretation:
 * - Small: d = 0.2
 * - Medium: d = 0.5
 * - Large: d = 0.8
 *
 * Formula: d = (mean2 - mean1) / s_pooled
 * where s_pooled = sqrt(((n1-1)*s1² + (n2-1)*s2²) / (n1 + n2 - 2))
 *
 * @param control - Control group values
 * @param treatment - Treatment group values
 * @returns Cohen's d (positive means treatment > control)
 *
 * @example
 * const d = cohensD(control, treatment);
 * if (d > 0.8) console.log('Large effect size');
 */
export function cohensD(control: number[], treatment: number[]): number {
  if (control.length === 0 || treatment.length === 0) {
    return 0;
  }

  const mean1 = calculateMean(control);
  const mean2 = calculateMean(treatment);
  const var1 = calculateVariance(control);
  const var2 = calculateVariance(treatment);
  const n1 = control.length;
  const n2 = treatment.length;

  // Pooled standard deviation
  const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledStdDev = Math.sqrt(pooledVariance);

  if (pooledStdDev === 0) {
    return 0;
  }

  return (mean2 - mean1) / pooledStdDev;
}

/**
 * Calculate relative uplift (percentage change)
 *
 * Formula: uplift = ((treatment - control) / control) * 100
 *
 * @param controlMean - Control group mean
 * @param treatmentMean - Treatment group mean
 * @returns Percentage uplift (e.g., 15.5 means 15.5% increase)
 */
export function relativeUplift(controlMean: number, treatmentMean: number): number {
  if (controlMean === 0) {
    return treatmentMean === 0 ? 0 : Infinity;
  }
  return ((treatmentMean - controlMean) / controlMean) * 100;
}

// ==================== POWER ANALYSIS ====================

/**
 * Calculate minimum sample size needed for an experiment
 *
 * Uses normal approximation for proportion tests. Ensures adequate power to detect
 * the minimum detectable effect (MDE).
 *
 * Formula based on: n = ((z_α/2 + z_β)² * 2p(1-p)) / δ²
 * where δ = minimum detectable effect, p = baseline rate
 *
 * @param baselineRate - Current conversion rate (e.g., 0.10 for 10%)
 * @param minimumDetectableEffect - Smallest relative change to detect (e.g., 0.05 for 5% relative change)
 * @param power - Statistical power (1 - β), typically 0.8 (80%)
 * @param alpha - Significance level, typically 0.05 (5%)
 * @returns Minimum sample size per variant
 *
 * @example
 * // Need to detect 10% relative improvement on 5% baseline with 80% power
 * const n = calculateMinimumSampleSize(0.05, 0.10, 0.8, 0.05);
 * console.log(`Need ${n} samples per variant`);
 */
export function calculateMinimumSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  power: number = 0.8,
  alpha: number = 0.05
): number {
  // Critical values from standard normal distribution
  const zAlpha = normalInverse(1 - alpha/2);  // Two-tailed
  const zBeta = normalInverse(power);

  // Absolute effect size
  const p1 = baselineRate;
  const p2 = p1 * (1 + minimumDetectableEffect);
  const delta = Math.abs(p2 - p1);

  if (delta === 0) {
    return Infinity;
  }

  // Sample size formula for proportions
  const numerator = Math.pow(zAlpha + zBeta, 2) *
                    (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(delta, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Estimate statistical power given sample size and observed effect
 *
 * Power = P(reject H0 | H1 is true) = 1 - β
 *
 * @param sampleSize - Actual sample size per variant
 * @param baselineRate - Baseline conversion rate
 * @param observedEffect - Observed relative effect size
 * @param alpha - Significance level
 * @returns Estimated power (0 to 1)
 */
export function estimatePower(
  sampleSize: number,
  baselineRate: number,
  observedEffect: number,
  alpha: number = 0.05
): number {
  const p1 = baselineRate;
  const p2 = p1 * (1 + observedEffect);
  const delta = Math.abs(p2 - p1);

  if (delta === 0 || sampleSize === 0) {
    return 0;
  }

  const zAlpha = normalInverse(1 - alpha/2);
  const standardError = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / sampleSize);

  const zBeta = (delta - zAlpha * standardError) / standardError;
  const power = normalCDF(zBeta);

  return Math.max(0, Math.min(1, power));
}

// ==================== MULTIPLE TESTING CORRECTION ====================

/**
 * Bonferroni correction for multiple comparisons
 *
 * Controls family-wise error rate (FWER) by adjusting significance threshold.
 * Very conservative - use when minimizing Type I errors is critical.
 *
 * Adjusted alpha = α / m where m = number of tests
 *
 * @param pValues - Array of p-values from multiple tests
 * @param alpha - Overall significance level (default: 0.05)
 * @returns Array of booleans indicating significance after correction
 *
 * @example
 * const pValues = [0.01, 0.03, 0.04, 0.06];
 * const significant = bonferroniCorrection(pValues, 0.05);
 * // Only tests with p < 0.05/4 = 0.0125 are significant
 */
export function bonferroniCorrection(
  pValues: number[],
  alpha: number = 0.05
): boolean[] {
  const adjustedAlpha = alpha / pValues.length;
  return pValues.map(p => p < adjustedAlpha);
}

/**
 * Benjamini-Hochberg procedure for controlling False Discovery Rate (FDR)
 *
 * Less conservative than Bonferroni, controls expected proportion of false positives.
 * Recommended for exploratory analysis with many hypotheses.
 *
 * Algorithm:
 * 1. Sort p-values in ascending order
 * 2. Find largest i such that P(i) ≤ (i/m) * α
 * 3. Reject H0 for all i' ≤ i
 *
 * Reference: Benjamini & Hochberg (1995), Journal of Royal Statistical Society B
 *
 * @param pValues - Array of p-values from multiple tests
 * @param alpha - FDR threshold (default: 0.05)
 * @returns Array of booleans indicating significance after correction
 *
 * @example
 * const pValues = [0.001, 0.01, 0.03, 0.04, 0.06];
 * const significant = benjaminiHochberg(pValues, 0.05);
 */
export function benjaminiHochberg(
  pValues: number[],
  alpha: number = 0.05
): boolean[] {
  const m = pValues.length;

  // Create array of [pValue, originalIndex] pairs
  const indexed = pValues.map((p, i) => ({ p, i }));

  // Sort by p-value ascending
  indexed.sort((a, b) => a.p - b.p);

  // Find critical value: largest k where P(k) <= (k/m) * alpha
  let criticalIndex = -1;
  for (let k = 0; k < m; k++) {
    if (indexed[k].p <= ((k + 1) / m) * alpha) {
      criticalIndex = k;
    }
  }

  // Mark as significant if in rejection region
  const results = new Array(m).fill(false);
  if (criticalIndex >= 0) {
    for (let k = 0; k <= criticalIndex; k++) {
      results[indexed[k].i] = true;
    }
  }

  return results;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate mean (average) of an array
 */
function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, x) => sum + x, 0) / data.length;
}

/**
 * Calculate variance (sample variance with Bessel's correction)
 */
function calculateVariance(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = calculateMean(data);
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  return squaredDiffs.reduce((sum, x) => sum + x, 0) / (data.length - 1);
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(data: number[]): number {
  return Math.sqrt(calculateVariance(data));
}

// ==================== PROBABILITY DISTRIBUTIONS ====================

/**
 * Standard normal cumulative distribution function (CDF)
 *
 * Uses Abramowitz and Stegun approximation (maximum error: 7.5e-8)
 *
 * @param z - Z-score
 * @returns P(Z ≤ z) for standard normal distribution
 */
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Inverse of standard normal CDF (quantile function)
 *
 * Uses Beasley-Springer-Moro algorithm
 *
 * @param p - Probability (0 < p < 1)
 * @returns z such that P(Z ≤ z) = p
 */
function normalInverse(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }

  // Beasley-Springer-Moro algorithm
  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00
  ];

  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01
  ];

  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00
  ];

  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else if (p <= pHigh) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  } else {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
            ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
}

/**
 * Error function (erf) using Abramowitz and Stegun approximation
 *
 * @param x - Input value
 * @returns erf(x)
 */
function erf(x: number): number {
  // Constants for approximation
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Student's t-distribution CDF
 *
 * Uses Hill's algorithm (Algorithm 395)
 *
 * @param t - t-statistic
 * @param df - Degrees of freedom
 * @returns P(T ≤ t) for t-distribution with df degrees of freedom
 */
function studentTCDF(t: number, df: number): number {
  if (df < 1) {
    throw new Error('Degrees of freedom must be at least 1');
  }

  // For large df, approximate with normal distribution
  if (df > 1000) {
    return normalCDF(t);
  }

  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;

  // Incomplete beta function I_x(a, b)
  const betaInc = incompleteBeta(x, a, b);

  if (t > 0) {
    return 1 - betaInc / 2;
  } else {
    return betaInc / 2;
  }
}

/**
 * Inverse of Student's t-distribution CDF
 *
 * @param p - Probability
 * @param df - Degrees of freedom
 * @returns t such that P(T ≤ t) = p
 */
function studentTInverse(p: number, df: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }

  // For large df, use normal approximation
  if (df > 1000) {
    return normalInverse(p);
  }

  // Approximate t-values for common confidence levels
  // This is a simplified approximation - more accurate methods exist
  const z = normalInverse(p);

  // Correction terms for finite df
  const g1 = (z * z * z + z) / 4;
  const g2 = (5 * Math.pow(z, 5) + 16 * Math.pow(z, 3) + 3 * z) / 96;
  const g3 = (3 * Math.pow(z, 7) + 19 * Math.pow(z, 5) + 17 * Math.pow(z, 3) - 15 * z) / 384;

  const correction = g1 / df + g2 / (df * df) + g3 / (df * df * df);

  return z + correction;
}

/**
 * Chi-square distribution CDF
 *
 * @param x - Chi-square statistic
 * @param df - Degrees of freedom
 * @returns P(X ≤ x) for chi-square distribution
 */
function chiSquareCDF(x: number, df: number): number {
  if (x < 0) return 0;
  if (df < 1) {
    throw new Error('Degrees of freedom must be at least 1');
  }

  // Chi-square is gamma distribution with shape = df/2, scale = 2
  return lowerIncompleteGamma(df / 2, x / 2);
}

/**
 * Incomplete beta function I_x(a, b)
 *
 * Uses continued fraction expansion
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;

  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) {
    // Use continued fraction directly
    return bt * betaContinuedFraction(x, a, b) / a;
  } else {
    // Use symmetry relation
    return 1 - bt * betaContinuedFraction(1 - x, b, a) / b;
  }
}

/**
 * Continued fraction for incomplete beta function
 */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 1e-15;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;

  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

/**
 * Lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a)
 */
function lowerIncompleteGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) {
    throw new Error('Invalid parameters for incomplete gamma');
  }

  if (x === 0) return 0;

  const maxIterations = 200;
  const epsilon = 1e-15;

  // Use series expansion for x < a + 1
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;

    for (let n = 1; n <= maxIterations; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * epsilon) {
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
      }
    }
  } else {
    // Use continued fraction for x >= a + 1
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let i = 1; i <= maxIterations; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < epsilon) {
        return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
      }
    }
  }

  return 1;
}

/**
 * Natural logarithm of gamma function
 *
 * Uses Lanczos approximation
 */
function logGamma(x: number): number {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += coefficients[j] / y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
