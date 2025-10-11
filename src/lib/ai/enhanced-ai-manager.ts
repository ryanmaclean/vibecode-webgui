import { MultiAgentWorkflow, WorkflowStep, WorkflowResult } from './agents/multi-agent-workflow';
import { PGVectorClient, COLLECTION_SCHEMAS } from './vector-stores/pgvector-client';
import { OllamaClient, createOllamaClient, OLLAMA_MODELS } from './local/ollama-client';
<<<<<<< HEAD
// Temporarily disabled to fix build issues - TODO: Fix LangChain compatibility
=======
>>>>>>> fix/consolidated-dependency-updates
// import { ChatOpenAI } from '@langchain/openai';
// import { PromptTemplate } from '@langchain/core/prompts';
// import { RunnableSequence } from '@langchain/core/runnables';
// import { StringOutputParser } from '@langchain/core/output_parsers';
// import { OpenAIEmbeddings } from '@langchain/openai';
// Define a concrete type for recommendations
export interface ModelRecommendation {
  name: string;
  provider: 'ollama' | 'openai';
  description: string;
  suitability: number; // 0-1
}
import { FunctionDefinition } from '../services/function-calling';
<<<<<<< HEAD
=======
// import { SystemMessage, HumanMessage } from '@langchain/core/messages';
>>>>>>> fix/consolidated-dependency-updates

export interface AIProviderConfig {
  openai?: {
    apiKey: string;
    model?: string;
    temperature?: number;
  };
  ollama?: {
    baseUrl: string;
    model: string;
    temperature?: number;
  };
  pgvector?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
}

export interface AIWorkflowRequest {
  type: 'code-generation' | 'code-review' | 'documentation' | 'custom';
  requirements: string;
  language?: string;
  framework?: string;
  customSteps?: WorkflowStep[];
  useLocalAI?: boolean;
  outputFormat?: 'text' | 'json' | 'structured';
}

export interface AIWorkflowResponse {
  success: boolean;
  results: WorkflowResult[];
  metadata: {
    totalDuration: number;
    modelsUsed: string[];
    tokensUsed?: number;
    cost?: number;
  };
  error?: string;
}

