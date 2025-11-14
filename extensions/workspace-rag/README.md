# Workspace RAG Extension

A VS Code extension that brings RAG (Retrieval-Augmented Generation) to your workspace using local pgvector database, MLX for embeddings (on Apple Silicon), and optional OpenAI integration.

## Features

- **Workspace-Aware**: Automatically indexes your codebase for intelligent Q&A
- **Local-First**: Uses MLX on Apple Silicon for privacy and performance
- **pgvector Integration**: Efficient vector similarity search with PostgreSQL
- **Incremental Indexing**: Only processes new or modified files
- **Smart Chunking**: Respects code structure, markdown sections, and paragraphs
- **Tahoe-Inspired UI**: Clean, modern chat interface
- **Distributed Tracing**: Optional ddtrace integration for observability
- **Multi-Provider LLM**: Support for OpenAI, Anthropic, Google, and OpenRouter with BYOK
- **Security Safeguards**: Rate limiting, input validation, and secure key storage
- **Comprehensive Tests**: 40+ unit tests covering core functionality
- **Automatic Fallback**: Graceful degradation when APIs are unavailable
- **Retry Logic**: Exponential backoff for transient failures

## Prerequisites

### Required
- **VS Code** 1.85.0 or higher
- **PostgreSQL** with pgvector extension
- **Node.js** 16.x or higher

### Optional
- **Apple Silicon** (M1/M2/M3) for local MLX embeddings
- **OpenAI API Key** for LLM-powered answers (fallback: simple extraction)
- **DataDog API Key** for distributed tracing

## Installation

### 1. Install PostgreSQL with pgvector

#### macOS (Homebrew)
```bash
brew install postgresql@15 pgvector
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt install postgresql postgresql-contrib
sudo apt install postgresql-15-pgvector
```

### 2. Create Database
```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE rag_db;

# Connect to the database
\c rag_db

# Enable vector extension
CREATE EXTENSION vector;

# Exit
\q
```

### 3. Install Extension

#### From Source
```bash
cd extensions/workspace-rag
npm install
npm run compile
```

Then press `F5` to launch the extension in development mode.

#### From VSIX (if packaged)
```bash
code --install-extension workspace-rag-1.0.0.vsix
```

## Configuration

Open VS Code settings (`Ctrl+,` or `Cmd+,`) and search for "Workspace RAG":

### Database Settings
```json
{
  "workspaceRag.pgHost": "localhost",
  "workspaceRag.pgPort": 5432,
  "workspaceRag.pgUser": "postgres",
  "workspaceRag.pgPassword": "yourpassword",
  "workspaceRag.pgDatabase": "rag_db"
}
```

### Indexing Settings
```json
{
  "workspaceRag.includeGlob": "**/*.{js,ts,jsx,tsx,py,md,txt,json,go,java,c,cpp,h,cs,rb,php,rs}",
  "workspaceRag.excludeGlob": "**/node_modules/**,**/dist/**,**/.git/**",
  "workspaceRag.chunkSize": 1000,
  "workspaceRag.chunkOverlap": 100
}
```

### Model Settings
```json
{
  "workspaceRag.useLocalMLX": true,
  "workspaceRag.embeddingModel": "text-embedding-3-small",
  "workspaceRag.retrievalLimit": 5
}
```

### Tracing Settings (Optional)
```json
{
  "workspaceRag.tracing.enabled": false,
  "workspaceRag.tracing.sampleRate": 0.1,
  "workspaceRag.tracing.exporters": ["console"],
  "workspaceRag.tracing.datadogApiKey": "your-api-key"
}
```

## Usage

### 1. Set API Key (Optional)
For better answers with LLM generation:
- Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
- Run: `RAG: Set OpenAI API Key (Optional Fallback)`
- Enter your OpenAI API key

### 2. Index Your Workspace
- Open Command Palette
- Run: `RAG: Index Workspace for RAG`
- Wait for indexing to complete (progress shown in notification)

### 3. Ask Questions
- Open the "RAG Chat" panel in the Explorer view
- Type your question in the input box
- Get answers with source references

