# Deployment Guide - VibeCode Experimentation Platform

**Complete guide to deploying the experimentation platform to production**

Version 1.0 | Last Updated: October 25, 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Application Deployment](#application-deployment)
5. [Health Checks](#health-checks)
6. [Datadog Integration](#datadog-integration)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Scaling Considerations](#scaling-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Security Checklist](#security-checklist)

---

<a name="prerequisites"></a>
## 1. Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| **Node.js** | 20.x LTS | Runtime environment |
| **PostgreSQL** | 15.x | Primary database |
| **Redis** | 7.x (optional) | Caching layer |
| **Git** | 2.x | Source control |
| **Docker** | 24.x (optional) | Containerization |

### Recommended Services

| Service | Purpose | Cost |
|---------|---------|------|
| **Vercel** | Next.js hosting | Free tier available, $20/mo Pro |
| **Supabase** | Managed PostgreSQL | Free tier available, $25/mo Pro |
| **Upstash** | Managed Redis | Free tier available, $10/mo |
| **Datadog** | Monitoring & observability | Free trial, varies by usage |
| **OpenRouter** | AI model access | Pay-per-use |

### Minimum System Requirements

**For Self-Hosted Deployment:**
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 20GB SSD (50GB+ for production)
- **Network**: 100 Mbps

**Expected Traffic Handling:**
- 10,000 requests/day: 2 cores, 4GB RAM
- 100,000 requests/day: 4 cores, 8GB RAM
- 1M requests/day: 8 cores, 16GB RAM + load balancing

---

<a name="environment-setup"></a>
## 2. Environment Setup

### Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Database
DATABASE_URL="postgresql://user:password@host:5432/vibecode?schema=public"
DIRECT_URL="postgresql://user:password@host:5432/vibecode?schema=public"

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

# OpenRouter API
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# Datadog (optional but recommended)
NEXT_PUBLIC_DATADOG_APPLICATION_ID="your-app-id"
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN="your-client-token"
DATADOG_API_KEY="your-api-key"
DATADOG_SERVICE_NAME="vibecode-experiments"
DATADOG_ENV="production"

# Redis (optional)
REDIS_URL="redis://default:password@host:6379"

# Feature Flags
ENABLE_GUARDRAILS=true
ENABLE_MULTI_ARMED_BANDITS=true
ENABLE_DATADOG_RUM=true

# Performance
BATCH_SIZE=100
BATCH_FLUSH_INTERVAL=5000
CACHE_TTL=300000

# Security
CORS_ORIGIN="https://your-domain.com"
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Generate Secrets

```bash
# NextAuth Secret (minimum 32 characters)
openssl rand -base64 32

# Database Passwords
openssl rand -base64 24

# API Keys (use provider dashboards)
```

### Verify Environment

```bash
# Check Node.js version
node --version  # Should be v20.x or higher

# Check npm version
npm --version   # Should be 9.x or higher

# Verify PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Test environment file
node -e "require('dotenv').config({path:'.env.production'}); console.log(process.env.DATABASE_URL ? '✓ Loaded' : '✗ Failed')"
```

---

<a name="database-configuration"></a>
## 3. Database Configuration

### Option A: Managed PostgreSQL (Recommended)

**Supabase Setup:**

1. Create account at https://supabase.com
2. Create new project
3. Navigate to Settings → Database
4. Copy connection string
5. Update `.env.production`:

```bash
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
```

**Other Managed Options:**
- **Railway**: https://railway.app
- **Neon**: https://neon.tech
- **AWS RDS**: https://aws.amazon.com/rds/

### Option B: Self-Hosted PostgreSQL

**Installation (Ubuntu/Debian):**

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql

CREATE DATABASE vibecode;
CREATE USER vibecode_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode_user;
\q
```

**Performance Tuning:**

Edit `/etc/postgresql/15/main/postgresql.conf`:

```conf
# Memory
shared_buffers = 256MB           # 25% of RAM
effective_cache_size = 1GB       # 50% of RAM
work_mem = 16MB

# Connections
max_connections = 200

# Write-Ahead Logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query Planner
random_page_cost = 1.1           # For SSD
effective_io_concurrency = 200   # For SSD
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### Database Migrations

**Run Migrations:**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

**Seed Initial Data (Optional):**

```bash
npx prisma db seed
```

### Database Indexes

Ensure critical indexes exist:

```sql
-- Verify indexes
\di

-- Create missing indexes if needed
CREATE INDEX IF NOT EXISTS idx_experiment_key ON "Experiment"(key);
CREATE INDEX IF NOT EXISTS idx_experiment_status ON "Experiment"(status);
CREATE INDEX IF NOT EXISTS idx_assignment_exp_user ON "ExperimentAssignment"(experiment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_metric_exp_variant ON "ExperimentMetric"(experiment_id, variant_key, metric_name);
```

### Database Backups

**Automated Backups (Managed):**
- Supabase: Automatic daily backups
- AWS RDS: Configure automated backups in console

**Manual Backups (Self-Hosted):**

```bash
# Create backup
pg_dump -U vibecode_user -h localhost vibecode > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U vibecode_user -h localhost vibecode < backup_20251025.sql

# Automated backup script
cat > /usr/local/bin/backup-vibecode-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/vibecode"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U vibecode_user vibecode | gzip > $BACKUP_DIR/vibecode_$DATE.sql.gz
find $BACKUP_DIR -name "vibecode_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-vibecode-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-vibecode-db.sh") | crontab -
```

---

<a name="application-deployment"></a>
## 4. Application Deployment

### Option A: Vercel (Recommended for Next.js)

**Setup Steps:**

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Link project:
```bash
vercel link
```

4. Configure environment variables:
```bash
# Add all variables from .env.production
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add OPENROUTER_API_KEY production
# ... add all variables
```

5. Deploy:
```bash
vercel --prod
```

**Custom Domain:**
```bash
vercel domains add your-domain.com
```

### Option B: Docker Deployment

**Create Dockerfile:**

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

**Docker Compose:**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=vibecode
      - POSTGRES_USER=vibecode_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**Deploy:**

```bash
docker-compose up -d
```

### Option C: Traditional Server (PM2)

**Install PM2:**

```bash
npm install -g pm2
```

**Build Application:**

```bash
npm run build
```

**Create PM2 Ecosystem File:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'vibecode-experiments',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
}
```

**Start Application:**

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

<a name="health-checks"></a>
## 5. Health Checks

### Create Health Check Endpoint

Create `/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString()
  }

  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    console.error('Database health check failed:', error)
  }

  try {
    // Check Redis (if enabled)
    if (redis) {
      await redis.ping()
      checks.redis = true
    }
  } catch (error) {
    console.error('Redis health check failed:', error)
  }

  const isHealthy = checks.database && (checks.redis || !redis)

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503
  })
}
```

### Monitor Health

```bash
# Manual check
curl https://your-domain.com/api/health

