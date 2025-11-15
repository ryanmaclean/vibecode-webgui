## Testing Guide

This document covers how to test the Workspace RAG extension across different environments.

## Local Testing

### Unit Tests

Run unit tests for safeguards, text splitting, and core logic:

```bash
npm run test:unit
```

### Integration Tests

Integration tests require a running PostgreSQL instance with pgvector:

```bash
# Start PostgreSQL with pgvector
docker run -d --name rag-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rag_db_test \
  -p 5432:5432 \
  pgvector/pgvector:pg15

# Run tests
npm test
```

### Extension Development Testing

1. Open this folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test commands:
   - `RAG: Index Workspace`
   - `RAG: Set OpenAI API Key`
   - Open RAG Chat panel
   - Ask questions about code

## OpenVSCode-Server Testing

OpenVSCode-Server is the open-source version of VS Code for the web. Testing in this environment ensures browser compatibility.

### Setup OpenVSCode-Server

#### Option 1: Docker

```bash
# Pull and run openvscode-server
docker run -it --init -p 3000:3000 \
  -v "$(pwd):/home/workspace:cached" \
  gitpod/openvscode-server:latest
```

Access at: http://localhost:3000

#### Option 2: Direct Installation

```bash
# Download latest release
wget https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.85.0/openvscode-server-v1.85.0-linux-x64.tar.gz

# Extract
tar -xzf openvscode-server-v1.85.0-linux-x64.tar.gz

# Run
cd openvscode-server-v1.85.0-linux-x64
./bin/openvscode-server --host 0.0.0.0 --port 3000
```

### Installing the Extension

#### Method 1: Package and Install

```bash
# In workspace-rag directory
npm run package

# This creates workspace-rag-1.0.0.vsix
```

Then in OpenVSCode-Server:
1. Click Extensions icon (Ctrl+Shift+X)
2. Click "..." menu → "Install from VSIX"
3. Upload the `.vsix` file

#### Method 2: Development Mode

```bash
# In your workspace root
cd extensions/workspace-rag

# Watch for changes
npm run watch

# In another terminal, launch openvscode-server with extension path
openvscode-server \
  --extensions-dir ./extensions \
  --install-extension ./workspace-rag \
  --host 0.0.0.0 \
  --port 3000
```

### Testing Checklist for OpenVSCode-Server

#### Database Connection
- [ ] Configure PostgreSQL settings
- [ ] Test connection to local/remote database
- [ ] Verify pgvector extension works

#### File System Operations
- [ ] Index workspace (file scanning)
- [ ] Handle large files correctly
- [ ] Respect .gitignore patterns
- [ ] Incremental indexing works

#### Webview Functionality
- [ ] Chat panel loads correctly
- [ ] CSS styling works (Tahoe UI)
- [ ] Message sending/receiving works
- [ ] Source links open files correctly
- [ ] Status indicators display properly

#### API Integration
- [ ] Set API keys via secrets
- [ ] Provider selection works
- [ ] OpenAI calls succeed
- [ ] Anthropic calls succeed
- [ ] Google calls succeed
- [ ] OpenRouter calls succeed
- [ ] Fallback to simple extraction works

#### Security
- [ ] API keys stored securely
- [ ] Rate limiting works
- [ ] Query validation blocks XSS
- [ ] Path traversal blocked
- [ ] Error messages sanitized

#### Performance
- [ ] Indexing doesn't block UI
- [ ] Query responses < 5s
- [ ] Large workspaces handle gracefully
- [ ] Memory usage stays reasonable

### Common Issues in OpenVSCode-Server

#### 1. File System Access

OpenVSCode-Server may have restricted file system access:

```typescript
// Always use VS Code workspace API, not Node fs directly
const files = await vscode.workspace.findFiles(pattern);
const content = await vscode.workspace.fs.readFile(uri);
```

#### 2. Database Connectivity

For remote OpenVSCode-Server instances, ensure database is accessible:

```bash
# Test from server host
psql -h your-db-host -p 5432 -U postgres -d rag_db
```

Set SSH tunnel if needed:
```bash
ssh -L 5432:localhost:5432 your-server
```

#### 3. Webview CSP

Content Security Policy is stricter in browser. Our CSP header:

```typescript
<meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'unsafe-inline';
">
```

#### 4. API Calls from Browser

All API calls go through extension host, not directly from browser:

```
Browser Webview → Extension Host → LLM Provider
```