### Example Questions
- "What is the main architecture of this project?"
- "Where is the database configuration?"
- "How does authentication work?"
- "Show me examples of API usage"
- "What does the utils.ts file do?"

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Webview    │───▶│  RAG Service │───▶│  OpenAI   │ │
│  │  (Tahoe UI)  │    │              │    │  (Optional)│ │
│  └──────────────┘    └──────┬───────┘    └───────────┘ │
│                              │                           │
│                              ▼                           │
│                    ┌──────────────────┐                 │
│                    │  MLX Embedding   │                 │
│                    │     Service      │                 │
│                    │  (Local/API)     │                 │
│                    └────────┬─────────┘                 │
│                             │                            │
│                             ▼                            │
│                    ┌──────────────────┐                 │
│                    │   Workspace      │                 │
│                    │    Indexer       │                 │
│                    └────────┬─────────┘                 │
│                             │                            │
└─────────────────────────────┼────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   + pgvector     │
                    │  (Vector Store)  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     ddtrace      │
                    │   (Optional)     │
                    └──────────────────┘
```

## Key Components

### MLX Embedding Service
- **Local Mode**: Uses MLX on Apple Silicon for fast, private embeddings
- **API Mode**: Falls back to OpenAI API when MLX unavailable
- **Dimension**: 384 (local) or 1536 (API)

### Text Splitter
- **Code-Aware**: Respects function/class boundaries
- **Markdown-Aware**: Splits by sections
- **Smart Overlap**: Maintains context between chunks

### pgvector Client
- **Vector Search**: Cosine similarity using `<=>` operator
- **Incremental Updates**: Only updates modified files
- **Connection Pooling**: Efficient database access

### Tracing
- **ddtrace Integration**: Full distributed tracing
- **Performance Monitoring**: Track latency and errors
- **Multi-Exporter**: Console, DataDog, Jaeger support

## Development

### Build
```bash
npm install
npm run compile
```

### Watch Mode
```bash
npm run watch
```

### Package
```bash
npm run package
```

### Debug
Press `F5` in VS Code to launch Extension Development Host

## Performance

### Embedding Generation
- **Local MLX**: ~50-100ms per chunk (Apple Silicon)
- **OpenAI API**: ~200-500ms per chunk (network dependent)

### Vector Search
- **pgvector**: Sub-millisecond search with index
- **Typical Query**: 500ms - 2s end-to-end (including LLM)

### Indexing
- **Small Project** (~100 files): 1-2 minutes
- **Medium Project** (~1000 files): 5-10 minutes
- **Large Project** (~5000 files): 20-30 minutes

## Troubleshooting

### "Failed to connect to PostgreSQL"
- Ensure PostgreSQL is running: `brew services list` or `systemctl status postgresql`
- Check connection settings in VS Code settings
- Verify password is correct

### "MLX not available"
- MLX requires Apple Silicon (M1/M2/M3)
- Extension will automatically fall back to OpenAI API
- Set an OpenAI API key for full functionality

### "No relevant information found"
- Index your workspace first: `RAG: Index Workspace`
- Check that files are included by your glob patterns
- Verify database contains documents: `SELECT COUNT(*) FROM workspace_documents;`

### Slow Indexing
- Reduce chunk size in settings
- Exclude more directories (node_modules, dist, etc.)
- Use local MLX instead of API (if on Apple Silicon)

## Contributing

Contributions are welcome. Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- **pgvector**: Efficient vector similarity search in PostgreSQL
- **MLX**: Apple's ML framework for efficient local inference
- **OpenAI**: Embedding and LLM APIs
- **DataDog**: Distributed tracing and observability
- **Tahoe UI**: Design inspiration for the chat interface

## Security and Multi-Provider Support

For detailed information about security features, supported LLM providers, and BYOK setup, see [SECURITY_AND_PROVIDERS.md](./SECURITY_AND_PROVIDERS.md).

Key topics covered:
- Input validation and rate limiting
- Multi-provider LLM support (OpenAI, Anthropic, Google, OpenRouter)
- API key security and management
- Automatic retry logic and fallbacks
- Comprehensive test suite
- Cost estimation and optimization

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [MLX Documentation](https://ml-explore.github.io/mlx/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference)
- [Google Gemini API](https://ai.google.dev/docs)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [VS Code Extension API](https://code.visualstudio.com/api)

## Roadmap

- [ ] Support for additional embedding models (Sentence Transformers, etc.)
- [ ] Semantic code search across repositories
- [ ] Chat history and conversation management
- [ ] Export/import workspace indexes
- [ ] Multi-workspace support
- [ ] Performance dashboard with metrics
- [ ] Custom prompt templates
- [ ] Integration with GitHub Copilot

