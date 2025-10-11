# Azure Deployment Setup Guide

**Status**: Workflows Fixed - Secrets Required for Activation
**Date**: 2025-10-02
**Workflows**: azure-appservice-deploy.yml, azure-webgui-deploy.yml

## Issue Resolution Summary

### Problems Fixed

1. **Missing Secret Validation**: Workflows failed when Azure secrets were not configured
2. **No Conditional Execution**: Jobs attempted to run even without required credentials
3. **Unclear Requirements**: No documentation of required secrets and setup process

### Solutions Implemented

1. **Job-Level Conditionals**: Added `if` conditions to skip jobs when secrets are missing
2. **Secret Validation Step**: Pre-flight validation to check all required secrets
3. **Inline Documentation**: Added secret requirements as comments in workflow files
4. **Setup Guide**: This comprehensive documentation for Azure configuration

## Current State

Both Azure deployment workflows are now **safe to enable** but will skip execution until secrets are configured:

- `.github/workflows/azure-appservice-deploy.yml` - AI Gateway deployment
- `.github/workflows/azure-webgui-deploy.yml` - WebGUI deployment

Workflows will gracefully skip when secrets are missing rather than failing.

## Required Secrets Configuration

### Core Authentication Secrets (OIDC)

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `AZURE_CLIENT_ID` | Azure AD application client ID | Azure Portal → App registrations → Your app → Application (client) ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Azure Portal → Azure Active Directory → Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Azure Portal → Subscriptions → Subscription ID |

### Infrastructure Secrets

| Secret | Description | Example Value |
|--------|-------------|---------------|
| `ACR_NAME` | Azure Container Registry name | `vibecodecr` |
| `AZURE_RESOURCE_GROUP` | Resource group name | `vibecode-prod-rg` |
| `APP_NAME` | App Service name (AI Gateway) | `vibecode-ai-gateway` |
| `APP_NAME_WEBGUI` | App Service name (WebGUI) | `vibecode-webgui` |

### Optional Secrets

| Secret | Description | Default |
|--------|-------------|---------|
| `GATEWAY_API_KEY` | API key for testing gateway | `vbai_dev_key_1` |

## Setup Instructions

### 1. Azure Infrastructure Prerequisites

Before configuring secrets, ensure you have:

```bash
# Azure resources created
- Azure Container Registry (ACR)
- Azure App Service (for AI Gateway)
- Azure App Service (for WebGUI)
- Azure AD App Registration with Federated Credentials

# Required Azure CLI commands (example)
az group create --name vibecode-prod-rg --location eastus
az acr create --name vibecodecr --resource-group vibecode-prod-rg --sku Standard
az appservice plan create --name vibecode-plan --resource-group vibecode-prod-rg --is-linux
az webapp create --name vibecode-ai-gateway --resource-group vibecode-prod-rg --plan vibecode-plan --deployment-container-image-name nginx
az webapp create --name vibecode-webgui --resource-group vibecode-prod-rg --plan vibecode-plan --deployment-container-image-name nginx
```

### 2. Configure OIDC Authentication

Create Azure AD application and federated credentials:

```bash
# Create app registration
az ad app create --display-name "vibecode-github-actions"

# Get the application ID (this becomes AZURE_CLIENT_ID)
APP_ID=$(az ad app list --display-name "vibecode-github-actions" --query [0].appId -o tsv)

# Create service principal
az ad sp create --id $APP_ID

# Create federated credential for GitHub Actions
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-vibecode-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:ryanmaclean/vibecode-webgui:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Assign contributor role to service principal
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID
```

### 3. Configure GitHub Secrets

Navigate to: `https://github.com/ryanmaclean/vibecode-webgui/settings/secrets/actions`

Add the following secrets:

```bash
# Authentication
AZURE_CLIENT_ID=<app-id-from-step-2>
AZURE_TENANT_ID=<tenant-id-from-azure-portal>
AZURE_SUBSCRIPTION_ID=<subscription-id-from-azure-portal>

# Infrastructure
ACR_NAME=vibecodecr
AZURE_RESOURCE_GROUP=vibecode-prod-rg
APP_NAME=vibecode-ai-gateway
APP_NAME_WEBGUI=vibecode-webgui

# Optional
GATEWAY_API_KEY=<your-secure-api-key>
```

