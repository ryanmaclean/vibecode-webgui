/**
 * Simple integration test for AgenticRAG without Jest dependencies
 * This validates the core functionality works as expected
 */

import { AgenticRAGService, createAgenticRAGService } from './agentic-rag'
import { UnifiedAIClient } from '../unified-ai-client'

// Simple mock AI client for testing
class MockAIClient implements UnifiedAIClient {
  async chat(messages: any[], model?: string) {
    // Mock strategy planning response
    if (messages[1]?.content?.includes('Analyze this query')) {
      return {
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
            }
          ]
        }),
        model: 'gpt-4o-mini',
        provider: 'openai'
      }
    }

    // Mock follow-up query generation
    if (messages[1]?.content?.includes('generate 2-3 follow-up queries')) {
      return {
        content: 'What are neural network architectures?\nHow does backpropagation work?',
        model: 'gpt-4o-mini',
        provider: 'openai'
      }
    }

    return {
      content: 'Test response',
      model: 'gpt-4o-mini',
      provider: 'openai'
    }
  }

  async stream() {
    throw new Error('Not implemented for test')
  }

  async getAvailableModels() {
    return []
  }

  async validateProvider() {
    return true
  }
}

/**
 * Run integration tests
 */
export async function runAgenticRAGTests(): Promise<void> {
  console.log('🧪 Running AgenticRAG Integration Tests...')

  const mockAIClient = new MockAIClient()
  const agenticRAG = new AgenticRAGService(mockAIClient)

  try {
    // Test 1: Basic context building with agentic retrieval disabled
    console.log('  ✓ Test 1: Basic context building...')
    const basicQuery = {
      query: 'What is React?',
      workspaceId: 'test-workspace',
      enableAgenticRetrieval: false
    }

    const basicContext = await agenticRAG.buildAgenticContext(basicQuery)
    
    if (!basicContext.strategiesUsed || basicContext.strategiesUsed.length === 0) {
      throw new Error('Expected at least one strategy to be used')
    }

    if (basicContext.strategiesUsed[0].name !== 'default') {
      throw new Error('Expected default strategy when agentic retrieval is disabled')
    }

    console.log('    ✓ Basic context building works correctly')

    // Test 2: Strategy planning functionality
    console.log('  ✓ Test 2: Strategy planning...')
    const complexQuery = {
      query: 'compare React and Vue.js frameworks for enterprise applications',
      workspaceId: 'test-workspace',
      enableAgenticRetrieval: true,
      maxStrategies: 2,
      complexityLevel: 'complex' as const
    }

    const agenticContext = await agenticRAG.buildAgenticContext(complexQuery)
    
    if (!agenticContext.strategiesUsed || agenticContext.strategiesUsed.length === 0) {
      throw new Error('Expected strategies to be planned and executed')
    }

    if (!agenticContext.synthesisReasoning) {
      throw new Error('Expected synthesis reasoning to be provided')
    }

    console.log('    ✓ Strategy planning works correctly')

    // Test 3: Multi-hop detection
    console.log('  ✓ Test 3: Multi-hop detection...')
    const multiHopQuery = 'compare the relationship between React and Vue.js'
    const sources = [
      { metadata: { type: 'file' as const } },
      { metadata: { type: 'web' as const } },
      { metadata: { type: 'database' as const } }
    ]

    const requiresMultiHop = (agenticRAG as any).requiresMultiHop(multiHopQuery, sources)
    
    if (!requiresMultiHop) {
      throw new Error('Expected multi-hop reasoning to be detected for comparison queries')
    }

    console.log('    ✓ Multi-hop detection works correctly')

    // Test 4: Factory function
    console.log('  ✓ Test 4: Factory function...')
    const instance1 = createAgenticRAGService(mockAIClient)
    const instance2 = createAgenticRAGService(mockAIClient)
    
    if (instance1 !== instance2) {
      throw new Error('Expected factory to return singleton instance')
    }

    console.log('    ✓ Factory function works correctly')

    // Test 5: Fallback strategies
    console.log('  ✓ Test 5: Fallback strategies...')
    const fallbackStrategies = (agenticRAG as any).getFallbackStrategies(
      'technical query with "specific terms"',
      'complex'
    )
    
    if (!fallbackStrategies || fallbackStrategies.length === 0) {
      throw new Error('Expected fallback strategies to be generated')
    }

    const hasHybrid = fallbackStrategies.some((s: any) => s.type === 'hybrid')
    const hasKeyword = fallbackStrategies.some((s: any) => s.type === 'keyword')
    
    if (!hasHybrid) {
      throw new Error('Expected hybrid strategy in fallback')
    }

    if (!hasKeyword) {
      throw new Error('Expected keyword strategy for queries with specific terms')
    }

    console.log('    ✓ Fallback strategies work correctly')

    console.log('✅ All AgenticRAG integration tests passed!')

  } catch (error) {
    console.error('❌ AgenticRAG test failed:', error)
    throw error
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAgenticRAGTests()
    .then(() => {
      console.log('✅ Integration tests completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Integration tests failed:', error)
      process.exit(1)
    })
}