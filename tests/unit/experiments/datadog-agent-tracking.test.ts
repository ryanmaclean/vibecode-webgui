/**
 * Tests for Datadog Agent Experiment Tracking
 */

import { DatadogAgentExperimentTracker } from '../../../src/lib/experiments/datadog-agent-tracking';
import type { LLMExperimentMetrics, ExperimentAssignment, ExperimentMetric } from '../../../src/lib/experiments/datadog-llm-tracking';

// Mock hot-shots
jest.mock('hot-shots', () => {
  return {
    StatsD: jest.fn().mockImplementation(() => ({
      histogram: jest.fn(),
      increment: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('DatadogAgentExperimentTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackLLMExperiment', () => {
    it('should track LLM experiment with all metrics', () => {
      const metrics: LLMExperimentMetrics = {
        experimentKey: 'test_experiment',
        variantKey: 'variant_a',
        userId: 'user-123',
        sessionId: 'session-456',
        model: 'gpt-4-turbo',
        provider: 'openai',
        latencyMs: 1500,
        timeToFirstTokenMs: 500,
        tokensPrompt: 100,
        tokensCompletion: 200,
        tokensTotal: 300,
        costUsd: 0.0015,
        costPer1kTokens: 0.005,
        qualityScore: 0.95,
        promptLength: 400,
        responseLength: 800,
        temperature: 0.7,
        maxTokens: 1000,
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackLLMExperiment(metrics);
      }).not.toThrow();
    });

    it('should track LLM experiment without optional fields', () => {
      const metrics: LLMExperimentMetrics = {
        experimentKey: 'test_experiment',
        variantKey: 'variant_b',
        userId: 'user-456',
        model: 'claude-3-sonnet',
        provider: 'anthropic',
        latencyMs: 2000,
        tokensPrompt: 150,
        tokensCompletion: 250,
        tokensTotal: 400,
        costUsd: 0.002,
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackLLMExperiment(metrics);
      }).not.toThrow();
    });
  });

  describe('trackAssignment', () => {
    it('should track experiment assignment', () => {
      const assignment: ExperimentAssignment = {
        experimentKey: 'speech_transcription_model',
        variantKey: 'gpt4',
        userId: 'user-789',
        sessionId: 'session-123',
        assignmentProbability: 0.5,
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackAssignment(assignment);
      }).not.toThrow();
    });
  });

  describe('trackMetric', () => {
    it('should track conversion metric', () => {
      const metric: ExperimentMetric = {
        experimentKey: 'test_experiment',
        variantKey: 'variant_a',
        userId: 'user-123',
        metricName: 'transcription_success',
        metricValue: 1,
        metricType: 'conversion',
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackMetric(metric);
      }).not.toThrow();
    });

    it('should track continuous metric', () => {
      const metric: ExperimentMetric = {
        experimentKey: 'test_experiment',
        variantKey: 'variant_b',
        userId: 'user-456',
        metricName: 'latency_ms',
        metricValue: 1500,
        metricType: 'continuous',
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackMetric(metric);
      }).not.toThrow();
    });

    it('should track count metric', () => {
      const metric: ExperimentMetric = {
        experimentKey: 'test_experiment',
        variantKey: 'variant_c',
        userId: 'user-789',
        metricName: 'api_calls',
        metricValue: 5,
        metricType: 'count',
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackMetric(metric);
      }).not.toThrow();
    });
  });

  describe('trackError', () => {
    it('should track experiment error with Error object', () => {
      const error = new Error('Test error');
      
      expect(() => {
        DatadogAgentExperimentTracker.trackError(
          'test_experiment',
          'variant_a',
          error,
          { userId: 'user-123' }
        );
      }).not.toThrow();
    });

    it('should track experiment error with string', () => {
      expect(() => {
        DatadogAgentExperimentTracker.trackError(
          'test_experiment',
          'variant_b',
          'String error message'
        );
      }).not.toThrow();
    });
  });

  describe('trackGuardrailViolation', () => {
    it('should track guardrail violation', () => {
      const violation = {
        metricName: 'latency_ms',
        threshold: 2000,
        actualValue: 3500,
        severity: 'critical' as const,
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackGuardrailViolation(
          'test_experiment',
          'variant_a',
          violation
        );
      }).not.toThrow();
    });

    it('should track warning level violation', () => {
      const violation = {
        metricName: 'cost_usd',
        threshold: 0.001,
        actualValue: 0.0015,
        severity: 'warning' as const,
      };

      expect(() => {
        DatadogAgentExperimentTracker.trackGuardrailViolation(
          'test_experiment',
          'variant_b',
          violation
        );
      }).not.toThrow();
    });
  });
});
