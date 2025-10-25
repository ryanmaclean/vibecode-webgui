/**
 * Sample Ratio Mismatch (SRM) Detector
 *
 * Detects when the observed assignment ratio between variants differs significantly
 * from the expected ratio. SRM is a critical data quality issue that can invalidate
 * experiment results.
 *
 * Common causes of SRM:
 * - Bot traffic
 * - Implementation bugs in randomization
 * - Client-side assignment with cache issues
 * - Network failures during assignment
 * - Redirects or page reloads
 *
 * Reference: Fabijan et al. (2019) "Diagnosing Sample Ratio Mismatch in Online Controlled Experiments"
 * https://www.microsoft.com/en-us/research/publication/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments/
 */

import { chiSquareTest, type ChiSquareResult } from './statistics';

/**
 * Severity levels for SRM
 */
export type SRMSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of SRM detection
 */
export interface SRMResult {
  /** Whether a statistically significant mismatch was detected */
  hasMismatch: boolean;

  /** Expected allocation ratios (as percentages) */
  expectedRatios: Record<string, number>;

  /** Observed allocation ratios (as percentages) */
  observedRatios: Record<string, number>;

  /** P-value from chi-square test */
  pValue: number;

  /** Chi-square test statistic */
  chiSquare: number;

  /** Severity classification */
  severity: SRMSeverity;

  /** Degrees of freedom for chi-square test */
  degreesOfFreedom: number;

  /** Human-readable diagnosis */
  diagnosis: string;

  /** Recommended actions */
  recommendations: string[];
}

/**
 * Detect Sample Ratio Mismatch using chi-square goodness-of-fit test
 *
 * Tests H0: Observed ratios match expected ratios
 * Uses chi-square test with significance level α = 0.001 (very conservative to avoid false positives)
 *
 * @param assignments - Object mapping variant names to observed counts
 *                     e.g., { control: 5023, treatment: 4977 }
 * @param expectedWeights - Object mapping variant names to expected weights
 *                         e.g., { control: 50, treatment: 50 }
 * @returns SRMResult with mismatch detection and diagnostics
 *
 * @example
 * const result = detectSampleRatioMismatch(
 *   { control: 5200, treatment: 4800 },
 *   { control: 50, treatment: 50 }
 * );
 *
 * if (result.hasMismatch) {
 *   console.error(`SRM DETECTED: ${result.diagnosis}`);
 *   console.error('Recommendations:', result.recommendations);
 * }
 */
export function detectSampleRatioMismatch(
  assignments: Record<string, number>,
  expectedWeights: Record<string, number>
): SRMResult {
  // Validate inputs
  const variantNames = Object.keys(assignments);
  const expectedVariantNames = Object.keys(expectedWeights);

  if (variantNames.length === 0) {
    throw new Error('Assignments object cannot be empty');
  }

  if (!variantNames.every(v => expectedVariantNames.includes(v))) {
    throw new Error('All assignment variants must have corresponding expected weights');
  }

  // Calculate observed counts and expected proportions
  const totalObserved = Object.values(assignments).reduce((sum, count) => sum + count, 0);

  if (totalObserved === 0) {
    throw new Error('Total observed assignments cannot be zero');
  }

  const totalWeight = variantNames
    .map(v => expectedWeights[v] || 0)
    .reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    throw new Error('Total expected weights cannot be zero');
  }

  // Build observed and expected frequency arrays
  const observed: number[] = [];
  const expected: number[] = [];
  const observedRatios: Record<string, number> = {};
  const expectedRatios: Record<string, number> = {};

  for (const variant of variantNames) {
    const observedCount = assignments[variant];
    const expectedWeight = expectedWeights[variant] || 0;
    const expectedCount = (expectedWeight / totalWeight) * totalObserved;

    observed.push(observedCount);
    expected.push(expectedCount);

    observedRatios[variant] = (observedCount / totalObserved) * 100;
    expectedRatios[variant] = (expectedWeight / totalWeight) * 100;
  }

  // Perform chi-square goodness-of-fit test
  // Use very conservative alpha = 0.001 to minimize false positives
  const chiSquareResult: ChiSquareResult = chiSquareTest(observed, expected, 0.001);

  const hasMismatch = chiSquareResult.significant || false;
  const severity = classifySeverity(chiSquareResult.pValue, totalObserved);
  const diagnosis = generateDiagnosis(
    variantNames,
    observedRatios,
    expectedRatios,
    chiSquareResult.pValue,
    severity
  );
  const recommendations = generateRecommendations(severity, totalObserved);

  return {
    hasMismatch,
    expectedRatios,
    observedRatios,
    pValue: chiSquareResult.pValue,
    chiSquare: chiSquareResult.chiSquare,
    severity,
    degreesOfFreedom: chiSquareResult.degreesOfFreedom,
    diagnosis,
    recommendations
  };
}

