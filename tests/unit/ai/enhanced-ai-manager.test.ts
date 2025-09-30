import { EnhancedAIManager, createEnhancedAIManager } from '@/lib/ai/enhanced-ai-manager';
import { MultiAgentWorkflow } from '@/lib/ai/agents/multi-agent-workflow';
import { AgentOrchestrator } from '@/lib/ai/agent-orchestrator';

// Mock the external dependencies
jest.mock('@/lib/ai/agents/multi-agent-workflow');
jest.mock('@/lib/ai/agent-orchestrator');
jest.mock('@/lib/ai/vector-stores/pgvector-client', () => ({
  PGVectorClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    createCollection: jest.fn().mockResolvedValue(true),
    listCollections: jest.fn().mockResolvedValue(['documents', 'code_snippets']),
    healthCheck: jest.fn().mockResolvedValue(true)
  })),
  COLLECTION_SCHEMAS: {
    DOCUMENTS: { name: 'documents', properties: {} },
    CODE_SNIPPETS: { name: 'code_snippets', properties: {} }
  }
}));
jest.mock('@/lib/ai/local/ollama-client', () => ({
  createOllamaClient: jest.fn().mockImplementation(() => ({
    healthCheck: jest.fn().mockResolvedValue(true),
    listModels: jest.fn().mockResolvedValue([
      { name: 'codellama:7b', size: '4GB' },
      { name: 'llama3:8b', size: '5GB' }
    ])
  })),
  OllamaClient: jest.fn().mockImplementation(() => ({
    healthCheck: jest.fn().mockResolvedValue(true),
    listModels: jest.fn().mockResolvedValue([
      { name: 'codellama:7b', size: '4GB' },
      { name: 'llama3:8b', size: '5GB' }
    ])
  })),
  OLLAMA_MODELS: {
    CODE_LLAMA: {
      name: 'codellama:7b',
      description: 'Code-focused language model for programming tasks',
      recommendedUse: ['code generation', 'code review', 'debugging'],
      requirements: { ram: '8GB', gpu: 'Optional', storage: '4GB' }
    },
    LLAMA3: {
      name: 'llama3:8b',
      description: 'General-purpose language model for various tasks',
      recommendedUse: ['text generation', 'conversation', 'analysis'],
      requirements: { ram: '8GB', gpu: 'Optional', storage: '5GB' }
    }
  }
}));

