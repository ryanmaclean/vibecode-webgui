# AgenticRAG: Enhanced RAG with AI-Driven Retrieval Strategy Selection

## Overview

AgenticRAG enhances the existing RAG (Retrieval-Augmented Generation) system by introducing AI-driven retrieval strategy selection. Instead of using a fixed retrieval approach, the system uses an AI agent to analyze each query and dynamically select the optimal combination of retrieval strategies.

## Key Features

### 🧠 Dynamic Strategy Planning
- AI analyzes query complexity and content type
- Automatically selects optimal retrieval strategies
- Provides reasoning for strategy selection

### 🔄 Multi-Strategy Retrieval
- **Semantic Search**: Vector similarity for conceptual queries
- **Keyword Search**: Exact term matching for specific facts
- **Hybrid Search**: Combines semantic and keyword approaches

### 🔗 Multi-Hop Reasoning
- Automatically detects queries requiring additional context
- Generates follow-up queries for comprehensive coverage
- Synthesizes results from multiple reasoning hops

### 📊 Intelligent Result Synthesis
- Deduplicates and ranks results across strategies
- Enhanced relevance scoring considering multiple factors
- Transparent reasoning and strategy explanations

## Architecture

```
Query Input
    ↓
[Strategy Planning] ← AI Agent Analysis
    ↓
[Strategy Execution]
    ├── Semantic Search
    ├── Keyword Search  
    └── Hybrid Search
    ↓
[Multi-Hop Reasoning] (if needed)
    ↓
[Result Synthesis]
    ↓
Enhanced Context Output
```

## Quick Start

### Basic Usage

```typescript
import { createAgenticRAGService } from '@/lib/services/agentic-rag'
import { UnifiedAIClient } from '@/lib/unified-ai-client'

const aiClient = new UnifiedAIClient(userApiKeys)
const agenticRAG = createAgenticRAGService(aiClient)

const context = await agenticRAG.buildAgenticContext({
  query: 'Compare React and Vue.js for enterprise applications',
  workspaceId: 'my-workspace',
  enableAgenticRetrieval: true,
  maxStrategies: 3,
  complexityLevel: 'complex'
})

console.log('Strategies used:', context.strategiesUsed)
console.log('Sources found:', context.sources.length)
console.log('Relevance score:', context.relevanceScore)
```

### Chat API Integration

```typescript
// Enable in chat requests
const chatRequest = {
  message: 'Explain React hooks vs class components',
  model: 'gpt-4',
  context: {
    workspaceId: 'react-project',
    files: [],
    previousMessages: [],
    enableAgenticRAG: true  // 🔥 Enable agentic retrieval
  }
}
```

## API Reference

### AgenticRAGService

#### `buildAgenticContext(query: AgenticRAGQuery): Promise<AgenticRAGContext>`

Main method for building enhanced context with agentic retrieval.

**Parameters:**

```typescript
interface AgenticRAGQuery {
  query: string                    // User query
  workspaceId: string             // Workspace identifier
  enableAgenticRetrieval?: boolean // Enable AI-driven strategy selection
  maxStrategies?: number          // Maximum strategies to use (default: 3)
  complexityLevel?: 'simple' | 'medium' | 'complex'  // Query complexity
  requiresMultiHop?: boolean      // Force multi-hop reasoning
  maxFileResults?: number         // Max file search results
  maxWebResults?: number          // Max web search results
  includeWebSearch?: boolean      // Include web search
  timeFilter?: 'day' | 'week' | 'month' | 'year'  // Time-based filtering
}
```

**Returns:**

```typescript
interface AgenticRAGContext {
  sources: RAGSource[]            // Retrieved sources
  strategiesUsed: RetrievalStrategy[]  // Strategies executed
  multiHopResults?: MultiHopResult[]   // Multi-hop reasoning results
  synthesisReasoning: string      // Explanation of synthesis process
  relevanceScore: number          // Overall relevance (0-1)
  totalTokens: number            // Estimated token count
  webResults?: WebSearchResult[]  // Web search results (if enabled)
}
```

### Retrieval Strategies

#### Strategy Types

