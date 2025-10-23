/**
 * AI Project Integration with Vector Search
 * Enhances AI project generation with semantic code search
 */

import { VectorSearchService } from './vector-search';
import { EmbeddingGenerator } from './embedding-generator';
// import { logger } from '@/lib/logger';
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
  files: Array<{
    path: string;
    content: string;
    type: 'code' | 'config' | 'documentation';
  }>;
  dependencies: string[];
  tags: string[];
}

interface SemanticSearchContext {
  similar_projects: Array<{
    template_id: string;
    similarity: number;
    relevant_files: string[];
  }>;
  relevant_code_snippets: Array<{
    content_hash: string;
    file_path: string;
    language: string;
    similarity: number;
  }>;
  documentation_context: Array<{
    section: string;
    content: string;
    similarity: number;
  }>;
}

export class AIProjectIntegration {
  private vectorSearch: VectorSearchService;
  private embeddingGenerator: EmbeddingGenerator;

  constructor() {
    this.vectorSearch = new VectorSearchService();
    this.embeddingGenerator = new EmbeddingGenerator();
  }

  /**
   * Enhanced AI project generation with semantic context
   */
  async generateProjectWithContext(
    userPrompt: string,
    preferences: {
      language?: string;
      framework?: string;
      complexity?: 'simple' | 'intermediate' | 'advanced';
      include_tests?: boolean;
    } = {}
  ): Promise<{
    project_structure: any;
    semantic_context: SemanticSearchContext;
    generation_metadata: {
      context_sources: number;
      similarity_threshold: number;
      processing_time_ms: number;
    };
  }> {
    const startTime = performance.now();

    // Generate embedding for user prompt
    const { embedding: promptEmbedding } = await this.embeddingGenerator.getOrGenerateEmbedding(
      userPrompt,
      'documentation'
    );

    // Find semantic context
    const semanticContext = await this.findSemanticContext(
      promptEmbedding,
      preferences
    );

    // Generate enhanced prompt with context
    const enhancedPrompt = this.buildEnhancedPrompt(
      userPrompt,
      semanticContext,
      preferences
    );

    // Call existing AI project generation with enhanced context
    const projectStructure = await this.callAIProjectGeneration(enhancedPrompt);

    // Store generated project components as embeddings for future reference
    await this.storeProjectEmbeddings(projectStructure, userPrompt);

    const processingTime = performance.now() - startTime;

    return {
      project_structure: projectStructure,
      semantic_context: semanticContext,
      generation_metadata: {
        context_sources: this.countContextSources(semanticContext),
        similarity_threshold: 0.7,
        processing_time_ms: processingTime
      }
    };
  }

  /**
   * Find semantic context for project generation
   */
  private async findSemanticContext(
    promptEmbedding: number[],
    preferences: any
  ): Promise<SemanticSearchContext> {
    // Find similar existing projects
    const similarProjects = await this.vectorSearch.hybridSearch(
      promptEmbedding,
      {
        content_types: ['code'],
        languages: preferences.language ? [preferences.language] : undefined,
        frameworks: preferences.framework ? [preferences.framework] : undefined
      },
      5
    );

    // Find relevant code snippets
    const codeSnippets = await this.vectorSearch.findSimilarCode(
      promptEmbedding,
      preferences.language,
      preferences.framework,
      10
    );

    // Find relevant documentation
    const documentation = await this.vectorSearch.findRelevantDocs(
      promptEmbedding,
      5
    );

    return {
      similar_projects: similarProjects.map(result => ({
        template_id: result.content_hash,
        similarity: result.similarity,
        relevant_files: result.metadata.file_path ? [result.metadata.file_path] : []
      })),
      relevant_code_snippets: codeSnippets.map(result => ({
        content_hash: result.content_hash,
        file_path: result.metadata.file_path || 'unknown',
        language: result.metadata.language || 'unknown',
        similarity: result.similarity
      })),
      documentation_context: documentation.map(result => ({
        section: result.metadata.section || 'general',
        content: result.metadata.title || 'Documentation',
        similarity: result.similarity
      }))
    };
  }

