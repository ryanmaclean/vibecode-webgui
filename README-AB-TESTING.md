# A/B Testing Framework: AKS vs Azure Functions

This comprehensive A/B testing framework compares the performance, cost, and operational characteristics of our documentation search system deployed on AKS (dev environment) versus Azure Functions (staging environment).

## 🎯 **Overview**

The framework provides:
- ✅ **Performance Comparison**: Response times, throughput, cold starts
- ✅ **Cost Analysis**: Real-world cost comparison with 85-90% savings potential
- ✅ **Rollback Capabilities**: Automated rollback procedures for both deployment types
- ✅ **Health Monitoring**: Continuous monitoring with auto-recovery
- ✅ **Comprehensive Reporting**: Detailed analysis and recommendations

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    A/B Testing Framework                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐              ┌─────────────────────┐   │
│  │   AKS (Dev)     │              │ Azure Functions     │   │
│  │                 │              │   (Staging)         │   │
│  │ ┌─────────────┐ │    vs        │ ┌─────────────────┐ │   │
│  │ │ Next.js App │ │              │ │ SearchFunction  │ │   │
│  │ │ (Always On) │ │              │ │ (Serverless)    │ │   │
│  │ └─────────────┘ │              │ └─────────────────┘ │   │
│  │                 │              │                     │   │
│  │ Cost: $650-1300 │              │ Cost: $30-80        │   │
│  │ Response: ~200ms│              │ Response: ~500ms    │   │
│  │ Cold Start: None│              │ Cold Start: 2-5s    │   │
│  └─────────────────┘              └─────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Performance Metrics                        │ │
│  │ • Response Time  • Success Rate  • Concurrent Load     │ │
│  │ • Cold Starts    • Cost Analysis • Rollback Testing    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 **Quick Start**

### **1. Deploy Comparison Environments**

```bash
# Deploy both AKS (dev) and Azure Functions (staging)
npm run deploy:comparison

# Or manually:
./scripts/deploy-comparison-environments.sh
```

### **2. Run A/B Testing Suite**

```bash
# Full A/B test with all features
npm run test:ab-compare

# Or with custom options:
npx tsx tests/performance/run-ab-test.ts --monitor=30 --auto-rollback

# Quick performance comparison only:
npx tsx tests/performance/run-ab-test.ts --no-rollback --no-report
```

### **3. View Results**

Results are saved to `tests/performance/results/`:
- `ab-test-report-[timestamp].json` - Complete test data
- `ab-test-summary-[timestamp].csv` - Summary for analysis
- `ab-test-final-report.md` - Executive summary

## 📊 **Test Categories**

### **Performance Tests**
- **Basic Search**: Standard documentation queries
- **Cold Start Performance**: Function startup times
- **Concurrent Load**: Multiple simultaneous requests
- **Response Time Analysis**: Detailed latency measurements

### **Rollback Tests**
- **Rollback Readiness**: Validate rollback procedures
- **Simulated Failure**: Test recovery capabilities
- **Health Monitoring**: Continuous availability checks
- **Auto-Recovery**: Automated rollback on failure

### **Cost Analysis**
- **Resource Utilization**: Actual usage patterns
- **Monthly Cost Projection**: Based on real metrics
- **TCO Comparison**: Total cost of ownership analysis

## 🔧 **Configuration Options**

### **Command Line Arguments**

```bash
# Skip performance tests
--no-performance

# Skip rollback tests  
--no-rollback

# Enable automatic rollback on failure
--auto-rollback

# Set monitoring duration (minutes)
--monitor=30

# Skip report generation
--no-report
```

### **Environment Variables**

Create `.env.ab-testing` file:

```bash
# AKS Environment (Dev)
AKS_BASE_URL=http://localhost:3000
AKS_VERSION=current

# Azure Functions Environment (Staging)  
FUNCTIONS_BASE_URL=https://vibecode-docs-search-staging.azurewebsites.net
FUNCTIONS_VERSION=1.0.0

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/db

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
EMBEDDINGS_DEPLOYMENT_NAME=text-embedding-ada-002

# Datadog Configuration
DD_API_KEY=your-datadog-api-key
```

## 📈 **Expected Results**

### **Performance Comparison**

| Metric | AKS (Dev) | Azure Functions (Staging) | Winner |
|--------|-----------|---------------------------|---------|
| **Cold Start** | None | 2-5 seconds | AKS |
| **Warm Response** | 200-500ms | 300-800ms | AKS |
| **Concurrent Load** | Excellent | Good (auto-scales) | AKS |
| **Consistency** | Very High | High | AKS |

### **Cost Comparison**

| Component | AKS (Dev) | Azure Functions (Staging) | Savings |
|-----------|-----------|---------------------------|---------|
| **Compute** | $400-800/month | $0-2/month | **99%** |
| **Database** | $200-300/month | $25-35/month | **85%** |
| **Monitoring** | $50-100/month | $0/month | **100%** |
| **Total** | **$650-1300/month** | **$30-80/month** | **85-90%** |

