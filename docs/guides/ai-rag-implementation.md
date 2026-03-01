# AI RAG and Multi-Agent Implementation Guide

Welcome to the comprehensive guide for implementing Retrieval-Augmented Generation (RAG) and multi-agent workflows in VibeCode WebGUI. This guide covers vector embeddings, semantic search, context management, and agent coordination patterns.

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [Vector Embeddings](#-vector-embeddings)
- [RAG System Architecture](#-rag-system-architecture)
- [Semantic Search Integration](#-semantic-search-integration)
- [Multi-Agent Workflows](#-multi-agent-workflows)
- [Context Management](#-context-management)
- [Performance Optimization](#-performance-optimization)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)

## 🚀 Quick Start

### 1. Initialize the RAG System

```typescript
import { ragSystem } from '@/lib/rag';

// Initialize the system (connects to vector store and cache)
await ragSystem.initialize();

// Ingest documents
await ragSystem.ingest({
  content: 'Your document content here',
  metadata: {
    title: 'Document Title',
    source: 'source-identifier',
    timestamp: new Date().toISOString()
  }
});

// Search for relevant documents
const results = await ragSystem.search('your search query', {
  limit: 10,
  threshold: 0.7,
  useCache: true
});

// Generate AI-powered answer with context
const { answer, sources } = await ragSystem.query('your question');
console.log(answer);
console.log(`Based on ${sources.length} source documents`);
```

### 2. Simple Semantic Search

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingServiceFactory } from '@/lib/ai/embeddingServiceFactory';
import { prisma } from '@/lib/prisma';

// Generate embedding for search query
const embeddingFactory = new EmbeddingServiceFactory(prisma);
const embeddingService = embeddingFactory.createEmbeddingServiceFromEnv();
const queryEmbedding = await embeddingService.generateEmbedding('search query');

// Perform vector similarity search
const results = await prisma.$queryRaw`
  SELECT
    id,
    content,
    (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) as distance
  FROM rag_chunks
  WHERE project_id = ${projectId}
  ORDER BY embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector
  LIMIT 10
`;
```

### 3. Multi-Agent Tool Registration

```typescript
import { ToolRegistry } from '@/lib/agents/tool-registry';

const registry = new ToolRegistry();

// Register a custom tool
registry.register(
  'code_analyzer',
  {
    description: 'Analyzes code quality and suggests improvements',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' }
      },
      required: ['code', 'language']
    }
  },
  async ({ code, language }) => {
    // Your analysis logic here
    return {
      status: 'success',
      issues: [],
      suggestions: []
    };
  },
  {
    category: 'development',
    tags: ['code-quality', 'analysis'],
    rateLimit: { maxCalls: 100, windowMs: 60000 }
  }
);
```

## 🔢 Vector Embeddings

### Embedding Providers

VibeCode supports multiple embedding providers with automatic failover:

| Provider | Model | Dimension | Use Case |
|----------|-------|-----------|----------|
| **OpenAI** | text-embedding-3-small | 1536 | General purpose, fast |
| **OpenAI** | text-embedding-3-large | 3072 | High accuracy |
| **Azure OpenAI** | text-embedding-ada-002 | 1536 | Enterprise, compliance |
| **Local (MLX)** | Custom models | Variable | Offline, privacy |

### Generating Embeddings

```typescript
import { embeddingService } from '@/lib/rag/embeddings';

// Single text embedding
const embedding = await embeddingService.generate('text to embed');
// Returns: number[] (e.g., [0.123, -0.456, ...])

// Batch embeddings (more efficient)
const texts = ['text 1', 'text 2', 'text 3'];
const embeddings = await embeddingService.generateBatch(texts);
// Returns: number[][] (array of embeddings)
```

### Custom Embedding Provider

```typescript
import { IVectorEmbeddingProvider } from '@/lib/vector/interfaces';

class CustomEmbeddingProvider implements IVectorEmbeddingProvider {
  private modelName: string;
  private dimension: number;

  constructor(config: { model: string; dimension: number }) {
    this.modelName = config.model;
    this.dimension = config.dimension;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Your custom embedding logic
    // Could be local model, API call, etc.
    const response = await fetch('your-embedding-endpoint', {
      method: 'POST',
      body: JSON.stringify({ text, model: this.modelName })
    });

    const { embedding } = await response.json();
    return embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch processing for efficiency
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  getDimension(): number {
    return this.dimension;
  }

  getModelName(): string {
    return this.modelName;
  }
}
```

### Embedding Best Practices

1. **Batch Processing**: Always use batch endpoints for multiple documents
2. **Caching**: Cache embeddings to reduce API calls and costs
3. **Normalization**: Normalize embeddings for cosine similarity
4. **Chunking**: Split large documents into chunks (500-1000 tokens optimal)
5. **Metadata**: Include metadata for filtering and ranking

```typescript
// Efficient batch ingestion with chunking
async function ingestCodebase(files: Array<{ path: string; content: string }>) {
  const chunks: Array<{ content: string; metadata: any }> = [];

  for (const file of files) {
    // Chunk file into manageable pieces
    const fileChunks = chunkCode(file.content, {
      maxTokens: 800,
      overlap: 100
    });

    fileChunks.forEach((chunk, index) => {
      chunks.push({
        content: chunk.content,
        metadata: {
          filePath: file.path,
          fileName: file.path.split('/').pop(),
          language: detectLanguage(file.path),
          chunkIndex: index,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        }
      });
    });
  }

  // Batch ingest for efficiency
  const ids = await ragSystem.ingestBatch(chunks);
  console.log(`Ingested ${ids.length} chunks from ${files.length} files`);
}
```

## 🏗️ RAG System Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    RAG System                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Embedding  │  │    Vector    │  │    Cache     │  │
│  │   Service   │→ │    Store     │→ │  (Valkey)    │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                 ↓                  ↓          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         PostgreSQL with pgvector                │   │
│  │  - Vector storage (cosine similarity)           │   │
│  │  - Metadata indexing                            │   │
│  │  - Full-text search                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### RAG System API

```typescript
import { ragSystem, RAGDocument, RAGSearchOptions } from '@/lib/rag';

// Core operations
interface RAGSystemInterface {
  // Initialization
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Ingestion
  ingest(doc: RAGDocument): Promise<string>;
  ingestBatch(docs: RAGDocument[]): Promise<string[]>;

  // Retrieval
  search(query: string, options?: RAGSearchOptions): Promise<SearchResult[]>;

  // Generation
  generateAnswer(query: string, results: SearchResult[]): Promise<string>;

  // Complete RAG pipeline
  query(query: string, options?: RAGSearchOptions): Promise<{
    answer: string;
    sources: SearchResult[];
  }>;

  // Maintenance
  getStats(): Promise<SystemStats>;
  rebuildIndex(): Promise<void>;
  clearCache(): Promise<void>;
}
```

### Configuration

```typescript
// Vector store configuration
const vectorStoreConfig = {
  provider: 'pgvector', // 'pgvector' | 'redis' | 'cosmosdb' | 'sqlserver'
  embedding: {
    provider: 'openai',  // 'openai' | 'azure' | 'local'
    model: 'text-embedding-3-small',
    dimension: 1536
  },
  cache: {
    enabled: true,
    provider: 'redis',
    ttl: {
      default: 3600,    // 1 hour
      min: 60,          // 1 minute
      max: 86400        // 24 hours
    }
  },
  search: {
    defaultLimit: 10,
    defaultThreshold: 0.7,
    maxLimit: 100
  }
};
```

### Environment Variables

```bash
# Embedding Service
OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002

# Vector Database
DATABASE_URL=postgresql://user:pass@host:port/db
# Ensure pgvector extension is enabled: CREATE EXTENSION IF NOT EXISTS vector;

# Cache (Valkey/Redis)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# RAG Configuration
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=100
RAG_DEFAULT_THRESHOLD=0.7
RAG_MAX_CONTEXT_LENGTH=16000
```

## 🔍 Semantic Search Integration

### Cosine Similarity Search

```typescript
// pgvector uses <=> operator for cosine distance
// Distance range: [0, 2] where 0 = identical, 2 = opposite
// Convert to similarity: similarity = 1 - (distance / 2)

async function semanticSearch(
  query: string,
  projectId: number,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {}
) {
  const { limit = 10, minSimilarity = 0.7 } = options;

  // Generate query embedding
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // Vector similarity search
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      content,
      metadata,
      start_line,
      end_line,
      chunk_index,
      (embedding <=> ${embeddingString}::vector) as distance
    FROM rag_chunks
    WHERE project_id = ${projectId}
    ORDER BY embedding <=> ${embeddingString}::vector
    LIMIT ${limit * 2}
  `;

  // Convert distance to similarity and filter
  return results
    .map(row => ({
      ...row,
      similarity: 1 - (row.distance / 2)
    }))
    .filter(r => r.similarity >= minSimilarity)
    .slice(0, limit);
}
```

### Hybrid Search (Vector + Full-Text)

```typescript
// Combine semantic search with keyword search for best results
async function hybridSearch(
  query: string,
  projectId: number,
  options: {
    limit?: number;
    vectorWeight?: number;  // 0-1, weight for vector search
    textWeight?: number;    // 0-1, weight for text search
  } = {}
) {
  const {
    limit = 10,
    vectorWeight = 0.7,
    textWeight = 0.3
  } = options;

  // Generate embedding for vector search
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // Hybrid search with RRF (Reciprocal Rank Fusion)
  const results = await prisma.$queryRaw`
    WITH vector_search AS (
      SELECT
        id,
        content,
        metadata,
        (embedding <=> ${embeddingString}::vector) as vector_distance,
        ROW_NUMBER() OVER (ORDER BY embedding <=> ${embeddingString}::vector) as vector_rank
      FROM rag_chunks
      WHERE project_id = ${projectId}
      ORDER BY embedding <=> ${embeddingString}::vector
      LIMIT 50
    ),
    text_search AS (
      SELECT
        id,
        content,
        metadata,
        ts_rank(content_tsv, plainto_tsquery('english', ${query})) as text_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', ${query})) DESC) as text_rank
      FROM rag_chunks
      WHERE
        project_id = ${projectId}
        AND content_tsv @@ plainto_tsquery('english', ${query})
      ORDER BY text_score DESC
      LIMIT 50
    )
    SELECT
      COALESCE(v.id, t.id) as id,
      COALESCE(v.content, t.content) as content,
      COALESCE(v.metadata, t.metadata) as metadata,
      (
        COALESCE(${vectorWeight} / (60.0 + COALESCE(v.vector_rank, 1000)), 0) +
        COALESCE(${textWeight} / (60.0 + COALESCE(t.text_rank, 1000)), 0)
      ) as combined_score
    FROM vector_search v
    FULL OUTER JOIN text_search t ON v.id = t.id
    ORDER BY combined_score DESC
    LIMIT ${limit}
  `;

  return results;
}
```

### Filtering and Re-ranking

```typescript
import { VectorStore } from '@/lib/vector/vector-store';

async function advancedSearch(
  query: string,
  options: {
    workspaceId?: number;
    fileIds?: number[];
    languages?: string[];
    dateRange?: { from: Date; to: Date };
    limit?: number;
  }
) {
  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  // Initial semantic search
  const results = await vectorStore.search(query, {
    workspaceId: options.workspaceId,
    fileIds: options.fileIds,
    limit: options.limit || 10,
    threshold: 0.6
  });

  // Apply metadata filters
  let filtered = results;

  if (options.languages?.length) {
    filtered = filtered.filter(r =>
      options.languages!.includes(r.metadata?.language)
    );
  }

  if (options.dateRange) {
    filtered = filtered.filter(r => {
      const date = new Date(r.metadata?.timestamp);
      return date >= options.dateRange!.from && date <= options.dateRange!.to;
    });
  }

  // Re-rank by custom scoring
  const reranked = filtered.map(result => ({
    ...result,
    score: calculateCustomScore(result, query)
  })).sort((a, b) => b.score - a.score);

  return reranked;
}

function calculateCustomScore(result: SearchResult, query: string): number {
  let score = result.similarity;

  // Boost recent documents
  if (result.metadata?.timestamp) {
    const age = Date.now() - new Date(result.metadata.timestamp).getTime();
    const daysSinceUpdate = age / (1000 * 60 * 60 * 24);
    score *= Math.exp(-daysSinceUpdate / 30); // Decay over 30 days
  }

  // Boost exact keyword matches
  const keywords = query.toLowerCase().split(' ');
  const content = result.content.toLowerCase();
  const keywordMatches = keywords.filter(k => content.includes(k)).length;
  score *= (1 + keywordMatches * 0.1);

  return score;
}
```

## 🤖 Multi-Agent Workflows

### Agent Architecture

```typescript
import { ToolRegistry } from '@/lib/agents/tool-registry';
import { ThreadManager } from '@/lib/agents/thread-manager';

// 1. Create tool registry
const toolRegistry = new ToolRegistry();

// 2. Register tools for agents
toolRegistry.register(
  'web_search',
  {
    description: 'Search the web for current information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', default: 10 }
      },
      required: ['query']
    }
  },
  async ({ query, limit = 10 }) => {
    // Implementation
    const results = await performWebSearch(query, limit);
    return { status: 'success', results };
  },
  {
    category: 'research',
    tags: ['search', 'web'],
    rateLimit: { maxCalls: 50, windowMs: 60000 }
  }
);

toolRegistry.register(
  'code_executor',
  {
    description: 'Execute code in a sandboxed environment',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', enum: ['python', 'javascript', 'typescript'] }
      },
      required: ['code', 'language']
    }
  },
  async ({ code, language }) => {
    // Sandbox execution
    const result = await executeSandboxedCode(code, language);
    return result;
  },
  {
    category: 'execution',
    tags: ['code', 'sandbox'],
    rateLimit: { maxCalls: 20, windowMs: 60000 }
  }
);

// 3. Create agent with tools
const agent = await createAgent({
  name: 'Research Assistant',
  instructions: 'You are a helpful research assistant...',
  tools: toolRegistry.getToolDefinitions(['web_search', 'code_executor']),
  model: 'gpt-4-turbo'
});
```

### Multi-Agent Coordination Pattern

```typescript
interface AgentRole {
  name: string;
  description: string;
  tools: string[];
  model: string;
}

class MultiAgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private toolRegistry: ToolRegistry;
  private threadManager: ThreadManager;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.threadManager = new ThreadManager();
  }

  async initializeAgents(roles: AgentRole[]) {
    for (const role of roles) {
      const agent = await createAgent({
        name: role.name,
        instructions: role.description,
        tools: this.toolRegistry.getToolDefinitions(role.tools),
        model: role.model
      });

      this.agents.set(role.name, agent);
    }
  }

  async executeWorkflow(task: string): Promise<WorkflowResult> {
    // 1. Planning agent breaks down task
    const plan = await this.runAgent('planner', {
      message: `Create a plan to accomplish: ${task}`
    });

    // 2. Execute plan steps with specialized agents
    const results = [];
    for (const step of plan.steps) {
      const agentName = this.selectAgent(step.type);
      const result = await this.runAgent(agentName, {
        message: step.description,
        context: results
      });
      results.push(result);
    }

    // 3. Synthesis agent combines results
    const final = await this.runAgent('synthesizer', {
      message: 'Synthesize the following results into a cohesive answer',
      context: results
    });

    return {
      task,
      plan,
      steps: results,
      final
    };
  }

  private async runAgent(
    agentName: string,
    input: { message: string; context?: any[] }
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) throw new Error(`Agent ${agentName} not found`);

    // Create or get thread
    const thread = await this.threadManager.getOrCreateThread(
      `workflow-${Date.now()}`
    );

    // Run agent
    const run = await agent.createRun(thread.id, {
      assistant_id: agent.id,
      instructions: input.message,
      additional_messages: input.context ? [
        { role: 'user', content: JSON.stringify(input.context) }
      ] : []
    });

    // Wait for completion and handle tool calls
    while (run.status === 'in_progress' || run.status === 'requires_action') {
      if (run.status === 'requires_action') {
        const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls || [];
        const outputs = await this.executeToolCalls(toolCalls);
        await agent.submitToolOutputs(run.id, outputs);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      const updatedRun = await agent.getRun(thread.id, run.id);
      Object.assign(run, updatedRun);
    }

    return {
      agent: agentName,
      result: run.output,
      toolCalls: run.tool_calls
    };
  }

  private selectAgent(stepType: string): string {
    const agentMapping: Record<string, string> = {
      'research': 'researcher',
      'analysis': 'analyzer',
      'coding': 'coder',
      'testing': 'tester'
    };

    return agentMapping[stepType] || 'general';
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolOutput[]> {
    return Promise.all(
      toolCalls.map(call => this.toolRegistry.execute(call))
    );
  }
}
```

### RAG-Enhanced Agent

```typescript
class RAGAgent {
  private ragSystem: RAGSystem;
  private llmClient: LLMClient;

  constructor(ragSystem: RAGSystem, llmClient: LLMClient) {
    this.ragSystem = ragSystem;
    this.llmClient = llmClient;
  }

  async answer(query: string, options?: {
    searchLimit?: number;
    threshold?: number;
    includeMetadata?: boolean;
  }): Promise<{
    answer: string;
    sources: SearchResult[];
    confidence: number;
  }> {
    // 1. Retrieve relevant context
    const sources = await this.ragSystem.search(query, {
      limit: options?.searchLimit || 10,
      threshold: options?.threshold || 0.7,
      useCache: true
    });

    if (sources.length === 0) {
      return {
        answer: 'I could not find relevant information to answer your question.',
        sources: [],
        confidence: 0
      };
    }

    // 2. Build context from sources
    const context = this.buildContext(sources, options?.includeMetadata);

    // 3. Generate answer with LLM
    const systemPrompt = `You are a helpful assistant. Answer questions using ONLY the provided context.
If the context doesn't contain enough information, say so clearly.
Always cite your sources using [1], [2], etc.

Context:
${context}`;

    const response = await this.llmClient.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });

    const answer = response.choices[0].message.content;

    // 4. Calculate confidence based on source quality
    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
    const confidence = Math.min(avgSimilarity * 1.2, 1.0); // Boost and cap at 1.0

    return {
      answer,
      sources,
      confidence
    };
  }

  private buildContext(sources: SearchResult[], includeMetadata?: boolean): string {
    return sources.map((source, idx) => {
      let context = `[${idx + 1}] ${source.content}`;

      if (includeMetadata && source.metadata) {
        const meta = [
          source.metadata.filePath && `File: ${source.metadata.filePath}`,
          source.metadata.language && `Language: ${source.metadata.language}`,
          source.metadata.timestamp && `Updated: ${source.metadata.timestamp}`
        ].filter(Boolean).join(', ');

        if (meta) context += `\n(${meta})`;
      }

      context += `\nRelevance: ${(source.similarity * 100).toFixed(1)}%`;
      return context;
    }).join('\n\n');
  }
}
```

## 💾 Context Management

### Context Window Optimization

```typescript
interface ContextManager {
  maxTokens: number;
  reservedTokens: number; // For system prompt + response

  buildOptimalContext(
    query: string,
    sources: SearchResult[]
  ): {
    context: string;
    includedSources: number;
    tokenCount: number;
  };
}

class SmartContextManager implements ContextManager {
  maxTokens = 8000;
  reservedTokens = 2000;

  buildOptimalContext(query: string, sources: SearchResult[]) {
    const availableTokens = this.maxTokens - this.reservedTokens;
    let currentTokens = 0;
    const contextParts: string[] = [];
    let includedSources = 0;

    // Sort sources by relevance
    const sorted = [...sources].sort((a, b) => b.similarity - a.similarity);

    for (const source of sorted) {
      const tokens = this.estimateTokens(source.content);

      if (currentTokens + tokens <= availableTokens) {
        contextParts.push(this.formatSource(source, includedSources));
        currentTokens += tokens;
        includedSources++;
      } else {
        // Try to include truncated version
        const remaining = availableTokens - currentTokens;
        if (remaining > 100) { // Minimum useful size
          const truncated = this.truncateToTokens(source.content, remaining);
          contextParts.push(
            this.formatSource({ ...source, content: truncated }, includedSources) + ' [truncated]'
          );
          includedSources++;
        }
        break;
      }
    }

    return {
      context: contextParts.join('\n\n'),
      includedSources,
      tokenCount: currentTokens
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;

    // Try to truncate at sentence boundary
    const truncated = text.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const cutoff = Math.max(lastPeriod, lastNewline);

    return cutoff > maxChars * 0.8 ? truncated.substring(0, cutoff + 1) : truncated;
  }

  private formatSource(source: SearchResult, index: number): string {
    return `[${index + 1}] ${source.content}\nRelevance: ${(source.similarity * 100).toFixed(1)}%`;
  }
}
```

### Context Caching with Valkey

```typescript
import { valkeyCache } from '@/lib/rag/cache';

// Cache search results
async function cachedSearch(query: string, options: RAGSearchOptions) {
  // Check cache first
  const cached = await valkeyCache.get(query);
  if (cached) {
    console.log('Cache hit!');
    return cached.results;
  }

  // Perform search
  const queryEmbedding = await embeddingService.generate(query);
  const results = await vectorStore.search(queryEmbedding, options);

  // Cache results
  await valkeyCache.set(query, queryEmbedding, results, {
    ttl: 3600 // 1 hour
  });

  return results;
}

// Cache statistics
const stats = await valkeyCache.getStats();
console.log(`Cache hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Total cached queries: ${stats.totalKeys}`);
```

### Persistent Context Service

```typescript
import { PersistentContextService } from '@/lib/session/persistent-context-service';

const contextService = new PersistentContextService();

// Save conversation context
await contextService.saveContext('session-123', {
  messages: [...],
  pinnedDocuments: [...],
  searchHistory: [...],
  metadata: {
    workspace: 'my-project',
    timestamp: new Date().toISOString()
  }
});

// Retrieve context later
const context = await contextService.loadContext('session-123');

// Search within saved context
const relevant = await contextService.searchContext('session-123', 'query');
```

## ⚡ Performance Optimization

### Indexing Strategy

```sql
-- Essential indexes for RAG performance

-- 1. Vector similarity index (IVFFlat for large datasets)
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- For smaller datasets, use HNSW for better recall
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx
ON rag_chunks
USING hnsw (embedding vector_cosine_ops);

-- 2. Metadata indexes for filtering
CREATE INDEX IF NOT EXISTS rag_chunks_project_id_idx
ON rag_chunks (project_id);

CREATE INDEX IF NOT EXISTS rag_chunks_metadata_idx
ON rag_chunks USING gin (metadata jsonb_path_ops);

-- 3. Full-text search index
CREATE INDEX IF NOT EXISTS rag_chunks_content_tsv_idx
ON rag_chunks USING gin (content_tsv);

-- 4. Composite index for common queries
CREATE INDEX IF NOT EXISTS rag_chunks_project_embedding_idx
ON rag_chunks (project_id, embedding);
```

### Batch Processing

```typescript
// Efficient batch ingestion
async function batchIngest(documents: Document[], batchSize = 100) {
  const batches = chunk(documents, batchSize);
  const results = [];

  for (const batch of batches) {
    // Generate embeddings in parallel
    const embeddings = await Promise.all(
      batch.map(doc => embeddingService.generate(doc.content))
    );

    // Bulk insert to database
    const inserted = await prisma.ragChunks.createMany({
      data: batch.map((doc, i) => ({
        content: doc.content,
        embedding: embeddings[i],
        metadata: doc.metadata,
        projectId: doc.projectId
      }))
    });

    results.push(inserted);
  }

  return results;
}
```

### Caching Strategies

| Strategy | Use Case | TTL | Cost Savings |
|----------|----------|-----|--------------|
| **Query Cache** | Repeated searches | 1 hour | 80%+ on duplicates |
| **Embedding Cache** | Same text chunks | 24 hours | 90%+ on re-indexing |
| **Result Cache** | Popular queries | 30 minutes | 70%+ during peak |
| **Context Cache** | Session continuity | 2 hours | 60%+ on follow-ups |

## ✅ Best Practices

### 1. Chunking Strategy

```typescript
interface ChunkingOptions {
  maxTokens: number;      // Optimal: 500-1000
  overlap: number;        // Optimal: 10-20% of maxTokens
  respectBoundaries: boolean; // Respect code blocks, paragraphs
}

function intelligentChunking(
  content: string,
  language: string,
  options: ChunkingOptions
): Chunk[] {
  // For code, respect function/class boundaries
  if (['typescript', 'javascript', 'python'].includes(language)) {
    return chunkByASTNodes(content, language, options);
  }

  // For documentation, respect section boundaries
  if (language === 'markdown') {
    return chunkByHeaders(content, options);
  }

  // Fallback to token-based chunking
  return chunkByTokens(content, options);
}
```

### 2. Query Optimization

```typescript
// Bad: Multiple sequential searches
for (const query of queries) {
  const results = await semanticSearch(query);
  processResults(results);
}

// Good: Batch search with parallel execution
const results = await Promise.all(
  queries.map(q => semanticSearch(q))
);
results.forEach(processResults);
```

### 3. Error Handling

```typescript
async function robustRAGQuery(query: string) {
  try {
    // Try primary RAG system
    return await ragSystem.query(query);
  } catch (error) {
    console.error('Primary RAG failed:', error);

    try {
      // Fallback to direct vector search
      const embedding = await embeddingService.generate(query);
      const results = await vectorStore.search(embedding);
      return { answer: formatResults(results), sources: results };
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);

      // Last resort: keyword search
      return await keywordFallbackSearch(query);
    }
  }
}
```

### 4. Monitoring and Metrics

```typescript
import { logger } from '@/lib/logger';

// Track RAG performance
function trackRAGMetrics(operation: string, metadata: Record<string, any>) {
  logger.info('RAG operation', {
    operation,
    ...metadata,
    timestamp: new Date().toISOString()
  });

  // Send to monitoring service
  metrics.track('rag.operation', {
    operation,
    ...metadata
  });
}

// Usage
const startTime = Date.now();
const results = await ragSystem.search(query);
trackRAGMetrics('search', {
  duration: Date.now() - startTime,
  resultCount: results.length,
  queryLength: query.length,
  avgSimilarity: results.reduce((sum, r) => sum + r.similarity, 0) / results.length
});
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Low Similarity Scores

```typescript
// Problem: All similarity scores are below threshold
// Solutions:

// A. Lower threshold
const results = await ragSystem.search(query, {
  threshold: 0.5  // Instead of default 0.7
});

// B. Rephrase query
const enhancedQuery = await enhanceQuery(query);
const results = await ragSystem.search(enhancedQuery);

// C. Check embedding dimensions match
const stats = await vectorStore.getStats();
console.log('Embedding dimension:', stats.dimension);
// Ensure all embeddings use same dimension
```

#### 2. Slow Search Performance

```typescript
// Check index usage
const explain = await prisma.$queryRaw`
  EXPLAIN ANALYZE
  SELECT * FROM rag_chunks
  WHERE embedding <=> '[...]'::vector
  LIMIT 10
`;

// If not using index, rebuild:
await ragSystem.rebuildIndex();

// Consider using IVFFlat for large datasets (>100k vectors)
```

#### 3. Cache Miss Rate Too High

```typescript
const stats = await valkeyCache.getStats();
console.log('Hit rate:', stats.hitRate);

if (stats.hitRate < 0.3) {
  // Increase TTL
  await valkeyCache.updateConfig({
    ttl: { default: 7200 } // 2 hours instead of 1
  });

  // Or normalize queries before caching
  function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}
```

#### 4. Context Too Large

```typescript
// Error: Context exceeds model's token limit

// Solution: Use SmartContextManager
const contextManager = new SmartContextManager();
contextManager.maxTokens = 8000; // Match your model
contextManager.reservedTokens = 2000; // For system + response

const { context, includedSources, tokenCount } =
  contextManager.buildOptimalContext(query, sources);

console.log(`Using ${includedSources}/${sources.length} sources (${tokenCount} tokens)`);
```

#### 5. Embedding API Rate Limits

```typescript
import { RateLimiter } from '@/lib/rate-limiter';

const embeddingLimiter = new RateLimiter({
  maxCalls: 3000,
  windowMs: 60000 // 3000 per minute
});

async function rateLimitedEmbedding(text: string) {
  await embeddingLimiter.acquire();
  try {
    return await embeddingService.generate(text);
  } finally {
    embeddingLimiter.release();
  }
}
```

### Debug Mode

```bash
# Enable RAG debug logging
export DEBUG_RAG=true
export DEBUG_VECTOR_SEARCH=true
export DEBUG_EMBEDDING=true

# View detailed logs
npm run dev 2>&1 | grep RAG
```

### Health Checks

```typescript
// Verify RAG system health
async function healthCheck() {
  const checks = {
    vectorStore: false,
    embeddingService: false,
    cache: false,
    database: false
  };

  try {
    // Test vector store
    await vectorStore.initialize();
    checks.vectorStore = true;

    // Test embeddings
    const testEmbedding = await embeddingService.generate('test');
    checks.embeddingService = testEmbedding.length > 0;

    // Test cache
    await valkeyCache.connect();
    checks.cache = true;

    // Test database
    const stats = await ragSystem.getStats();
    checks.database = stats !== null;

  } catch (error) {
    console.error('Health check failed:', error);
  }

  return checks;
}
```

## 📚 Additional Resources

### API Endpoints

- **POST** `/api/semantic-search` - Semantic code search
- **POST** `/api/ai/search` - RAG-enhanced AI search
- **GET** `/api/codebase-index` - Index management
- **POST** `/api/vector-store` - Vector store operations
- **GET** `/api/monitoring/embeddings` - Embedding metrics

### Related Documentation

- [API Documentation](../api/README.md) - Complete API reference
- [AI Model Selection Guide](./ai-model-selection.md) - Choosing the right models
- [AI Rate Limiting Guide](./ai-rate-limiting.md) - Managing API costs
- [Authentication Strategy](../security/AUTHENTICATION_STRATEGY.md) - Security and authentication best practices

### External Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector) - Vector database extension
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings) - Embedding best practices
- [LangChain RAG Guide](https://js.langchain.com/docs/use_cases/question_answering/) - Advanced RAG patterns

## 🤝 Contributing

When extending RAG functionality:

1. **Add tests** for new features in `src/lib/rag/__tests__/`
2. **Update schemas** in `src/lib/api/validation/schemas.ts`
3. **Document performance impact** for new queries or indexes
4. **Follow chunking conventions** established in `src/lib/indexing/code-chunker.ts`
5. **Update this guide** with new patterns and examples

---

**Last Updated**: 2026-02-28
**Maintained By**: AI Integration Team
**Questions?** See [Troubleshooting Guide](../TROUBLESHOOTING.md) or open an issue on GitHub.
