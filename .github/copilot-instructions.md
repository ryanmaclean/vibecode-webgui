# Copilot Instructions for VibeCode

This document provides guidance for GitHub Copilot when working on the VibeCode project.

## Repository Overview

VibeCode is a test/demo repository for experimenting with:
- Desktop app builds (Tauri + Rust)
- OpenVSCode Server integration
- Build system verification and tracing
- VS Code extension development (workspace-rag)
- macOS virtualization with the Virtualization framework
- Multi-language development (TypeScript, Swift, Go, Rust)

## Technology Stack

### Frontend/Web
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5.9
- **UI Components**: Radix UI, Tremor, Lucide React
- **State Management**: Zustand
- **Editor**: Monaco Editor with Monacopilot

### Backend/Services
- **Runtime**: Node.js 18+ (< 25.0.0)
- **API**: Next.js API routes
- **Authentication**: NextAuth
- **Database**: PostgreSQL (via Prisma), MongoDB, Cosmos DB
- **Caching**: Redis, Valkey, Upstash
- **AI/ML**: OpenAI SDK, Langchain, Hugging Face, MLX embeddings

### Desktop
- **Framework**: Tauri 2.9
- **Backend**: Rust
- **Frontend**: Next.js (same as web)

### Native/Systems
- **macOS VM Management**: Swift (Virtualization framework)
- **Backend Services**: Go
- **Build Tools**: Make, npm scripts

### Testing
- **Unit/Integration**: Jest 30
- **E2E**: Playwright 1.56
- **Code Quality**: ESLint 9
- **Security**: CodeQL, Gitleaks, TruffleHog

### Infrastructure
- **Container**: Docker, Kubernetes (kind)
- **Cloud**: Azure (Functions, Cosmos DB, Storage)
- **Monitoring**: Datadog (APM, logs, metrics), OpenTelemetry
- **CI/CD**: GitHub Actions

## Development Workflow

### Setup
```bash
# Install dependencies
npm install --legacy-peer-deps

# Run development server
npm run dev

# Run Tauri app
npm run tauri:dev
```

### Building
```bash
# Build Next.js app
npm run build

# Build Tauri app
npm run tauri:build

# Build OpenVSCode Server (requires Node 22+ and Rust)
cd openvscode-server
npm install
npm run gulp vscode-darwin-arm64
```

### Testing
```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Security tests
npm run test:security
```

### Linting and Type Checking
```bash
# Lint code
npm run lint

# Type check
npm run type-check

# Run both
npm run check
```

## Code Style and Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration in `eslint.config.mjs`
- Prefer functional components and hooks in React
- Use proper typing - avoid `any` when possible
- Add JSDoc comments for complex functions
- Use async/await over promise chains

### Swift
- Follow standard Swift conventions
- 4 spaces for indentation
- Clear, descriptive variable names
- Add comments for complex logic

### Go
- Follow Go standard formatting (use `gofmt`)
- Follow Go best practices
- Add comments for exported functions and types

### Shell Scripts
- Use `#!/bin/bash` for shell scripts
- Use `set -e` for error handling
- Add comments for non-obvious operations
- Quote variables to prevent word splitting

## Important Directories

### Source Code
- `src/` - Next.js application source (pages, components, API routes)
- `src-tauri/` - Tauri desktop application backend (Rust)
- `extensions/` - VS Code extensions (workspace-rag, ai-assistant, etc.)
- `VibeCodeSwift/` - Swift code for macOS VM management
- `go/` - Go backend services
- `services/` - Microservices (ai-gateway, etc.)

### Configuration
- `.github/` - GitHub Actions workflows, issue templates, agents
- `config/` - Application configuration files
- `k8s/` - Kubernetes manifests
- `docker/` - Docker configurations
- `charts/` - Helm charts

### Testing
- `tests/` - Test suites (unit, integration, e2e, k8s, security)
- `__mocks__/` - Jest mocks

### Build & Scripts
- `scripts/` - Build automation, testing, deployment scripts
- `bin/` - Executable scripts
- `.build/` - Build artifacts

### Documentation
- `docs/` - Technical documentation (mix of working docs and exploration notes)
- `claudedocs/` - AI-generated documentation and summaries
- `wiki/` - Project wiki content

### Infrastructure
- `infrastructure/` - Infrastructure as code
- `tofu/` - OpenTofu/Terraform configurations
- `ansible/` - Ansible playbooks
- `azure/` - Azure-specific configurations
- `azure-functions/` - Azure Functions code

### Data & Assets
- `public/` - Static assets served by Next.js
- `data/` - Application data
- `vm-assets/` - VM configuration files
- `templates/` - Template files

## Important Files

