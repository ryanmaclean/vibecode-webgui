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

### ⚛️ React + TypeScript + Vite (NEW!)

**Category**: Frontend / React
**Difficulty**: Beginner
**Setup Time**: < 5 seconds
**Path**: `templates/react/react-typescript-vite/`

Modern React development environment with TypeScript, Vite, and integrated monitoring.

**Features**:
- React 18 with TypeScript 5
- Vite 5 for ultra-fast builds
- ESLint and TypeScript strict mode
- Optional Datadog RUM integration
- Code splitting and optimized vendor chunks
- Hot Module Replacement (HMR)

**Use Cases**:
- Single-page applications
- Component libraries
- Dashboard applications
- Fast prototyping

**Requirements**:
- Memory: 1 GB
- Storage: 500 MB
- Network: Optional (required for monitoring)

[View Template →](react/react-typescript-vite/README.md)

---

### 🐹 Go Microservices (NEW!)

**Category**: Backend / Go
**Difficulty**: Intermediate
**Setup Time**: < 5 seconds
**Path**: `templates/go/go-microservices/`

Production-ready Go microservices template with monitoring stack and Docker support.

**Features**:
- Go 1.21+ with modern project structure
- Prometheus metrics endpoint
- Health check endpoints
- Docker multi-stage builds
- Complete monitoring stack (Prometheus, Grafana, Node Exporter)
- Hot reload for development
- Environment-based configuration

**Use Cases**:
- RESTful APIs
- Microservices architecture
- High-performance backends
- Cloud-native applications

**Requirements**:
- Memory: 512 MB (2 GB with monitoring stack)
- Storage: 200 MB
- Network: Required

[View Template →](go/go-microservices/README.md)

---

## Template Categories

### By Use Case

- **AI Development**: Neovim + Avante, Semantic Kernel
- **Machine Learning**: Rust + Burn ML, Python
- **Backend Development**: Node.js, NestJS, Go Microservices, Python
- **Frontend Development**: React + TypeScript + Vite
- **Fast Prototyping**: Neovim + Avante, React + Vite, Node.js

### By Performance

| Template | Boot Time | Memory | Storage |
|----------|-----------|--------|---------|
| Neovim + Avante | < 3s | 512 MB | 50 MB |
| React + TypeScript + Vite | < 5s | 1 GB | 500 MB |
| Go Microservices | < 5s | 512 MB | 200 MB |
| Node.js | ~5s | 1 GB | 500 MB |
| Python | ~5s | 1 GB | 500 MB |
| Rust + Burn | ~10s | 2 GB | 1 GB |

### By Difficulty

- **Beginner**: Node.js, Python, React + TypeScript + Vite
- **Intermediate**: Neovim + Avante, NestJS, Go Microservices
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
  },
  "monitoring": {
    "enabled": true,
    "provider": "datadog|prometheus",
    "configFile": "monitoring.yml"
  },
  "files": [
    "README.md",
    "template.json",
    "monitoring.yml"
  ]
}
```

**New Features**:
- **Monitoring Configuration**: Templates can include pre-configured monitoring for Datadog or Prometheus
- **Resource Customization**: Define memory, storage, and network requirements
- **File Manifest**: List all files included in the template

### Submission Process

1. Create template directory in `templates/`
2. Add `template.json` and `README.md`
3. Run validation script: `node scripts/validate-template.js templates/your-template/`
4. Test template locally
5. Submit PR using template contribution workflow: `node scripts/submit-template.js templates/your-template/`
6. Update this catalog

**Automated Validation**: All templates must pass validation before submission. The validation script checks:
- Required files (`template.json`, `README.md`)
- Template metadata schema
- Monitoring configuration (if enabled)
- Resource requirements format
- File manifest accuracy

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

- Ruby on Rails
- Django + PostgreSQL
- Vue.js + Vite
- Flutter development
- Kotlin + Spring Boot
- Elixir + Phoenix
- Svelte + SvelteKit
- Deno + Fresh
- .NET Core + C#
- Swift + Vapor

---

**Last Updated**: February 14, 2026
**Total Templates**: 8
**Latest Additions**: React + TypeScript + Vite, Go Microservices
