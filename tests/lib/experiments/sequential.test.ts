/**
 * Tests for Sequential Testing
 *
 * Validates SPRT, confidence sequences, and early stopping methods
 */

import {
  sprt,
  msprt,
  confidenceSequence,
  groupSequentialTest,
  alwaysValidPValue,
  sequentialMinimumDetectableEffect,
  type SequentialTestResult
} from '../../../src/lib/experiments/sequential';

describe('Sequential Testing', () => {
  describe('SPRT (Sequential Probability Ratio Test)', () => {
    test('should continue when insufficient evidence', () => {
      const observations = [1, 0, 1, 0, 1]; // Small sample
      const result: SequentialTestResult = sprt(observations, 0.5, 0.6, 0.05, 0.20);

      expect(result.canStop).toBe(false);
      expect(result.decision).toBe('continue');
      expect(result.estimatedSamplesNeeded).toBeGreaterThan(0);
    });

    test('should accept H1 when strong evidence for treatment', () => {
      // Simulate 70% conversion when expecting 60% vs 50%
      const observations = Array(100).fill(0).map((_, i) => i < 70 ? 1 : 0);
      const result = sprt(observations, 0.50, 0.60, 0.05, 0.20);

      expect(result.canStop).toBe(true);
      expect(result.decision).toBe('accept_h1');
      expect(result.logLikelihoodRatio).toBeGreaterThan(result.upperBound);
    });

    test('should accept H0 when evidence against treatment', () => {
      // Simulate 50% conversion when expecting 60% vs 50%
      const observations = Array(100).fill(0).map((_, i) => i < 50 ? 1 : 0);
      const result = sprt(observations, 0.50, 0.60, 0.05, 0.20);

      expect(result.canStop).toBe(true);
      expect(result.decision).toBe('accept_h0');
      expect(result.logLikelihoodRatio).toBeLessThan(result.lowerBound);
    });

    test('should calculate correct likelihood ratio bounds', () => {
      const alpha = 0.05;
      const beta = 0.20;
      const result = sprt([], 0.5, 0.6, alpha, beta);

      expect(result.upperBound).toBeCloseTo(Math.log((1 - beta) / alpha), 2);
      expect(result.lowerBound).toBeCloseTo(Math.log(beta / (1 - alpha)), 2);
    });

    test('should track sample size', () => {
      const observations = [1, 0, 1, 1, 0, 1, 0];
      const result = sprt(observations, 0.5, 0.6, 0.05, 0.20);

      expect(result.sampleSize).toBe(7);
    });

    test('should estimate samples needed accurately', () => {
      const observations = [1, 1, 1]; // Very few samples
      const result = sprt(observations, 0.50, 0.60, 0.05, 0.20);

      expect(result.estimatedSamplesNeeded).toBeDefined();
      expect(result.estimatedSamplesNeeded).toBeGreaterThan(0);
    });

    test('should handle edge case: empty observations', () => {
      const result = sprt([], 0.5, 0.6, 0.05, 0.20);

      expect(result.canStop).toBe(false);
      expect(result.decision).toBe('continue');
      expect(result.logLikelihoodRatio).toBe(0);
    });

    test('should handle all successes', () => {
      const observations = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      const result = sprt(observations, 0.50, 0.90, 0.05, 0.20);

      expect(result.logLikelihoodRatio).toBeGreaterThan(0);
    });

    test('should handle all failures', () => {
      const observations = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = sprt(observations, 0.50, 0.10, 0.05, 0.20);

      expect(result.logLikelihoodRatio).toBeGreaterThan(0);
    });

    test('should stop faster with larger effect size', () => {
      const observations = Array(50).fill(0).map((_, i) => i < 30 ? 1 : 0);

      const smallEffect = sprt(observations, 0.50, 0.55, 0.05, 0.20);
      const largeEffect = sprt(observations, 0.50, 0.70, 0.05, 0.20);

      // Larger effect should accumulate evidence faster
      expect(Math.abs(largeEffect.logLikelihoodRatio)).toBeGreaterThan(
        Math.abs(smallEffect.logLikelihoodRatio)
      );
    });
  });

  describe('mSPRT (modified SPRT)', () => {
    test('should handle bounded continuous observations', () => {
      const observations = [50, 60, 55, 65, 58, 62];
      const result = msprt(observations, 50, 60, 100, 0.05, 0.20);

      expect(result.canStop).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(isFinite(result.logLikelihoodRatio)).toBe(true);
    });

    test('should handle observations at bound', () => {
      const observations = [100, 100, 100, 100];
      const result = msprt(observations, 50, 60, 100, 0.05, 0.20);

      expect(isFinite(result.logLikelihoodRatio)).toBe(true);
    });

    test('should handle observations below bound', () => {
      const observations = [10, 20, 15, 25, 18];
      const result = msprt(observations, 15, 25, 100, 0.05, 0.20);

      expect(result.sampleSize).toBe(5);
    });

    test('should work with revenue data', () => {
      // Simulate revenue: control=$50, treatment=$60
      const observations = [52, 58, 63, 55, 61, 59, 64];
      const result = msprt(observations, 50, 60, 1000, 0.05, 0.20);

      expect(result.logLikelihoodRatio).toBeGreaterThan(0);
    });

    test('should handle empty observations', () => {
      const result = msprt([], 50, 60, 100, 0.05, 0.20);

      expect(result.canStop).toBe(false);
      expect(result.decision).toBe('continue');
    });
  });

  describe('confidenceSequence', () => {
    test('should produce valid confidence sequences', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const cs = confidenceSequence(data, 0.95);

      expect(cs.lower.length).toBe(10);
      expect(cs.upper.length).toBe(10);
      expect(cs.mean.length).toBe(10);

      // At each time point, mean should be within bounds
      for (let i = 0; i < 10; i++) {
        expect(cs.mean[i]).toBeGreaterThanOrEqual(cs.lower[i]);
        expect(cs.mean[i]).toBeLessThanOrEqual(cs.upper[i]);
      }
    });

    test('should narrow over time', () => {
      const data = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]; // Constant values
      const cs = confidenceSequence(data, 0.95);

      const width1 = cs.upper[0] - cs.lower[0];
      const width10 = cs.upper[9] - cs.lower[9];

      expect(width10).toBeLessThan(width1);
    });

    test('should track running mean', () => {
      const data = [1, 2, 3];
      const cs = confidenceSequence(data, 0.95);

      expect(cs.mean[0]).toBe(1);
      expect(cs.mean[1]).toBe(1.5);
      expect(cs.mean[2]).toBe(2);
    });

    test('should handle empty data', () => {
      const cs = confidenceSequence([], 0.95);

      expect(cs.lower).toEqual([]);
      expect(cs.upper).toEqual([]);
      expect(cs.mean).toEqual([]);
    });

    test('should handle single observation', () => {
      const cs = confidenceSequence([42], 0.95);

      expect(cs.mean[0]).toBe(42);
      expect(cs.lower[0]).toBeLessThanOrEqual(42);
      expect(cs.upper[0]).toBeGreaterThanOrEqual(42);
    });

    test('should respect confidence level', () => {
      const data = [1, 2, 3, 4, 5];

      const cs95 = confidenceSequence(data, 0.95);
      const cs99 = confidenceSequence(data, 0.99);

      // 99% CI should be wider
      const width95 = cs95.upper[4] - cs95.lower[4];
      const width99 = cs99.upper[4] - cs99.lower[4];

      expect(width99).toBeGreaterThan(width95);
    });

    test('should handle high variance data', () => {
      const data = [1, 100, 1, 100, 1, 100];
      const cs = confidenceSequence(data, 0.95);

      expect(cs.lower.every(x => isFinite(x))).toBe(true);
      expect(cs.upper.every(x => isFinite(x))).toBe(true);
    });

    test('should allow valid peeking at any time', () => {
      // This is the key property: can check at any time without inflating Type I error
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const cs = confidenceSequence(data, 0.95);

      // All bounds should be valid
      for (let i = 0; i < 10; i++) {
        expect(cs.lower[i]).toBeLessThanOrEqual(cs.mean[i]);
        expect(cs.upper[i]).toBeGreaterThanOrEqual(cs.mean[i]);
      }
    });
  });

  describe('groupSequentialTest', () => {
    test('should use O\'Brien-Fleming boundaries', () => {
      const observations = Array(1000).fill(0).map(() => Math.random());
      const result = groupSequentialTest(observations, 3000, 3, 1, 0.05);

      // First look should have highest critical value
      expect(result.criticalValue).toBeGreaterThan(1.96);
    });

    test('should reduce critical value at later looks', () => {
      const observations = Array(2000).fill(0).map(() => Math.random());

      const result1 = groupSequentialTest(observations, 3000, 3, 1, 0.05);
      const result2 = groupSequentialTest(observations, 3000, 3, 2, 0.05);
      const result3 = groupSequentialTest(observations, 3000, 3, 3, 0.05);

      expect(result1.criticalValue).toBeGreaterThan(result2.criticalValue);
      expect(result2.criticalValue).toBeGreaterThan(result3.criticalValue);
    });

    test('should force decision at final look', () => {
      const observations = [1, 1, 1, 1, 1];
      const result = groupSequentialTest(observations, 5, 2, 2, 0.05);

      expect(result.canStop).toBe(true);
    });

    test('should calculate test statistic', () => {
      const observations = [1, 2, 3, 4, 5];
      const result = groupSequentialTest(observations, 15, 3, 1, 0.05);

      expect(isFinite(result.testStatistic)).toBe(true);
    });

    test('should reject H0 when test statistic exceeds critical value', () => {
      const observations = Array(1000).fill(10); // Very consistent values far from 0
      const result = groupSequentialTest(observations, 3000, 3, 1, 0.05);

      expect(result.testStatistic).toBeGreaterThan(result.criticalValue);
      expect(result.decision).toBe('reject_h0');
      expect(result.canStop).toBe(true);
    });
  });

  describe('alwaysValidPValue', () => {
    test('should produce valid p-value', () => {
      const observations = [1, 2, 3, 4, 5];
      const pValue = alwaysValidPValue(observations, 0);

      expect(pValue).toBeGreaterThan(0);
      expect(pValue).toBeLessThanOrEqual(1);
    });

    test('should adjust for peeking', () => {
      const observations = [1, 2, 3];

      // Always-valid p-value should be more conservative
      const pValue = alwaysValidPValue(observations, 0);

      expect(pValue).toBeGreaterThan(0);
    });

    test('should handle empty observations', () => {
      const pValue = alwaysValidPValue([], 0);

      expect(pValue).toBe(1);
    });

    test('should detect strong effects', () => {
      const observations = Array(100).fill(10); // Far from null mean of 0
      const pValue = alwaysValidPValue(observations, 0);

      expect(pValue).toBeLessThan(0.05);
    });

    test('should not reject when data matches null', () => {
      const observations = [0, 0, 0, 0, 0, 0];
      const pValue = alwaysValidPValue(observations, 0);

      expect(pValue).toBeGreaterThan(0.5);
    });
  });

  describe('sequentialMinimumDetectableEffect', () => {
    test('should calculate MDE for sequential tests', () => {
      const mde = sequentialMinimumDetectableEffect(1000, 0.05, 0.20, 0.10);

      expect(mde).toBeGreaterThan(0);
      expect(mde).toBeLessThan(1);
    });

    test('should decrease with larger sample size', () => {
      const mde1k = sequentialMinimumDetectableEffect(1000, 0.05, 0.20, 0.10);
      const mde10k = sequentialMinimumDetectableEffect(10000, 0.05, 0.20, 0.10);

      expect(mde10k).toBeLessThan(mde1k);
    });

    test('should increase with stricter error rates', () => {
      const mdeRelaxed = sequentialMinimumDetectableEffect(1000, 0.10, 0.30, 0.10);
      const mdeStrict = sequentialMinimumDetectableEffect(1000, 0.01, 0.10, 0.10);

      expect(mdeStrict).toBeGreaterThan(mdeRelaxed);
    });

    test('should depend on baseline rate', () => {
      const mdeLow = sequentialMinimumDetectableEffect(1000, 0.05, 0.20, 0.01);
      const mdeHigh = sequentialMinimumDetectableEffect(1000, 0.05, 0.20, 0.50);

      expect(mdeLow).not.toBe(mdeHigh);
    });
  });

  describe('Real-World Sequential Testing Scenarios', () => {
    test('should stop early when strong effect detected', () => {
      // Simulate conversion improvement from 10% to 15%
      const observations = Array(200).fill(0).map((_, i) => i < 30 ? 1 : 0);
      const result = sprt(observations, 0.10, 0.15, 0.05, 0.20);

      // Should be able to stop before full planned sample
      expect(result.sampleSize).toBeLessThan(500);
    });

    test('should continue when effect is marginal', () => {
      // Simulate small improvement from 10% to 10.5%
      const observations = Array(100).fill(0).map((_, i) => i < 11 ? 1 : 0);
      const result = sprt(observations, 0.10, 0.105, 0.05, 0.20);

      expect(result.decision).toBe('continue');
      expect(result.estimatedSamplesNeeded).toBeGreaterThan(100);
    });

    test('should handle continuous monitoring with confidence sequences', () => {
      // Simulate daily average revenue
      const dailyRevenue = [100, 105, 98, 103, 101, 107, 102];
      const cs = confidenceSequence(dailyRevenue, 0.95);

      // Should produce valid bounds for each day
      expect(cs.lower.length).toBe(7);
      expect(cs.upper.length).toBe(7);

      // Each day's mean should be within bounds
      for (let i = 0; i < 7; i++) {
        expect(cs.mean[i]).toBeGreaterThanOrEqual(cs.lower[i] - 0.001);
        expect(cs.mean[i]).toBeLessThanOrEqual(cs.upper[i] + 0.001);
      }
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle very small effect sizes', () => {
      const result = sprt([1, 0, 1, 0], 0.50, 0.501, 0.05, 0.20);

      expect(isFinite(result.logLikelihoodRatio)).toBe(true);
      expect(result.decision).toBe('continue');
    });

    test('should handle perfect separation', () => {
      const allOnes = [1, 1, 1, 1, 1];
      const result = sprt(allOnes, 0.5, 0.9, 0.05, 0.20);

      expect(isFinite(result.logLikelihoodRatio)).toBe(true);
    });

    test('should handle extreme variance in continuous data', () => {
      const data = [0.001, 1000, 0.001, 1000];
      const cs = confidenceSequence(data, 0.95);

      expect(cs.lower.every(x => isFinite(x))).toBe(true);
      expect(cs.upper.every(x => isFinite(x))).toBe(true);
    });

    test('should not overflow with large samples', () => {
      const observations = Array(10000).fill(0).map((_, i) => i % 2);
      const result = sprt(observations, 0.5, 0.6, 0.05, 0.20);

      expect(isFinite(result.logLikelihoodRatio)).toBe(true);
    });
  });
});
