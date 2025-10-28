# Security Implementation Guide

VibeCode WebGUI implements comprehensive security measures to protect against common web vulnerabilities and ensure safe operation in production environments.

## Overview

This documentation covers the security features implemented in VibeCode WebGUI:

- [CSRF Protection](#csrf-protection)
- [Rate Limiting](#rate-limiting)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [Security Headers](#security-headers)
- [API Security](#api-security)

## Quick Reference

| Security Feature | Implementation | Configuration |
|------------------|----------------|---------------|
| CSRF Protection | Double-submit cookie pattern | `CSRF_SECRET` env var |
| Rate Limiting | Redis/Valkey sliding window | `UPSTASH_REDIS_*` env vars |
| Authentication | NextAuth.js + JWT | Multiple OAuth providers |
| Input Validation | Zod schemas | Comprehensive validation rules |
| Security Headers | Custom middleware | CSP, CORS, XSS protection |

## CSRF Protection

### Implementation

VibeCode uses Cross-Site Request Forgery (CSRF) protection with a double-submit cookie pattern:

```typescript
// Get CSRF token
const response = await fetch('/api/auth/csrf');
const { csrfToken } = await response.json();

// Use token in subsequent requests
await fetch('/api/protected-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  body: JSON.stringify(data)
});
```

### Configuration

Set the CSRF secret in your environment:

```bash
CSRF_SECRET=your-secure-random-string-here
```

**⚠️ Important:** Always use a cryptographically secure random string in production.

### Endpoints Protected

- All POST, PUT, DELETE, PATCH requests when using cookie authentication
- Bypassed for requests with valid Bearer tokens
- Bypassed for safe methods (GET, HEAD, OPTIONS)

## Rate Limiting

### Implementation

Rate limiting uses Redis/Valkey with sliding window algorithm:

```typescript
// Apply rate limiting to an endpoint
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export const POST = withRateLimit(RATE_LIMITS.API, 'my-endpoint')(handler);
```

### Predefined Limits

| Limit Type | Requests | Window | Use Case |
|------------|----------|--------|----------|
| `STRICT` | 5 | 60s | Sensitive operations |
| `AUTH` | 10 | 5min | Authentication attempts |
| `API` | 100 | 60s | General API usage |
| `UPLOAD` | 5 | 5min | File uploads |

### Custom Rate Limits

```typescript
const customLimit = {
  maxRequests: 50,
  windowSeconds: 300,
  skipAuthenticated: true,
  message: 'Custom rate limit exceeded'
};

export const POST = withRateLimit(customLimit, 'custom')(handler);
```

### Configuration

Configure Redis/Valkey connection:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## Authentication & Authorization

### Supported Methods

1. **OAuth2 Providers**
   - GitHub (`GITHUB_ID`, `GITHUB_SECRET`)
   - Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

2. **Credentials**
   - Email/password with bcrypt hashing
   - Secure password requirements (12+ chars, mixed case, numbers, symbols)

3. **Multi-Factor Authentication**
   - TOTP (Time-based One-Time Passwords)
   - SMS verification
   - Email verification

### Session Management

```typescript
// Server-side session access
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Security Levels

API endpoints are classified by security levels:

- **Low**: Public endpoints, NextAuth-managed routes
- **Medium**: General API endpoints
- **High**: Sensitive operations (AI, files, workspaces)
- **Critical**: Admin-only operations

## Input Validation

### Zod Schemas

All API inputs are validated using comprehensive Zod schemas:

```typescript
import { z } from '@/lib/zod-compat';
import { safeStringSchema, workspaceIdSchema } from '@/lib/api/validation/schemas';

const requestSchema = z.object({
  workspaceId: workspaceIdSchema,
  message: safeStringSchema
});

// Validate in API route
const validation = requestSchema.safeParse(await request.json());
if (!validation.success) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}
```

### Security Features

- **Directory Traversal Prevention**: Path validation prevents `../` sequences
- **Command Injection Prevention**: Shell command validation with allowlists
- **XSS Prevention**: Control character filtering in strings
- **File Upload Security**: MIME type validation and size limits
- **SQL Injection Prevention**: Parameterized queries with Prisma

## Security Headers

### Implemented Headers

```typescript
// Security headers applied to all responses
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
```

### Content Security Policy (CSP)

Configure CSP in `src/lib/security/csp-config.ts`:

```typescript
const cspConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'wss:', 'https:']
};
```

## API Security

### Request Size Limits

- Maximum request size: 10MB
- Maximum header size: 8KB
- File upload limit: 25MB per PDF, 10MB per file, 50MB total

### IP Security

- Private IP validation
- Suspicious User-Agent detection
- IP blocking capability
- Geographic restrictions (configurable)

### Bot Protection

```typescript
const suspiciousPatterns = [
  /bot/i, /crawler/i, /spider/i, /scraper/i,
  /python-requests/i, /curl/i, /wget/i
];

const allowedBots = [
  /googlebot/i, /bingbot/i, /slackbot/i
];
```

## Monitoring & Logging

### Security Events

All security events are logged with structured data:

```typescript
import { AISecurityLogger } from '@/lib/security/logger';

AISecurityLogger.logSuspiciousActivity(userId, 'rate_limit_exceeded', {
  endpoint: pathname,
  ip: clientIP,
  timestamp: new Date().toISOString()
});
```

### Datadog Integration

Security logs are automatically forwarded to Datadog:

```json
{
  "ddsource": "next-js",
  "service": "vibecode-webgui",
  "eventType": "security_incident",
  "severity": "warning",
  "details": { ... }
}
```

## Best Practices

### For Developers

1. **Always validate input** with Zod schemas
2. **Use rate limiting** for all endpoints
3. **Implement CSRF protection** for state-changing operations
4. **Log security events** for monitoring
5. **Test security features** in development

### For Deployment

1. **Set all environment variables** properly
2. **Use HTTPS** in production
3. **Configure Redis/Valkey** for rate limiting
4. **Monitor security logs** regularly
5. **Keep dependencies updated**

### Environment Variables

```bash
# Required for production
NEXTAUTH_SECRET=your-nextauth-secret
CSRF_SECRET=your-csrf-secret
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# OAuth providers
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=your-database-url

# Optional
COOKIE_DOMAIN=your-domain.com
```

## Troubleshooting

### Common Issues

1. **CSRF token validation failed**
   - Ensure CSRF_SECRET is set
   - Check token is included in request headers
   - Verify cookie and header tokens match

2. **Rate limit exceeded**
   - Check Redis/Valkey connection
   - Verify rate limit configuration
   - Clear rate limits if needed: `clearRateLimit(prefix, identifier, window)`

3. **Authentication failures**
   - Verify OAuth app configuration
   - Check NEXTAUTH_SECRET is set
   - Ensure database connection is working

### Debug Mode

Enable debug logging in development:

```bash
NODE_ENV=development
NEXTAUTH_DEBUG=true
```

## Security Checklist

- [ ] CSRF_SECRET configured
- [ ] Redis/Valkey for rate limiting
- [ ] OAuth providers configured
- [ ] Strong password requirements
- [ ] Security headers enabled
- [ ] Input validation schemas
- [ ] Security logging enabled
- [ ] HTTPS in production
- [ ] Environment variables secured
- [ ] Regular security updates

For more information, see:
- [CSRF Protection Guide](./csrf-protection.md)
- [Rate Limiting Guide](./rate-limiting.md)
- [API Security Reference](./api-security.md)
- [Deployment Security](./deployment-security.md)