/**
 * Agentic RAG Service - Enhanced RAG with AI-driven retrieval strategy selection
 * Extends the existing EnhancedRAGService with dynamic strategy planning
 */

import { EnhancedRAGService, RAGQuery, RAGContext, RAGSource, RAGSourceMetadata } from './rag-enhanced'
import { UnifiedAIClient, UnifiedChatMessage } from '../unified-ai-client'
import { vectorStore } from '../vector-store'

export interface RetrievalStrategy {
  name: string
  type: 'semantic' | 'keyword' | 'hybrid'
  confidence: number
  reasoning: string
  parameters: {
    maxResults?: number
    similarityThreshold?: number
    keywordWeight?: number
    semanticWeight?: number
    multiHop?: boolean
  }
}

export interface AgenticRAGQuery extends RAGQuery {
  enableAgenticRetrieval?: boolean
  maxStrategies?: number
  requiresMultiHop?: boolean
  complexityLevel?: 'simple' | 'medium' | 'complex'
}

export interface AgenticRAGContext extends RAGContext {
  strategiesUsed: RetrievalStrategy[]
  multiHopResults?: MultiHopResult[]
  synthesisReasoning: string
}

export interface MultiHopResult {
  hop: number
  query: string
  sources: RAGSource[]
  reasoning: string
}

export class AgenticRAGService extends EnhancedRAGService {
  private aiClient: UnifiedAIClient
  private strategyModel: string = 'gpt-4o-mini'

  constructor(aiClient: UnifiedAIClient) {
    super()
    this.aiClient = aiClient
  }

  /**
   * Enhanced context building with agentic retrieval strategy selection
   */
  async buildAgenticContext(query: AgenticRAGQuery): Promise<AgenticRAGContext> {
    const {
      enableAgenticRetrieval = true,
      maxStrategies = 3,
      requiresMultiHop = false,
      complexityLevel = 'medium',
      ...baseQuery
    } = query

    // Start with base RAG context
    const baseContext = await super.buildContext(baseQuery)

    if (!enableAgenticRetrieval) {
      return {
        ...baseContext,
        strategiesUsed: [{
          name: 'default',
          type: 'hybrid',
          confidence: 0.7,
          reasoning: 'Used default RAG strategy',
          parameters: {}
        }],
        synthesisReasoning: 'Default RAG synthesis applied'
      }
    }

    // Plan retrieval strategies using AI
    const strategies = await this.planRetrievalStrategies(
      query.query,
      complexityLevel,
      maxStrategies
    )

    // Execute planned strategies
    const strategySources = await this.executeStrategies(strategies, baseQuery)

    // Perform multi-hop reasoning if needed
    let multiHopResults: MultiHopResult[] = []
    if (requiresMultiHop || this.requiresMultiHop(query.query, strategySources)) {
      multiHopResults = await this.performMultiHopReasoning(query.query, strategySources, baseQuery.workspaceId)
    }

    // Synthesize and rank all results
    const synthesizedSources = await this.synthesizeResults(
      baseContext.sources,
      strategySources,
      multiHopResults,
      query.query
    )

    const synthesisReasoning = await this.generateSynthesisReasoning(
      strategies,
      multiHopResults,
      synthesizedSources.length
    )

    return {
      sources: synthesizedSources,
      webResults: baseContext.webResults,
      totalTokens: this.estimateTokenCount(synthesizedSources),
      relevanceScore: this.calculateEnhancedRelevanceScore(synthesizedSources, strategies),
      strategiesUsed: strategies,
      multiHopResults,
      synthesisReasoning
    }
  }

  /**
   * Use AI to plan optimal retrieval strategies based on query analysis
   */
  private async planRetrievalStrategies(
    query: string,
    complexityLevel: string,
    maxStrategies: number
  ): Promise<RetrievalStrategy[]> {
    const planningPrompt = `Analyze this query and recommend optimal retrieval strategies:

Query: "${query}"
Complexity Level: ${complexityLevel}
Maximum Strategies: ${maxStrategies}

Available strategy types:
1. semantic - Vector similarity search, best for conceptual queries
2. keyword - Exact term matching, best for specific facts or technical terms
3. hybrid - Combines semantic and keyword, balanced approach

For each recommended strategy, provide:
- Strategy type
- Confidence level (0-1)
- Reasoning for selection
- Specific parameters (similarity thresholds, weights, etc.)

Consider:
- Query complexity and ambiguity
- Likely information types needed
- Trade-offs between precision and recall
- Computational efficiency

Respond in JSON format:
{
  "strategies": [
    {
      "name": "strategy_name",
      "type": "semantic|keyword|hybrid",
      "confidence": 0.85,
      "reasoning": "Why this strategy is optimal for this query",
      "parameters": {
        "maxResults": 10,
        "similarityThreshold": 0.8,
        "keywordWeight": 0.3,
        "semanticWeight": 0.7
      }
    }
  ]
}`

    try {
      const messages: UnifiedChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert information retrieval strategist. Analyze queries and recommend optimal retrieval approaches.'
        },
        {
          role: 'user',
          content: planningPrompt
        }
      ]

