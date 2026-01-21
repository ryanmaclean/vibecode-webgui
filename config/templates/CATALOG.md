# VibeCode Template Catalog

## Overview

VibeCode provides a curated collection of workspace templates for rapid development. Each template is optimized for specific use cases and includes pre-configured environments, dependencies, and tools.

## Available Templates

### 🚀 Neovim + Avante.nvim (NEW!)

**Category**: Editor / AI  
**Difficulty**: Intermediate  
**Setup Time**: < 3 seconds  
**Path**: `templates/neovim-avante/`

Minimal Neovim environment with Avante.nvim for Cursor AI-like code editing.

**Features**:
- Neovim v0.10.2 with Lua and Tree-sitter
- Avante.nvim for AI-powered editing
- Ultra-fast boot (< 3 seconds)
- Git support
- Multiple AI providers (OpenAI, Claude, Copilot)

**Use Cases**:
- AI-powered code editing
- Fast prototyping
- Code review with AI
- Performance benchmarking

**Requirements**:
- Memory: 512 MB
- Storage: 50 MB
- Network: Required for AI APIs

[View Template →](neovim-avante/README.md)

---

### 🦀 Rust + Burn ML

**Category**: Machine Learning / Rust  
**Path**: `templates/rust-burn/`

Rust development environment with Burn ML framework for deep learning.

**Features**:
- Rust toolchain
- Burn ML framework
- GPU support (optional)
- Example models

[View Template →](rust-burn/README.md)

---

### 🟢 Node.js

**Category**: Backend / JavaScript  
**Path**: `templates/nodejs/`

Node.js development environment with common frameworks.

**Features**:
- Node.js LTS
- npm/yarn
- Express.js
- Testing frameworks

[View Template →](nodejs/)

---

### 🐍 Python

**Category**: General Purpose / Python  
**Path**: `templates/python/`

Python development environment with various frameworks and tools.

**Features**:
- Python 3.x
- pip/poetry
- Virtual environments
- Common libraries

[View Template →](python/)

---

### 🧠 Semantic Kernel

**Category**: AI / LLM  
**Path**: `templates/semantic-kernel/`

Microsoft Semantic Kernel for AI orchestration.

**Features**:
- Semantic Kernel SDK
- LLM integration
- Plugin system
- Example workflows

[View Template →](semantic-kernel/)

---

### 🦅 NestJS + EmbedJS

**Category**: Backend / TypeScript  
**Path**: `templates/nestjs-embedjs-template/`

NestJS framework with EmbedJS for embeddings and vector search.

**Features**:
- NestJS framework
- EmbedJS integration
- Vector database support
- API scaffolding

[View Template →](nestjs-embedjs-template/)

---

## Template Categories

### By Use Case

- **AI Development**: Neovim + Avante, Semantic Kernel
- **Machine Learning**: Rust + Burn ML, Python
- **Backend Development**: Node.js, NestJS, Python
- **Fast Prototyping**: Neovim + Avante, Node.js

### By Performance

| Template | Boot Time | Memory | Storage |
|----------|-----------|--------|---------|
| Neovim + Avante | < 3s | 512 MB | 50 MB |
| Node.js | ~5s | 1 GB | 500 MB |
| Python | ~5s | 1 GB | 500 MB |
| Rust + Burn | ~10s | 2 GB | 1 GB |

### By Difficulty

- **Beginner**: Node.js, Python
- **Intermediate**: Neovim + Avante, NestJS
- **Advanced**: Rust + Burn ML, Semantic Kernel

## Creating Custom Templates

### Template Structure

```
templates/
└── your-template/
    ├── template.json       # Template metadata
    ├── README.md          # Documentation
    ├── Dockerfile         # Container config (optional)
    ├── .vscode/           # VS Code settings (optional)
    └── src/               # Source files
```

### Template Metadata (template.json)

```json
{
  "name": "Your Template",
  "description": "Template description",
  "version": "1.0.0",
  "category": "category",
  "tags": ["tag1", "tag2"],
  "author": "Your Name",
  "icon": "🚀",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedSetupTime": "< 5 seconds",
  "features": [],
  "requirements": {
    "memory": "1GB",
    "storage": "500MB",
    "network": false
  }
}
```

### Submission Process

1. Create template directory in `templates/`
2. Add `template.json` and `README.md`
3. Test template locally
4. Submit PR with template
5. Update this catalog

## Template Guidelines

### Best Practices

1. **Performance**: Optimize for fast startup (< 5s target)
2. **Documentation**: Include comprehensive README
3. **Dependencies**: Pin versions for reproducibility
4. **Security**: No hardcoded secrets or credentials
5. **Size**: Keep templates minimal (< 1 GB)

### Required Files

- `template.json` - Metadata and configuration
- `README.md` - User documentation
- `LICENSE` - License information (if different from main)

### Optional Files

- `Dockerfile` - Container configuration
- `.vscode/` - VS Code settings
- `.devcontainer/` - Dev container config
- `scripts/` - Setup and utility scripts
- `examples/` - Example code and projects

## Integration with VibeCode

### Workspace Provisioning

Templates integrate with VibeCode's workspace provisioning:

1. User selects template from catalog
2. VibeCode provisions workspace (< 5s target)
3. Template environment is ready to use
4. User can customize and save changes

### Performance Targets

- **Provisioning**: < 5 seconds
- **Boot Time**: < 10 seconds
- **Memory**: < 2 GB (recommended)
- **Storage**: < 1 GB (recommended)

### AI Integration

Templates can leverage VibeCode's AI features:

- AI project generation
- Code suggestions
- Chat assistance
- Template customization

## Resources

- [VibeCode Documentation](../docs/)
- [Template Development Guide](../docs/templates/)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [GitHub Repository](https://github.com/ryanmaclean/vibecode-webgui)

## Support

For template-related questions:

- GitHub Issues: [vibecode-webgui/issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- Documentation: [docs/](../docs/)
- Community: [Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)

## Contributing

We welcome template contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Template Ideas

Looking for inspiration? Here are some template ideas:

- Go + Gin web framework
- Ruby on Rails
- Django + PostgreSQL
- React + TypeScript
- Vue.js + Vite
- Flutter development
- Kotlin + Spring Boot
- Elixir + Phoenix
- Svelte + SvelteKit
- Deno + Fresh

---

**Last Updated**: October 2, 2025  
**Total Templates**: 6  
**Latest Addition**: Neovim + Avante.nvim
