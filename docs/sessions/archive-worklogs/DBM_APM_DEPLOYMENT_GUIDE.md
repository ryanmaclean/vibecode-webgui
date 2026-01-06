# DBM-APM Deployment Guide

This guide provides step-by-step instructions for deploying the Datadog DBM-APM connection configuration to all environments: KIND (local development), Azure Staging, and Azure Production.

## 🎯 Overview

The DBM-APM connection enables:
- **Service Attribution**: Database connections attributed to calling APM services
- **Query Filtering**: Filter database hosts by APM services
- **Trace Correlation**: View associated traces for query samples
- **Performance Insights**: Correlate explain plans with APM traces
- **Service Visualization**: See downstream database dependencies in APM

## 📋 Prerequisites

### Required Tools
- **Docker** - For local development
- **KIND** - Kubernetes in Docker for local clusters
- **kubectl** - Kubernetes command-line tool
- **Azure CLI** - For Azure deployments
- **jq** - JSON processor (for Azure scripts)

### Required Access
- **Datadog API Key** - For monitoring configuration
- **Azure Subscription** - For staging and production deployments
- **KIND Cluster** - For local development

## 🔧 Environment Setup

### 1. Create Environment File

Create `.env.local` with your configuration:

```bash
# Copy from example
cp env.development.example .env.local

# Edit with your values
nano .env.local
```

**Required Variables:**
```bash
# Datadog Configuration
DD_API_KEY=your-datadog-api-key-here
DD_SITE=datadoghq.com
DD_SERVICE=vibecode-webgui
DD_ENV=development
DD_VERSION=0.1.0-dev
DD_DBM_PROPAGATION_MODE=full

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/vibecode
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=vibecode
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Application Configuration
NODE_ENV=development
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# AI Service Configuration (Optional)
OPENROUTER_API_KEY=your-openrouter-api-key-here
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=VibeCode Development

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### 2. Validate Configuration

```bash
# Run validation script
npm run validate:dbm-apm

# Or directly
./scripts/validate-dbm-apm-connection.sh
```

## 🚀 Deployment Options

### Option 1: Deploy to All Environments

```bash
# Deploy to KIND, Staging, and Production
npm run deploy:dbm-apm:all

# Or directly
./scripts/deploy-dbm-apm-all.sh
```

### Option 2: Deploy to Specific Environment

#### KIND Local Development
```bash
# Deploy to KIND only
npm run deploy:dbm-apm:kind

# Or directly
./scripts/deploy-dbm-apm-kind.sh
```

#### Azure Staging
```bash
# Deploy to staging only
npm run deploy:dbm-apm:azure staging

# Or directly
./scripts/deploy-dbm-apm-azure.sh staging
```

#### Azure Production
```bash
# Deploy to production only
npm run deploy:dbm-apm:azure production

# Or directly
./scripts/deploy-dbm-apm-azure.sh production
```

### Option 3: Dry Run Mode

```bash
# Show what would be deployed without executing
./scripts/deploy-dbm-apm-all.sh all --dry-run
```

## 🔍 Environment-Specific Details

### KIND Local Development

**What Gets Deployed:**
- Datadog Agent with DBM-APM configuration
- VibeCode application with DBM propagation
- PostgreSQL database monitoring
- Redis monitoring

**Access Points:**
- Application: http://localhost:3000 (via port-forward)
- Ingress: http://vibecode.local (add to /etc/hosts)
- Datadog: https://app.datadoghq.com/

**Port Forward Commands:**
```bash
# Application
kubectl port-forward -n vibecode-platform svc/vibecode-webgui-service 3000:80

# Check pods
kubectl get pods -n vibecode-platform
```

### Azure Staging

**What Gets Deployed:**
- App Service environment variables
- DBM-APM configuration
- 50% trace sampling for testing

**Configuration:**
- Environment: `staging`
- Version: `0.1.0-staging`
- Trace Sample Rate: `0.5`
- Resource Group: `rg-vibecode-appservice-staging`
- App Service: `vibecode-webgui-staging`

**Access:**
- URL: https://vibecode-webgui-staging.azurewebsites.net
- Logs: `az webapp log tail --name vibecode-webgui-staging --resource-group rg-vibecode-appservice-staging`

### Azure Production

**What Gets Deployed:**
- App Service environment variables
- DBM-APM configuration
- 10% trace sampling for performance
- Enhanced security settings

**Configuration:**
- Environment: `production`
- Version: `1.0.0`
- Trace Sample Rate: `0.1`
- Resource Group: `rg-vibecode-appservice-prod`
- App Service: `vibecode-webgui-prod`

**Access:**
- URL: https://vibecode-webgui-prod.azurewebsites.net
- Logs: `az webapp log tail --name vibecode-webgui-prod --resource-group rg-vibecode-appservice-prod`

## 🔧 Manual Configuration

### KIND Manual Setup

If automated deployment fails, you can manually configure KIND:

```bash
# Create namespace
kubectl create namespace vibecode-platform

# Create Datadog secret
kubectl create secret generic datadog-secret \
  --from-literal=api-key="$DD_API_KEY" \
  --from-literal=site="${DD_SITE:-datadoghq.com}" \
  --namespace=vibecode-platform

# Apply Datadog agent
kubectl apply -f k8s/datadog-values.yaml

