#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Documentation Enhancement Script
 * Creates enhanced API documentation and improves existing docs structure
 */

const fs = require('fs').promises;
const path = require('path');

// Initialize log aggregation
const logAggregation = new LogAggregation();


async function enhanceDocs() {
  console.log('🚀 Enhancing documentation structure...');
  
  try {
    // Create enhanced API reference with Astro frontmatter
    await createEnhancedAPIReference();
    
    // Update docs README with better structure
    await updateDocsReadme();
    
    // Create quick start guide
    await createQuickStartGuide();
    
    // Create developer guide
    await createDeveloperGuide();
    
    console.log('✅ Documentation enhancement completed successfully');
  } catch (error) {
    console.error('❌ Documentation enhancement failed:', error);
    process.exit(1);
  }
}

async function createEnhancedAPIReference() {
  const apiRefContent = `---
title: "API Reference"
description: "Complete API documentation for VibeCode Platform"
sidebar:
  order: 100
---

# VibeCode API Reference

*Last updated: ${new Date().toISOString()}*

This comprehensive API reference provides detailed documentation for all VibeCode platform endpoints.

## Overview

The VibeCode API provides programmatic access to:
- 🤖 AI-powered code generation and analysis
- 📁 Project management and templates
- 🤝 Real-time collaboration features
- 📂 File operations and synchronization
- 📊 Monitoring and observability
- 🔒 Authentication and security

## Base URLs

\`\`\`
Production:  https://vibecode.example.com/api
Development: http://localhost:3000/api
\`\`\`

## Authentication

Most endpoints require authentication via one of these methods:

### JWT Bearer Token
\`\`\`http
Authorization: Bearer <your_jwt_token>
\`\`\`

### API Key
\`\`\`http
x-api-key: <your_api_key>
\`\`\`

## Rate Limits

| Endpoint Type | Requests per Minute |
|---------------|-------------------|
| Standard endpoints | 100 |
| AI endpoints | 20 |
| File upload endpoints | 10 |

## API Categories

### 🤖 AI Services
- **[/api/ai/chat](/api/ai/chat)** - AI chat completions
- **[/api/ai/generate-project](/api/ai/generate-project)** - Generate projects from prompts
- **[/api/ai/search](/api/ai/search)** - Vector search for RAG
- **[/api/claude/chat](/api/claude/chat)** - Claude-specific chat endpoint

### 🔒 Authentication
- **[/api/auth/[...nextauth]](/api/auth/[...nextauth])** - NextAuth.js endpoints
- **[/api/auth/mfa/setup](/api/auth/mfa/setup)** - Multi-factor authentication setup
- **[/api/auth/saml/sso](/api/auth/saml/sso)** - SAML SSO integration

### 📂 File Management
- **[/api/files](/api/files)** - File CRUD operations
- **[/api/files/sync](/api/files/sync)** - Real-time file synchronization

### 📊 Monitoring
- **[/api/monitoring/dashboard](/api/monitoring/dashboard)** - Monitoring dashboard data
- **[/api/monitoring/metrics](/api/monitoring/metrics)** - Performance metrics
- **[/api/monitoring/security](/api/monitoring/security)** - Security monitoring

### 🛠️ Development Tools
- **[/api/code-server/session](/api/code-server/session)** - Code server management
- **[/api/terminal/session](/api/terminal/session)** - Terminal sessions
- **[/api/terminal/ws](/api/terminal/ws)** - WebSocket terminal connection

### 💬 Chat & Communication
- **[/api/chat/stream](/api/chat/stream)** - Streaming chat
- **[/api/chat/mongodb](/api/chat/mongodb)** - Persistent chat storage

### 🎯 Project Management
- **[/api/projects/template](/api/projects/template)** - Template-based project generation
- **[/api/templates](/api/templates)** - Template management

### ⚡ Health & Diagnostics
- **[/api/health](/api/health)** - Comprehensive health check
- **[/api/health/simple](/api/health/simple)** - Simple health check

## Common Response Format

All API responses follow this standard format:

\`\`\`json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Operation completed successfully",
  "timestamp": "2025-08-22T10:30:00Z",
  "requestId": "req_abc123"
}
\`\`\`

## Error Handling

Error responses include detailed information:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "workspaceId",
      "issue": "Required field missing"
    }
  },
  "timestamp": "2025-08-22T10:30:00Z",
  "requestId": "req_abc123"
}
\`\`\`

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | \`INVALID_REQUEST\` | Request parameters are invalid |
| 401 | \`UNAUTHORIZED\` | Authentication required or invalid |
| 403 | \`FORBIDDEN\` | Insufficient permissions |
| 404 | \`NOT_FOUND\` | Resource not found |
| 429 | \`RATE_LIMITED\` | Too many requests |
| 500 | \`INTERNAL_ERROR\` | Server error |

## Code Examples

### cURL Example
\`\`\`bash
curl -X POST \\
  "https://api.vibecode.com/ai/chat" \\
  -H "Authorization: Bearer \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Create a React component"}
    ]
  }'
\`\`\`

### JavaScript/TypeScript Example
\`\`\`typescript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Create a React component' }
    ]
  })
});

const data = await response.json();
console.log(data);
\`\`\`

### Python Example
\`\`\`python
import requests

response = requests.post(
    'https://api.vibecode.com/ai/chat',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'messages': [
            {'role': 'user', 'content': 'Create a React component'}
        ]
    }
)

data = response.json()
print(data)
\`\`\`

## SDK Support

### Official SDKs
- **TypeScript/JavaScript**: \`npm install @vibecode/api-client\`
- **Python**: \`pip install vibecode-api\`
- **Go**: \`go get github.com/vibecode/go-client\`

For detailed endpoint documentation, see the [auto-generated API docs](./API.md).

---

*This documentation is automatically generated and kept in sync with the codebase.*
`;

  const docsApiPath = path.join(__dirname, '..', 'docs', 'src', 'content', 'docs', 'api-reference.md');
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(docsApiPath), { recursive: true });
  
  await fs.writeFile(docsApiPath, apiRefContent);
  console.log('✨ Created enhanced API reference');
}

