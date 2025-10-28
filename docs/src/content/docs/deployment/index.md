---
title: "Deployment Overview"
description: "Complete deployment guide for the VibeCode Platform - Astro documentation and Next.js application"
sidebar:
  order: 0
---

The VibeCode Platform consists of two main components that can be deployed independently or together.

## Platform Components

### Astro Documentation Site

Static documentation site built with Astro and Starlight theme.

- **Build Time**: ~4.12 seconds
- **Total Pages**: 96 pages
- **Build Output**: Static HTML/CSS/JS (~13 MB)
- **Search**: Pagefind static search (95 pages indexed)
- **Deployment**: Any static hosting (Vercel, Netlify, GitHub Pages, CloudFlare Pages)

**Quick Deploy**:
```bash
cd docs
npm install
npm run build
# Output in: dist/
```

[View Astro Deployment Guide →](/deployment/astro/)

### Next.js Application

Full-stack web application with AI integration.

- **Framework**: Next.js 15 with React 19
- **Runtime**: Node.js 18.18.0 - 24.x
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache**: Valkey/Redis for session and API caching
- **AI Providers**: OpenAI, Anthropic, Google AI
- **Monitoring**: Datadog APM and RUM
- **Deployment**: Vercel, Docker, Kubernetes, Cloud platforms

**Quick Deploy**:
```bash
npm install
npm run build
npm start
# Runs on: http://localhost:3000
```

[View Next.js Deployment Guide →](/deployment/nextjs/)

## Deployment Scenarios

### Scenario 1: Documentation Only

Deploy just the Astro documentation site for public-facing docs.

**Best For**: Open source projects, public documentation
**Platforms**: GitHub Pages, Netlify, Vercel, CloudFlare Pages
**Cost**: Free (most platforms)

### Scenario 2: Full Platform

Deploy both documentation and application together.

**Best For**: Complete development platform with docs
**Platforms**: Kubernetes, Docker Compose, Cloud platforms
**Cost**: Variable based on usage

### Scenario 3: Hybrid

Deploy docs to static hosting and app to container platform.

**Best For**: Optimal cost/performance balance
**Platforms**: Docs on GitHub Pages, App on Kubernetes/Cloud Run
**Cost**: Mixed (free docs, paid app hosting)

## Prerequisites

### For Documentation Deployment

- Node.js 18.18.0+
- npm 9.0.0+
- Git (for GitHub Pages)

### For Application Deployment

- Node.js 18.18.0 - 24.x
- PostgreSQL 16+ with pgvector extension
- Redis/Valkey for caching
- API keys for AI providers (OpenAI, Anthropic, or Google AI)

### For Container Deployment

- Docker 24.0+
- Docker Compose 2.20+ (optional)
- kubectl 1.28+ (for Kubernetes)
- Helm 3.12+ (for Kubernetes)

## Deployment Guides

### Platform-Specific Guides

<div class="not-content">
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0;">
    <a href="/deployment/astro/" style="text-decoration: none;">
      <div style="border: 1px solid var(--sl-color-gray-5); border-radius: 0.5rem; padding: 1.5rem; background: var(--sl-color-bg-nav);">
        <h3 style="margin-top: 0; color: var(--sl-color-white);">Astro Docs</h3>
        <p style="color: var(--sl-color-gray-2);">Deploy static documentation to hosting providers</p>
        <ul style="font-size: 0.9rem; color: var(--sl-color-gray-3);">
          <li>Vercel, Netlify, GitHub Pages</li>
          <li>CDN configuration</li>
          <li>Search optimization</li>
        </ul>
      </div>
    </a>

    <a href="/deployment/nextjs/" style="text-decoration: none;">
      <div style="border: 1px solid var(--sl-color-gray-5); border-radius: 0.5rem; padding: 1.5rem; background: var(--sl-color-bg-nav);">
        <h3 style="margin-top: 0; color: var(--sl-color-white);">Next.js App</h3>
        <p style="color: var(--sl-color-gray-2);">Deploy full-stack application with database</p>
        <ul style="font-size: 0.9rem; color: var(--sl-color-gray-3);">
          <li>Vercel, Docker, Kubernetes</li>
          <li>Database setup</li>
          <li>Environment configuration</li>
        </ul>
      </div>
    </a>
  </div>
</div>

### Infrastructure Guides

Additional deployment resources available in the repository:

- **[Docker Production](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/DOCKER_PRODUCTION.md)** - Complete Docker Compose setup with NGINX, PostgreSQL, and monitoring
- **[Kubernetes Production](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/KUBERNETES_PRODUCTION.md)** - High-availability Kubernetes deployment with auto-scaling
- **[Production Checklist](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/PRODUCTION_CHECKLIST.md)** - Pre-deployment verification checklist
- **[Monitoring Setup](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/MONITORING.md)** - Datadog and observability configuration
- **[Security Hardening](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/SECURITY_HARDENING.md)** - Production security best practices
- **[Disaster Recovery](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/DISASTER_RECOVERY.md)** - Backup and recovery procedures

## Environment Variables

### Documentation (Optional)

```bash
# Datadog RUM monitoring (optional)
PUBLIC_DATADOG_CLIENT_TOKEN=your_token
PUBLIC_DATADOG_APPLICATION_ID=your_app_id
```

### Application (Required)

```bash
# Application
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/vibecode

# Cache
REDIS_URL=redis://:password@host:6379/0

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Monitoring (optional)
DD_API_KEY=your_datadog_key
DD_ENV=production
```

