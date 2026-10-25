# VibeCode WebGUI - Production Deployment Guide

## 🚀 Complete Production Deployment Documentation

### Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Deployment](#quick-deployment)
3. [Production Configuration](#production-configuration)
4. [Monitoring & Observability](#monitoring--observability)
5. [Security Hardening](#security-hardening)
6. [Performance Optimization](#performance-optimization)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher with pgvector extension
- **Redis**: 6.x or higher
- **Docker**: 20.x or higher (for containerized deployment)
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: Minimum 50GB free space

### Required Environment Variables
```bash
# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-secret-key

# Database
DATABASE_URL=postgresql://username:password@host:5432/database

# Redis Cache
REDIS_URL=redis://username:password@host:6379

# AI Services
OPENROUTER_API_KEY=your-openrouter-api-key

# Monitoring (Optional)
DD_API_KEY=your-datadog-api-key
DD_APP_KEY=your-datadog-app-key

# Production Settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

---

## Quick Deployment

### Option 1: Docker Compose (Recommended)

1. **Clone and Configure**
   ```bash
   git clone https://github.com/your-org/vibecode-webgui.git
   cd vibecode-webgui
   cp .env.example .env.production
   # Edit .env.production with your values
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

3. **Verify Deployment**
   ```bash
   ./scripts/verify-deployment.sh https://your-domain.com
   ```

### Option 2: Manual Deployment

1. **Install Dependencies**
   ```bash
   npm ci --only=production
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

### Option 3: Kubernetes Deployment

1. **Deploy with Helm**
   ```bash
   helm install vibecode-webgui ./charts/vibecode-platform \
     --namespace vibecode \
     --create-namespace \
     --values values.production.yaml
   ```

---

## Production Configuration

### Application Configuration

#### Next.js Production Settings
```javascript
// next.config.mjs
const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin'
        }
      ]
    }
  ]
}
```

#### Database Configuration
```sql
-- PostgreSQL production settings
-- postgresql.conf

shared_preload_libraries = 'pg_stat_statements'
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

#### Redis Configuration
```redis
# redis.conf production settings
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

---

## Monitoring & Observability

### Datadog Integration

1. **Install Datadog Agent**
   ```bash
   # Kubernetes
   helm install datadog-agent datadog/datadog \
     --set datadog.apiKey=$DD_API_KEY \
     --set datadog.site="datadoghq.com"
   
   # Docker
   docker run -d --name datadog-agent \
     -e DD_API_KEY=$DD_API_KEY \
     -e DD_SITE="datadoghq.com" \
     datadog/agent:latest
   ```

2. **Configure Application Monitoring**
   ```bash
   # Set up monitoring
   ./scripts/setup-production-monitoring.sh
   ```

3. **Import Dashboards**
   - Application Dashboard: `monitoring/datadog/application-dashboard.json`
   - Infrastructure Dashboard: `monitoring/datadog/infrastructure-dashboard.json`

### Health Checks

The application provides several health check endpoints:

- **Basic Health**: `GET /api/health`
- **Database Health**: `GET /api/health/database`
- **Cache Health**: `GET /api/health/cache`
- **Detailed Metrics**: `GET /api/monitoring/metrics`

### Alerting

Critical alerts are configured for:
- Error rate > 5%
- Response time > 2 seconds
- Database connection issues
- Memory usage > 85%
- Cache hit rate < 80%

---

## Security Hardening

### SSL/TLS Configuration

1. **Use Let's Encrypt for SSL**
   ```bash
   certbot --nginx -d your-domain.com
   ```

2. **Configure NGINX**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       # Security headers
       add_header X-Frame-Options DENY;
       add_header X-Content-Type-Options nosniff;
       add_header X-XSS-Protection "1; mode=block";
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Environment Security

1. **Secure Environment Variables**
   ```bash
   # Use secrets management
   export NEXTAUTH_SECRET=$(openssl rand -base64 32)
   export DATABASE_PASSWORD=$(openssl rand -base64 32)
   ```

2. **Database Security**
   ```sql
   -- Create dedicated user
   CREATE USER vibecode_app WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE vibecode TO vibecode_app;
   GRANT USAGE ON SCHEMA public TO vibecode_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vibecode_app;
   ```

### Rate Limiting

Configure rate limiting in your reverse proxy:

```nginx
# NGINX rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
        }
    }
}
```

---

## Performance Optimization

### Application Optimization

1. **Run Performance Analysis**
   ```bash
   ./scripts/optimize-production.sh
   ```

2. **Enable Compression**
   ```javascript
   // Enable gzip compression
   const compression = require('compression');
   app.use(compression());
   ```

3. **Optimize Database Queries**
   ```bash
   # Run database optimization
   psql -d vibecode -f scripts/optimize-database.sql
   ```

### Caching Strategy

1. **Redis Caching**
   - API response caching (TTL: 5 minutes)
   - Session storage
   - Rate limiting counters

2. **CDN Configuration**
   ```javascript
   // Static asset caching
   const cacheControl = 'public, max-age=31536000, immutable';
   ```

### Load Balancing

```yaml
# Kubernetes load balancing
apiVersion: v1
kind: Service
metadata:
  name: vibecode-webgui
