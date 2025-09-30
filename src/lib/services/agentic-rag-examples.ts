/**
 * AgenticRAG Usage Examples and API Documentation
 * Demonstrates practical usage patterns for the enhanced RAG system
 */

import { AgenticRAGService, createAgenticRAGService } from './agentic-rag'
import { UnifiedAIClient } from '../unified-ai-client'

/**
 * Example 1: Basic Usage with Agentic Retrieval
 */
export async function basicAgenticRAGExample(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  const context = await agenticRAG.buildAgenticContext({
    query: 'How to implement authentication in Next.js',
    workspaceId: 'my-workspace-123',
    enableAgenticRetrieval: true
  })

  console.log('Strategies used:', context.strategiesUsed.map(s => s.name))
  console.log('Relevance score:', context.relevanceScore)
  console.log('Total sources:', context.sources.length)
  
  return context
}

/**
 * Example 2: Complex Query with Multi-hop Reasoning
 */
export async function complexQueryExample(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  const context = await agenticRAG.buildAgenticContext({
    query: 'Compare React Server Components vs traditional React components for performance and SEO',
    workspaceId: 'my-workspace-123',
    enableAgenticRetrieval: true,
    maxStrategies: 3,
    complexityLevel: 'complex',
    requiresMultiHop: true
  })

  console.log('Multi-hop results:', context.multiHopResults?.length || 0)
  console.log('Synthesis reasoning:', context.synthesisReasoning)
  
  // Format for AI prompt
  const formattedContext = agenticRAG.formatAgenticContextForPrompt(context)
  console.log('Formatted context length:', formattedContext.length)
  
  return { context, formattedContext }
}

/**
 * Example 3: Fallback to Standard RAG
 */
export async function fallbackExample(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  const context = await agenticRAG.buildAgenticContext({
    query: 'What is TypeScript?',
    workspaceId: 'my-workspace-123',
    enableAgenticRetrieval: false  // Disabled - uses standard RAG
  })

  console.log('Fallback strategy:', context.strategiesUsed[0].name)
  console.log('Sources found:', context.sources.length)
  
  return context
}

/**
 * Example 4: Integration with Chat API
 */
export async function chatAPIIntegrationExample() {
  const chatRequest = {
    message: 'Explain the differences between useState and useReducer hooks',
    model: 'gpt-4',
    context: {
      workspaceId: 'react-project-456',
      files: [],
      previousMessages: [],
      enableAgenticRAG: true  // Enable agentic retrieval
    },
    enableTools: true,
    userApiKeys: {
      openai: process.env.OPENAI_API_KEY
    }
  }

  console.log('Chat request with AgenticRAG enabled:', chatRequest)
  
  // This would be sent to /api/ai/chat/unified
  return chatRequest
}

/**
 * Example 5: Strategy-specific Configuration
 */
export async function advancedConfigurationExample(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  // Technical query - likely to use keyword + semantic strategies
  const technicalContext = await agenticRAG.buildAgenticContext({
    query: 'JWT token validation middleware implementation in Express.js',
    workspaceId: 'backend-project-789',
    enableAgenticRetrieval: true,
    maxStrategies: 2,
    complexityLevel: 'medium'
  })

  // Conceptual query - likely to use semantic + hybrid strategies  
  const conceptualContext = await agenticRAG.buildAgenticContext({
    query: 'What are the principles of clean architecture?',
    workspaceId: 'architecture-project-101',
    enableAgenticRetrieval: true,
    maxStrategies: 2,
    complexityLevel: 'complex'
  })

  return {
    technical: technicalContext,
    conceptual: conceptualContext
  }
}

/**
 * API Response Format Examples
 */
export interface AgenticRAGResponse {
  context: string                    // Formatted context for AI prompt
  workspaceId: string               // Workspace identifier
  relevanceScore: 'high' | 'medium' | 'low'  // Overall relevance assessment
  strategiesUsed: number            // Number of strategies executed
  totalLength: number               // Total character count of context
  agenticInfo?: {                   // Additional agentic-specific information
    strategiesUsed: string[]        // Names of strategies used
    multiHopResults: number         // Number of multi-hop expansions
    synthesisReasoning: string      // Explanation of synthesis process
  }
}

