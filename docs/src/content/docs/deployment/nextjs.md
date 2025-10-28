---
title: "Deploying Next.js Application"
description: "Complete guide to deploying the VibeCode Next.js application with database, caching, and AI integration"
sidebar:
  order: 2
---

This guide covers deploying the VibeCode Next.js application - a full-stack web application with PostgreSQL, Redis caching, and AI integration.

## Overview

The VibeCode application is built with:

- **Framework**: Next.js 15.2.4 with React 19
- **Runtime**: Node.js 18.18.0 - 24.x
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache**: Valkey/Redis for sessions and API responses
- **AI Providers**: OpenAI, Anthropic, Google AI
- **Monitoring**: Datadog APM and Infrastructure
- **Authentication**: NextAuth.js

## Prerequisites

### Required Services

1. **PostgreSQL Database** (16+)
   - pgvector extension installed
   - Minimum 2 GB RAM
   - 50 GB storage recommended

2. **Redis/Valkey Cache**
   - Minimum 512 MB RAM
   - Persistence enabled (AOF or RDB)

3. **AI Provider API Key** (at least one)
   - OpenAI API key, or
   - Anthropic API key, or
   - Google AI API key

### System Requirements

- Node.js 18.18.0 to 24.x (18 LTS recommended)
- npm 9.0.0 or higher
- 4 GB RAM minimum
- 2 CPU cores minimum

## Environment Variables

### Required Variables

```bash
# Application
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://user:password@host:5432/vibecode?sslmode=require

# Cache (Redis/Valkey)
REDIS_URL=redis://:password@host:6379/0
# Or for Redis with username:
# REDIS_URL=redis://username:password@host:6379/0

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Monitoring (optional but recommended)
DD_API_KEY=your_datadog_api_key
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
DD_TRACE_ENABLED=true
```

### Optional Variables

```bash
# OAuth Providers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email (for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM=noreply@vibecode.com

# Storage (for file uploads)
S3_BUCKET=vibecode-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_PDF_PROCESSING=true
ENABLE_WORKSPACE_RBAC=true
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET (32 bytes)
openssl rand -base64 32

# Generate database password (24 bytes)
openssl rand -base64 24

# Generate Redis password (32 bytes hex)
openssl rand -hex 32
```

## Database Setup

### PostgreSQL with pgvector

#### Option 1: Managed Database (Recommended)

**Vercel Postgres**:
```bash
# Install Vercel CLI
npm install -g vercel

# Create database
vercel postgres create vibecode-db

# Get connection string
vercel env pull .env.local
```

**AWS RDS**:
```bash
aws rds create-db-instance \
  --db-instance-identifier vibecode-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username vibecode \
  --master-user-password <strong-password> \
  --allocated-storage 50 \
  --storage-encrypted \
  --vpc-security-group-ids sg-xxxxx
```

**Google Cloud SQL**:
```bash
gcloud sql instances create vibecode-db \
  --database-version=POSTGRES_16 \
  --tier=db-n1-standard-2 \
  --region=us-central1
```

#### Option 2: Self-Hosted

Using Docker:
```bash
docker run -d \
  --name vibecode-postgres \
  -e POSTGRES_DB=vibecode \
  -e POSTGRES_USER=vibecode \
  -e POSTGRES_PASSWORD=<strong-password> \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
```

#### Install pgvector Extension

```sql
-- Connect to database
psql "$DATABASE_URL"

-- Install extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### Run Database Migrations

```bash
# Install Prisma CLI
npm install -g prisma

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed
```

### Redis/Valkey Setup

#### Option 1: Managed Cache

**Upstash Redis**:
```bash
# Sign up at https://upstash.com
# Create database
# Copy REDIS_URL from dashboard
```

**AWS ElastiCache**:
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id vibecode-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1
```

#### Option 2: Self-Hosted Valkey

Using Docker:
```bash
docker run -d \
  --name vibecode-cache \
  -p 6379:6379 \
  -v redis-data:/data \
  valkey/valkey:7-alpine \
  valkey-server \
  --requirepass <strong-password> \
  --appendonly yes
```

## Deployment Platforms

### Vercel (Recommended for Next.js)

Optimized for Next.js with zero configuration.

#### Quick Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# From project root
vercel --prod

# Follow prompts to configure
```

#### Configuration

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "DATABASE_URL": "@database-url",
      "NEXTAUTH_SECRET": "@nextauth-secret",
      "OPENAI_API_KEY": "@openai-api-key"
    }
  }
}
```

#### Environment Variables

In Vercel Dashboard > Settings > Environment Variables:

1. Add all required variables
2. Select environments (Production, Preview, Development)
3. Save and redeploy

#### Benefits
- **Edge Functions**: Globally distributed
- **Automatic HTTPS**: Free SSL certificates
- **Preview Deployments**: PR previews
- **Analytics**: Built-in web analytics
- **Zero Config**: Works out of the box
- **Vercel Postgres**: Integrated database

### Docker Deployment

Build and run with Docker.

#### Build Image

```bash
# Build production image
docker build -t vibecode:latest -f Dockerfile .

# Or with build args
docker build \
  --build-arg NODE_VERSION=18 \
  -t vibecode:1.0.0 \
  .
```

