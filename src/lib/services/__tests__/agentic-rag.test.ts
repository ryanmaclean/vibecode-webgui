/**
 * Test suite for AgenticRAGService
 */

import { AgenticRAGService, createAgenticRAGService } from '../agentic-rag'
import { UnifiedAIClient } from '../../unified-ai-client'

// Mock dependencies
jest.mock('../../unified-ai-client')
jest.mock('../../vector-store')
jest.mock('../web-search')

describe('AgenticRAGService', () => {
  let mockAIClient: jest.Mocked<UnifiedAIClient>;
  let agenticRAGService: AgenticRAGService;

  beforeEach(() => {
    // Create mock AI client
    mockAIClient = {
      chat: jest.fn(),
      stream: jest.fn(),
      getAvailableModels: jest.fn(),
      validateProvider: jest.fn()
    } as any

    agenticRAGService = new AgenticRAGService(mockAIClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('buildAgenticContext', () => {
    it('should return enhanced context with default strategy when agentic retrieval is disabled', async () => {
      const query = {
        query: 'test query',
        workspaceId: 'workspace-1',
        enableAgenticRetrieval: false
      }

      // Mock the parent class method
      const mockBaseContext = {
        sources: [],
        totalTokens: 0,
        relevanceScore: 0.5
      }
      
      jest.spyOn(agenticRAGService as any, 'buildContext').mockResolvedValue(mockBaseContext)

      const result = await agenticRAGService.buildAgenticContext(query)

      expect(result).toMatchObject({
        sources: [],
        totalTokens: 0,
        relevanceScore: 0.5,
        strategiesUsed: expect.arrayContaining([
          expect.objectContaining({
            name: 'default',
            type: 'hybrid',
            reasoning: 'Used default RAG strategy'
          })
        ]),
        synthesisReasoning: 'Default RAG synthesis applied'
      })
    })

    it('should plan and execute multiple strategies when agentic retrieval is enabled', async () => {
      const query = {
        query: 'complex technical question about machine learning',
        workspaceId: 'workspace-1',
        enableAgenticRetrieval: true,
        maxStrategies: 2
      }

      // Mock AI client response for strategy planning
      mockAIClient.chat.mockResolvedValueOnce({
        content: JSON.stringify({
          strategies: [
            {
              name: 'semantic-search',
              type: 'semantic',
              confidence: 0.9,
              reasoning: 'High conceptual complexity requires semantic understanding',
              parameters: {
                maxResults: 5,
                similarityThreshold: 0.8
              }
            },
            {
              name: 'keyword-search',
              type: 'keyword',
              confidence: 0.7,
              reasoning: 'Technical terms benefit from exact matching',
              parameters: {
                maxResults: 3
              }
            }
          ]
        }),
        model: 'gpt-4o-mini',
        provider: 'openai'
      })

      // Mock synthesis reasoning generation
      mockAIClient.chat.mockResolvedValueOnce({
        content: 'Applied semantic and keyword strategies for comprehensive coverage',
        model: 'gpt-4o-mini',
        provider: 'openai'
      })

      // Mock base context
      jest.spyOn(agenticRAGService as any, 'buildContext').mockResolvedValue({
        sources: [],
        totalTokens: 0,
        relevanceScore: 0.5
      })

      // Mock strategy execution methods
      jest.spyOn(agenticRAGService as any, 'executeSemanticStrategy').mockResolvedValue([
        {
          id: 'semantic-1',
          content: 'Machine learning is a subset of AI',
          metadata: {
            type: 'database',
            relevance: 0.9,
            title: 'ML Concept'
          }
        }
      ])

      jest.spyOn(agenticRAGService as any, 'executeKeywordStrategy').mockResolvedValue([
        {
          id: 'keyword-1',
          content: 'Neural networks use backpropagation',
          metadata: {
            type: 'file',
            relevance: 0.8,
            title: 'Neural Networks'
          }
        }
      ])

      const result = await agenticRAGService.buildAgenticContext(query)

      expect(result.strategiesUsed).toHaveLength(2)
      expect(result.strategiesUsed[0]).toMatchObject({
        name: 'semantic-search',
        type: 'semantic',
        confidence: 0.9
      })
      expect(result.strategiesUsed[1]).toMatchObject({
        name: 'keyword-search',
        type: 'keyword',
        confidence: 0.7
      })
      expect(mockAIClient.chat).toHaveBeenCalledTimes(1) // Strategy planning call
    })

    it('should handle strategy planning failures gracefully', async () => {
      const query = {
        query: 'test query',
        workspaceId: 'workspace-1',
        enableAgenticRetrieval: true
      }

      // Mock AI client to throw error
      mockAIClient.chat.mockRejectedValueOnce(new Error('API error'))

      // Mock base context
      jest.spyOn(agenticRAGService as any, 'buildContext').mockResolvedValue({
        sources: [],
        totalTokens: 0,
        relevanceScore: 0.5
      })

      // Mock fallback strategies
      jest.spyOn(agenticRAGService as any, 'getFallbackStrategies').mockReturnValue([
        {
          name: 'hybrid-fallback',
          type: 'hybrid',
          confidence: 0.7,
          reasoning: 'Fallback hybrid strategy',
          parameters: { maxResults: 8 }
        }
      ])

      jest.spyOn(agenticRAGService as any, 'executeHybridStrategy').mockResolvedValue([])

      const result = await agenticRAGService.buildAgenticContext(query)

      expect(result.strategiesUsed).toHaveLength(1)
      expect(result.strategiesUsed[0].name).toBe('hybrid-fallback')
    })
  })

  describe('strategy execution', () => {
    it('should execute semantic strategy correctly', async () => {
      const strategy = {
        name: 'semantic-test',
        type: 'semantic' as const,
        confidence: 0.9,
        reasoning: 'Test semantic strategy',
        parameters: {
          maxResults: 5,
          similarityThreshold: 0.8
        }
      }

      const query = {
        query: 'test query',
        workspaceId: '123'
      }

      // Mock vector store
      const mockVectorStore = require('../../vector-store')
      mockVectorStore.vectorStore.getContext.mockResolvedValue(
        'Test content chunk 1\n---\nTest content chunk 2'
      )

      const result = await (agenticRAGService as any).executeSemanticStrategy(strategy, query)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        content: 'Test content chunk 1',
        metadata: {
          type: 'database',
          title: 'Semantic Match 1'
        }
      })
      expect(mockVectorStore.vectorStore.getContext).toHaveBeenCalledWith(
        'test query',
        123,
        5,
        0.8
      )
    })

    it('should handle empty vector store results', async () => {
      const strategy = {
        name: 'semantic-test',
        type: 'semantic' as const,
        confidence: 0.9,
        reasoning: 'Test semantic strategy',
        parameters: { maxResults: 5 }
      }

      const query = {
        query: 'test query',
        workspaceId: '123'
      }

      const mockVectorStore = require('../../vector-store')
      mockVectorStore.vectorStore.getContext.mockResolvedValue('')

      const result = await (agenticRAGService as any).executeSemanticStrategy(strategy, query)

      expect(result).toHaveLength(0)
    })
  })

  describe('multi-hop reasoning', () => {
    it('should detect when multi-hop reasoning is needed', () => {
      const query = 'compare the relationship between React and Vue.js frameworks'
      const sources = [
        { metadata: { type: 'file' } },
        { metadata: { type: 'web' } },
        { metadata: { type: 'database' } }
      ]

      const result = (agenticRAGService as any).requiresMultiHop(query, sources)

      expect(result).toBe(true)
    })

    it('should not require multi-hop for simple queries', () => {
      const query = 'what is React'
      const sources = [
        { metadata: { type: 'file' } }
      ]

      const result = (agenticRAGService as any).requiresMultiHop(query, sources)

      expect(result).toBe(false)
    })

    it('should generate appropriate follow-up queries', async () => {
      const originalQuery = 'explain machine learning algorithms'
      const sources = [
        {
          content: 'Neural networks are a type of machine learning model that mimics the human brain',
          metadata: { type: 'file' }
        }
      ]

      mockAIClient.chat.mockResolvedValueOnce({
        content: 'What are the different types of neural network architectures?\nHow does backpropagation work in neural networks?\nWhat are the applications of deep learning?',
        model: 'gpt-4o-mini',
        provider: 'openai'
      })

      const result = await (agenticRAGService as any).generateFollowUpQueries(originalQuery, sources)

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('neural network architectures')
      expect(mockAIClient.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('expert at information discovery')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(originalQuery)
          })
        ]),
        'gpt-4o-mini'
      )
    })
  })

  describe('result synthesis', () => {
    it('should deduplicate similar sources', () => {
      const sources = [
        {
          id: '1',
          content: 'React is a JavaScript library for building user interfaces',
          metadata: { relevance: 0.9 }
        },
        {
          id: '2',
          content: 'React is a JavaScript library for building user interfaces',
          metadata: { relevance: 0.8 }
        },
        {
          id: '3',
          content: 'Vue.js is a progressive JavaScript framework',
          metadata: { relevance: 0.7 }
        }
      ]

      const result = (agenticRAGService as any).deduplicateSources(sources)

      expect(result).toHaveLength(2)
      expect(result.find((s: any) => s.content.includes('React'))).toBeDefined()
      expect(result.find((s: any) => s.content.includes('Vue.js'))).toBeDefined()
    })

    it('should calculate enhanced relevance score with multiple strategies', () => {
      const sources = [
        { metadata: { relevance: 0.9, type: 'file' } },
        { metadata: { relevance: 0.8, type: 'web' } },
        { metadata: { relevance: 0.7, type: 'database' } }
      ]

      const strategies = [
        { confidence: 0.9 },
        { confidence: 0.8 }
      ]

      const result = (agenticRAGService as any).calculateEnhancedRelevanceScore(sources, strategies)

      expect(result).toBeGreaterThan(0.8) // Should be high due to good sources and strategies
      expect(result).toBeLessThanOrEqual(1.0)
    })
  })

  describe('createAgenticRAGService factory', () => {
    it('should create and return singleton instance', () => {
      const instance1 = createAgenticRAGService(mockAIClient)
      const instance2 = createAgenticRAGService(mockAIClient)

      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(AgenticRAGService)
    })
  })

  describe('formatAgenticContextForPrompt', () => {
    it('should include strategy and multi-hop information in formatted output', () => {
      const context = {
        sources: [
          {
            id: '1',
            content: 'Test content',
            metadata: {
              type: 'file' as const,
              relevance: 0.9,
              title: 'Test File'
            }
          }
        ],
        totalTokens: 100,
        relevanceScore: 0.85,
        strategiesUsed: [
          {
            name: 'semantic-search',
            type: 'semantic' as const,
            confidence: 0.9,
            reasoning: 'Used for conceptual understanding',
            parameters: {}
          }
        ],
        multiHopResults: [
          {
            hop: 1,
            query: 'follow-up question',
            sources: [],
            reasoning: 'Additional context search'
          }
        ],
        synthesisReasoning: 'Applied 1 strategy with 1 multi-hop expansion'
      }

      const result = agenticRAGService.formatAgenticContextForPrompt(context)

      expect(result).toContain('🔍 Retrieval Strategy Analysis:')
      expect(result).toContain('semantic-search (semantic)')
      expect(result).toContain('🔗 Multi-hop Reasoning Results:')
      expect(result).toContain('Hop 1: follow-up question')
      expect(result).toContain('📊 Synthesis: Applied 1 strategy with 1 multi-hop expansion')
    })
  })
})