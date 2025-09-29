# 🚀 VibeCode Platform - Quick Start Reference

**Your platform is ready!** Use this reference for immediate deployment and common operations.

## ⚡ Instant Deployment Commands

### 🏠 Local Development (Recommended First Step)
```bash
# Deploy everything locally with KIND
./scripts/deploy-complete-platform.sh

# Expected time: 3-5 minutes
# Creates: KIND cluster + PostgreSQL + Datadog + AI Gateway + RAG
# Access: http://localhost:3000
```

### 🌐 Production Deployment
```bash
# Set your Datadog keys first
export DD_API_KEY="your-datadog-api-key"
export DD_APP_KEY="your-datadog-app-key"

# Deploy to production
./scripts/deploy-complete-platform.sh --mode production
```

### 🧪 Quick Testing (Skip Monitoring)
```bash
# Fast deployment without monitoring (30 seconds)
./scripts/deploy-complete-platform.sh --skip-monitoring
```

## 🔍 Health Checks & Validation

### After Deployment - Verify Everything Works:
```bash
# Check all pods are running
kubectl get pods -n vibecode-platform

# Test application health
curl http://localhost:3000/api/health

# Test AI functionality
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from VibeCode!"}'

# Check database monitoring
kubectl logs -n datadog -l app=datadog-agent | grep postgres
```

## 📊 Monitoring & Observability

### Key Dashboards (Datadog)
- **AI Gateway Observability** - Real-time AI service metrics
- **PostgreSQL Performance** - Database query insights
- **Application Performance** - Response times and errors
- **Infrastructure Health** - Kubernetes cluster metrics

### Quick Debug Commands
```bash
# Application logs
kubectl logs -n vibecode-platform -l app=vibecode-webgui

# Database logs
kubectl logs -n vibecode-platform -l app=postgres

# Monitoring agent status
kubectl get pods -n datadog -l app=datadog-agent
```

## 🎯 Common Operations

### Scale Your Application
```bash
# Scale to 3 replicas
kubectl scale deployment vibecode-webgui -n vibecode-platform --replicas=3

# Check scaling status
kubectl get deployment vibecode-webgui -n vibecode-platform
```

### Access Services Directly
```bash
# Port forward to access PostgreSQL
kubectl port-forward -n vibecode-platform service/postgres-service 5432:5432

# Port forward to access application
kubectl port-forward -n vibecode-platform service/vibecode-webgui 3000:3000
```

### Update Application
```bash
# Pull latest changes and redeploy
git pull origin main
kubectl rollout restart deployment/vibecode-webgui -n vibecode-platform
```

## 🔧 Specialized Deployments

### Just PostgreSQL + Monitoring
```bash
./scripts/deploy-kind-postgres-monitoring.sh
```

### Add Monitoring to Existing PostgreSQL
```bash
./scripts/setup-postgres-datadog-monitoring.sh
```

### Setup RAG Database
```bash
./scripts/setup-rag-db.sh
```

### Ingest Documents for AI
```bash
npx ts-node scripts/ingest-docs-to-rag.ts
```

## 🚨 Troubleshooting Quick Fixes

### Platform Won't Start
```bash
# Reset KIND cluster
kind delete cluster --name vibecode-dev
./scripts/deploy-complete-platform.sh
```

### Database Issues
```bash
# Check PostgreSQL status
kubectl describe pod -n vibecode-platform -l app=postgres

# Restart database
kubectl rollout restart deployment/postgres -n vibecode-platform
```

### Monitoring Not Working
```bash
# Check Datadog agent
kubectl get pods -n datadog
kubectl logs -n datadog -l app=datadog-agent

# Restart monitoring
helm upgrade datadog-agent datadog/datadog -n datadog
```

## 📚 Documentation Quick Links

- **Complete Guide**: `docs/DEPLOYMENT_GUIDE.md`
- **PostgreSQL Monitoring**: `docs/postgres-datadog-monitoring.md`
- **AI Gateway Docs**: `services/ai-gateway/README.md`
- **Runbooks**: `monitoring/runbooks/`

## 🎉 Success Indicators

After deployment, you should see:
- ✅ All pods running and ready
- ✅ Application accessible at http://localhost:3000
- ✅ Health endpoint returning 200 OK
- ✅ AI chat responding to messages
- ✅ Datadog receiving metrics and logs
- ✅ Database queries being monitored

## 🆘 Need Help?

1. **Check logs**: Use the debug commands above
2. **Consult docs**: See documentation links
3. **Reset environment**: Delete and redeploy KIND cluster
4. **Review monitoring**: Check Datadog dashboards for insights

---

**🚀 Your VibeCode platform is production-ready!**

*Deploy with confidence - everything is automated and monitored!*