#### Run Container

```bash
# Using docker run
docker run -d \
  --name vibecode-app \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  vibecode:latest

# Using docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

#### Docker Compose Example

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    image: vibecode:latest
    container_name: vibecode-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://vibecode:${DB_PASSWORD}@postgres:5432/vibecode
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: pgvector/pgvector:pg16
    container_name: vibecode-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: vibecode
      POSTGRES_USER: vibecode
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibecode"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: valkey/valkey:7-alpine
    container_name: vibecode-cache
    restart: unless-stopped
    command: valkey-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  postgres-data:
  redis-data:
```

See [Docker Production Guide](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/DOCKER_PRODUCTION.md) for complete setup with NGINX and monitoring.

### Kubernetes Deployment

Deploy to Kubernetes for high availability.

#### Using Helm

```bash
# Add repository (if using Helm chart)
helm repo add vibecode https://charts.vibecode.com

# Install
helm install vibecode vibecode/vibecode \
  --namespace vibecode-production \
  --create-namespace \
  --values values.production.yaml
```

#### values.production.yaml

```yaml
replicaCount: 3

image:
  repository: vibecode/webgui
  tag: "1.0.0"
  pullPolicy: IfNotPresent

env:
  - name: NODE_ENV
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: vibecode-secrets
        key: database-url
  - name: NEXTAUTH_SECRET
    valueFrom:
      secretKeyRef:
        name: vibecode-secrets
        key: nextauth-secret
  - name: OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: vibecode-secrets
        key: openai-api-key

resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: true
  auth:
    database: vibecode
    existingSecret: postgres-secrets
  primary:
    resources:
      requests:
        memory: "8Gi"
        cpu: "2000m"

redis:
  enabled: true
  auth:
    existingSecret: redis-secrets
  master:
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
```

#### Create Secrets

```bash
# Create namespace
kubectl create namespace vibecode-production

# Create secrets
kubectl create secret generic vibecode-secrets \
  --namespace vibecode-production \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
  --from-literal=openai-api-key="$OPENAI_API_KEY"
```

See [Kubernetes Production Guide](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/KUBERNETES_PRODUCTION.md) for complete high-availability setup.

### AWS Deployment

#### AWS App Runner (Easiest)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account>.dkr.ecr.us-east-1.amazonaws.com

docker tag vibecode:latest \
  <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode:latest

docker push <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode:latest

# Create App Runner service
aws apprunner create-service \
  --service-name vibecode \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "<account>.dkr.ecr.us-east-1.amazonaws.com/vibecode:latest",
      "ImageRepositoryType": "ECR"
    }
  }' \
  --instance-configuration '{
    "Cpu": "2 vCPU",
    "Memory": "4 GB"
  }'
```

#### AWS ECS/Fargate

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name vibecode

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster vibecode \
  --service-name vibecode-webgui \
  --task-definition vibecode:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --load-balancers '{
    "targetGroupArn": "arn:aws:elasticloadbalancing:...",
    "containerName": "vibecode",
    "containerPort": 3000
  }'
```

### Azure Deployment

#### Azure App Service

```bash
# Create App Service plan
az appservice plan create \
  --name vibecode-plan \
  --resource-group vibecode-rg \
  --sku P1V2 \
  --is-linux

# Create web app
az webapp create \
  --name vibecode \
  --resource-group vibecode-rg \
  --plan vibecode-plan \
  --runtime "NODE:18-lts"

# Configure app settings
az webapp config appsettings set \
  --name vibecode \
  --resource-group vibecode-rg \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="$DATABASE_URL" \
    NEXTAUTH_URL="https://vibecode.azurewebsites.net" \
    NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    OPENAI_API_KEY="$OPENAI_API_KEY"

# Deploy code
az webapp deployment source config \
  --name vibecode \
  --resource-group vibecode-rg \
  --repo-url https://github.com/ryanmaclean/vibecode-webgui \
  --branch main \
  --manual-integration
```

#### Azure Container Instances

```bash
# Create container group
az container create \
  --name vibecode \
  --resource-group vibecode-rg \
  --image <registry>/vibecode:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3000 \
  --dns-name-label vibecode \
  --environment-variables \
    NODE_ENV=production \
  --secure-environment-variables \
    DATABASE_URL="$DATABASE_URL" \
    NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    OPENAI_API_KEY="$OPENAI_API_KEY"
```

### Google Cloud Deployment

#### Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/vibecode

# Deploy to Cloud Run
gcloud run deploy vibecode \
  --image gcr.io/PROJECT_ID/vibecode \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=database-url:latest,NEXTAUTH_SECRET=nextauth-secret:latest"
```

#### Google Kubernetes Engine (GKE)

```bash
# Create GKE cluster
gcloud container clusters create vibecode \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10

# Deploy with Helm
helm install vibecode ./charts/vibecode \
  --namespace vibecode-production \
  --create-namespace \
  --values values.gcp.yaml