async function updateDocsReadme() {
  const readmeContent = `---
title: "VibeCode Documentation"
description: "Complete documentation for the VibeCode AI-powered development platform"
template: splash
hero:
  title: VibeCode Platform
  tagline: AI-Powered Development Platform with Intelligent Workflows
  image:
    alt: VibeCode Platform Logo
  actions:
    - text: Quick Start Guide
      link: /getting-started/
      icon: rocket
      variant: primary
    - text: API Reference
      link: /api-reference/
      icon: document
    - text: View on GitHub
      link: https://github.com/ryanmaclean/vibecode-webgui
      icon: github
---

## What is VibeCode?

VibeCode is a comprehensive AI-powered development platform that transforms how developers build applications. It combines cutting-edge AI technology with cloud-native architecture to provide an unparalleled development experience.

### 🚀 Key Features

- **🤖 AI-Powered Code Generation** - Generate complete projects with natural language prompts
- **☁️ Cloud-Native Architecture** - Deploy anywhere with Docker and Kubernetes support
- **💻 Integrated Development Environment** - Full VS Code experience in your browser
- **🔧 Real-time Collaboration** - Work together with live editing and chat
- **📊 Advanced Monitoring** - Built-in observability with Datadog integration
- **🔒 Enterprise Security** - SAML SSO, MFA, and comprehensive audit logging

## Quick Navigation

<div class="grid cards">

- **🚀 [Getting Started](/getting-started/)**
  
  Set up your first VibeCode workspace and generate your first AI-powered project in minutes

- **📚 [API Reference](/api-reference/)**
  
  Complete API documentation with examples, authentication, and interactive testing

- **🤖 [AI Features](/ai-integration/)**
  
  Learn how to leverage AI features for code generation, analysis, and intelligent assistance

- **🛠️ [Development Guide](/development/)**
  
  Development guides, best practices, and detailed contribution guidelines

- **🚀 [Deployment](/deployment/)**
  
  Deploy VibeCode to production with Docker, Kubernetes, and cloud providers

- **📊 [Monitoring](/monitoring/)**
  
  Set up observability, metrics, and monitoring for your VibeCode deployment

</div>

## Platform Overview

### AI-Powered Development
- **Multi-Model Orchestration**: OpenAI, Anthropic, Google, Mistral with intelligent routing
- **Project Generation**: Create full applications from natural language descriptions
- **Code Analysis**: Get intelligent suggestions and automated code reviews
- **Smart Templates**: 20+ production-ready project templates

### Cloud-Native Platform
- **Container-First**: Full Docker containerization for development and production
- **Kubernetes Native**: Production-ready with comprehensive scaling and monitoring
- **Multi-Cloud**: Deploy on AWS, GCP, Azure, or any Kubernetes cluster
- **Auto-Scaling**: Dynamic resource allocation based on workload demands

### Enterprise Features
- **Authentication**: SAML SSO, OAuth, and multi-factor authentication
- **Security**: Role-based access control, audit logging, and compliance ready
- **Monitoring**: Real-time metrics, distributed tracing, and performance insights
- **Scalability**: Handle enterprise workloads with horizontal scaling

### Developer Experience
- **Browser-Based IDE**: Full VS Code functionality without local installation
- **Collaboration**: Real-time editing with conflict resolution
- **Version Control**: Integrated Git workflows and branch management
- **Terminal Access**: Full terminal access with AI-enhanced command assistance

## Architecture

VibeCode is built with modern, scalable technologies:

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Node.js, Next.js API Routes, PostgreSQL
- **AI Integration**: OpenAI, Anthropic Claude, Google AI
- **Caching**: Redis/Valkey with intelligent invalidation
- **Monitoring**: OpenTelemetry, Datadog, custom metrics
- **Deployment**: Docker, Kubernetes, Helm charts

## Community and Support

- 🌟 **[GitHub Repository](https://github.com/ryanmaclean/vibecode-webgui)** - Source code and contributions
- 📖 **[Documentation](/)** - Comprehensive guides and references
- 🐛 **[Issue Tracker](https://github.com/ryanmaclean/vibecode-webgui/issues)** - Bug reports and feature requests
- 💬 **[Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)** - Community discussion and Q&A

## Getting Help

Need assistance? Here are the best ways to get help:

1. **Check the Documentation** - Most questions are answered in our comprehensive docs
2. **Search Issues** - See if your question has been asked before
3. **Create an Issue** - Report bugs or request new features
4. **Join Discussions** - Ask questions and share ideas with the community

---

*Built with ❤️ using Astro + Starlight. Last updated: ${new Date().toLocaleDateString()}*
`;

  const docsIndexPath = path.join(__dirname, '..', 'docs', 'src', 'content', 'docs', 'index.md');
  await fs.writeFile(docsIndexPath, readmeContent);
  console.log('✨ Updated documentation index');
}

