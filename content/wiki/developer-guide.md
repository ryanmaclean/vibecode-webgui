---
title: Developer Guide
slug: developer-guide
---

# VibeCode Developer Guide

VibeCode is a comprehensive AI-powered development platform with advanced monitoring, security, and performance optimization. This guide will help you get started developing, deploying, and extending the platform.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Core Components](#core-components)
- [API Documentation](#api-documentation)
- [Security Implementation](#security-implementation)
- [Performance Optimization](#performance-optimization)
- [AI Integration](#ai-integration)
- [Monitoring & Observability](#monitoring--observability)
- [Testing Strategy](#testing-strategy)
- [Deployment Guide](#deployment-guide)
- [Contributing](#contributing)

## 🏗️ Architecture Overview

### System Architecture

```mermaid
graph TB
    Client[Web Browser] --> NextJS[Next.js App]
    NextJS --> API[API Routes]
    NextJS --> UI[UI Components]
    
    API --> Security[Security Middleware]
    API --> Cache[Redis Cache]
    API --> DB[(PostgreSQL + pgvector)]
    API --> AI[LiteLLM Gateway]
    
    Security --> Auth[NextAuth.js]
    Security --> RateLimit[Rate Limiting]
    Security --> Validation[Input Validation]
    
    AI --> OpenAI[OpenAI]
    AI --> Anthropic[Anthropic]
    AI --> Ollama[Local Models]
    
    Monitoring[Datadog] --> API
    Monitoring --> DB
    Monitoring --> AI
```

### Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 15 + React 19 + TypeScript | Modern web application framework |
| **Backend** | Next.js API Routes + Prisma ORM | Server-side API and database operations |
| **Database** | PostgreSQL 16 + pgvector | Relational database with vector search |
| **Caching** | Redis/Upstash | High-performance caching layer |
| **AI Gateway** | LiteLLM Proxy | Unified AI model access and management |
| **Security** | Custom middleware + NextAuth | Authentication and security hardening |
| **Monitoring** | Datadog + Custom metrics | Comprehensive observability |
| **Testing** | Jest + Playwright + TestContainers | Unit, integration, and E2E testing |

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.18+ (20+ recommended)
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker & Docker Compose (for local services)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/vibecode-webgui.git
   cd vibecode-webgui
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start local services**
   ```bash
   # Start PostgreSQL + Redis + LiteLLM
   docker-compose -f docker-compose.dev.yml up -d
   
   # Or for full LiteLLM stack
   docker-compose -f docker-compose.litellm.yml up -d
   ```

5. **Initialize the database**
   ```bash
   npm run db:deploy
   npm run db:generate
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

### Essential Commands

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run type-check            # TypeScript type checking
npm run lint                  # ESLint code linting

# Database
npm run db:status             # Check migration status
npm run db:deploy             # Deploy migrations
npm run db:validate           # Validate database config
npm run db:setup              # Run production setup

# Testing
npm run test                  # Run unit tests
npm run test:e2e              # Run E2E tests
npm run test:integration      # Run integration tests
npm run test:security         # Run security tests

# Security
npm run security:test         # Comprehensive security scan
npm run security:monitor      # Start security monitoring
npm run security:headers      # Test security headers

# Performance
npm run perf:monitor          # Performance overview
npm run perf:health           # Quick health check
npm run perf:database         # Database performance

# AI Management
npm run ai:status             # AI gateway health
npm run ai:models             # Available models
npm run ai:usage              # Usage statistics
npm run ai:costs              # Cost analysis
```

## 🧩 Core Components

### 1. Authentication & Authorization

**Location**: `src/lib/auth.ts`, `src/middleware.ts`

```typescript
import { getToken } from 'next-auth/jwt';

// Middleware authentication check
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.redirect('/auth/signin');
  }
}
```

**Features:**
- NextAuth.js integration
- JWT token validation
- Role-based access control
- Session management

### 2. Security Middleware

**Location**: `src/middleware/security-middleware.ts`

```typescript
import { apiSecurityMiddleware } from './middleware/security-middleware';

// Apply security checks to API routes
const securityResponse = await apiSecurityMiddleware(request);
if (securityResponse) {
  return addSecurityHeaders(securityResponse);
}
```

**Features:**
- Input validation and sanitization
- Rate limiting with Redis
- Bot detection and blocking
- Request size limiting
- CORS validation

### 3. Performance Monitoring

**Location**: `src/lib/performance/metrics-collector.ts`

```typescript
import { performanceCollector } from '../performance/metrics-collector';

// Track API performance
performanceCollector.recordAPIPerformance({
  endpoint: '/api/ai/chat',
  method: 'POST',
  status: 200,
  duration: 1250,
  timestamp: Date.now(),
  userId: 'user123',
  cacheHit: true
});
```

**Features:**
- Real-time metrics collection
- Web Vitals tracking
- API performance monitoring
- Database query optimization
- Cache hit rate analysis

### 4. AI Integration

**Location**: `src/lib/ai/litellm-client.ts`

```typescript
import { litellmClient } from '../ai/litellm-client';

// Chat completion with cost tracking
const response = await litellmClient.chatCompletion({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Help me debug this code' }
  ],
  temperature: 0.7
}, userId, projectId);

console.log(`Cost: $${response.cost}, Tokens: ${response.usage.total_tokens}`);
```

**Features:**
- Unified multi-provider access
- Intelligent model routing
- Cost tracking and optimization
- Response caching
- Streaming support

### 5. Database Operations

**Location**: `src/lib/database/query-optimizer.ts`

```typescript
import { CachedQueries } from '../database/query-optimizer';

// Cached user lookup
const user = await CachedQueries.getUserById(123, {
  workspaces: { take: 10, orderBy: { updated_at: 'desc' } }
});

// Bulk operations
await BulkOperations.batchCreate(model, records, 100);
```

**Features:**
- Query result caching
- Bulk operation optimization
- Connection pool management
- Query performance analysis
- Health monitoring

## 📡 API Documentation

### Core Endpoints

#### Authentication
```http
POST /api/auth/signin
POST /api/auth/signout
GET  /api/auth/session
```

#### AI Management
```http
GET  /api/ai/management?action=overview
GET  /api/ai/management?action=models
GET  /api/ai/management?action=usage
GET  /api/ai/management?action=costs
POST /api/ai/management (admin actions)
```

#### Monitoring
```http
GET  /api/monitoring/performance?action=health
GET  /api/monitoring/performance?action=overview
GET  /api/monitoring/security
GET  /api/monitoring/rum
```

#### Database
```http
GET  /api/database/health
POST /api/database/migrate
GET  /api/database/stats
```

### Response Formats

All API responses follow this structure:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  metadata?: {
    requestId: string;
    duration: number;
    cached: boolean;
  };
}
```

### Error Handling

```typescript
// Standard error response
{
  "success": false,
  "error": "Authentication required",
  "timestamp": "2025-01-09T10:30:00Z",
  "metadata": {
    "requestId": "req-12345",
    "duration": 45
  }
}
```

## 🔒 Security Implementation

### Input Validation

```typescript
import { validateAIQuery } from '../lib/security/input-validator';

// Validate and sanitize user input
const validated = validateAIQuery({
  query: userInput,
  context: additionalContext
});
```

### Rate Limiting

```typescript
import { aiRateLimiter } from '../lib/security/input-validator';

// Check rate limits
if (!aiRateLimiter.checkRateLimit(userId)) {
  throw new Error('Rate limit exceeded');
}
```

### Security Headers

Configured in `next.config.js`:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy

### Bot Protection

```typescript
// Automatic bot detection in middleware
const botDetection = detectBot(request);
if (botDetection.isBot && !botDetection.allowedBot) {
  return new NextResponse('Bot detected', { status: 403 });
}
```

## ⚡ Performance Optimization

### Caching Strategy

```typescript
import { cache, CacheTTL } from '../lib/cache/redis-client';

// Cache user data
await cache.set(`user:${userId}`, userData, CacheTTL.MEDIUM);

// Cache expensive AI responses
const cacheKey = `ai:${hashQuery(query)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

### Database Optimization

```typescript
import { CachedQueries } from '../lib/database/query-optimizer';

// Use optimized queries with includes
const workspace = await CachedQueries.getWorkspaceById(id, {
  projects: { take: 20, orderBy: { updated_at: 'desc' } },
  _count: { select: { projects: true, files: true } }
});
```

### Performance Monitoring

```typescript
// Track function performance
const optimizedFunction = withPerformanceMonitoring(
  expensiveOperation,
  'expensive_operation',
  { module: 'ai-processing' }
);
```

## 🤖 AI Integration

### Model Selection

```typescript
// Automatic model selection based on task
const model = taskType === 'code' ? 'qwen2.5-coder' : 
               quality === 'premium' ? 'gpt-4o' : 
               'gpt-4o-mini';

const response = await litellmClient.chatCompletion({
  model,
  messages,
  temperature: 0.7
}, userId, projectId);
```

### Cost Optimization

```typescript
// Use cached embeddings to reduce costs
const embedding = await litellmClient.createEmbedding({
  input: 'Your text here',
  model: 'text-embedding-3-small' // Most cost-effective
});
```

### Streaming Responses

```typescript
await litellmClient.streamChatCompletion(
  request,
  (chunk) => {
    // Handle streaming chunk
    socket.emit('ai-chunk', chunk);
  },
  userId,
  projectId
);
```

## 📊 Monitoring & Observability

### Datadog Integration

```typescript
import { metrics } from '../lib/server-monitoring';

// Custom metrics
metrics.increment('user.action', {
  action: 'login',
  status: 'success'
});

metrics.histogram('ai.request.duration', duration, {
  model: 'gpt-4o-mini',
  provider: 'openai'
});
```

### Health Checks

```typescript
// Database health
const dbHealth = await DatabaseHealthMonitor.healthCheck();

// AI gateway health
const aiHealth = await litellmClient.healthCheck();

// Cache health
const cacheHealth = await cache.healthCheck();
```

### Error Tracking

```typescript
import { AISecurityLogger } from '../lib/security/input-validator';

// Log security events
AISecurityLogger.logSuspiciousActivity(
  userId,
  'rate_limit_exceeded',
  { endpoint: '/api/ai/chat', attempts: 150 }
);
```

## 🧪 Testing Strategy

### Unit Tests (Jest)

```typescript
// src/lib/__tests__/cache.test.ts
describe('Cache Operations', () => {
  it('should cache and retrieve values', async () => {
    await cache.set('test-key', { data: 'test' }, 60);
    const result = await cache.get('test-key');
    expect(result).toEqual({ data: 'test' });
  });
});
```

### Integration Tests

```typescript
// tests/integration/ai-integration.test.ts
describe('AI Integration', () => {
  it('should process chat completion', async () => {
    const response = await litellmClient.chatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    
    expect(response.choices[0].message.content).toBeTruthy();
    expect(response.usage.total_tokens).toBeGreaterThan(0);
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/auth/authentication.test.ts
test('user can sign in and access dashboard', async ({ page }) => {
  await page.goto('/auth/signin');
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="signin-button"]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Security Tests

```bash
# Run comprehensive security tests
npm run security:test

# Check for vulnerabilities
npm run security:audit

# Test security headers
npm run security:headers
```

## 🚀 Deployment Guide

### Environment Setup

```bash
# Production environment variables
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NEXTAUTH_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DD_API_KEY=your-datadog-key
```

### Docker Deployment

```bash
# Build production image
docker build -t vibecode-webgui .

# Run with dependencies
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec app npm run db:deploy
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=vibecode-webgui

# Scale deployment
kubectl scale deployment vibecode-webgui --replicas=3
```

### Health Monitoring

```bash
# Check application health
curl http://localhost:3000/api/monitoring/performance?action=health

# Check AI gateway health
curl http://localhost:4000/health

# Database health
npm run db:validate
```

## 📈 Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| **Page Load Time** | < 2s | 1.2s |
| **API Response Time** | < 500ms | 280ms |
| **Database Query Time** | < 100ms | 45ms |
| **Cache Hit Rate** | > 85% | 92% |
| **AI Response Time** | < 3s | 2.1s |
| **Uptime** | > 99.9% | 99.95% |

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
npm run db:validate

# Reset database
npm run db:reset
```

#### Cache Issues
```bash
# Check Redis connection
npm run perf:cache

# Clear cache
curl -X POST http://localhost:3000/api/monitoring/performance \
  -H "Content-Type: application/json" \
  -d '{"action":"clear_cache"}'
```

#### AI Gateway Issues
```bash
# Check LiteLLM status
npm run ai:status

# View available models
npm run ai:models
```

#### Performance Issues
```bash
# Check performance metrics
npm run perf:monitor

# Analyze slow queries
npm run perf:database
```

### Debugging

```typescript
// Enable debug logging
process.env.DEBUG = 'vibecode:*';

// Check performance collector
console.log(await performanceCollector.getPerformanceSummary());

// View security events
curl http://localhost:3000/api/monitoring/security
```

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm run test
   npm run test:e2e
   npm run security:test
   ```

3. **Check code quality**
   ```bash
   npm run lint
   npm run type-check
   ```

4. **Submit pull request**
   - Ensure all tests pass
   - Update documentation
   - Add changelog entry

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforce code quality rules
- **Prettier**: Code formatting
- **Conventional Commits**: Standardized commit messages
- **Security First**: All inputs validated and sanitized
- **Performance Focused**: Monitor and optimize all operations

### Architecture Decisions

When adding new features:

1. **Security**: Add input validation and rate limiting
2. **Performance**: Implement caching and monitoring
3. **Cost**: Track AI usage and optimize model selection
4. **Testing**: Add unit, integration, and E2E tests
5. **Documentation**: Update relevant documentation

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [LiteLLM Documentation](https://docs.litellm.ai)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Playwright Testing](https://playwright.dev/docs)

---

**Need Help?** 
- Check the [troubleshooting section](#troubleshooting)
- Review [API documentation](#api-documentation)
- Run health checks: `npm run perf:health`
- View monitoring dashboard: `http://localhost:3000/api/monitoring/performance`