```

## Known Issues & Workarounds

### Webpack Minification Error

**Issue**: Build fails with webpack minification error in Next.js 15.

**Symptoms**:
```
Error: webpack minification failed
```

**Workarounds**:

1. **Disable minification** (temporary):
   ```javascript
   // next.config.mjs
   export default {
     swcMinify: false,
     webpack: (config) => {
       config.optimization.minimize = false;
       return config;
     }
   }
   ```

2. **Use Node.js 18 LTS** (most stable):
   ```bash
   nvm install 18
   nvm use 18
   npm run build
   ```

3. **Update Next.js** (when fix is available):
   ```bash
   npm update next@latest
   ```

### Large Bundle Size

**Issue**: Build output exceeds platform limits.

**Solution**: Enable output file tracing

```javascript
// next.config.mjs
export default {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  }
}
```

### Database Connection Pool Exhaustion

**Issue**: "too many clients" error

**Solution**: Configure connection pooling

```javascript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Add to `DATABASE_URL`:
```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

## Health Checks

### Health Endpoints

The application provides several health check endpoints:

**Basic Health Check**:
```bash
curl http://localhost:3000/api/health

# Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2025-10-25T00:00:00Z"
}
```

**Readiness Check** (includes dependencies):
```bash
curl http://localhost:3000/api/health/ready

# Response:
{
  "status": "ready",
  "database": "connected",
  "cache": "connected",
  "ai": "configured"
}
```

**Liveness Check**:
```bash
curl http://localhost:3000/api/health/live

# Response:
{
  "status": "alive"
}
```

### Configure Health Checks

#### Docker
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

#### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 5
```

## Monitoring & Observability

### Datadog APM

Already integrated in the application.

**Enable in Production**:
```bash
# Environment variables
DD_API_KEY=your_datadog_api_key
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
DD_TRACE_ENABLED=true
DD_PROFILING_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true
```

**Start with APM**:
```bash
npm run start:dd
```

### Custom Metrics

```typescript
// lib/monitoring.ts
import { datadogLogs } from '@datadog/browser-logs';

export function trackEvent(eventName: string, properties: Record<string, any>) {
  datadogLogs.logger.info(eventName, properties);
}

// Usage
trackEvent('ai_request', {
  provider: 'openai',
  model: 'gpt-4',
  tokens: 150,
  duration_ms: 1234
});
```

### Log Aggregation

Use structured JSON logging:

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error: (message: string, error?: Error, meta?: Record<string, any>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_documents_vector ON documents USING ivfflat (embedding vector_cosine_ops);

-- Analyze tables
ANALYZE users;
ANALYZE sessions;
ANALYZE documents;
```

### Caching Strategy

```typescript
// lib/cache.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

### Next.js Optimizations

```javascript
// next.config.mjs
export default {
  // Enable compression
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },

  // Experimental optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@headlessui/react', 'lodash'],
  },

  // Standalone output for Docker
  output: 'standalone',
};
```

## Security Best Practices

### Environment Security

- Never commit `.env` files
- Use secrets management (AWS Secrets Manager, Vault)
- Rotate secrets regularly
- Use different secrets per environment

### Database Security

- Use SSL/TLS connections (`sslmode=require`)
- Implement row-level security (RLS)
- Regular backups with encryption
- Principle of least privilege

### Application Security

```typescript
// middleware.ts - Rate limiting
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(request: NextRequest) {
  const { success } = await ratelimit.limit(
    request.ip ?? 'anonymous'
  );

  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }

  return NextResponse.next();
}
```

## Backup & Recovery

### Database Backups

```bash
# Automated backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="vibecode_backup_${TIMESTAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Upload to S3
aws s3 cp "$BACKUP_FILE" s3://vibecode-backups/

# Keep last 30 days
find . -name "vibecode_backup_*.sql.gz" -mtime +30 -delete
```

### Restore Procedure

```bash
# Download from S3
aws s3 cp s3://vibecode-backups/vibecode_backup_20251025.sql.gz .

# Restore
gunzip < vibecode_backup_20251025.sql.gz | psql "$DATABASE_URL"
```

## Troubleshooting

### Application Won't Start

1. Check environment variables
2. Verify database connectivity
3. Check port availability
4. Review logs

```bash
# Check environment
node -e "console.log(process.env)"

# Test database
psql "$DATABASE_URL" -c "SELECT version();"

# Check port
lsof -i :3000

# View logs
docker logs vibecode-app
# or
kubectl logs -f deployment/vibecode-webgui
```

### High Memory Usage

```bash
# Monitor memory
node --max-old-space-size=4096 server.js

# Enable heap profiling
node --heapsnapshot-signal=SIGUSR2 server.js

# Trigger snapshot
kill -USR2 <pid>
```

### Slow API Responses

1. Enable Datadog APM
2. Check database query performance
3. Review cache hit rates
4. Analyze slow queries

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Next Steps

- [Astro Documentation Deployment →](/deployment/astro/)
- [Docker Production Guide →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/DOCKER_PRODUCTION.md)
- [Kubernetes Production Guide →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/KUBERNETES_PRODUCTION.md)
- [Monitoring Setup →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/MONITORING.md)
- [Security Hardening →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/SECURITY_HARDENING.md)
- [Back to Deployment Overview →](/deployment/)
