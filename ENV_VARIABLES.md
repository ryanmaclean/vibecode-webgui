# Environment Variables Configuration Guide

This document provides a comprehensive guide to all environment variables required for the VibeCode WebGUI platform across different environments.

## 🔑 Authentication Variables

### Required for Production
```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-secret-key-min-32-chars

# OAuth Providers
GITHUB_ID=your-github-oauth-app-id
GITHUB_SECRET=your-github-oauth-app-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### Development Only
```bash
# Development test credentials are hardcoded in src/lib/auth.ts
# See DEVELOPMENT_CREDENTIALS.md for complete list of test users
# These credentials are automatically disabled in production
```

## 🗃️ Database Configuration

### Required for All Environments
```bash
# PostgreSQL Database
DATABASE_URL=postgresql://username:password@host:port/database

# Redis Cache
REDIS_URL=redis://host:port
```

### Examples by Environment
```bash
# Local Development
DATABASE_URL=postgresql://vibecode:vibecode@localhost:5432/vibecode
REDIS_URL=redis://localhost:6379

# KIND Cluster
DATABASE_URL=postgresql://vibecode:vibecode@postgres-service:5432/vibecode
REDIS_URL=redis://redis-service:6379

# Production
DATABASE_URL=postgresql://username:password@prod-db-host:5432/vibecode_prod
REDIS_URL=redis://prod-redis-host:6379
```

## 🤖 AI Integration

### Required for All Environments
```bash
# OpenRouter API for AI Models
OPENROUTER_API_KEY=OPENROUTER_API_KEY_REMOVED
```

## 📊 Monitoring & Observability

### Datadog Integration
```bash
# Backend Monitoring
DATADOG_API_KEY=your-datadog-api-key
DD_API_KEY=your-datadog-api-key  # Alternative format
DATADOG_SITE=datadoghq.com

# Frontend RUM Monitoring (Public variables)
NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID=your-app-id
NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN=your-client-token
NEXT_PUBLIC_DATADOG_SITE=datadoghq.com
```

### Optional Monitoring Integrations
```bash
# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url

# Email Notifications
SENDGRID_API_KEY=your-sendgrid-api-key

# PagerDuty Alerts
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
```

## 🏗️ Application Configuration

### Required for All Environments
```bash
# Application Environment
NODE_ENV=development|production|test

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

## 🔐 Security & Secrets

### Kubernetes Secrets Structure
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: vibecode-secrets
  namespace: vibecode
type: Opaque
data:
  # Base64 encoded values
  NEXTAUTH_SECRET: <base64-encoded-secret>
  GITHUB_SECRET: <base64-encoded-github-secret>
  GOOGLE_CLIENT_SECRET: <base64-encoded-google-secret>
  DATADOG_API_KEY: <base64-encoded-datadog-key>
  OPENROUTER_API_KEY: <base64-encoded-openrouter-key>
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
```

## 📋 Environment Variable Checklist

### Local Development (.env.local)
- [ ] NEXTAUTH_URL
- [ ] NEXTAUTH_SECRET
- [ ] OPENROUTER_API_KEY
- [ ] DATABASE_URL
- [ ] REDIS_URL
- [ ] DATADOG_API_KEY
- [ ] ADMIN_EMAIL (dev only)
- [ ] ADMIN_PASSWORD (dev only)

### KIND Cluster
- [ ] All local variables above
- [ ] Kubernetes secrets properly mounted
- [ ] Service discovery URLs (postgres-service, redis-service)

### Production Deployment
- [ ] All authentication variables
- [ ] Production database URLs
- [ ] Real OAuth app credentials
- [ ] Datadog production keys
- [ ] Monitoring webhooks/integrations
- [ ] No development-only variables

## 🚨 Security Best Practices

1. **Never commit real secrets to version control**
2. **Use placeholder values in .env.example files**
3. **Rotate secrets regularly in production**
4. **Use different secrets for each environment**
5. **Monitor for exposed secrets in logs/errors**
6. **Use Kubernetes secrets for cluster deployments**
7. **Validate all required variables at startup**

## 🔧 Environment Validation

Add this to your startup script to validate required variables:

```typescript
const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'OPENROUTER_API_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'DATADOG_API_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}
```

## 📁 File Structure

```
/
├── .env.local              # Local development (gitignored)
├── .env.example            # Template with placeholder values
├── k8s/vibecode-secrets.yaml  # Kubernetes secrets
├── ENV_VARIABLES.md        # This documentation
└── scripts/
    └── validate-env.js     # Environment validation script
```

## 🐛 Troubleshooting

### Common 401/403 Errors
1. **Missing NEXTAUTH_SECRET**: Required for JWT signing
2. **Incorrect NEXTAUTH_URL**: Must match your domain
3. **Database connection issues**: Check DATABASE_URL format
4. **OAuth misconfiguration**: Verify client IDs and secrets

### Authentication Flow Issues
1. Check OAuth app redirect URLs match NEXTAUTH_URL
2. Verify admin credentials in development
3. Ensure session strategy is properly configured
4. Check cookie settings for HTTPS in production

### Monitoring Issues
1. Verify DATADOG_API_KEY is valid
2. Check RUM client token permissions
3. Ensure monitoring endpoints are accessible
4. Validate environment variable naming consistency

---

**Last Updated**: July 16, 2025  
**Next Review**: After production deployment  
**Owner**: Platform Team