# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform with advanced monitoring, security, and performance optimization.

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
npm run db:deploy
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
vibecode-webgui/
├── __mocks__/    
├── archive/    
├── charts/    
├── code-server/    
├── content/    
├── coverage/    
├── data/    
├── database/    # Database schemas and migrations
├── datadog/    
├── docker/    
├── docs/    # Documentation files
├── examples/    
├── extensions/    # VSCode extensions and tools
├── external/    
├── helm/    
├── infrastructure/    
├── k8s/    # Kubernetes deployment manifests
├── kubernetes/    
├── litellm/    
├── logs/    
├── monitoring/    
├── packages/    
├── playwright-report/    
├── prisma/    
├── public/    # Static assets
├── scripts/    # Build and utility scripts
├── server/    
├── services/    
├── src/    # Source code
├── templates/    
├── test-results/    
├── tests/    # Test files and configurations
├── tofu/    
├── venv/    
├── watermarkpodautoscaler/    
├── web-dashboard/    
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

#### Ai-cli-tools

- `/api/ai-cli-tools/install`

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
- `/api/ai/upload`
- `/api/ai/web-search`

#### Auth

- `/api/auth/[...nextauth]`
- `/api/auth/login-tracking`

#### Chat

- `/api/chat/mongodb`
- `/api/chat/mongodb-simple`
- `/api/chat/stream`

#### Claude

- `/api/claude/analyze`
- `/api/claude/chat`
- `/api/claude/generate`
- `/api/claude/session`

#### Code-server

- `/api/code-server/session`
- `/api/code-server/session/[sessionId]`

#### Experiments

- `/api/experiments`

#### Files

- `/api/files`
- `/api/files/sync`

#### Gradio

- `/api/gradio/run`

#### Health

- `/api/health`
- `/api/health/simple`

#### Mongodb-test

- `/api/mongodb-test`

#### Monitoring

- `/api/monitoring/dashboard`
- `/api/monitoring/metrics`
- `/api/monitoring/otel-config`
- `/api/monitoring/performance`
- `/api/monitoring/rum`
- `/api/monitoring/security`
- `/api/monitoring/traces`

#### Ollama

- `/api/ollama/models`

#### Projects

- `/api/projects/template`

#### Templates

- `/api/templates`

#### Terminal

- `/api/terminal/session`
- `/api/terminal/ws`

#### Workspace

- `/api/workspace/[id]/init-goose`

For detailed API documentation, see [docs/API.md](docs/API.md) (auto-generated).

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
npm run db:deploy
```
Deploy database migrations

```bash
npm run db:status
```
Check migration status

```bash
npm run db:validate
```
Validate database configuration

```bash
npm run db:setup
```



### Monitoring

```bash
npm run monitoring:health
```
Check system health

```bash
npm run monitoring:metrics
```
View performance metrics

```bash
npm run perf:monitor
```



### Security

```bash
npm run security:test
```
Run security vulnerability scan

```bash
npm run security:audit
```


```bash
npm run security:scan
```



### Ai

```bash
npm run ai:status
```
Check AI gateway status

```bash
npm run ai:models
```
List available AI models

```bash
npm run ai:usage
```


```bash
npm run ai:costs
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

- **next** (15.4.4) - React framework for production
- **react** (19.1.1) - JavaScript library for user interfaces
- **redis** (5.6.1) - In-memory data structure store
- **next-auth** (^4.24.11) - Authentication library for Next.js
- **openai** (^4.104.0) - OpenAI API client
- **dd-trace** (5.61.1) - Datadog tracing library

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
docker-compose exec app npm run db:deploy
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
- Check the [Developer Guide](docs/DEVELOPER_GUIDE.md)
- Review [API Documentation](docs/API.md)
- Run health checks: `npm run perf:health`
- View monitoring: `http://localhost:3000/api/monitoring/performance`