# Apply application
kubectl apply -f k8s/vibecode-deployment.yaml
```

### Azure Manual Setup

If automated deployment fails, you can manually configure Azure App Service:

```bash
# Update staging App Service
az webapp config appsettings set \
  --name vibecode-webgui-staging \
  --resource-group rg-vibecode-appservice-staging \
  --settings \
    "DD_DBM_PROPAGATION_MODE=full" \
    "DD_DBM_TRACE_INJECTION=true" \
    "DD_SERVICE=vibecode-webgui" \
    "DD_ENV=staging" \
    "DD_VERSION=0.1.0-staging"

# Update production App Service
az webapp config appsettings set \
  --name vibecode-webgui-prod \
  --resource-group rg-vibecode-appservice-prod \
  --settings \
    "DD_DBM_PROPAGATION_MODE=full" \
    "DD_DBM_TRACE_INJECTION=true" \
    "DD_SERVICE=vibecode-webgui" \
    "DD_ENV=production" \
    "DD_VERSION=1.0.0"

# Restart services
az webapp restart --name vibecode-webgui-staging --resource-group rg-vibecode-appservice-staging
az webapp restart --name vibecode-webgui-prod --resource-group rg-vibecode-appservice-prod
```

## ✅ Validation and Testing

### 1. Validate DBM-APM Connection

```bash
# Run comprehensive validation
npm run validate:dbm-apm

# Check specific environment
./scripts/validate-dbm-apm-connection.sh
```

### 2. Test Database Connectivity

```bash
# KIND
kubectl exec -n vibecode-platform deployment/vibecode-webgui -- psql $DATABASE_URL -c "SELECT version();"

# Azure Staging
az webapp ssh --name vibecode-webgui-staging --resource-group rg-vibecode-appservice-staging

# Azure Production
az webapp ssh --name vibecode-webgui-prod --resource-group rg-vibecode-appservice-prod
```

### 3. Check Datadog Integration

```bash
# Validate API key
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DD_API_KEY"

# Check service in Datadog
# Visit: https://app.datadoghq.com/apm/services
```

### 4. Monitor DBM-APM Connection

**In Datadog Dashboard:**
1. Go to **APM** → **Services**
2. Select your service (`vibecode-webgui`)
3. Check **Database** tab for connected databases
4. Go to **Database Monitoring** → **Databases**
5. Verify APM service attribution

## 🚨 Troubleshooting

### Common Issues

#### 1. KIND Deployment Fails
```bash
# Check KIND cluster status
kind get clusters
kubectl cluster-info

# Check Docker
docker ps
docker info

# Restart KIND cluster
kind delete cluster --name vibecode-local
./scripts/setup-kind-cluster.sh
```

#### 2. Azure Deployment Fails
```bash
# Check Azure login
az account show

# Check resource groups
az group list --query "[].name" -o table

# Check App Services
az webapp list --query "[].name" -o table
```

#### 3. DBM Propagation Not Working
```bash
# Check environment variables
kubectl exec -n vibecode-platform deployment/vibecode-webgui -- env | grep DD_

# Check Datadog agent logs
kubectl logs -n vibecode-platform daemonset/datadog-agent -f

# Check application logs
kubectl logs -n vibecode-platform deployment/vibecode-webgui -f
```

#### 4. Missing Traces in Datadog
- Verify `DD_API_KEY` is correct
- Check `DD_SITE` matches your Datadog region
- Ensure `DD_TRACE_ENABLED=true`
- Verify sampling rates are appropriate

### Debug Commands

```bash
# KIND Debug
kubectl get pods -n vibecode-platform
kubectl describe pod <pod-name> -n vibecode-platform
kubectl logs <pod-name> -n vibecode-platform -f

# Azure Debug
az webapp config appsettings list --name <app-name> --resource-group <rg-name>
az webapp log tail --name <app-name> --resource-group <rg-name>
az webapp show --name <app-name> --resource-group <rg-name>
```

## 📊 Monitoring and Alerts

### Key Metrics to Monitor

- **Database Connection Counts** by APM service
- **Query Performance** by APM service
- **Trace Sampling Rates**
- **DBM Propagation Success Rates**

### Recommended Alerts

- High database connection counts
- Slow query performance
- Missing DBM traces
- APM service errors

### Datadog Dashboard

Access your monitoring at:
- **APM Services**: https://app.datadoghq.com/apm/services
- **Database Monitoring**: https://app.datadoghq.com/databases
- **Infrastructure**: https://app.datadoghq.com/infrastructure

## 🔄 Maintenance

### Regular Tasks

1. **Monitor Performance**: Check for any performance impacts
2. **Review Sampling Rates**: Adjust based on traffic patterns
3. **Update Dependencies**: Keep Datadog agents updated
4. **Rotate API Keys**: Regularly rotate Datadog API keys
5. **Review Logs**: Check for errors or warnings

### Updates

To update DBM-APM configuration:

```bash
# Update environment variables in .env.local
# Then redeploy
npm run deploy:dbm-apm:all
```

## 📚 Additional Resources

- **DBM-APM Connection Guide**: `DATADOG_DBM_APM_CONNECTION_GUIDE.md`
- **Validation Script**: `scripts/validate-dbm-apm-connection.sh`
- **Datadog Documentation**: https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/
- **Environment Examples**: `env.development.example`, `env.staging.example`, `env.production.example`

## 🆘 Support

If you encounter issues:

1. **Check Logs**: Review application and Datadog agent logs
2. **Validate Configuration**: Run validation scripts
3. **Check Documentation**: Refer to Datadog documentation
4. **Test Connectivity**: Verify database and API connectivity
5. **Review Environment**: Ensure all required variables are set

For additional help, refer to the troubleshooting section above or check the Datadog support documentation.