1. **Semantic Search** (`semantic`)
   - Uses vector similarity for conceptual matching
   - Best for: Abstract concepts, related ideas, semantic relationships
   - Parameters: `similarityThreshold`, `maxResults`

2. **Keyword Search** (`keyword`)
   - Exact term matching and relevance scoring
   - Best for: Specific technical terms, API names, function names
   - Parameters: `maxResults`

3. **Hybrid Search** (`hybrid`)
   - Combines semantic and keyword approaches
   - Best for: Balanced retrieval, general queries
   - Parameters: `semanticWeight`, `keywordWeight`, `maxResults`

#### Strategy Selection Logic

The AI agent considers:
- Query complexity and length
- Presence of technical terms or quotes
- Comparison or analysis keywords
- Historical performance patterns

## Configuration Options

### Complexity Levels

```typescript
const complexityMapping = {
  'simple': {
    description: 'Single concept, direct questions',
    examples: ['What is React?', 'Define REST API'],
    defaultStrategies: ['hybrid'],
    enableMultiHop: false
  },
  
  'medium': {
    description: 'Implementation questions, how-to queries',
    examples: ['How to use React hooks?', 'Setup JWT auth'],
    defaultStrategies: ['hybrid', 'keyword'],
    enableMultiHop: false
  },
  
  'complex': {
    description: 'Comparisons, analysis, multi-part questions',
    examples: ['Compare React vs Vue for enterprise', 'Analyze performance patterns'],
    defaultStrategies: ['semantic', 'keyword', 'hybrid'],
    enableMultiHop: true
  }
}
```

### Performance Tuning

```typescript
const performanceConfig = {
  maxStrategies: 3,        // Limit concurrent strategies
  strategyTimeout: 5000,   // Max time per strategy (ms)
  multiHopLimit: 2,        // Max follow-up queries
  cacheResults: true,      // Cache strategy results
  fallbackEnabled: true    // Enable standard RAG fallback
}
```

## Best Practices

### When to Use AgenticRAG

✅ **Recommended for:**
- Complex comparison queries
- Technical implementation questions
- Multi-faceted research queries
- Queries requiring synthesis of multiple sources
- When comprehensive context is more important than speed

❌ **Standard RAG preferred for:**
- Simple fact-based questions
- Direct API reference lookups
- Performance-critical scenarios
- When AI client is unavailable

### Query Optimization

```typescript
// ✅ Good: Specific, well-structured queries
const goodQueries = [
  'Compare React Server Components vs traditional components for SEO and performance',
  'Implement JWT authentication middleware in Express.js with refresh tokens',
  'Explain the relationship between React hooks and component lifecycle methods'
]

// ❌ Avoid: Vague or overly broad queries
const poorQueries = [
  'Tell me about programming',
  'What should I do?',
  'Fix my code'
]
```

### Error Handling

```typescript
try {
  const context = await agenticRAG.buildAgenticContext({
    query: userQuery,
    workspaceId: workspace.id,
    enableAgenticRetrieval: true
  })
  
  return context
  
} catch (error) {
  console.warn('AgenticRAG failed, falling back to standard RAG:', error)
  
  // Graceful fallback
  return await agenticRAG.buildAgenticContext({
    query: userQuery,
    workspaceId: workspace.id,
    enableAgenticRetrieval: false
  })
}
```

## Performance Considerations

### Latency Impact

| Strategy Count | Avg Latency | Use Case |
|---------------|-------------|----------|
| 1 (Standard)  | ~500ms     | Simple queries |
| 2-3 (Agentic) | ~1.5-2s    | Complex queries |
| Multi-hop     | +500ms/hop | Comprehensive analysis |

### Resource Usage

- **AI Client Calls**: 1-3 per query (strategy planning + follow-ups)
- **Token Consumption**: ~200-500 tokens for strategy planning
- **Memory**: Proportional to number of sources retrieved

### Optimization Tips

1. **Limit Strategies**: Use `maxStrategies: 2` for faster responses
2. **Disable Multi-hop**: Set `requiresMultiHop: false` when not needed
3. **Cache Results**: Implement strategy result caching for repeated queries
4. **Async Processing**: Consider background processing for non-interactive use cases

