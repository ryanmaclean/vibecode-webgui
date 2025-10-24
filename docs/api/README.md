# VibeCode WebGUI API Documentation

Welcome to the comprehensive API documentation for VibeCode WebGUI. This documentation covers all 75+ API endpoints, security implementations, and developer guides.

## 📚 Documentation Structure

### API Specifications
- **[OpenAPI Specification](./openapi.yaml)** - Complete API specification with all endpoints, schemas, and examples
- **[Endpoint Mapping](./ROUTE_MAPPING.md)** - Complete list of all API routes with descriptions
- **[Endpoints Overview](./ENDPOINTS.md)** - High-level endpoint categorization

### Security Documentation
- **[Security Implementation Guide](../security/implementation.md)** - Comprehensive security overview
- **[CSRF Protection Guide](../security/csrf-protection.md)** - Detailed CSRF implementation and usage
- **[Rate Limiting Guide](../security/rate-limiting.md)** - Complete rate limiting documentation
- **[API Security Best Practices](../security/api-security.md)** - Developer security guidelines

### Legacy Documentation
- **[API Organization Analysis](./api-organization.md)** - Current API route structure analysis and consolidation recommendations

## 🚀 Quick Start

### 1. Authentication

Most endpoints require authentication. Get started with these steps:

```typescript
// Get CSRF token for cookie-based requests
const csrfResponse = await fetch('/api/auth/csrf');
const { csrfToken } = await csrfResponse.json();

// Use in subsequent requests
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify({
    message: 'Hello, AI!',
    model: 'anthropic/claude-3.5-sonnet'
  })
});
```

### 2. Rate Limiting

All endpoints have rate limits. Check headers for limit information:

```typescript
const response = await fetch('/api/endpoint');

console.log('Rate Limit:', response.headers.get('X-RateLimit-Limit'));
console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
console.log('Reset Time:', response.headers.get('X-RateLimit-Reset'));
```

### 3. Error Handling

Handle errors consistently across all endpoints:

```typescript
async function apiCall(endpoint: string, options: RequestInit) {
  const response = await fetch(endpoint, options);
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (response.status) {
      case 401:
        // Redirect to login
        window.location.href = '/auth/signin';
        break;
      case 403:
        // CSRF token might be expired
        if (error.error === 'CSRF token validation failed') {
          // Refresh CSRF token and retry
        }
        break;
      case 429:
        // Rate limit exceeded
        const retryAfter = response.headers.get('Retry-After');
        console.log(`Rate limited. Retry after ${retryAfter} seconds`);
        break;
      default:
        console.error('API Error:', error.message);
    }
    
    throw new Error(error.message);
  }
  
  return response.json();
}
```

## 📋 API Categories

### Authentication & Security
- `/api/auth/csrf` - CSRF token management
- `/api/auth/mfa/setup` - Multi-factor authentication setup
- `/api/auth/mfa/verify` - MFA verification
- `/api/auth/login-tracking` - Login event tracking

### AI & Chat
- `/api/ai/chat` - AI chat conversations
- `/api/ai/chat/stream` - Streaming AI responses
- `/api/ai/function-call` - AI function calling
- `/api/ai/web-search` - AI-powered web search
- `/api/ai/generate-project` - AI project generation

### Workspace Management
- `/api/workspaces` - Workspace CRUD operations
- `/api/workspaces/{id}` - Individual workspace management
- `/api/workspace/auto-scaling` - Auto-scaling configuration
- `/api/files` - File system operations
- `/api/files/sync` - Real-time file synchronization

### Development Tools
- `/api/code-completion` - Code completion suggestions
- `/api/code-server/session` - Code server session management
- `/api/terminal/session` - Terminal session management
- `/api/containers` - Container management

### Monitoring & Health
- `/api/health` - Comprehensive health checks
- `/api/healthz` - Simple health probe
- `/api/readyz` - Readiness probe
- `/api/monitoring/*` - Various monitoring endpoints

## 🔐 Security Features

### Implemented Security Measures

| Feature | Implementation | Configuration |
|---------|----------------|---------------|
| **CSRF Protection** | Double-submit cookie pattern | `CSRF_SECRET` environment variable |
| **Rate Limiting** | Redis/Valkey sliding window | `UPSTASH_REDIS_*` environment variables |
| **Authentication** | NextAuth.js with JWT | OAuth providers + credentials |
| **Input Validation** | Zod schemas with security rules | Comprehensive validation schemas |
| **Security Headers** | Custom middleware | CSP, CORS, XSS protection |
| **Logging** | Structured security logging | Datadog integration |

### Security Headers