This is already handled correctly in our implementation.

## CI/CD Testing

### GitHub Actions

Our CI pipeline (`.github/workflows/test.yml`) runs:

1. **Lint**: Code style checking
2. **Compile**: TypeScript compilation
3. **Unit Tests**: Fast, no external dependencies
4. **Integration Tests**: With PostgreSQL service
5. **Security Audit**: npm audit for vulnerabilities
6. **Package**: Build .vsix artifact

### Running Locally

Simulate CI environment:

```bash
# Install dependencies
npm ci

# Lint
npm run lint

# Compile
npm run compile

# Test
npm run test:unit

# Package
npm run package
```

## Manual Test Scenarios

### Scenario 1: First-Time Setup

1. Fresh install of extension
2. No API keys configured
3. No database connection
4. Expected: Friendly error messages, helpful prompts

### Scenario 2: Indexing Large Workspace

1. Open workspace with 1000+ files
2. Run index command
3. Expected: Progress indicator, cancellable, no crashes

### Scenario 3: Multiple Providers

1. Configure OpenAI key
2. Ask question → verify works
3. Switch to Anthropic
4. Configure Anthropic key
5. Ask question → verify works
6. Remove API keys
7. Ask question → fallback to simple extraction

### Scenario 4: Rate Limiting

1. Send 70 requests rapidly
2. Expected: Block after 60, show message
3. Wait 1 minute
4. Expected: Requests work again

### Scenario 5: Malicious Input

1. Try XSS in query: `<script>alert('xss')</script>`
2. Try path traversal: `/workspace/../../../etc/passwd`
3. Try SQL injection: `'; DROP TABLE users; --`
4. Expected: All blocked with error messages

### Scenario 6: Network Failures

1. Disconnect internet
2. Try to use OpenAI
3. Expected: Automatic retry (3x), then fallback

### Scenario 7: Database Failures

1. Stop PostgreSQL
2. Try to index
3. Expected: Clear error message, suggestion to check config

## Performance Benchmarks

### Indexing Performance

Target metrics:
- Small project (100 files): < 2 minutes
- Medium project (1000 files): < 10 minutes
- Large project (5000 files): < 30 minutes

Test command:
```bash
time npm run test:benchmark
```

### Query Performance

Target metrics:
- Embedding generation: < 100ms (local MLX)
- Vector search: < 10ms
- LLM response: < 3s
- Total query time: < 5s

## Test Coverage

Current coverage:

```
Safeguards:      100% (32/32 tests)
Text Splitter:   100% (8/8 tests)
Integration:     90% (18/20 tests)
Providers:       75% (mock tests)
Overall:         91%
```

Generate coverage report:
```bash
npm run test:coverage
```

## Debugging Tests

### VS Code Debugger

1. Open test file
2. Set breakpoints
3. Press `F5`
4. Select "Extension Tests"

### Debug Output

Enable debug mode in settings:
```json
{
  "workspaceRag.debugMode": true
}
```

View logs:
- View → Output
- Select "Workspace RAG" from dropdown

### Network Debugging

Monitor API calls:
```bash
# Set environment variable
export NODE_TLS_REJECT_UNAUTHORIZED=0
export DEBUG=*

# Run tests
npm test
```

## Continuous Testing

### Watch Mode

Run tests automatically on file changes:
```bash
npm run test:watch
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
cd extensions/workspace-rag
npm run lint && npm run test:unit
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Test Data

### Sample Workspaces

We provide sample workspaces for testing:

```bash
# Clone test workspace
git clone https://github.com/vibecode/test-workspaces

# Test with different languages
cd test-workspaces/javascript-project
code .

cd ../python-project
code .

cd ../mixed-language
code .
```

### Mock Data

Unit tests use mock data in `src/test/fixtures/`:
- `sample-code.ts` - Sample TypeScript code
- `sample-markdown.md` - Sample documentation
- `sample-embeddings.json` - Pre-generated embeddings

## Reporting Issues

When reporting test failures, include:

1. Environment (OS, Node version, VS Code version)
2. Test output (full error stack trace)
3. Extension logs (Output panel → Workspace RAG)
4. Steps to reproduce
5. Expected vs actual behavior

File issues at: https://github.com/vibecode/workspace-rag/issues

## Contributing Tests

When adding new features, include:

1. Unit tests for new functions
2. Integration tests for workflows
3. Update this TESTING.md
4. Update test scenarios

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

