/**
 * Test suite for Tool-Augmented Generation (TAG) system
 */

import { 
  ToolRegistry, 
  EnhancedToolDefinition,
  ToolExecutionContext,
  ToolOrchestrator,
  IntentClassifier,
  TaskPlanner,
  createToolOrchestrator
} from '../../src/lib/agent-framework';

import {
  enhancedCodeExecutionTool,
  searchDocsTool,
  performanceProfilerTool,
  securityScannerTool
} from '../../src/lib/agent-framework/tools/tag-tools';

describe('TAG System', () => {
  let registry: ToolRegistry;
  let orchestrator: ToolOrchestrator;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    registry = new ToolRegistry();
    orchestrator = createToolOrchestrator(registry);
    
    mockContext = {
      agentId: 'test-agent',
      taskContext: {
        type: 'test-task',
        priority: 'medium',
        timeout: 30000,
      },
      resources: {
        cpu: 50,
        memory: 512,
        networkAccess: true,
      },
    };
  });

  describe('ToolRegistry', () => {
    it('should register and retrieve tools', () => {
      const mockTool: EnhancedToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => ({ result: 'test' }),
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'utility',
          complexity: 1,
          expectedDuration: 1000,
          resources: {
            cpu: 'low',
            memory: 'low',
            network: false,
          },
          stats: {
            totalCalls: 0,
            successRate: 1.0,
            averageDuration: 1000,
          },
          securityLevel: 'low',
        },
      };

      registry.registerTool(mockTool);
      
      const retrieved = registry.getTool('test_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
    });

    it('should filter tools by category', () => {
      const executionTool: EnhancedToolDefinition = {
        ...enhancedCodeExecutionTool,
        name: 'execution_tool',
      };
      
      const analysisToolDef: EnhancedToolDefinition = {
        ...performanceProfilerTool,
        name: 'analysis_tool',
      };

      registry.registerTool(executionTool);
      registry.registerTool(analysisToolDef);

      const executionTools = registry.getToolsByCategory('execution');
      const analysisTools = registry.getToolsByCategory('performance');

      expect(executionTools).toHaveLength(1);
      expect(analysisTools).toHaveLength(1);
      expect(executionTools[0].name).toBe('execution_tool');
      expect(analysisTools[0].name).toBe('analysis_tool');
    });

    it('should select tools based on criteria', () => {
      registry.registerTool(enhancedCodeExecutionTool);
      registry.registerTool(searchDocsTool);
      registry.registerTool(performanceProfilerTool);

      const selectedTools = registry.selectTools({
        categories: ['execution', 'search'],
        maxComplexity: 8,
        maxDuration: 10000,
      });

      expect(selectedTools.length).toBeGreaterThan(0);
      expect(selectedTools.every(tool => 
        ['execution', 'search'].includes(tool.metadata.category)
      )).toBe(true);
    });

    it('should respect rate limiting', async () => {
      const rateLimitedTool: EnhancedToolDefinition = {
        name: 'rate_limited_tool',
        description: 'Rate limited test tool',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => ({ result: 'test' }),
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'utility',
          complexity: 1,
          expectedDuration: 1000,
          resources: {
            cpu: 'low',
            memory: 'low',
            network: false,
          },
          stats: {
            totalCalls: 0,
            successRate: 1.0,
            averageDuration: 1000,
          },
          securityLevel: 'low',
        },
        rateLimit: {
          maxCalls: 1,
          timeWindow: 60000,
        },
      };

      registry.registerTool(rateLimitedTool);

      // First call should succeed
      const result1 = await registry.executeTool('rate_limited_tool', {}, mockContext);
      expect(result1.result).toBe('test');

      // Second call should fail due to rate limiting
      await expect(
        registry.executeTool('rate_limited_tool', {}, mockContext)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should update tool statistics', async () => {
      const testTool: EnhancedToolDefinition = {
        name: 'stats_tool',
        description: 'Tool for testing statistics',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => ({ result: 'success' }),
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'utility',
          complexity: 1,
          expectedDuration: 1000,
          resources: {
            cpu: 'low',
            memory: 'low',
            network: false,
          },
          stats: {
            totalCalls: 0,
            successRate: 0,
            averageDuration: 0,
          },
          securityLevel: 'low',
        },
      };

      registry.registerTool(testTool);

      await registry.executeTool('stats_tool', {}, mockContext);

      const stats = registry.getToolStats('stats_tool');
      expect(stats?.totalCalls).toBe(1);
      expect(stats?.successRate).toBe(1);
      expect(stats?.lastUsed).toBeDefined();
    });
  });

  describe('IntentClassifier', () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
      classifier = new IntentClassifier();
    });

    it('should classify code execution intent', () => {
      const intents = classifier.classifyIntent('execute this JavaScript code');
      
      expect(intents).toHaveLength(1);
      expect(intents[0].category).toBe('code');
      expect(intents[0].action).toBe('execute');
      expect(intents[0].confidence).toBeGreaterThan(0.7);
    });

    it('should classify performance analysis intent', () => {
      const intents = classifier.classifyIntent('analyze the performance of this code');
      
      expect(intents).toHaveLength(1);
      expect(intents[0].category).toBe('analysis');
      expect(intents[0].confidence).toBeGreaterThan(0.7);
    });

    it('should classify documentation search intent', () => {
      const intents = classifier.classifyIntent('find documentation for React hooks');
      
      expect(intents).toHaveLength(1);
      expect(intents[0].category).toBe('search');
      expect(intents[0].confidence).toBeGreaterThan(0.7);
    });

    it('should classify security scan intent', () => {
      const intents = classifier.classifyIntent('check security vulnerabilities');
      
      expect(intents).toHaveLength(1);
      expect(intents[0].category).toBe('security');
      expect(intents[0].confidence).toBeGreaterThan(0.7);
    });

    it('should extract context information', () => {
      const intents = classifier.classifyIntent('execute this Python code quickly');
      
      expect(intents).toHaveLength(1);
      expect(intents[0].context?.language).toBe('python');
      expect(intents[0].context?.priority).toBe('high');
    });

    it('should handle ambiguous input', () => {
      const intents = classifier.classifyIntent('help me with something');
      
      // Should either return empty array or very low confidence intents
      expect(intents.every(intent => intent.confidence < 0.5)).toBe(true);
    });
  });

  describe('TaskPlanner', () => {
    let planner: TaskPlanner;

    beforeEach(() => {
      planner = new TaskPlanner(registry);
      
      // Register test tools
      registry.registerTool(enhancedCodeExecutionTool);
      registry.registerTool(searchDocsTool);
      registry.registerTool(performanceProfilerTool);
      registry.registerTool(securityScannerTool);
    });

    it('should create a plan for code execution intent', () => {
      const intents = [{
        category: 'code' as const,
        action: 'execute',
        confidence: 0.9,
        context: { language: 'javascript' },
      }];

      const plan = planner.createPlan(intents, mockContext);

      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].toolName).toBe('execute_code');
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });

    it('should create a multi-step plan for optimization intent', () => {
      const intents = [{
        category: 'optimization' as const,
        action: 'optimize',
        confidence: 0.8,
        context: { language: 'javascript' },
      }];

      const plan = planner.createPlan(intents, mockContext);

      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(step => step.toolName === 'analyze_performance')).toBe(true);
      expect(plan.steps.some(step => step.toolName === 'check_security')).toBe(true);
    });

    it('should handle dependencies between steps', () => {
      const intents = [{
        category: 'optimization' as const,
        action: 'optimize',
        confidence: 0.8,
      }];

      const plan = planner.createPlan(intents, mockContext);

      const securityStep = plan.steps.find(step => step.toolName === 'check_security');
      expect(securityStep?.dependencies).toContain('analyze_performance');
    });
  });

  describe('ToolOrchestrator', () => {
    beforeEach(() => {
      // Register mock tools for testing
      const mockExecuteTool: EnhancedToolDefinition = {
        name: 'execute_code',
        description: 'Mock execute code tool',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' },
          },
        },
        execute: async ({ code, language }) => ({
          success: true,
          output: `Executed ${language} code: ${code}`,
          executionTime: 1000,
        }),
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'execution',
          complexity: 5,
          expectedDuration: 1000,
          resources: {
            cpu: 'medium',
            memory: 'medium',
            network: false,
          },
          stats: {
            totalCalls: 0,
            successRate: 1.0,
            averageDuration: 1000,
          },
          securityLevel: 'medium',
        },
      };

      const mockSearchTool: EnhancedToolDefinition = {
        name: 'search_docs',
        description: 'Mock search docs tool',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
        execute: async ({ query }) => ({
          results: [{ title: `Documentation for ${query}`, content: 'Mock content' }],
        }),
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'search',
          complexity: 2,
          expectedDuration: 500,
          resources: {
            cpu: 'low',
            memory: 'low',
            network: true,
          },
          stats: {
            totalCalls: 0,
            successRate: 1.0,
            averageDuration: 500,
          },
          securityLevel: 'low',
        },
      };

      registry.registerTool(mockExecuteTool);
      registry.registerTool(mockSearchTool);
    });

    it('should execute a simple task', async () => {
      const result = await orchestrator.executeTask(
        'execute this JavaScript code: console.log("hello")',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].toolName).toBe('execute_code');
      expect(result.summary).toContain('Successfully completed');
    });

    it('should handle task execution errors gracefully', async () => {
      // Register a tool that always fails
      const failingTool: EnhancedToolDefinition = {
        name: 'failing_tool',
        description: 'Tool that always fails',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool execution failed');
        },
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'utility',
          complexity: 1,
          expectedDuration: 1000,
          resources: { cpu: 'low', memory: 'low', network: false },
          stats: { totalCalls: 0, successRate: 0, averageDuration: 1000 },
          securityLevel: 'low',
        },
      };

      registry.registerTool(failingTool);

      // Create a plan that uses the failing tool
      const result = await orchestrator.executeTask('use failing tool', mockContext);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('failed');
    });

    it('should emit events during execution', (done) => {
      let eventsReceived = 0;
      const expectedEvents = ['intentsClassified', 'planCreated', 'taskCompleted'];

      expectedEvents.forEach(eventName => {
        orchestrator.on(eventName, () => {
          eventsReceived++;
          if (eventsReceived === expectedEvents.length) {
            done();
          }
        });
      });

      orchestrator.executeTask('execute code', mockContext);
    });

    it('should generate recommendations', async () => {
      const result = await orchestrator.executeTask('execute JavaScript code', mockContext);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('TAG Tool Integration', () => {
    it('should register all TAG tools successfully', () => {
      const tagTools = [
        enhancedCodeExecutionTool,
        searchDocsTool,
        performanceProfilerTool,
        securityScannerTool,
      ];

      tagTools.forEach(tool => {
        expect(() => registry.registerTool(tool)).not.toThrow();
      });

      expect(registry.getAllTools()).toHaveLength(tagTools.length);
    });

    it('should validate TAG tool metadata', () => {
      const tagTools = [
        enhancedCodeExecutionTool,
        searchDocsTool,
        performanceProfilerTool,
        securityScannerTool,
      ];

      tagTools.forEach(tool => {
        expect(tool.metadata).toBeDefined();
        expect(tool.metadata.category).toBeDefined();
        expect(tool.metadata.complexity).toBeGreaterThan(0);
        expect(tool.metadata.expectedDuration).toBeGreaterThan(0);
        expect(tool.metadata.resources).toBeDefined();
        expect(tool.metadata.stats).toBeDefined();
        expect(tool.metadata.securityLevel).toBeDefined();
      });
    });

    it('should handle tool execution timeouts', async () => {
      // Mock a tool that takes too long
      const slowTool: EnhancedToolDefinition = {
        name: 'slow_tool',
        description: 'Slow executing tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
          return { result: 'slow result' };
        },
        enabled: true,
        version: '1.0.0',
        metadata: {
          category: 'utility',
          complexity: 1,
          expectedDuration: 100, // Expected to be fast but actually slow
          resources: { cpu: 'low', memory: 'low', network: false },
          stats: { totalCalls: 0, successRate: 1.0, averageDuration: 100 },
          securityLevel: 'low',
        },
      };

      registry.registerTool(slowTool);

      // Set a short timeout context
      const shortTimeoutContext = {
        ...mockContext,
        taskContext: {
          ...mockContext.taskContext,
          timeout: 1000, // 1 second timeout
        },
      };

      // This should timeout and fail gracefully
      const startTime = Date.now();
      try {
        await registry.executeTool('slow_tool', {}, shortTimeoutContext);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(5000); // Should fail quickly, not wait 10 seconds
      }
    });
  });

  describe('Tool Registry Statistics', () => {
    beforeEach(() => {
      registry.registerTool(enhancedCodeExecutionTool);
      registry.registerTool(searchDocsTool);
      registry.registerTool(performanceProfilerTool);
    });

    it('should provide registry statistics', () => {
      const stats = registry.getRegistryStats();

      expect(stats.totalTools).toBe(3);
      expect(stats.enabledTools).toBe(3);
      expect(stats.toolsByCategory).toBeDefined();
      expect(stats.averageSuccessRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageSuccessRate).toBeLessThanOrEqual(1);
    });

    it('should track tool usage over time', async () => {
      const initialStats = registry.getToolStats('execute_code');
      expect(initialStats?.totalCalls).toBe(0);

      // Execute tool multiple times
      for (let i = 0; i < 3; i++) {
        try {
          await registry.executeTool('execute_code', {
            code: 'console.log("test")',
            language: 'javascript',
          }, mockContext);
        } catch (error) {
          // Expected to fail in test environment, but should still update stats
        }
      }

      const updatedStats = registry.getToolStats('execute_code');
      expect(updatedStats?.totalCalls).toBe(3);
    });
  });
});

// Mock implementations for testing
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 100);
      }
    }),
    kill: jest.fn(),
  })),
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    chmod: jest.fn(),
    rm: jest.fn(),
  },
}));

// Mock fetch for documentation search
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      results: [
        {
          title: 'Mock Documentation',
          content: 'Mock content',
          url: 'https://example.com/docs',
          category: 'api',
          score: 0.9,
          headings: [],
        },
      ],
    }),
  })
) as jest.Mock;