All API responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: origin-when-cross-origin
Cache-Control: no-store, no-cache, must-revalidate
```

### Rate Limits

| Endpoint Type | Limit | Window | Notes |
|---------------|-------|--------|-------|
| Authentication | 10 requests | 5 minutes | Login attempts |
| AI Operations | 100 requests | 1 minute | Higher for authenticated users |
| File Uploads | 5 requests | 5 minutes | Large file protection |
| General API | 100 requests | 1 minute | Most endpoints |

## 📖 API Endpoint Reference

### AI Chat Example

**POST** `/api/ai/chat`

Send a message to AI for code assistance or general chat.

**Request:**
```json
{
  "message": "Explain how to implement rate limiting in Node.js",
  "model": "anthropic/claude-3.5-sonnet",
  "workspaceId": "my-workspace",
  "context": {
    "files": ["src/server.ts"],
    "previousMessages": []
  }
}
```

**Response:**
```json
{
  "response": "Rate limiting in Node.js can be implemented using...",
  "model": "anthropic/claude-3.5-sonnet",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 300,
    "total_tokens": 450
  }
}
```

### Workspace Creation Example

**POST** `/api/workspaces`

Create a new development workspace.

**Request:**
```json
{
  "projectId": "unique-project-id",
  "projectName": "My React App",
  "framework": "react",
  "files": {
    "package.json": "{\"name\": \"my-app\"}",
    "src/App.tsx": "import React from 'react';\n\nexport default function App() {\n  return <h1>Hello World</h1>;\n}"
  },
  "dependencies": ["react", "react-dom"],
  "environment": {
    "NODE_ENV": "development"
  }
}
```

**Response:**
```json
{
  "id": "workspace-123",
  "projectId": "unique-project-id",
  "projectName": "My React App",
  "framework": "react",
  "status": "creating",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## 🛠️ Developer Tools

### TypeScript Types

Generate TypeScript types from the OpenAPI specification:

```bash
npm install -g @openapitools/openapi-generator-cli

openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-fetch \
  -o src/types/api
```

### SDK Generation

Generate SDKs for different languages:

```bash
# JavaScript/TypeScript SDK
openapi-generator-cli generate -i docs/api/openapi.yaml -g typescript-axios -o sdks/typescript

# Python SDK
openapi-generator-cli generate -i docs/api/openapi.yaml -g python -o sdks/python

# Go SDK
openapi-generator-cli generate -i docs/api/openapi.yaml -g go -o sdks/go
```

### Testing

Use the provided test utilities:

```typescript
import { apiCall, getCSRFToken } from '@/lib/test-utils';

describe('API Tests', () => {
  it('should create workspace', async () => {
    const response = await apiCall('/api/workspaces', {
      method: 'POST',
      data: {
        projectName: 'Test Project',
        framework: 'react'
      }
    });
    
    expect(response.status).toBe(201);
    expect(response.data.projectName).toBe('Test Project');
  });
});
```

## 🔧 Configuration

### Environment Variables

**Required for Production:**
```bash
# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
CSRF_SECRET=your-csrf-secret

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis/Valkey (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# OAuth Providers
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

**Optional:**
```bash
# Monitoring
DATADOG_API_KEY=your-datadog-key
DATADOG_APP_KEY=your-datadog-app-key

# Custom Configuration
COOKIE_DOMAIN=yourdomain.com
RATE_LIMIT_ENABLED=true
```

## 📊 Monitoring

### Health Checks

Monitor API health with these endpoints:

```bash
# Comprehensive health check
curl http://localhost:3000/api/health

# Simple health probe (for load balancers)
curl http://localhost:3000/api/healthz

# Readiness probe
curl http://localhost:3000/api/readyz
```

### Metrics

Access API metrics:

```bash
# Get monitoring dashboard
curl http://localhost:3000/api/monitoring/dashboard

# Get specific metrics
curl http://localhost:3000/api/monitoring/metrics?type=response_time

# Get rate limiting status
curl http://localhost:3000/api/monitoring/pool
```

## 🐛 Troubleshooting

### Common Issues

1. **CSRF Token Validation Failed**
   ```typescript
   // Solution: Refresh CSRF token
   const csrfResponse = await fetch('/api/auth/csrf');
   const { csrfToken } = await csrfResponse.json();
   ```

2. **Rate Limit Exceeded (429)**
   ```typescript
   // Solution: Implement exponential backoff
   const retryAfter = response.headers.get('Retry-After');
   await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
   ```

3. **Authentication Required (401)**
   ```typescript
   // Solution: Check session and redirect if needed
   const session = await getSession();
   if (!session) {
     window.location.href = '/auth/signin';
   }
   ```

### Debug Mode

Enable detailed API logging:

```bash
NODE_ENV=development
DEBUG_API=true
DEBUG_CSRF=true
DEBUG_RATE_LIMIT=true
```

## 📚 Additional Resources

### External Documentation
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Zod Validation](https://zod.dev/)

### Related Guides
- [Development Setup](../DEVELOPMENT.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Testing Strategy](../TESTING_STRATEGY.md)
- [Security Guidelines](../SECURITY.md)

## 🤝 Contributing

When adding new API endpoints:

1. **Define Zod validation schema** in `src/lib/api/validation/schemas.ts`
2. **Apply security middleware** (rate limiting, CSRF, auth)
3. **Add OpenAPI documentation** to `docs/api/openapi.yaml`
4. **Write security tests** in `tests/security/`
5. **Update this documentation**

### Example New Endpoint

```typescript
// src/app/api/my-endpoint/route.ts
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { withCSRFProtection } from '@/lib/security/csrf';
import { validateRequestBody } from '@/lib/api/validation/middleware';
import { myEndpointSchema } from '@/lib/api/validation/schemas';

async function handler(req: NextRequest): Promise<NextResponse> {
  const validation = await validateRequestBody(req, myEndpointSchema);
  if (!validation.success) {
    return validation.error;
  }
  
  // Your API logic here
  return NextResponse.json({ success: true });
}

// Apply security middleware
export const POST = withRateLimit(RATE_LIMITS.API, 'my-endpoint')(
  withCSRFProtection(handler)
);
```

## API Architecture Principles

### REST Conventions
```
/api/{resource-plural}/           # Collection operations (list, create)
/api/{resource-plural}/[id]       # Individual operations (get, update, delete)
/api/{resource-plural}/[id]/{sub} # Sub-resource operations
```

### Service Endpoints
```
/api/{service-name}/{operation}   # Service-oriented operations
```

### Health & Status
```
/api/health                       # Standard health check
/api/healthz                      # Kubernetes liveness probe
/api/readyz                       # Kubernetes readiness probe
```

---

For questions or support, please refer to our [Troubleshooting Guide](../TROUBLESHOOTING.md) or open an issue on GitHub.

**Last Updated**: 2025-01-24  
**Maintained By**: Documentation Team