  /**
   * Build enhanced prompt with semantic context
   */
  private buildEnhancedPrompt(
    originalPrompt: string,
    context: SemanticSearchContext,
    preferences: any
  ): string {
    let enhancedPrompt = `${originalPrompt}\n\n`;

    // Add context from similar projects
    if (context.similar_projects.length > 0) {
      enhancedPrompt += `## Similar Project Context:\n`;
      context.similar_projects.slice(0, 3).forEach((project, i) => {
        enhancedPrompt += `${i + 1}. Project with similarity ${(1 - project.similarity).toFixed(2)}\n`;
        if (project.relevant_files.length > 0) {
          enhancedPrompt += `   - Relevant files: ${project.relevant_files.join(', ')}\n`;
        }
      });
      enhancedPrompt += '\n';
    }

    // Add relevant code patterns
    if (context.relevant_code_snippets.length > 0) {
      enhancedPrompt += `## Relevant Code Patterns:\n`;
      context.relevant_code_snippets.slice(0, 5).forEach((snippet, i) => {
        enhancedPrompt += `${i + 1}. ${snippet.language} code (${snippet.file_path}) - similarity: ${(1 - snippet.similarity).toFixed(2)}\n`;
      });
      enhancedPrompt += '\n';
    }

    // Add documentation context
    if (context.documentation_context.length > 0) {
      enhancedPrompt += `## Documentation Context:\n`;
      context.documentation_context.forEach((doc, i) => {
        enhancedPrompt += `${i + 1}. ${doc.section}: ${doc.content}\n`;
      });
      enhancedPrompt += '\n';
    }

    // Add preferences
    if (preferences.language || preferences.framework) {
      enhancedPrompt += `## Technical Preferences:\n`;
      if (preferences.language) enhancedPrompt += `- Language: ${preferences.language}\n`;
      if (preferences.framework) enhancedPrompt += `- Framework: ${preferences.framework}\n`;
      if (preferences.complexity) enhancedPrompt += `- Complexity: ${preferences.complexity}\n`;
      if (preferences.include_tests) enhancedPrompt += `- Include tests: Yes\n`;
      enhancedPrompt += '\n';
    }

    enhancedPrompt += `Please generate a complete project structure that incorporates relevant patterns from the context above while fulfilling the original requirements.`;

    return enhancedPrompt;
  }

  /**
   * Call existing AI project generation API
   */
  private async callAIProjectGeneration(enhancedPrompt: string): Promise<any> {
    // This would integrate with the existing AI project generation route
    // For now, return a mock structure
    return {
      name: 'generated-project',
      files: [
        {
          path: 'src/index.ts',
          content: '// Generated with semantic context\nconsole.info("Hello, World!");'
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'generated-project',
            version: '1.0.0',
            dependencies: {}
          }, null, 2)
        }
      ],
      dependencies: [],
      metadata: {
        generated_with_context: true,
        context_enhanced: true
      }
    };
  }

  /**
   * Store generated project components as embeddings
   */
  private async storeProjectEmbeddings(
    projectStructure: any,
    originalPrompt: string
  ): Promise<void> {
    const projectFiles = projectStructure.files || [];
    
    // Store each file as an embedding
    for (const file of projectFiles) {
      if (file.content && file.content.trim().length > 0) {
        const language = this.inferLanguageFromPath(file.path);
        
        await this.embeddingGenerator.generateCodeEmbedding(
          file.content,
          language,
          projectStructure.metadata?.framework,
          file.path
        );
      }
    }

    // Store project description as documentation embedding
    if (originalPrompt) {
      await this.embeddingGenerator.generateDocumentationEmbedding(
        originalPrompt,
        'project-generation',
        projectStructure.name,
        ['ai-generated', 'project-template']
      );
    }
  }

  /**
   * Infer programming language from file path
   */
  private inferLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    
    return languageMap[ext || ''] || 'text';
  }

  /**
   * Count total context sources
   */
  private countContextSources(context: SemanticSearchContext): number {
    return context.similar_projects.length + 
           context.relevant_code_snippets.length + 
           context.documentation_context.length;
  }

  /**
   * Get project recommendations based on user history
   */
  async getProjectRecommendations(
    userId: string,
    limit: number = 5
  ): Promise<Array<{
    template_id: string;
    name: string;
    description: string;
    similarity_score: number;
    reasons: string[];
  }>> {
    // Find user's previous projects/chats
    const userHistory = await this.vectorSearch.hybridSearch(
      [], // Empty embedding for metadata-only search
      {
        content_types: ['chat'],
        // Could add user_id filter here
      },
      20
    );

    if (userHistory.length === 0) {
      return this.getPopularTemplates(limit);
    }

    // Generate average embedding from user history
    // This is a simplified approach - in production, you'd want more sophisticated user modeling
    const recommendations = await this.vectorSearch.similaritySearch(
      [], // Would use computed user preference embedding
      {
        content_type: 'code',
        limit
      }
    );

    return recommendations.map(rec => ({
      template_id: rec.content_hash,
      name: rec.metadata.file_path || 'Unknown Project',
      description: `${rec.metadata.language} project with ${rec.metadata.framework || 'custom'} framework`,
      similarity_score: 1 - rec.similarity,
      reasons: [
        `Matches your ${rec.metadata.language} experience`,
        `Similar to your previous projects`,
        `Popular template with high success rate`
      ]
    }));
  }

  /**
   * Get popular project templates
   */
  private async getPopularTemplates(limit: number) {
    const stats = await this.vectorSearch.getStats();
    
    // Return mock popular templates based on stats
    return Object.entries(stats.by_language)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([language, count]) => ({
        template_id: `template_${language}`,
        name: `${language.charAt(0).toUpperCase() + language.slice(1)} Starter`,
        description: `Popular ${language} project template`,
        similarity_score: count / stats.total_embeddings,
        reasons: [
          `Most popular ${language} template`,
          'High success rate',
          'Well-documented'
        ]
      }));
  }

  async close(): Promise<void> {
    await this.vectorSearch.close();
    await this.embeddingGenerator.close();
  }
}
