# Developer Guide

Welcome to the vibecode-webgui Developer Guide! This comprehensive guide helps you understand the architecture, design patterns, and best practices.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)  
- [Project Structure](#project-structure)
- [Key Technologies](#key-technologies)
- [Design Patterns](#design-patterns)
- [Security Best Practices](#security-best-practices)
- [Performance Optimization](#performance-optimization)
- [Testing Requirements](#testing-requirements)
- [Code Quality Standards](#code-quality-standards)

## Project Overview

vibecode-webgui is an AI-powered development platform built with Next.js 15, React 19, and TypeScript providing:

- **75+ API Endpoints**: RESTful APIs with OpenAPI documentation
- **CSRF Protection**: Token-based protection for state-changing operations
- **Rate Limiting**: Distributed rate limiting with Redis/Upstash
- **Distributed Tracing**: Full request tracing with Datadog APM
- **Intelligent Caching**: Multi-layer caching strategy
- **Database Optimization**: Indexed queries and connection pooling

## Architecture

### Request Flow

```
Client → Edge Middleware → App Router → Business Logic → Data Access → Database
         (Security)        (Routing)    (Controllers)   (Prisma)      (PostgreSQL)
```

### Key Architectural Decisions

1. **App Router**: Next.js 15's App Router for better performance
2. **Edge Middleware**: Security checks at the edge
3. **Prisma + Raw SQL**: Type safety with optimization flexibility
4. **Distributed Tracing**: Datadog APM for observability

## Project Structure

```
src/
├── app/api/          # API route handlers
├── components/       # React components
├── lib/             # Shared utilities
├── hooks/           # Custom React hooks
├── middleware/      # Edge middleware
└── types/           # TypeScript types
```

## Key Technologies

- **Next.js 15.5.3**: React framework
- **React 19.1.1**: UI library
- **TypeScript 5.9.3**: Type safety
- **Prisma 6.12.0**: Database ORM
- **PostgreSQL 16+**: Primary database
- **Redis 5.8.3**: Caching layer
- **Datadog**: APM & monitoring

## Design Patterns

### 1. Repository Pattern

```typescript
export class UserRepository {
  async findById(id: number) {
    return await prisma.user.findUnique({ where: { id } });
  }
}
```

### 2. Service Layer

```typescript
export class AIService {
  async generateCompletion(prompt: string) {
    const cached = await this.cache.get(prompt);
    if (cached) return cached;
    
    const result = await this.callAI(prompt);
    await this.cache.set(prompt, result);
    return result;
  }
}
```

### 3. Middleware Chain

```typescript
export const middleware = composeMiddleware(
  rateLimitMiddleware,
  csrfMiddleware,
  authMiddleware
);
```

## Security Best Practices

### 1. Input Validation

```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

const validation = schema.safeParse(body);
if (!validation.success) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}
```

### 2. CSRF Protection

```typescript
const csrfValid = await validateCSRFToken(request);
if (!csrfValid) {
  return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
}
```

### 3. Rate Limiting

```typescript
const { success } = await ratelimit.limit(ip);
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

### 4. SQL Injection Prevention

```typescript
// Use Prisma parameterized queries
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### 5. Authentication & Authorization

```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Performance Optimization

### 1. Caching

```typescript
const cached = await cache.get(cacheKey);
if (cached) return NextResponse.json(cached);

const data = await fetchExpensiveData();
await cache.set(cacheKey, data, 3600);
```

### 2. Database Indexes

```prisma
model User {
  @@index([email])
  @@index([created_at])
  @@index([email, created_at])
}
```

### 3. Pagination

```typescript
const skip = (page - 1) * limit;
const items = await prisma.item.findMany({ skip, take: limit });
```

## Testing Requirements

### Unit Tests

```typescript
describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2025-10-23');
    expect(formatDate(date)).toBe('Oct 23, 2025');
  });
});
```

### Integration Tests

```typescript
describe('/api/users', () => {
  it('returns list of users', async () => {
    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
  });
});
```

### Coverage Requirements

- Minimum: 70% overall
- Critical paths: 90%
- New features: 80%

## Code Quality Standards

### TypeScript Guidelines

```typescript
// Define explicit types
interface User {
  id: number;
  email: string;
  name: string | null;
}

function getUser(id: number): Promise<User> {
  // Implementation
}
```

### ESLint Rules

- No unused variables
- Prefer const over let
- No implicit any
- Consistent return types

### Code Review Checklist

- [ ] All tests pass
- [ ] TypeScript compiles
- [ ] ESLint shows no warnings
- [ ] Code documented
- [ ] Security practices followed
- [ ] Performance considered
- [ ] Accessibility met
- [ ] Error handling implemented

## Next Steps

- Read the [API Development Guide](./development/API_DEVELOPMENT.md)
- Check [Common Workflows](./development/COMMON_WORKFLOWS.md)
- Review [Security Documentation](./security/SECURITY.md)
- Explore [Testing Strategy](./testing/TESTING_STRATEGY.md)

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
