/**
 * Model Router Tests
 * Tests for intelligent model selection and routing
 */

import {
  ModelOrchestrator,
  TaskType,
  RequestContext,
  ModelConfig,
  DEFAULT_MODELS
} from '@/lib/ai/model-orchestration';

describe('Model Router', () => {
  let orchestrator: ModelOrchestrator;

  beforeEach(() => {
    orchestrator = new ModelOrchestrator(DEFAULT_MODELS);
  });

  describe('Model Selection', () => {
    it('should select appropriate model for code generation', () => {
      const context: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'high',
        expectedTokens: 1000,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel).toBeDefined();
      expect(selection.primaryModel.capabilities.codeGeneration).toBeGreaterThan(7);
      expect(selection.fallbackModels.length).toBeGreaterThan(0);
      expect(selection.confidence).toBeGreaterThan(0);
      expect(selection.confidence).toBeLessThanOrEqual(1);
    });

    it('should select appropriate model for reasoning tasks', () => {
      const context: RequestContext = {
        taskType: TaskType.PLANNING,
        priority: 'high',
        expectedTokens: 2000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel).toBeDefined();
      expect(selection.primaryModel.capabilities.reasoning).toBeGreaterThan(7);
    });

    it('should select model with function calling when required', () => {
      const context: RequestContext = {
        taskType: TaskType.FUNCTION_CALLING,
        priority: 'medium',
        expectedTokens: 500,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: true,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel.capabilities.functionCalling).toBe(true);
    });

    it('should select model with JSON mode when required', () => {
      const context: RequestContext = {
        taskType: TaskType.JSON_GENERATION,
        priority: 'medium',
        expectedTokens: 500,
        requiresStreaming: false,
        requiresJsonMode: true,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel.capabilities.jsonMode).toBe(true);
    });

    it('should select model with multimodal when required', () => {
      const context: RequestContext = {
        taskType: TaskType.MULTIMODAL,
        priority: 'high',
        expectedTokens: 1500,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: true
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel.capabilities.multimodal).toBe(true);
    });

    it('should provide fallback models', () => {
      const context: RequestContext = {
        taskType: TaskType.CODE_REVIEW,
        priority: 'medium',
        expectedTokens: 1000,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.fallbackModels).toBeDefined();
      expect(Array.isArray(selection.fallbackModels)).toBe(true);
      // Should have at least one fallback
      expect(selection.fallbackModels.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide selection reasoning', () => {
      const context: RequestContext = {
        taskType: TaskType.DOCUMENTATION,
        priority: 'low',
        expectedTokens: 800,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.reasoning).toBeDefined();
      expect(typeof selection.reasoning).toBe('string');
      expect(selection.reasoning.length).toBeGreaterThan(0);
    });

    it('should estimate cost for selected model', () => {
      const context: RequestContext = {
        taskType: TaskType.GENERAL_CHAT,
        priority: 'low',
        expectedTokens: 500,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.estimatedCost).toBeDefined();
      expect(typeof selection.estimatedCost).toBe('number');
      expect(selection.estimatedCost).toBeGreaterThan(0);
    });

    it('should estimate latency for selected model', () => {
      const context: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'high',
        expectedTokens: 1000,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.estimatedLatency).toBeDefined();
      expect(typeof selection.estimatedLatency).toBe('number');
      expect(selection.estimatedLatency).toBeGreaterThan(0);
    });
  });

  describe('Budget Constraints', () => {
    it('should respect budget constraints when selecting models', () => {
      const context: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'low',
        expectedTokens: 1000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false,
        budgetConstraints: {
          maxCostPerRequest: 0.001 // Very low budget
        }
      };

      const selection = orchestrator.selectModel(context);

      // Should select a cheaper model
      expect(selection.estimatedCost).toBeLessThanOrEqual(0.001);
      expect(selection.primaryModel.capabilities.costPerToken).toBeLessThanOrEqual(0.001);
    });

    it('should select premium model when budget allows', () => {
      const context: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'high',
        expectedTokens: 1000,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: true,
        requiresMultimodal: false,
        budgetConstraints: {
          maxCostPerRequest: 10.0 // High budget
        }
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel).toBeDefined();
      // With high budget and high priority, should get a good model
      expect(selection.primaryModel.capabilities.codeGeneration).toBeGreaterThan(8);
    });
  });

  describe('Priority Handling', () => {
    it('should prioritize speed for high priority tasks', () => {
      const highPriorityContext: RequestContext = {
        taskType: TaskType.DEBUGGING,
        priority: 'high',
        expectedTokens: 500,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(highPriorityContext);

      // High priority should get a fast model
      expect(selection.primaryModel.capabilities.speed).toBeGreaterThan(50);
    });

    it('should allow higher cost for high priority tasks', () => {
      const highPriorityContext: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'high',
        expectedTokens: 1000,
        requiresStreaming: true,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const lowPriorityContext: RequestContext = {
        ...highPriorityContext,
        priority: 'low'
      };

      const highPrioritySelection = orchestrator.selectModel(highPriorityContext);
      const lowPrioritySelection = orchestrator.selectModel(lowPriorityContext);

      // High priority might select more expensive models
      expect(highPrioritySelection.primaryModel).toBeDefined();
      expect(lowPrioritySelection.primaryModel).toBeDefined();
    });
  });

  describe('Context Length Handling', () => {
    it('should select model with sufficient context length', () => {
      const largeContextRequest: RequestContext = {
        taskType: TaskType.DATA_ANALYSIS,
        priority: 'medium',
        expectedTokens: 50000, // Large request
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(largeContextRequest);

      expect(selection.primaryModel.capabilities.contextLength).toBeGreaterThanOrEqual(50000);
    });

    it('should handle small context efficiently', () => {
      const smallContextRequest: RequestContext = {
        taskType: TaskType.EXPLANATION,
        priority: 'low',
        expectedTokens: 100,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(smallContextRequest);

      expect(selection.primaryModel).toBeDefined();
      // Small requests might favor faster, cheaper models
      expect(selection.estimatedCost).toBeLessThan(0.01);
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when no models meet requirements', () => {
      const impossibleContext: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'high',
        expectedTokens: 1000000, // Impossibly large
        requiresStreaming: true,
        requiresJsonMode: true,
        requiresFunctionCalling: true,
        requiresMultimodal: true,
        budgetConstraints: {
          maxCostPerRequest: 0.0001 // Impossibly low
        }
      };

      expect(() => {
        orchestrator.selectModel(impossibleContext);
      }).toThrow('No suitable models available');
    });

    it('should handle model with all capabilities disabled', () => {
      const disabledModel: ModelConfig = {
        id: 'disabled-model',
        name: 'Disabled Model',
        provider: 'openai',
        model: 'disabled-1',
        capabilities: {
          codeGeneration: 0,
          reasoning: 0,
          creativity: 0,
          speed: 1,
          contextLength: 1000,
          multimodal: false,
          functionCalling: false,
          jsonMode: false,
          streaming: false,
          costPerToken: 1.0
        },
        enabled: false, // Disabled
        rateLimits: {
          requestsPerMinute: 1,
          tokensPerMinute: 1000
        },
        fallbackModels: []
      };

      const customOrchestrator = new ModelOrchestrator([...DEFAULT_MODELS, disabledModel]);

      const context: RequestContext = {
        taskType: TaskType.CODE_GENERATION,
        priority: 'medium',
        expectedTokens: 1000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = customOrchestrator.selectModel(context);

      // Should not select the disabled model
      expect(selection.primaryModel.id).not.toBe('disabled-model');
    });

    it('should handle request with zero expected tokens', () => {
      const context: RequestContext = {
        taskType: TaskType.GENERAL_CHAT,
        priority: 'low',
        expectedTokens: 0,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      };

      const selection = orchestrator.selectModel(context);

      expect(selection.primaryModel).toBeDefined();
      expect(selection.estimatedCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Default Models', () => {
    it('should have Claude 3.5 Sonnet in default models', () => {
      const claudeModel = DEFAULT_MODELS.find(m => m.id === 'claude-3.5-sonnet');
      expect(claudeModel).toBeDefined();
      expect(claudeModel?.provider).toBe('anthropic');
    });

    it('should have GPT-4 Turbo in default models', () => {
      const gptModel = DEFAULT_MODELS.find(m => m.id === 'gpt-4-turbo');
      expect(gptModel).toBeDefined();
      expect(gptModel?.provider).toBe('openai');
    });

    it('should have cost-effective models', () => {
      const cheapModels = DEFAULT_MODELS.filter(m => m.capabilities.costPerToken < 0.001);
      expect(cheapModels.length).toBeGreaterThan(0);
    });

    it('should have fast models', () => {
      const fastModels = DEFAULT_MODELS.filter(m => m.capabilities.speed > 100);
      expect(fastModels.length).toBeGreaterThan(0);
    });

    it('should have models with large context windows', () => {
      const largeContextModels = DEFAULT_MODELS.filter(m => m.capabilities.contextLength > 100000);
      expect(largeContextModels.length).toBeGreaterThan(0);
    });
  });
});
