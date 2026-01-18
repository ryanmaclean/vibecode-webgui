# Developer Guide

Welcome to VibeCode! This guide will help you get started with development and provide practical guidance for common tasks.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Common Tasks](#common-tasks)
- [Testing](#testing)
- [Code Review Process](#code-review-process)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

## Quick Start

### Prerequisites

- **Node.js**: 18.18.0 to 24.x (check with `node --version`)
- **npm**: 9.0.0 or higher
- **PostgreSQL**: 16+ with pgvector extension
- **Docker**: Optional, for containerized development

### First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Run setup script (installs native binaries and checks environment)
npm run setup

# 5. Start development server
npm run dev
```

Visit `http://localhost:3000` to see your local instance.

### Quick Validation

After setup, verify everything works:

```bash
# Check TypeScript compilation
npm run type-check

# Run linting
npm run lint

# Run unit tests
npm run test:unit

# Verify Monaco editor integration
npm run test:unit:monaco
```

## Project Architecture

### Tech Stack Overview

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Editor**: Monaco 0.53.0 with Monacopilot AI completion
- **Database**: PostgreSQL 16 + pgvector for semantic search
- **AI Providers**: OpenAI, Anthropic, Gemini, Groq, DeepSeek
- **Monitoring**: Datadog (APM, DBM, RUM)
- **Infrastructure**: Kubernetes (AKS), Docker, Helm

### Directory Structure

```
vibecode-webgui/
├── src/                    # Application source code
│   ├── app/               # Next.js App Router pages and API routes
│   ├── components/        # React components
│   ├── lib/              # Shared libraries and utilities
│   ├── mcp/              # Model Context Protocol server
│   └── instrument.ts     # Datadog instrumentation
├── tests/                 # Test suites
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── e2e/              # Playwright E2E tests
│   ├── scripts/          # Bats script tests
│   └── k8s/              # Kubernetes tests
├── scripts/              # Build and deployment scripts
├── docker/               # Docker configurations
│   └── code-server/      # code-server multi-profile images
├── k8s/                  # Kubernetes manifests
├── charts/               # Helm charts
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD workflows
```

### Key Components

**Monaco Editor Integration** (`src/app/api/code-completion/route.ts`)
- AI-powered code completion
- Multi-provider support (OpenAI, Anthropic, etc.)
- Real-time code suggestions

**Vector Search** (`src/lib/services/vector-search.ts`)
- Semantic code search using pgvector
- HNSW indexes for fast similarity queries
- Codebase chat functionality

**MCP Server** (`src/mcp/server.ts`)
- Model Context Protocol integration
- Compatible with Windsurf and Claude Desktop
- Provides context-aware code assistance

## Development Workflow

### Branch Strategy

```bash
# Always work on feature branches, never on main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Make your changes...

# Before committing, run checks
npm run check  # Runs lint + type-check
npm run test:unit

# Commit with conventional commits
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in component"
git commit -m "docs: update development guide"
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring
- `chore:` - Build process or tooling changes
- `perf:` - Performance improvements

### Pre-Commit Checklist

Before committing code:

- [ ] Code compiles without TypeScript errors: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Unit tests pass: `npm run test:unit`
- [ ] New features have tests
- [ ] Documentation updated if needed

### Coordination Protocol

**Important**: Check `TODO.md` before starting work to:
- See what work areas are already claimed
- Avoid conflicts with ongoing work
- Follow the live coordination protocol
- Document your intent for large changes

## Common Tasks

### Adding a New Feature

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Implement your feature**
   - Add components in `src/components/`
   - Add API routes in `src/app/api/`
   - Follow existing code patterns

3. **Add tests**
   ```bash
   # Unit tests in tests/unit/
   npm run test:unit -- --watch

   # Integration tests in tests/integration/
   npm run test:integration
   ```

4. **Update documentation**
   - Add inline code comments
   - Update relevant docs in `docs/`
   - Don't create unnecessary documentation files

5. **Test locally**
   ```bash
   npm run dev
   npm run test
   ```

### Working with the Monaco Editor

```typescript
// Example: Adding a custom Monaco language feature
import * as monaco from 'monaco-editor';

// Register custom completion provider
monaco.languages.registerCompletionItemProvider('typescript', {
  provideCompletionItems: (model, position) => {
    // Your custom completion logic
    return {
      suggestions: [
        {
          label: 'myCustomFunction',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'myCustomFunction()',
        }
      ]
    };
  }
});
```

### Working with Vector Search

```typescript
// Example: Querying the vector database
import { VectorSearchService } from '@/lib/services/vector-search';

const searchService = new VectorSearchService();

// Search for similar code
const results = await searchService.search({
  query: "authentication middleware",
  limit: 5,
  threshold: 0.7
});

// Results contain semantically similar code snippets
console.log(results);
```

### Adding AI Provider Support

To add a new AI provider:

1. **Add provider configuration** in `src/lib/ai-providers/`
2. **Implement the provider interface**
3. **Add environment variables** to `.env.example`
4. **Update the provider selector** in the UI
5. **Add tests** for the provider

Example provider implementation:
```typescript
// src/lib/ai-providers/my-provider.ts
export class MyAIProvider implements AIProvider {
  async complete(prompt: string, options: CompletionOptions) {
    // Implementation
  }
}
```

### Working with Docker

```bash
# Build local Docker image
docker build -t vibecode-webgui:dev .

# Run with Docker Compose
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Kubernetes Development

```bash
# Create local KinD cluster
kind create cluster --name vibecode

# Deploy to local cluster
kubectl apply -f k8s/vibecode-kind.yaml

# Port forward to access locally
kubectl port-forward svc/vibecode 3000:80

# View logs
kubectl logs -f deployment/vibecode

# Clean up
kind delete cluster --name vibecode
```

## Testing

### Test Structure

```
tests/
├── unit/           # Fast, isolated unit tests
├── integration/    # Component interaction tests
├── e2e/           # Full user journey tests (Playwright)
├── scripts/       # Shell script tests (Bats)
└── k8s/           # Kubernetes deployment tests
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only (fast feedback)
npm run test:unit

# With coverage
npm run test:coverage

# Integration tests
npm run test:integration

# E2E tests (requires running server)
npm run test:e2e

# E2E tests with UI (for debugging)
npm run test:e2e:headed

# Script tests (Bats framework)
npm run test:scripts

# Kubernetes tests
npm run test:k8s

# Quick test (unit tests only, limited workers)
npm run quick-test
```

### Writing Tests

**Unit Test Example:**
```typescript
// tests/unit/utils/string-helpers.test.ts
import { capitalize } from '@/lib/utils/string-helpers';

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should handle empty strings', () => {
    expect(capitalize('')).toBe('');
  });
});
```

**Integration Test Example:**
```typescript
// tests/integration/api-completion.test.ts
import { POST } from '@/app/api/code-completion/route';

describe('Code Completion API', () => {
  it('should return completions', async () => {
    const request = new Request('http://localhost:3000/api/code-completion', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'function sum',
        provider: 'openai'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.completion).toBeDefined();
  });
});
```

**E2E Test Example:**
```typescript
// tests/e2e/editor.test.ts
import { test, expect } from '@playwright/test';

test('user can type in Monaco editor', async ({ page }) => {
  await page.goto('/');

  // Wait for Monaco to load
  await page.waitForSelector('.monaco-editor');

  // Type in editor
  await page.keyboard.type('console.log("Hello");');

  // Verify content
  const editorContent = await page.textContent('.monaco-editor');
  expect(editorContent).toContain('Hello');
});
```

### Test Best Practices

1. **Test Isolation**: Each test should be independent
2. **Arrange-Act-Assert**: Clear test structure
3. **Meaningful Names**: Describe what is being tested
4. **Mock External Dependencies**: Use mocks for APIs, databases
5. **Test Behavior, Not Implementation**: Focus on outcomes
6. **Keep Tests Fast**: Unit tests should run in milliseconds

### Debugging Tests

```bash
# Run specific test file
npm run test:unit -- tests/unit/specific-file.test.ts

# Run tests matching pattern
npm run test:unit -- --testNamePattern="my test"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Playwright debug mode
npm run test:e2e:headed
```

## Code Review Process

### Before Submitting a PR

1. **Self-review your changes**
   ```bash
   git diff main...your-branch
   ```

2. **Run the full test suite**
   ```bash
   npm run check
   npm test
   ```

3. **Update documentation** if needed

4. **Check for sensitive data**
   - No API keys, passwords, or secrets
   - Use environment variables

### PR Checklist

- [ ] Branch is up to date with main
- [ ] All tests pass locally
- [ ] Code follows project style (linting passes)
- [ ] New features have tests
- [ ] Breaking changes are documented
- [ ] Commit messages follow convention
- [ ] PR description explains the changes
- [ ] Related issues are linked

### PR Template

When creating a PR, include:

```markdown
## Summary
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Bullet list of key changes

## Testing
How was this tested?

## Screenshots (if applicable)
Visual changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Automated checks** run on PR creation
2. **Reviewer assigned** (usually within 1 business day)
3. **Feedback addressed** through discussions
4. **Approval** from at least one maintainer
5. **Merge** to main branch

## Troubleshooting

### Common Issues

#### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript errors after pulling latest code

```bash
# Rebuild TypeScript declarations
npm run type-check
```

#### Dev server not starting

```bash
# Check if port 3000 is in use
lsof -i :3000
# Kill the process using port 3000
kill -9 <PID>

# Try simple dev mode
npm run dev:simple
```

#### Tests failing with "Cannot find module"

```bash
# Ensure test dependencies are installed
npm install --include=dev

# Clear Jest cache
npx jest --clearCache
```

#### Monaco editor not loading

```bash
# Verify Monaco package installation
npm list monaco-editor

# Check for Monaco-specific tests
npm run test:unit:monaco
```

#### Docker build failures

```bash
# Check Docker daemon is running
docker info

# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t vibecode-webgui:dev .
```

#### Kubernetes deployment issues

```bash
# Check cluster status
kubectl get nodes
kubectl get pods

# View pod logs
kubectl logs -f <pod-name>

# Describe pod for events
kubectl describe pod <pod-name>

# Check service endpoints
kubectl get endpoints
```

### Getting Detailed Logs

```bash
# Next.js debug mode
DEBUG=* npm run dev

# Verbose test output
npm test -- --verbose

# Playwright trace
npm run test:e2e -- --trace on
```

### Performance Issues

```bash
# Profile Next.js build
npm run build -- --profile

# Analyze bundle size
npm run build
npx @next/bundle-analyzer
```

## Getting Help

### Resources

- **Documentation**: Browse `docs/` directory
- **README**: [README.md](../README.md) for quick reference
- **Testing Guide**: [TESTING_STRATEGY.md](TESTING_STRATEGY.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **TODO**: [TODO.md](../TODO.md) for current work tracking

### Where to Ask Questions

1. **GitHub Issues**: For bugs and feature requests
   - Use issue templates in `.github/ISSUE_TEMPLATE/`
   - Search existing issues first

2. **GitHub Discussions**: For questions and ideas
   - Best for open-ended discussions
   - Community support

3. **Code Comments**: For clarification on specific code
   - Tag maintainers in PR comments
   - Ask in code review discussions

### Debug Checklist

When stuck, work through this checklist:

1. [ ] Read error message carefully
2. [ ] Check logs (`npm run dev` output, browser console)
3. [ ] Search existing issues on GitHub
4. [ ] Review relevant documentation
5. [ ] Try the troubleshooting steps above
6. [ ] Create minimal reproduction case
7. [ ] Ask for help with detailed context

### Reporting Issues

When reporting issues, include:

- **Environment**: OS, Node version, npm version
- **Steps to reproduce**: Exact commands run
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happened
- **Error messages**: Full error output
- **Screenshots**: If applicable

Example:
```
**Environment**
- OS: macOS 14.0
- Node: 20.10.0
- npm: 10.2.3

**Steps to Reproduce**
1. npm install
2. npm run dev
3. Navigate to /editor

**Expected**: Editor loads successfully
**Actual**: White screen, console error: "Cannot read property 'monaco' of undefined"

**Error**:
```
[full error stack trace]
```
```

## Best Practices Summary

### Code Quality
- Write TypeScript, not JavaScript
- Use ESLint and Prettier configurations
- Follow existing code patterns
- Keep functions small and focused
- Add JSDoc comments for complex functions

### Git Workflow
- Always work on feature branches
- Commit frequently with meaningful messages
- Keep commits focused and atomic
- Rebase on main before creating PR
- Don't commit sensitive data

### Testing
- Write tests for new features
- Maintain test coverage above 70%
- Test edge cases and error conditions
- Mock external dependencies
- Keep tests maintainable

### Documentation
- Update docs with code changes
- Write clear code comments
- Document complex logic
- Keep README and guides current
- Don't create unnecessary files

### Performance
- Optimize bundle size
- Use Next.js Image component
- Implement proper caching
- Monitor Core Web Vitals
- Profile before optimizing

---

**Welcome to the team!** If you have questions or suggestions for improving this guide, please open an issue or PR.
