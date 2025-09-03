# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform featuring intelligent project generation, multi-model orchestration, cloud deployment automation, and GitHub integration. Transform ideas into production-ready applications with 20+ templates, automated deployments, and enterprise-grade security.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
<<<<<<< Updated upstream
- [AI Integration](#ai-integration)
=======
>>>>>>> Stashed changes
- [API Documentation](#api-documentation)
- [Available Scripts](#available-scripts)
- [Dependencies](#dependencies)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

### 🎯 AI-Powered Development
**Template System** - 20+ production-ready templates for AI/ML, enterprise SaaS, collaboration tools, and infrastructure projects
**Multi-Model Orchestration** - Intelligent routing across OpenAI, Anthropic, Google, Mistral with automatic task detection and fallback
**Intelligent Project Generation** - Advanced template system with customizable configurations and real-time preview
**Template Versioning** - Semantic versioning with migration utilities and compatibility validation

### 🚀 Cloud-Native Platform
**Cloud Deployment Automation** - One-click deployment to Vercel, Netlify, AWS, Railway with cost optimization
**GitHub Integration** - Direct repository creation with automated CI/CD workflow generation
**Kubernetes Native** - Production-ready with comprehensive monitoring and scaling
**Live VS Code Experience** - Complete cloud IDE with real-time collaboration

### 🔒 Enterprise Security & Compliance
**WCAG 2.1 AA Compliance** - Automated accessibility testing with comprehensive reporting
**Security Middleware** - Input validation, rate limiting, threat detection, and audit logging
**Performance Monitoring** - Real-time metrics with Datadog integration and custom dashboards
**Advanced Testing** - Complete test suite with unit, integration, E2E, and accessibility tests

### 🛠️ Technical Foundation
**Next.js 15** - Latest React framework with App Router and modern features
**TypeScript** - Full type safety with strict configuration and comprehensive definitions
**PostgreSQL & Redis** - Advanced database with pgvector for AI embeddings and intelligent caching
**Docker Support** - Full containerization with development and production environments

## Quick Start

### Prerequisites

- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
<<<<<<< Updated upstream
  - **Important note for Azure PostgreSQL:** There's a specific limitation when deploying on Azure PostgreSQL Flexible Server. See [docs/azure-postgresql-deployment.md](docs/azure-postgresql-deployment.md) for details on the pgvector setup workaround.
  - **Azure OpenAI for embeddings:** For setting up and using Azure OpenAI for embeddings, see our [Azure Embedding Service Setup Guide](docs/azure-embedding-service-setup.md).
- Redis 6+ (or Upstash account)
- Container runtime (choose one):
  - [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - [Orbstack](https://orbstack.dev/) (recommended alternative to Docker Desktop, lighter weight and faster)
=======
- Redis 6+ (or Upstash account)
- Docker & Docker Compose (optional)
>>>>>>> Stashed changes

### Installation

#### Option 1: Using Docker Desktop

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop
3. Proceed with the setup below

#### Option 2: Using Orbstack (Recommended)

1. Download and install [Orbstack](https://orbstack.dev/)
2. Start Orbstack (it will automatically start the Docker daemon)
3. Verify installation by running:
   ```bash
   docker --version
   docker-compose --version
   ```
4. (Optional) For better performance, configure Orbstack settings:
   - Open Orbstack settings
   - Go to Resources and allocate at least 4GB RAM and 2 CPU cores
   - Enable Kubernetes if needed (disabled by default)

#### Project Setup

```bash
# Clone the repository
git clone <repository-url>
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
<<<<<<< Updated upstream

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:deploy
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

### Troubleshooting

#### Orbstack Issues

1. **Docker commands not found after installation**
   - Make sure Orbstack is running in the background
   - Restart your terminal or run `source ~/.zshrc` (or `source ~/.bashrc` if using bash)
   - Verify the installation by running `orb version`

2. **Performance issues**
   - Open Orbstack settings and increase allocated resources (CPU/RAM)
   - Go to Settings > Resources and allocate at least 4GB RAM and 2 CPU cores
   - Disable Kubernetes if not needed (Settings > Kubernetes)

3. **Port conflicts**
   - Check for port conflicts with `lsof -i :<port>`
   - Update your `.env` file to use different ports if needed

4. **Volume mounting issues**
   - Make sure the project directory is in an allowed path (check Orbstack settings > File Sharing)
   - Try resetting file sharing permissions in Orbstack settings

5. **Networking issues**
   - Reset Orbstack networking: `orb reset-network`
   - Restart Orbstack if you encounter network-related errors

If you continue to experience issues, check the Orbstack logs at `~/Library/Logs/Orbstack/` or file an issue in our [GitHub repository](https://github.com/your-org/vibecode-webgui/issues).

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
=======

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
>>>>>>> Stashed changes
```
Run integration tests

<<<<<<< Updated upstream
### Key Directories

- **src/app/** - Next.js app router pages and API routes
- **src/components/** - Reusable React components
- **src/lib/** - Utility functions and shared services
- **src/hooks/** - Custom React hooks
- **tests/** - Test files (unit, integration, E2E)
- **docs/** - Documentation and guides

## AI Integration

VibeCode integrates with various AI providers to power its intelligent features. Here's how to set up and use these integrations:

### Supported AI Providers

- **OpenAI** - Default provider for embeddings and completions
- **Azure OpenAI** - Microsoft's managed OpenAI service with additional security features
- **Anthropic** - Alternative provider with Claude models
- **Local Models** - Support for running models locally with Ollama

### Vector Embeddings

Vector embeddings are used throughout the platform for:

- Semantic search across codebase
- RAG (Retrieval Augmented Generation) for more accurate code generation
- Similarity matching for intelligent recommendations

For detailed setup instructions, see:

- [Azure Embedding Service Setup Guide](docs/azure-embedding-service-setup.md) - Configure Azure OpenAI for embeddings
- [PostgreSQL Vector Setup](docs/azure-postgresql-deployment.md) - Set up pgvector with PostgreSQL

### Environment Configuration

Configure your AI providers using environment variables:

```dotenv
# OpenAI
OPENAI_API_KEY=your-openai-key

# Azure OpenAI
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-service-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION=2023-05-15

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-key
```

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
Setup database schemas and tables

```bash
npm run db:check
```
Check database connectivity with robust connection handling

```bash
npm run db:vector-init
```
Initialize vector database for AI embeddings



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

=======
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

>>>>>>> Stashed changes


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
   cp .env.example .env
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
- `DD_API_KEY` - Datadog API key (prefer `DD_*`; legacy `DATADOG_API_KEY` is supported as a fallback)

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
