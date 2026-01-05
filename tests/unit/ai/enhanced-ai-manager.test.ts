import { EnhancedAIManager, createEnhancedAIManager } from '@/lib/ai/enhanced-ai-manager';
import { MultiAgentWorkflow } from '@/lib/ai/agents/multi-agent-workflow';

// Mock the external dependencies
const mockExecuteWorkflow = jest.fn();
const mockGetResult = jest.fn();
const mockGetAllResults = jest.fn();
const mockClearResults = jest.fn();
const mockAddAgentRole = jest.fn();

jest.mock('@/lib/ai/agents/multi-agent-workflow', () => ({
  MultiAgentWorkflow: jest.fn().mockImplementation(() => ({
    executeWorkflow: mockExecuteWorkflow,
    getResult: mockGetResult,
    getAllResults: mockGetAllResults,
    clearResults: mockClearResults,
    addAgentRole: mockAddAgentRole
  }))
}));

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

    // Setup default mock behavior
    mockExecuteWorkflow.mockImplementation(async () => {
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
    });

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
      mockExecuteWorkflow.mockRejectedValueOnce(new Error('Workflow failed'));

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
  });
});