      const response = await this.aiClient.chat(messages, this.strategyModel)
      const planData = JSON.parse(response.content)
      
      return planData.strategies || []
    } catch (error) {
      console.warn('Strategy planning failed, using fallback strategies:', error)
      return this.getFallbackStrategies(query, complexityLevel)
    }
  }

  /**
   * Execute the planned retrieval strategies
   */
  private async executeStrategies(
    strategies: RetrievalStrategy[],
    baseQuery: RAGQuery
  ): Promise<RAGSource[]> {
    const allSources: RAGSource[] = []

    for (const strategy of strategies) {
      try {
        let sources: RAGSource[] = []

        switch (strategy.type) {
          case 'semantic':
            sources = await this.executeSemanticStrategy(strategy, baseQuery)
            break
          case 'keyword':
            sources = await this.executeKeywordStrategy(strategy, baseQuery)
            break
          case 'hybrid':
            sources = await this.executeHybridStrategy(strategy, baseQuery)
            break
        }

        // Tag sources with strategy info
        sources.forEach(source => {
          source.metadata.strategy = strategy.name
          source.metadata.strategyType = strategy.type
        })

        allSources.push(...sources)
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error)
      }
    }

    return allSources
  }

  /**
   * Execute semantic (vector similarity) search strategy
   */
  private async executeSemanticStrategy(
    strategy: RetrievalStrategy,
    query: RAGQuery
  ): Promise<RAGSource[]> {
    try {
      // Use vector store for semantic search
      const context = await vectorStore.getContext(
        query.query,
        parseInt(query.workspaceId),
        strategy.parameters.maxResults || 5,
        strategy.parameters.similarityThreshold || 0.7
      )

      if (!context || context.trim().length === 0) {
        return []
      }

      // Convert context to RAG sources
      const chunks = context.split('\n---\n').filter(chunk => chunk.trim().length > 0)
      
      return chunks.map((chunk, index) => ({
        id: `semantic-${Date.now()}-${index}`,
        content: chunk.trim(),
        metadata: {
          type: 'database' as const,
          relevance: strategy.confidence * (1 - index * 0.1),
          timestamp: new Date().toISOString(),
          title: `Semantic Match ${index + 1}`
        }
      }))
    } catch (error) {
      console.warn('Semantic strategy execution failed:', error)
      return []
    }
  }

  /**
   * Execute keyword-based search strategy
   */
  private async executeKeywordStrategy(
    strategy: RetrievalStrategy,
    query: RAGQuery
  ): Promise<RAGSource[]> {
    // Use existing file content search (which is keyword-based)
    return await this.searchFileContent(
      query.query,
      query.workspaceId,
      strategy.parameters.maxResults || 5
    )
  }

  /**
   * Execute hybrid search strategy combining semantic and keyword approaches
   */
  private async executeHybridStrategy(
    strategy: RetrievalStrategy,
    query: RAGQuery
  ): Promise<RAGSource[]> {
    const semanticWeight = strategy.parameters.semanticWeight || 0.7
    const keywordWeight = strategy.parameters.keywordWeight || 0.3

    // Execute both strategies
    const semanticSources = await this.executeSemanticStrategy(
      { ...strategy, type: 'semantic' },
      query
    )
    
    const keywordSources = await this.executeKeywordStrategy(
      { ...strategy, type: 'keyword' },
      query
    )

    // Combine and reweight results
    const combinedSources = [...semanticSources, ...keywordSources]
    
    // Adjust relevance scores based on strategy weights
    semanticSources.forEach(source => {
      source.metadata.relevance *= semanticWeight
    })
    
    keywordSources.forEach(source => {
      source.metadata.relevance *= keywordWeight
    })

    return combinedSources
      .sort((a, b) => b.metadata.relevance - a.metadata.relevance)
      .slice(0, strategy.parameters.maxResults || 10)
  }

  /**
   * Determine if multi-hop reasoning is needed
   */
  private requiresMultiHop(query: string, sources: RAGSource[]): boolean {
    const queryLower = query.toLowerCase()
    
    // Indicators that multi-hop reasoning might be beneficial
    const multiHopIndicators = [
      'compare', 'relationship', 'between', 'how does', 'what is the connection',
      'explain the difference', 'analyze', 'synthesize', 'combine'
    ]

    const hasMultiHopIndicators = multiHopIndicators.some(indicator => 
      queryLower.includes(indicator)
    )

    // Also check if we have diverse source types that might benefit from synthesis
    const sourceTypes = new Set(sources.map(s => s.metadata.type))
    const hasDiverseSources = sourceTypes.size > 1

    return hasMultiHopIndicators || (hasDiverseSources && sources.length > 3)
  }

  /**
   * Perform multi-hop reasoning to find related information
   */
  private async performMultiHopReasoning(
    originalQuery: string,
    sources: RAGSource[],
    workspaceId: string
  ): Promise<MultiHopResult[]> {
    const results: MultiHopResult[] = []
    
    try {
      // Generate follow-up queries based on initial results
      const followUpQueries = await this.generateFollowUpQueries(originalQuery, sources)
      
      for (let i = 0; i < Math.min(followUpQueries.length, 2); i++) {
        const followUpQuery = followUpQueries[i]
        
        // Search for additional context using the follow-up query
        const hopSources = await this.searchFileContent(followUpQuery, workspaceId, 3)
        
        if (hopSources.length > 0) {
          results.push({
            hop: i + 1,
            query: followUpQuery,
            sources: hopSources,
            reasoning: `Follow-up search to find information related to: ${followUpQuery}`
          })
        }
      }
    } catch (error) {
      console.warn('Multi-hop reasoning failed:', error)
    }

    return results
  }

  /**
   * Generate follow-up queries for multi-hop reasoning
   */
  private async generateFollowUpQueries(
    originalQuery: string,
    sources: RAGSource[]
  ): Promise<string[]> {
    const sourcePreview = sources
      .slice(0, 3)
      .map(s => s.content.substring(0, 200))
      .join('\n---\n')

    const prompt = `Based on the original query and initial search results, generate 2-3 follow-up queries that would help find additional relevant information.

Original Query: "${originalQuery}"

Initial Results Preview:
${sourcePreview}

Generate follow-up queries that:
1. Explore related concepts or dependencies
2. Find missing context or background information
3. Look for specific examples or implementations

Respond with just the queries, one per line:`

    try {
      const messages: UnifiedChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert at information discovery. Generate insightful follow-up queries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const response = await this.aiClient.chat(messages, this.strategyModel)
      
      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .slice(0, 3)
    } catch (error) {
      console.warn('Follow-up query generation failed:', error)
      return []
    }
  }

  /**
   * Synthesize results from multiple strategies and multi-hop reasoning
   */
  private async synthesizeResults(
    baseSources: RAGSource[],
    strategySources: RAGSource[],
    multiHopResults: MultiHopResult[],
    originalQuery: string
  ): Promise<RAGSource[]> {
    // Combine all sources
    const allSources = [
      ...baseSources,
      ...strategySources,
      ...multiHopResults.flatMap(result => result.sources)
    ]

    // Remove duplicates based on content similarity
    const uniqueSources = this.deduplicateSources(allSources)

    // Re-rank based on relevance to original query and strategy confidence
    const rerankedSources = await this.rerankSources(uniqueSources, originalQuery)

    // Limit to top results
    return rerankedSources.slice(0, 15)
  }

  /**
   * Remove duplicate sources based on content similarity
   */
  private deduplicateSources(sources: RAGSource[]): RAGSource[] {
    const unique: RAGSource[] = []
    const seen = new Set<string>()

    for (const source of sources) {
      // Create a simplified hash of the content
      const contentHash = source.content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100)

      if (!seen.has(contentHash)) {
        seen.add(contentHash)
        unique.push(source)
      }
    }

    return unique
  }

  /**
   * Re-rank sources based on enhanced relevance calculation
   */
  private async rerankSources(sources: RAGSource[], query: string): Promise<RAGSource[]> {
    // For now, use simple relevance sorting
    // In the future, could implement AI-based reranking
    return sources.sort((a, b) => {
      const aScore = a.metadata.relevance || 0
      const bScore = b.metadata.relevance || 0
      return bScore - aScore
    })
  }

  /**
   * Calculate enhanced relevance score considering multiple strategies
   */
  private calculateEnhancedRelevanceScore(
    sources: RAGSource[],
    strategies: RetrievalStrategy[]
  ): number {
    if (sources.length === 0) return 0

    const avgSourceRelevance = sources.reduce((acc, source) => acc + (source.metadata.relevance || 0), 0) / sources.length
    const avgStrategyConfidence = strategies.reduce((acc, strategy) => acc + strategy.confidence, 0) / strategies.length
    const diversityBoost = new Set(sources.map(s => s.metadata.type)).size * 0.05
    const strategyBoost = strategies.length > 1 ? 0.1 : 0

    return Math.min(1.0, avgSourceRelevance * avgStrategyConfidence + diversityBoost + strategyBoost)
  }

  /**
   * Generate reasoning explanation for the synthesis process
   */
  private async generateSynthesisReasoning(
    strategies: RetrievalStrategy[],
    multiHopResults: MultiHopResult[],
    finalSourceCount: number
  ): Promise<string> {
    const strategyNames = strategies.map(s => s.name).join(', ')
    const multiHopInfo = multiHopResults.length > 0 
      ? ` with ${multiHopResults.length} multi-hop expansions`
      : ''

    return `Applied ${strategies.length} retrieval strategies (${strategyNames})${multiHopInfo}, synthesizing ${finalSourceCount} relevant sources.`
  }

  /**
   * Fallback strategies when AI planning fails
   */
  private getFallbackStrategies(query: string, complexityLevel: string): RetrievalStrategy[] {
    const baseStrategies: RetrievalStrategy[] = []

    // Always include hybrid as a safe default
    baseStrategies.push({
      name: 'hybrid-fallback',
      type: 'hybrid',
      confidence: 0.7,
      reasoning: 'Fallback hybrid strategy for balanced retrieval',
      parameters: {
        maxResults: 8,
        semanticWeight: 0.6,
        keywordWeight: 0.4
      }
    })

    // Add semantic for complex queries
    if (complexityLevel === 'complex' || query.length > 100) {
      baseStrategies.push({
        name: 'semantic-fallback',
        type: 'semantic',
        confidence: 0.8,
        reasoning: 'Semantic search for complex conceptual queries',
        parameters: {
          maxResults: 5,
          similarityThreshold: 0.75
        }
      })
    }

    // Add keyword for specific terms
    if (query.includes('"') || /\b[A-Z_]{3,}\b/.test(query)) {
      baseStrategies.push({
        name: 'keyword-fallback',
        type: 'keyword',
        confidence: 0.75,
        reasoning: 'Keyword search for specific terms or technical content',
        parameters: {
          maxResults: 5
        }
      })
    }

    return baseStrategies
  }

  /**
   * Format agentic context for prompts with strategy information
   */
  formatAgenticContextForPrompt(context: AgenticRAGContext): string {
    let prompt = super.formatContextForPrompt(context)

    // Add strategy information
    if (context.strategiesUsed.length > 0) {
      prompt += "\n🔍 Retrieval Strategy Analysis:\n"
      context.strategiesUsed.forEach((strategy, index) => {
        prompt += `${index + 1}. ${strategy.name} (${strategy.type}): ${strategy.reasoning}\n`
      })
    }

    // Add multi-hop reasoning results
    if (context.multiHopResults && context.multiHopResults.length > 0) {
      prompt += "\n🔗 Multi-hop Reasoning Results:\n"
      context.multiHopResults.forEach((result, index) => {
        prompt += `Hop ${result.hop}: ${result.query}\n`
        prompt += `Found ${result.sources.length} additional sources\n`
      })
    }

    // Add synthesis reasoning
    prompt += `\n📊 Synthesis: ${context.synthesisReasoning}\n\n`

    return prompt
  }
}

// Export singleton instance with default AI client
let agenticRAGService: AgenticRAGService | null = null

export function createAgenticRAGService(aiClient: UnifiedAIClient): AgenticRAGService {
  if (!agenticRAGService) {
    agenticRAGService = new AgenticRAGService(aiClient)
  }
  return agenticRAGService
}

export { agenticRAGService }