# Automated monitoring (add to cron)
*/5 * * * * curl -f https://your-domain.com/api/health || echo "Health check failed"
```

---

<a name="datadog-integration"></a>
## 6. Datadog Integration Setup

### Step 1: Create Datadog Account

1. Sign up at https://www.datadoghq.com
2. Get your API key and Application ID

### Step 2: Configure RUM

Add to `app/layout.tsx`:

```typescript
import { datadogRum } from '@datadog/browser-rum'

if (typeof window !== 'undefined') {
  datadogRum.init({
    applicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID!,
    clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN!,
    site: 'datadoghq.com',
    service: 'vibecode-experiments',
    env: process.env.NEXT_PUBLIC_ENV || 'production',
    version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input'
  })
}
```

### Step 3: Custom Metrics

```typescript
import { datadogRum } from '@datadog/browser-rum'

// Track experiment assignment
datadogRum.addAction('experiment_assigned', {
  experiment_key: 'button_color_test',
  variant: 'treatment',
  user_id: 'user_123'
})

// Track metric
datadogRum.addAction('experiment_metric_logged', {
  experiment_key: 'button_color_test',
  metric_name: 'conversion_rate',
  value: 1.0
})
```

---

<a name="monitoring-and-alerting"></a>
## 7. Monitoring and Alerting

### Key Metrics to Monitor

**Application Metrics:**
- Request rate (requests/second)
- Error rate (errors/total requests)
- Latency (p50, p95, p99)
- Database connection pool usage
- Memory usage
- CPU usage

**Business Metrics:**
- Active experiments
- Daily assignments
- Daily metrics logged
- Guardrail violations
- Statistical significance events

### Datadog Dashboards

Create dashboards for:

1. **System Health**: CPU, memory, errors, latency
2. **Experiment Activity**: Active experiments, assignments/day, metrics/day
3. **Statistical Insights**: Experiments reaching significance, winner detection
4. **Cost Tracking**: OpenRouter API usage and costs

### Alert Configuration

**Critical Alerts:**

```yaml
# High error rate
- name: "High Error Rate"
  query: "avg(last_5m):sum:errors{service:vibecode-experiments}.as_count() > 100"
  message: "Error rate exceeded 100 in last 5 minutes"
  notify: ["pagerduty", "slack"]

# Database down
- name: "Database Unreachable"
  query: "health_check.database == false"
  message: "Database health check failing"
  notify: ["pagerduty"]

# High latency
- name: "High API Latency"
  query: "avg(last_5m):p95:api.latency{service:vibecode-experiments} > 5000"
  message: "p95 latency exceeded 5 seconds"
  notify: ["slack"]
```

**Warning Alerts:**

```yaml
# Guardrail violation
- name: "Experiment Guardrail Violation"
  query: "guardrail.violation == true"
  message: "Guardrail violation detected in experiment"
  notify: ["slack"]

