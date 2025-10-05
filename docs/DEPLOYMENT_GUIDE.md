# VibeCode Platform Deployment Guide

Complete guide for deploying the VibeCode platform with all components including PostgreSQL Database Monitoring, AI Gateway, and comprehensive observability.

## 🚀 Quick Start

### One-Command Deployment

```bash
# Development deployment with all components
./scripts/deploy-complete-platform.sh

# Production deployment
./scripts/deploy-complete-platform.sh --mode production

# Quick deployment without monitoring
./scripts/deploy-complete-platform.sh --skip-monitoring
```

## 📋 Prerequisites

### Required Tools
- **Docker** (20.10+)
- **kubectl** (1.24+)
- **Helm** (3.8+)
- **KIND** (0.17+ for local development)
- **Node.js** (18.0+)
- **npm** (8.0+)

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   ```

2. **Configure environment variables**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit with your values
   nano .env.local
   ```

3. **Required environment variables**
   ```bash
   # Datadog (for monitoring)
   DD_API_KEY=your-datadog-api-key
   DD_APP_KEY=your-datadog-app-key
   DD_SITE=datadoghq.com
   
   # Database
   DATABASE_PASSWORD=secure-password
   
   # Application
   NEXTAUTH_SECRET=your-nextauth-secret
   NEXTAUTH_URL=http://localhost:3000
   ```

## 🏗️ Deployment Components

### Core Platform
- **Next.js Application** - Main web interface
- **AI Gateway** - AI service orchestration
- **PostgreSQL Database** - Primary data storage with pgvector
- **Redis/Valkey** - Caching and session storage

### Monitoring Stack
- **Datadog Agent** - Metrics, logs, and traces
- **Database Monitoring** - PostgreSQL performance insights
- **AI Gateway Observability** - AI service monitoring
- **Custom Dashboards** - Platform-specific metrics

### AI Infrastructure
- **Vector Database** - Embeddings and RAG capabilities
- **MCP Servers** - Sequential thinking and filesystem access
- **Azure Cognitive Search** - Enterprise vector search (optional)
- **Document Ingestion** - RAG document processing

## 🎯 Deployment Modes

### Development Mode (Default)
```bash
./scripts/deploy-complete-platform.sh
```

**Features:**
- KIND cluster deployment
- Local PostgreSQL with monitoring
- Development-optimized resource limits
- Hot reload enabled
- Debug logging

**Access:**
- Application: http://localhost:3000
- PostgreSQL: localhost:30001
- Monitoring: Datadog dashboard

### Staging Mode
```bash
./scripts/deploy-complete-platform.sh --mode staging
```

**Features:**
- Production-like configuration
- Reduced resource allocation
- Staging environment variables
- Performance monitoring enabled

### Production Mode
```bash
./scripts/deploy-complete-platform.sh --mode production
```

**Features:**
- High availability configuration
- Production resource limits
- Security hardening
- Comprehensive monitoring
- Backup and disaster recovery

## 🔧 Individual Component Deployment

### PostgreSQL with Database Monitoring
```bash
# New KIND cluster with PostgreSQL monitoring
./scripts/deploy-kind-postgres-monitoring.sh

# Add monitoring to existing PostgreSQL
./scripts/setup-postgres-datadog-monitoring.sh
```

### Monitoring Stack
```bash
# Deploy complete monitoring
./scripts/deploy-monitoring.sh

# Database monitoring only
./scripts/deploy-datadog-dbm.sh
```

### AI Gateway
```bash
# Build and deploy AI Gateway
cd services/ai-gateway
npm ci && npm run build

# Apply monitoring
npx ts-node ../scripts/apply-ai-gateway-monitoring.ts
```

### RAG Database Setup
```bash
# Setup vector database for RAG
./scripts/setup-rag-db.sh

# Ingest documents
npx ts-node scripts/ingest-docs-to-rag.ts
```

## 📊 Monitoring and Observability

### Datadog Integration

The platform includes comprehensive Datadog monitoring:

**Database Monitoring:**
- Query performance tracking
- Schema collection
- Custom metrics for table operations
- Connection pool monitoring

**Application Monitoring:**
- APM traces for all API routes
- Custom metrics for AI operations
- Error tracking and alerting
- Performance monitoring

**Infrastructure Monitoring:**
- Kubernetes cluster metrics
- Container resource usage
- Network performance
- Storage metrics

### Key Dashboards

1. **AI Gateway Observability** - `/monitoring/datadog/dashboards/ai-gateway-observability.json`
2. **PostgreSQL Performance** - Database monitoring built-in
3. **Application Performance** - APM automatic dashboards
4. **Infrastructure Health** - Kubernetes integration

### Alerts and Runbooks

**Error Monitoring:**
- High error rate alerts
- AI service failures
- Database connection issues

