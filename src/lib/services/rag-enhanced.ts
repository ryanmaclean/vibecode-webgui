import { webSearchService, WebSearchResult } from './web-search'
import {
  createSuggestionEnhancer,
  SuggestionEnhancer,
  EnhancedSuggestion
} from '@/lib/ai/suggestion-enhancer'
// import { logger } from '@/lib/logger';

/**
 * RAG context with enriched sources
 */
export interface RAGContext {
  sources: RAGSource[]
  webResults?: WebSearchResult[]
  codeAnalysis?: CodeAnalysisResult
  totalTokens: number
  relevanceScore: number
}

/**
 * RAG source with metadata
 */
export interface RAGSource {
  id: string
  content: string
  metadata: {
    title?: string
    url?: string
    type: 'file' | 'web' | 'database' | 'code'
    timestamp?: string
    relevance: number
    category?: string // For code sources: 'import', 'type', 'function', 'related', 'convention'
  }
}

/**
 * Code analysis result from suggestion enhancer
 */
export interface CodeAnalysisResult {
  imports: number
  types: number
  functions: number
  relatedCode: number
  conventions: number
  totalTokens: number
  relevanceScore: number
}

/**
 * RAG query with optional code analysis
 */
export interface RAGQuery {
  query: string
  workspaceId: string
  includeWebSearch?: boolean
  includeCodeAnalysis?: boolean
  sourceCode?: string
  sourceFile?: string
  maxFileResults?: number
  maxWebResults?: number
  maxCodeElements?: number
  timeFilter?: 'day' | 'week' | 'month' | 'year'
  tokenBudget?: number
}

export class EnhancedRAGService {
  private suggestionEnhancer: SuggestionEnhancer

  constructor() {
    this.suggestionEnhancer = createSuggestionEnhancer({
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      defaultOptimizationOptions: {
        tokenBudget: 2000,
        strategy: 'balanced' as any,
        minRelevanceScore: 0.2
      }
    })
  }

  async buildContext(ragQuery: RAGQuery): Promise<RAGContext> {
    const {
      query,
      workspaceId,
      includeWebSearch = false,
      includeCodeAnalysis = false,
      sourceCode,
      sourceFile,
      maxFileResults = 5,
      maxWebResults = 3,
      maxCodeElements = 10,
      timeFilter,
      tokenBudget = 4000
    } = ragQuery

    const sources: RAGSource[] = []
    let webResults: WebSearchResult[] = []
    let codeAnalysis: CodeAnalysisResult | undefined
    let totalTokens = 0

    try {
      // 1. Search existing file uploads and RAG content
      const fileSources = await this.searchFileContent(query, workspaceId, maxFileResults)
      sources.push(...fileSources)

      // 2. Perform web search if enabled
      if (includeWebSearch) {
        webResults = await webSearchService.searchWeb(query, {
          maxResults: maxWebResults,
          timeFilter
        })

        // Convert web results to RAG sources
        const webSources = await this.processWebResults(webResults)
        sources.push(...webSources)
      }

      // 3. Perform code analysis if enabled and source code provided
      if (includeCodeAnalysis && sourceCode) {
        const codeAnalysisResult = await this.analyzeCode({
          sourceCode,
          sourceFile,
          workspaceId,
          intent: query,
          maxElements: maxCodeElements,
          tokenBudget: Math.floor(tokenBudget * 0.5) // Allocate 50% of budget to code analysis
        })

        if (codeAnalysisResult) {
          sources.push(...codeAnalysisResult.sources)
          codeAnalysis = codeAnalysisResult.stats
        }
      }

      // 4. Calculate relevance and optimize context
      const optimizedSources = this.optimizeSources(sources, query, tokenBudget)
      totalTokens = this.estimateTokenCount(optimizedSources)

      // 5. Calculate overall relevance score
      const relevanceScore = this.calculateRelevanceScore(optimizedSources, webResults)

      return {
        sources: optimizedSources,
        webResults: webResults.length > 0 ? webResults : undefined,
        codeAnalysis,
        totalTokens,
        relevanceScore
      }

    } catch (error) {
      console.error('RAG context building failed:', error)
      return {
        sources: [],
        webResults: [],
        totalTokens: 0,
        relevanceScore: 0
      }
    }
  }