export class EnhancedAIManager {
  private multiAgentWorkflow: MultiAgentWorkflow;
  private pgvectorClient?: PGVectorClient;
  private ollamaClient?: OllamaClient;
  private openaiClient?: any; // ChatOpenAI - temporarily stubbed
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.initializeComponents();
  }

  private async initializeComponents() {
    try {
      // Initialize multi-agent workflow
      this.multiAgentWorkflow = new MultiAgentWorkflow();

      // Initialize PGVector if configured
      if (this.config.pgvector) {
        this.pgvectorClient = new PGVectorClient(this.config.pgvector);
        
        // Initialize database and create default collections
        try {
          await this.pgvectorClient.initialize();
          console.log('✅ PGVector database initialized successfully');
          
          // Create default collections
          await this.pgvectorClient.createCollection(COLLECTION_SCHEMAS.DOCUMENTS);
          await this.pgvectorClient.createCollection(COLLECTION_SCHEMAS.CODE_SNIPPETS);
        } catch (error) {
          console.warn('⚠️ PGVector initialization failed, falling back to local storage:', error);
        }
      }

      // Initialize Ollama if configured
      if (this.config.ollama) {
        this.ollamaClient = createOllamaClient(this.config.ollama.model, {
          baseUrl: this.config.ollama.baseUrl,
          temperature: this.config.ollama.temperature
        });

        // Test connection
        if (await this.ollamaClient.healthCheck()) {
          console.log('✅ Ollama connected successfully');
          
          // List available models
          const models = await this.ollamaClient.listModels();
          console.log(`📚 Available Ollama models: ${models.map(m => m.name).join(', ')}`);
        } else {
          console.warn('⚠️ Ollama connection failed, falling back to OpenAI');
        }
      }

      // Initialize OpenAI if configured
      if (this.config.openai) {
        // Temporarily stubbed - TODO: Fix LangChain compatibility
        this.openaiClient = null; // new ChatOpenAI({
        //   openAIApiKey: this.config.openai.apiKey,
        //   modelName: this.config.openai.model || 'gpt-4',
        //   temperature: this.config.openai.temperature || 0.1,
        // });
        console.log('✅ OpenAI client initialized (stubbed)');
      }

    } catch (error) {
      console.error('❌ Failed to initialize AI components:', error);
    }
  }

  /**
   * Execute an AI workflow
   */
  async executeWorkflow(request: AIWorkflowRequest): Promise<AIWorkflowResponse> {
    const startTime = Date.now();
    const modelsUsed: string[] = [];
    const tokensUsed = 0;
    const cost = 0;

    try {
      let steps: WorkflowStep[];

      // Determine workflow steps based on type
      switch (request.type) {
        case 'code-generation':
          steps = MultiAgentWorkflow.createCodeGenerationWorkflow(request.requirements);
          break;
        case 'code-review':
          steps = MultiAgentWorkflow.createCodeReviewWorkflow(request.requirements, request.language || 'typescript');
          break;
        case 'documentation':
          steps = this.createDocumentationWorkflow(request.requirements, request.language);
          break;
        case 'custom':
          steps = request.customSteps || [];
          break;
        default:
          throw new Error(`Unknown workflow type: ${request.type}`);
      }

      // Execute the workflow
      const results = await this.multiAgentWorkflow.executeWorkflow(steps);

      // Calculate metadata
      const totalDuration = Date.now() - startTime;
      results.forEach(result => {
        modelsUsed.push(result.metadata.model);
        // Note: Token counting would require integration with OpenAI's usage API
      });

      return {
        success: true,
        results,
        metadata: {
          totalDuration,
          modelsUsed: [...new Set(modelsUsed)], // Remove duplicates
          tokensUsed,
          cost
        }
      };

    } catch (error) {
      return {
        success: false,
        results: [],
        metadata: {
          totalDuration: Date.now() - startTime,
          modelsUsed,
          tokensUsed,
          cost
        },
        error: error.message
      };
    }
  }

  /**
   * Create a documentation generation workflow
   */
  private createDocumentationWorkflow(content: string, language?: string): WorkflowStep[] {
    return [
      {
        id: 'analyze-content',
        agentRole: 'code-reviewer',
        input: `Analyze the following ${language || 'code'} content and identify key components that need documentation:\n\n${content}\n\nProvide a structured analysis of what should be documented.`,
        dependencies: []
      },
      {
        id: 'generate-documentation',
        agentRole: 'frontend-developer',
        input: `Based on the analysis, generate comprehensive documentation for the ${language || 'code'} content. Include:\n- Function/class descriptions\n- Parameter documentation\n- Usage examples\n- Best practices\n- Common pitfalls`,
        dependencies: ['analyze-content']
      },
      {
        id: 'review-documentation',
        agentRole: 'code-reviewer',
        input: `Review the generated documentation for accuracy, completeness, and clarity. Suggest improvements and identify any missing information.`,
        dependencies: ['generate-documentation']
      }
    ];
  }

  /**
   * Search for relevant code or documentation
   */
  async searchContent(
    query: string,
    collection: 'documents' | 'code-snippets' = 'documents',
    options: {
      limit?: number;
      useHybrid?: boolean;
      filters?: Record<string, any>;
    } = {}
  ) {
    if (!this.pgvectorClient) {
      throw new Error('PGVector client not configured');
    }

    const collectionName = collection === 'documents' ? 'documents' : 'code_snippets';
    
    try {
      throw new Error('SemanticSearch temporarily disabled due to build issues');
    } catch (error) {
      console.error('Content search failed:', error);
      throw error;
    }
  }

  /**
   * Add content to the vector database
   */
  async addContent(
    collection: 'documents' | 'code-snippets',
    content: string,
    metadata: Record<string, any>
  ) {
    if (!this.pgvectorClient) {
      throw new Error('PGVector client not configured');
    }

    const collectionName = collection === 'documents' ? 'documents' : 'code_snippets';
    
    try {
      throw new Error('SemanticSearch temporarily disabled due to build issues');
    } catch (error) {
      console.error('Failed to add content to vector database:', error);
      throw error;
    }
  }

  /**
   * Generate code using local AI (Ollama) or cloud AI (OpenAI)
   */
  async generateCode(
    prompt: string,
    options: {
      language?: string;
      framework?: string;
      useLocalAI?: boolean;
      temperature?: number;
    } = {}
  ) {
    const { language = 'typescript', framework, useLocalAI = false, temperature } = options;

    try {
      // Try local AI first if requested and available
      if (useLocalAI && this.ollamaClient) {
        const enhancedPrompt = `Generate ${language} code${framework ? ` using ${framework}` : ''} for the following requirements:\n\n${prompt}\n\nProvide complete, production-ready code with proper error handling and documentation.`;
        
        const response = await this.ollamaClient.executePrompt(enhancedPrompt, {
          language,
          framework: framework || 'none'
        });

        return {
          code: response,
          model: 'ollama',
          provider: 'local'
        };
      }

      // Fallback to OpenAI
      if (this.openaiClient) {
        const enhancedPrompt = `Generate ${language} code${framework ? ` using ${framework}` : ''} for the following requirements:\n\n${prompt}\n\nProvide complete, production-ready code with proper error handling and documentation.`;
        
<<<<<<< HEAD
        const response = await this.openaiClient.invoke([
          { role: "system", content: `You are a senior ${language} developer. Generate clean, maintainable, and well-documented code.` },
          { role: "user", content: enhancedPrompt }
        ]);
=======
        // @ts-ignore - Direct message format for ChatOpenAI
        const response = await this.openaiClient.invoke([
          { role: "system", content: `You are a senior ${language} developer. Generate clean, maintainable, and well-documented code.` },
          { role: "user", content: enhancedPrompt }        ]);
>>>>>>> fix/consolidated-dependency-updates

        return {
          code: response.content,
          model: this.config.openai?.model || 'gpt-4',
          provider: 'openai'
        };
      }

      throw new Error('No AI provider available');

    } catch (error) {
      throw new Error(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Create a simple chain for basic tasks
   */
  createSimpleChain(
    systemPrompt: string,
    useLocalAI: boolean = false
<<<<<<< HEAD
  ): any {
    throw new Error('createSimpleChain temporarily disabled due to build issues');
  }
=======
  ): RunnableSequence<any, any> {
    const prompt = PromptTemplate.fromTemplate('{input}');
    const outputParser = new StringOutputParser();

    let model: ChatOpenAI;

    if (useLocalAI && this.ollamaClient) {
      model = this.ollamaClient.createLangChainClient();
    } else if (this.openaiClient) {
      model = this.openaiClient;
    } else {
      throw new Error('No AI provider available');
    }

    try {
      // @ts-ignore - Type issue with RunnableSequence in current LangChain version
      return RunnableSequence.from([
        prompt,
        model,
        outputParser,
      ]);
    } catch (error) {
      console.error('Failed to create chain:', error);
      throw new Error('Failed to create AI chain');
    }  }
>>>>>>> fix/consolidated-dependency-updates

  /**
   * Get system status and health
   */
  async getSystemStatus() {
    const status = {
      pgvector: false,
      ollama: false,
      openai: false,
      models: [] as string[],
      collections: [] as string[]
    };

    try {
      // Check PGVector
      if (this.pgvectorClient) {
        status.pgvector = await this.pgvectorClient.healthCheck();
        if (status.pgvector) {
          status.collections = await this.pgvectorClient.listCollections();
        }
      }

      // Check Ollama
      if (this.ollamaClient) {
        status.ollama = await this.ollamaClient.healthCheck();
        if (status.ollama) {
          const models = await this.ollamaClient.listModels();
          status.models = models.map(m => m.name);
        }
      }

      // Check OpenAI
      if (this.openaiClient) {
        status.openai = true; // Assume working if client exists
      }

    } catch (error) {
      console.error('Error checking system status:', error);
    }

    return status;
  }

   /**
    * Get recommended AI models for specific tasks
    */
   getRecommendedModels(task: string): ModelRecommendation[] {
     const recommendations: ModelRecommendation[] = [];

     // Add Ollama models if available
     if (this.ollamaClient) {
       Object.entries(OLLAMA_MODELS).forEach(([_key, model]) => {
         let suitability = 0.5; // Base suitability

         // Adjust based on task
         if (task.includes('code') && model.recommendedUse.includes('code generation')) {
           suitability = 0.9;
         } else if (task.includes('review') && model.recommendedUse.includes('code review')) {
           suitability = 0.8;
         } else if (task.includes('documentation')) {
           suitability = 0.7;
         }

         recommendations.push({
           name: model.name,
           provider: 'ollama',
           description: model.description,
           suitability
         });
       });
     }

     // Add OpenAI models if available
     if (this.openaiClient) {
       const openaiModels = [
         { name: 'gpt-4', description: 'Most capable model for complex tasks', suitability: 0.9 },
         { name: 'gpt-3.5-turbo', description: 'Fast and cost-effective for most tasks', suitability: 0.7 }
       ];

       openaiModels.forEach(model => {
         recommendations.push({
           name: model.name,
           provider: 'openai',
           description: model.description,
           suitability: model.suitability
         });
       });
     }

     // Sort by suitability
     return recommendations.sort((a, b) => b.suitability - a.suitability);
<<<<<<< HEAD
   }
}
=======
   }}
>>>>>>> fix/consolidated-dependency-updates

// Factory function to create enhanced AI manager
export function createEnhancedAIManager(config: AIProviderConfig): EnhancedAIManager {
  return new EnhancedAIManager(config);
}

export default EnhancedAIManager;