/**
 * Classify SRM severity based on p-value and sample size
 *
 * Severity levels:
 * - none: p > 0.001 (no significant mismatch)
 * - low: 0.0001 < p ≤ 0.001 (minor mismatch, monitor)
 * - medium: 0.00001 < p ≤ 0.0001 (moderate mismatch, investigate)
 * - high: 0.000001 < p ≤ 0.00001 (severe mismatch, results questionable)
 * - critical: p ≤ 0.000001 (extreme mismatch, experiment invalid)
 *
 * @param pValue - P-value from chi-square test
 * @param sampleSize - Total sample size
 * @returns Severity classification
 */
function classifySeverity(pValue: number, sampleSize: number): SRMSeverity {
  // For very small samples, be more lenient
  if (sampleSize < 1000) {
    if (pValue > 0.001) return 'none';
    if (pValue > 0.0001) return 'low';
    if (pValue > 0.00001) return 'medium';
    return 'high';
  }

  // Standard classification for adequate sample sizes
  if (pValue > 0.001) return 'none';
  if (pValue > 0.0001) return 'low';
  if (pValue > 0.00001) return 'medium';
  if (pValue > 0.000001) return 'high';
  return 'critical';
}

/**
 * Generate human-readable diagnosis
 */
function generateDiagnosis(
  variantNames: string[],
  observedRatios: Record<string, number>,
  expectedRatios: Record<string, number>,
  pValue: number,
  severity: SRMSeverity
): string {
  if (severity === 'none') {
    return 'No sample ratio mismatch detected. Assignment ratios are within expected bounds.';
  }

  const deviations = variantNames.map(variant => {
    const obs = observedRatios[variant];
    const exp = expectedRatios[variant];
    const diff = obs - exp;
    const relDiff = ((obs - exp) / exp) * 100;
    return {
      variant,
      observed: obs.toFixed(2),
      expected: exp.toFixed(2),
      absoluteDiff: diff.toFixed(2),
      relativeDiff: relDiff.toFixed(1)
    };
  });

  let diagnosis = `SAMPLE RATIO MISMATCH DETECTED (${severity.toUpperCase()})\n\n`;
  diagnosis += `Statistical Significance: p-value = ${pValue.toExponential(4)}\n\n`;
  diagnosis += 'Variant Assignment Deviations:\n';

  for (const dev of deviations) {
    diagnosis += `  ${dev.variant}:\n`;
    diagnosis += `    Observed: ${dev.observed}% | Expected: ${dev.expected}%\n`;
    diagnosis += `    Deviation: ${dev.absoluteDiff}% (${dev.relativeDiff}% relative)\n`;
  }

  return diagnosis;
}

/**
 * Generate actionable recommendations based on severity
 */