/**
 * Best Practices for Using AgenticRAG
 */
export const AGENTIC_RAG_BEST_PRACTICES = {
  
  // When to enable agentic retrieval
  enableFor: [
    'Complex comparison queries',
    'Technical implementation questions', 
    'Multi-faceted research queries',
    'Queries requiring synthesis of multiple sources'
  ],

  // When to use standard RAG
  standardRAGFor: [
    'Simple fact-based questions',
    'Direct API reference lookups',
    'Performance-critical scenarios',
    'When AI client is unavailable'
  ],

  // Complexity level guidelines
  complexityLevels: {
    simple: 'Single concept, direct questions (e.g., "What is React?")',
    medium: 'Implementation questions, how-to queries (e.g., "How to use hooks?")',
    complex: 'Comparisons, analysis, multi-part questions (e.g., "Compare React vs Vue for enterprise")'
  },

  // Performance considerations
  performance: {
    strategiesLimit: 'Limit maxStrategies to 3 for optimal performance',
    multiHop: 'Multi-hop reasoning adds latency but improves coverage',
    fallback: 'Always have fallback to standard RAG for reliability'
  }
}

/**
 * Error Handling Patterns
 */
export async function errorHandlingExample(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  try {
    const context = await agenticRAG.buildAgenticContext({
      query: 'Test query',
      workspaceId: 'test-workspace',
      enableAgenticRetrieval: true
    })
    
    return context
    
  } catch (error) {
    console.error('AgenticRAG failed:', error)
    
    // Fallback to standard RAG
    const fallbackContext = await agenticRAG.buildAgenticContext({
      query: 'Test query',
      workspaceId: 'test-workspace', 
      enableAgenticRetrieval: false
    })
    
    return fallbackContext
  }
}

/**
 * Testing Utilities
 */
export function createMockAIClient(): UnifiedAIClient {
  return {
    async chat(messages, model) {
      // Mock response for strategy planning
      if (messages[1]?.content?.includes('Analyze this query')) {
        return {
          content: JSON.stringify({
            strategies: [{
              name: 'mock-strategy',
              type: 'hybrid',
              confidence: 0.8,
              reasoning: 'Mock strategy for testing',
              parameters: { maxResults: 5 }
            }]
          }),
          model: model || 'gpt-4o-mini',
          provider: 'mock'
        }
      }
      
      return {
        content: 'Mock response',
        model: model || 'gpt-4o-mini',
        provider: 'mock'
      }
    },
    
    async stream() {
      throw new Error('Not implemented in mock')
    },
    
    async getAvailableModels() {
      return [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }]
    },
    
    async validateProvider() {
      return true
    }
  } as UnifiedAIClient
}

/**
 * Performance Monitoring
 */
export async function measureAgenticRAGPerformance(aiClient: UnifiedAIClient) {
  const agenticRAG = createAgenticRAGService(aiClient)
  
  const startTime = performance.now()
  
  const context = await agenticRAG.buildAgenticContext({
    query: 'Performance test query',
    workspaceId: 'perf-test',
    enableAgenticRetrieval: true,
    maxStrategies: 2
  })
  
  const endTime = performance.now()
  const executionTime = endTime - startTime
  
  return {
    executionTime: `${executionTime.toFixed(2)}ms`,
    strategiesUsed: context.strategiesUsed.length,
    sourcesRetrieved: context.sources.length,
    relevanceScore: context.relevanceScore,
    multiHopResults: context.multiHopResults?.length || 0
  }
}

export default {
  basicAgenticRAGExample,
  complexQueryExample,
  fallbackExample,
  chatAPIIntegrationExample,
  advancedConfigurationExample,
  errorHandlingExample,
  createMockAIClient,
  measureAgenticRAGPerformance,
  AGENTIC_RAG_BEST_PRACTICES
}