---
title: Development Scripts
slug: development-scripts
---

# Development Scripts

VibeCode provides a comprehensive set of npm scripts for development, testing, deployment, and monitoring. Here's a complete reference of available commands.

## Development Scripts

### Basic Development
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

## Testing Scripts

### Unit & Integration Testing
```bash
npm run test
```
Run unit tests

```bash
npm run test:watch
```
Run tests in watch mode

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

### Opt-in and Targeted Test Suites

These suites are disabled by default and must be explicitly opted-in with environment variables or dedicated scripts.

```bash
# Vector store optimization tests (fast, unit-focused)
npm run test:vector:optimizations

# Heavy vector migration tests (database-intensive)
TEST_VECTOR_MIGRATIONS=true npm run test:migrations:vector

# API health integration tests (requires running server)
RUN_HEALTH_TESTS=true npm run test:health:api

# Documentation tests
npm run test:docs              # static docs tests
npm run test:docs:preview      # use Astro preview mode
```

### Test Control Environment Variables

- `TEST_VECTOR_MIGRATIONS=true` — enable heavy vector migration tests.
- `RUN_HEALTH_TESTS=true` — enable health API integration tests.
- `JEST_INCLUDE_DOCS=1` — include docs tests in Jest collection.
- `ASTRO_USE_PREVIEW=1` — run docs tests against existing Astro preview (no build during tests).
- `STATEMENT_TIMEOUT='300s'` — optional Postgres statement timeout for migration data copy (used by zero-downtime migration script).

## Database Scripts

### Database Management
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

## Monitoring Scripts

### System Monitoring
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
Monitor performance metrics

## Security Scripts

### Security Testing
```bash
npm run security:test
```
Run security vulnerability scan

```bash
npm run security:audit
```
Run security audit

```bash
npm run security:scan
```
Run comprehensive security scan

## AI Scripts

### AI Service Management
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
Check AI usage statistics

```bash
npm run ai:costs
```
View AI service costs

## Documentation Scripts

### Documentation Management
```bash
npm run docs:validate
```
Validate documentation accuracy

```bash
npm run docs:stats
```
Generate documentation statistics

## Environment Setup

### Prerequisites
Before running any scripts, ensure you have:

1. **Environment Variables**: Copy and configure `.env.example`
2. **Database**: PostgreSQL with pgvector extension
3. **Redis/Valkey**: Self-hosted Redis-compatible service (Valkey recommended)
4. **Dependencies**: Run `npm install --legacy-peer-deps`

### Quick Setup
```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:deploy
npm run db:generate

# Start development
npm run dev
```

## Development Workflow

### Typical Development Process
1. **Start Development**: `npm run dev`
2. **Run Tests**: `npm run test && npm run test:e2e`
3. **Check Code Quality**: `npm run lint && npm run type-check`
4. **Database Changes**: `npm run db:deploy`
5. **Security Check**: `npm run security:test`

### Pre-commit Checks
```bash
# Run all checks before committing
npm run lint && npm run type-check && npm run test && npm run security:test
```

## Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
npm run db:check
npm run db:validate
```

**Performance Issues**
```bash
npm run monitoring:health
npm run perf:monitor
```

**AI Service Issues**
```bash
npm run ai:status
npm run ai:models
```

**Security Concerns**
```bash
npm run security:audit
npm run security:scan
```

## Production Deployment

### Build for Production
```bash
npm run build
npm run start
```

### Health Checks
```bash
curl http://localhost:3000/api/monitoring/performance?action=health
```

## Getting Help

- **Documentation**: Check [API Reference](/wiki/api-reference) for endpoint details
- **Features**: Explore [Features Overview](/wiki/features) for capabilities
- **Getting Started**: Follow [Getting Started Guide](/wiki/getting-started) for setup
- **Project Structure**: Understand the codebase with [Project Structure](/wiki/project-structure)
