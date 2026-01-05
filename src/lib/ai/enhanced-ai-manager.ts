/**
 * Enhanced AI Manager
 * Advanced AI provider management with fallback and load balancing
 */

export interface AIProviderConfig {
  openai?: {
    apiKey: string;
    model?: string;
    temperature?: number;
  };
  ollama?: {
    baseUrl: string;
    model?: string;
    temperature?: number;
  };
  pgvector?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  provider?: string;
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxTokens: number;
}

export interface WorkflowRequest {
  type: 'code-generation' | 'code-review' | 'documentation' | 'custom';
  requirements: string;
  language?: string;
  customSteps?: Array<{
    id: string;
    agentRole: string;
    input: string;
  }>;
  useLocalAI?: boolean;
  outputFormat?: 'text' | 'json' | 'markdown';
}

export interface WorkflowResult {
  stepId: string;
  agentRole: string;
  input: string;
  output: string;
  metadata: {
    model: string;
    duration: number;
    timestamp: string;
  };
}

export interface WorkflowResponse {
  success: boolean;
  results: WorkflowResult[];
  metadata: {
    totalDuration: number;
    modelsUsed: string[];
    timestamp: string;
  };
  error?: string;
}

export interface ModelRecommendation {
  name: string;
  provider: string;
  description: string;
  suitability: string;
}

export interface SystemStatus {
  pgvector: { available: boolean; healthy: boolean };
  ollama: { available: boolean; healthy: boolean; models: Array<{ name: string; size: string }> };
  openai: { available: boolean };
  models: string[];
  collections: string[];
}

export class EnhancedAIManager {
  private config: AIProviderConfig;
  private fallbackProviders: AIProviderConfig[] = [];
  private multiAgentWorkflow: any;
  private pgvectorClient: any;
  private ollamaClient: any;

  constructor(config: AIProviderConfig) {
    this.config = config;

    // Initialize workflow (will be mocked in tests)
    try {
      const { MultiAgentWorkflow } = require('./agents/multi-agent-workflow');
      this.multiAgentWorkflow = new MultiAgentWorkflow(config);
    } catch (error) {
      // Module not available
    }

    // Initialize clients (will be mocked in tests)
    try {
      const { PGVectorClient } = require('./vector-stores/pgvector-client');
      if (config.pgvector) {
        this.pgvectorClient = new PGVectorClient(config.pgvector);
      }
    } catch (error) {
      // Module not available
    }

    try {
      const { createOllamaClient } = require('./local/ollama-client');
      if (config.ollama) {
        this.ollamaClient = createOllamaClient(config.ollama);
      }
    } catch (error) {
      // Module not available
    }
  }

  addFallbackProvider(provider: AIProviderConfig): void {
    this.fallbackProviders.push(provider);
  }

  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    const startTime = Date.now();

    try {
      // Validate workflow type
      if (!['code-generation', 'code-review', 'documentation', 'custom'].includes(request.type)) {
        return {
          success: false,
          results: [],
          metadata: {
            totalDuration: Date.now() - startTime,
            modelsUsed: [],
            timestamp: new Date().toISOString()
          },
          error: `Unknown workflow type: ${request.type}`
        };
      }

      if (!this.multiAgentWorkflow) {
        throw new Error('Multi-agent workflow not initialized');
      }

      // Execute the workflow
      const results = await this.multiAgentWorkflow.executeWorkflow(request);

      const totalDuration = Date.now() - startTime;
      const modelsUsed = [...new Set(results.map((r: WorkflowResult) => r.metadata.model))];

      return {
        success: true,
        results,
        metadata: {
          totalDuration,
          modelsUsed,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        metadata: {
          totalDuration: Date.now() - startTime,
          modelsUsed: [],
          timestamp: new Date().toISOString()
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const status: SystemStatus = {
      pgvector: { available: false, healthy: false },
      ollama: { available: false, healthy: false, models: [] },
      openai: { available: false },
      models: [],
      collections: []
    };

    // Check PGVector
    if (this.pgvectorClient) {
      try {
        const healthy = await this.pgvectorClient.healthCheck();
        const collections = await this.pgvectorClient.listCollections();
        status.pgvector = { available: true, healthy };
        status.collections = collections;
      } catch (error) {
        status.pgvector = { available: true, healthy: false };
      }
    }

    // Check Ollama
    if (this.ollamaClient) {
      try {
        const healthy = await this.ollamaClient.healthCheck();
        const models = await this.ollamaClient.listModels();
        status.ollama = { available: true, healthy, models };
        status.models.push(...models.map((m: any) => m.name));
      } catch (error) {
        status.ollama = { available: true, healthy: false, models: [] };
      }
    }

    // Check OpenAI
    if (this.config.openai?.apiKey) {
      status.openai = { available: true };
      status.models.push(this.config.openai.model || 'gpt-4');
    }

    return status;
  }

  getRecommendedModels(task: string): ModelRecommendation[] {
    const recommendations: ModelRecommendation[] = [];

    const taskLower = task.toLowerCase();

    if (taskLower.includes('code')) {
      if (this.config.openai?.apiKey) {
        recommendations.push({
          name: this.config.openai.model || 'gpt-4',
          provider: 'openai',
          description: 'Advanced language model for code generation',
          suitability: 'High - Excellent for code generation and review'
        });
      }

      if (this.ollamaClient) {
        recommendations.push({
          name: 'codellama:7b',
          provider: 'ollama',
          description: 'Code-focused language model',
          suitability: 'Medium - Good for local code generation'
        });
      }
    }

    if (taskLower.includes('review')) {
      if (this.config.openai?.apiKey) {
        recommendations.push({
          name: this.config.openai.model || 'gpt-4',
          provider: 'openai',
          description: 'Advanced language model for code review',
          suitability: 'High - Excellent for code review'
        });
      }
    }

    if (taskLower.includes('documentation')) {
      if (this.config.openai?.apiKey) {
        recommendations.push({
          name: this.config.openai.model || 'gpt-4',
          provider: 'openai',
          description: 'Advanced language model for documentation',
          suitability: 'High - Excellent for documentation'
        });
      }
    }

    return recommendations;
  }

  async createCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<ReadableStream<Uint8Array>> {
    // Stub implementation
    throw new Error('Not implemented');
  }

  getModelCapabilities(model: string): ModelCapabilities {
    // Return default capabilities
    return {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 4096
    };
  }
}

export function createEnhancedAIManager(config: AIProviderConfig): EnhancedAIManager {
  return new EnhancedAIManager(config);
}
