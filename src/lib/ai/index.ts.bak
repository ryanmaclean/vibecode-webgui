// Core AI functionality
export * from './documentation/ingest';
export * from './documentation/sources';
export * from './prompts/manager';
export * from './prompts/templates';
export * from './search/vector-search';
export * from './analytics';

// Types
export type { Prompt } from './prompts/manager';
export type { SearchResult } from './search/vector-search';

// AI Integration Manager
import { VectorSearch } from './search/vector-search';
import { PromptManager } from './prompts/manager';
import { DocumentationSources } from './documentation/sources';
import { aiAnalytics } from './analytics';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { validateAIQuery, validatePrompt, aiRateLimiter, AISecurityLogger } from '../security/input-validator';

interface AIConfig {
  openAIApiKey?: string;
  chromaDbUrl?: string;
  enableAnalytics?: boolean;
}

export class AIIntegration {
  private static instance: AIIntegration;
  
  public readonly search: VectorSearch;
  public readonly prompts: PromptManager;
  public readonly docs: DocumentationSources;
  private readonly config: AIConfig;

  /**
   * Secure AI query method with input validation and rate limiting
   */
  async secureQuery(rawInput: unknown, userId: string = 'anonymous'): Promise<any> {
    try {
      // Rate limiting check
      if (!aiRateLimiter.checkRateLimit(userId)) {
        const remaining = aiRateLimiter.getRemainingQueries(userId);
        AISecurityLogger.logSuspiciousActivity(userId, 'RATE_LIMIT_EXCEEDED', { remaining });
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Input validation and sanitization
      const validatedInput = validateAIQuery(rawInput);
      
      // Perform the actual AI query with validated input
      const results = await this.search.semanticSearch(validatedInput.query, 'documentation');
      
      if (this.config.enableAnalytics) {
        aiAnalytics.logEvent('secure_ai_query', {
          userId,
          queryLength: validatedInput.query.length,
          resultsCount: results.length
        });
      }

      return results;
    } catch (error) {
      AISecurityLogger.logValidationFailure(
        userId,
        typeof rawInput === 'object' ? JSON.stringify(rawInput) : String(rawInput),
        error instanceof Error ? error.message : 'Unknown validation error'
      );
      throw error;
    }
  }

  /**
   * Secure prompt processing with validation
   */
  async securePromptProcessing(rawPrompt: unknown, userId: string = 'anonymous'): Promise<any> {
    try {
      const validatedPrompt = validatePrompt(rawPrompt);
      
      // Process the validated prompt
      const processedPrompt = await this.prompts.processPrompt(
        validatedPrompt.content,
        validatedPrompt.variables
      );

      if (this.config.enableAnalytics) {
        aiAnalytics.logEvent('secure_prompt_processing', {
          userId,
          promptLength: validatedPrompt.content.length,
          variableCount: Object.keys(validatedPrompt.variables || {}).length
        });
      }

      return processedPrompt;
    } catch (error) {
      AISecurityLogger.logValidationFailure(
        userId,
        typeof rawPrompt === 'object' ? JSON.stringify(rawPrompt) : String(rawPrompt),
        error instanceof Error ? error.message : 'Unknown validation error'
      );
      throw error;
    }
  }

  private constructor(config: AIConfig = {}) {
    this.config = {
      openAIApiKey: process.env.OPENAI_API_KEY,
      chromaDbUrl: process.env.CHROMA_DB_URL || 'http://localhost:8000',
      enableAnalytics: process.env.ENABLE_AI_ANALYTICS !== 'false',
      ...config
    };

    this.search = new VectorSearch();
    // Create a VectorStoreRetriever instance with proper typing
    const retriever = {
      getRelevantDocuments: async (query: string) => {
        const results = await this.search.semanticSearch(query, 'prompts');
        return results.map(result => new Document({
          pageContent: result.content,
          metadata: result.metadata || {}
        }));
      },
      addDocuments: async (documents: Document[]) => {
        await this.search.addDocuments(documents, 'prompts');
      }
    } as unknown as VectorStoreRetriever; // Type assertion to match the expected interface
    this.prompts = new PromptManager(retriever);
    this.docs = new DocumentationSources();
    
    // Initialize with default prompts
    this.initializeDefaultPrompts().catch(error => {
      console.error('Failed to initialize default prompts:', error);
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    
    // Set up error handling
    process.on('unhandledRejection', (reason, _promise) => {
      const error = new Error('Unhandled promise rejection');
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error, { reason: String(reason) });
      }
    });
  }

  public static getInstance(config?: AIConfig): AIIntegration {
    if (!AIIntegration.instance) {
      AIIntegration.instance = new AIIntegration(config);
    }
    return AIIntegration.instance;
  }

  private async initializeDefaultPrompts() {
    try {
      const { PROMPT_TEMPLATES } = await import('./prompts/templates');
      
      await Promise.all(
        Object.entries(PROMPT_TEMPLATES).map(([name, template]) => 
          this.prompts.addPrompt({
            name: name.replace(/_/g, ' '),
            description: `Generated from ${name}`,
            template: template.template,
            tags: ['system', 'default'],
            version: '1.0.0',
            metadata: { source: 'system', type: 'prompt_template' }
          })
        )
      );
      
      if (this.config.enableAnalytics) {
        aiAnalytics.logEvent('default_prompts_initialized');
      }
    } catch (error) {
      console.error('Failed to initialize default prompts:', error);
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error instanceof Error ? error : new Error(String(error)), { 
          context: 'initializeDefaultPrompts' 
        });
      }
      throw error;
    }
  }

  async initialize() {
    try {
      // Initialize documentation sources
      await this.docs.loadFrameworkDocumentation();
      
      // Create default collections if they don't exist
      const collections = await this.search.listCollections();
      const requiredCollections = ['documentation', 'prompts', 'code'];
      
      await Promise.all(
        requiredCollections
          .filter(name => !collections.some((c: { name: string }) => c.name === name))
          .map(name => this.search.createCollection(name))
      );
      
      if (this.config.enableAnalytics) {
        aiAnalytics.logEvent('ai_integration_initialized');
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize AI integration:', error);
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error instanceof Error ? error : new Error(String(error)), { 
          context: 'AIIntegration.initialize' 
        });
      }
      throw error;
    }
  }
}

// Export singleton instance
export const ai = AIIntegration.getInstance();

// Initialize on import if in a Node.js environment
if (typeof window === 'undefined') {
  ai.initialize().catch(error => {
    console.error('Failed to initialize AI integration:', error);
  });
}
