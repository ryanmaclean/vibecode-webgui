# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform with advanced monitoring, security, and performance optimization.

> Last updated: October 23, 2025

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Available Scripts](#available-scripts)
- [Dependencies](#dependencies)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

🚀 **Next.js 15** - Latest React framework with App Router
🤖 **AI Integration** - Unified LiteLLM gateway with multiple providers
🔒 **Security Hardened** - Comprehensive security middleware and monitoring
📊 **Performance Monitoring** - Real-time metrics with Datadog integration
💾 **Caching Layer** - Redis-based intelligent caching
🗄️ **Database** - PostgreSQL with pgvector for AI embeddings
🧪 **Testing** - Complete testing suite with Jest, Playwright, and TestContainers
📚 **Documentation** - Auto-generated API docs and developer guides
🐳 **Docker Support** - Full containerization with development environment
🔧 **TypeScript** - Full type safety with strict configuration

## Quick Start

### Prerequisites

- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:migrate
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
vibecode-webgui/
├── AppleContainerRuntime/    
├── __mocks__/    
├── archive/    
├── artifacts/    
├── audit-results/    
├── azure/    
├── azure-functions/    
├── bench-images/    
├── bin/    
├── charts/    
├── claudedocs/    
├── cmd/    
├── code-server/    
├── config/    
├── configs/    
├── content/    
├── data/    
├── database/    # Database schemas and migrations
├── datadog/    
├── demo/    
├── demos/    
├── docker/    
├── docs/    # Documentation files
├── examples/    
├── extensions/    # VSCode extensions and tools
├── fast-openvscode-vm/    
├── helm/    
├── homebrew-vibecode/    
├── infrastructure/    
├── k8s/    # Kubernetes deployment manifests
├── kubernetes/    
├── launchd/    
├── litellm/    
├── logs/    
├── macos-fleet-orchestration/    
├── macos-native-build/    
├── macos-services/    
├── macos-vm/    
├── monitoring/    
├── ops/    
├── packages/    
├── performance-results/    
├── playwright-report/    
├── plugins/    
├── prisma/    
├── public/    # Static assets
├── queue-worker/    
├── reports/    
├── requirements/    
├── samples/    
├── scripts/    # Build and utility scripts
├── sdk/    
├── security/    
├── server/    
├── services/    
├── src/    # Source code
├── src-tauri/    
├── swift/    
├── templates/    
├── tests/    # Test files and configurations
├── tmp/    
├── tmp-codeium-example/    
├── tofu/    
├── types/    
├── vibecode-pgvector/    
├── watermarkpodautoscaler/    
├── web-dashboard/    
├── wiki/    
└── package.json
```

### Key Directories

- **src/app/** - Next.js app router pages and API routes
- **src/components/** - Reusable React components
- **src/lib/** - Utility functions and shared services
- **src/hooks/** - Custom React hooks
- **tests/** - Test files (unit, integration, E2E)
- **docs/** - Documentation and guides

## API Documentation

The application provides REST API endpoints for various functionalities:

### Core Endpoints

#### Agent-builder

- `/api/agent-builder/session`

#### Agents

- `/api/agents/[...path]`

#### Ai

- `/api/ai/chat`
- `/api/ai/chat/enhanced`
- `/api/ai/chat/stream`
- `/api/ai/chat/unified`
- `/api/ai/conversations/[workspaceId]`
- `/api/ai/function-call`
- `/api/ai/generate-project`
- `/api/ai/huggingface-chat`
- `/api/ai/huggingface-init`
- `/api/ai/litellm`
- `/api/ai/management`
- `/api/ai/model-selection`
- `/api/ai/provider-health`
- `/api/ai/search`
- `/api/ai/sequential-thinking`
- `/api/ai/upload`
- `/api/ai/web-search`

#### Auth

- `/api/auth/[...nextauth]`
- `/api/auth/login-tracking`
- `/api/auth/mfa/setup`
- `/api/auth/mfa/verify`
- `/api/auth/saml/metadata`
- `/api/auth/saml/sso`

#### Chat

- `/api/chat/mongodb`
- `/api/chat/mongodb-simple`
- `/api/chat/stream`

#### Claude

- `/api/claude/analyze`
- `/api/claude/chat`
- `/api/claude/generate`
- `/api/claude/session`

#### Code-completion

- `/api/code-completion`

#### Code-server

- `/api/code-server/session`
- `/api/code-server/session/[sessionId]`

#### Containers

- `/api/containers`
- `/api/containers/[id]`

#### Docker

- `/api/docker/status`

#### Docs

- `/api/docs/search`

#### Experiments

- `/api/experiments`

#### Files

- `/api/files`
- `/api/files/sync`

#### Gradio

- `/api/gradio/run`

#### Health

- `/api/health`
- `/api/health/connection-pool`
- `/api/health/database`
- `/api/health/database/metrics`
- `/api/health/db`
- `/api/health/simple`
- `/api/health/vector-db`
- `/api/health/vector-metrics`

#### Healthz

- `/api/healthz`

#### Monitoring

- `/api/monitoring/azure-embedding`
- `/api/monitoring/cache`
- `/api/monitoring/connection-pool/dashboard`
- `/api/monitoring/dashboard`
- `/api/monitoring/embeddings`
- `/api/monitoring/metrics`
- `/api/monitoring/otel-config`
- `/api/monitoring/page-load`
- `/api/monitoring/performance`
- `/api/monitoring/pool`
- `/api/monitoring/pool-alerts`
- `/api/monitoring/rum`
- `/api/monitoring/security`
- `/api/monitoring/traces`
- `/api/monitoring/user-journey`
- `/api/monitoring/web-vitals`

#### Ollama

- `/api/ollama/models`

#### Projects

- `/api/projects/template`

#### Readyz

- `/api/readyz`

#### Security

- `/api/security/csp-report`

#### Templates

- `/api/templates`

#### Terminal

- `/api/terminal/session`
- `/api/terminal/ws`

#### Test-db

- `/api/test-db`

#### Uploads

- `/api/uploads/pdf`

#### User

- `/api/user/preferences`

#### Vector-search

- `/api/vector-search`

#### Vector-store

- `/api/vector-store`

#### Workspace

- `/api/workspace/[id]/init-goose`
- `/api/workspace/auto-scaling`

#### Workspaces

- `/api/workspaces`
- `/api/workspaces/[id]`

For endpoint details and request/response examples, see [`docs/src/content/docs/api-reference.md`](docs/src/content/docs/api-reference.md).

## Available Scripts

### Development

### Development

```bash
npm run dev
```
Start development server with monitoring

```bash
npm run dev:simple
```
Start development server without monitoring

```bash
npm run build
```
Build production application

```bash
npm run start
```
Start production server

```bash
npm run lint
```
Run ESLint code linting

```bash
npm run type-check
```
Run TypeScript type checking


### Testing

```bash
npm run test
```
Run unit tests

```bash
npm run test:watch
```


```bash
npm run test:e2e
```
Run end-to-end tests

```bash
npm run test:integration
```
Run integration tests

```bash
npm run test:security
```
Run security tests


### Database

```bash
npm run db:migrate
```
Deploy database migrations


### Monitoring

```bash
npm run monitoring:health
```
Check system health

```bash
npm run monitoring:metrics
```
View performance metrics


### Security

```bash
npm run security:test
```
Run security vulnerability scan

```bash
npm run security:audit
```



### Documentation

```bash
npm run docs:validate
```
Validate documentation accuracy

```bash
npm run docs:stats
```


## Dependencies

### Core Technologies

- **next** (15.5.3) - React framework for production
- **react** (19.1.1) - JavaScript library for user interfaces
- **tailwindcss** (4.0.0) - Utility-first CSS framework
- **@prisma/client** (6.12.0) - Type-safe database client
- **redis** (5.8.3) - In-memory data structure store
- **next-auth** (^4.24.11) - Authentication library for Next.js
- **openai** (^4.104.0) - OpenAI API client
- **dd-trace** (5.72.0) - Datadog tracing library

### Development Dependencies

Key development tools include Jest, Playwright, ESLint, and Prisma CLI.

See [package.json](package.json) for complete dependency list.

## Development

### Environment Setup

1. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Configure required environment variables:
   - Database connection string
   - Redis connection string
   - API keys for AI services
   - Authentication secrets

3. Start development services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

### Code Quality

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Automated code formatting
- **Husky**: Git hooks for pre-commit validation

### Testing Strategy

- **Unit Tests**: Jest with React Testing Library
- **Integration Tests**: API and database integration testing
- **E2E Tests**: Playwright for browser automation
- **Security Tests**: Automated vulnerability scanning

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test: `npm run test && npm run test:e2e`
3. Check code quality: `npm run lint && npm run type-check`
4. Submit pull request with tests and documentation

## Deployment

### Production Environment

The application supports multiple deployment strategies:

#### Docker Deployment

```bash
# Build production image
docker build -t vibecode-webgui .

# Run with dependencies
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec app npm run db:migrate
```

#### Environment Variables

Required environment variables for production:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Authentication secret key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `DD_API_KEY` - Datadog API key (optional)

#### Health Checks

Monitor application health:

```bash
curl http://localhost:3000/api/monitoring/performance?action=health
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch
4. **Make** your changes with tests
5. **Run** the test suite
6. **Submit** a pull request

### Code Standards

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use conventional commit messages
- Ensure security best practices

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Developer Guide](docs/src/content/docs/developer-guide.md)
- Review [API Documentation](docs/src/content/docs/api-reference.md)
- Run health checks: `npm run perf:health`
- View monitoring: `http://localhost:3000/api/monitoring/performance`
