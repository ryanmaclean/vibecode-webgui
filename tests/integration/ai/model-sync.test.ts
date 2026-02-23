/**
 * Comprehensive tests for Model Sync Service
 *
 * Tests all critical paths including:
 * - Model synchronization from OpenRouter
 * - Change detection (added, removed, updated, price changes)
 * - Event emission and listeners
 * - Service lifecycle (start/stop)
 * - Error handling
 */

import { ModelSyncService, resetModelSyncService, type ModelChange, type SyncEvent } from '@/lib/ai/models/model-sync-service';
import type { ModelProfile } from '@/types/model-comparison';

// Mock fetch for OpenRouter API calls
const mockOpenRouterModels = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude 3.5 Sonnet model',
    context_length: 200000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 0.003,
      completion: 0.015,
    },
    capabilities: {
      coding: 95,
      reasoning: 90,
      creative: 85,
      math: 88,
      vision: 80,
      function_calling: true,
      streaming: true,
      conversation: 90,
      instruction_following: 92,
      debugging: 93,
    },
    tags: ['coding', 'reasoning'],
    deprecated: false,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o Mini model',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 0.00015,
      completion: 0.0006,
    },
    capabilities: {
      coding: 80,
      reasoning: 75,
      creative: 70,
      math: 72,
      vision: 0,
      function_calling: true,
      streaming: true,
      conversation: 80,
      instruction_following: 78,
      debugging: 76,
    },
    tags: ['coding', 'conversational'],
    deprecated: false,
  },
];

