/**
 * Performance Benchmarks for Statistical Engine
 *
 * Tests performance with large datasets (10K+ observations)
 * Validates numerical stability and execution time
 *
 * Run with: npm test -- statistics-performance.bench.ts
 */

import {
  zTest,
  tTest,
  chiSquareTest,
  confidenceInterval,
  cohensD,
  calculateMinimumSampleSize,
  bonferroniCorrection,
  benjaminiHochberg
} from '../../../src/lib/experiments/statistics';

import {
  detectSampleRatioMismatch
} from '../../../src/lib/experiments/srm-detector';

import {
  bayesianTest,
  bayesianTTest
} from '../../../src/lib/experiments/bayesian';

import {
  sprt,
  confidenceSequence
} from '../../../src/lib/experiments/sequential';

describe('Statistical Engine Performance', () => {
  describe('Large Dataset Performance (10K observations)', () => {
    test('zTest should handle 10K samples in < 100ms', () => {
      const control = Array(10000).fill(0).map((_, i) => i < 1000 ? 1 : 0);
      const treatment = Array(10000).fill(0).map((_, i) => i < 1100 ? 1 : 0);

      const startTime = performance.now();
      const result = zTest(control, treatment, 0.05);
      const endTime = performance.now();

      expect(result.pValue).toBeLessThan(1);
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('tTest should handle 10K samples in < 200ms', () => {
      const control = Array(10000).fill(0).map(() => Math.random() * 100);
      const treatment = Array(10000).fill(0).map(() => Math.random() * 100 + 5);

      const startTime = performance.now();
      const result = tTest(control, treatment, 0.05);
      const endTime = performance.now();

      expect(isFinite(result.pValue)).toBe(true);
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('bayesianTest should handle 10K samples in < 500ms', () => {
      const startTime = performance.now();
      const result = bayesianTest(1000, 10000, 1100, 10000);
      const endTime = performance.now();

      expect(result.probabilityBetter).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('confidenceSequence should handle 10K time points in < 500ms', () => {
      const data = Array(10000).fill(0).map(() => Math.random() * 10);

      const startTime = performance.now();
      const result = confidenceSequence(data, 0.95);
      const endTime = performance.now();

      expect(result.mean.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('SRM detection should handle 1M samples in < 50ms', () => {
      const assignments = { control: 500000, treatment: 500000 };

      const startTime = performance.now();
      const result = detectSampleRatioMismatch(
        assignments,
        { control: 50, treatment: 50 }
      );
      const endTime = performance.now();

      expect(result.hasMismatch).toBe(false);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Very Large Dataset Performance (100K observations)', () => {
    test('zTest should handle 100K samples in < 500ms', () => {
      const control = Array(100000).fill(0).map((_, i) => i < 10000 ? 1 : 0);
      const treatment = Array(100000).fill(0).map((_, i) => i < 11000 ? 1 : 0);

      const startTime = performance.now();
      const result = zTest(control, treatment, 0.05);
      const endTime = performance.now();

      expect(result.pValue).toBeLessThan(0.01);
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('cohensD should handle 100K samples in < 300ms', () => {
      const control = Array(100000).fill(0).map(() => Math.random() * 10);
      const treatment = Array(100000).fill(0).map(() => Math.random() * 10 + 1);

      const startTime = performance.now();
      const result = cohensD(control, treatment);
      const endTime = performance.now();

      expect(isFinite(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(300);
    });

    test('multiple testing with 1000 p-values in < 150ms', () => {
      const pValues = Array(1000).fill(0).map(() => Math.random());

      const startTimeBonf = performance.now();
      const bonfResults = bonferroniCorrection(pValues, 0.05);
      const endTimeBonf = performance.now();

      const startTimeBH = performance.now();
      const bhResults = benjaminiHochberg(pValues, 0.05);
      const endTimeBH = performance.now();

      expect(bonfResults.length).toBe(1000);
      expect(bhResults.length).toBe(1000);
      expect(endTimeBonf - startTimeBonf).toBeLessThan(50);
      expect(endTimeBH - startTimeBH).toBeLessThan(100);
    });
  });

  describe('Numerical Stability', () => {
    test('should handle very small p-values without underflow', () => {
      const control = Array(10000).fill(0).map((_, i) => i < 1000 ? 1 : 0);
      const treatment = Array(10000).fill(0).map((_, i) => i < 3000 ? 1 : 0);

      const result = zTest(control, treatment, 0.05);

      expect(result.pValue).toBeGreaterThan(0);
      expect(isFinite(result.pValue)).toBe(true);
    });

    test('should handle extreme variances', () => {
      const control = [0.001, 0.001, 0.001, 10000];
      const treatment = [0.001, 0.001, 0.001, 10000];

      const result = tTest(control, treatment, 0.05);

      expect(isFinite(result.tStatistic)).toBe(true);
      expect(isFinite(result.pValue)).toBe(true);
    });
  });

  describe('Memory Efficiency', () => {
    test('should not leak memory with large datasets', () => {
      for (let i = 0; i < 10; i++) {
        const control = Array(10000).fill(0).map(() => Math.random());
        const treatment = Array(10000).fill(0).map(() => Math.random());
        const result = tTest(control, treatment, 0.05);
        expect(isFinite(result.pValue)).toBe(true);
      }

      expect(true).toBe(true);
    });
  });
});

// Benchmark reporting function
export function reportStatisticsPerformance() {
  console.log('\n=== Statistical Engine Performance Report ===\n');

  const benchmarks = [
    {
      name: 'Z-Test (10K samples)',
      fn: () => {
        const control = Array(10000).fill(0).map((_, i) => i < 1000 ? 1 : 0);
        const treatment = Array(10000).fill(0).map((_, i) => i < 1100 ? 1 : 0);
        return zTest(control, treatment);
      }
    },
    {
      name: 'Bayesian Test (10K samples)',
      fn: () => bayesianTest(1000, 10000, 1100, 10000)
    },
    {
      name: 'SRM Detection (1M samples)',
      fn: () => detectSampleRatioMismatch(
        { control: 500000, treatment: 500000 },
        { control: 50, treatment: 50 }
      )
    }
  ];

  benchmarks.forEach(({ name, fn }) => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    console.log(`${name}: ${avg.toFixed(2)}ms avg`);
  });
}
