/**
 * Tests for Bayesian Analysis
 *
 * Validates Bayesian methods for A/B testing
 */

import {
  bayesianTest,
  bayesianTTest,
  shouldStopExperiment,
  type BayesianResult
} from '../../../src/lib/experiments/bayesian';

describe('Bayesian Analysis', () => {
  describe('bayesianTest (proportions)', () => {
    test('should calculate posterior for conversion rates', () => {
      // Control: 100/1000 = 10%
      // Treatment: 150/1000 = 15%
      const result: BayesianResult = bayesianTest(100, 1000, 150, 1000);

      expect(result.posteriorMean).toBeGreaterThan(0.14);
      expect(result.posteriorMean).toBeLessThan(0.16);
      expect(result.credibleInterval.lower).toBeLessThan(result.posteriorMean);
      expect(result.credibleInterval.upper).toBeGreaterThan(result.posteriorMean);
    });

    test('should show high probability when treatment is clearly better', () => {
      // Treatment has much higher conversion
      const result = bayesianTest(100, 1000, 200, 1000);

      expect(result.probabilityBetter).toBeGreaterThan(0.95);
      expect(result.expectedLoss).toBeLessThan(0.01);
    });

    test('should show low probability when treatment is worse', () => {
      // Treatment has lower conversion
      const result = bayesianTest(100, 1000, 50, 1000);

      expect(result.probabilityBetter).toBeLessThan(0.05);
    });

    test('should show ~50% probability when no difference', () => {
      // Same conversion rates
      const result = bayesianTest(100, 1000, 100, 1000);

      expect(result.probabilityBetter).toBeGreaterThan(0.4);
      expect(result.probabilityBetter).toBeLessThan(0.6);
    });

    test('should handle edge case: no conversions', () => {
      const result = bayesianTest(0, 1000, 0, 1000);

      expect(result.posteriorMean).toBeGreaterThan(0);
      expect(result.posteriorMean).toBeLessThan(0.01);
      expect(result.probabilityBetter).toBeCloseTo(0.5, 1);
    });

    test('should handle edge case: all conversions', () => {
      const result = bayesianTest(100, 100, 100, 100);

      expect(result.posteriorMean).toBeGreaterThan(0.99);
      expect(result.posteriorMean).toBeLessThan(1);
    });

    test('should use prior information when provided', () => {
      // Informative prior: Beta(10, 90) = expect ~10% conversion
      const result1 = bayesianTest(5, 50, 10, 50, 10, 90);
      const result2 = bayesianTest(5, 50, 10, 50, 1, 1); // Uninformative

      // Prior should pull posterior toward 10%
      expect(result1.posteriorMean).not.toEqual(result2.posteriorMean);
    });

    test('should calculate reasonable expected loss', () => {
      const result = bayesianTest(100, 1000, 120, 1000);

      expect(result.expectedLoss).toBeGreaterThan(0);
      expect(result.expectedLoss).toBeLessThan(0.1);
    });

    test('should include posterior parameters', () => {
      const result = bayesianTest(50, 500, 60, 500);

      expect(result.variant).toBeDefined();
      expect(result.variant!.alpha).toBeGreaterThan(0);
      expect(result.variant!.beta).toBeGreaterThan(0);
    });

    test('should handle small sample sizes', () => {
      const result = bayesianTest(1, 10, 2, 10);

      expect(result.probabilityBetter).toBeGreaterThan(0);
      expect(result.probabilityBetter).toBeLessThan(1);
      expect(result.credibleInterval.upper).toBeLessThan(1);
      expect(result.credibleInterval.lower).toBeGreaterThan(0);
    });

    test('should handle large sample sizes', () => {
      const result = bayesianTest(10000, 100000, 11000, 100000);

      expect(result.posteriorMean).toBeCloseTo(0.11, 2);
      expect(result.probabilityBetter).toBeGreaterThan(0.99);
    });
  });

  describe('bayesianTTest (continuous metrics)', () => {
    test('should analyze continuous metrics like revenue', () => {
      const control = [10, 20, 15, 25, 18, 22, 16, 24];
      const treatment = [25, 30, 28, 35, 32, 29, 31, 33];

      const result = bayesianTTest(control, treatment);

      expect(result.posteriorMean).toBeGreaterThan(control.reduce((a, b) => a + b) / control.length);
      expect(result.probabilityBetter).toBeGreaterThan(0.9);
    });

    test('should handle similar distributions', () => {
      const control = [10, 15, 20, 25, 30];
      const treatment = [12, 17, 22, 27, 32];

      const result = bayesianTTest(control, treatment);

      expect(result.probabilityBetter).toBeGreaterThan(0.5);
      expect(result.probabilityBetter).toBeLessThan(0.95);
    });

    test('should handle high variance data', () => {
      const control = [1, 100, 1, 100, 1];
      const treatment = [50, 50, 50, 50, 50];

      const result = bayesianTTest(control, treatment);

      expect(isFinite(result.posteriorMean)).toBe(true);
      expect(isFinite(result.probabilityBetter)).toBe(true);
    });

    test('should handle edge case: too few samples', () => {
      const control = [10];
      const treatment = [15];

      const result = bayesianTTest(control, treatment);

      expect(result.probabilityBetter).toBe(0.5);
      expect(result.expectedLoss).toBe(0);
    });

    test('should handle negative values', () => {
      const control = [-10, -5, 0, 5, 10];
      const treatment = [-5, 0, 5, 10, 15];

      const result = bayesianTTest(control, treatment);

      expect(result.posteriorMean).toBeGreaterThan(0);
      expect(result.probabilityBetter).toBeGreaterThan(0.5);
    });

    test('should provide credible intervals', () => {
      const control = [10, 20, 30, 40, 50];
      const treatment = [15, 25, 35, 45, 55];

      const result = bayesianTTest(control, treatment);

      expect(result.credibleInterval.lower).toBeLessThan(result.posteriorMean);
      expect(result.credibleInterval.upper).toBeGreaterThan(result.posteriorMean);
    });
  });

  describe('shouldStopExperiment', () => {
    test('should recommend shipping treatment when strong evidence', () => {
      const result: BayesianResult = {
        posteriorMean: 0.12,
        credibleInterval: { lower: 0.11, upper: 0.13 },
        probabilityBetter: 0.98,
        expectedLoss: 0.001
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      expect(decision.shouldStop).toBe(true);
      expect(decision.decision).toBe('ship_treatment');
      expect(decision.confidence).toBeGreaterThan(0.95);
    });

    test('should recommend keeping control when treatment is worse', () => {
      const result: BayesianResult = {
        posteriorMean: 0.08,
        credibleInterval: { lower: 0.07, upper: 0.09 },
        probabilityBetter: 0.02,
        expectedLoss: 0.02
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      expect(decision.shouldStop).toBe(true);
      expect(decision.decision).toBe('keep_control');
    });

    test('should recommend continuing when insufficient evidence', () => {
      const result: BayesianResult = {
        posteriorMean: 0.105,
        credibleInterval: { lower: 0.09, upper: 0.12 },
        probabilityBetter: 0.75,
        expectedLoss: 0.005
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      expect(decision.shouldStop).toBe(false);
      expect(decision.decision).toBe('continue');
    });

    test('should detect no practical difference', () => {
      const result: BayesianResult = {
        posteriorMean: 0.100,
        credibleInterval: { lower: 0.095, upper: 0.105 }, // Narrow CI around 0
        probabilityBetter: 0.55,
        expectedLoss: 0.002
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      // Might declare no difference if CI is narrow and contains zero relative effect
      expect(['no_difference', 'continue']).toContain(decision.decision);
    });

    test('should not ship with high risk despite high probability', () => {
      const result: BayesianResult = {
        posteriorMean: 0.11,
        credibleInterval: { lower: 0.10, upper: 0.12 },
        probabilityBetter: 0.96,
        expectedLoss: 0.05 // High expected loss
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      expect(decision.decision).toBe('continue');
      expect(decision.shouldStop).toBe(false);
    });

    test('should respect custom thresholds', () => {
      const result: BayesianResult = {
        posteriorMean: 0.11,
        credibleInterval: { lower: 0.10, upper: 0.12 },
        probabilityBetter: 0.92,
        expectedLoss: 0.003
      };

      const strictDecision = shouldStopExperiment(result, 0.95, 0.01);
      const lenientDecision = shouldStopExperiment(result, 0.90, 0.01);

      expect(strictDecision.decision).toBe('continue');
      expect(lenientDecision.decision).toBe('ship_treatment');
    });

    test('should provide reasoning for decision', () => {
      const result: BayesianResult = {
        posteriorMean: 0.11,
        credibleInterval: { lower: 0.10, upper: 0.12 },
        probabilityBetter: 0.85,
        expectedLoss: 0.005
      };

      const decision = shouldStopExperiment(result, 0.95, 0.01);

      expect(decision.reasoning).toBeTruthy();
      expect(decision.reasoning.length).toBeGreaterThan(0);
      expect(decision.reasoning).toContain('%');
    });
  });

  describe('Monte Carlo Simulation Quality', () => {
    test('should produce consistent results across runs', () => {
      // Run same test multiple times
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = bayesianTest(100, 1000, 120, 1000);
        results.push(result.probabilityBetter);
      }

      // Results should be similar (within 5% due to MC variance)
      const mean = results.reduce((a, b) => a + b) / results.length;
      const maxDiff = Math.max(...results.map(r => Math.abs(r - mean)));
      expect(maxDiff).toBeLessThan(0.05);
    });

    test('should converge to correct posterior mean', () => {
      // Known: Beta(101, 901) has mean = 101/1002 ≈ 0.1008
      // Treatment gets same data as control to verify posterior calculation
      const result = bayesianTest(100, 1000, 100, 1000); // Beta(101, 901) for both

      expect(result.posteriorMean).toBeCloseTo(0.1008, 2);
    });

    test('should produce valid probabilities', () => {
      const result = bayesianTest(50, 500, 60, 500);

      expect(result.probabilityBetter).toBeGreaterThanOrEqual(0);
      expect(result.probabilityBetter).toBeLessThanOrEqual(1);
    });

    test('should produce finite expected loss', () => {
      const result = bayesianTest(100, 1000, 120, 1000);

      expect(isFinite(result.expectedLoss)).toBe(true);
      expect(result.expectedLoss).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero total samples', () => {
      const result = bayesianTest(0, 0, 0, 0);

      // With no data, falls back to prior Beta(1, 1) = Uniform
      expect(result.posteriorMean).toBeCloseTo(0.5, 1);
    });

    test('should handle extremely skewed data', () => {
      const result = bayesianTest(1, 10000, 2, 10000);

      expect(result.posteriorMean).toBeLessThan(0.01);
      expect(isFinite(result.probabilityBetter)).toBe(true);
    });

    test('should handle large differences in sample sizes', () => {
      const result = bayesianTest(10, 100, 100, 10000);

      expect(isFinite(result.posteriorMean)).toBe(true);
      expect(isFinite(result.probabilityBetter)).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle typical e-commerce conversion test', () => {
      // Control: 2.5% conversion (250 out of 10,000)
      // Treatment: 2.8% conversion (280 out of 10,000)
      const result = bayesianTest(250, 10000, 280, 10000);

      expect(result.probabilityBetter).toBeGreaterThan(0.8);
      expect(result.expectedLoss).toBeLessThan(0.01);
    });

    test('should handle newsletter signup experiment', () => {
      // Control: 15% signup
      // Treatment: 18% signup
      const result = bayesianTest(150, 1000, 180, 1000);

      expect(result.probabilityBetter).toBeGreaterThan(0.9);
    });

    test('should handle button color test with small effect', () => {
      // Control: 10.0% clicks
      // Treatment: 10.2% clicks (small uplift)
      const result = bayesianTest(1000, 10000, 1020, 10000);

      // Small effect but large sample - Monte Carlo can vary slightly
      expect(result.probabilityBetter).toBeGreaterThan(0.65);
      expect(result.probabilityBetter).toBeLessThan(0.95);
    });
  });
});
