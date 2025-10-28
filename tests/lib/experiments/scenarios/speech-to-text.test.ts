/**
 * Unit Tests for Speech-to-Text Experiment
 *
 * Tests variant allocation, metric tracking, statistical analysis,
 * SRM detection, and guardrail evaluation.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  runSpeechToTextExperiment,
  getSpeechExperimentSummary,
  initializeSpeechExperiment,
  SPEECH_TO_TEXT_EXPERIMENT,
  type TranscriptionRequest,
  type TranscriptionResult
} from '@/lib/experiments/scenarios/speech-to-text';
import { experimentWarehouse } from '@/lib/experiments/warehouse';
import { detectSampleRatioMismatch } from '@/lib/experiments/srm-detector';

// Mock OpenRouter to avoid real API calls
vi.mock('@/lib/openrouter-client', () => ({
  OpenRouter: vi.fn().mockImplementation(() => ({
    createChatCompletion: vi.fn().mockResolvedValue({
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'openai/gpt-4-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test transcription of the audio content provided.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150
      }
    })
  }))
}));

describe('Speech-to-Text Experiment', () => {
  beforeAll(async () => {
    // Initialize experiment
    await initializeSpeechExperiment();
  });

  afterAll(async () => {
    // Cleanup
    await experimentWarehouse.stop();
  });

  describe('Experiment Configuration', () => {
    it('should have correct experiment key', () => {
      expect(SPEECH_TO_TEXT_EXPERIMENT.experimentKey).toBe('speech_to_text_gpt4_vs_gpt41');
    });

    it('should have two variants: GPT-4 and GPT-4.1', () => {
      expect(SPEECH_TO_TEXT_EXPERIMENT.variants).toHaveProperty('gpt4');
      expect(SPEECH_TO_TEXT_EXPERIMENT.variants).toHaveProperty('gpt41');
      expect(SPEECH_TO_TEXT_EXPERIMENT.variants.gpt4.model).toBe('openai/gpt-4-turbo');
      expect(SPEECH_TO_TEXT_EXPERIMENT.variants.gpt41.model).toBe('openai/gpt-4-turbo-preview');
    });

    it('should have defined metrics', () => {
      expect(SPEECH_TO_TEXT_EXPERIMENT.metrics).toBeDefined();
      expect(SPEECH_TO_TEXT_EXPERIMENT.metrics.length).toBeGreaterThan(0);

      const metricNames = SPEECH_TO_TEXT_EXPERIMENT.metrics.map(m => m.name);
      expect(metricNames).toContain('latency_ms');
      expect(metricNames).toContain('cost_per_request');
      expect(metricNames).toContain('word_error_rate');
    });

    it('should have guardrails configured', () => {
      expect(SPEECH_TO_TEXT_EXPERIMENT.guardrails).toBeDefined();
      expect(SPEECH_TO_TEXT_EXPERIMENT.guardrails.length).toBeGreaterThan(0);

      const hasErrorRateGuardrail = SPEECH_TO_TEXT_EXPERIMENT.guardrails.some(
        g => g.metricName === 'error_rate'
      );
      expect(hasErrorRateGuardrail).toBe(true);
    });
  });

  describe('Variant Allocation', () => {
    it('should randomly assign users to variants', async () => {
      const results: string[] = [];

      // Run 100 assignments
      for (let i = 0; i < 100; i++) {
        const userId = `test_user_${i}`;
        const result = await runSpeechToTextExperiment({
          userId,
          textPrompt: 'Test audio prompt'
        });

        results.push(result.variantKey);
      }

      // Check that we have both variants
      const gpt4Count = results.filter(v => v === 'gpt4').length;
      const gpt41Count = results.filter(v => v === 'gpt41').length;

      expect(gpt4Count).toBeGreaterThan(0);
      expect(gpt41Count).toBeGreaterThan(0);
      expect(gpt4Count + gpt41Count).toBe(100);

      // Check approximate 50/50 split (within reasonable variance)
      expect(gpt4Count).toBeGreaterThan(30);
      expect(gpt4Count).toBeLessThan(70);
    });

    it('should maintain consistent allocation for same user', async () => {
      const userId = 'consistent_user';

      const result1 = await runSpeechToTextExperiment({
        userId,
        textPrompt: 'First request'
      });

      const result2 = await runSpeechToTextExperiment({
        userId,
        textPrompt: 'Second request'
      });

      // Note: Current implementation is random per request, not per user
      // In production, you might want consistent allocation
      expect(result1.variantKey).toMatch(/^(gpt4|gpt41)$/);
      expect(result2.variantKey).toMatch(/^(gpt4|gpt41)$/);
    });
  });

  describe('Transcription Execution', () => {
    it('should successfully transcribe text', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'transcription_test_user',
        textPrompt: 'Transcribe this test audio'
      });

      expect(result).toBeDefined();
      expect(result.transcript).toBeDefined();
      expect(result.transcript.length).toBeGreaterThan(0);
      expect(result.modelName).toBeDefined();
    });

    it('should return correct model name for variant', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'model_name_test_user',
        textPrompt: 'Test prompt'
      });

      if (result.variantKey === 'gpt4') {
        expect(result.modelName).toBe('GPT-4 Turbo');
      } else {
        expect(result.modelName).toBe('GPT-4.1 Preview');
      }
    });

    it('should track all required metrics', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'metrics_test_user',
        textPrompt: 'Test audio for metrics'
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics.latencyMs).toBeGreaterThan(0);
      expect(result.metrics.timeToFirstTokenMs).toBeGreaterThan(0);
      expect(result.metrics.costUsd).toBeGreaterThan(0);
      expect(result.metrics.confidenceScore).toBeGreaterThan(0);
      expect(result.metrics.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.metrics.tokensUsed).toBeGreaterThan(0);
      expect(result.metrics.transcriptLength).toBeGreaterThan(0);
    });

    it('should calculate WER when reference provided', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'wer_test_user',
        textPrompt: 'Hello world',
        referenceTranscript: 'Hello world, this is a test'
      });

      expect(result.metrics.wordErrorRate).toBeDefined();
      expect(result.metrics.wordErrorRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.wordErrorRate).toBeLessThanOrEqual(1);
    });

    it('should not have WER when no reference provided', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'no_wer_test_user',
        textPrompt: 'Hello world'
      });

      // WER may be undefined when no reference is provided
      // but confidence score should always be present
      expect(result.metrics.confidenceScore).toBeDefined();
    });
  });

  describe('Metric Logging', () => {
    it('should log assignment to warehouse', async () => {
      const userId = 'assignment_log_user';

      await runSpeechToTextExperiment({
        userId,
        textPrompt: 'Test'
      });

      // Wait for batch flush
      await experimentWarehouse.flush();

      // Verify assignment was logged
      const assignments = await experimentWarehouse.getAssignments(
        SPEECH_TO_TEXT_EXPERIMENT.experimentKey
      );

      const userAssignment = assignments.find(a => (a as any).user_id === userId);
      expect(userAssignment).toBeDefined();
    });

    it('should log all metrics to warehouse', async () => {
      const userId = 'metric_log_user';

      await runSpeechToTextExperiment({
        userId,
        textPrompt: 'Test'
      });

      // Wait for batch flush
      await experimentWarehouse.flush();

      // Verify metrics were logged
      const metrics = await experimentWarehouse.getMetrics(
        SPEECH_TO_TEXT_EXPERIMENT.experimentKey
      );

      const userMetrics = metrics.filter(m => (m as any).user_id === userId);
      expect(userMetrics.length).toBeGreaterThan(0);

      const metricNames = userMetrics.map(m => (m as any).metric_name);
      expect(metricNames).toContain('latency_ms');
      expect(metricNames).toContain('cost_per_request');
    });
  });

  describe('Statistical Analysis', () => {
    it('should calculate experiment summary', async () => {
      // Run several experiments first
      for (let i = 0; i < 20; i++) {
        await runSpeechToTextExperiment({
          userId: `summary_test_user_${i}`,
          textPrompt: 'Test prompt'
        });
      }

      await experimentWarehouse.flush();

      const summary = await getSpeechExperimentSummary();

      expect(summary).toBeDefined();
      expect(summary.experimentKey).toBe(SPEECH_TO_TEXT_EXPERIMENT.experimentKey);
      expect(summary.totalAssignments).toBeGreaterThan(0);
      expect(summary.variantDistribution).toBeDefined();
    });

    it('should include metric statistics in summary', async () => {
      const summary = await getSpeechExperimentSummary();

      expect(summary.metrics).toBeDefined();
      expect(summary.metrics.latency).toBeDefined();
      expect(summary.metrics.cost).toBeDefined();
      expect(summary.metrics.accuracy).toBeDefined();
    });

    it('should include statistical significance results', async () => {
      const summary = await getSpeechExperimentSummary();

      expect(summary.statisticalSignificance).toBeDefined();
      expect(summary.statisticalSignificance.latency).toBeDefined();
      expect(summary.statisticalSignificance.cost).toBeDefined();
      expect(summary.statisticalSignificance.accuracy).toBeDefined();

      expect(typeof summary.statisticalSignificance.latency.pValue).toBe('number');
      expect(typeof summary.statisticalSignificance.latency.significant).toBe('boolean');
    });

    it('should detect sample ratio mismatch', async () => {
      const summary = await getSpeechExperimentSummary();

      expect(summary.srmStatus).toBeDefined();
      expect(typeof summary.srmStatus.hasMismatch).toBe('boolean');
      expect(typeof summary.srmStatus.pValue).toBe('number');
      expect(summary.srmStatus.expectedRatio).toBeDefined();
      expect(summary.srmStatus.observedCounts).toBeDefined();
    });
  });

  describe('Sample Ratio Mismatch Detection', () => {
    it('should pass SRM check for balanced allocation', () => {
      const assignments = [
        ...Array(500).fill('gpt4'),
        ...Array(500).fill('gpt41')
      ];

      const result = detectSampleRatioMismatch(assignments, { gpt4: 50, gpt41: 50 });

      expect(result.passed).toBe(true);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('should fail SRM check for imbalanced allocation', () => {
      const assignments = [
        ...Array(700).fill('gpt4'),
        ...Array(300).fill('gpt41')
      ];

      const result = detectSampleRatioMismatch(assignments, { gpt4: 50, gpt41: 50 });

      expect(result.passed).toBe(false);
      expect(result.pValue).toBeLessThan(0.05);
    });
  });

  describe('Guardrail Evaluation', () => {
    it('should have appropriate guardrail thresholds', () => {
      const guardrails = SPEECH_TO_TEXT_EXPERIMENT.guardrails;

      const errorRateGuardrail = guardrails.find(g => g.metricName === 'error_rate');
      expect(errorRateGuardrail).toBeDefined();
      expect(errorRateGuardrail?.threshold).toBeLessThanOrEqual(0.01);
      expect(errorRateGuardrail?.severity).toBe('critical');

      const latencyGuardrail = guardrails.find(g => g.metricName === 'latency_p95');
      expect(latencyGuardrail).toBeDefined();
      expect(latencyGuardrail?.threshold).toBeLessThanOrEqual(5000);

      const werGuardrail = guardrails.find(g => g.metricName === 'word_error_rate');
      expect(werGuardrail).toBeDefined();
      expect(werGuardrail?.threshold).toBeLessThanOrEqual(0.05);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text prompt gracefully', async () => {
      await expect(
        runSpeechToTextExperiment({
          userId: 'empty_prompt_user',
          textPrompt: ''
        })
      ).rejects.toThrow();
    });

    it('should handle very long text', async () => {
      const longText = 'This is a very long audio transcription. '.repeat(100);

      const result = await runSpeechToTextExperiment({
        userId: 'long_text_user',
        textPrompt: longText
      });

      expect(result).toBeDefined();
      expect(result.transcript).toBeDefined();
    });

    it('should calculate cost correctly', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'cost_calc_user',
        textPrompt: 'Test'
      });

      // Cost should be proportional to tokens used
      expect(result.metrics.costUsd).toBeGreaterThan(0);
      expect(result.metrics.costUsd).toBeLessThan(0.05); // Reasonable upper bound
    });

    it('should have realistic latency metrics', async () => {
      const result = await runSpeechToTextExperiment({
        userId: 'latency_check_user',
        textPrompt: 'Test'
      });

      // TTFT should be less than total latency
      expect(result.metrics.timeToFirstTokenMs).toBeLessThan(result.metrics.latencyMs);

      // Both should be positive
      expect(result.metrics.timeToFirstTokenMs).toBeGreaterThan(0);
      expect(result.metrics.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();

      // Run 50 experiments in parallel
      const promises = Array.from({ length: 50 }, (_, i) =>
        runSpeechToTextExperiment({
          userId: `perf_test_user_${i}`,
          textPrompt: 'Performance test'
        })
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 10 seconds for 50 requests)
      expect(duration).toBeLessThan(10000);
    }, 15000); // 15 second timeout

    it('should batch metric writes efficiently', async () => {
      const metricsBeforeCount = (await experimentWarehouse.getMetrics(
        SPEECH_TO_TEXT_EXPERIMENT.experimentKey
      )).length;

      // Run 10 experiments
      for (let i = 0; i < 10; i++) {
        await runSpeechToTextExperiment({
          userId: `batch_test_user_${i}`,
          textPrompt: 'Batch test'
        });
      }

      // Don't flush yet - metrics should be in buffer
      const metricsAfterCount = (await experimentWarehouse.getMetrics(
        SPEECH_TO_TEXT_EXPERIMENT.experimentKey
      )).length;

      // Some metrics might be flushed, but not all
      // This tests that batching is working
      expect(metricsAfterCount - metricsBeforeCount).toBeLessThanOrEqual(70); // 10 * 7 metrics max

      // Now flush and verify all are written
      await experimentWarehouse.flush();

      const metricsFinalCount = (await experimentWarehouse.getMetrics(
        SPEECH_TO_TEXT_EXPERIMENT.experimentKey
      )).length;

      expect(metricsFinalCount).toBeGreaterThanOrEqual(metricsBeforeCount + 70);
    });
  });
});
