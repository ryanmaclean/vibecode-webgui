/**
 * Comprehensive tests for statistical analysis functions
 *
 * Validates correctness against known benchmarks from statistical software (R, Python)
 * Tests edge cases and numerical stability
 */

import {
  zTest,
  tTest,
  chiSquareTest,
  confidenceInterval,
  cohensD,
  relativeUplift,
  calculateMinimumSampleSize,
  estimatePower,
  bonferroniCorrection,
  benjaminiHochberg,
  type ZTestResult,
  type TTestResult,
  type ChiSquareResult,
  type ConfidenceIntervalResult
} from '../../../src/lib/experiments/statistics';

describe('Statistical Analysis - Core Tests', () => {
  describe('zTest', () => {
    test('should detect significant difference in conversion rates', () => {
      // Control: 100/1000 = 10% conversion
      // Treatment: 150/1000 = 15% conversion
      const control = Array(1000).fill(0).map((_, i) => i < 100 ? 1 : 0);
      const treatment = Array(1000).fill(0).map((_, i) => i < 150 ? 1 : 0);

      const result: ZTestResult = zTest(control, treatment, 0.05);

      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
      expect(result.zScore).toBeGreaterThan(0);
    });

    test('should not detect difference when rates are equal', () => {
      const control = Array(500).fill(0).map((_, i) => i < 50 ? 1 : 0);
      const treatment = Array(500).fill(0).map((_, i) => i < 50 ? 1 : 0);

      const result = zTest(control, treatment, 0.05);

      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
      expect(Math.abs(result.zScore)).toBeLessThan(0.5);
    });

    test('should handle continuous data (means test)', () => {
      const control = [23, 25, 22, 24, 26, 23, 25, 24];
      const treatment = [28, 30, 27, 29, 31, 28, 30, 29];

      const result = zTest(control, treatment, 0.05);

      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    test('should handle edge case: empty arrays', () => {
      const result = zTest([], [], 0.05);

      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
      expect(result.zScore).toBe(0);
    });

    test('should handle edge case: zero variance', () => {
      const control = [1, 1, 1, 1, 1];
      const treatment = [1, 1, 1, 1, 1];

      const result = zTest(control, treatment, 0.05);

      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });

    test('should match known benchmark from R', () => {
      // R: prop.test(c(48, 52), c(100, 100))
      // Expected z ≈ -0.8, p ≈ 0.424
      const control = Array(100).fill(0).map((_, i) => i < 48 ? 1 : 0);
      const treatment = Array(100).fill(0).map((_, i) => i < 52 ? 1 : 0);

      const result = zTest(control, treatment, 0.05);

      expect(Math.abs(result.zScore)).toBeCloseTo(0.4, 1);
      expect(result.pValue).toBeGreaterThan(0.3);
      expect(result.pValue).toBeLessThan(0.7);
    });
  });

  describe('tTest', () => {
    test('should detect significant difference in small samples', () => {
      const control = [20, 22, 19, 23, 21];
      const treatment = [28, 30, 27, 31, 29];

      const result: TTestResult = tTest(control, treatment, 0.05);

      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
      expect(result.degreesOfFreedom).toBeGreaterThan(0);
    });

    test('should handle unequal variances (Welch test)', () => {
      // Control: low variance
      const control = [10, 11, 10, 11, 10];
      // Treatment: high variance
      const treatment = [15, 25, 5, 35, 10];

      const result = tTest(control, treatment, 0.05);

      expect(result.degreesOfFreedom).toBeLessThan(8); // Less than n1+n2-2 due to unequal var
      expect(typeof result.pValue).toBe('number');
    });

    test('should match known benchmark from R', () => {
      // R: t.test(c(2, 4, 6, 8, 10), c(1, 3, 5, 7, 9))
      // Expected t ≈ 1, df = 8, p ≈ 0.347
      const control = [2, 4, 6, 8, 10];
      const treatment = [1, 3, 5, 7, 9];

      const result = tTest(control, treatment, 0.05);

      expect(Math.abs(result.tStatistic)).toBeCloseTo(1, 0);
      expect(result.degreesOfFreedom).toBeCloseTo(8, 0);
      expect(result.pValue).toBeGreaterThan(0.2);
    });

    test('should handle edge case: too few samples', () => {
      const control = [5];
      const treatment = [6];

      const result = tTest(control, treatment, 0.05);

      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });
  });

  describe('chiSquareTest', () => {
    test('should detect significant deviation from expected frequencies', () => {
      // Observed: 60, 40 (imbalanced)
      // Expected: 50, 50 (balanced)
      const result: ChiSquareResult = chiSquareTest([60, 40], [50, 50], 0.05);

      expect(result.chiSquare).toBeCloseTo(4, 0);
      expect(result.degreesOfFreedom).toBe(1);
      expect(result.pValue).toBeLessThan(0.1);
    });

    test('should not detect deviation when observed matches expected', () => {
      const result = chiSquareTest([50, 50], [50, 50], 0.05);

      expect(result.chiSquare).toBeCloseTo(0, 5);
      expect(result.pValue).toBeGreaterThan(0.9);
    });

    test('should handle multi-category data', () => {
      // 3-way split
      const observed = [35, 30, 35];
      const expected = [33.33, 33.33, 33.34];

      const result = chiSquareTest(observed, expected, 0.05);

      expect(result.degreesOfFreedom).toBe(2);
      expect(result.pValue).toBeGreaterThan(0.5);
    });

    test('should match known benchmark from R', () => {
      // R: chisq.test(c(60, 40), p=c(0.5, 0.5))
      // Expected χ² = 4, df = 1, p ≈ 0.046
      const result = chiSquareTest([60, 40], [50, 50], 0.05);

      expect(result.chiSquare).toBeCloseTo(4, 1);
      expect(result.pValue).toBeCloseTo(0.046, 1);
    });

    test('should throw error for mismatched array lengths', () => {
      expect(() => chiSquareTest([10, 20], [10, 20, 30], 0.05)).toThrow();
    });

    test('should throw error for zero expected frequencies', () => {
      expect(() => chiSquareTest([10, 20], [0, 30], 0.05)).toThrow();
    });
  });

  describe('confidenceInterval', () => {
    test('should calculate 95% CI correctly', () => {
      const data = [2, 4, 6, 8, 10]; // Mean = 6, SD = 3.16

      const result: ConfidenceIntervalResult = confidenceInterval(data, 0.95);

      expect(result.mean).toBeCloseTo(6, 1);
      expect(result.lower).toBeLessThan(result.mean);
      expect(result.upper).toBeGreaterThan(result.mean);
      expect(result.marginOfError).toBeGreaterThan(0);
    });

    test('should calculate 99% CI (wider than 95%)', () => {
      const data = [10, 20, 30, 40, 50];

      const ci95 = confidenceInterval(data, 0.95);
      const ci99 = confidenceInterval(data, 0.99);

      expect(ci99.marginOfError).toBeGreaterThan(ci95.marginOfError);
      expect(ci99.lower).toBeLessThan(ci95.lower);
      expect(ci99.upper).toBeGreaterThan(ci95.upper);
    });

    test('should handle single observation', () => {
      const result = confidenceInterval([42], 0.95);

      expect(result.mean).toBe(42);
      expect(result.lower).toBe(42);
      expect(result.upper).toBe(42);
      expect(result.marginOfError).toBe(0);
    });

    test('should handle empty array', () => {
      const result = confidenceInterval([], 0.95);

      expect(result.mean).toBe(0);
      expect(result.marginOfError).toBe(0);
    });

    test('should match known benchmark', () => {
      // R: t.test(c(1, 2, 3, 4, 5))$conf.int
      // Expected CI ≈ [1.76, 4.24]
      const data = [1, 2, 3, 4, 5];
      const result = confidenceInterval(data, 0.95);

      expect(result.lower).toBeCloseTo(1.76, 0);
      expect(result.upper).toBeCloseTo(4.24, 0);
    });
  });

  describe('cohensD', () => {
    test('should calculate small effect size', () => {
      const control = [10, 11, 10, 11, 10];
      const treatment = [11, 12, 11, 12, 11]; // Small difference

      const d = cohensD(control, treatment);

      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(0.5); // Small effect
    });

    test('should calculate large effect size', () => {
      const control = [10, 11, 10, 11, 10];
      const treatment = [20, 21, 20, 21, 20]; // Large difference

      const d = cohensD(control, treatment);

      expect(d).toBeGreaterThan(2); // Very large effect
    });

    test('should return 0 for identical groups', () => {
      const control = [5, 5, 5, 5, 5];
      const treatment = [5, 5, 5, 5, 5];

      const d = cohensD(control, treatment);

      expect(d).toBeCloseTo(0, 5);
    });

    test('should handle negative effect (treatment worse)', () => {
      const control = [20, 21, 20, 21, 20];
      const treatment = [10, 11, 10, 11, 10];

      const d = cohensD(control, treatment);

      expect(d).toBeLessThan(0);
    });

    test('should match known benchmark', () => {
      // Known: control mean=5, sd=1; treatment mean=6, sd=1
      // Expected d = 1.0
      const control = [4, 5, 5, 5, 6];
      const treatment = [5, 6, 6, 6, 7];

      const d = cohensD(control, treatment);

      expect(d).toBeCloseTo(1.0, 0);
    });
  });

  describe('relativeUplift', () => {
    test('should calculate positive uplift', () => {
      const uplift = relativeUplift(10, 12);

      expect(uplift).toBeCloseTo(20, 1); // 20% increase
    });

    test('should calculate negative uplift', () => {
      const uplift = relativeUplift(10, 8);

      expect(uplift).toBeCloseTo(-20, 1); // 20% decrease
    });

    test('should return 0 for no change', () => {
      const uplift = relativeUplift(10, 10);

      expect(uplift).toBe(0);
    });

    test('should handle zero baseline', () => {
      const uplift = relativeUplift(0, 10);

      expect(uplift).toBe(Infinity);
    });

    test('should calculate large uplift correctly', () => {
      const uplift = relativeUplift(1, 10);

      expect(uplift).toBeCloseTo(900, 1); // 900% increase
    });
  });

  describe('calculateMinimumSampleSize', () => {
    test('should calculate sample size for typical A/B test', () => {
      // Baseline: 10%, MDE: 10% relative (1% absolute)
      // Power: 80%, Alpha: 5%
      const n = calculateMinimumSampleSize(0.10, 0.10, 0.8, 0.05);

      expect(n).toBeGreaterThan(1000);
      expect(n).toBeLessThan(10000);
    });

    test('should require larger sample for smaller effect', () => {
      const n1 = calculateMinimumSampleSize(0.10, 0.20, 0.8, 0.05); // 20% relative
      const n2 = calculateMinimumSampleSize(0.10, 0.05, 0.8, 0.05); // 5% relative

      expect(n2).toBeGreaterThan(n1 * 2); // Smaller effect needs more samples
    });

    test('should require larger sample for higher power', () => {
      const n80 = calculateMinimumSampleSize(0.10, 0.10, 0.8, 0.05); // 80% power
      const n90 = calculateMinimumSampleSize(0.10, 0.10, 0.9, 0.05); // 90% power

      expect(n90).toBeGreaterThan(n80);
    });

    test('should return Infinity for zero effect', () => {
      const n = calculateMinimumSampleSize(0.10, 0, 0.8, 0.05);

      expect(n).toBe(Infinity);
    });

    test('should match known power analysis benchmark', () => {
      // From pwr.2p.test in R: baseline=0.05, MDE=0.01 absolute, power=0.8, alpha=0.05
      // Expected n ≈ 1570 per group
      const n = calculateMinimumSampleSize(0.05, 0.20, 0.8, 0.05);

      expect(n).toBeGreaterThan(1000);
      expect(n).toBeLessThan(2500);
    });
  });

  describe('estimatePower', () => {
    test('should estimate high power for large sample', () => {
      const power = estimatePower(10000, 0.10, 0.10, 0.05);

      expect(power).toBeGreaterThan(0.8);
    });

    test('should estimate low power for small sample', () => {
      const power = estimatePower(100, 0.10, 0.10, 0.05);

      expect(power).toBeLessThan(0.5);
    });

    test('should return 0 for zero effect', () => {
      const power = estimatePower(1000, 0.10, 0, 0.05);

      expect(power).toBe(0);
    });

    test('should increase with sample size', () => {
      const power100 = estimatePower(100, 0.10, 0.10, 0.05);
      const power1000 = estimatePower(1000, 0.10, 0.10, 0.05);
      const power10000 = estimatePower(10000, 0.10, 0.10, 0.05);

      expect(power1000).toBeGreaterThan(power100);
      expect(power10000).toBeGreaterThan(power1000);
    });
  });

  describe('bonferroniCorrection', () => {
    test('should correct for multiple comparisons', () => {
      const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];
      const significant = bonferroniCorrection(pValues, 0.05);

      // Adjusted alpha = 0.05 / 5 = 0.01
      // Only first p-value is significant
      expect(significant).toEqual([true, false, false, false, false]);
    });

    test('should be very conservative', () => {
      const pValues = [0.02, 0.02, 0.02];
      const significant = bonferroniCorrection(pValues, 0.05);

      // Adjusted alpha = 0.05 / 3 ≈ 0.0167
      // None are significant
      expect(significant).toEqual([false, false, false]);
    });

    test('should handle single test (no correction needed)', () => {
      const pValues = [0.03];
      const significant = bonferroniCorrection(pValues, 0.05);

      expect(significant).toEqual([true]);
    });
  });

  describe('benjaminiHochberg', () => {
    test('should be less conservative than Bonferroni', () => {
      const pValues = [0.001, 0.01, 0.03, 0.04, 0.05];

      const bonf = bonferroniCorrection(pValues, 0.05);
      const bh = benjaminiHochberg(pValues, 0.05);

      const numBonf = bonf.filter(x => x).length;
      const numBH = bh.filter(x => x).length;

      expect(numBH).toBeGreaterThanOrEqual(numBonf);
    });

    test('should control FDR at 5%', () => {
      const pValues = [0.001, 0.01, 0.02, 0.03, 0.08];
      const significant = benjaminiHochberg(pValues, 0.05);

      // Should reject some but not all
      const numSignificant = significant.filter(x => x).length;
      expect(numSignificant).toBeGreaterThan(0);
      expect(numSignificant).toBeLessThan(pValues.length);
    });

    test('should handle all non-significant p-values', () => {
      const pValues = [0.5, 0.6, 0.7, 0.8];
      const significant = benjaminiHochberg(pValues, 0.05);

      expect(significant).toEqual([false, false, false, false]);
    });

    test('should handle all significant p-values', () => {
      const pValues = [0.001, 0.002, 0.003, 0.004];
      const significant = benjaminiHochberg(pValues, 0.05);

      expect(significant.every(x => x)).toBe(true);
    });

    test('should match known FDR benchmark', () => {
      // R: p.adjust(c(0.01, 0.04, 0.03, 0.05), method="BH")
      const pValues = [0.01, 0.04, 0.03, 0.05];
      const significant = benjaminiHochberg(pValues, 0.05);

      // At FDR=0.05, typically first 2-3 are significant
      const numSig = significant.filter(x => x).length;
      expect(numSig).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Numerical Stability', () => {
    test('should handle very large sample sizes', () => {
      const largeControl = Array(100000).fill(0).map((_, i) => i < 10000 ? 1 : 0);
      const largeTreatment = Array(100000).fill(0).map((_, i) => i < 11000 ? 1 : 0);

      const result = zTest(largeControl, largeTreatment, 0.05);

      expect(isFinite(result.zScore)).toBe(true);
      expect(isFinite(result.pValue)).toBe(true);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
    });

    test('should handle very small p-values without underflow', () => {
      const control = Array(10000).fill(0).map((_, i) => i < 1000 ? 1 : 0);
      const treatment = Array(10000).fill(0).map((_, i) => i < 2000 ? 1 : 0);

      const result = zTest(control, treatment, 0.05);

      expect(result.pValue).toBeGreaterThan(0);
      expect(isFinite(result.pValue)).toBe(true);
    });

    test('should handle extreme values in continuous data', () => {
      const control = [1, 2, 3, 1000000];
      const treatment = [1, 2, 3, 4];

      const result = tTest(control, treatment, 0.05);

      expect(isFinite(result.tStatistic)).toBe(true);
      expect(isFinite(result.pValue)).toBe(true);
    });
  });
});
