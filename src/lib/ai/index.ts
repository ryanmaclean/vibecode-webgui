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

export class AIIntegration {
  private static instance: AIIntegration;
  
  public readonly search: VectorSearch;
  public readonly prompts: PromptManager;
  public readonly docs: DocumentationSources;

  private constructor() {
    this.search = new VectorSearch();
    this.prompts = new PromptManager(this.search as any); // Type assertion for now
    this.docs = new DocumentationSources();
    
    // Initialize with default prompts
    this.initializeDefaultPrompts().catch(console.error);
    
    // Set up error handling
    process.on('unhandledRejection', (reason, promise) => {
      aiAnalytics.trackError(
        new Error('Unhandled promise rejection'), 
        { reason, promise }
      );
    });
  }

  public static getInstance(): AIIntegration {
    if (!AIIntegration.instance) {
      AIIntegration.instance = new AIIngration();
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
            metadata: { source: 'system' }
          })
        )
      );
      
      aiAnalytics.logEvent('default_prompts_initialized');
    } catch (error) {
      aiAnalytics.trackError(error, { context: 'initializeDefaultPrompts' });
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
          .filter(name => !collections.some(c => c.name === name))
          .map(name => this.search.createCollection(name))
      );
      
      aiAnalytics.logEvent('ai_integration_initialized');
      return true;
    } catch (error) {
      aiAnalytics.trackError(error, { context: 'AIIntegration.initialize' });
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