- `package.json` - npm dependencies and scripts
- `next.config.mjs` - Next.js configuration
- `next.config.tauri.js` - Next.js config for Tauri builds
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint rules
- `playwright.config.ts` - Playwright test configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `Makefile` - Build automation
- `.nvmrc` / `.node-version` - Node.js version (22)

## Security Considerations

### General
- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive data
- Follow the security scanning results from CodeQL, Gitleaks, and TruffleHog
- Run security tests before submitting PRs: `npm run test:security`

### Secrets Management
- Use the macOS Keychain for secure storage on macOS
- Use Azure Key Vault for cloud deployments
- See `scripts/security/` for security-related utilities
- Run `npm run security:validate-keychain` to validate secrets

### Dependencies
- Use `npm audit` to check for vulnerabilities
- Keep dependencies up to date with security patches
- Review dependency updates carefully

## Testing Strategy

### When to Add Tests
- **Always** add unit tests for new utility functions and business logic
- Add integration tests for API endpoints
- Add E2E tests for critical user flows
- Add security tests for authentication and authorization features

### Test Organization
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Kubernetes tests: `tests/k8s/`
- Security tests: `tests/security/`
- Performance tests: `tests/performance/`

### Running Tests Efficiently
- Use `npm run quick-test` for fast unit test feedback
- Use `npm run test:unit -- --watch` during development
- Run full test suite before submitting PR

## Special Considerations

### Legacy Peer Dependencies
- Always use `npm install --legacy-peer-deps` due to React 19 migration
- This is necessary for compatibility with some packages

### Monorepo Structure
- The repository contains multiple sub-projects (extensions, services)
- Each may have its own `package.json` and build process
- When working on extensions, cd into the extension directory first

### Build Artifacts
- Build artifacts are in `.build/`, `node_modules/`, `.next/`
- These are gitignored and should not be committed
- Clean builds with `rm -rf .build .next node_modules` if needed

### Submodules
- `openvscode-server/` is a Git submodule
- Update with `git submodule update --init --recursive`

### Platform-Specific Code
- Swift code is macOS-only
- Some VM features require macOS with Apple Silicon
- Use feature detection and graceful degradation

## Common Tasks

### Adding a New API Route
1. Create file in `src/app/api/`
2. Export handlers (GET, POST, etc.)
3. Add proper TypeScript types
4. Add error handling
5. Add tests in `tests/integration/`
6. Document the endpoint

### Adding a New Component
1. Create in `src/components/`
2. Use TypeScript with proper props interface
3. Follow existing component patterns
4. Add to relevant page/layout
5. Consider accessibility (use semantic HTML)

### Updating Dependencies
1. Check compatibility: `npm run deps:check`
2. Update carefully (prefer patch/minor updates)
3. Test thoroughly after updates
4. Update lock files

### Working with VS Code Extensions
1. Navigate to extension directory: `cd extensions/[extension-name]`
2. Install dependencies: `npm ci --legacy-peer-deps`
3. Compile: `npm run compile`
4. Package: `vsce package`
5. Test in VS Code

## Monitoring and Observability

### Datadog Integration
- APM tracing is configured via `dd-trace`
- Metrics are sent via `hot-shots`
- Logs use structured logging with `winston` and `pino`
- See `scripts/setup-datadog-monitoring.ts` for setup

### OpenTelemetry
- Alternative to Datadog for tracing
- Configuration in `instrumentation.ts`
- Use `npm run otel:setup` to configure

## Contributing Guidelines

- Read `CONTRIBUTING.md` for detailed contribution guidelines
- Follow existing code patterns and style
- Be honest about what works and what doesn't
- Write tests when possible
- Update documentation for significant changes
- No strict requirements - working code is better than perfect code

## Common Pitfalls

### React 19 Migration
- Some packages may not be fully compatible with React 19
- Use overrides in package.json when necessary
- Test UI components thoroughly

### TypeScript Strict Mode
- The project uses TypeScript but not all code is strictly typed
- Prefer proper typing but avoid blocking work on type perfection

### Build Performance
- Next.js builds can be slow
- Use `npm run dev` for fast feedback during development
- Consider `--turbo` flag for faster builds (experimental)

### Test Flakiness
- Some integration tests may be flaky due to timing
- E2E tests require proper wait conditions
- Use retry mechanisms for flaky tests

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tauri Documentation](https://tauri.app/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Playwright Documentation](https://playwright.dev/)
- [Swift Virtualization Framework](https://developer.apple.com/documentation/virtualization)

## Getting Help

- Check `docs/` for technical documentation
- Look at existing code for examples
- Open an issue for questions
- No question is too basic

## Project Goals

We are trying to:
- Make a useful developer tool
- Learn about macOS virtualization
- Help developers who need local VMs
- Share knowledge and build cool stuff

We are NOT trying to:
- Build the perfect VM manager
- Compete with commercial products
- Win awards or get press
