# GitHub Environments Configuration Guide

This document explains how to configure GitHub environments (staging and production) for the VibeCode WebGUI project to enable secure, gated deployments with environment-specific secrets.

## Overview

The project uses GitHub environments to:
- **Gate production deployments** with required reviewers
- **Scope secrets** to specific environments 
- **Control access** to sensitive deployment resources
- **Track deployment history** and approvals

## Environments

### Staging Environment
- **Name**: `staging`
- **Deployment URL**: `https://vibecode-webgui-staging.yourdomain.com`
- **Deployment branches**: `develop` branch
- **Protection rules**: None (automatic deployment)
- **Used for**: Feature testing, integration testing, pre-production validation

### Production Environment  
- **Name**: `production`
- **Deployment URL**: `https://vibecode-webgui.yourdomain.com`
- **Deployment branches**: `main` branch
- **Protection rules**: Required reviewers, manual approval required
- **Used for**: Production deployments, customer-facing application

## Setting Up GitHub Environments

### 1. Create Environments

Go to your repository → Settings → Environments → New environment

Create two environments:
- `staging`
- `production`

### 2. Configure Protection Rules

#### Production Environment Protection Rules
1. **Required reviewers**: Add team leads or senior developers
   - Minimum 1-2 reviewers required
   - Select specific users or teams who can approve production deployments
2. **Deployment branches**: Restrict to `main` branch only
3. **Environment secrets**: Configure production-specific secrets (see below)

#### Staging Environment Protection Rules  
1. **Required reviewers**: None (allows automatic deployment)
2. **Deployment branches**: Allow `develop` and `main` branches
3. **Environment secrets**: Configure staging-specific secrets (see below)

### 3. Environment-Specific Secrets

Move deployment secrets from repository level to environment level for better security isolation:

#### Staging Environment Secrets
```
DATABASE_PASSWORD - Staging database password
NEXTAUTH_SECRET - NextAuth secret for staging
KUBECONFIG - Kubernetes config for staging cluster  
APP_NAME_WEBGUI - Azure App Service name for staging
DD_API_KEY - Datadog API key
DD_APP_KEY - Datadog Application key
AZURE_CLIENT_ID - Azure service principal client ID
AZURE_TENANT_ID - Azure tenant ID  
AZURE_SUBSCRIPTION_ID - Azure subscription ID
ACR_NAME - Azure Container Registry name
AZURE_RESOURCE_GROUP - Azure resource group name
```

#### Production Environment Secrets
```
DATABASE_PASSWORD - Production database password  
NEXTAUTH_SECRET - NextAuth secret for production
KUBECONFIG - Kubernetes config for production cluster
APP_NAME_WEBGUI - Azure App Service name for production
DD_API_KEY - Datadog API key
DD_APP_KEY - Datadog Application key
AZURE_CLIENT_ID - Azure service principal client ID
AZURE_TENANT_ID - Azure tenant ID
AZURE_SUBSCRIPTION_ID - Azure subscription ID  
ACR_NAME - Azure Container Registry name
AZURE_RESOURCE_GROUP - Azure resource group name
```

#### Shared Repository Secrets (Non-Environment Specific)
```
OPENAI_API_KEY - OpenAI API key (shared across environments)
ANTHROPIC_API_KEY - Anthropic API key (shared across environments)
SNYK_TOKEN - Snyk security scanning token
GITHUB_TOKEN - Automatically provided by GitHub
```

## Workflow Configuration

### GitOps Deployment Workflow

The `gitops-deployment.yml` workflow uses environments as follows:

1. **Staging Deployment**
   - Triggered by pushes to `develop` branch
   - Uses `environment: staging` 
   - No approval required
   - Accesses staging-scoped secrets

2. **Production Deployment**
   - Triggered by pushes to `main` branch  
   - Uses `environment: production`
   - **Requires manual approval** from configured reviewers
   - Accesses production-scoped secrets

### Azure WebGUI Deployment Workflow

The `azure-webgui-deploy.yml` workflow:
- Supports both staging and production environments
- Environment determined by branch (`main` → production, `develop` → staging)
- Can be manually triggered with environment selection
- Uses environment-specific secrets and app names

## Deployment Process

### Staging Deployment
1. Create pull request against `develop` branch
2. After PR approval, merge triggers automatic staging deployment
3. No additional approvals required
4. Deployment uses staging environment secrets

### Production Deployment  
1. Create pull request against `main` branch
2. After PR approval and merge, production deployment **waits for approval**
3. **Designated reviewers must manually approve** the deployment
4. After approval, deployment proceeds using production environment secrets

## Security Benefits

1. **Secret Isolation**: Staging and production secrets are completely isolated
2. **Access Control**: Only authorized users can approve production deployments  
3. **Audit Trail**: All deployments and approvals are logged and trackable
4. **Blast Radius Limitation**: Issues in staging don't affect production secrets
5. **Principle of Least Privilege**: Each environment only has access to its own secrets

## Troubleshooting

### Common Issues

1. **Deployment waiting for approval**: Check if you have the required reviewer permissions
2. **Secret not found**: Ensure secrets are configured in the correct environment, not at repository level
3. **Wrong environment deployed to**: Check branch name and environment mapping logic

### Verifying Environment Configuration

1. Go to repository → Settings → Environments
2. Verify each environment has the required secrets configured
3. Check protection rules are properly set
4. Review deployment history for each environment

## Migration Checklist

- [x] Update workflows to use `environment:` configuration  
- [x] Move environment-specific secrets from repository to environment scope
- [x] Configure protection rules for production environment
- [x] Add required reviewers for production deployments
- [x] Test staging deployment (should be automatic)
- [x] Test production deployment (should require approval)
- [x] Update documentation

## Required Reviewers Setup

To set up required reviewers for production:

1. Go to repository → Settings → Environments → production
2. Check "Required reviewers"
3. Add users/teams who should approve production deployments:
   - Repository maintainers
   - Senior developers
   - DevOps team members
   - Product owners
4. Set minimum required reviewers (recommended: 1-2)

## Deployment URLs

After successful deployment, the environments will be accessible at:
- **Staging**: https://vibecode-webgui-staging.yourdomain.com
- **Production**: https://vibecode-webgui.yourdomain.com

(URLs should be updated to match your actual deployment endpoints)