**Performance Monitoring:**
- Response time degradation
- Resource utilization
- Query performance issues

**Runbooks Available:**
- `monitoring/runbooks/ai-gateway-errors.md`
- `monitoring/runbooks/ai-gateway-latency.md`

## 🔍 Validation and Testing

### Deployment Validation
```bash
# Check all pods are running
kubectl get pods -n vibecode-platform

# Verify services
kubectl get services -n vibecode-platform

# Run health checks
curl http://localhost:3000/api/health
```

### Database Validation
```bash
# Test monitoring user
kubectl exec -n vibecode-platform deployment/postgres -- \
  psql -U datadog -d vibecode -c "SELECT * FROM datadog_monitoring_health();"

# Check database metrics
kubectl logs -n datadog -l app=datadog-agent | grep postgres
```

### AI Gateway Validation
```bash
# Test AI endpoints
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test AI functionality"}'

# Check AI Gateway logs
kubectl logs -n vibecode-platform -l app=ai-gateway
```

## 🚨 Troubleshooting

### Common Issues

**1. KIND Cluster Issues**
```bash
# Reset KIND cluster
kind delete cluster --name vibecode-dev
./scripts/deploy-complete-platform.sh
```

**2. PostgreSQL Connection Issues**
```bash
# Check PostgreSQL pod
kubectl get pods -n vibecode-platform -l app=postgres

# Check logs
kubectl logs -n vibecode-platform -l app=postgres

# Port forward for direct access
kubectl port-forward -n vibecode-platform service/postgres-service 5432:5432
```

**3. Datadog Agent Issues**
```bash
# Check agent status
kubectl get pods -n datadog -l app=datadog-agent

# Verify configuration
kubectl logs -n datadog -l app=datadog-agent | grep -i error

# Restart agent
kubectl rollout restart daemonset/datadog-agent -n datadog
```

**4. Application Startup Issues**
```bash
# Check application logs
kubectl logs -n vibecode-platform -l app=vibecode-webgui

# Check resource constraints
kubectl describe pods -n vibecode-platform -l app=vibecode-webgui

# Scale up resources
kubectl patch deployment vibecode-webgui -n vibecode-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"vibecode-webgui","resources":{"limits":{"memory":"2Gi","cpu":"1000m"}}}]}}}}'
```

### Debug Commands

```bash
# Get all resources
kubectl get all -n vibecode-platform

# Describe problematic pods
kubectl describe pod POD_NAME -n vibecode-platform

# Check events
kubectl get events -n vibecode-platform --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n vibecode-platform
kubectl top nodes
```

## 🔄 Maintenance and Updates

### Regular Maintenance
```bash
# Update dependencies
npm update
cd services/ai-gateway && npm update

# Update Helm charts
helm repo update
helm upgrade datadog-agent datadog/datadog -n datadog

# Clean up unused resources
docker system prune -f
kubectl delete pods --field-selector=status.phase=Succeeded -n vibecode-platform
```

### Scaling Operations
```bash
# Scale application
kubectl scale deployment vibecode-webgui -n vibecode-platform --replicas=3

# Scale AI Gateway
kubectl scale deployment ai-gateway -n vibecode-platform --replicas=2

# Update resource limits
kubectl patch deployment vibecode-webgui -n vibecode-platform -p '{"spec":{"template":{"spec":{"containers":[{"name":"vibecode-webgui","resources":{"requests":{"memory":"512Mi","cpu":"250m"},"limits":{"memory":"1Gi","cpu":"500m"}}}]}}}}'
```

### Backup and Recovery
```bash
# Backup PostgreSQL
kubectl exec -n vibecode-platform deployment/postgres -- \
  pg_dump -U vibecode vibecode > backup-$(date +%Y%m%d).sql

# Backup configuration
kubectl get configmaps -n vibecode-platform -o yaml > configmaps-backup.yaml
kubectl get secrets -n vibecode-platform -o yaml > secrets-backup.yaml
```

## 📚 Additional Resources

- [PostgreSQL Database Monitoring Guide](postgres-datadog-monitoring.md)
- [AI Gateway Documentation](../services/ai-gateway/README.md)
- [Monitoring Runbooks](../monitoring/runbooks/)
- [ADR: Metrics Tag Policy](../docs/ADR/metrics-tag-policy.md)

## 🆘 Support

For deployment issues:

1. Check the troubleshooting section above
2. Review logs using the debug commands
3. Consult the monitoring dashboards for system health
4. Check GitHub issues for known problems

## 🎉 Success Checklist

After deployment, verify:

- [ ] All pods are running and ready
- [ ] Application accessible at configured URL
- [ ] Database connections working
- [ ] Monitoring data flowing to Datadog
- [ ] AI Gateway responding to requests
- [ ] Health checks passing
- [ ] Logs being collected properly

Your VibeCode platform is now ready for use! 🚀
