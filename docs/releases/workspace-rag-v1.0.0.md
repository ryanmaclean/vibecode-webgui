# Workspace RAG Extension v1.0.0

**Release Date**: November 15, 2024  
**Status**: Production Ready

## Features

- Multi-LLM provider support (OpenAI, Anthropic, Google, OpenRouter) with BYOK
- Local MLX acceleration on Apple Silicon
- PostgreSQL pgvector for vector storage
- Enterprise security safeguards
- Full Datadog tracing
- Python build system with interactive menus
- Comprehensive tests and CI/CD

## Quick Start

```bash
code --install-extension workspace-rag-*.vsix
./extensions/workspace-rag/scripts/setup-database.sh
# Cmd+Shift+P → "Index Workspace"
# Cmd+Shift+P → "Open RAG Chat"
```

## Documentation

- [README](../../extensions/workspace-rag/README.md)
- [Quickstart](../../extensions/workspace-rag/QUICKSTART.md)
- [Architecture](../../extensions/workspace-rag/ARCHITECTURE.md)
- [Build System](../../scripts/release/README.md)

[Full Release Notes](./workspace-rag-v1.0.0.md)