describe('EnhancedAIManager', () => {
  let aiManager: EnhancedAIManager;
  let mockConfig: any;
  let mockOrchestrator: jest.Mocked<AgentOrchestrator>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      openai: {
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.1
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'codellama:7b',
        temperature: 0.1
      },
      pgvector: {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'test',
        password: 'test'
      }
    };

    // Mock AgentOrchestrator
    mockOrchestrator = {
      createOrchestrationPlan: jest.fn().mockResolvedValue({
        id: 'test-plan-id',
        goal: 'test goal',
        steps: [],
        parallelGroups: [[]],
        totalEstimatedTime: 60,
        resourceRequirements: { totalMemory: 512, peakConcurrency: 2 },
        validationPlan: []
      }),
      executeOrchestrationPlan: jest.fn().mockResolvedValue(new Map([
        ['test-step', {
          stepId: 'test-step',
          agentRole: 'architect',
          input: 'test input',
          output: 'test output',
          metadata: {
            model: 'gpt-4',
            duration: 1000,
            timestamp: new Date().toISOString()
          }
        }]
      ])),
      getOrchestrationStatus: jest.fn().mockReturnValue({
        planId: 'test-plan-id',
        progress: 0.5,
        agentLoads: {}
      }),
      getSpecializedAgents: jest.fn().mockReturnValue([
        {
          name: 'architect',
          description: 'Software architect',
          specialization: ['system-design'],
          capabilities: [],
          performanceMetrics: { averageResponseTime: 120, successRate: 0.95, qualityScore: 0.92 },
          loadLimits: { maxConcurrentTasks: 2, maxQueueSize: 5 }
        }
      ]),
      getAgentMetrics: jest.fn().mockReturnValue({
        averageResponseTime: 120,
        successRate: 0.95,
        qualityScore: 0.92
      }),
      registerSpecializedAgent: jest.fn()
    } as any;

    // Mock createAgentOrchestrator
    (AgentOrchestrator as any).mockImplementation = jest.fn();
    require('@/lib/ai/agent-orchestrator').createAgentOrchestrator = jest.fn().mockReturnValue(mockOrchestrator);

    // Mock MultiAgentWorkflow
    (MultiAgentWorkflow as jest.MockedClass<typeof MultiAgentWorkflow>).mockImplementation(() => ({
      executeWorkflow: jest.fn().mockImplementation(async () => {
        // Add a small delay to ensure timing is measurable
        await new Promise(resolve => setTimeout(resolve, 10));
        return [
          {
            stepId: 'test-step',
            agentRole: 'test-agent',
            input: 'test input',
            output: 'test output',
            metadata: {
              model: 'gpt-4',
              duration: 1000,
              timestamp: new Date().toISOString()
            }
          }
        ];
      }),
      getResult: jest.fn(),
      getAllResults: jest.fn(),
      clearResults: jest.fn(),
      addAgentRole: jest.fn()
    }));

    aiManager = new EnhancedAIManager(mockConfig);
  });

  describe('initialization', () => {
    it('should create an instance with configuration', () => {
      expect(aiManager).toBeInstanceOf(EnhancedAIManager);
    });

    it('should create an instance using factory function', () => {
      const manager = createEnhancedAIManager(mockConfig);
      expect(manager).toBeInstanceOf(EnhancedAIManager);
    });
  });

  describe('workflow execution', () => {
    it('should execute code generation workflow', async () => {
      const request = {
        type: 'code-generation' as const,
        requirements: 'Create a React component for user management'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.metadata.totalDuration).toBeGreaterThan(0);
      expect(result.metadata.modelsUsed).toContain('gpt-4');
    });

    it('should execute code review workflow', async () => {
      const request = {
        type: 'code-review' as const,
        requirements: 'Review this TypeScript code for best practices',
        language: 'typescript'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('should execute documentation workflow', async () => {
      const request = {
        type: 'documentation' as const,
        requirements: 'Generate documentation for this API',
        language: 'typescript'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('should execute custom workflow', async () => {
      const customSteps = [
        {
          id: 'custom-step',
          agentRole: 'test-agent',
          input: 'Custom input'
        }
      ];

      const request = {
        type: 'custom' as const,
        requirements: 'Custom requirements',
        customSteps
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('should handle workflow execution errors', async () => {
      // Mock the workflow to throw an error
      const mockWorkflow = (aiManager as any).multiAgentWorkflow;
      (mockWorkflow.executeWorkflow as jest.Mock).mockRejectedValue(new Error('Workflow failed'));

      const request = {
        type: 'code-generation' as const,
        requirements: 'This will fail'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow failed');
      expect(result.results).toHaveLength(0);
    });
  });

  describe('system status', () => {
    it('should return system status', async () => {
      const status = await aiManager.getSystemStatus();

      expect(status).toHaveProperty('pgvector');
      expect(status).toHaveProperty('ollama');
      expect(status).toHaveProperty('openai');
      expect(status).toHaveProperty('models');
      expect(status).toHaveProperty('collections');
    });
  });

  describe('model recommendations', () => {
    it('should return recommended models for code generation', () => {
      const recommendations = aiManager.getRecommendedModels('code generation');

      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('name');
        expect(recommendations[0]).toHaveProperty('provider');
        expect(recommendations[0]).toHaveProperty('description');
        expect(recommendations[0]).toHaveProperty('suitability');
      }
    });

    it('should return recommended models for code review', () => {
      const recommendations = aiManager.getRecommendedModels('code review');

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should return recommended models for documentation', () => {
      const recommendations = aiManager.getRecommendedModels('documentation');

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unknown workflow type', async () => {
      const request = {
        type: 'unknown' as any,
        requirements: 'Test requirements'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown workflow type');
    });

    it('should execute orchestrated workflow', async () => {
      const request = {
        type: 'orchestrated' as const,
        requirements: 'Create a comprehensive web application'
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.orchestrationPlan).toBeDefined();
      expect(result.metadata.orchestrationMetrics).toBeDefined();
      expect(mockOrchestrator.createOrchestrationPlan).toHaveBeenCalledWith(request.requirements);
      expect(mockOrchestrator.executeOrchestrationPlan).toHaveBeenCalled();
    });

    it('should execute workflow with orchestrated flag', async () => {
      const request = {
        type: 'code-generation' as const,
        requirements: 'Create a React component',
        orchestrated: true
      };

      const result = await aiManager.executeWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.orchestrationPlan).toBeDefined();
      expect(mockOrchestrator.createOrchestrationPlan).toHaveBeenCalled();
    });
  });

  describe('orchestrator integration', () => {
    it('should provide access to orchestrator', () => {
      const orchestrator = aiManager.getOrchestrator();
      expect(orchestrator).toBe(mockOrchestrator);
    });

    it('should get specialized agents', () => {
      const agents = aiManager.getSpecializedAgents();
      expect(mockOrchestrator.getSpecializedAgents).toHaveBeenCalled();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('architect');
    });

    it('should get agent metrics', () => {
      const metrics = aiManager.getAgentMetrics('architect');
      expect(mockOrchestrator.getAgentMetrics).toHaveBeenCalledWith('architect');
      expect(metrics).toBeDefined();
      expect(metrics.averageResponseTime).toBe(120);
    });

    it('should create orchestration plan', async () => {
      const goal = 'Build a microservices architecture';
      const plan = await aiManager.createOrchestrationPlan(goal);
      
      expect(mockOrchestrator.createOrchestrationPlan).toHaveBeenCalledWith(goal);
      expect(plan.id).toBe('test-plan-id');
      expect(plan.goal).toBe('test goal');
    });

    it('should execute orchestration plan', async () => {
      const planId = 'test-plan-id';
      const results = await aiManager.executeOrchestrationPlan(planId);
      
      expect(mockOrchestrator.executeOrchestrationPlan).toHaveBeenCalledWith(planId);
      expect(results).toBeInstanceOf(Map);
    });

    it('should get orchestration status', () => {
      const planId = 'test-plan-id';
      const status = aiManager.getOrchestrationStatus(planId);
      
      expect(mockOrchestrator.getOrchestrationStatus).toHaveBeenCalledWith(planId);
      expect(status.planId).toBe('test-plan-id');
    });
  });
});