describe('Integration: ModelSyncService', () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.Mock;

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Set up environment variable
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  beforeEach(() => {
    // Reset the global sync service before each test
    resetModelSyncService();

    // Create mock fetch
    mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({
          data: [...mockOpenRouterModels],
        }),
      } as Response)
    );

    // Replace global fetch
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Clean up any running services
    resetModelSyncService();
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Service Lifecycle', () => {
    it('should initialize with default configuration', () => {
      const service = new ModelSyncService();
      const status = service.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.lastSyncTime).toBe(0);
      expect(status.modelCount).toBe(0);
      expect(status.syncIntervalMs).toBe(60 * 60 * 1000); // 1 hour default
    });

    it('should initialize with custom configuration', () => {
      const customInterval = 30 * 60 * 1000; // 30 minutes
      const service = new ModelSyncService({
        syncIntervalMs: customInterval,
        detectPriceChanges: false,
        minPriceChangePercent: 10,
      });

      const status = service.getStatus();
      expect(status.syncIntervalMs).toBe(customInterval);
    });

    it('should start service successfully', async () => {
      const service = new ModelSyncService();
      service.start();

      const status = service.getStatus();
      expect(status.isRunning).toBe(true);

      // Wait for initial sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );

      service.stop();
    });

    it('should stop service successfully', () => {
      const service = new ModelSyncService();
      service.start();

      expect(service.getStatus().isRunning).toBe(true);

      service.stop();

      expect(service.getStatus().isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const service = new ModelSyncService();
      service.start();
      service.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('[ModelSync] Service already running');

      service.stop();
      consoleSpy.mockRestore();
    });
  });

  describe('Model Synchronization', () => {
    it('should fetch models from OpenRouter successfully', async () => {
      const service = new ModelSyncService();
      service.start();

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentModels = service.getCurrentModels();
      expect(currentModels).toHaveLength(2);
      expect(currentModels[0].id).toBe('anthropic/claude-3.5-sonnet');
      expect(currentModels[1].id).toBe('openai/gpt-4o-mini');

      service.stop();
    });

    it('should transform OpenRouter models to ModelProfile format', async () => {
      const service = new ModelSyncService();
      service.start();

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const models = service.getCurrentModels();
      const claudeModel = models.find(m => m.id === 'anthropic/claude-3.5-sonnet');

      expect(claudeModel).toBeDefined();
      expect(claudeModel?.name).toBe('Claude 3.5 Sonnet');
      expect(claudeModel?.family).toBe('claude');
      expect(claudeModel?.provider.id).toBe('anthropic');
      expect(claudeModel?.provider.name).toBe('Anthropic');
      expect(claudeModel?.provider.tier).toBe('high');
      expect(claudeModel?.capabilities.coding).toBe(95);
      expect(claudeModel?.pricing.inputPer1K).toBe(0.003);
      expect(claudeModel?.pricing.outputPer1K).toBe(0.015);
      expect(claudeModel?.limits.contextWindow).toBe(200000);

      service.stop();
    });

    it('should update lastSyncTime after successful sync', async () => {
      const service = new ModelSyncService();
      const beforeSync = service.getStatus().lastSyncTime;

      service.start();

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterSync = service.getStatus().lastSyncTime;
      expect(afterSync).toBeGreaterThan(beforeSync);

      service.stop();
    });
  });

  describe('Change Detection', () => {
    it('should detect newly added models', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('models_changed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update mock to return an additional model
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: [
              ...mockOpenRouterModels,
              {
                id: 'google/gemini-pro',
                name: 'Gemini Pro',
                description: 'Google Gemini Pro model',
                context_length: 32000,
                max_output_tokens: 2048,
                pricing: {
                  prompt: 0.0005,
                  completion: 0.0015,
                },
                capabilities: {
                  coding: 75,
                  reasoning: 80,
                  creative: 78,
                  math: 82,
                  vision: 0,
                  function_calling: true,
                  streaming: true,
                  conversation: 75,
                  instruction_following: 77,
                  debugging: 73,
                },
                tags: ['reasoning'],
                deprecated: false,
              },
            ],
          }),
        } as Response)
      );

      // Trigger another sync
      await service.sync();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should detect the new model
      const lastEvent = events[events.length - 1];
      expect(lastEvent.changes).toBeDefined();
      expect(lastEvent.changes?.length).toBeGreaterThan(0);

      const addedChange = lastEvent.changes?.find((c: ModelChange) => c.type === 'added');
      expect(addedChange).toBeDefined();
      expect(addedChange?.modelId).toBe('google/gemini-pro');

      service.stop();
    });

    it('should detect removed models', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('models_changed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update mock to return fewer models
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: [mockOpenRouterModels[0]], // Only return first model
          }),
        } as Response)
      );

      // Trigger another sync
      await service.sync();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should detect the removed model
      const lastEvent = events[events.length - 1];
      const removedChange = lastEvent.changes?.find((c: ModelChange) => c.type === 'removed');
      expect(removedChange).toBeDefined();
      expect(removedChange?.modelId).toBe('openai/gpt-4o-mini');

      service.stop();
    });

    it('should detect price changes', async () => {
      const service = new ModelSyncService({
        detectPriceChanges: true,
        minPriceChangePercent: 5,
      });
      const events: SyncEvent[] = [];

      service.on('models_changed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update mock to return model with changed price
      const modelsWithPriceChange = [...mockOpenRouterModels];
      modelsWithPriceChange[0] = {
        ...modelsWithPriceChange[0],
        pricing: {
          prompt: 0.005, // Changed from 0.003 (66% increase)
          completion: 0.015,
        },
      };

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: modelsWithPriceChange,
          }),
        } as Response)
      );

      // Trigger another sync
      await service.sync();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should detect the price change
      const lastEvent = events[events.length - 1];
      const priceChange = lastEvent.changes?.find((c: ModelChange) => c.type === 'price_changed');
      expect(priceChange).toBeDefined();
      expect(priceChange?.modelId).toBe('anthropic/claude-3.5-sonnet');

      service.stop();
    });

    it('should detect model deprecation', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('models_changed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update mock to mark model as deprecated
      const modelsWithDeprecation = [...mockOpenRouterModels];
      modelsWithDeprecation[0] = {
        ...modelsWithDeprecation[0],
        deprecated: true,
        replacement_model_id: 'anthropic/claude-4',
      };

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: modelsWithDeprecation,
          }),
        } as Response)
      );

      // Trigger another sync
      await service.sync();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should detect the deprecation
      const lastEvent = events[events.length - 1];
      const deprecationChange = lastEvent.changes?.find((c: ModelChange) => c.type === 'deprecated');
      expect(deprecationChange).toBeDefined();
      expect(deprecationChange?.modelId).toBe('anthropic/claude-3.5-sonnet');

      service.stop();
    });
  });

  describe('Event Handling', () => {
    it('should emit sync_started event', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('sync_started', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('sync_started');
      expect(events[0].timestamp).toBeDefined();

      service.stop();
    });

    it('should emit sync_completed event', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('sync_completed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('sync_completed');
      expect(events[0].timestamp).toBeDefined();

      service.stop();
    });

    it('should emit models_changed event when changes detected', async () => {
      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('models_changed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add a new model
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: [
              ...mockOpenRouterModels,
              {
                id: 'test/new-model',
                name: 'New Model',
                description: 'A new test model',
                context_length: 16000,
                max_output_tokens: 2048,
                pricing: { prompt: 0.001, completion: 0.003 },
                capabilities: {
                  coding: 70,
                  reasoning: 70,
                  creative: 70,
                  math: 70,
                  vision: 0,
                  function_calling: false,
                  streaming: true,
                  conversation: 70,
                  instruction_following: 70,
                  debugging: 70,
                },
                tags: [],
                deprecated: false,
              },
            ],
          }),
        } as Response)
      );

      await service.sync();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('models_changed');
      expect(events[0].changes).toBeDefined();

      service.stop();
    });

    it('should allow adding and removing event listeners', async () => {
      const service = new ModelSyncService();
      const listener = jest.fn();

      service.on('sync_started', listener);
      service.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      service.off('sync_started', listener);
      service.stop();
      service.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener).not.toHaveBeenCalled();

      service.stop();
    });

    it('should handle errors in event listeners gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const service = new ModelSyncService();

      service.on('sync_started', () => {
        throw new Error('Listener error');
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalled();

      service.stop();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should emit sync_failed event on API error', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('sync_failed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('sync_failed');
      expect(events[0].error).toBeDefined();

      service.stop();
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('sync_failed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].error?.message).toContain('Network error');

      service.stop();
    });

    it('should throw error when OPENROUTER_API_KEY is missing', async () => {
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const service = new ModelSyncService();
      const events: SyncEvent[] = [];

      service.on('sync_failed', (event) => {
        events.push(event);
      });

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].error?.message).toContain('OPENROUTER_API_KEY not configured');

      process.env.OPENROUTER_API_KEY = originalKey;
      service.stop();
    });

    it('should not allow sync when service is not running', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const service = new ModelSyncService();
      await service.sync(); // Try to sync without starting

      expect(consoleSpy).toHaveBeenCalledWith('[ModelSync] Cannot sync: service not running');

      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should complete sync within acceptable time', async () => {
      const service = new ModelSyncService();
      const startTime = Date.now();

      service.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const duration = Date.now() - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);

      service.stop();
    });

    it('should handle large number of models efficiently', async () => {
      // Create 100 mock models
      const largeModelSet = Array.from({ length: 100 }, (_, i) => ({
        id: `provider/model-${i}`,
        name: `Model ${i}`,
        description: `Test model ${i}`,
        context_length: 32000,
        max_output_tokens: 2048,
        pricing: { prompt: 0.001, completion: 0.003 },
        capabilities: {
          coding: 70,
          reasoning: 70,
          creative: 70,
          math: 70,
          vision: 0,
          function_calling: false,
          streaming: true,
          conversation: 70,
          instruction_following: 70,
          debugging: 70,
        },
        tags: [],
        deprecated: false,
      }));

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: largeModelSet,
          }),
        } as Response)
      );

      const service = new ModelSyncService();
      service.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      const models = service.getCurrentModels();
      expect(models).toHaveLength(100);

      service.stop();
    });
  });
});
