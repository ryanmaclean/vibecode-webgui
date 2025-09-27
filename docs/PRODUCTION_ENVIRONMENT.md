# Production Environment Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables Validation
```bash
# Validate all required variables are set
npm run env:validate

# Check health endpoint
curl https://your-domain.com/api/health/environment
```

### 2. Required Production Variables

#### 🔐 Authentication (Critical)
```env
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=secure-random-string-min-32-chars
```

#### 🗃️ Database (Critical)
```env
DATABASE_URL=postgresql://user:pass@prod-db:5432/vibecode_prod
VALKEY_URL=redis://prod-redis:6379
```

#### 🤖 AI Services (Critical)
```env
OPENROUTER_API_KEY=sk-or-v1-your-production-key
```

#### 📊 Monitoring (Critical)
```env
DD_API_KEY=your-production-datadog-key
DD_APP_KEY=your-production-datadog-app-key
DD_SITE=datadoghq.com
DD_ENV=production
```

### 3. Environment-Specific Configuration

#### Production Settings
```env
NODE_ENV=production
ENABLE_DEBUG_LOGGING=false
NEXT_PUBLIC_ENABLE_RUM_IN_DEV=false
```

#### Security Headers
```env
JWT_SECRET=production-jwt-secret-min-32-chars
SESSION_SECRET=production-session-secret
```

## Deployment Validation

### 1. Automated Validation
Add to your CI/CD pipeline:

```bash
# Build with environment validation
npm run build

# Run production environment tests  
npm run test:production:smoke
```

### 2. Post-Deployment Health Checks

```bash
# Environment health
curl https://your-domain.com/api/health/environment

# Database connectivity
curl https://your-domain.com/api/health/environment?connections=true

# Monitoring dashboard
curl https://your-domain.com/api/monitoring/health
```

### 3. Manual Verification

1. **Authentication**: Test login functionality
2. **AI Services**: Verify AI chat/generation works
3. **Database**: Check user data persistence
4. **Cache**: Verify response caching
5. **Monitoring**: Check Datadog dashboard

## Platform-Specific Guides

### Vercel Deployment

1. **Set environment variables in Vercel dashboard**
2. **Use the deployment script:**
   ```bash
   scripts/production-deploy.sh vercel
   ```

### Azure Container Apps

1. **Configure environment variables in ARM template**
2. **Use Azure deployment:**
   ```bash
   scripts/production-deploy.sh azure
   ```

### Kubernetes

1. **Create secrets:**
   ```yaml
   # k8s/secrets.yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: vibecode-secrets
   data:
     nextauth-secret: <base64-encoded>
     database-url: <base64-encoded>
     dd-api-key: <base64-encoded>
   ```

2. **Deploy with validation:**
   ```bash
   npm run test:k8s
   kubectl apply -f k8s/
   ```

## Monitoring and Alerting

### Critical Alerts

Set up alerts for:
- Environment validation failures
- Database connection errors  
- High error rates
- AI service failures

### Datadog Dashboard

Key metrics to monitor:
- Environment health status
- Database connection pool usage
- AI request success rate
- Application performance metrics

## Troubleshooting

### Common Production Issues

**Environment validation fails:**
```bash
# Check missing variables
npm run env:check

# Verify secrets are properly set
printenv | grep -E "(NEXTAUTH|DATABASE|DD_)"
```

**Database connection issues:**
```bash
# Test database connectivity
npm run db:test

# Check connection pool status
curl https://your-domain.com/api/monitoring/db-status
```

**AI services not working:**
```bash
# Verify API keys
npm run test:ai-providers

# Check service health  
curl https://your-domain.com/api/health/ai
```

## Security Considerations

### Environment Variables Security

1. **Never commit production secrets**
2. **Use different keys for each environment**
3. **Rotate keys regularly**
4. **Use secure secret management (Azure Key Vault, AWS Secrets Manager, etc.)**

### Validation in Production

- Environment validation runs at startup
- Invalid configuration prevents application start
- Health endpoints provide monitoring integration
- Automatic alerts on configuration drift

## Rollback Plan

If deployment fails due to environment issues:

1. **Immediate rollback:**
   ```bash
   # Revert to previous deployment
   vercel rollback  # or platform-specific command
   ```

2. **Fix environment issues:**
   ```bash
   # Validate locally
   npm run env:validate
   
   # Test configuration
   npm run test:integration
   ```

3. **Redeploy with fixes:**
   ```bash
   # Deploy with validation
   npm run deploy:production
   ```