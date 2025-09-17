---
title: Kubernetes Secrets Setup Guide
description: Complete guide for setting up Kubernetes secrets for VibeCode deployment
---

# Kubernetes Secrets Setup Guide

This guide explains how to properly configure the Kubernetes secrets for external deployment of VibeCode.

## ⚠️ SECURITY WARNING

The current secret files (`vibecode-secrets.yaml` and `oauth-secrets.yaml`) contain **PLACEHOLDER VALUES** that must be replaced before deploying to any external environment.

## Required Secret Replacements

### 1. OAuth Secrets (`k8s/oauth-secrets.yaml`)

Replace these base64-encoded placeholder values:

```yaml
# Current placeholders (all decode to "changeme"):
GITHUB_ID: Y2hhbmdlbWU=          # changeme
GITHUB_SECRET: Y2hhbmdlbWU=     # changeme
GOOGLE_ID: Y2hhbmdlbWU=         # changeme
GOOGLE_SECRET: Y2hhbmdlbWU=     # changeme
NEXTAUTH_SECRET: Y2hhbmdlbWU=   # changeme
```

**How to replace:**
1. Get actual OAuth credentials from GitHub and Google developer consoles
2. Generate a secure NextAuth secret: `openssl rand -base64 32`
3. Base64 encode each value: `echo "your-actual-secret" | base64`
4. Replace the placeholder values in the YAML file

### 2. VibeCode Application Secrets (`k8s/vibecode-secrets.yaml`)

Replace these values:

```yaml
# Placeholder/development values that need replacement:
ADMIN_EMAIL: admin@vibecode.dev           # Use real admin email
ADMIN_PASSWORD: admin123                  # Use secure password
NEXTAUTH_SECRET: [encoded placeholder]    # Must match oauth-secrets
DD_API_KEY: [encoded placeholder]         # Real Datadog API key
OPENROUTER_API_KEY: [encoded placeholder] # Real OpenRouter API key
NEXT_PUBLIC_DD_APPLICATION_ID: dmlibQ==   # Real Datadog app ID (currently "vibm")
NEXT_PUBLIC_DD_CLIENT_TOKEN: [encoded]    # Real Datadog client token
```

## Security Best Practices

1. **Never commit real secrets to version control**
2. **Use environment-specific secret management** (e.g., Kubernetes secrets, HashiCorp Vault)
3. **Rotate secrets regularly**
4. **Use minimal required permissions** for service accounts
5. **Audit secret access** in production environments

## Template Files

Template versions with clear placeholders are available:
- `k8s/templates/vibecode-secrets.template.yaml`
- `k8s/templates/oauth-secrets.template.yaml`

## Validation

After replacing secrets, validate the deployment:

```bash
# Check secret creation
kubectl get secrets -n vibecode-platform

# Validate service health
kubectl port-forward svc/vibecode-service 3000:3000 -n vibecode-platform
curl -H "User-Agent: Mozilla/5.0" http://localhost:3000/api/health/simple
```

## For Development/Testing

For local development or testing environments, you can use the placeholder values, but they should **NEVER** be used in production or shared externally.