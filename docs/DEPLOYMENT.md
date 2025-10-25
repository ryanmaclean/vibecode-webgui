# VibeCode Platform Deployment Guide

Complete deployment guide for the VibeCode Platform, covering both the Astro documentation site and the Next.js application.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Guides](#deployment-guides)
- [Environment Variables](#environment-variables)
- [Deployment Platforms](#deployment-platforms)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

The VibeCode Platform consists of two main components:

### 1. Astro Documentation Site

- **Technology**: Astro with Starlight theme
- **Build Output**: Static HTML/CSS/JS
- **Build Time**: ~4.12s
- **Total Pages**: 96 pages
- **Build Size**: ~13 MB
- **Search**: Pagefind static search
- **Hosting**: Any static hosting provider

### 2. Next.js Application

- **Technology**: Next.js 15 with React 19
- **Build Output**: Standalone Node.js application
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache**: Valkey/Redis
- **AI Integration**: OpenAI, Anthropic, Google AI
- **Monitoring**: Datadog APM
- **Hosting**: Node.js-compatible platforms

## Prerequisites

### System Requirements

- **Node.js**: 18.18.0 - 24.x (LTS recommended)
- **npm**: 9.0.0 or higher
- **Git**: For version control
- **PostgreSQL**: 16+ with pgvector extension (for Next.js app)
- **Redis/Valkey**: For caching (for Next.js app)

### Platform-Specific Tools

#### For Docker Deployment
- Docker 24.0+
- Docker Compose 2.20+

#### For Kubernetes Deployment
- kubectl 1.28+
- Helm 3.12+
- Access to a Kubernetes cluster (1.28+)

#### For Cloud Platforms
- **Vercel**: Vercel CLI (optional)
- **Netlify**: Netlify CLI (optional)
- **AWS**: AWS CLI configured
- **Azure**: Azure CLI configured
- **GCP**: gcloud CLI configured

## Quick Start

### Astro Documentation Site

```bash
# Navigate to docs directory
cd docs

# Install dependencies
npm install

# Build for production
npm run build

# Preview locally
npm run preview

# Output directory: dist/
```

### Next.js Application

```bash
# From project root
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Build for production
npm run build

# Start production server
npm start
```

## Deployment Guides

Detailed deployment guides are available in the documentation:

1. **[Astro Documentation Deployment](./src/content/docs/deployment/astro.md)**
   - Static hosting options
   - CDN configuration
   - Search index deployment
   - Performance optimization

2. **[Next.js Application Deployment](./src/content/docs/deployment/nextjs.md)**
   - Vercel deployment
   - Docker deployment
   - Kubernetes deployment
   - Environment configuration

3. **[Production Deployment Guide](./deployment/DOCKER_PRODUCTION.md)**
   - Docker Compose setup
   - NGINX configuration
   - Database optimization
   - Monitoring setup

4. **[Kubernetes Production](./deployment/KUBERNETES_PRODUCTION.md)**
   - High availability setup
   - Auto-scaling configuration
   - Service mesh integration
   - Network policies

## Environment Variables

### Astro Documentation (Optional)

```bash
# Optional Datadog RUM monitoring
PUBLIC_DATADOG_CLIENT_TOKEN=your_client_token
PUBLIC_DATADOG_APPLICATION_ID=your_app_id
```

### Next.js Application (Required)

```bash
# Application
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=postgresql://user:password@host:5432/vibecode?sslmode=require

# Cache
REDIS_URL=redis://:password@host:6379/0

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Monitoring (optional)
DD_API_KEY=your_datadog_api_key
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate database password
openssl rand -base64 24

# Generate Redis password
openssl rand -hex 32
```

## Deployment Platforms

### Static Hosting (Astro Docs)

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# From docs directory
cd docs
vercel --prod

# Or use GitHub integration (automatic)
```

**Configuration**: `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro"
}
```

#### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# From docs directory
cd docs
netlify deploy --prod

# Or use GitHub integration (automatic)
```

**Configuration**: `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[plugins]]
  package = "@netlify/plugin-lighthouse"
```

#### GitHub Pages

```bash
# Already configured in astro.config.mjs
# Just push to main branch
git add .
git commit -m "Deploy docs"
git push origin main

# GitHub Actions will build and deploy automatically
```

#### CloudFlare Pages

- Connect repository in CloudFlare dashboard
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `docs`

### Application Hosting (Next.js)

#### Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# From project root
vercel --prod

# Configure environment variables in Vercel dashboard
```

#### Docker

```bash
# Build image
docker build -t vibecode-webgui:latest .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d

# See deployment/DOCKER_PRODUCTION.md for full setup
```

#### Kubernetes

```bash
# Using Helm
helm install vibecode ./helm/vibecode \
  --namespace vibecode-production \
  --values values.production.yaml

# See deployment/KUBERNETES_PRODUCTION.md for full setup
```

#### AWS (ECS/Fargate)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag vibecode-webgui:latest <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode:latest

# Deploy to ECS
aws ecs update-service --cluster vibecode --service vibecode-webgui --force-new-deployment
```

#### Azure (App Service)

```bash
# Using Azure CLI
az webapp up \
  --name vibecode \
  --resource-group vibecode-rg \
  --runtime "NODE:18-lts" \
  --sku P1V2

# Configure app settings
az webapp config appsettings set \
  --name vibecode \
  --resource-group vibecode-rg \
  --settings @appsettings.json
```

#### Google Cloud (Cloud Run)

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/vibecode

# Deploy to Cloud Run
gcloud run deploy vibecode \
  --image gcr.io/PROJECT_ID/vibecode \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Troubleshooting

### Common Issues

#### Astro Documentation

**Issue**: Search not working after deployment
```bash
# Ensure pagefind ran during build
npm run build

# Check dist/_pagefind/ directory exists
ls -la dist/_pagefind/

# Solution: Pagefind should run automatically with astro build
```

**Issue**: Assets not loading (404 errors)
```bash
# Check base path in astro.config.mjs
# For GitHub Pages: base: '/vibecode-webgui'
# For root domain: base: '/'

# Rebuild after changing config
npm run build
```

**Issue**: Build fails with memory error
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

#### Next.js Application

**Issue**: Webpack minification error
```bash
# Known issue with Next.js 15
# Workaround 1: Disable minification in next.config.mjs
module.exports = {
  swcMinify: false,
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  }
}

# Workaround 2: Use Node.js 18 LTS (most stable)
nvm install 18
nvm use 18
```

**Issue**: Database connection fails
```bash
# Check DATABASE_URL format
# Should be: postgresql://user:pass@host:port/db?sslmode=require

# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check pgvector extension
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Issue**: Build succeeds but app crashes on start
```bash
# Check logs
docker logs vibecode-app
# or
kubectl logs -f deployment/vibecode-webgui

# Common causes:
# 1. Missing environment variables
# 2. Database not accessible
# 3. Memory limits too low

# Verify environment
node -e "console.log(process.env)"
```

**Issue**: Health check failing
```bash
# Test health endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready

# Check server is listening
netstat -tuln | grep 3000

# Review startup logs
journalctl -u vibecode.service -f
```

### Performance Issues

**Slow initial page load**
```bash
# Enable Next.js compression
npm install compression

# Use CDN for static assets
# Configure in next.config.mjs:
module.exports = {
  assetPrefix: 'https://cdn.yourdomain.com'
}
```

**High memory usage**
```bash
# Monitor memory
node --max-old-space-size=4096 server.js

# Enable heap snapshots
node --heapsnapshot-signal=SIGUSR2 server.js

# Investigate with Chrome DevTools
```

**Database query performance**
```bash
# Enable query logging
log_min_duration_statement = 1000  # Log queries > 1s

# Analyze slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Add indexes as needed
CREATE INDEX idx_name ON table(column);
```

## Best Practices

### Security

1. **Never commit secrets** - Use environment variables
2. **Enable HTTPS** - Always use SSL/TLS in production
3. **Set security headers** - CSP, HSTS, X-Frame-Options
4. **Use strong passwords** - 32+ character random strings
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Enable rate limiting** - Protect API endpoints
7. **Use network policies** - Restrict pod-to-pod communication (K8s)

### Performance

1. **Enable caching** - Use Redis/Valkey for sessions and API responses
2. **Use CDN** - Serve static assets from edge locations
3. **Optimize images** - Use Next.js Image component
4. **Enable compression** - Gzip/Brotli for text content
5. **Database connection pooling** - Limit concurrent connections
6. **Monitor performance** - Use Datadog, New Relic, or similar
7. **Set resource limits** - Prevent runaway processes

### Reliability

1. **Health checks** - Implement `/api/health` endpoints
2. **Graceful shutdown** - Handle SIGTERM properly
3. **Auto-restart** - Use process managers or container orchestration
4. **Backup database** - Automated daily backups with retention
5. **Blue-green deployments** - Zero-downtime updates
6. **Monitoring & alerts** - Know when things break
7. **Disaster recovery plan** - Document and test recovery procedures

### Cost Optimization

1. **Right-size resources** - Don't over-provision
2. **Use auto-scaling** - Scale based on demand
3. **Optimize database** - Regular vacuum, analyze
4. **CDN for static content** - Reduce origin bandwidth
5. **Compression** - Reduce transfer costs
6. **Reserved instances** - For predictable workloads
7. **Monitor costs** - Set up billing alerts

## Monitoring & Observability

### Application Metrics

```javascript
// Health check endpoint
// GET /api/health
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2025-10-25T00:00:00Z"
}

// Readiness check
// GET /api/health/ready
{
  "status": "ready",
  "database": "connected",
  "cache": "connected"
}
```

### Log Aggregation

**Recommended Tools**:
- Datadog Logs
- CloudWatch Logs (AWS)
- Google Cloud Logging
- ELK Stack (self-hosted)

**Log Format**: Use structured JSON logging
```javascript
{
  "timestamp": "2025-10-25T00:00:00Z",
  "level": "info",
  "message": "Request processed",
  "request_id": "uuid",
  "duration_ms": 123,
  "status_code": 200
}
```

### Alerting

**Critical Alerts**:
- Application down (5xx errors > 1% for 5min)
- Database connection failures
- Memory usage > 90%
- Disk usage > 85%
- SSL certificate expiring < 7 days

**Warning Alerts**:
- Response time > 1s (p95)
- Error rate > 0.1%
- CPU usage > 80%
- Database slow queries

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Production

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'src/**'
      - 'package.json'

jobs:
  deploy-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Build docs
        working-directory: ./docs
        run: |
          npm ci
          npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/dist

  deploy-app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t vibecode:${{ github.sha }} .
          docker push vibecode:${{ github.sha }}

      - name: Deploy to production
        run: |
          kubectl set image deployment/vibecode \
            vibecode=vibecode:${{ github.sha }}
```

## Rollback Procedures

### Astro Documentation

```bash
# Revert to previous deployment
git revert HEAD
git push origin main

# Or manually deploy previous version
git checkout <previous-commit>
cd docs && npm run build
# Upload dist/ to hosting provider
```

### Next.js Application

#### Docker
```bash
# Roll back to previous image
docker-compose -f docker-compose.prod.yml down
docker tag vibecode:previous vibecode:latest
docker-compose -f docker-compose.prod.yml up -d
```

#### Kubernetes
```bash
# Check rollout history
kubectl rollout history deployment/vibecode-webgui -n vibecode-production

# Rollback to previous version
kubectl rollout undo deployment/vibecode-webgui -n vibecode-production

# Rollback to specific revision
kubectl rollout undo deployment/vibecode-webgui \
  --to-revision=2 \
  -n vibecode-production
```

#### Vercel
```bash
# Via CLI
vercel rollback

# Via dashboard
# Go to Deployments > Select previous deployment > Promote to Production
```

## Health Checks

### Astro Documentation

**Manual Checks**:
1. Visit homepage - loads in < 1s
2. Search functionality works
3. All internal links work (no 404s)
4. Images load correctly
5. Mobile responsive layout

**Automated Checks**:
```bash
# Check build output
test -d dist && echo "Build successful" || echo "Build failed"

# Check for 404s
wget --spider --recursive --no-parent https://your-docs-site.com 2>&1 | grep "404"

# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --collect.url=https://your-docs-site.com
```

### Next.js Application

**Health Endpoints**:
- `GET /api/health` - Basic health check
- `GET /api/health/ready` - Readiness probe (checks dependencies)
- `GET /api/health/live` - Liveness probe (checks if app is running)

**Smoke Tests**:
```bash
# Test health endpoint
curl -f http://localhost:3000/api/health || exit 1

# Test database connection
curl -f http://localhost:3000/api/health/ready || exit 1

# Test API endpoint
curl -f -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' || exit 1
```

## Support & Resources

- **Documentation**: [https://vibecode-docs.example.com](./src/content/docs/deployment/)
- **Issues**: GitHub Issues
- **Slack**: #vibecode-ops
- **Runbooks**: `./deployment/runbooks/`
- **Monitoring**: Datadog Dashboard
- **Status Page**: status.vibecode.example.com

## Next Steps

1. Review platform-specific deployment guides
2. Set up monitoring and alerting
3. Configure automated backups
4. Implement CI/CD pipeline
5. Conduct load testing
6. Document disaster recovery procedures
7. Schedule regular security audits

---

**Last Updated**: 2025-10-25
**Version**: 1.0.0
**Maintainer**: VibeCode DevOps Team
