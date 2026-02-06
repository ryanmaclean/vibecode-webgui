// Core AI functionality
export * from './documentation/ingest';
export * from './documentation/sources';
export * from './prompts/manager';
export * from './prompts/templates';
export * from './search/vector-search';
export * from './analytics';

// Context Management
export * from './context';

// Enhanced AI capabilities
export * from './agents/multi-agent-workflow';
export * from './vector-stores/pgvector-client';
export * from './local/ollama-client';
// export * from './enhanced-ai-manager';  // Module not found - commented out
export * from './automated-test-generator';
export * from './smart-code-completion';
export * from './natural-language-to-code';
export * from './code-review-automation';
export * from './performance-optimization';
export * from './integration-testing';

// Circuit Breaker and Resilience
export * from './circuit-breaker';
export * from './resilient-ai-client';

// Types
export type { Prompt } from './prompts/manager';
export type { SearchResult } from './search/vector-search';

// AI Integration Manager
import { VectorSearch } from './search/vector-search';
import { PromptManager } from './prompts/manager';
import { DocumentationSources } from './documentation/sources';
import { aiAnalytics } from './analytics';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { validateAIQuery, validatePrompt, aiRateLimiter, AISecurityLogger } from '../security/input-validator';
import type { SearchResult } from './search/vector-search';
// import { logger } from '@/lib/logger';
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
  async secureQuery(rawInput: unknown, userId: string = 'anonymous'): Promise<SearchResult[]> {
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
  async securePromptProcessing(rawPrompt: unknown, userId: string = 'anonymous'): Promise<Record<string, unknown>[]> {
    try {
      const validatedPrompt = validatePrompt(rawPrompt);
      
      // Process the validated prompt
      const relevantPrompts = await this.prompts.findRelevantPrompts(
        validatedPrompt.content,
        5
      );

      if (this.config.enableAnalytics) {
        aiAnalytics.logEvent('secure_prompt_processing', {
          userId,
          promptLength: validatedPrompt.content.length,
          variableCount: Object.keys(validatedPrompt.variables || {}).length
        });
      }

      return relevantPrompts;
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
    // Create a VectorStoreRetriever-compatible object
    // The retriever adapts our VectorSearch to the langchain interface
    const retriever = {
      getRelevantDocuments: async (query: string, k?: number) => {
        const results = await this.search.semanticSearch(query, 'prompts');
        const limitedResults = k ? results.slice(0, k) : results;
        return limitedResults.map(result => ({
          pageContent: result.content,
          metadata: result.metadata || {}
        }));
      },
      addDocuments: async (documents: Array<{ pageContent: string; metadata?: Record<string, unknown> }>) => {
        await this.search.addDocuments(documents.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata || {}
        })), 'prompts');
      }
    } as unknown as VectorStoreRetriever;
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
            template: typeof template.template === 'string' ? template.template : JSON.stringify(template.template),
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
      // ChromaDB may not be available - gracefully degrade
      console.warn('Failed to initialize default prompts (ChromaDB may be unavailable):', error instanceof Error ? error.message : String(error));
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error instanceof Error ? error : new Error(String(error)), {
          context: 'initializeDefaultPrompts'
        });
      }
      // Don't throw - allow app to continue without vector search
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
      // ChromaDB may not be available - gracefully degrade
      console.warn('Failed to initialize AI integration (ChromaDB may be unavailable):', error instanceof Error ? error.message : String(error));
      if (this.config.enableAnalytics) {
        aiAnalytics.trackError(error instanceof Error ? error : new Error(String(error)), {
          context: 'AIIntegration.initialize'
        });
      }
      // Don't throw - allow app to continue without vector search
      return false;
    }
  }
}

// Export singleton instance - only create if AI features are enabled
const isAIDisabled = process.env.DISABLE_AI === 'true' || process.env.SKIP_AI_INIT === 'true';
export const ai = isAIDisabled ? null : AIIntegration.getInstance();

// Initialize on import if in a Node.js environment and AI is enabled
if (typeof window === 'undefined' && !isAIDisabled && ai) {
  ai.initialize().catch(error => {
    console.warn('Failed to initialize AI integration (continuing without AI features):', error instanceof Error ? error.message : String(error));
  });
} else if (isAIDisabled) {
  console.info('🛑 AI features disabled via environment variable');
}
