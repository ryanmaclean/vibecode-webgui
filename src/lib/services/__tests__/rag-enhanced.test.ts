/**
 * Tests for EnhancedRAGService with code analysis integration
 */

import { EnhancedRAGService, RAGQuery, RAGContext, RAGSource } from '../rag-enhanced'
import { webSearchService } from '../web-search'
import { createSuggestionEnhancer } from '@/lib/ai/suggestion-enhancer'

// Mock dependencies
jest.mock('../web-search', () => ({
  webSearchService: {
    searchWeb: jest.fn()
  }
}))

jest.mock('@/lib/ai/suggestion-enhancer', () => ({
  createSuggestionEnhancer: jest.fn()
}))

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}))

describe('EnhancedRAGService', () => {
  let service: EnhancedRAGService
  let mockEnhancer: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock enhancer
    mockEnhancer = {
      enhance: jest.fn()
    }

    ;(createSuggestionEnhancer as jest.Mock).mockReturnValue(mockEnhancer)

    // Create service instance
    service = new EnhancedRAGService()
  })

  describe('constructor', () => {
    it('should initialize with suggestion enhancer', () => {
      expect(createSuggestionEnhancer).toHaveBeenCalledWith({
        cacheTTL: 5 * 60 * 1000,
        defaultOptimizationOptions: {
          tokenBudget: 2000,
          strategy: 'balanced',
          minRelevanceScore: 0.2
        }
      })
    })
  })

  describe('buildContext', () => {
    const mockQuery: RAGQuery = {
      query: 'test query',
      workspaceId: 'workspace-123'
    }

    it('should build context without optional features', async () => {
      const context = await service.buildContext(mockQuery)

      expect(context).toBeDefined()
      expect(context.sources).toBeInstanceOf(Array)
      expect(context.totalTokens).toBeGreaterThanOrEqual(0)
      expect(context.relevanceScore).toBeGreaterThanOrEqual(0)
      expect(context.webResults).toBeUndefined()
      expect(context.codeAnalysis).toBeUndefined()
    })

    it('should include web search when enabled', async () => {
      const mockWebResults = [
        {
          title: 'Test Result',
          url: 'https://example.com',
          snippet: 'Test snippet',
          relevance: 0.8,
          timestamp: new Date().toISOString()
        }
      ]

      ;(webSearchService.searchWeb as jest.Mock).mockResolvedValue(mockWebResults)

      const context = await service.buildContext({
        ...mockQuery,
        includeWebSearch: true,
        maxWebResults: 3
      })

      expect(webSearchService.searchWeb).toHaveBeenCalledWith('test query', {
        maxResults: 3,
        timeFilter: undefined
      })
      expect(context.webResults).toEqual(mockWebResults)
      expect(context.sources.some(s => s.metadata.type === 'web')).toBe(true)
    })

    it('should include code analysis when enabled with source code', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const x = 1;',
        contextSources: [
          {
            type: 'import',
            identifier: 'React',
            content: "import React from 'react'",
            relevance: 0.9,
            tokens: 10,
            startLine: 1,
            endLine: 1
          },
          {
            type: 'function',
            identifier: 'calculateTotal',
            content: 'function calculateTotal(items: Item[]): number { ... }',
            relevance: 0.8,
            tokens: 20,
            startLine: 5,
            endLine: 10
          }
        ],
        formattedContext: 'Formatted context',
        totalTokens: 50,
        relevanceScore: 0.85,
        stats: {
          importsIncluded: 1,
          typesIncluded: 2,
          functionsIncluded: 1,
          relatedCodeIncluded: 3,
          conventionsIncluded: 2,
          tokenUtilization: 0.5,
          optimizationStrategy: 'balanced'
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1950,
          warnings: []
        }
      }

      mockEnhancer.enhance.mockResolvedValue(mockEnhancedSuggestion)

      const context = await service.buildContext({
        ...mockQuery,
        includeCodeAnalysis: true,
        sourceCode: 'const x = 1;',
        sourceFile: 'test.ts',
        maxCodeElements: 10,
        tokenBudget: 4000
      })

      expect(mockEnhancer.enhance).toHaveBeenCalledWith({
        sourceCode: 'const x = 1;',
        sourceFile: 'test.ts',
        workspaceId: 'workspace-123',
        intent: 'test query',
        contextOptions: {
          includeRelatedCode: true,
          includeConventions: true,
          maxRelatedElements: 10,
          maxConventionExamples: 5,
          minRelevanceScore: 0.2
        },
        optimizationOptions: {
          tokenBudget: 2000, // 50% of total budget
          strategy: 'balanced',
          minRelevanceScore: 0.2,
          maxSourcesPerType: 10
        }
      })

      expect(context.codeAnalysis).toBeDefined()
      expect(context.codeAnalysis?.imports).toBe(1)
      expect(context.codeAnalysis?.types).toBe(2)
      expect(context.codeAnalysis?.functions).toBe(1)
      expect(context.codeAnalysis?.relatedCode).toBe(3)
      expect(context.codeAnalysis?.conventions).toBe(2)
      expect(context.sources.some(s => s.metadata.type === 'code')).toBe(true)
    })

    it('should skip code analysis when source code is not provided', async () => {
      const context = await service.buildContext({
        ...mockQuery,
        includeCodeAnalysis: true
        // No sourceCode provided
      })

      expect(mockEnhancer.enhance).not.toHaveBeenCalled()
      expect(context.codeAnalysis).toBeUndefined()
      expect(context.sources.some(s => s.metadata.type === 'code')).toBe(false)
    })

    it('should handle code analysis errors gracefully', async () => {
      mockEnhancer.enhance.mockRejectedValue(new Error('Analysis failed'))

      const context = await service.buildContext({
        ...mockQuery,
        includeCodeAnalysis: true,
        sourceCode: 'const x = 1;'
      })

      expect(context).toBeDefined()
      expect(context.codeAnalysis).toBeUndefined()
      expect(context.sources.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle errors and return empty context', async () => {
      ;(webSearchService.searchWeb as jest.Mock).mockRejectedValue(new Error('Network error'))

      const context = await service.buildContext({
        ...mockQuery,
        includeWebSearch: true
      })

      expect(context).toEqual({
        sources: [],
        webResults: [],
        totalTokens: 0,
        relevanceScore: 0
      })
    })

    it('should respect token budget when optimizing sources', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const x = 1;',
        contextSources: Array.from({ length: 20 }, (_, i) => ({
          type: 'function',
          identifier: `function${i}`,
          content: `function function${i}() { ${'x'.repeat(100)} }`, // 100+ chars each
          relevance: 0.9 - i * 0.01,
          tokens: 25,
          startLine: i * 5,
          endLine: i * 5 + 4
        })),
        formattedContext: 'Formatted context',
        totalTokens: 500,
        relevanceScore: 0.85,
        stats: {
          importsIncluded: 0,
          typesIncluded: 0,
          functionsIncluded: 20,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 0.5,
          optimizationStrategy: 'balanced'
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1500,
          warnings: []
        }
      }

      mockEnhancer.enhance.mockResolvedValue(mockEnhancedSuggestion)

      const context = await service.buildContext({
        ...mockQuery,
        includeCodeAnalysis: true,
        sourceCode: 'const x = 1;',
        tokenBudget: 1000 // Small budget
      })

      // Should limit sources based on token budget
      expect(context.totalTokens).toBeLessThanOrEqual(1000)
      expect(context.sources.length).toBeLessThan(20)
    })
  })

  describe('formatContextForPrompt', () => {
    it('should format empty context', () => {
      const context: RAGContext = {
        sources: [],
        totalTokens: 0,
        relevanceScore: 0
      }

      const formatted = service.formatContextForPrompt(context)
      expect(formatted).toBe('No relevant context found.')
    })

    it('should format code sources by category', () => {
      const context: RAGContext = {
        sources: [
          {
            id: 'code-1',
            content: "import React from 'react'",
            metadata: {
              title: 'React',
              type: 'code',
              category: 'import',
              relevance: 0.9,
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'code-2',
            content: 'interface User { name: string; }',
            metadata: {
              title: 'User',
              type: 'code',
              category: 'type',
              relevance: 0.8,
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'code-3',
            content: 'function calculateTotal() { ... }',
            metadata: {
              title: 'calculateTotal',
              type: 'code',
              category: 'function',
              relevance: 0.7,
              timestamp: new Date().toISOString()
            }
          }
        ],
        codeAnalysis: {
          imports: 1,
          types: 1,
          functions: 1,
          relatedCode: 0,
          conventions: 0,
          totalTokens: 50,
          relevanceScore: 0.85
        },
        totalTokens: 50,
        relevanceScore: 0.8
      }

      const formatted = service.formatContextForPrompt(context)

      expect(formatted).toContain('💻 From code analysis:')
      expect(formatted).toContain('Imports:')
      expect(formatted).toContain('React')
      expect(formatted).toContain('Type Definitions:')
      expect(formatted).toContain('User')
      expect(formatted).toContain('Functions & Classes:')
      expect(formatted).toContain('calculateTotal')
      expect(formatted).toContain('📊 Code Analysis Stats:')
      expect(formatted).toContain('Imports: 1')
      expect(formatted).toContain('Types: 1')
      expect(formatted).toContain('Functions: 1')
    })

    it('should format file sources', () => {
      const context: RAGContext = {
        sources: [
          {
            id: 'file-1',
            content: 'File content here',
            metadata: {
              title: 'document.txt',
              type: 'file',
              relevance: 0.8,
              timestamp: new Date().toISOString()
            }
          }
        ],
        totalTokens: 20,
        relevanceScore: 0.8
      }

      const formatted = service.formatContextForPrompt(context)

      expect(formatted).toContain('📁 From uploaded files:')
      expect(formatted).toContain('document.txt')
      expect(formatted).toContain('File content here')
    })

    it('should format web sources', () => {
      const context: RAGContext = {
        sources: [
          {
            id: 'web-1',
            content: 'Web snippet here',
            metadata: {
              title: 'Example Page',
              url: 'https://example.com',
              type: 'web',
              relevance: 0.9,
              timestamp: new Date().toISOString()
            }
          }
        ],
        webResults: [
          {
            title: 'Example Page',
            url: 'https://example.com',
            snippet: 'Web snippet here',
            relevance: 0.9,
            timestamp: new Date().toISOString()
          }
        ],
        totalTokens: 25,
        relevanceScore: 0.9
      }

      const formatted = service.formatContextForPrompt(context)

      expect(formatted).toContain('🌐 From web search:')
      expect(formatted).toContain('Example Page')
      expect(formatted).toContain('https://example.com')
      expect(formatted).toContain('Web snippet here')
    })

    it('should format mixed source types', () => {
      const context: RAGContext = {
        sources: [
          {
            id: 'code-1',
            content: "import React from 'react'",
            metadata: {
              title: 'React',
              type: 'code',
              category: 'import',
              relevance: 0.9,
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'file-1',
            content: 'File content',
            metadata: {
              title: 'doc.txt',
              type: 'file',
              relevance: 0.7,
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'web-1',
            content: 'Web content',
            metadata: {
              title: 'Page',
              url: 'https://example.com',
              type: 'web',
              relevance: 0.8,
              timestamp: new Date().toISOString()
            }
          }
        ],
        codeAnalysis: {
          imports: 1,
          types: 0,
          functions: 0,
          relatedCode: 0,
          conventions: 0,
          totalTokens: 10,
          relevanceScore: 0.9
        },
        totalTokens: 50,
        relevanceScore: 0.8
      }

      const formatted = service.formatContextForPrompt(context)

      expect(formatted).toContain('💻 From code analysis:')
      expect(formatted).toContain('📁 From uploaded files:')
      expect(formatted).toContain('🌐 From web search:')
      expect(formatted).toContain('📊 Code Analysis Stats:')
      expect(formatted).toContain('Context relevance: 80.0%')
      expect(formatted).toContain('Total sources: 3')
      expect(formatted).toContain('Total tokens: 50')
    })

    it('should include all statistics', () => {
      const context: RAGContext = {
        sources: [
          {
            id: 'code-1',
            content: 'test',
            metadata: {
              type: 'code',
              category: 'import',
              relevance: 0.9,
              timestamp: new Date().toISOString()
            }
          }
        ],
        codeAnalysis: {
          imports: 5,
          types: 3,
          functions: 7,
          relatedCode: 10,
          conventions: 4,
          totalTokens: 250,
          relevanceScore: 0.88
        },
        totalTokens: 300,
        relevanceScore: 0.85
      }

      const formatted = service.formatContextForPrompt(context)

      expect(formatted).toContain('Imports: 5')
      expect(formatted).toContain('Types: 3')
      expect(formatted).toContain('Functions: 7')
      expect(formatted).toContain('Related Code: 10')
      expect(formatted).toContain('Conventions: 4')
      expect(formatted).toContain('Code Tokens: 250')
      expect(formatted).toContain('Context relevance: 85.0%')
      expect(formatted).toContain('Total tokens: 300')
    })
  })

  describe('RAG source types', () => {
    it('should support all source types', () => {
      const codeSource: RAGSource = {
        id: 'code-1',
        content: 'code',
        metadata: {
          type: 'code',
          category: 'import',
          relevance: 0.9,
          timestamp: new Date().toISOString()
        }
      }

      const fileSource: RAGSource = {
        id: 'file-1',
        content: 'file',
        metadata: {
          type: 'file',
          title: 'doc.txt',
          relevance: 0.8,
          timestamp: new Date().toISOString()
        }
      }

      const webSource: RAGSource = {
        id: 'web-1',
        content: 'web',
        metadata: {
          type: 'web',
          title: 'Page',
          url: 'https://example.com',
          relevance: 0.7,
          timestamp: new Date().toISOString()
        }
      }

      expect(codeSource.metadata.type).toBe('code')
      expect(fileSource.metadata.type).toBe('file')
      expect(webSource.metadata.type).toBe('web')
    })

    it('should support code categories', () => {
      const categories = ['import', 'type', 'function', 'related', 'convention']

      categories.forEach(category => {
        const source: RAGSource = {
          id: `code-${category}`,
          content: 'test',
          metadata: {
            type: 'code',
            category,
            relevance: 0.8,
            timestamp: new Date().toISOString()
          }
        }

        expect(source.metadata.category).toBe(category)
      })
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      const { enhancedRAGService } = require('../rag-enhanced')
      expect(enhancedRAGService).toBeInstanceOf(EnhancedRAGService)
    })
  })
})