Generate secure secrets:
```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# Database password
openssl rand -base64 24
```

## Quick Start Commands

### Documentation Deployment

```bash
# Build locally
cd docs
npm install
npm run build
npm run preview

# Deploy to Vercel
npx vercel --prod

# Deploy to Netlify
npx netlify deploy --prod --dir=dist

# Deploy to GitHub Pages (automatic on push to main)
git push origin main
```

### Application Deployment

```bash
# Local production build
npm install
npm run build
npm start

# Docker deployment
docker build -t vibecode:latest .
docker run -p 3000:3000 --env-file .env.production vibecode:latest

# Kubernetes deployment
helm install vibecode ./helm/vibecode -f values.production.yaml
```

## Health Checks

### Documentation

After deployment, verify:

- [ ] Homepage loads in < 1 second
- [ ] Search functionality works
- [ ] All navigation links work
- [ ] Images load correctly
- [ ] Mobile layout is responsive
- [ ] HTTPS is enabled

Test with:
```bash
# Check HTTP status
curl -I https://your-docs-site.com

# Run Lighthouse audit
npx lighthouse https://your-docs-site.com --view
```

### Application

Health check endpoints:

- **`GET /api/health`** - Basic health check
- **`GET /api/health/ready`** - Readiness probe (checks database)
- **`GET /api/health/live`** - Liveness probe

Test with:
```bash
# Health check
curl http://localhost:3000/api/health

# Readiness check (includes database)
curl http://localhost:3000/api/health/ready

# Expected response:
# {"status":"healthy","database":"connected","uptime":123}
```

## Troubleshooting

### Common Issues

#### Documentation Build Fails

```bash
# Clear cache and rebuild
cd docs
rm -rf node_modules dist .astro
npm install
npm run build

# Increase memory if needed
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

#### Application Build Succeeds but Fails to Start

Check:
1. Environment variables are set correctly
2. Database is accessible
3. Required ports are available
4. Memory limits are sufficient

```bash
# Test database connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check port availability
lsof -i :3000

# View logs
docker logs vibecode-app
# or
kubectl logs -f deployment/vibecode-webgui
```

#### Search Not Working

```bash
# Ensure Pagefind ran during build
cd docs
npm run build

# Verify search index exists
ls -la dist/_pagefind/

# If missing, check build logs for errors
```

### Getting Help

- **Documentation Issues**: [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Deployment Support**: See `/deployment/` directory for detailed guides
- **Production Readiness**: Review [Production Checklist](/production-deployment-guide/)

## Performance Benchmarks

### Documentation Site

- **Build Time**: 4.12 seconds
- **Page Load Time**: < 1 second (first load)
- **Page Load Time**: < 200ms (cached)
- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **Search Response**: < 100ms

### Application

- **API Response Time**: < 200ms (p50)
- **API Response Time**: < 500ms (p95)
- **Database Query Time**: < 100ms (p95)
- **Cold Start Time**: < 30 seconds
- **Memory Usage**: 2-4 GB (typical)
- **CPU Usage**: 1-2 cores (typical)

## Security Considerations

### Production Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Environment variables not committed to git
- [ ] Database uses SSL/TLS connections
- [ ] API rate limiting enabled
- [ ] Secrets rotated regularly
- [ ] Dependencies updated and audited
- [ ] Monitoring and alerting configured

See [Security Hardening Guide](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/SECURITY_HARDENING.md) for complete checklist.

## Monitoring & Observability

### Recommended Monitoring

**Documentation**:
- Uptime monitoring (Pingdom, UptimeRobot)
- Real User Monitoring (Datadog RUM)
- Analytics (Google Analytics, Plausible)

**Application**:
- APM (Datadog, New Relic)
- Log aggregation (Datadog Logs, CloudWatch)
- Error tracking (Sentry)
- Database monitoring (Datadog DBM)
- Infrastructure monitoring (Datadog Infrastructure)

### Key Metrics to Monitor

- Application uptime (target: 99.9%)
- API response time (target: p95 < 500ms)
- Error rate (target: < 0.1%)
- Database query performance (target: p95 < 100ms)
- Memory usage (target: < 80%)
- CPU usage (target: < 70%)

## Cost Optimization

### Documentation Hosting

**Free Tiers**:
- GitHub Pages: Free for public repos
- Netlify: 100 GB bandwidth/month free
- Vercel: 100 GB bandwidth/month free
- CloudFlare Pages: Unlimited bandwidth free

### Application Hosting

**Cost-Effective Options**:
- **Vercel**: $20/month (Pro plan)
- **DigitalOcean**: $24/month (4 GB droplet + managed database)
- **AWS**: ~$50/month (Fargate + RDS)
- **GCP**: ~$45/month (Cloud Run + Cloud SQL)
- **Self-Hosted**: $10-20/month (VPS)

**Cost Optimization Tips**:
1. Use auto-scaling to match demand
2. Enable HTTP caching with Redis
3. Use CDN for static assets
4. Right-size database instance
5. Set up billing alerts

## Next Steps

1. Choose your deployment platform
2. Review platform-specific deployment guide
3. Set up required infrastructure (database, cache)
4. Configure environment variables
5. Deploy and test
6. Set up monitoring and alerts
7. Configure automated backups
8. Document runbooks for your team

---

Ready to deploy? Start with the [Astro Deployment Guide](/deployment/astro/) or [Next.js Deployment Guide](/deployment/nextjs/).
