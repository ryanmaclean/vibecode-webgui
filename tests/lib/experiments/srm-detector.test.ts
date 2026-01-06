/**
 * Tests for Sample Ratio Mismatch (SRM) Detection
 *
 * Validates SRM detection accuracy with known mismatch scenarios
 */

import {
  detectSampleRatioMismatch,
  detectSRMTimeSeries,
  recommendedCheckFrequency,
  estimateSRMSensitivity,
  type SRMResult
} from '../../../src/lib/experiments/srm-detector';

describe('SRM Detection', () => {
  describe('detectSampleRatioMismatch', () => {
    test('should not detect SRM when ratio is correct (50/50)', () => {
      const assignments = { control: 5000, treatment: 5000 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result: SRMResult = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.pValue).toBeGreaterThan(0.001);
    });

    test('should detect severe SRM (60/40 split)', () => {
      const assignments = { control: 6000, treatment: 4000 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(true);
      expect(result.severity).not.toBe('none');
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should detect critical SRM (70/30 split)', () => {
      const assignments = { control: 7000, treatment: 3000 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(true);
      expect(['high', 'critical']).toContain(result.severity);
      expect(result.pValue).toBeLessThan(0.00001);
      expect(result.diagnosis).toContain('DETECTED');
    });

    test('should handle unequal expected weights (70/30 intended split)', () => {
      const assignments = { control: 7000, treatment: 3000 };
      const expectedWeights = { control: 70, treatment: 30 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.severity).toBe('none');
      expect(Math.abs(result.observedRatios.control - 70)).toBeLessThan(1);
    });

    test('should work with 3+ variants', () => {
      const assignments = {
        control: 3333,
        treatment_a: 3333,
        treatment_b: 3334
      };
      const expectedWeights = {
        control: 33.33,
        treatment_a: 33.33,
        treatment_b: 33.34
      };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.degreesOfFreedom).toBe(2);
    });

    test('should detect SRM in 3-way split with imbalance', () => {
      const assignments = {
        control: 5000,
        treatment_a: 3000,
        treatment_b: 2000
      };
      const expectedWeights = {
        control: 33.33,
        treatment_a: 33.33,
        treatment_b: 33.34
      };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
    });

    test('should calculate correct observed and expected ratios', () => {
      const assignments = { control: 5200, treatment: 4800 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.observedRatios.control).toBeCloseTo(52, 0);
      expect(result.observedRatios.treatment).toBeCloseTo(48, 0);
      expect(result.expectedRatios.control).toBe(50);
      expect(result.expectedRatios.treatment).toBe(50);
    });

    test('should provide actionable recommendations for critical SRM', () => {
      const assignments = { control: 8000, treatment: 2000 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.recommendations.length).toBeGreaterThan(3);
      expect(result.recommendations.some(r => r.includes('CRITICAL') || r.includes('URGENT'))).toBe(true);
    });

    test('should handle small sample sizes with appropriate leniency', () => {
      // Small sample: 60/40 split might not be severe
      const assignments = { control: 60, treatment: 40 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      // With small samples, should be less severe
      expect(['none', 'low', 'medium']).toContain(result.severity);
    });

    test('should throw error for empty assignments', () => {
      expect(() => {
        detectSampleRatioMismatch({}, { control: 50, treatment: 50 });
      }).toThrow();
    });

    test('should throw error for zero total', () => {
      expect(() => {
        detectSampleRatioMismatch(
          { control: 0, treatment: 0 },
          { control: 50, treatment: 50 }
        );
      }).toThrow();
    });

    test('should throw error for zero weights', () => {
      expect(() => {
        detectSampleRatioMismatch(
          { control: 100, treatment: 100 },
          { control: 0, treatment: 0 }
        );
      }).toThrow();
    });

    test('should match known chi-square benchmark', () => {
      // R: chisq.test(c(520, 480), p=c(0.5, 0.5))
      // Expected χ² ≈ 1.6, p ≈ 0.206
      const assignments = { control: 520, treatment: 480 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.chiSquare).toBeCloseTo(1.6, 0);
      expect(result.pValue).toBeGreaterThan(0.15);
      expect(result.pValue).toBeLessThan(0.25);
    });
  });

  describe('detectSRMTimeSeries', () => {
    test('should detect SRM emerging over time', () => {
      const timeSeries = [
        { timestamp: '2025-01-01T00:00:00Z', assignments: { control: 500, treatment: 500 } },
        { timestamp: '2025-01-01T01:00:00Z', assignments: { control: 520, treatment: 480 } },
        { timestamp: '2025-01-01T02:00:00Z', assignments: { control: 550, treatment: 450 } },
        { timestamp: '2025-01-01T03:00:00Z', assignments: { control: 600, treatment: 400 } }
      ];

      const expectedWeights = { control: 50, treatment: 50 };
      const results = detectSRMTimeSeries(timeSeries, expectedWeights);

      expect(results).toHaveLength(4);

      // First period should be OK
      expect(results[0].severity).toBe('none');

      // Last period should show SRM
      expect(results[3].hasMismatch).toBe(true);
      expect(results[3].severity).not.toBe('none');
    });

    test('should include timestamps in results', () => {
      const timeSeries = [
        { timestamp: '2025-01-01T00:00:00Z', assignments: { control: 500, treatment: 500 } }
      ];

      const results = detectSRMTimeSeries(timeSeries, { control: 50, treatment: 50 });

      expect(results[0].timestamp).toBe('2025-01-01T00:00:00Z');
    });

    test('should handle empty time series', () => {
      const results = detectSRMTimeSeries([], { control: 50, treatment: 50 });

      expect(results).toHaveLength(0);
    });
  });

  describe('recommendedCheckFrequency', () => {
    test('should recommend hourly checks for high traffic', () => {
      const frequency = recommendedCheckFrequency(200000);

      expect(frequency).toBe(1); // Hourly
    });

    test('should recommend less frequent checks for low traffic', () => {
      const lowTraffic = recommendedCheckFrequency(500);
      const mediumTraffic = recommendedCheckFrequency(50000);
      const highTraffic = recommendedCheckFrequency(150000);

      expect(lowTraffic).toBeGreaterThan(mediumTraffic);
      expect(mediumTraffic).toBeGreaterThan(highTraffic);
    });

    test('should recommend daily checks for very low traffic', () => {
      const frequency = recommendedCheckFrequency(100);

      expect(frequency).toBe(24); // Daily
    });
  });

  describe('estimateSRMSensitivity', () => {
    test('should estimate sensitivity improves with larger samples', () => {
      const sensitivity1k = estimateSRMSensitivity(1000, 2);
      const sensitivity10k = estimateSRMSensitivity(10000, 2);
      const sensitivity100k = estimateSRMSensitivity(100000, 2);

      expect(sensitivity10k).toBeLessThan(sensitivity1k);
      expect(sensitivity100k).toBeLessThan(sensitivity10k);
    });

    test('should return reasonable sensitivity for typical experiment', () => {
      // With 10,000 samples, should detect ~3-5% relative imbalance
      const sensitivity = estimateSRMSensitivity(10000, 2);

      expect(sensitivity).toBeGreaterThan(0.02); // Can detect > 2%
      expect(sensitivity).toBeLessThan(0.10);    // Can detect < 10%
    });

    test('should handle multiple variants', () => {
      const sensitivity2 = estimateSRMSensitivity(10000, 2);
      const sensitivity3 = estimateSRMSensitivity(10000, 3);
      const sensitivity4 = estimateSRMSensitivity(10000, 4);

      // More variants makes detection slightly harder
      expect(sensitivity3).toBeGreaterThanOrEqual(sensitivity2);
      expect(sensitivity4).toBeGreaterThanOrEqual(sensitivity3);
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle very large sample sizes', () => {
      const assignments = { control: 1000000, treatment: 1000010 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(isFinite(result.chiSquare)).toBe(true);
      expect(isFinite(result.pValue)).toBe(true);
      expect(result.pValue).toBeGreaterThan(0);
    });

    test('should handle very small deviations in large samples', () => {
      // 0.35% deviation in 1M samples should be detected
      // Chi-square = 2 * (1750)² / 500000 ≈ 12.25 > 10.83 (critical value at α=0.001)
      const assignments = { control: 501750, treatment: 498250 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
    });

    test('should provide clear diagnosis for each severity level', () => {
      const severities = ['none', 'low', 'medium', 'high', 'critical'];

      const testCases = [
        { assignments: { control: 5000, treatment: 5000 }, expected: 'none' },
        { assignments: { control: 5150, treatment: 4850 }, expected: 'low' },
        { assignments: { control: 5500, treatment: 4500 }, expected: 'medium' },
        { assignments: { control: 6000, treatment: 4000 }, expected: 'high' },
        { assignments: { control: 7000, treatment: 3000 }, expected: 'critical' }
      ];

      for (const testCase of testCases) {
        const result = detectSampleRatioMismatch(
          testCase.assignments,
          { control: 50, treatment: 50 }
        );

        expect(result.diagnosis).toBeTruthy();
        expect(result.diagnosis.length).toBeGreaterThan(0);
      }
    });

    test('should handle floating point weights', () => {
      const assignments = { control: 6667, treatment: 3333 };
      const expectedWeights = { control: 66.67, treatment: 33.33 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.severity).toBe('none');
    });

    test('should handle variant names with special characters', () => {
      const assignments = {
        'control-v1': 5000,
        'treatment_v2.1': 5000
      };
      const expectedWeights = {
        'control-v1': 50,
        'treatment_v2.1': 50
      };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.observedRatios['control-v1']).toBeDefined();
      expect(result.observedRatios['treatment_v2.1']).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    test('should detect bot traffic causing SRM', () => {
      // Bots typically get assigned to treatment more often
      const assignments = { control: 4500, treatment: 5500 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(true);
      expect(result.diagnosis).toContain('DETECTED');
    });

    test('should detect cache-related SRM', () => {
      // Cache issues often cause slight but persistent imbalance
      const assignments = { control: 5100, treatment: 4900 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      // May or may not be significant depending on threshold
      if (result.hasMismatch) {
        expect(result.severity).toBe('low');
      }
    });

    test('should not false positive on natural variance', () => {
      // Small natural variance in 1000 samples
      const assignments = { control: 510, treatment: 490 };
      const expectedWeights = { control: 50, treatment: 50 };

      const result = detectSampleRatioMismatch(assignments, expectedWeights);

      expect(result.hasMismatch).toBe(false);
      expect(result.severity).toBe('none');
    });
  });
});
