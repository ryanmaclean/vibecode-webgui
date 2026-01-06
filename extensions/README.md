# VibeCode Extensions

This directory contains VS Code extensions developed for the VibeCode project.

## Available Extensions

### 1. Workspace RAG (`workspace-rag/`)

**Status**: ✅ Production Ready

A workspace-aware RAG (Retrieval-Augmented Generation) extension that brings intelligent code Q&A to VS Code using local pgvector database and MLX.

**Features**:
- Multi-provider LLM support (OpenAI, Anthropic, Google, OpenRouter)
- Local-first embedding generation with MLX on Apple Silicon
- pgvector for efficient vector similarity search
- Incremental workspace indexing
- Comprehensive security safeguards
- 40+ unit and integration tests
- Automatic fallback mechanisms

**Documentation**:
- [README](./workspace-rag/README.md) - Full feature documentation
- [TESTING](./workspace-rag/TESTING.md) - Testing guide including OpenVSCode-server
- [SECURITY_AND_PROVIDERS](./workspace-rag/SECURITY_AND_PROVIDERS.md) - Security and multi-provider guide
- [QUICKSTART](./workspace-rag/QUICKSTART.md) - 5-minute setup guide

**Status**: Production-ready with CI/CD, comprehensive tests, and security audits.

---

### 2. VibeCode MCP Extension (`vibecode-mcp-extension/`)

**Status**: ⚠️ Development

MCP (Model Context Protocol) integration for VS Code.

**Documentation**: [README](./vibecode-mcp-extension/README.md)

---

### 3. VibeCode AI Assistant (`vibecode-ai-assistant/`)

**Status**: ⚠️ Development

AI-powered coding assistant for VibeCode.

**Documentation**: [README](./vibecode-ai-assistant/README.md)

---

## Development

### Prerequisites

- **Node.js** 18.x or higher
- **VS Code** 1.85.0 or higher
- **TypeScript** 5.3.3 or higher

### Building All Extensions

```bash
# From extensions directory
for dir in */; do
  if [ -f "$dir/package.json" ]; then
    echo "Building $dir..."
    cd "$dir"
    npm install
    npm run compile
    cd ..
  fi
done
```

### Running Tests

```bash
# Test all extensions
for dir in */; do
  if [ -f "$dir/package.json" ]; then
    echo "Testing $dir..."
    cd "$dir"
    npm test
    cd ..
  fi
done
```

## CI/CD

Each extension has its own CI/CD pipeline:

- **workspace-rag**: `.github/workflows/test.yml`
  - Runs on: Ubuntu, macOS, Windows
  - Node versions: 18.x, 20.x
  - Includes integration tests with PostgreSQL
  - Security audits

### CI/CD Status

| Extension | Tests | Security | Coverage |
|-----------|-------|----------|----------|
| workspace-rag | ✅ | ✅ | 91% |
| vibecode-mcp-extension | ⚠️ | ⚠️ | - |
| vibecode-ai-assistant | ⚠️ | ⚠️ | - |

## Testing in OpenVSCode-Server

All extensions should be tested in OpenVSCode-Server for web compatibility.

See [workspace-rag/TESTING.md](./workspace-rag/TESTING.md) for detailed guide.

### Quick Test

```bash
# Run openvscode-server with your workspace
docker run -it --init -p 3000:3000 \
  -v "$(pwd):/home/workspace:cached" \
  gitpod/openvscode-server:latest

# Access at http://localhost:3000
# Install extension from VSIX via Extensions panel
```

## Security

### Best Practices

All extensions follow these security guidelines:

1. **API Keys**: Stored in VS Code Secrets API (encrypted)
2. **Input Validation**: All user inputs validated
3. **Rate Limiting**: Prevent abuse
4. **SQL Injection**: Parameterized queries only
5. **XSS Protection**: Content Security Policy enforced
6. **Path Traversal**: File path validation
7. **Error Sanitization**: API keys removed from logs

### Security Audits

```bash
# Run security audit for an extension
cd workspace-rag
npm audit --audit-level=moderate
```

### Reporting Security Issues

Email: security@vibecode.com (do not file public issues)

## Publishing

### Packaging

```bash
cd workspace-rag
npm run package

# Creates workspace-rag-1.0.0.vsix
```

### Publishing to Marketplace

```bash
# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# Publish (requires publisher account)
vsce publish
```

### Publishing to OpenVSX

```bash
# Install ovsx
npm install -g ovsx

# Publish
ovsx publish workspace-rag-1.0.0.vsix -p YOUR_TOKEN
```

## Extension Guidelines

When creating new extensions, follow these guidelines:

### Structure

```
extension-name/
├── .github/
│   └── workflows/
│       └── test.yml          # CI/CD pipeline
├── media/                    # Webview assets
├── src/
│   ├── test/
│   │   ├── suite/
│   │   │   └── index.ts
│   │   ├── *.test.ts        # Unit tests
│   │   └── runTest.ts
│   ├── providers/           # If multi-provider
│   ├── extension.ts         # Entry point
│   ├── logger.ts           # Logging
│   ├── errorHandler.ts     # Error handling
│   └── safeguards.ts       # Security
├── TESTING.md              # Testing guide
├── SECURITY.md             # Security documentation
├── CHANGELOG.md            # Version history
├── README.md               # Main documentation
├── package.json
├── tsconfig.json
└── webpack.config.js
```

### Required Files

- ✅ `README.md` - Feature documentation
- ✅ `TESTING.md` - How to test
- ✅ `CHANGELOG.md` - Version history
- ✅ `LICENSE` - MIT license
- ✅ `.github/workflows/test.yml` - CI/CD
- ✅ `src/test/*.test.ts` - Unit tests

### Code Quality

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with no errors
- **Test Coverage**: Minimum 80%
- **Documentation**: All public APIs documented
- **Error Handling**: All async operations wrapped
- **Logging**: Use structured logging

### Testing Requirements

- ✅ Unit tests for all core logic
- ✅ Integration tests for workflows
- ✅ Security tests for input validation
- ✅ Performance benchmarks for critical paths
- ✅ OpenVSCode-server compatibility verified

## Common Issues

### Extension Not Loading

1. Check VS Code version compatibility
2. Verify all dependencies installed: `npm install`
3. Rebuild: `npm run compile`
4. Check Output panel for errors

### Tests Failing

1. Ensure test database running (for integration tests)
2. Check Node version: `node --version`
3. Clear cache: `rm -rf node_modules && npm install`
4. Run with debug: `npm test -- --inspect-brk`

### Packaging Errors

1. Run `npm run vscode:prepublish`
2. Check for TypeScript errors: `npm run compile`
3. Verify package.json is valid
4. Check .vscodeignore patterns

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

All extensions are licensed under MIT. See individual LICENSE files.

## Support

- Issues: https://github.com/vibecode/vibecode-webgui/issues
- Discussions: https://github.com/vibecode/vibecode-webgui/discussions
- Email: support@vibecode.com