### **Operational Comparison**

| Aspect | AKS (Dev) | Azure Functions (Staging) | Winner |
|--------|-----------|---------------------------|---------|
| **Deployment Complexity** | High | Low | Functions |
| **Scaling** | Manual/HPA | Automatic | Functions |
| **Monitoring** | Complex Setup | Built-in | Functions |
| **Rollback** | kubectl rollout | Version management | Tie |

## 🔄 **Rollback Procedures**

### **AKS Rollback**
```bash
# Automatic rollback to previous version
kubectl rollout undo deployment/vibecode-webgui -n vibecode-dev

# Check rollback status
kubectl rollout status deployment/vibecode-webgui -n vibecode-dev

# Verify health
curl -f http://localhost:3000/api/health
```

### **Azure Functions Rollback**
```bash
# Deploy previous version
az functionapp deployment source config-zip \
  --name vibecode-docs-search-staging \
  --resource-group vibecode-staging-rg \
  --src ./azure-functions/previous-deployment.zip

# Verify health
curl -f https://vibecode-docs-search-staging.azurewebsites.net/api/health
```

## 📋 **Monitoring & Alerts**

### **Health Checks**
- HTTP endpoint monitoring
- Database connectivity validation
- Search functionality verification
- Performance threshold monitoring

### **Auto-Recovery**
- Automatic failure detection
- Rollback trigger on health check failure
- Notification to Datadog
- Recovery validation

### **Metrics Collection**
- Response time percentiles
- Error rates and types
- Cold start frequency
- Cost accumulation

## 🎯 **Decision Framework**

### **Choose AKS When:**
- Consistent high traffic expected
- Sub-second response time requirements
- Complex deployment requirements
- Team has Kubernetes expertise
- Budget allows for fixed costs

### **Choose Azure Functions When:**
- Sporadic or variable traffic patterns
- Cost optimization is priority
- Simple deployment preferred
- Minimal operational overhead desired
- Traffic is bursty/unpredictable

## 🚨 **Troubleshooting**

### **Common Issues**

**Environment Not Healthy:**
```bash
# Check deployment status
./scripts/deploy-comparison-environments.sh validate

# View logs
kubectl logs -f deployment/vibecode-webgui -n vibecode-dev
az functionapp log tail --name vibecode-docs-search-staging --resource-group vibecode-staging-rg
```

**Test Failures:**
```bash
# Check network connectivity
curl -v http://localhost:3000/api/health
curl -v https://vibecode-docs-search-staging.azurewebsites.net/api/health

# Verify environment variables
cat .env.ab-testing
```

**Rollback Issues:**
```bash
# Check rollback readiness
npx tsx tests/performance/run-ab-test.ts --no-performance --no-report

# Manual rollback
kubectl rollout undo deployment/vibecode-webgui -n vibecode-dev
```

## 📊 **Sample Test Output**

```
🚀 Starting comprehensive A/B testing...

🔍 Validating test environments...
dev-aks (aks): ✅ - 234.56ms
staging-functions (azure-functions): ✅ - 1,234.56ms

🔍 Testing basic search functionality...
  dev-aks: ✅ 187.23ms - "deployment"
  staging-functions: ✅ 456.78ms - "deployment"
  dev-aks: ✅ 203.45ms - "kubernetes"
  staging-functions: ✅ 2,345.67ms - "kubernetes" (cold start)

📊 A/B TESTING RESULTS SUMMARY
================================================================================

📈 PERFORMANCE COMPARISON:
┌─────────────────────┬─────────────┬─────────────────┬─────────────────┐
│ Metric              │ AKS (Dev)   │ Functions (Stg) │ Winner          │
├─────────────────────┼─────────────┼─────────────────┼─────────────────┤
│ Avg Response Time   │      210ms  │         687ms   │ AKS             │
│ Success Rate        │      100.0% │        95.2%    │ AKS             │
│ Total Requests      │          50 │              50 │ -               │
│ Cold Starts         │ N/A         │               8 │ AKS (none)      │
└─────────────────────┴─────────────┴─────────────────┴─────────────────┘

🎯 RECOMMENDATION:
Azure Functions recommended - Better cost/performance ratio

📋 NEXT STEPS:
1. Review detailed results in generated JSON/CSV files
2. Consider traffic patterns and cost requirements  
3. Test rollback procedures for chosen deployment
4. Plan gradual migration strategy
```

## 🎉 **Benefits of This Framework**

✅ **Data-Driven Decisions**: Real performance metrics, not assumptions  
✅ **Risk Mitigation**: Tested rollback procedures before production  
✅ **Cost Optimization**: Potential 85-90% cost savings identified  
✅ **Operational Readiness**: Both deployment methods validated  
✅ **Continuous Monitoring**: Ongoing health validation  

This A/B testing framework ensures you make informed decisions about deployment architecture based on actual performance data and operational requirements.
