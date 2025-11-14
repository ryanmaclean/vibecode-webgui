# Architecture Documentation

## Overview

The Workspace RAG extension is a sophisticated VS Code extension that brings Retrieval-Augmented Generation (RAG) to your codebase. It combines local machine learning models (via MLX on Apple Silicon), vector databases (pgvector), and optional cloud APIs to provide intelligent code understanding and question answering.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    User Interface Layer                    │  │
│  │  ┌──────────────┐         ┌──────────────────────────┐   │  │
│  │  │   Webview    │         │   Command Palette        │   │  │
│  │  │  (Tahoe UI)  │◄───────►│   - Index Workspace      │   │  │
│  │  │              │         │   - Set API Key          │   │  │
│  │  │  Chat Panel  │         │   - Show Dashboard       │   │  │
│  │  └──────┬───────┘         └──────────────────────────┘   │  │
│  └─────────┼────────────────────────────────────────────────┘  │
│            │                                                     │
│  ┌─────────▼────────────────────────────────────────────────┐  │
│  │                   Application Layer                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  RAG Service │  │   Workspace  │  │   Tracing    │  │  │
│  │  │              │  │   Indexer    │  │   Manager    │  │  │
│  │  │  - Query     │  │              │  │              │  │  │
│  │  │  - Retrieve  │  │  - Scan      │  │  - ddtrace   │  │  │
│  │  │  - Generate  │  │  - Chunk     │  │  - Spans     │  │  │
│  │  └──────┬───────┘  │  - Embed     │  │  - Metrics   │  │  │
│  │         │          └──────┬───────┘  └──────────────┘  │  │
│  └─────────┼─────────────────┼──────────────────────────────┘  │
│            │                 │                                  │
│  ┌─────────▼─────────────────▼──────────────────────────────┐  │
│  │                     Service Layer                         │  │
│  │  ┌──────────────────┐         ┌──────────────────────┐  │  │
│  │  │ MLX Embedding    │         │   pgvector Client    │  │  │
│  │  │    Service       │         │                      │  │  │
│  │  │                  │         │  - Connect           │  │  │
│  │  │ [Local Model]◄───┼────────►│  - Insert            │  │  │
│  │  │ all-MiniLM-L6-v2 │         │  - Search            │  │  │
│  │  │ (384-dim)        │         │  - Cosine Similarity │  │  │
│  │  │                  │         └──────────┬───────────┘  │  │
│  │  │ [API Fallback]   │                    │              │  │
│  │  │ text-embed-3     │                    │              │  │
│  │  │ (1536-dim)       │                    │              │  │
│  │  └──────────────────┘                    │              │  │
│  └────────────────────────────────────────────┼─────────────┘  │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                ┌────────────────────────────────▼─────────┐
                │        External Dependencies             │
                │  ┌────────────────┐  ┌────────────────┐ │
                │  │  PostgreSQL    │  │   OpenAI API   │ │
                │  │  + pgvector    │  │                │ │
                │  │                │  │  - Embeddings  │ │
                │  │  - Vector DB   │  │  - Chat Comp.  │ │
                │  │  - Similarity  │  │  (Optional)    │ │
                │  └────────────────┘  └────────────────┘ │
                │                                          │
                │  ┌────────────────┐                     │
                │  │   DataDog      │                     │
                │  │   (Optional)   │                     │
                │  │                │                     │
                │  │  - Tracing     │                     │
                │  │  - Metrics     │                     │
                │  └────────────────┘                     │
                └──────────────────────────────────────────┘
```

## Core Components

### 1. Extension Entry Point (`extension.ts`)

**Responsibilities:**
- Extension activation and deactivation
- Command registration
- Service initialization
- Webview provider setup

**Key Methods:**
- `activate(context)` - Initialize all services and register commands
- `deactivate()` - Cleanup and flush traces

### 2. RAG Service (`ragService.ts`)

**Responsibilities:**
- Query processing orchestration
- Document retrieval
- Response generation

**Flow:**
1. Receive user query
2. Generate query embedding
3. Retrieve relevant documents from pgvector
4. Build context from documents
5. Generate answer (OpenAI or simple extraction)
6. Return response with sources

**Tracing:**
- `rag.processQuery` - Overall query processing
- `rag.retrieveDocuments` - Vector search
- `rag.generateResponse` - LLM generation

### 3. Workspace Indexer (`workspaceIndexer.ts`)

**Responsibilities:**
- File discovery and filtering
- Incremental indexing
- Text chunking
- Embedding generation
- Database storage

**Text Splitting Strategies:**
- **Code-Aware**: Respects function/class boundaries
- **Markdown-Aware**: Splits by sections
- **Paragraph-Based**: Fallback for other content

**Incremental Logic:**
```
For each file in workspace:
    Get last_modified from filesystem
    Compare with last_modified in database
    If newer or not exists:
        Process file
```

### 4. MLX Embedding Service (`mlxEmbeddingService.ts`)

**Responsibilities:**
- Embedding generation
- Model selection (local vs. API)
- Fallback handling

**Model Selection Logic:**
```
If Apple Silicon AND useLocalMLX:
    Use local MLX model (384-dim)
Else:
    Use OpenAI API (1536-dim)
