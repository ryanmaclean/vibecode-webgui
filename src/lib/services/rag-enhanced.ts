import { webSearchService, WebSearchResult } from './web-search'
import { logger } from '@/lib/logger';
export interface RAGContext {
  sources: RAGSource[]
  webResults?: WebSearchResult[]
  totalTokens: number
  relevanceScore: number
}

export interface RAGSource {
  id: string
  content: string
  metadata: {
    title?: string
    url?: string
    type: 'file' | 'web' | 'database'
    timestamp?: string
    relevance: number
  }
}

export interface RAGQuery {
  query: string
  workspaceId: string
  includeWebSearch?: boolean
  maxFileResults?: number
  maxWebResults?: number
  timeFilter?: 'day' | 'week' | 'month' | 'year'
}

export class EnhancedRAGService {
  async buildContext(ragQuery: RAGQuery): Promise<RAGContext> {
    const { 
      query, 
      workspaceId, 
      includeWebSearch = false,
      maxFileResults = 5,
      maxWebResults = 3,
      timeFilter
    } = ragQuery

    const sources: RAGSource[] = []
    let webResults: WebSearchResult[] = []
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

      // 3. Calculate relevance and optimize context
      const optimizedSources = this.optimizeSources(sources, query)
      totalTokens = this.estimateTokenCount(optimizedSources)

      // 4. Calculate overall relevance score
      const relevanceScore = this.calculateRelevanceScore(optimizedSources, webResults)

      return {
        sources: optimizedSources,
        webResults: webResults.length > 0 ? webResults : undefined,
        totalTokens,
        relevanceScore
      }

    } catch (error) {
      logger.error('RAG context building failed:', error)
      return {
        sources: [],
        webResults: [],
        totalTokens: 0,
        relevanceScore: 0
      }
    }
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
      logger.warn('File content search failed:', error)
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

  private optimizeSources(sources: RAGSource[], query: string): RAGSource[] {
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

    // Sort by relevance and limit total context size
    return uniqueSources
      .sort((a, b) => b.metadata.relevance - a.metadata.relevance)
      .slice(0, 10) // Limit to top 10 sources
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

    prompt += `Context relevance: ${(context.relevanceScore * 100).toFixed(1)}%\n`
    prompt += `Total sources: ${context.sources.length}\n\n`
    prompt += "Please answer based on this context. If the context doesn't contain relevant information, please say so.\n\n"

    return prompt
  }
}

// Export singleton instance
export const enhancedRAGService = new EnhancedRAGService()