### 4. Verify Configuration

After adding secrets, trigger a workflow manually:

```bash
# Test AI Gateway deployment
gh workflow run azure-appservice-deploy.yml

# Test WebGUI deployment
gh workflow run azure-webgui-deploy.yml

# Check workflow status
gh run list --workflow=azure-appservice-deploy.yml --limit 1
```

## Workflow Behavior

### When Secrets Are Configured

1. **Validation Step**: Checks all required secrets are present
2. **Azure Login**: Authenticates using OIDC
3. **Build & Push**: Builds Docker image and pushes to ACR
4. **Deploy**: Updates App Service with new container image
5. **Smoke Tests**: Validates deployment with health checks

### When Secrets Are Missing

1. **Graceful Skip**: Jobs skip with status "skipped" (not failed)
2. **No Error State**: Workflows complete without errors
3. **Clear Indication**: GitHub UI shows jobs were skipped due to conditions

## Troubleshooting

### Issue: Workflow Skips Despite Secrets Being Set

**Cause**: Secret values might contain only whitespace or be empty strings

**Solution**:
```bash
# Re-add secrets ensuring no trailing spaces
gh secret set AZURE_CLIENT_ID < client_id.txt
```

### Issue: Azure Login Fails with "Not all values are present"

**Cause**: One or more authentication secrets (CLIENT_ID, TENANT_ID, SUBSCRIPTION_ID) are missing

**Solution**:
```bash
# Verify all three authentication secrets are set
gh secret list | grep AZURE
```

### Issue: ACR Login Fails

**Cause**: Service principal lacks permissions on Container Registry

**Solution**:
```bash
# Grant AcrPush role to service principal
az role assignment create \
  --assignee $AZURE_CLIENT_ID \
  --role AcrPush \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME
```

### Issue: App Service Update Fails

**Cause**: Service principal lacks permissions on App Service

**Solution**:
```bash
# Grant Website Contributor role
az role assignment create \
  --assignee $AZURE_CLIENT_ID \
  --role "Website Contributor" \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP/providers/Microsoft.Web/sites/$APP_NAME
```

## Security Best Practices

1. **OIDC Over Service Principal**: Workflows use OpenID Connect (no stored credentials)
2. **Least Privilege**: Service principal should have minimal required permissions
3. **Separate Environments**: Use different credentials for staging vs production
4. **Secret Rotation**: Rotate federated credentials periodically
5. **Audit Logging**: Enable Azure Activity Log for deployment tracking

## Monitoring and Observability

### GitHub Actions Logs

Monitor deployment status:
```bash
gh run list --workflow=azure-appservice-deploy.yml
gh run view <run-id> --log
```

### Azure Monitoring

Check deployment logs:
```bash
az webapp log tail --name $APP_NAME --resource-group $AZURE_RESOURCE_GROUP
az monitor activity-log list --resource-group $AZURE_RESOURCE_GROUP --max-events 10
```

## Next Steps

1. **Configure Secrets**: Follow setup instructions to add required secrets
2. **Test Deployment**: Trigger manual workflow run to verify configuration
3. **Enable Auto-Deploy**: Workflows will automatically deploy on push to main branch
4. **Setup Monitoring**: Configure Azure Application Insights for production monitoring
5. **Implement Staging**: Create staging environment with separate secrets

## References

- [Azure Login Action Documentation](https://github.com/Azure/login)
- [Azure CLI Action Documentation](https://github.com/Azure/cli)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure OIDC Federation](https://docs.microsoft.com/en-us/azure/active-directory/develop/workload-identity-federation)
- [Azure App Service Deployment](https://docs.microsoft.com/en-us/azure/app-service/deploy-container-github-action)

## Changelog

- **2025-10-02**: Initial workflow fixes and documentation
  - Added conditional job execution
  - Implemented secret validation
  - Created comprehensive setup guide
  - Fixed deployment failures caused by missing secrets