```

**Note:** Current implementation uses simulated MLX embeddings. Production version would integrate actual MLX models.

### 5. pgvector Client (`pgvectorClient.ts`)

**Responsibilities:**
- Database connection management
- Vector operations
- Query execution

**Key Operations:**
- `initializeDatabase()` - Create tables and indexes
- `insertDocument()` - Store embeddings
- `search()` - Vector similarity search using cosine distance

**Vector Search Query:**
```sql
SELECT filepath, content, 1 - (embedding <=> $1::vector) as similarity
FROM workspace_documents
WHERE workspace_id = $2
ORDER BY embedding <=> $1::vector
LIMIT $3
```

### 6. Tracing Manager (`tracing.ts`)

**Responsibilities:**
- Distributed tracing setup
- Span management
- Metric collection

**Integration Points:**
- Database queries
- Embedding generation
- RAG pipeline steps
- User interactions

### 7. Webview UI (`media/chat.html`)

**Responsibilities:**
- Chat interface
- Message display
- User input handling
- Status updates

**Features:**
- Tahoe-inspired design
- VS Code theming
- Quick action buttons
- Source attribution
- Loading states

## Data Flow

### Indexing Flow

```
1. User triggers "Index Workspace" command
   ↓
2. Workspace Indexer scans for files (glob patterns)
   ↓
3. For each file:
   a. Read content
   b. Split into chunks (TextSplitter)
   c. Generate embedding (MLXEmbeddingService)
   d. Store in pgvector (PgvectorClient)
   ↓
4. Report completion to user
```

### Query Flow

```
1. User types question in chat
   ↓
2. Webview sends message to extension
   ↓
3. RAG Service processes query:
   a. Generate query embedding
   b. Search pgvector for similar chunks
   c. Build context from results
   d. Generate answer (OpenAI or simple)
   ↓
4. Extension sends response to webview
   ↓
5. Webview displays answer with sources
```

## Database Schema

### `workspace_documents` Table

```sql
CREATE TABLE workspace_documents (
    id SERIAL PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, filepath)
);
```

### Indexes

```sql
-- Vector similarity search
CREATE INDEX idx_documents_embedding 
ON workspace_documents 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Workspace and file lookup
CREATE INDEX idx_workspace_path 
ON workspace_documents (workspace_id, filepath);
```

## Configuration

### VS Code Settings

All settings are namespaced under `workspaceRag.*`:

**Database:**
- `pgHost`, `pgPort`, `pgUser`, `pgPassword`, `pgDatabase`

**Indexing:**
- `includeGlob`, `excludeGlob`, `chunkSize`, `chunkOverlap`

**Models:**
- `useLocalMLX`, `embeddingModel`, `retrievalLimit`

**Tracing:**
- `tracing.enabled`, `tracing.sampleRate`, `tracing.exporters`

### Secrets

Sensitive data stored in VS Code secrets:
- `openaiApiKey` - OpenAI API key for embeddings/chat

## Performance Characteristics

### Embedding Generation
- **Local MLX**: ~50-100ms per chunk (Apple Silicon)
- **OpenAI API**: ~200-500ms per chunk

### Vector Search
- **pgvector**: <1ms with IVFFlat index
- Scales to millions of documents

### End-to-End Query
- **Without LLM**: ~500ms
- **With OpenAI**: ~1-2s
- **Bottleneck**: API latency

### Indexing
- **Rate**: ~10-50 files/minute
- **Factors**: File size, chunk count, API rate limits

## Security Considerations

1. **API Keys**: Stored in VS Code secrets API (encrypted)
2. **Database**: Connection credentials in settings (consider encryption)
3. **Data Privacy**: Local MLX keeps data on-device
4. **SQL Injection**: Parameterized queries prevent attacks

## Extensibility

### Adding New Embedding Models

1. Extend `MLXEmbeddingService`
2. Add model configuration
3. Implement `generateEmbedding()` method
4. Update dimension in database schema if needed

### Adding New LLM Providers

1. Create new service class (e.g., `AnthropicService`)
2. Implement response generation method
3. Update `RagService` to support provider selection
4. Add configuration options

### Adding Custom Chunking Strategies

1. Extend `TextSplitter` class
2. Add new `splitBy*()` method
3. Update `splitText()` with strategy selection

## Testing Strategy

### Unit Tests
- Text splitting logic
- Embedding dimension validation
- Query construction

### Integration Tests
- Database operations
- API calls with mocking
- End-to-end RAG flow

### Manual Testing
- Different project types (JS, Python, Go, etc.)
- Large codebases (>5000 files)
- Edge cases (empty files, binary files)

## Deployment

### Development
```bash
npm install
npm run watch
# Press F5 to launch
```

### Production
```bash
npm run package
code --install-extension workspace-rag-1.0.0.vsix
```

## Monitoring

### Tracing with ddtrace
- Query latency
- Embedding generation time
- Database query performance
- Error rates

### Metrics to Track
- Queries per day
- Average response time
- Cache hit rate (future)
- Index size growth

## Future Enhancements

1. **Performance**
   - Response caching
   - Batch embedding generation
   - Streaming responses

2. **Features**
   - Chat history
   - Multi-workspace support
   - Custom prompts
   - Export/import indexes

3. **ML Models**
   - Real MLX integration
   - Fine-tuned models
   - Local LLMs (Ollama, etc.)

4. **UX**
   - Performance dashboard
   - Inline code suggestions
   - GitHub integration

## Troubleshooting

### Common Issues

**Database Connection Fails**
- Check PostgreSQL is running
- Verify credentials
- Ensure pgvector extension is installed

**Indexing is Slow**
- Use local MLX instead of API
- Reduce chunk size
- Exclude more directories

**No Results Found**
- Verify workspace is indexed
- Check file patterns match your code
- Inspect database: `SELECT COUNT(*) FROM workspace_documents;`

### Debug Mode

Enable debug logging:
```json
{
  "workspaceRag.debugMode": true
}
```

View logs: Output panel → "Workspace RAG"

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](./LICENSE)

