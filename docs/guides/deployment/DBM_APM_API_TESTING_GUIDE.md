# DBM-APM API Testing Guide

## 🚀 **API Testing Methods**

### **Method 1: Direct API Testing**

#### **Test the Production API:**
```bash
# Test health endpoint
curl -v https://vibecode.eastus2.cloudapp.azure.com/api/health

# Test with trace headers
curl -H "X-Test-Source: dbm-apm-validation" \
     -H "User-Agent: DBM-APM-Test/1.0" \
     https://vibecode.eastus2.cloudapp.azure.com/api/health

# Test database connectivity
curl https://vibecode.eastus2.cloudapp.azure.com/api/database/health
```

#### **Test Local Development:**
```bash
# Start local development
npm run dev

# Test local API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/status
```

### **Method 2: Kubernetes Port Forwarding**

#### **Test Staging Environment:**
```bash
# Get staging pod
kubectl get pods -n vibecode-staging

# Port forward to staging
kubectl port-forward -n vibecode-staging deployment/vibecode 3000:3000

# Test in another terminal
curl http://localhost:3000/api/health
```

#### **Test Production Environment:**
```bash
# Get production pod
kubectl get pods -n vibecode-platform

# Port forward to production
kubectl port-forward -n vibecode-platform deployment/vibecode-webgui 3000:3000

# Test in another terminal
curl http://localhost:3000/api/health
```

### **Method 3: Docker Compose Testing**

#### **Start Local Environment:**
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Check logs
docker-compose -f docker-compose.dev.yml logs -f vibecode-dev

# Test API
curl http://localhost:3000/api/health
```

## 🔍 **What to Look For**

### **1. Trace Headers**
Look for these headers in API responses:
- `X-Datadog-Trace-Id`
- `X-Datadog-Span-Id`
- `X-Trace-Id`
- `X-Span-Id`

### **2. Database-Related Content**
Check for database-related information in responses:
- Database connection status
- Query execution times
- Database host information

### **3. Datadog Integration**
Look for Datadog-specific content:
- Service names
- Environment tags
- Version information

## 📊 **Expected Results**

### **Successful DBM-APM Connection:**
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "host": "postgresql.vibecode-platform.svc.cluster.local",
    "query_time": "2.5ms"
  },
  "tracing": {
    "enabled": true,
    "service": "vibecode-webgui",
    "environment": "production"
  }
}
```

### **Trace Headers Example:**
```http
HTTP/1.1 200 OK
X-Datadog-Trace-Id: 1234567890123456789
X-Datadog-Span-Id: 9876543210987654321
X-Datadog-Sampling-Priority: 1
Content-Type: application/json
```

## 🧪 **Test Scenarios**

### **Scenario 1: Health Check**
```bash
curl -v https://vibecode.eastus2.cloudapp.azure.com/api/health
```
**Expected:** 200 OK with trace headers

### **Scenario 2: Database Test**
```bash
curl https://vibecode.eastus2.cloudapp.azure.com/api/database/test
```
**Expected:** Database connection info with trace correlation

### **Scenario 3: Trace Generation**
```bash
# Generate multiple requests to create traces
for i in {1..5}; do
  curl -H "X-Test-Source: dbm-apm-test-$i" \
       https://vibecode.eastus2.cloudapp.azure.com/api/health
done
```
**Expected:** Multiple trace IDs generated

## 🔧 **Troubleshooting**

### **If API is not accessible:**
1. Check if the application is running
2. Verify network connectivity
3. Check firewall settings
4. Verify DNS resolution

### **If no trace headers:**
1. Check Datadog agent status
2. Verify environment variables
3. Check application logs
4. Verify DBM-APM configuration

### **If database queries not correlated:**
1. Check PostgreSQL configuration
2. Verify query_samples is enabled
3. Check Datadog agent logs
4. Verify DBM propagation mode

## 📚 **Verification Steps**

### **1. Check Datadog Dashboard**
- **APM Services**: https://app.datadoghq.com/apm/services
- **Database Monitoring**: https://app.datadoghq.com/databases
- **Trace Explorer**: https://app.datadoghq.com/apm/traces

### **2. Look for DBM-APM Features**
- Service attribution in database hosts
- Query samples with associated traces
- Performance insights with explain plans
- Service dependency visualization

### **3. Monitor Trace Correlation**
- Database connections attributed to APM services
- Query filtering by APM services
- Trace correlation in query samples
- Performance insights with trace context

## 🎯 **Success Criteria**

✅ **API endpoints are accessible**
✅ **Trace headers are present in responses**
✅ **Database connectivity is confirmed**
✅ **Datadog integration is active**
✅ **DBM-APM correlation is working**

## 🚀 **Quick Test Commands**

```bash
# Quick health check
curl -I https://vibecode.eastus2.cloudapp.azure.com/api/health

# Quick trace test
curl -H "X-Test-Source: dbm-apm" https://vibecode.eastus2.cloudapp.azure.com/api/health

# Quick database test
curl https://vibecode.eastus2.cloudapp.azure.com/api/database/health
```

---

**🎉 The DBM-APM connection is fully configured and ready for testing!**

Use these methods to verify that database queries are properly correlated with APM traces in your Datadog dashboard.
