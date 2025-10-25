/**
 * Tests for Datadog Experiment Runners
 */

import {
  runSpeechTranscriptionExperiment,
  runChatbotPerformanceExperiment,
  runMultiModelExperiment,
} from '../../../src/lib/experiments/run-datadog-experiments';

// Mock the tracking modules
jest.mock('../../../src/lib/experiments/datadog-llm-tracking', () => ({
  datadogLLMTracker: {
    trackAssignment: jest.fn(),
    trackLLMExperiment: jest.fn(),
    trackMetric: jest.fn(),
    trackError: jest.fn(),
  },
}));

jest.mock('../../../src/lib/experiments/datadog-agent-tracking', () => ({
  datadogAgentTracker: {
    trackAssignment: jest.fn(),
    trackLLMExperiment: jest.fn(),
    trackMetric: jest.fn(),
    trackError: jest.fn(),
  },
}));

// Mock RUM client - needs to be a module with default export
const mockRUMClient = {
  initializeWithTracking: jest.fn(),
  getSessionInfo: jest.fn(() => ({ sessionId: 'test-session-123' })),
};

jest.mock('../../../src/lib/monitoring/rum-client', () => mockRUMClient);

describe('Experiment Runners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runSpeechTranscriptionExperiment', () => {
    it('should run speech transcription experiment and return results', async () => {
      const result = await runSpeechTranscriptionExperiment(
        'test-user-1',
        'Hello, this is a test transcription.'
      );

      expect(result).toHaveProperty('variant');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('metrics');
      
      expect(['gpt4', 'gpt41']).toContain(result.variant);
      expect(result.metrics).toHaveProperty('experimentKey', 'speech_transcription_model');
      expect(result.metrics).toHaveProperty('userId', 'test-user-1');
      expect(result.metrics).toHaveProperty('latencyMs');
      expect(result.metrics).toHaveProperty('costUsd');
    });

    it('should assign variant randomly', async () => {
      const variants = new Set<string>();
      
      // Run multiple times to get different variants
      for (let i = 0; i < 20; i++) {
        const result = await runSpeechTranscriptionExperiment(
          `test-user-${i}`,
          'Test text'
        );
        variants.add(result.variant);
      }

      // Should have assigned both variants over 20 runs
      expect(variants.size).toBeGreaterThan(1);
    });

    it('should track metrics with quality score', async () => {
      const result = await runSpeechTranscriptionExperiment(
        'test-user-2',
        'Test transcription text'
      );

      expect(result.metrics.qualityScore).toBeGreaterThanOrEqual(0.95);
      expect(result.metrics.qualityScore).toBeLessThanOrEqual(1.0);
    });
  });

  describe('runChatbotPerformanceExperiment', () => {
    it('should run chatbot performance experiment', async () => {
      const result = await runChatbotPerformanceExperiment(
        'test-user-1',
        'How do I deploy this app?',
        true // first message
      );

      expect(result).toHaveProperty('variant');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('metrics');
      
      expect(['lazy_load', 'preload']).toContain(result.variant);
      expect(result.metrics).toHaveProperty('experimentKey', 'chatbot_initialization_strategy');
    });

    it('should add cold start time for lazy_load on first message', async () => {
      const runs = [];
      
      // Run multiple times to get lazy_load variant
      for (let i = 0; i < 10; i++) {
        const result = await runChatbotPerformanceExperiment(
          `test-user-${i}`,
          'Test message',
          true
        );
        runs.push(result);
      }

      const lazyLoadRuns = runs.filter(r => r.variant === 'lazy_load');
      
      if (lazyLoadRuns.length > 0) {
        const lazyLoadRun = lazyLoadRuns[0];
        expect(lazyLoadRun.metrics.coldStartMs).toBeGreaterThan(0);
      }
    });

    it('should not add cold start time for preload', async () => {
      const runs = [];
      
      // Run multiple times to get preload variant
      for (let i = 0; i < 10; i++) {
        const result = await runChatbotPerformanceExperiment(
          `test-user-${i}`,
          'Test message',
          true
        );
        runs.push(result);
      }

      const preloadRuns = runs.filter(r => r.variant === 'preload');
      
      if (preloadRuns.length > 0) {
        const preloadRun = preloadRuns[0];
        expect(preloadRun.metrics.coldStartMs).toBeUndefined();
      }
    });
  });

  describe('runMultiModelExperiment', () => {
    it('should run multi-model experiment', async () => {
      const result = await runMultiModelExperiment(
        'test-user-1',
        'Explain serverless architecture'
      );

      expect(result).toHaveProperty('variant');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('metrics');
      
      expect(['gpt4', 'claude', 'gemini', 'llama']).toContain(result.variant);
      expect(result.metrics).toHaveProperty('experimentKey', 'multi_model_selection');
    });

    it('should select from all 4 models over multiple runs', async () => {
      const selectedModels = new Set<string>();
      
      // Run 40 times to increase chance of getting all models
      for (let i = 0; i < 40; i++) {
        const result = await runMultiModelExperiment(
          `test-user-${i}`,
          'Test prompt'
        );
        selectedModels.add(result.variant);
      }

      // Should have selected multiple models
      expect(selectedModels.size).toBeGreaterThan(1);
    });

    it('should track quality score and cost', async () => {
      const result = await runMultiModelExperiment(
        'test-user-2',
        'Test prompt for quality'
      );

      expect(result.metrics.qualityScore).toBeGreaterThanOrEqual(0.8);
      expect(result.metrics.qualityScore).toBeLessThanOrEqual(0.95);
      expect(result.metrics.costUsd).toBeGreaterThan(0);
    });

    it('should have different cost per model', async () => {
      const costs = new Map<string, number>();
      
      // Collect costs for different models
      for (let i = 0; i < 40; i++) {
        const result = await runMultiModelExperiment(
          `test-user-${i}`,
          'Test prompt'
        );
        
        if (!costs.has(result.variant)) {
          costs.set(result.variant, result.metrics.costPer1kTokens || 0);
        }
      }

      // Should have collected multiple models
      expect(costs.size).toBeGreaterThan(1);
      
      // Llama should be cheapest if we got it
      if (costs.has('llama')) {
        const llamaCost = costs.get('llama')!;
        Array.from(costs.entries()).forEach(([model, cost]) => {
          if (model !== 'llama') {
            expect(cost).toBeGreaterThanOrEqual(llamaCost);
          }
        });
      }
    });
  });
});