# High cost
- name: "High AI API Cost"
  query: "sum(last_1h):openrouter.cost > 50"
  message: "Hourly AI API cost exceeded $50"
  notify: ["slack", "email"]
```

---

<a name="scaling-considerations"></a>
## 8. Scaling Considerations

### Horizontal Scaling

**Load Balancer Configuration (Nginx):**

```nginx
upstream vibecode_backend {
    least_conn;
    server 10.0.1.10:3000 weight=1;
    server 10.0.1.11:3000 weight=1;
    server 10.0.1.12:3000 weight=1;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    location / {
        proxy_pass http://vibecode_backend;
        # ... proxy headers
    }
}
```

### Database Scaling

**Read Replicas:**

```typescript
// Use read replicas for analytics queries
const replicaUrl = process.env.DATABASE_REPLICA_URL

const analytics = new PrismaClient({
  datasources: {
    db: { url: replicaUrl }
  }
})
```

**Connection Pooling:**

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

### Caching Strategy

**Redis Caching:**

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export async function getCachedExperiment(key: string) {
  // Try cache first
  const cached = await redis.get(`experiment:${key}`)
  if (cached) return JSON.parse(cached)

  // Fetch from database
  const experiment = await prisma.experiment.findUnique({ where: { key } })

  // Cache for 5 minutes
  await redis.setex(`experiment:${key}`, 300, JSON.stringify(experiment))

  return experiment
}
```

---

<a name="troubleshooting"></a>
## 9. Troubleshooting Common Issues

### Issue: Database Connection Fails

**Symptoms:**
```
Error: P1001: Can't reach database server
```

**Solutions:**
1. Verify DATABASE_URL is correct
2. Check firewall allows connections on port 5432
3. Verify PostgreSQL is running: `systemctl status postgresql`
4. Test connection: `psql $DATABASE_URL -c "SELECT 1"`
5. Check connection limit: `SELECT count(*) FROM pg_stat_activity;`

### Issue: Migrations Fail

**Symptoms:**
```
Error: Migration engine error
```

**Solutions:**
1. Generate Prisma client: `npx prisma generate`
2. Reset database (DEV ONLY): `npx prisma migrate reset`
3. Check schema file for errors
4. Manually apply migrations: `npx prisma migrate deploy --skip-generate`

### Issue: High Memory Usage

**Symptoms:**
- Application crashes with out-of-memory errors
- Slow performance

**Solutions:**
1. Increase memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm start`
2. Enable memory profiling
3. Check for memory leaks (circular references, unclosed connections)
4. Implement connection pooling
5. Add caching to reduce database queries

### Issue: OpenRouter API Errors

**Symptoms:**
```
Error: 401 Unauthorized
Error: 429 Too Many Requests
```

**Solutions:**
1. Verify OPENROUTER_API_KEY is valid
2. Check account has credits
3. Implement retry logic with exponential backoff
4. Add rate limiting on client side
5. Monitor API usage in OpenRouter dashboard

---

<a name="security-checklist"></a>
## 10. Security Checklist

### Pre-Deployment Security

- [ ] All environment variables in `.env.production` (not committed to git)
- [ ] Strong passwords for database (minimum 24 characters)
- [ ] NEXTAUTH_SECRET is secure random string (32+ characters)
- [ ] SSL/TLS certificates configured
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Database not publicly accessible (only from app servers)
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Input validation on all API endpoints
- [ ] SQL injection prevention (using Prisma parameterized queries)
- [ ] XSS prevention (React auto-escapes)
- [ ] CSRF protection (NextAuth handles)

### Post-Deployment Security

- [ ] Enable automated backups
- [ ] Set up monitoring and alerts
- [ ] Configure log retention
- [ ] Review access logs weekly
- [ ] Update dependencies monthly: `npm audit fix`
- [ ] Rotate secrets quarterly
- [ ] Test disaster recovery plan
- [ ] Conduct security audit
- [ ] Enable 2FA for all admin accounts
- [ ] Document incident response plan

---

## Deployment Checklist

Use this final checklist before going live:

**Pre-Deployment:**
- [ ] All tests passing: `npm test`
- [ ] Build successful: `npm run build`
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Backups configured
- [ ] Health checks working
- [ ] Load testing completed
- [ ] Security review completed

**Deployment:**
- [ ] Deploy to staging first
- [ ] Smoke test all critical paths
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify database connections
- [ ] Test external integrations (OpenRouter, Datadog)

**Post-Deployment:**
- [ ] Monitor for 24 hours
- [ ] Verify backups running
- [ ] Check alert configurations
- [ ] Review logs for errors
- [ ] Performance within SLAs
- [ ] Document any issues
- [ ] Communicate launch to team

---

**Congratulations!** Your experimentation platform is now deployed and production-ready.

**For support:** Create an issue on GitHub or contact the team at deploy@vibecode.com

**Version:** 1.0.0
**Last Updated:** October 25, 2025
**Word Count:** 1,687 words
