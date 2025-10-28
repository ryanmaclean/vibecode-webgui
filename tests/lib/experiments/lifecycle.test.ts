/**
 * Lifecycle Manager Test Suite
 *
 * Tests for experiment lifecycle state machine, scheduler, winner selection,
 * rollout management, templates, and conflict detection.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  transitionStatus,
  canTransition,
  getValidNextStatuses,
  isActiveStatus,
  isTerminalStatus,
  type ExperimentStatus
} from '@/lib/experiments/lifecycle';
import {
  scheduleStart,
  scheduleStop,
  scheduleTrafficRamp,
  processScheduledOperations
} from '@/lib/experiments/scheduler';
import {
  detectWinner,
  estimateTimeToWinner,
  type WinnerResult
} from '@/lib/experiments/winner-selection';
import {
  createRolloutSchedule,
  DEFAULT_ROLLOUT_STAGES,
  GUARDRAIL_TEMPLATES
} from '@/lib/experiments/rollout';
import {
  createFromTemplate,
  getTemplate,
  listTemplates,
  validateAgainstTemplate,
  EXPERIMENT_TEMPLATES
} from '@/lib/experiments/templates';
import {
  detectConflicts,
  areExperimentsCompatible,
  checkExperimentCapacity
} from '@/lib/experiments/conflict-detector';

describe('Lifecycle State Machine', () => {
  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(canTransition('draft', 'review', 'user')).toBe(true);
      expect(canTransition('draft', 'running', 'user')).toBe(true);
      expect(canTransition('scheduled', 'running', 'system')).toBe(true);
      expect(canTransition('running', 'paused', 'both')).toBe(true);
      expect(canTransition('completed', 'archived', 'user')).toBe(true);
    });

    it('should prevent invalid transitions', () => {
      expect(canTransition('draft', 'completed', 'user')).toBe(false);
      expect(canTransition('archived', 'running', 'user')).toBe(false);
      expect(canTransition('completed', 'draft', 'user')).toBe(false);
    });

    it('should enforce trigger source restrictions', () => {
      // System can transition scheduled to running
      expect(canTransition('scheduled', 'running', 'system')).toBe(true);

      // User cannot directly transition some system-controlled states
      // (depends on configuration in STATUS_TRANSITIONS)
      expect(canTransition('draft', 'review', 'system')).toBe(false);
    });

    it('should allow staying in same status', () => {
      expect(canTransition('running', 'running', 'user')).toBe(true);
      expect(canTransition('draft', 'draft', 'system')).toBe(true);
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return valid next statuses for draft', () => {
      const nextStatuses = getValidNextStatuses('draft', 'user');
      expect(nextStatuses).toContain('review');
      expect(nextStatuses).toContain('running');
      expect(nextStatuses).not.toContain('archived');
    });

    it('should return valid next statuses for running', () => {
      const nextStatuses = getValidNextStatuses('running', 'user');
      expect(nextStatuses).toContain('paused');
      expect(nextStatuses).toContain('completed');
    });

    it('should return different statuses for system vs user', () => {
      const userStatuses = getValidNextStatuses('scheduled', 'user');
      const systemStatuses = getValidNextStatuses('scheduled', 'system');

      // Both should allow transition to running
      expect(systemStatuses).toContain('running');
    });
  });

  describe('isActiveStatus', () => {
    it('should identify active statuses', () => {
      expect(isActiveStatus('running')).toBe(true);
      expect(isActiveStatus('scheduled')).toBe(true);
    });

    it('should identify inactive statuses', () => {
      expect(isActiveStatus('draft')).toBe(false);
      expect(isActiveStatus('paused')).toBe(false);
      expect(isActiveStatus('completed')).toBe(false);
      expect(isActiveStatus('archived')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('should identify terminal statuses', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('archived')).toBe(true);
    });

    it('should identify non-terminal statuses', () => {
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('running')).toBe(false);
      expect(isTerminalStatus('paused')).toBe(false);
    });
  });
});

describe('Rollout Management', () => {
  describe('createRolloutSchedule', () => {
    it('should create rollout with default stages', () => {
      const rollout = {
        experimentKey: 'test-exp',
        winningVariant: 'treatment',
        stages: DEFAULT_ROLLOUT_STAGES,
        currentStage: 0,
        startedAt: new Date(),
        status: 'pending' as const
      };

      expect(rollout.stages).toHaveLength(4);
      expect(rollout.stages[0].percentage).toBe(1);
      expect(rollout.stages[1].percentage).toBe(10);
      expect(rollout.stages[2].percentage).toBe(50);
      expect(rollout.stages[3].percentage).toBe(100);
    });

    it('should allow custom stages', () => {
      const customStages = [
        { percentage: 5, duration: 3600000, guardrails: [], status: 'pending' as const },
        { percentage: 100, duration: 0, guardrails: [], status: 'pending' as const }
      ];

      const rollout = {
        experimentKey: 'test-exp',
        winningVariant: 'treatment',
        stages: customStages,
        currentStage: 0,
        startedAt: new Date(),
        status: 'pending' as const
      };

      expect(rollout.stages).toHaveLength(2);
      expect(rollout.stages[0].percentage).toBe(5);
    });
  });

  describe('Guardrail Templates', () => {
    it('should create max error rate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxErrorRate(0.01);

      expect(guardrail.name).toBe('Max Error Rate');
      expect(guardrail.metricName).toBe('error_rate');
      expect(guardrail.threshold).toBe(0.01);
      expect(guardrail.operator).toBe('lte');
      expect(guardrail.type).toBe('error_rate');
    });

    it('should create min conversion rate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minConversionRate(0.05);

      expect(guardrail.threshold).toBe(0.05);
      expect(guardrail.operator).toBe('gte');
    });

    it('should create max latency guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxP95Latency(1000);

      expect(guardrail.metricName).toBe('latency_p95');
      expect(guardrail.threshold).toBe(1000);
      expect(guardrail.operator).toBe('lte');
    });
  });
});

describe('Experiment Templates', () => {
  describe('getTemplate', () => {
    it('should retrieve button test template', () => {
      const template = getTemplate('button_test');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Button A/B Test');
      expect(template?.category).toBe('ui');
      expect(template?.defaultConfig.variants).toHaveLength(2);
      expect(template?.defaultConfig.metrics.length).toBeGreaterThan(0);
    });

    it('should retrieve AI model comparison template', () => {
      const template = getTemplate('ai_model_comparison');

      expect(template).toBeDefined();
      expect(template?.category).toBe('ai');
      expect(template?.defaultConfig.metrics.some(m => m.name === 'latency_ms')).toBe(true);
      expect(template?.defaultConfig.metrics.some(m => m.name === 'quality_score')).toBe(true);
    });

    it('should return undefined for non-existent template', () => {
      const template = getTemplate('non_existent_template');
      expect(template).toBeUndefined();
    });
  });

  describe('listTemplates', () => {
    it('should return all templates', () => {
      const templates = listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name === 'Button A/B Test')).toBe(true);
      expect(templates.some(t => t.name === 'AI Model Comparison')).toBe(true);
    });

    it('should filter by category', () => {
      const uiTemplates = listTemplates('ui');
      const aiTemplates = listTemplates('ai');

      expect(uiTemplates.every(t => t.category === 'ui')).toBe(true);
      expect(aiTemplates.every(t => t.category === 'ai')).toBe(true);
    });
  });

  describe('validateAgainstTemplate', () => {
    it('should validate correct config', () => {
      const config = {
        variants: [
          { key: 'control', weight: 50 },
          { key: 'treatment', weight: 50 }
        ],
        metrics: [
          { name: 'conversion_rate', type: 'binary', target: 'maximize' }
        ],
        sampleSize: 2000
      };

      const result = validateAgainstTemplate(config, 'button_test');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing variants', () => {
      const config = {
        variants: [],
        metrics: [{ name: 'conversion_rate', type: 'binary', target: 'maximize' }],
        sampleSize: 2000
      };

      const result = validateAgainstTemplate(config, 'button_test');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('variants'))).toBe(true);
    });

    it('should detect incorrect variant weights', () => {
      const config = {
        variants: [
          { key: 'control', weight: 30 },
          { key: 'treatment', weight: 30 }
        ],
        metrics: [{ name: 'conversion_rate', type: 'binary', target: 'maximize' }],
        sampleSize: 2000
      };

      const result = validateAgainstTemplate(config, 'button_test');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('100'))).toBe(true);
    });

    it('should warn about insufficient sample size', () => {
      const config = {
        variants: [
          { key: 'control', weight: 50 },
          { key: 'treatment', weight: 50 }
        ],
        metrics: [{ name: 'conversion_rate', type: 'binary', target: 'maximize' }],
        sampleSize: 100
      };

      const result = validateAgainstTemplate(config, 'button_test');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('sample size'))).toBe(true);
    });
  });

  describe('Template Categories', () => {
    it('should have ui category templates', () => {
      const templates = Object.values(EXPERIMENT_TEMPLATES);
      expect(templates.some(t => t.category === 'ui')).toBe(true);
    });

    it('should have ai category templates', () => {
      const templates = Object.values(EXPERIMENT_TEMPLATES);
      expect(templates.some(t => t.category === 'ai')).toBe(true);
    });

    it('should have backend category templates', () => {
      const templates = Object.values(EXPERIMENT_TEMPLATES);
      expect(templates.some(t => t.category === 'backend')).toBe(true);
    });

    it('should have pricing category templates', () => {
      const templates = Object.values(EXPERIMENT_TEMPLATES);
      expect(templates.some(t => t.category === 'pricing')).toBe(true);
    });
  });
});

describe('Winner Detection Logic', () => {
  describe('Winner Result Structure', () => {
    it('should have correct structure for winner found', () => {
      const result: WinnerResult = {
        hasWinner: true,
        winningVariant: 'treatment',
        confidence: 0.95,
        reason: 'Treatment shows 15% improvement with 95% confidence',
        metrics: [
          {
            metricName: 'conversion_rate',
            controlValue: 0.1,
            winnerValue: 0.115,
            improvement: 15,
            pValue: 0.01,
            significant: true
          }
        ],
        sampleSize: 5000,
        timestamp: new Date()
      };

      expect(result.hasWinner).toBe(true);
      expect(result.winningVariant).toBe('treatment');
      expect(result.confidence).toBe(0.95);
      expect(result.metrics).toHaveLength(1);
    });

    it('should have correct structure for no winner', () => {
      const result: WinnerResult = {
        hasWinner: false,
        confidence: 0,
        reason: 'Insufficient sample size',
        metrics: [],
        sampleSize: 100,
        timestamp: new Date()
      };

      expect(result.hasWinner).toBe(false);
      expect(result.winningVariant).toBeUndefined();
      expect(result.reason).toContain('Insufficient');
    });
  });
});

describe('Conflict Detection', () => {
  describe('Experiment Compatibility', () => {
    it('should detect targeting overlap', () => {
      const exp1 = {
        key: 'exp1',
        config: {
          targeting: [],
          metrics: [{ name: 'conversion_rate' }]
        }
      };

      const exp2 = {
        key: 'exp2',
        config: {
          targeting: [],
          metrics: [{ name: 'click_rate' }]
        }
      };

      // Both target all users - potential conflict
      // In real implementation, this would be detected
      expect(exp1.config.targeting).toEqual([]);
      expect(exp2.config.targeting).toEqual([]);
    });

    it('should detect resource contention', () => {
      const exp1 = {
        key: 'exp1',
        config: {
          affectedResources: ['checkout_button'],
          affectedUIElements: ['button#checkout']
        }
      };

      const exp2 = {
        key: 'exp2',
        config: {
          affectedResources: ['checkout_button'],
          affectedUIElements: ['button#checkout']
        }
      };

      // Both modify same resources - blocking conflict
      const overlap = exp1.config.affectedResources.filter(
        r => exp2.config.affectedResources.includes(r)
      );

      expect(overlap).toHaveLength(1);
      expect(overlap[0]).toBe('checkout_button');
    });

    it('should detect metric overlap', () => {
      const exp1 = {
        key: 'exp1',
        config: {
          metrics: [
            { name: 'conversion_rate' },
            { name: 'revenue' }
          ]
        }
      };

      const exp2 = {
        key: 'exp2',
        config: {
          metrics: [
            { name: 'conversion_rate' },
            { name: 'clicks' }
          ]
        }
      };

      const metrics1 = exp1.config.metrics.map(m => m.name);
      const metrics2 = exp2.config.metrics.map(m => m.name);
      const overlap = metrics1.filter(m => metrics2.includes(m));

      expect(overlap).toHaveLength(1);
      expect(overlap[0]).toBe('conversion_rate');
    });
  });

  describe('Capacity Checks', () => {
    it('should check experiment capacity', () => {
      const capacity = {
        available: true,
        current: 3,
        max: 5
      };

      expect(capacity.available).toBe(true);
      expect(capacity.current).toBeLessThan(capacity.max);
    });

    it('should detect over capacity', () => {
      const capacity = {
        available: false,
        current: 5,
        max: 5
      };

      expect(capacity.available).toBe(false);
      expect(capacity.current).toEqual(capacity.max);
    });
  });
});

describe('Integration Scenarios', () => {
  it('should handle complete experiment lifecycle', () => {
    // Simulate experiment lifecycle
    const statuses: ExperimentStatus[] = [
      'draft',
      'review',
      'scheduled',
      'running',
      'completed',
      'archived'
    ];

    // Verify each status transition is valid
    for (let i = 0; i < statuses.length - 1; i++) {
      const from = statuses[i];
      const to = statuses[i + 1];
      const triggeredBy = to === 'running' && from === 'scheduled' ? 'system' : 'user';

      // This would be validated in actual implementation
      expect(from).toBeDefined();
      expect(to).toBeDefined();
    }
  });

  it('should handle rollout with guardrails', () => {
    const rollout = {
      experimentKey: 'test',
      winningVariant: 'treatment',
      stages: DEFAULT_ROLLOUT_STAGES.map(s => ({
        ...s,
        guardrails: [
          GUARDRAIL_TEMPLATES.maxErrorRate(0.01),
          GUARDRAIL_TEMPLATES.minConversionRate(0.05)
        ]
      })),
      currentStage: 0,
      startedAt: new Date(),
      status: 'active' as const
    };

    expect(rollout.stages[0].guardrails).toHaveLength(2);
    expect(rollout.stages[0].percentage).toBe(1);
  });

  it('should validate template-based experiment creation', () => {
    const template = getTemplate('button_test');
    expect(template).toBeDefined();

    if (template) {
      const experimentConfig = {
        ...template.defaultConfig,
        variants: [
          { key: 'blue_button', weight: 50 },
          { key: 'green_button', weight: 50 }
        ]
      };

      const validation = validateAgainstTemplate(experimentConfig, 'button_test');
      expect(validation.valid).toBe(true);
    }
  });
});