function generateRecommendations(severity: SRMSeverity, sampleSize: number): string[] {
  const recommendations: string[] = [];

  if (severity === 'none') {
    recommendations.push('No action required. Continue monitoring assignment ratios.');
    return recommendations;
  }

  // Common recommendations for all SRM levels
  recommendations.push('IMMEDIATE: Stop trusting experiment results until SRM is resolved.');
  recommendations.push('Check randomization implementation for bugs or bias.');
  recommendations.push('Verify client-side assignment code is not affected by caching.');

  if (severity === 'low') {
    recommendations.push('Monitor for 24 hours to see if issue persists.');
    recommendations.push('Check for unusual bot traffic or automated testing.');
    recommendations.push('Review recent code deployments that might affect assignment.');
  }

  if (severity === 'medium' || severity === 'high') {
    recommendations.push('URGENT: Investigate immediately. Results are likely invalid.');
    recommendations.push('Check server logs for errors during assignment.');
    recommendations.push('Verify database writes are completing successfully.');
    recommendations.push('Look for network failures, redirects, or page reloads.');
    recommendations.push('Compare SRM across different user segments (browser, device, location).');
  }

  if (severity === 'high' || severity === 'critical') {
    recommendations.push('CRITICAL: Pause experiment and notify stakeholders.');
    recommendations.push('DO NOT make decisions based on current results.');
    recommendations.push('Conduct thorough code review of assignment logic.');
    recommendations.push('Check for interaction effects with other experiments.');
    recommendations.push('Consider implementing server-side assignment if using client-side.');
  }

  if (severity === 'critical') {
    recommendations.push('SEVERE DATA QUALITY ISSUE: Experiment results are invalid.');
    recommendations.push('Roll back to 100% control or pause completely.');
    recommendations.push('Investigate potential data pipeline corruption.');
    recommendations.push('Review all experiments for similar issues.');
  }

  return recommendations;
}

/**
 * Detect SRM over time (for continuous monitoring)
 *
 * Performs SRM detection for each time period and returns results
 *
 * @param timeSeriesAssignments - Array of assignment counts over time
 *                                Each element: { timestamp, assignments: {...} }
 * @param expectedWeights - Expected variant weights
 * @returns Array of SRM results, one per time period
 *
 * @example
 * const timeSeries = [
 *   { timestamp: '2025-01-01T00:00:00Z', assignments: { control: 500, treatment: 500 } },
 *   { timestamp: '2025-01-01T01:00:00Z', assignments: { control: 520, treatment: 480 } },
 *   { timestamp: '2025-01-01T02:00:00Z', assignments: { control: 550, treatment: 450 } }
 * ];
 * const results = detectSRMTimeSeries(timeSeries, { control: 50, treatment: 50 });
 */
export function detectSRMTimeSeries(
  timeSeriesAssignments: Array<{
    timestamp: string;
    assignments: Record<string, number>;
  }>,
  expectedWeights: Record<string, number>
): Array<SRMResult & { timestamp: string }> {
  return timeSeriesAssignments.map(({ timestamp, assignments }) => {
    const result = detectSampleRatioMismatch(assignments, expectedWeights);
    return {
      timestamp,
      ...result
    };
  });
}

/**
 * Calculate recommended check frequency for SRM monitoring
 *
 * Higher traffic experiments should be checked more frequently
 *
 * @param dailyTraffic - Expected daily user traffic
 * @returns Recommended check interval in hours
 */
export function recommendedCheckFrequency(dailyTraffic: number): number {
  if (dailyTraffic > 100000) return 1;   // Hourly for high traffic
  if (dailyTraffic > 10000) return 4;    // Every 4 hours for medium traffic
  if (dailyTraffic > 1000) return 12;    // Twice daily for low traffic
  return 24;                              // Daily for very low traffic
}

/**
 * Estimate SRM detection sensitivity
 *
 * Calculates the minimum detectable relative imbalance given sample size
 *
 * @param totalSampleSize - Total number of assignments
 * @param numVariants - Number of variants (default: 2)
 * @param alpha - Significance level (default: 0.001)
 * @returns Minimum detectable relative imbalance (e.g., 0.02 = 2%)
 */
export function estimateSRMSensitivity(
  totalSampleSize: number,
  numVariants: number = 2,
  alpha: number = 0.001
): number {
  // Critical value for chi-square distribution
  // For 2 variants (df=1) at alpha=0.001: critical value ≈ 10.83
  const criticalValues: Record<number, number> = {
    1: 10.83,  // 2 variants
    2: 13.82,  // 3 variants
    3: 16.27,  // 4 variants
    4: 18.47   // 5 variants
  };

  const df = numVariants - 1;
  const criticalValue = criticalValues[df] || 10.83;

  // For 50/50 split, minimum detectable imbalance
  // chi-square ≈ n * (p_obs - p_exp)² / (p_exp * (1 - p_exp))
  // Solving for (p_obs - p_exp):
  const expectedProportion = 1 / numVariants;
  const minDelta = Math.sqrt(
    (criticalValue * expectedProportion * (1 - expectedProportion)) / totalSampleSize
  );

  return (minDelta / expectedProportion); // Relative imbalance
}
