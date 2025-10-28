# Troubleshooting Guide

Comprehensive troubleshooting guide for common development, deployment, and operational issues in VibeCode.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Development Environment](#development-environment)
- [Database Issues](#database-issues)
- [Build and Compilation](#build-and-compilation)
- [Test Failures](#test-failures)
- [Docker and Containers](#docker-and-containers)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Performance Issues](#performance-issues)
- [Security and Authentication](#security-and-authentication)
- [AI Provider and Completion Issues](#ai-provider-and-completion-issues)
- [Code-Server Deployment](#code-server-deployment)
- [Tauri Desktop Application](#tauri-desktop-application)
- [Log File Locations](#log-file-locations)

## Quick Diagnostics

When facing issues, start with these commands to gather diagnostic information:

```bash
# Check system environment
node --version        # Should be 18.18.0 to 24.x
npm --version         # Should be 9.0.0+
docker --version      # For container-related issues
kubectl version       # For Kubernetes issues

# Check service status
npm run monitoring:health     # Application health check
curl -s http://localhost:3000/api/health | jq

# View recent logs
tail -f logs/application.log
docker compose logs -f        # For Docker deployments
kubectl logs -f deployment/vibecode  # For K8s deployments
```

## Development Environment

### Issue: Dev Server Won't Start

**Symptoms:**
- Server crashes on startup
- Middleware compilation errors
- "Invalid or unexpected token" errors

**Common Causes:**

1. **Conflicting Configuration Files**
   ```bash
   # Check for conflicting Next.js configs
   ls -la next.config.*

   # Solution: Should only have next.config.mjs
   # If next.config.js exists, back it up and remove
   mv next.config.js next.config.js.bak
   ```

2. **Port Already in Use**
   ```bash
   # Check what's using port 3000
   lsof -i :3000

   # Kill the process
   kill -9 <PID>

   # Or use alternative port
   PORT=3002 npm run dev
   ```

3. **Node Modules Corruption**
   ```bash
   # Clean reinstall
   rm -rf node_modules package-lock.json .next
   npm install
   npm run dev
   ```

4. **Babel/SWC Conflicts**
   ```bash
   # Check if babel.config.js exists
   ls babel.config.js

   # If present and causing issues, back it up
   mv babel.config.js babel.config.js.bak

   # Next.js will use faster SWC compiler
   npm run dev
   ```

**Solution Steps:**
```bash
# 1. Clean environment
rm -rf .next node_modules

# 2. Reinstall dependencies
npm install

# 3. Check configuration
ls next.config.*  # Should see only next.config.mjs

# 4. Start dev server
npm run dev
```

See [DEV_SERVER_FIX_SUMMARY.md](DEV_SERVER_FIX_SUMMARY.md) for detailed resolution of middleware compilation issues.

### Issue: Monaco Editor Not Loading

**Symptoms:**
- Blank editor area
- Console error: "Cannot read property 'monaco' of undefined"
- Editor stuck on loading screen

**Diagnosis:**
```bash
# Check Monaco installation
npm list monaco-editor monacopilot

# Expected output:
# ├── monaco-editor@0.53.0
# └── monacopilot@1.2.7
```

**Solutions:**

1. **Version Mismatch**
   ```bash
   # Check version lock file
   cat .monaco-version-lock

   # Verify Monaco version
   npm run verify

   # If version mismatch detected
   npm install monaco-editor@0.53.0 --save-exact
   ```

2. **Webpack Configuration**
   ```javascript
   // Verify in next.config.mjs
   // Monaco should be properly configured in webpack
   config.resolve.alias['monaco-editor'] = require.resolve('monaco-editor')
   ```

3. **Test Monaco Integration**
   ```bash
   npm run test:unit:monaco
   ```

### Issue: Environment Variables Not Loading

**Symptoms:**
- Undefined environment variables
- Database connection failures
- API keys not found

**Diagnosis:**
```bash
# Check if .env file exists
ls -la .env

# Validate environment variables
npm run check-env

# Check for template mismatches
diff .env .env.example
```

**Solutions:**

1. **Missing .env File**
   ```bash
   # Copy from example
   cp .env.example .env

   # Edit with your values
   nano .env
   ```

2. **Variable Naming Issues**
   ```bash
   # Common variable aliases (use any, but be consistent)
   DATABASE_URL=postgresql://...
   POSTGRES_URL=postgresql://...    # Same as above
   POSTGRESQL_URL=postgresql://...  # Same as above

   # Redis/Valkey (interchangeable)
   REDIS_URL=redis://localhost:6379
   VALKEY_URL=redis://localhost:6379  # Can use either
   ```

3. **Next.js Public Variables**
   ```bash
   # Browser-accessible vars MUST start with NEXT_PUBLIC_
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_DD_CLIENT_TOKEN=your-token

   # Server-only vars do NOT need prefix
   DATABASE_URL=postgresql://...
   ```

4. **Restart Required**
   ```bash
   # Next.js requires restart for .env changes
   # Stop dev server (Ctrl+C) and restart
   npm run dev
   ```

### Issue: TypeScript Errors After Update

**Symptoms:**
- Type checking fails
- "Cannot find module" errors
- Type mismatch errors

**Solutions:**
```bash
# 1. Clear TypeScript cache
rm -rf .next tsconfig.tsbuildinfo

# 2. Regenerate type definitions
npm run type-check

# 3. Rebuild
npm run build

# 4. Check for missing type definitions
npm install --save-dev @types/node @types/react @types/react-dom

# 5. Verify tsconfig.json
cat tsconfig.json | jq .compilerOptions
```

## Database Issues

### Issue: PostgreSQL Connection Failures

**Symptoms:**
- "Connection refused" errors
- "ECONNREFUSED 127.0.0.1:5432"
- Database queries timing out

**Diagnosis:**
```bash
# Test database connectivity
psql -h localhost -U username -d vibecode_dev

# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Docker Compose database
docker compose ps postgres
docker compose logs postgres
```

**Solutions:**

1. **PostgreSQL Not Running**
   ```bash
   # macOS (Homebrew)
   brew services start postgresql@16

   # Linux (systemd)
   sudo systemctl start postgresql

   # Docker Compose
   docker compose up -d postgres
   ```

2. **Connection String Issues**
   ```bash
   # Verify format (choose one naming style)
   DATABASE_URL="postgresql://username:password@host:port/database"

   # Common mistakes:
   # ❌ postgres:// (should be postgresql://)
   # ❌ Missing port :5432
   # ❌ Wrong database name

   # Test connection
   node -e "const { Client } = require('pg'); const client = new Client({connectionString: process.env.DATABASE_URL}); client.connect().then(() => console.log('Connected!')).catch(e => console.error(e))"
   ```

3. **Connection Pool Exhaustion**
   ```bash
   # Check pool settings in .env
   DB_POOL_MIN=2
   DB_POOL_MAX=10
   DB_POOL_IDLE_TIMEOUT=30000
   DB_POOL_CONNECTION_TIMEOUT=10000

   # Monitor active connections
   psql -U username -d vibecode_dev -c "SELECT count(*) FROM pg_stat_activity;"
   ```

4. **pgvector Extension Missing**
   ```bash
   # Connect to database
   psql -U username -d vibecode_dev

   # Enable pgvector extension
   CREATE EXTENSION IF NOT EXISTS vector;

   # Verify installation
   \dx vector
   ```

### Issue: Redis/Valkey Connection Problems

**Symptoms:**
- "Redis connection failed"
- Rate limiting not working
- Session storage errors

**Diagnosis:**
```bash
# Test Redis connectivity
redis-cli ping
# Expected: PONG

# Check Redis is running
redis-cli info server

# Docker Compose
docker compose ps redis
```

**Solutions:**

1. **Redis Not Running**
   ```bash
   # macOS (Homebrew)
   brew services start redis

   # Linux
   sudo systemctl start redis

   # Docker
   docker compose up -d redis
   ```

2. **Connection Configuration**
   ```bash
   # .env configuration (use either Redis or Valkey naming)
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0

   # Or use Valkey naming (same Redis protocol)
   VALKEY_URL=redis://localhost:6379
   VALKEY_HOST=localhost
   VALKEY_PORT=6379
   ```

3. **Authentication Issues**
   ```bash
   # If Redis requires password
   REDIS_URL=redis://:password@localhost:6379

   # Test with password
   redis-cli -a password ping
   ```

### Issue: Database Migration Failures

**Symptoms:**
- Schema version mismatches
- Migration errors during deployment
- "Table already exists" errors

**Solutions:**
```bash
# 1. Check current migration status
npx prisma migrate status

# 2. Reset database (DEVELOPMENT ONLY - destroys data)
npx prisma migrate reset

# 3. Apply pending migrations
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate

# 5. Verify schema
npx prisma validate
```

## Build and Compilation

### Issue: Build Failures

**Symptoms:**
- "npm run build" fails
- Webpack compilation errors
- Out of memory errors

**Solutions:**

1. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" npm run build

   # For persistent fix, add to package.json scripts:
   "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
   ```

2. **TypeScript Errors**
   ```bash
   # Check for type errors
   npm run type-check

   # Build with verbose output
   npm run build -- --debug
   ```

3. **Dependency Issues**
   ```bash
   # Check for incompatible dependencies
   npm run deps:check

   # Update peer dependencies
   npm install --legacy-peer-deps
   ```

4. **Clear Build Cache**
   ```bash
   # Remove all build artifacts
   rm -rf .next out dist node_modules/.cache

   # Rebuild
   npm run build
   ```

### Issue: Webpack Bundle Size Too Large

**Symptoms:**
- Slow page loads
- Large bundle warnings during build
- Client-side JavaScript exceeds limits

**Diagnosis:**
```bash
# Analyze bundle
npm run build
npx @next/bundle-analyzer

# Check bundle sizes
du -sh .next/static/chunks/*
```

**Solutions:**
```bash
# 1. Enable production optimizations
NODE_ENV=production npm run build

# 2. Check for duplicate dependencies
npx depcheck

# 3. Verify tree-shaking is working
# Check next.config.mjs for proper webpack externals

# 4. Use dynamic imports for large components
# In code:
const LargeComponent = dynamic(() => import('./LargeComponent'), {
  loading: () => <p>Loading...</p>,
})
```

## Test Failures

### Issue: Jest Tests Failing

**Symptoms:**
- Tests fail that previously passed
- "Cannot find module" in tests
- Timeout errors

**Solutions:**

1. **Clear Jest Cache**
   ```bash
   npx jest --clearCache
   npm test
   ```

2. **Module Resolution Issues**
   ```bash
   # Check jest.config.mjs moduleNameMapper
   cat jest.config.mjs | grep moduleNameMapper

   # Ensure path aliases match tsconfig.json
   # Verify test can find modules
   npm run test:unit -- --verbose
   ```

3. **Test Timeout Issues**
   ```bash
   # Increase timeout for slow tests
   jest.setTimeout(30000);  // in test file

   # Or via command line
   npm test -- --testTimeout=30000
   ```

4. **Database Test Issues**
   ```bash
   # Use test database
   DATABASE_URL="postgresql://user:pass@localhost:5432/vibecode_test" npm test

   # Or use environment-specific file
   cp .env.test .env
   npm test
   ```

### Issue: Playwright E2E Tests Failing

**Symptoms:**
- Browser tests timeout
- "page.goto" navigation errors
- Selector not found errors

**Diagnosis:**
```bash
# Run with UI mode for debugging
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/editor.test.ts --headed

# Check Playwright installation
npx playwright install
```

**Solutions:**

1. **Browser Not Installed**
   ```bash
   # Install browsers
   npx playwright install chromium firefox webkit

   # Or specific browser
   npx playwright install chromium
   ```

2. **Dev Server Not Running**
   ```bash
   # Start dev server in separate terminal
   npm run dev

   # Then run tests
   npm run test:e2e

   # Or use webServer config in playwright.config.ts
   # Tests will auto-start dev server
   ```

3. **Selector Issues**
   ```bash
   # Use Playwright Inspector
   npx playwright test --debug

   # Generate selectors automatically
   npx playwright codegen http://localhost:3000
   ```

4. **Network Issues**
   ```bash
   # Increase navigation timeout in playwright.config.ts
   use: {
     navigationTimeout: 30000,
   }

   # Wait for network idle
   await page.goto('/', { waitUntil: 'networkidle' });
   ```

### Issue: Integration Tests Failing

**Symptoms:**
- API route tests fail
- Database integration errors
- External service mocking issues

**Solutions:**
```bash
# 1. Check test environment
cat .env.test

# 2. Ensure test database is clean
npm run db:test:reset

# 3. Run integration tests in isolation
npm run test:integration -- --runInBand

# 4. Check for port conflicts
lsof -i :3000
```

## Docker and Containers

### Issue: Docker Build Failures

**Symptoms:**
- "docker build" command fails
- Dependency installation errors in container
- Layer caching issues

**Solutions:**

1. **Build Without Cache**
   ```bash
   docker build --no-cache -t vibecode-webgui:dev .
   ```

2. **Check Docker Daemon**
   ```bash
   # Verify Docker is running
   docker info

   # Start Docker Desktop (macOS)
   open -a Docker

   # Start Docker service (Linux)
   sudo systemctl start docker
   ```

3. **Multi-Architecture Build Issues**
   ```bash
   # Setup buildx for multi-platform builds
   docker buildx create --name multiarch --use
   docker buildx inspect --bootstrap

   # Build for specific platform
   docker buildx build --platform linux/amd64 -t vibecode:amd64 .
   ```

4. **Layer Size Issues**
   ```bash
   # Analyze image layers
   docker history vibecode-webgui:latest

   # Use .dockerignore to reduce context
   cat .dockerignore
   ```

### Issue: Docker Compose Services Won't Start

**Symptoms:**
- Services stuck in "starting" state
- Containers exit immediately
- Network connection errors between services

**Diagnosis:**
```bash
# Check service status
docker compose ps

# View logs for specific service
docker compose logs postgres
docker compose logs redis
docker compose logs vibecode

# Check resource usage
docker stats
```

**Solutions:**

1. **Service Dependencies**
   ```bash
   # Ensure services start in correct order
   # Check depends_on in docker-compose.yml

   # Start services one at a time
   docker compose up -d postgres
   docker compose up -d redis
   docker compose up -d vibecode
   ```

2. **Port Conflicts**
   ```bash
   # Check if ports are already in use
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   lsof -i :3000  # Application

   # Change ports in docker-compose.yml if needed
   ```

3. **Volume Permission Issues**
   ```bash
   # Fix volume permissions
   sudo chown -R $(id -u):$(id -g) ./data

   # Or recreate volumes
   docker compose down -v
   docker compose up -d
   ```

4. **Network Issues**
   ```bash
   # Recreate network
   docker compose down
   docker network prune
   docker compose up -d
   ```

### Issue: Container Resource Limits

**Symptoms:**
- Out of memory errors
- Container killed by OOM
- Slow performance in containers

**Solutions:**
```bash
# 1. Check current resource usage
docker stats vibecode-webgui

# 2. Increase Docker Desktop resources
# Docker Desktop → Preferences → Resources
# Increase Memory to 4GB+
# Increase CPU to 4+

# 3. Set explicit limits in docker-compose.yml
services:
  vibecode:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G

# 4. Monitor and adjust
docker compose up -d
docker stats
```

## Kubernetes Deployment

### Issue: Pod CrashLoopBackOff

**Symptoms:**
- Pods constantly restarting
- Application logs show startup errors
- Health checks failing

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n vibecode-platform

# View pod logs
kubectl logs -f deployment/vibecode

# Describe pod for events
kubectl describe pod <pod-name>

# Check previous container logs
kubectl logs <pod-name> --previous
```

**Solutions:**

1. **Configuration Issues**
   ```bash
   # Check ConfigMaps and Secrets
   kubectl get configmap -n vibecode-platform
   kubectl get secrets -n vibecode-platform

   # Verify environment variables
   kubectl exec -it <pod-name> -- env | grep DATABASE
   ```

2. **Resource Constraints**
   ```bash
   # Check resource limits
   kubectl describe pod <pod-name> | grep -A 5 Resources

   # Increase limits in deployment manifest
   resources:
     limits:
       cpu: 1000m
       memory: 2Gi
     requests:
       cpu: 500m
       memory: 1Gi
   ```

3. **Health Check Failures**
   ```bash
   # Test health endpoint manually
   kubectl exec -it <pod-name> -- curl localhost:3000/api/health

   # Adjust probe timings
   livenessProbe:
     initialDelaySeconds: 60  # Give more startup time
     periodSeconds: 10
     timeoutSeconds: 5
     failureThreshold: 3
   ```

### Issue: Service Not Accessible

**Symptoms:**
- Cannot access application from outside cluster
- Service endpoint returns 404 or timeout
- Ingress not routing traffic

**Diagnosis:**
```bash
# Check service
kubectl get svc -n vibecode-platform
kubectl describe svc vibecode

# Check endpoints
kubectl get endpoints -n vibecode-platform

# Check ingress
kubectl get ingress -n vibecode-platform
kubectl describe ingress vibecode
```

**Solutions:**

1. **Port Configuration**
   ```bash
   # Verify service ports match container ports
   kubectl get svc vibecode -o yaml | grep -A 5 ports

   # Test service from within cluster
   kubectl run test-pod --rm -it --image=curlimages/curl -- sh
   curl http://vibecode.vibecode-platform.svc.cluster.local:80
   ```

2. **Ingress Configuration**
   ```bash
   # Check ingress controller is running
   kubectl get pods -n ingress-nginx

   # Verify ingress rules
   kubectl get ingress vibecode -o yaml

   # Check ingress controller logs
   kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
   ```

3. **Network Policies**
   ```bash
   # Check if network policies are blocking traffic
   kubectl get networkpolicies -n vibecode-platform

   # Temporarily remove to test
   kubectl delete networkpolicy <policy-name>
   ```

### Issue: Persistent Volume Issues

**Symptoms:**
- Pod stuck in "Pending" state
- "FailedAttachVolume" or "FailedMount" events
- Data not persisting across pod restarts

**Solutions:**
```bash
# 1. Check PVC status
kubectl get pvc -n vibecode-platform

# 2. Describe PVC for events
kubectl describe pvc <pvc-name>

# 3. Check storage class
kubectl get storageclass

# 4. Verify volume mount in pod
kubectl exec -it <pod-name> -- df -h

# 5. Check node capacity
kubectl describe node <node-name> | grep -A 5 Capacity
```

### Issue: KinD Cluster Issues

**Symptoms:**
- Cluster won't start
- Nodes not ready
- Image loading failures

**Solutions:**
```bash
# 1. Check cluster status
kind get clusters
kubectl cluster-info --context kind-vibecode

# 2. Recreate cluster
kind delete cluster --name vibecode
kind create cluster --name vibecode --config kind-config.yaml

# 3. Load images to KinD
kind load docker-image vibecode-webgui:latest --name vibecode

# 4. Check node status
kubectl get nodes
kubectl describe node vibecode-control-plane

# 5. View KinD logs
docker logs vibecode-control-plane
```

## Monitoring and Observability

### Issue: Datadog Agent Not Reporting

**Symptoms:**
- No metrics in Datadog dashboard
- APM traces not appearing
- Logs not being collected

**Diagnosis:**
```bash
# Check Datadog agent status
kubectl exec -it <datadog-agent-pod> -- agent status

# Verify API key
kubectl get secret datadog-secret -o jsonpath='{.data.api-key}' | base64 -d

# Check agent logs
kubectl logs -f <datadog-agent-pod>
```

**Solutions:**

1. **API Key Issues**
   ```bash
   # Verify DD_API_KEY in environment
   echo $DD_API_KEY

   # Update secret
   kubectl create secret generic datadog-secret \
     --from-literal=api-key=$DD_API_KEY \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

2. **Site Configuration**
   ```bash
   # Verify DD_SITE matches your Datadog account
   # US1: datadoghq.com
   # US3: us3.datadoghq.com
   # US5: us5.datadoghq.com
   # EU: datadoghq.eu

   DD_SITE=datadoghq.com  # Update in .env
   ```

3. **Network Connectivity**
   ```bash
   # Test Datadog endpoint connectivity
   kubectl exec -it <pod-name> -- curl -v https://api.datadoghq.com/api/v1/validate

   # Check firewall rules allow outbound to Datadog
   ```

### Issue: Traces Not Appearing in APM

**Symptoms:**
- Application running but no traces
- Incomplete trace data
- Missing service dependencies

**Solutions:**
```bash
# 1. Verify dd-trace is initialized
# Check src/instrument.ts is loaded

# 2. Enable trace debugging
DD_TRACE_DEBUG=true npm run dev

# 3. Check trace sample rate
DD_TRACE_SAMPLE_RATE=1.0  # Sample all traces for testing

# 4. Verify service name
DD_SERVICE=vibecode-webgui
DD_ENV=development

# 5. Check trace injection
DD_DBM_TRACE_INJECTION=true  # For database traces
```

### Issue: Database Monitoring Not Working

**Symptoms:**
- No database queries in Datadog DBM
- Query performance metrics missing
- Database traces not linked to APM

**Solutions:**
```bash
# 1. Create Datadog PostgreSQL user
psql -U postgres <<EOF
CREATE USER datadog WITH PASSWORD 'your_password';
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
EOF

# 2. Configure connection
DD_POSTGRES_USER=datadog
DD_POSTGRES_PASSWORD=your_password
DD_DBM_PROPAGATION_MODE=service
DD_DBM_TRACE_INJECTION=true

# 3. Verify agent can connect
kubectl exec -it <datadog-agent-pod> -- agent check postgres

# 4. Check DBM is enabled
DD_TRACE_ENABLED=true
```

## Performance Issues

### Issue: Slow Page Load Times

**Symptoms:**
- Pages take >3 seconds to load
- High Time to First Byte (TTFB)
- Large Cumulative Layout Shift (CLS)

**Diagnosis:**
```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Check bundle size
npm run build
ls -lh .next/static/chunks/

# Monitor in Datadog RUM
# Check Core Web Vitals in dashboard
```

**Solutions:**

1. **Enable Production Optimizations**
   ```bash
   # Build for production
   NODE_ENV=production npm run build
   npm run start
   ```

2. **Optimize Images**
   ```jsx
   // Use Next.js Image component
   import Image from 'next/image'

   <Image
     src="/hero.jpg"
     width={1200}
     height={600}
     alt="Hero"
     priority  // For LCP image
   />
   ```

3. **Code Splitting**
   ```javascript
   // Use dynamic imports
   import dynamic from 'next/dynamic'

   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Skeleton />
   })
   ```

4. **Database Query Optimization**
   ```bash
   # Enable query logging
   DD_TRACE_ANALYTICS_ENABLED=true

   # Check slow queries in Datadog DBM
   # Add indexes for frequently queried fields
   ```

### Issue: High Memory Usage

**Symptoms:**
- Node.js process using >2GB memory
- Out of memory errors
- Memory leaks over time

**Diagnosis:**
```bash
# Monitor memory usage
node --inspect npm run dev
# Open chrome://inspect in Chrome

# Generate heap snapshot
kill -USR2 <node-pid>
```

**Solutions:**
```bash
# 1. Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

# 2. Check for memory leaks
npm install -g clinic
clinic doctor -- node dist/server.js

# 3. Enable garbage collection logs
NODE_OPTIONS="--trace-gc" npm run dev

# 4. Use production build (smaller memory footprint)
npm run build
npm run start
```

### Issue: Vector Search Slow Performance

**Symptoms:**
- Semantic search queries take >5 seconds
- pgvector queries timing out
- High database CPU usage

**Solutions:**
```sql
-- 1. Create HNSW index (faster than IVFFlat)
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);

-- 2. Tune HNSW parameters
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Use approximate search for better performance
-- Set ef_search parameter
SET hnsw.ef_search = 40;

-- 4. Check index usage
EXPLAIN ANALYZE SELECT * FROM embeddings
ORDER BY embedding <=> '[0.1, 0.2, ...]' LIMIT 10;
```

## Security and Authentication

### Issue: Authentication Failures

**Symptoms:**
- Users cannot log in
- "Invalid credentials" errors
- Session expires immediately

**Solutions:**

1. **NextAuth Configuration**
   ```bash
   # Verify required environment variables
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=$(openssl rand -base64 32)

   # For production, use your domain
   NEXTAUTH_URL=https://vibecode.example.com
   ```

2. **OAuth Provider Setup**
   ```bash
   # GitHub OAuth
   GITHUB_ID=your_github_client_id
   GITHUB_SECRET=your_github_client_secret

   # Verify callback URL in GitHub app settings:
   # http://localhost:3000/api/auth/callback/github

   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

3. **Session Storage Issues**
   ```bash
   # Check Redis is running for session storage
   redis-cli ping

   # Verify session configuration
   REDIS_URL=redis://localhost:6379
   SESSION_SECRET=$(openssl rand -base64 32)
   ```

### Issue: CORS Errors

**Symptoms:**
- Browser console shows CORS policy errors
- API requests blocked from other origins
- "Access-Control-Allow-Origin" errors

**Solutions:**
```javascript
// next.config.mjs - Add CORS headers
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ];
}
```

### Issue: API Rate Limiting

**Symptoms:**
- "Too many requests" errors
- 429 status codes
- Users blocked after normal usage

**Diagnosis:**
```bash
# Check rate limit configuration
grep RATE_LIMIT .env

# Test rate limit
for i in {1..150}; do curl http://localhost:3000/api/test; done
```

**Solutions:**
```bash
# Adjust rate limits in .env
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Or disable for testing
# Comment out rate limiting middleware temporarily
```

### Issue: CSP Violations

**Symptoms:**
- Content blocked by Content Security Policy
- Inline scripts not executing
- External resources not loading

**Solutions:**
```javascript
// next.config.mjs - Adjust CSP headers
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.datadog-logs.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self' data:;
  connect-src 'self' *.datadog-logs.com;
`;

// Add nonce for inline scripts
// Use next/script with nonce attribute
```

## AI Provider and Completion Issues

### Issue: OpenAI API Rate Limits

**Symptoms:**
- "Rate limit exceeded" errors
- AI completions failing
- 429 status codes from OpenAI

**Diagnosis:**
```bash
# Check API key configuration
grep OPENAI_API_KEY .env

# Test API connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq
```

**Solutions:**

1. **Implement Request Caching**
   ```bash
   # Enable Redis caching for AI completions
   ENABLE_AI_CACHE=true
   AI_CACHE_TTL=3600  # 1 hour cache

   # Verify Redis is running
   redis-cli ping
   ```

2. **Use Rate Limit Headers**
   ```javascript
   // Monitor rate limits in application logs
   grep "x-ratelimit-remaining" logs/application.log
   ```

3. **Implement Exponential Backoff**
   ```bash
   # Check retry configuration
   AI_RETRY_MAX_ATTEMPTS=3
   AI_RETRY_DELAY_MS=1000
   AI_RETRY_BACKOFF_MULTIPLIER=2
   ```

### Issue: Monaco AI Completion Not Working

**Symptoms:**
- Monacopilot suggestions not appearing
- Console errors about AI provider
- Editor completions timeout

**Diagnosis:**
```bash
# Verify Monacopilot installation
npm list monacopilot monaco-editor

# Check version lock
cat .monaco-version-lock

# Run Monaco tests
npm run test:unit:monaco
```

**Solutions:**

1. **Verify Configuration**
   ```javascript
   // In editor configuration, ensure:
   NEXT_PUBLIC_AI_COMPLETION_ENABLED=true
   NEXT_PUBLIC_AI_PROVIDER=openai
   ```

2. **Check API Endpoint**
   ```bash
   # Test AI completion endpoint
   curl -X POST http://localhost:3000/api/ai/complete \
     -H "Content-Type: application/json" \
     -d '{"prompt": "function hello", "language": "javascript"}'
   ```

3. **Enable Debug Logging**
   ```bash
   # Start dev server with AI debug logs
   DEBUG=monacopilot:* npm run dev
   ```

### Issue: Vector Search Not Returning Results

**Symptoms:**
- Semantic search returns empty results
- pgvector queries slow or timing out
- Embedding generation failures

**Diagnosis:**
```bash
# Check pgvector extension
psql -U username -d vibecode_dev -c "\dx vector"

# Verify embeddings table
psql -U username -d vibecode_dev -c "SELECT COUNT(*) FROM rag_chunks;"

# Test embedding dimensions
psql -U username -d vibecode_dev -c "SELECT vector_dims(embedding) FROM rag_chunks LIMIT 1;"
```

**Solutions:**

1. **Rebuild Vector Index**
   ```sql
   -- Drop and recreate index
   DROP INDEX IF EXISTS rag_chunks_embedding_idx;

   -- Create HNSW index (faster than IVFFlat)
   CREATE INDEX rag_chunks_embedding_idx ON rag_chunks
   USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);
   ```

2. **Verify Embedding Service**
   ```bash
   # Test embedding generation
   curl -X POST http://localhost:3000/api/embeddings \
     -H "Content-Type: application/json" \
     -d '{"text": "test document"}'
   ```

3. **Check Vector Database Connection**
   ```bash
   # Verify database supports pgvector
   docker exec vibecode-db psql -U postgres -d vibecode_dev -c "SELECT * FROM pg_extension WHERE extname='vector';"
   ```

## Code-Server Deployment

### Issue: Code-Server Container Won't Start

**Symptoms:**
- Container exits immediately
- "Failed to start code-server" errors
- Authentication issues

**Diagnosis:**
```bash
# Check container logs
docker logs vibecode-codeserver

# Verify container status
docker ps -a | grep codeserver

# Check volume mounts
docker inspect vibecode-codeserver | jq '.[0].Mounts'
```

**Solutions:**

1. **Fix Authentication Configuration**
   ```bash
   # Set authentication method in docker-compose.yml
   CODE_SERVER_AUTH=password
   CODE_SERVER_PASSWORD=your-secure-password

   # Or use token authentication
   CODE_SERVER_AUTH=token
   CODE_SERVER_TOKEN=your-secure-token
   ```

2. **Volume Permission Issues**
   ```bash
   # Fix workspace permissions
   sudo chown -R 1000:1000 ./workspace

   # Or run as root (not recommended for production)
   docker compose run --user=root vibecode-codeserver
   ```

3. **Port Conflicts**
   ```bash
   # Check if port 8080 is in use
   lsof -i :8080

   # Change port in docker-compose.yml
   ports:
     - "8081:8080"  # Use alternative port
   ```

### Issue: Extensions Not Loading in Code-Server

**Symptoms:**
- AI extensions (Claude Code, Continue) not available
- Extensions fail to install
- Extension marketplace not accessible

**Diagnosis:**
```bash
# List installed extensions
docker exec vibecode-codeserver code-server --list-extensions

# Check extension directory
docker exec vibecode-codeserver ls -la ~/.local/share/code-server/extensions/

# View extension logs
docker exec vibecode-codeserver cat ~/.local/share/code-server/logs/*/exthost*/output*
```

**Solutions:**

1. **Install Extensions via CLI**
   ```bash
   # Install extensions manually
   docker exec vibecode-codeserver code-server --install-extension anthropics.claude-code
   docker exec vibecode-codeserver code-server --install-extension continue.continue
   docker exec vibecode-codeserver code-server --install-extension openai.chatgpt

   # Restart container
   docker compose restart vibecode-codeserver
   ```

2. **Use Extension Marketplace**
   ```bash
   # Configure marketplace in settings
   CODE_SERVER_EXTENSIONS_GALLERY='{"serviceUrl":"https://open-vsx.org/vscode/gallery","itemUrl":"https://open-vsx.org/vscode/item"}'
   ```

3. **Pre-install Extensions in Dockerfile**
   ```dockerfile
   # See docker/code-server/PROFILES.md for profile options
   # Build with extensions profile
   docker build -f docker/code-server/Dockerfile --target extensions -t vibecode-codeserver:extensions .
   ```

### Issue: Code-Server Workspace Not Persisting

**Symptoms:**
- Changes lost after container restart
- Workspace files disappear
- Git repositories not persisting

**Solutions:**
```bash
# 1. Verify volume configuration in docker-compose.yml
services:
  vibecode-codeserver:
    volumes:
      - ./workspace:/home/coder/project
      - codeserver-data:/home/coder/.local/share/code-server

# 2. Create named volume
docker volume create codeserver-data

# 3. Backup workspace before restart
docker exec vibecode-codeserver tar czf /tmp/workspace-backup.tar.gz /home/coder/project
docker cp vibecode-codeserver:/tmp/workspace-backup.tar.gz ./backup/

# 4. Check volume permissions
docker exec vibecode-codeserver ls -la /home/coder/project
```

## Tauri Desktop Application

### Issue: Tauri App Won't Build

**Symptoms**:
- `cargo tauri build` fails
- Rust compilation errors
- Frontend not bundling correctly

**Diagnosis**:
```bash
# Check Tauri CLI version
cargo tauri --version

# Test components separately
npm run build:export  # Frontend
cd src-tauri && cargo build  # Backend

# Check for errors
cargo tauri build 2>&1 | tee build.log
```

**Solutions**:

1. **Missing Next.js Static Export**
   ```bash
   # Ensure out/ directory exists and has content
   npm run build:export
   ls -la out/

   # Should contain index.html, _next/, etc.
   ```

2. **Rust Dependencies Issues**
   ```bash
   cd src-tauri

   # Update dependencies
   cargo update

   # Clean and rebuild
   cargo clean
   cargo build --release
   ```

3. **Xcode Command Line Tools (macOS)**
   ```bash
   # Install or update
   xcode-select --install

   # If already installed, reset
   sudo rm -rf /Library/Developer/CommandLineTools
   xcode-select --install
   ```

### Issue: Docker Integration Not Working in App

**Symptoms**:
- App reports Docker not available
- Docker commands timeout
- Cannot connect to Docker daemon

**Diagnosis**:
```bash
# Verify Docker is running
docker ps

# Test Docker connection from Rust
cd src-tauri
cargo test -- test_docker_check --nocapture

# Check Docker socket permissions
ls -la /var/run/docker.sock
```

**Solutions**:

1. **Docker Not Running**
   ```bash
   # Start Docker Desktop (macOS)
   open -a Docker

   # Wait for startup
   until docker ps; do sleep 1; done

   # Restart Tauri app
   ```

2. **Permission Issues**
   ```bash
   # Ensure user has Docker access
   docker ps  # Should work without sudo

   # macOS: Usually works out of the box with Docker Desktop
   # Linux: Add user to docker group
   sudo usermod -aG docker $USER
   ```

3. **Test from App**
   ```typescript
   // In frontend DevTools console
   import { invoke } from '@tauri-apps/api/core';

   // Test Docker status
   const status = await invoke('get_docker_status');
   console.log('Docker:', status);
   ```

### Issue: App Shows White Screen

**Symptoms**:
- Window opens but no content
- Blank white screen
- DevTools shows 404 errors

**Solutions**:

1. **Frontend Not Bundled**
   ```bash
   # Rebuild frontend
   npm run build:export

   # Verify output
   ls -la out/index.html

   # Rebuild Tauri
   cargo tauri build
   ```

2. **Incorrect Path Configuration**
   ```json
   // Check src-tauri/tauri.conf.json
   {
     "build": {
       "frontendDist": "../out"  // Must point to Next.js output
     }
   }
   ```

3. **CSP Blocking Resources**
   ```json
   // Check Content Security Policy in tauri.conf.json
   {
     "security": {
       "csp": "default-src 'self'; script-src 'self' 'unsafe-eval'; ..."
     }
   }
   ```

### Issue: Development Mode Not Working

**Symptoms**:
- `cargo tauri dev` fails
- Window doesn't appear
- Frontend not loading

**Solutions**:

1. **Start Next.js First**
   ```bash
   # Terminal 1: Start Next.js
   npm run dev

   # Wait for "Ready" message

   # Terminal 2: Start Tauri
   cargo tauri dev
   ```

2. **Port Configuration**
   ```json
   // Ensure devUrl matches Next.js port
   // src-tauri/tauri.conf.json
   {
     "build": {
       "devUrl": "http://localhost:3000"
     }
   }
   ```

3. **Firewall Blocking**
   ```bash
   # Allow local connections
   # macOS: System Preferences → Security & Privacy → Firewall
   # Allow incoming connections for "vibecode"
   ```

For comprehensive Tauri troubleshooting, see the [Tauri Troubleshooting Guide](tauri/TROUBLESHOOTING.md).

## Log File Locations

### Application Logs

**Development:**
```bash
# Console output (stdout/stderr)
npm run dev 2>&1 | tee logs/dev.log

# Next.js build logs
.next/build-manifest.json
.next/trace

# Application logs (if configured)
logs/application.log
logs/error.log
logs/combined.log
```

**Docker Deployment:**
```bash
# Container logs
docker compose logs -f vibecode
docker compose logs --tail=100 vibecode

# Save logs to file
docker compose logs vibecode > logs/docker-app.log

# Database logs
docker compose logs postgres > logs/postgres.log

# Redis logs
docker compose logs redis > logs/redis.log

# Code-server logs
docker compose logs vibecode-codeserver > logs/codeserver.log
```

**Kubernetes Deployment:**
```bash
# Pod logs
kubectl logs -f deployment/vibecode -n vibecode-platform
kubectl logs --tail=100 vibecode-pod-xyz -n vibecode-platform

# Save to file
kubectl logs deployment/vibecode -n vibecode-platform > logs/k8s-app.log

# Previous container logs (if crashed)
kubectl logs vibecode-pod-xyz --previous -n vibecode-platform

# Multiple containers in pod
kubectl logs vibecode-pod-xyz -c app-container -n vibecode-platform
kubectl logs vibecode-pod-xyz -c datadog-agent -n vibecode-platform
```

### Datadog Logs

**Query Application Logs:**
```bash
# View logs in Datadog UI
# https://app.datadoghq.com/logs

# Query via API
curl -X POST "https://api.datadoghq.com/api/v2/logs/events/search" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "query": "service:vibecode-webgui status:error",
      "from": "now-1h",
      "to": "now"
    }
  }'

# Common log queries
# - Errors: status:error service:vibecode-webgui
# - Performance: @http.duration:>1000 service:vibecode-webgui
# - Database: source:postgres @db.statement:*
# - AI completions: @ai.provider:* @ai.duration:*
```

### Test Logs

```bash
# Jest test results
npm test > logs/test-results.log 2>&1

# Playwright test results
npx playwright test --reporter=json > logs/playwright-report.json
test-results/  # HTML reports and screenshots

# E2E test artifacts
tests/e2e/.artifacts/
tests/e2e/screenshots/
tests/e2e/videos/

# Performance test results
logs/lighthouse/
logs/performance/
```

### Build and CI Logs

```bash
# Local build logs
npm run build 2>&1 | tee logs/build.log

# Docker build logs
docker build . 2>&1 | tee logs/docker-build.log

# GitHub Actions logs
# Available at: https://github.com/ryanmaclean/vibecode-webgui/actions

# CI artifacts
.github/workflows/artifacts/
```

## Getting Additional Help

### Collecting Debug Information

When reporting issues, include:

```bash
# System information
node --version
npm --version
docker --version
kubectl version --short

# Environment
cat .env.example  # DO NOT share actual .env
env | grep -E 'NODE_ENV|DATABASE|REDIS' | sed 's/=.*/=***/'

# Logs
npm run dev 2>&1 | tee debug.log
docker compose logs > docker-debug.log
kubectl logs deployment/vibecode > k8s-debug.log

# Test results
npm test 2>&1 | tee test-results.log
```

### Useful Commands Reference

```bash
# Health checks
npm run monitoring:health
curl http://localhost:3000/api/health

# View metrics
npm run monitoring:metrics
curl http://localhost:3000/api/monitoring/dashboard | jq

# Clean everything
npm run cleanup  # If available
rm -rf node_modules .next out dist
npm install

# Reset databases
docker compose down -v
docker compose up -d

# Kubernetes debug
kubectl get all -n vibecode-platform
kubectl describe pod <pod-name>
kubectl logs -f deployment/vibecode
```

### Documentation Links

- [Development Guide](DEVELOPMENT.md) - Setup and workflows
- [Dev Server Fix](DEV_SERVER_FIX_SUMMARY.md) - Middleware compilation issues
- [Testing Strategy](TESTING_STRATEGY.md) - Test frameworks and patterns
- [Docker Deployment](DOCKER_DEPLOYMENT.md) - Container deployment
- [Security Guide](SECURITY.md) - Security best practices
- [Architecture](../ARCHITECTURE.md) - System design overview
- [Tauri Documentation](tauri/README.md) - Desktop application documentation
- [Tauri Troubleshooting](tauri/TROUBLESHOOTING.md) - Comprehensive Tauri issues

### Support Channels

- **GitHub Issues**: [Report bugs and request features](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **Documentation**: Check `docs/` directory for guides

---

**Note**: This troubleshooting guide is based on real issues encountered in the VibeCode project. If you encounter an issue not covered here, please open a GitHub issue to help us improve this guide.

**Last Updated**: 2025-10-01
**Enhanced**: 2025-10-01 - Added AI provider, code-server deployment, Tauri desktop app, and log location sections
