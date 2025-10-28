---
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
   ```bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   npm install --legacy-peer-deps
   ```

2. **Environment configuration**
   ```bash
   cp .env.example .env.local
   ```

   Configure your `.env.local`:
   ```bash
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
   ```

3. **Database setup**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose -f docker-compose.dev.yml up -d postgres redis
   
   # Run database migrations
   npm run db:migrate
   npm run db:generate
   ```

4. **Development server**
   ```bash
   npm run dev
   ```

## Project Structure

```
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
```

## Development Workflow

### 1. Creating Features

When adding new features:

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

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

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type checking
npm run type-check

# Format code
npm run format
```

### 3. Testing Strategy

#### Unit Tests
```bash
# Run unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

#### Integration Tests
```bash
# Run integration tests
npm run test:integration

# With real services
ENABLE_REAL_TESTS=true npm run test:integration
```

#### E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# In headed mode (with browser UI)
npm run test:e2e:headed
```

## API Development

### Creating API Endpoints

API endpoints are created in `src/app/api/`:

```typescript
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
```

### API Documentation

API documentation is automatically generated from your code. Use JSDoc comments:

```typescript
/**
 * Creates a new user account
 * @param request - HTTP request with user data
 * @returns User creation response
 */
export async function POST(request: NextRequest) {
  // Implementation
}
```

## AI Integration

### Adding New AI Providers

1. **Create provider client**
   ```typescript
   // src/lib/ai/providers/your-provider.ts
   export class YourProviderClient {
     async generateText(prompt: string): Promise<string> {
       // Implementation
     }
   }
   ```

2. **Register in AI orchestrator**
   ```typescript
   // src/lib/ai/orchestrator.ts
   import { YourProviderClient } from './providers/your-provider';
   
   // Add to provider registry
   ```

3. **Add configuration**
   ```bash
   YOUR_PROVIDER_API_KEY="your-key-here"
   ```

### AI Prompt Engineering

Store prompts in `src/lib/ai/prompts/`:

```typescript
export const PROJECT_GENERATION_PROMPT = `
You are an expert software architect. Generate a project structure based on:

Requirements: {requirements}
Technology Stack: {stack}
Complexity Level: {complexity}

Provide a complete file structure with:
1. Core application files
2. Configuration files
3. Documentation
4. Tests
`;
```

## Database Development

### Schema Changes

1. **Update Prisma schema**
   ```prisma
   // prisma/schema.prisma
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
   }
   ```

2. **Generate migration**
   ```bash
   npx prisma migrate dev --name add-user-table
   ```

3. **Update TypeScript types**
   ```bash
   npx prisma generate
   ```

### Vector Database Operations

For AI embeddings and semantic search:

```typescript
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
```

## Monitoring and Observability

### Adding Metrics

```typescript
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
```

### Adding Traces

```typescript
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
```

## Deployment

### Local Development Deployment

```bash
# Full stack with Docker
docker-compose -f docker-compose.dev.yml up

# Production-like environment
docker-compose -f docker-compose.prod.yml up
```

### Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f k8s/

# Using Helm
helm install vibecode ./charts/vibecode-platform
```

### Environment-Specific Configuration

- **Development**: `docker-compose.dev.yml`
- **Staging**: `k8s/staging/`
- **Production**: `k8s/production/`

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

```
type(scope): description

feat(api): add user authentication endpoint
fix(ui): resolve button styling issue
docs(readme): update installation instructions
test(auth): add unit tests for login flow
```

## Performance Optimization

### Frontend Performance
- **Code Splitting**: Use dynamic imports
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: `npm run build:analyze`

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
- Run `npm run type-check` to see all errors
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

```bash
DEBUG=vibecode:*
LOG_LEVEL=debug
```

## Resources

- **[Next.js Documentation](https://nextjs.org/docs)**
- **[Prisma Guides](https://www.prisma.io/docs)**
- **[OpenTelemetry JavaScript](https://opentelemetry.io/docs/instrumentation/js/)**
- **[Kubernetes Documentation](https://kubernetes.io/docs/)**

---

This guide covers the essentials of VibeCode development. For specific questions, check the codebase or create an issue on GitHub.