async function createQuickStartGuide() {
  const quickStartContent = `---
title: "Quick Start Guide"
description: "Get up and running with VibeCode in minutes"
sidebar:
  order: 1
---

# Quick Start Guide

Get up and running with VibeCode in minutes! This guide will help you set up your first workspace and generate your first AI-powered project.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** ≥18.18.0 (recommend using Node 25.x for best performance)
- **PostgreSQL** 16+ with pgvector extension
- **Redis** 6+ (or Upstash account for managed Redis)
- **Docker** and **Docker Compose** (optional, for containerized setup)

## Installation

### Option 1: Local Development Setup

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install --legacy-peer-deps
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   \`\`\`

   Edit \`.env\` with your configuration:
   \`\`\`bash
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/vibecode"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # Authentication
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # AI Services
   OPENAI_API_KEY="your-openai-key"
   ANTHROPIC_API_KEY="your-anthropic-key"
   \`\`\`

4. **Initialize the database**
   \`\`\`bash
   npm run db:migrate
   npm run db:generate
   \`\`\`

5. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

   Visit [http://localhost:3000](http://localhost:3000) to see your VibeCode instance!

### Option 2: Docker Setup

1. **Clone and navigate to the repository**
   \`\`\`bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   \`\`\`

2. **Start with Docker Compose**
   \`\`\`bash
   docker-compose -f docker-compose.dev.yml up -d
   \`\`\`

3. **Initialize the database**
   \`\`\`bash
   docker-compose exec app npm run db:migrate
   \`\`\`

## Your First AI Project

### 1. Access the Platform

Navigate to [http://localhost:3000](http://localhost:3000) and sign in with your preferred authentication method.

### 2. Create a New Project

1. Click **"Generate New Project"** on the dashboard
2. Describe your project in natural language:
   
   *Example prompts:*
   - "Create a React todo app with TypeScript and Tailwind CSS"
   - "Build a Next.js blog with Markdown support and dark mode"
   - "Generate a Python FastAPI backend with PostgreSQL"

3. Choose a template or let AI select the best one
4. Click **"Generate Project"**

### 3. Explore Your Generated Project

- **Code Editor**: Full VS Code experience in your browser
- **Terminal**: Integrated terminal for running commands
- **File Explorer**: Navigate and edit your project files
- **AI Assistant**: Get help and suggestions as you code

### 4. Deploy Your Project

Once you're happy with your project, deploy it with one click:

1. Go to the **Deploy** tab
2. Choose your deployment target (Vercel, Netlify, Railway, etc.)
3. Click **"Deploy Now"**

## Essential Features

### AI Code Generation
- **Natural Language**: Describe what you want to build
- **Context Aware**: AI understands your project structure
- **Multiple Models**: Choose between OpenAI, Claude, and others

### Real-time Collaboration
- **Live Editing**: See changes from team members in real-time
- **Conflict Resolution**: Automatic handling of simultaneous edits
- **Chat Integration**: Discuss changes without leaving the editor

### Integrated Development Environment
- **VS Code Experience**: Full-featured editor with extensions
- **Terminal Access**: Run any command or script
- **Git Integration**: Built-in version control

### Cloud Deployment
- **One-Click Deploy**: Deploy to major platforms instantly
- **Environment Management**: Separate dev, staging, and production
- **Monitoring**: Built-in observability and metrics

## Common Use Cases

### 1. Rapid Prototyping
Generate a working prototype in minutes:
- Describe your idea to the AI
- Get a functional application
- Iterate and refine quickly

### 2. Learning New Technologies
Explore frameworks and tools:
- Ask AI to create examples
- Learn from generated code
- Experiment safely

### 3. Team Collaboration
Work together effectively:
- Share workspaces with team members
- Real-time editing and discussion
- Version control and deployment

### 4. Enterprise Development
Build production applications:
- Use enterprise templates
- Implement security best practices
- Deploy with confidence

## Next Steps

Now that you have VibeCode running:

1. **[Explore AI Features](/ai-integration/)** - Learn about advanced AI capabilities
2. **[Read the Developer Guide](/development/)** - Understand the architecture and contribute
3. **[Check the API Reference](/api-reference/)** - Integrate with external services
4. **[Set up Monitoring](/monitoring/)** - Add observability to your deployment

## Troubleshooting

### Common Issues

**Database connection errors**
- Ensure PostgreSQL is running and accessible
- Verify DATABASE_URL is correct
- Check that the database exists

**Redis connection issues**
- Confirm Redis is running
- Verify REDIS_URL configuration
- Check firewall settings

**AI features not working**
- Verify API keys are set correctly
- Check API key permissions and quotas
- Review logs for specific error messages

### Getting Help

- **Documentation**: Search these docs for answers
- **GitHub Issues**: Report bugs and request features
- **Community**: Join discussions and get help from other users

---

**🎉 Congratulations!** You now have VibeCode up and running. Start building amazing projects with AI assistance!
`;

  const quickStartPath = path.join(__dirname, '..', 'docs', 'src', 'content', 'docs', 'getting-started.md');
  await fs.writeFile(quickStartPath, quickStartContent);
  console.log('✨ Created Quick Start Guide');
}