## Monitoring and Debugging

### Strategy Analysis

```typescript
const context = await agenticRAG.buildAgenticContext(query)

console.log('Strategy Performance:')
context.strategiesUsed.forEach(strategy => {
  console.log(`- ${strategy.name}: ${strategy.confidence} confidence`)
  console.log(`  Reasoning: ${strategy.reasoning}`)
})

console.log('Synthesis:', context.synthesisReasoning)
console.log('Relevance:', (context.relevanceScore * 100).toFixed(1) + '%')
```

### Debug Mode

```typescript
// Enable detailed logging
process.env.AGENTIC_RAG_DEBUG = 'true'

const context = await agenticRAG.buildAgenticContext({
  query: 'debug query',
  workspaceId: 'test',
  enableAgenticRetrieval: true
})
```

## Integration Examples

### Next.js API Route

```typescript
// /api/ai/chat/unified/route.ts
const ragResult = context.enableAgenticRAG 
  ? await buildAgenticRAGContext(context.workspaceId, message, session.user.id, aiClient)
  : await buildAdvancedRAGContext(context.workspaceId, message, session.user.id)

const systemMessage = `Based on the following context (${ragResult?.relevanceScore} relevance):
${ragResult?.context || 'No context available'}

${ragResult?.agenticInfo ? `
Strategies used: ${ragResult.agenticInfo.strategiesUsed.join(', ')}
Synthesis: ${ragResult.agenticInfo.synthesisReasoning}
` : ''}`
```

### React Hook

```typescript
import { useAgenticRAG } from '@/hooks/useAgenticRAG'

function ChatComponent() {
  const { buildContext, loading, error } = useAgenticRAG()
  
  const handleQuery = async (query: string) => {
    const context = await buildContext({
      query,
      workspaceId: currentWorkspace.id,
      enableAgenticRetrieval: true,
      complexityLevel: 'medium'
    })
    
    // Use context for AI chat
    sendToAI(query, context)
  }
}
```

## Testing

### Unit Tests

```bash
npm test -- --testPathPatterns="agentic-rag.test.ts"
```

### Integration Tests

```bash
npx tsx src/lib/services/agentic-rag-integration.ts
```

### Demo

```bash
npx tsx src/lib/services/agentic-rag-demo.ts
```

## Migration Guide

### From Standard RAG

```typescript
// Before: Standard RAG
const context = await enhancedRAGService.buildContext({
  query: userQuery,
  workspaceId: workspace.id
})

// After: AgenticRAG (backward compatible)
const agenticRAG = createAgenticRAGService(aiClient)
const context = await agenticRAG.buildAgenticContext({
  query: userQuery,
  workspaceId: workspace.id,
  enableAgenticRetrieval: true  // Enable new features
})
```

### Gradual Rollout

```typescript
const useAgenticRAG = experimentalFeatures.agenticRAG && 
                     queryComplexity > 'simple' &&
                     userTier === 'premium'

const context = await (useAgenticRAG 
  ? agenticRAG.buildAgenticContext(query)
  : enhancedRAGService.buildContext(query))
```

## Troubleshooting

### Common Issues

1. **Strategy Planning Fails**
   - Check AI client configuration and API keys
   - Verify network connectivity
   - Falls back to default strategies automatically

2. **Poor Relevance Scores**
   - Ensure vector store is properly indexed
   - Check query complexity level setting
   - Consider enabling multi-hop reasoning

3. **High Latency**
   - Reduce `maxStrategies` count
   - Disable multi-hop for simple queries
   - Use standard RAG for performance-critical paths

### Debug Logs

```typescript
console.log('AgenticRAG Debug Info:', {
  strategiesPlanned: context.strategiesUsed.length,
  sourcesRetrieved: context.sources.length,
  multiHopResults: context.multiHopResults?.length,
  relevanceScore: context.relevanceScore,
  executionTime: performance.now() - startTime
})
```

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines on:
- Adding new retrieval strategies
- Improving strategy planning logic
- Enhancing result synthesis algorithms
- Performance optimizations

## License

This implementation follows the same license as the main project (MIT).