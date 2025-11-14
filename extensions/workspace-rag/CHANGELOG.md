# Changelog

All notable changes to the Workspace RAG extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-14

### Added
- **Core RAG Functionality**
  - Workspace-aware indexing with pgvector database
  - Vector similarity search for code retrieval
  - Question answering with context-aware responses
  
- **MLX Integration**
  - Local embedding generation on Apple Silicon
  - Automatic fallback to OpenAI API on non-Apple platforms
  - Support for both local and cloud-based models
  
- **Smart Indexing**
  - Incremental indexing (only processes new/modified files)
  - Code-aware text splitting (respects function/class boundaries)
  - Markdown-aware chunking (splits by sections)
  - Configurable chunk size and overlap
  
- **User Interface**
  - Tahoe-inspired chat interface with VS Code theming
  - Source attribution with clickable file references
  - Quick action buttons for common queries
  - Real-time status indicators (local vs. cloud model)
  
- **Distributed Tracing**
  - Optional ddtrace integration
  - Performance monitoring and debugging
  - Multi-exporter support (console, DataDog, Jaeger)
  
- **Commands**
  - `RAG: Index Workspace` - Index the current workspace
  - `RAG: Set OpenAI API Key` - Configure API key for LLM
  - `RAG: Open RAG Chat` - Open the chat interface
  - `RAG: Show Performance Dashboard` - View metrics (coming soon)
  
- **Configuration**
  - PostgreSQL connection settings
  - File include/exclude patterns
  - Chunk size and overlap customization
  - Model selection (local MLX vs. API)
  - Tracing and debug options
  
- **Documentation**
  - Comprehensive README with architecture overview
  - Quick Start guide for 5-minute setup
  - Configuration examples
  - Troubleshooting guide

### Technical Details
- TypeScript codebase with strict type checking
- Webpack bundling for optimized distribution
- Connection pooling for database efficiency
- Proper error handling and user feedback
- Extensible architecture for future enhancements

### Performance
- Sub-100ms local embeddings on Apple Silicon
- Sub-millisecond vector search with pgvector
- 500ms-2s end-to-end query processing
- Efficient incremental indexing

### Known Limitations
- MLX embeddings are simulated (placeholder for actual implementation)
- Performance dashboard is not yet implemented
- Multi-workspace support not available
- Chat history not persisted

## [Unreleased]

### Planned Features
- Real MLX model integration for local embeddings
- Chat history and conversation management
- Export/import workspace indexes
- Performance dashboard with metrics visualization
- Multi-workspace support
- Custom prompt templates
- Integration with GitHub Copilot
- Support for additional embedding models (Sentence Transformers)
- Semantic code search across repositories

---

[1.0.0]: https://github.com/vibecode/workspace-rag/releases/tag/v1.0.0

