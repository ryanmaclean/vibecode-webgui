/**
 * Multi-Armed Bandit Tests
 *
 * Tests for Thompson Sampling implementation including:
 * - Arm selection
 * - Beta distribution updates
 * - Reward calculation
 * - Traffic allocation
 * - Regret calculation
 * - Convergence detection
 */

// Jest is the test runner
import {
  selectArm,
  updateArm,
  calculateReward,
  getTrafficAllocation,
  calculateRegret,
  getExpectedReward,
  getConfidenceInterval,
  hasConverged,
  BanditArm,
  BanditConfig,
  ModelMetrics
} from '@/lib/experiments/multi-arm-bandit';

describe('Multi-Armed Bandit', () => {
  let testArms: BanditArm[];
  let testConfig: BanditConfig;

  beforeEach(() => {
    // Reset test arms to uniform prior
    testArms = [
      {
        key: 'model_a',
        name: 'Model A',
        model: 'test/model-a',
        priorAlpha: 1,
        priorBeta: 1
      },
      {
        key: 'model_b',
        name: 'Model B',
        model: 'test/model-b',
        priorAlpha: 1,
        priorBeta: 1
      },
      {
        key: 'model_c',
        name: 'Model C',
        model: 'test/model-c',
        priorAlpha: 1,
        priorBeta: 1
      }
    ];

    testConfig = {
      experimentKey: 'test_bandit',
      arms: testArms,
      explorationRate: 0.1,
      rewardFunction: calculateReward
    };
  });

  describe('selectArm', () => {
    it('should select an arm', () => {
      const selection = selectArm(testConfig);

      expect(selection).toBeDefined();
      expect(selection.selectedArm).toBeDefined();
      expect(selection.selectionProbability).toBeGreaterThan(0);
      expect(selection.selectionProbability).toBeLessThanOrEqual(1);
      expect(selection.sampledValue).toBeGreaterThanOrEqual(0);
      expect(selection.sampledValue).toBeLessThanOrEqual(1);
      expect(['exploration', 'exploitation']).toContain(selection.explorationVsExploitation);
    });

    it('should throw error if no arms available', () => {
      const emptyConfig = { ...testConfig, arms: [] };
      expect(() => selectArm(emptyConfig)).toThrow('No arms available');
    });

    it('should select different arms over multiple trials', () => {
      const selections = new Set<string>();

      // Run 100 selections
      for (let i = 0; i < 100; i++) {
        const selection = selectArm(testConfig);
        selections.add(selection.selectedArm.key);
      }

      // Should select at least 2 different arms (very high probability)
      expect(selections.size).toBeGreaterThanOrEqual(2);
    });

    it('should favor arms with higher priors', () => {
      // Give model_a a strong prior
      const biasedArms = [
        {
          key: 'model_a',
          name: 'Model A',
          model: 'test/model-a',
          priorAlpha: 100,
          priorBeta: 10
        },
        {
          key: 'model_b',
          name: 'Model B',
          model: 'test/model-b',
          priorAlpha: 10,
          priorBeta: 100
        }
      ];

      const biasedConfig = { ...testConfig, arms: biasedArms, explorationRate: 0 };

      const selections: Record<string, number> = { model_a: 0, model_b: 0 };

      // Run 100 selections
      for (let i = 0; i < 100; i++) {
        const selection = selectArm(biasedConfig);
        selections[selection.selectedArm.key]++;
      }

      // Model A should be selected much more often
      expect(selections.model_a).toBeGreaterThan(selections.model_b);
    });
  });

  describe('updateArm', () => {
    it('should increment alpha on success (reward >= 0.5)', () => {
      const arm = testArms[0];
      const metrics: ModelMetrics = {
        qualityScore: 0.9,
        latencyMs: 1000,
        costUsd: 0.01,
        tokensGenerated: 100
      };

      const updatedArm = updateArm(arm, 0.8, metrics);

      expect(updatedArm.priorAlpha).toBe(arm.priorAlpha + 1);
      expect(updatedArm.priorBeta).toBe(arm.priorBeta);
    });

    it('should increment beta on failure (reward < 0.5)', () => {
      const arm = testArms[0];
      const metrics: ModelMetrics = {
        qualityScore: 0.3,
        latencyMs: 3000,
        costUsd: 0.05,
        tokensGenerated: 100
      };

      const updatedArm = updateArm(arm, 0.2, metrics);

      expect(updatedArm.priorAlpha).toBe(arm.priorAlpha);
      expect(updatedArm.priorBeta).toBe(arm.priorBeta + 1);
    });

    it('should handle boundary case (reward = 0.5)', () => {
      const arm = testArms[0];
      const metrics: ModelMetrics = {
        qualityScore: 0.5,
        latencyMs: 2000,
        costUsd: 0.02,
        tokensGenerated: 100
      };

      const updatedArm = updateArm(arm, 0.5, metrics);

      // reward = 0.5 should be treated as success
      expect(updatedArm.priorAlpha).toBe(arm.priorAlpha + 1);
      expect(updatedArm.priorBeta).toBe(arm.priorBeta);
    });
  });

  describe('calculateReward', () => {
    it('should return value between 0 and 1', () => {
      const metrics: ModelMetrics = {
        qualityScore: 0.8,
        latencyMs: 2000,
        costUsd: 0.03,
        tokensGenerated: 500
      };

      const reward = calculateReward(metrics);

      expect(reward).toBeGreaterThanOrEqual(0);
      expect(reward).toBeLessThanOrEqual(1);
    });

    it('should reward high quality', () => {
      const highQuality: ModelMetrics = {
        qualityScore: 0.9,
        latencyMs: 2000,
        costUsd: 0.03,
        tokensGenerated: 500
      };

      const lowQuality: ModelMetrics = {
        qualityScore: 0.5,
        latencyMs: 2000,
        costUsd: 0.03,
        tokensGenerated: 500
      };

      const rewardHigh = calculateReward(highQuality);
      const rewardLow = calculateReward(lowQuality);

      expect(rewardHigh).toBeGreaterThan(rewardLow);
    });

    it('should reward low latency', () => {
      const fast: ModelMetrics = {
        qualityScore: 0.8,
        latencyMs: 500,
        costUsd: 0.03,
        tokensGenerated: 500
      };

      const slow: ModelMetrics = {
        qualityScore: 0.8,
        latencyMs: 5000,
        costUsd: 0.03,
        tokensGenerated: 500
      };

      const rewardFast = calculateReward(fast);
      const rewardSlow = calculateReward(slow);

      expect(rewardFast).toBeGreaterThan(rewardSlow);
    });

    it('should reward low cost', () => {
      const cheap: ModelMetrics = {
        qualityScore: 0.8,
        latencyMs: 2000,
        costUsd: 0.001,
        tokensGenerated: 500
      };

      const expensive: ModelMetrics = {
        qualityScore: 0.8,
        latencyMs: 2000,
        costUsd: 0.08,
        tokensGenerated: 500
      };

      const rewardCheap = calculateReward(cheap);
      const rewardExpensive = calculateReward(expensive);

      expect(rewardCheap).toBeGreaterThan(rewardExpensive);
    });

    it('should respect custom weights', () => {
      const metrics: ModelMetrics = {
        qualityScore: 1.0,
        latencyMs: 10000, // Very slow
        costUsd: 0.10, // Very expensive
        tokensGenerated: 500
      };

      // Quality-focused weights
      const rewardQualityFocus = calculateReward(metrics, {
        quality: 0.9,
        speed: 0.05,
        cost: 0.05
      });

      // Speed-focused weights
      const rewardSpeedFocus = calculateReward(metrics, {
        quality: 0.1,
        speed: 0.8,
        cost: 0.1
      });

      // Quality focus should give higher reward despite poor speed/cost
      expect(rewardQualityFocus).toBeGreaterThan(rewardSpeedFocus);
    });
  });

  describe('getTrafficAllocation', () => {
    it('should return allocation for all arms', () => {
      const allocation = getTrafficAllocation(testArms);

      expect(Object.keys(allocation)).toHaveLength(testArms.length);
      testArms.forEach(arm => {
        expect(allocation[arm.key]).toBeDefined();
      });
    });

    it('should return probabilities that sum to ~1', () => {
      const allocation = getTrafficAllocation(testArms);
      const sum = Object.values(allocation).reduce((a, b) => a + b, 0);

      expect(sum).toBeCloseTo(1, 1); // Within 0.1 of 1.0
    });

    it('should allocate more traffic to better-performing arms', () => {
      const biasedArms = [
        {
          key: 'good',
          name: 'Good Model',
          model: 'test/good',
          priorAlpha: 100,
          priorBeta: 10
        },
        {
          key: 'bad',
          name: 'Bad Model',
          model: 'test/bad',
          priorAlpha: 10,
          priorBeta: 100
        }
      ];

      const allocation = getTrafficAllocation(biasedArms);

      expect(allocation.good).toBeGreaterThan(allocation.bad);
    });

    it('should return empty object for empty arms', () => {
      const allocation = getTrafficAllocation([]);
      expect(allocation).toEqual({});
    });
  });

  describe('calculateRegret', () => {
    it('should return 0 regret when optimal arm always chosen', () => {
      const optimalReward = 0.9;
      const arms = [
        {
          key: 'optimal',
          name: 'Optimal',
          model: 'test/optimal',
          priorAlpha: 91, // 90 successes + 1 prior
          priorBeta: 11 // 10 failures + 1 prior
        }
      ];

      const regret = calculateRegret(arms, 100, optimalReward);

      // Should be very low (success rate = 90/100 = 0.9)
      expect(regret).toBeLessThan(10);
    });

    it('should calculate positive regret when suboptimal arms chosen', () => {
      const optimalReward = 0.9;
      const arms = [
        {
          key: 'suboptimal',
          name: 'Suboptimal',
          model: 'test/suboptimal',
          priorAlpha: 51, // 50 successes
          priorBeta: 51 // 50 failures
        }
      ];

      const regret = calculateRegret(arms, 100, optimalReward);

      // Success rate = 50/100 = 0.5, so regret = (0.9 - 0.5) * 100 = 40
      expect(regret).toBeGreaterThan(30);
      expect(regret).toBeLessThan(50);
    });

    it('should return 0 for no trials', () => {
      const regret = calculateRegret(testArms, 0, 0.9);
      expect(regret).toBe(0);
    });
  });

  describe('getExpectedReward', () => {
    it('should return mean of Beta distribution', () => {
      const arm: BanditArm = {
        key: 'test',
        name: 'Test',
        model: 'test/model',
        priorAlpha: 3,
        priorBeta: 2
      };

      const expected = getExpectedReward(arm);

      // Mean of Beta(3, 2) = 3 / (3 + 2) = 0.6
      expect(expected).toBeCloseTo(0.6, 2);
    });

    it('should return 0.5 for uniform prior', () => {
      const expected = getExpectedReward(testArms[0]);

      // Mean of Beta(1, 1) = 0.5
      expect(expected).toBeCloseTo(0.5, 2);
    });
  });

  describe('getConfidenceInterval', () => {
    it('should return interval [0, 1] for no trials', () => {
      const [lower, upper] = getConfidenceInterval(testArms[0]);

      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
      expect(upper).toBeGreaterThan(lower);
    });

    it('should narrow with more trials', () => {
      const fewTrials: BanditArm = {
        key: 'few',
        name: 'Few',
        model: 'test/few',
        priorAlpha: 6, // 5 successes
        priorBeta: 6 // 5 failures
      };

      const manyTrials: BanditArm = {
        key: 'many',
        name: 'Many',
        model: 'test/many',
        priorAlpha: 101, // 100 successes
        priorBeta: 101 // 100 failures
      };

      const [lower1, upper1] = getConfidenceInterval(fewTrials);
      const [lower2, upper2] = getConfidenceInterval(manyTrials);

      const width1 = upper1 - lower1;
      const width2 = upper2 - lower2;

      expect(width2).toBeLessThan(width1);
    });

    it('should respect confidence level', () => {
      const arm: BanditArm = {
        key: 'test',
        name: 'Test',
        model: 'test/model',
        priorAlpha: 11,
        priorBeta: 6
      };

      const [lower95, upper95] = getConfidenceInterval(arm, 0.95);
      const [lower99, upper99] = getConfidenceInterval(arm, 0.99);

      // 99% CI should be wider than 95% CI
      const width95 = upper95 - lower95;
      const width99 = upper99 - lower99;

      expect(width99).toBeGreaterThan(width95);
    });
  });

  describe('hasConverged', () => {
    it('should return false with insufficient trials', () => {
      const converged = hasConverged(testArms, 100);
      expect(converged).toBe(false);
    });

    it('should return false without dominant arm', () => {
      // Equal priors, no dominance
      const arms = [
        { ...testArms[0], priorAlpha: 50, priorBeta: 50 },
        { ...testArms[1], priorAlpha: 50, priorBeta: 50 },
        { ...testArms[2], priorAlpha: 50, priorBeta: 50 }
      ];

      const converged = hasConverged(arms, 50);
      expect(converged).toBe(false);
    });

    it('should return true with dominant arm and narrow CIs', () => {
      const arms = [
        { ...testArms[0], priorAlpha: 200, priorBeta: 50 }, // Very dominant
        { ...testArms[1], priorAlpha: 50, priorBeta: 200 },
        { ...testArms[2], priorAlpha: 50, priorBeta: 200 }
      ];

      const converged = hasConverged(arms, 50);
      expect(converged).toBe(true);
    });

    it('should return false with wide confidence intervals', () => {
      const arms = [
        { ...testArms[0], priorAlpha: 10, priorBeta: 2 }, // Dominant but uncertain
        { ...testArms[1], priorAlpha: 2, priorBeta: 10 },
        { ...testArms[2], priorAlpha: 2, priorBeta: 10 }
      ];

      const converged = hasConverged(arms, 10);
      expect(converged).toBe(false);
    });
  });

  describe('Integration: Full Bandit Workflow', () => {
    it('should converge to best arm over time', () => {
      // Simulate a bandit with one clearly superior arm
      const arms = [
        {
          key: 'best',
          name: 'Best Model',
          model: 'test/best',
          priorAlpha: 1,
          priorBeta: 1
        },
        {
          key: 'mediocre',
          name: 'Mediocre Model',
          model: 'test/mediocre',
          priorAlpha: 1,
          priorBeta: 1
        },
        {
          key: 'worst',
          name: 'Worst Model',
          model: 'test/worst',
          priorAlpha: 1,
          priorBeta: 1
        }
      ];

      const config: BanditConfig = {
        experimentKey: 'convergence_test',
        arms,
        explorationRate: 0.1,
        rewardFunction: calculateReward
      };

      // Simulate 500 requests
      // Best model always gives reward > 0.5, others give reward < 0.5
      for (let i = 0; i < 500; i++) {
        const selection = selectArm(config);

        // Simulate rewards based on arm quality
        let reward: number;
        if (selection.selectedArm.key === 'best') {
          reward = 0.8 + Math.random() * 0.2; // 0.8-1.0
        } else if (selection.selectedArm.key === 'mediocre') {
          reward = 0.3 + Math.random() * 0.4; // 0.3-0.7
        } else {
          reward = 0.0 + Math.random() * 0.3; // 0.0-0.3
        }

        // Update arm
        const armIndex = config.arms.findIndex(a => a.key === selection.selectedArm.key);
        config.arms[armIndex] = updateArm(
          selection.selectedArm,
          reward,
          {
            qualityScore: reward,
            latencyMs: 1000,
            costUsd: 0.01,
            tokensGenerated: 100
          }
        );
      }

      // Check that best arm is now dominant
      const allocation = getTrafficAllocation(config.arms);

      expect(allocation.best).toBeGreaterThan(0.5); // Should get >50% traffic
      expect(allocation.best).toBeGreaterThan(allocation.mediocre);
      expect(allocation.best).toBeGreaterThan(allocation.worst);
    });
  });
});