  /**
   * Analyze source code and extract contextual information
   */
  private async analyzeCode(options: {
    sourceCode: string
    sourceFile?: string
    workspaceId: string
    intent?: string
    maxElements?: number
    tokenBudget?: number
  }): Promise<{ sources: RAGSource[]; stats: CodeAnalysisResult } | null> {
    const {
      sourceCode,
      sourceFile,
      workspaceId,
      intent,
      maxElements = 10,
      tokenBudget = 2000
    } = options

    try {
      // Use suggestion enhancer to analyze code
      const enhanced: EnhancedSuggestion = await this.suggestionEnhancer.enhance({
        sourceCode,
        sourceFile,
        workspaceId,
        intent,
        contextOptions: {
          includeRelatedCode: true,
          includeConventions: true,
          maxRelatedElements: maxElements,
          maxConventionExamples: 5,
          minRelevanceScore: 0.2
        },
        optimizationOptions: {
          tokenBudget,
          strategy: 'balanced' as any,
          minRelevanceScore: 0.2,
          maxSourcesPerType: maxElements
        }
      })

      const sources: RAGSource[] = []
      const timestamp = new Date().toISOString()

      // Convert context sources to RAG sources
      for (const contextSource of enhanced.contextSources) {
        if (!contextSource.metadata) {
          console.warn('Skipping context source without metadata:', contextSource)
          continue
        }

        const category = this.mapSourceTypeToCategory(contextSource.metadata.type)

        sources.push({
          id: `code-${contextSource.metadata.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: contextSource.content,
          metadata: {
            title: contextSource.metadata.title || 'Untitled',
            type: 'code',
            category,
            timestamp,
            relevance: contextSource.metadata.relevance
          }
        })
      }

      const stats: CodeAnalysisResult = {
        imports: enhanced.stats.importsIncluded,
        types: enhanced.stats.typesIncluded,
        functions: enhanced.stats.functionsIncluded,
        relatedCode: enhanced.stats.relatedCodeIncluded,
        conventions: enhanced.stats.conventionsIncluded,
        totalTokens: enhanced.totalTokens,
        relevanceScore: enhanced.relevanceScore
      }

      return { sources, stats }

    } catch (error) {
      console.warn('Code analysis failed:', error)
      return null
    }
  }

  /**
   * Map context source type to RAG source category
   */
  private mapSourceTypeToCategory(sourceType: string): string {
    const typeMap: Record<string, string> = {
      'import': 'import',
      'type': 'type',
      'interface': 'type',
      'function': 'function',
      'class': 'function',
      'related': 'related',
      'convention': 'convention'
    }
    return typeMap[sourceType] || 'code'
  }

  private async searchFileContent(query: string, workspaceId: string, maxResults: number): Promise<RAGSource[]> {
    try {
      // Read existing RAG data for the workspace
      const fs = await import('fs').then(m => m.promises)
      const path = await import('path')
      
      const ragFilePath = path.join(process.cwd(), 'data', 'rag', `${workspaceId}.json`)
      
      const ragData = await fs.readFile(ragFilePath, 'utf-8')
      const ragIndex = JSON.parse(ragData)

      const sources: RAGSource[] = []
      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(' ').filter(term => term.length > 2)

      // Search through all files
      for (const fileData of ragIndex.files || []) {
        let relevanceScore = 0
        const contentLower = fileData.content.toLowerCase()

        // Calculate relevance based on term matches
        queryTerms.forEach(term => {
          const termCount = (contentLower.match(new RegExp(term, 'g')) || []).length
          relevanceScore += termCount * 0.1
        })

        // Boost relevance based on file type and name matches
        if (fileData.filename.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.5
        }

        if (relevanceScore > 0.1) {
          // Extract relevant chunks from the content
          const chunks = this.extractRelevantChunks(fileData.content, queryTerms)
          
          chunks.forEach((chunk, index) => {
            sources.push({
              id: `file-${fileData.id}-chunk-${index}`,
              content: chunk,
              metadata: {
                title: fileData.filename,
                type: 'file',
                timestamp: fileData.uploadedAt,
                relevance: relevanceScore / (index + 1)
              }
            })
          })
        }
      }

      return sources
        .sort((a, b) => b.metadata.relevance - a.metadata.relevance)
        .slice(0, maxResults)

    } catch (error) {
      console.warn('File content search failed:', error)
      return []
    }
  }

  private async processWebResults(webResults: WebSearchResult[]): Promise<RAGSource[]> {
    const sources: RAGSource[] = []

    for (const result of webResults) {
      // Use the snippet as primary content
      sources.push({
        id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: result.snippet,
        metadata: {
          title: result.title,
          url: result.url,
          type: 'web',
          timestamp: result.timestamp || new Date().toISOString(),
          relevance: result.relevance
        }
      })

      // If we have scraped content, add it as an additional source
      if ((result as any).content && (result as any).content.length > 100) {
        const scrapedContent = (result as any).content
        const chunks = this.chunkContent(scrapedContent, 500)
        
        chunks.slice(0, 2).forEach((chunk, index) => {
          sources.push({
            id: `web-scraped-${Date.now()}-${index}`,
            content: chunk,
            metadata: {
              title: `${result.title} (Full Content)`,
              url: result.url,
              type: 'web',
              timestamp: result.timestamp || new Date().toISOString(),
              relevance: result.relevance * 0.8 // Slightly lower relevance for scraped content
            }
          })
        })
      }
    }

    return sources
  }

  private extractRelevantChunks(content: string, queryTerms: string[]): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const relevantChunks: { chunk: string; score: number }[] = []

    // Group sentences into chunks of 3-5 sentences
    for (let i = 0; i < sentences.length; i += 3) {
      const chunk = sentences.slice(i, i + 5).join('. ').trim()
      if (chunk.length < 50) continue

      let score = 0
      const chunkLower = chunk.toLowerCase()
      
      queryTerms.forEach(term => {
        const matches = (chunkLower.match(new RegExp(term, 'g')) || []).length
        score += matches
      })

      if (score > 0) {
        relevantChunks.push({ chunk, score })
      }
    }

    return relevantChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.chunk)
  }

  private chunkContent(content: string, maxChunkSize: number): string[] {
    const words = content.split(' ')
    const chunks: string[] = []
    
    for (let i = 0; i < words.length; i += maxChunkSize) {
      const chunk = words.slice(i, i + maxChunkSize).join(' ')
      if (chunk.trim().length > 50) {
        chunks.push(chunk)
      }
    }
    
    return chunks
  }

  private optimizeSources(sources: RAGSource[], query: string, tokenBudget: number): RAGSource[] {
    // Remove duplicates based on content similarity
    const uniqueSources: RAGSource[] = []
    const seenContent = new Set<string>()

    for (const source of sources) {
      const contentHash = source.content.slice(0, 100).toLowerCase().replace(/\s+/g, ' ')
      if (!seenContent.has(contentHash)) {
        seenContent.add(contentHash)
        uniqueSources.push(source)
      }
    }

    // Sort by relevance
    const sortedSources = uniqueSources.sort((a, b) => b.metadata.relevance - a.metadata.relevance)

    // Limit by token budget
    const optimized: RAGSource[] = []
    let currentTokens = 0
    const maxTokens = tokenBudget * 0.8 // Use 80% of budget for sources, leave room for formatting

    for (const source of sortedSources) {
      const sourceTokens = Math.ceil(source.content.length / 4)
      if (currentTokens + sourceTokens <= maxTokens) {
        optimized.push(source)
        currentTokens += sourceTokens
      } else {
        break
      }
    }

    return optimized
  }

  private estimateTokenCount(sources: RAGSource[]): number {
    const totalChars = sources.reduce((acc, source) => acc + source.content.length, 0)
    return Math.ceil(totalChars / 4) // Rough estimation: 4 chars per token
  }

  private calculateRelevanceScore(sources: RAGSource[], webResults: WebSearchResult[]): number {
    if (sources.length === 0) return 0

    const avgSourceRelevance = sources.reduce((acc, source) => acc + source.metadata.relevance, 0) / sources.length
    const webBoost = webResults.length > 0 ? 0.1 : 0
    const diversityBoost = new Set(sources.map(s => s.metadata.type)).size * 0.05

    return Math.min(1.0, avgSourceRelevance + webBoost + diversityBoost)
  }

  formatContextForPrompt(context: RAGContext): string {
    if (context.sources.length === 0) {
      return "No relevant context found."
    }

    let prompt = "Based on the following context:\n\n"

    // Add code analysis sources
    const codeSources = context.sources.filter(s => s.metadata.type === 'code')
    if (codeSources.length > 0) {
      prompt += "💻 From code analysis:\n"

      // Group by category
      const codeByCategory = this.groupSourcesByCategory(codeSources)

      if (codeByCategory.import && codeByCategory.import.length > 0) {
        prompt += "\nImports:\n"
        codeByCategory.import.forEach((source, index) => {
          prompt += `${index + 1}. ${source.metadata.title || 'Import'}:\n${source.content}\n\n`
        })
      }

      if (codeByCategory.type && codeByCategory.type.length > 0) {
        prompt += "\nType Definitions:\n"
        codeByCategory.type.forEach((source, index) => {
          prompt += `${index + 1}. ${source.metadata.title || 'Type'}:\n${source.content}\n\n`
        })
      }

      if (codeByCategory.function && codeByCategory.function.length > 0) {
        prompt += "\nFunctions & Classes:\n"
        codeByCategory.function.forEach((source, index) => {
          prompt += `${index + 1}. ${source.metadata.title || 'Function'}:\n${source.content}\n\n`
        })
      }

      if (codeByCategory.related && codeByCategory.related.length > 0) {
        prompt += "\nRelated Code:\n"
        codeByCategory.related.forEach((source, index) => {
          prompt += `${index + 1}. ${source.metadata.title || 'Related'}:\n${source.content}\n\n`
        })
      }

      if (codeByCategory.convention && codeByCategory.convention.length > 0) {
        prompt += "\nProject Conventions:\n"
        codeByCategory.convention.forEach((source, index) => {
          prompt += `${index + 1}. ${source.metadata.title || 'Convention'}:\n${source.content}\n\n`
        })
      }
    }

    // Add file sources
    const fileSources = context.sources.filter(s => s.metadata.type === 'file')
    if (fileSources.length > 0) {
      prompt += "📁 From uploaded files:\n"
      fileSources.forEach((source, index) => {
        prompt += `${index + 1}. ${source.metadata.title || 'Unknown file'}:\n${source.content}\n\n`
      })
    }

    // Add web sources
    const webSources = context.sources.filter(s => s.metadata.type === 'web')
    if (webSources.length > 0) {
      prompt += "🌐 From web search:\n"
      webSources.forEach((source, index) => {
        prompt += `${index + 1}. ${source.metadata.title} (${source.metadata.url}):\n${source.content}\n\n`
      })
    }

    // Add statistics
    if (context.codeAnalysis) {
      prompt += `\n📊 Code Analysis Stats:\n`
      prompt += `- Imports: ${context.codeAnalysis.imports}\n`
      prompt += `- Types: ${context.codeAnalysis.types}\n`
      prompt += `- Functions: ${context.codeAnalysis.functions}\n`
      prompt += `- Related Code: ${context.codeAnalysis.relatedCode}\n`
      prompt += `- Conventions: ${context.codeAnalysis.conventions}\n`
      prompt += `- Code Tokens: ${context.codeAnalysis.totalTokens}\n\n`
    }

    prompt += `Context relevance: ${(context.relevanceScore * 100).toFixed(1)}%\n`
    prompt += `Total sources: ${context.sources.length}\n`
    prompt += `Total tokens: ${context.totalTokens}\n\n`
    prompt += "Please answer based on this context. If the context doesn't contain relevant information, please say so.\n\n"

    return prompt
  }

  /**
   * Group sources by category
   */
  private groupSourcesByCategory(sources: RAGSource[]): Record<string, RAGSource[]> {
    const grouped: Record<string, RAGSource[]> = {}

    for (const source of sources) {
      const category = source.metadata.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(source)
    }

    return grouped
  }
}

// Export singleton instance
export const enhancedRAGService = new EnhancedRAGService()