spec:
  selector:
    app: vibecode-webgui
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## Backup & Recovery

### Database Backup

1. **Automated Backups**
   ```bash
   # Daily backup script
   #!/bin/bash
   pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
   aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://your-backup-bucket/
   ```

2. **Point-in-Time Recovery**
   ```bash
   # Enable WAL archiving
   archive_mode = on
   archive_command = 'aws s3 cp %p s3://your-wal-bucket/%f'
   ```

### Application Backup

```bash
# Backup user data and configurations
tar -czf app-backup-$(date +%Y%m%d).tar.gz \
  uploads/ \
  rag-index/ \
  conversations/ \
  .env.production
```

---

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   ```bash
   # Check logs
   docker logs vibecode-app
   
   # Verify environment
   ./scripts/verify-deployment.sh
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check connection pool
   curl http://localhost:3000/api/health/database
   ```

3. **High Memory Usage**
   ```bash
   # Check Node.js memory usage
   curl http://localhost:3000/api/monitoring/metrics | jq '.memory'
   
   # Restart if needed
   docker restart vibecode-app
   ```

### Performance Issues

1. **Slow Response Times**
   - Check database query performance
   - Verify cache hit rates
   - Monitor resource usage

2. **High Error Rates**
   - Check application logs
   - Verify external service connectivity
   - Monitor database health

---

## Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Monitor application health
   - Check error rates and performance
   - Verify backup completion

2. **Weekly**
   - Update security patches
   - Analyze performance trends
   - Review log aggregations

3. **Monthly**
   - Update dependencies
   - Capacity planning review
   - Security audit

### Update Procedure

1. **Preparation**
   ```bash
   # Create backup
   ./scripts/backup-production.sh
   
   # Test in staging
   ./scripts/deploy-staging.sh
   ```

2. **Deployment**
   ```bash
   # Deploy with zero downtime
   kubectl rollout restart deployment/vibecode-webgui
   
   # Verify deployment
   ./scripts/verify-deployment.sh
   ```

3. **Rollback (if needed)**
   ```bash
   kubectl rollout undo deployment/vibecode-webgui
   ```

---

## Support & Contacts

- **Engineering Team**: engineering@company.com
- **On-Call Support**: oncall@company.com
- **Monitoring Issues**: monitoring@company.com
- **Security Issues**: security@company.com

---

## Additional Resources

- [Production Readiness Checklist](production-readiness.md)
- [Monitoring Setup Guide](monitoring-setup-report.md)
- [Performance Optimization Report](performance-recommendations.md)
- [Security Best Practices](docs/security-guide.md)

---

*Last Updated: $(date)*
*Version: 1.0.0*
