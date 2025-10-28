# Database Connection Issues - Resolution Guide

## 🚨 **Issues Identified**

### **1. DEV Environment (vibecode-pgflex-1758429506)**
- **Issue**: Connection timeout
- **Cause**: Firewall rules blocking connection
- **Solution**: Add firewall rule for current IP

### **2. STAGING Environment (vibecode-staging-pg)**
- **Issue**: Password authentication failed for user "vibecodeusr"
- **Cause**: Incorrect or expired password
- **Solution**: Reset database password

### **3. PRODUCTION Environment (vibecode-pgflex-1758422944)**
- **Issue**: Password authentication failed for user "pgadmin"
- **Cause**: Incorrect or expired password
- **Solution**: Reset database password

## 🔧 **Immediate Fixes**

### **Fix 1: DEV Environment Firewall**
```bash
# Get your current public IP
curl ifconfig.me

# Add firewall rule for DEV database
az postgres flexible-server firewall-rule create \
    --name "vibecode-pgflex-1758429506" \
    --resource-group "rg-vibecode-dev" \
    --rule-name "AllowCurrentIP" \
    --start-ip-address "YOUR_PUBLIC_IP" \
    --end-ip-address "YOUR_PUBLIC_IP"
```

### **Fix 2: STAGING Environment Password**
```bash
# Reset password for staging database
az postgres flexible-server update \
    --name "vibecode-staging-pg" \
    --resource-group "rg-vibecode-staging" \
    --admin-password "NEW_STRONG_PASSWORD"
```

### **Fix 3: PRODUCTION Environment Password**
```bash
# Reset password for production database
az postgres flexible-server update \
    --name "vibecode-pgflex-1758422944" \
    --resource-group "rg-vibecode-aks-prod" \
    --admin-password "NEW_STRONG_PASSWORD"
```

## 📝 **Update Environment Variables**

After fixing the database connections, update your `.env.local` file:

```bash
# DEV Environment
DATABASE_URL='postgresql://pgadmin:NEW_DEV_PASSWORD@vibecode-pgflex-1758429506.postgres.database.azure.com:5432/vibecode?sslmode=require'

# STAGING Environment  
DATABASE_URL='postgresql://vibecodeusr:NEW_STAGING_PASSWORD@vibecode-staging-pg.postgres.database.azure.com:5432/vibecode?sslmode=require'

# PRODUCTION Environment
DATABASE_URL='postgresql://pgadmin:NEW_PROD_PASSWORD@vibecode-pgflex-1758422944.postgres.database.azure.com:5432/vibecode?sslmode=require'
```

## 🧪 **Test Database Connections**

### **Test DEV Database:**
```bash
psql -h vibecode-pgflex-1758429506.postgres.database.azure.com \
     -U pgadmin \
     -d vibecode \
     -c "SELECT version();"
```

### **Test STAGING Database:**
```bash
psql -h vibecode-staging-pg.postgres.database.azure.com \
     -U vibecodeusr \
     -d vibecode \
     -c "SELECT version();"
```

### **Test PRODUCTION Database:**
```bash
psql -h vibecode-pgflex-1758422944.postgres.database.azure.com \
     -U pgadmin \
     -d vibecode \
     -c "SELECT version();"
```

## 🔍 **Verify DBM-APM Connection**

After fixing database connections:

### **1. Validate Configuration:**
```bash
npm run validate:dbm-apm
```

### **2. Test API Endpoints:**
```bash
# Test production API
curl -v https://vibecode.eastus2.cloudapp.azure.com/api/health

# Test with trace headers
curl -H "X-Test-Source: dbm-apm" \
     https://vibecode.eastus2.cloudapp.azure.com/api/health
```

### **3. Check Datadog Dashboard:**
- **APM Services**: https://app.datadoghq.com/apm/services
- **Database Monitoring**: https://app.datadoghq.com/databases
- **Trace Explorer**: https://app.datadoghq.com/apm/traces

## 🚀 **Automated Fix Script**

I've created automated fix scripts:

### **Quick Fix Script:**
```bash
chmod +x scripts/util/fix-database-connections.sh
./scripts/util/fix-database-connections.sh
```

### **Comprehensive Troubleshooting:**
```bash
chmod +x troubleshoot-database.sh
./troubleshoot-database.sh
```

## 📊 **Expected Results After Fix**

### **✅ Database Connections:**
- All environments should connect successfully
- No timeout errors
- No authentication failures

### **✅ DBM-APM Features:**
- Database queries correlated with APM traces
- Service attribution in database hosts
- Query samples with trace context
- Performance insights with explain plans

### **✅ API Testing:**
- Health endpoints return 200 OK
- Trace headers present in responses
- Database connectivity confirmed
- Datadog integration active

## 🔧 **Troubleshooting Commands**

### **Check Database Server Status:**
```bash
az postgres flexible-server list --query "[].{Name:name, State:state, ResourceGroup:resourceGroup}" -o table
```

### **Check Firewall Rules:**
```bash
az postgres flexible-server firewall-rule list \
    --name "SERVER_NAME" \
    --resource-group "RESOURCE_GROUP" \
    --output table
```

### **Check Database Logs:**
```bash
az postgres flexible-server logs list \
    --name "SERVER_NAME" \
    --resource-group "RESOURCE_GROUP" \
    --output table
```

## 📚 **Next Steps**

1. **Run the fix scripts** to resolve connection issues
2. **Update environment variables** with new passwords
3. **Test database connections** using psql
4. **Validate DBM-APM configuration** with npm run validate:dbm-apm
5. **Test API endpoints** for trace correlation
6. **Monitor Datadog dashboard** for DBM-APM data

---

**🎉 Once database connections are fixed, the DBM-APM connection will be fully functional!**

The DBM-APM configuration is already deployed and ready - we just need to resolve these database connectivity issues to complete the testing.