async function createDeveloperGuide() {
  const devGuideContent = `---
title: "Developer Guide"
description: "Comprehensive guide for VibeCode developers and contributors"
sidebar:
  order: 50
---

# Developer Guide

This comprehensive guide covers everything you need to know to develop, extend, and contribute to VibeCode.

## Architecture Overview

VibeCode is built as a modern, cloud-native application with the following architecture:

### Frontend Stack
- **Next.js 15** - React framework with App Router
- **React 19** - Modern React with concurrent features
- **TypeScript** - Full type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/UI** - Beautiful, accessible UI components

### Backend Stack
- **Next.js API Routes** - Serverless API endpoints
- **PostgreSQL 16+** - Primary database with pgvector for AI embeddings
- **Redis/Valkey** - Caching and session storage
- **Prisma** - Type-safe database ORM

### AI Integration
- **OpenAI** - GPT-4, GPT-3.5, and embedding models
- **Anthropic Claude** - Advanced reasoning and code generation
- **Google AI** - Gemini models for diverse tasks
- **LiteLLM** - Unified interface for multiple AI providers

### Monitoring & Observability
- **OpenTelemetry** - Distributed tracing
- **Datadog** - Metrics, logs, and APM
- **Custom metrics** - Application-specific monitoring

### Deployment
- **Docker** - Containerization for all components
- **Kubernetes** - Orchestration and scaling
- **Helm** - Package management and deployment

## Development Setup

### Prerequisites

- Node.js ≥18.18.0 (recommend 25.x)
- PostgreSQL 16+ with pgvector
- Redis 6+
- Docker and Docker Compose
- Git

### Environment Setup

1. **Clone and install**
   \`\`\`bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   npm install --legacy-peer-deps
   \`\`\`

2. **Environment configuration**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

   Configure your \`.env.local\`:
   \`\`\`env
   # Database
   DATABASE_URL="postgresql://vibecode:password@localhost:5432/vibecode_dev"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # Authentication
   NEXTAUTH_SECRET="development-secret-min-32-characters"
   NEXTAUTH_URL="http://localhost:3000"
   
   # AI Providers
   OPENAI_API_KEY="your-openai-key"
   ANTHROPIC_API_KEY="your-anthropic-key"
   GOOGLE_AI_API_KEY="your-google-key"
   
   # Monitoring (optional for development)
   DD_API_KEY="your-datadog-key"
   OTEL_ENABLED="false"
   \`\`\`

3. **Database setup**
   \`\`\`bash
   # Start PostgreSQL and Redis
   docker-compose -f docker-compose.dev.yml up -d postgres redis
   
   # Run database migrations
   npm run db:migrate
   npm run db:generate
   \`\`\`

4. **Development server**
   \`\`\`bash
   npm run dev
   \`\`\`

## Project Structure

\`\`\`
vibecode-webgui/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── (dashboard)/    # Dashboard pages
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── ui/            # Base UI components
│   │   ├── ai/            # AI-related components
│   │   ├── chat/          # Chat interface
│   │   └── ...            # Feature-specific components
│   ├── lib/               # Utility libraries
│   │   ├── ai/            # AI service integrations
│   │   ├── cache/         # Caching strategies
│   │   ├── monitoring/    # Observability
│   │   └── utils.ts       # Common utilities
│   ├── hooks/             # Custom React hooks
│   └── types/             # TypeScript definitions
├── prisma/                # Database schema and migrations
├── docs/                  # Documentation (Astro + Starlight)
├── k8s/                   # Kubernetes manifests
├── charts/                # Helm charts
├── scripts/               # Build and utility scripts
└── tests/                 # Test suites
    ├── unit/              # Unit tests
    ├── integration/       # Integration tests
    └── e2e/               # End-to-end tests
\`\`\`

## Development Workflow

### 1. Creating Features

When adding new features:

1. **Create a feature branch**
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`

2. **Follow the component structure**
   - Place components in appropriate directories
   - Use TypeScript for all new code
   - Follow existing naming conventions

3. **Add tests**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for user workflows

4. **Update documentation**
   - Add JSDoc comments to functions
   - Update API documentation if needed
   - Add usage examples

### 2. Code Style and Quality

We maintain high code quality through:

- **ESLint** - Code linting and style enforcement
- **Prettier** - Consistent code formatting
- **TypeScript** - Type safety and better IDE support
- **Husky** - Pre-commit hooks for quality gates

\`\`\`bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type checking
npm run type-check

# Format code
npm run format
\`\`\`

### 3. Testing Strategy

#### Unit Tests
\`\`\`bash
# Run unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
\`\`\`

#### Integration Tests
\`\`\`bash
# Run integration tests
npm run test:integration

# With real services
ENABLE_REAL_TESTS=true npm run test:integration
\`\`\`

#### E2E Tests
\`\`\`bash
# Run E2E tests
npm run test:e2e

# In headed mode (with browser UI)
npm run test:e2e:headed
\`\`\`

## API Development

### Creating API Endpoints

API endpoints are created in \`src/app/api/\`:

\`\`\`typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = requestSchema.parse(body);
    
    // Your business logic here
    const result = await createUser({ name, email });
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
}
\`\`\`

### API Documentation

API documentation is automatically generated from your code. Use JSDoc comments:

\`\`\`typescript
/**
 * Creates a new user account
 * @param request - HTTP request with user data
 * @returns User creation response
 */
export async function POST(request: NextRequest) {
  // Implementation
}
\`\`\`

## AI Integration

### Adding New AI Providers

1. **Create provider client**
   \`\`\`typescript
   // src/lib/ai/providers/your-provider.ts
   export class YourProviderClient {
     async generateText(prompt: string): Promise<string> {
       // Implementation
     }
   }
   \`\`\`

2. **Register in AI orchestrator**
   \`\`\`typescript
   // src/lib/ai/orchestrator.ts
   import { YourProviderClient } from './providers/your-provider';
   
   // Add to provider registry
   \`\`\`

3. **Add configuration**
   \`\`\`env
   YOUR_PROVIDER_API_KEY="your-key-here"
   \`\`\`

### AI Prompt Engineering

Store prompts in \`src/lib/ai/prompts/\`:

\`\`\`typescript
export const PROJECT_GENERATION_PROMPT = \`
You are an expert software architect. Generate a project structure based on:

Requirements: {requirements}
Technology Stack: {stack}
Complexity Level: {complexity}

Provide a complete file structure with:
1. Core application files
2. Configuration files
3. Documentation
4. Tests
\`;
\`\`\`

## Database Development

### Schema Changes

1. **Update Prisma schema**
   \`\`\`prisma
   // prisma/schema.prisma
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
   }
   \`\`\`

2. **Generate migration**
   \`\`\`bash
   npx prisma migrate dev --name add-user-table
   \`\`\`

3. **Update TypeScript types**
   \`\`\`bash
   npx prisma generate
   \`\`\`

### Vector Database Operations

For AI embeddings and semantic search:

\`\`\`typescript
import { vectorDatabase } from '@/lib/vector-database';

// Store embeddings
await vectorDatabase.store({
  id: 'doc-1',
  content: 'Document content',
  embedding: embeddings,
  metadata: { type: 'documentation' }
});

// Search similar content
const results = await vectorDatabase.search(queryEmbedding, {
  limit: 5,
  threshold: 0.8
});
\`\`\`

## Monitoring and Observability

### Adding Metrics

\`\`\`typescript
import { metrics } from '@/lib/monitoring';

// Counter
metrics.increment('api.requests', 1, {
  endpoint: '/api/example',
  method: 'POST'
});

// Gauge
metrics.gauge('active.connections', connectionCount);

// Histogram
metrics.histogram('request.duration', duration, {
  endpoint: '/api/example'
});
\`\`\`

### Adding Traces

\`\`\`typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('vibecode-api');

export async function processRequest() {
  return tracer.startActiveSpan('process-request', async (span) => {
    try {
      // Your code here
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
\`\`\`

## Deployment

### Local Development Deployment

\`\`\`bash
# Full stack with Docker
docker-compose -f docker-compose.dev.yml up

# Production-like environment
docker-compose -f docker-compose.prod.yml up
\`\`\`

### Kubernetes Deployment

\`\`\`bash
# Apply manifests
kubectl apply -f k8s/

# Using Helm
helm install vibecode ./charts/vibecode-platform
\`\`\`

### Environment-Specific Configuration

- **Development**: \`docker-compose.dev.yml\`
- **Staging**: \`k8s/staging/\`
- **Production**: \`k8s/production/\`

## Contributing

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests**
5. **Update documentation**
6. **Submit pull request**

### Code Review Guidelines

- **Functionality**: Does the code work as intended?
- **Tests**: Are there adequate tests?
- **Performance**: Any performance implications?
- **Security**: Are there security considerations?
- **Documentation**: Is documentation updated?

### Commit Message Format

\`\`\`
type(scope): description

feat(api): add user authentication endpoint
fix(ui): resolve button styling issue
docs(readme): update installation instructions
test(auth): add unit tests for login flow
\`\`\`

## Performance Optimization

### Frontend Performance
- **Code Splitting**: Use dynamic imports
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: \`npm run build:analyze\`

### Backend Performance
- **Database Queries**: Use Prisma query optimization
- **Caching**: Implement Redis caching
- **Connection Pooling**: Configure connection limits

### AI Performance
- **Model Selection**: Choose appropriate models
- **Prompt Optimization**: Minimize token usage
- **Response Caching**: Cache common responses

## Troubleshooting

### Common Development Issues

**TypeScript errors**
- Run \`npm run type-check\` to see all errors
- Ensure all dependencies are properly typed
- Check tsconfig.json configuration

**Database connection issues**
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check database permissions

**AI integration problems**
- Verify API keys are valid
- Check rate limits and quotas
- Review error logs for specific issues

### Debug Mode

Enable debug logging:

\`\`\`env
DEBUG=vibecode:*
LOG_LEVEL=debug
\`\`\`

## Resources

- **[Next.js Documentation](https://nextjs.org/docs)**
- **[Prisma Guides](https://www.prisma.io/docs)**
- **[OpenTelemetry JavaScript](https://opentelemetry.io/docs/instrumentation/js/)**
- **[Kubernetes Documentation](https://kubernetes.io/docs/)**

---

This guide covers the essentials of VibeCode development. For specific questions, check the codebase or create an issue on GitHub.
`;

  const devGuidePath = path.join(__dirname, '..', 'docs', 'src', 'content', 'docs', 'developer-guide.md');
  await fs.writeFile(devGuidePath, devGuideContent);
  console.log('✨ Created Developer Guide');
}

// Run the enhancement
if (require.main === module) {
  enhanceDocs().catch(console.error);
}

module.exports = { enhanceDocs };