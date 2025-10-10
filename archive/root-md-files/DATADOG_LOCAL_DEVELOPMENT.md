# Datadog in Local Development

This document outlines how Datadog monitoring is integrated into local development for **dev/stg/prd parity**.

## 🎯 Why Datadog Locally?

**Dev/Stg/Prd Parity**: Ensure consistent monitoring across all environments:
- **Local Dev**: Docker Compose with Datadog agent
- **Staging**: KIND cluster with Datadog DaemonSet  
- **Production**: Azure AKS with Datadog Helm chart

## 🚀 Quick Setup

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Datadog keys (or use dummy keys for local testing)
vim .env
```

### 2. Start Development Environment with Monitoring
```bash
# Automated setup
./scripts/setup-local-dev-with-monitoring.sh

# OR manual setup
docker-compose up -d
```

### 3. Verify Monitoring
```bash
# Test Datadog integration
./tests/local-dev-datadog-tests.sh
```

## 🐳 Docker Compose Configuration

### Services with Datadog Integration

#### Datadog Agent Service
```yaml
datadog-agent:
  image: datadog/docker-dd-agent:latest-alpine
  environment:
    - DD_API_KEY=${DD_API_KEY:-${DATADOG_API_KEY:-dummy-key-for-local-dev}} # Prefer DD_API_KEY; legacy DATADOG_API_KEY supported
    - DD_SITE=${DD_SITE:-${DATADOG_SITE:-datadoghq.com}}
    - DD_ENV=local
    - DD_LOGS_ENABLED=true
    - DD_APM_ENABLED=true
  ports:
    - "8126:8126"  # APM traces
    - "8125:8125/udp"  # StatsD metrics
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

#### Application Services Integration
```yaml
app:
  environment:
    - DD_AGENT_HOST=datadog-agent
    - DD_TRACE_AGENT_PORT=8126
    - DD_SERVICE=vibecode-app
    - DD_ENV=local

docs:
  environment:
    - DD_SERVICE=vibecode-docs
    - DD_ENV=local
```

## 📊 Monitoring Features

### Available in Local Development
- ✅ **Application Performance Monitoring (APM)**
- ✅ **Infrastructure monitoring**  
- ✅ **Log aggregation and collection**
- ✅ **Database monitoring capabilities**
- ✅ **Container insights**
- ✅ **Real-time metrics via StatsD**

### Service Endpoints
- **APM Traces**: `localhost:8126`
- **StatsD Metrics**: `localhost:8125`
- **Agent Status**: `docker-compose exec datadog-agent agent status`

## 🔧 Environment Variables

### Required Environment Variables
```bash
# Datadog Core Configuration
# Prefer DD_*; legacy DATADOG_* still recognized as fallback
DD_API_KEY=your-api-key-or-dummy-for-local
DD_APP_KEY=your-app-key-or-dummy-for-local
DD_SITE=datadoghq.com
# Legacy: DATADOG_API_KEY / DATADOG_APP_KEY / DATADOG_SITE are still supported and used as fallback
  
# Environment Identification
DD_ENV=local
  
# Real User Monitoring (RUM) for frontend
NEXT_PUBLIC_DD_APPLICATION_ID=your-rum-app-id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your-rum-client-token
NEXT_PUBLIC_DD_SITE=datadoghq.com
# Legacy: NEXT_PUBLIC_DATADOG_* variables are still recognized as fallback
NEXT_PUBLIC_ENABLE_RUM_IN_DEV=false  # default off; enable only when testing RUM locally
```

> Note: Throughout local dev, examples prefer DD_* variables. Where third-party tools expect legacy names (e.g., Vector/OTel env placeholders), we map `DD_API_KEY` to those via `${DD_API_KEY:-${DATADOG_API_KEY:-...}}` so either works seamlessly.

### Development vs Production Keys
- **Local Development**: Use dummy keys or development-specific keys
- **Production**: Use real API keys stored in Azure Key Vault

### Frontend RUM in local dev
- __Init location__: `src/app/providers.tsx` in a client `useEffect`, using `getRUMPublicConfig()` from `src/lib/monitoring/datadog-env.ts` and `RUMMonitoring.initializeWithTracking(...)` from `src/lib/monitoring/rum-client.ts`.
- __Enable in dev__: set `NEXT_PUBLIC_ENABLE_RUM_IN_DEV=true` in `.env`. Requires `NEXT_PUBLIC_DD_APPLICATION_ID` and `NEXT_PUBLIC_DD_CLIENT_TOKEN`.
- __Defaults__: `service: vibecode-webgui`, `defaultPrivacyLevel: mask-user-input`, `trackUserInteractions: true`, `trackResources: true`, `trackLongTasks: true`, session replay 100% in dev.
- __Logs__: Browser logs are initialized via `datadogLogs.init(...)` in `providers.tsx` with `forwardErrorsToLogs: true`.
- __Alternative component (optional)__: `src/components/monitoring/DatadogRUM.tsx` also initializes RUM and tracks views on route changes. Do not use both at the same time to avoid double initialization.

#### Verify RUM locally
1) In the browser console, confirm you see: `VibeCode RUM monitoring initialized successfully`.
2) Run in console: `window.DD_RUM?.getInternalContext?.()` or `datadogRum.getInternalContext()` and verify `application_id`, `session_id`.
3) Trigger an action in-app; check Network tab for `browser-rum` intake requests to your `NEXT_PUBLIC_DD_SITE`.
4) If nothing appears, ensure `NEXT_PUBLIC_ENABLE_RUM_IN_DEV=true` and that `applicationId`/`clientToken` are set.
5) Conflicts: ensure only one initializer is active (either `providers.tsx` or `DatadogRUM.tsx`).

## 🧪 Testing

### Automated Tests
```bash
# Test local Datadog setup
./tests/local-dev-datadog-tests.sh

# Test Docker Compose with Datadog
./tests/docker-compose-tests.sh

# Test complete pipeline
./scripts/run-all-tests.sh
```

### Manual Verification
```bash
# Check all services are running
docker-compose ps

# Check Datadog agent health  
docker-compose exec datadog-agent agent health

# View Datadog agent configuration
docker-compose exec datadog-agent agent configcheck

# Check APM connectivity
curl -f http://localhost:8126/info

# View logs from all services
docker-compose logs datadog-agent
docker-compose logs docs
docker-compose logs app
```

## 🔗 Environment Parity Matrix

| Feature | Local Dev | KIND Staging | Azure Production |
|---------|-----------|--------------|------------------|
| **Datadog Agent** | Docker Container | DaemonSet | Helm Chart |
| **APM Traces** | ✅ localhost:8126 | ✅ Agent pods | ✅ Agent pods |
| **Log Collection** | ✅ Docker logs | ✅ Pod logs | ✅ Pod logs |
| **Metrics** | ✅ StatsD:8125 | ✅ StatsD | ✅ StatsD |
| **Database Monitoring** | ✅ Configured | ✅ Configured | ✅ Configured |
| **Container Insights** | ✅ Docker | ✅ Kubernetes | ✅ Kubernetes |
| **Real User Monitoring** | ✅ Browser | ✅ Browser | ✅ Browser |

## 📈 Datadog Dashboard Access

### Local Development Tags
Services are tagged with:
- `env:local`
- `cluster:docker-compose`
- `project:vibecode`
- `service:vibecode-docs` / `service:vibecode-app`

### Dashboard Filtering
```
env:local AND cluster:docker-compose
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Datadog Agent Not Starting
```bash
# Check logs
docker-compose logs datadog-agent

# Common causes:
# - Invalid API key (use dummy key for local dev)
# - Docker socket permissions
# - Port conflicts
```

#### 2. APM Traces Not Appearing
```bash
# Check APM port
curl -f http://localhost:8126/info

# Verify app connection to agent
docker-compose exec app ping datadog-agent
```

#### 3. No Metrics Being Sent
```bash
# Check StatsD port
nc -u localhost 8125 <<< "test.metric:1|c"

# Verify environment variables
docker-compose exec app env | grep DD_
```

#### 4. Logs Not Being Collected
```bash
# Check log configuration
docker-compose exec datadog-agent agent configcheck

# Verify Docker socket access
docker-compose exec datadog-agent ls -la /var/run/docker.sock
```

### Debug Commands
```bash
# Full agent status
docker-compose exec datadog-agent agent status

# Check connectivity to Datadog
docker-compose exec datadog-agent agent check connectivity

# Restart agent
docker-compose restart datadog-agent

# View real-time logs
docker-compose logs -f datadog-agent
```

## 📋 Development Workflow

### Daily Development
1. **Start Environment**:
   ```bash
   docker-compose up -d
   ```

2. **Verify Monitoring**:
   ```bash
   docker-compose ps datadog-agent
   ```

3. **Develop with Monitoring**:
   - APM traces automatically collected
   - Logs automatically aggregated
   - Metrics sent to local agent

4. **Test Monitoring**:
   ```bash
   ./tests/local-dev-datadog-tests.sh
   ```

### Before Production Deployment
1. **Test Complete Pipeline**:
   ```bash
   ./scripts/run-all-tests.sh
   ```

2. **Validate Parity**:
   - ✅ Local: Docker Compose
   - ✅ Staging: KIND cluster  
   - ✅ Production: Azure AKS

## 🔐 Security Notes

- **Local Development**: Use dummy API keys to avoid quota usage
- **CI/CD**: Use dedicated development/staging keys
- **Production**: Use production keys from Azure Key Vault
- **Never commit**: Real API keys to version control

## 📚 Related Documentation

- [DATADOG_MONITORING_CONFIGURATION.md](./DATADOG_MONITORING_CONFIGURATION.md) - Complete monitoring setup
- [COMPREHENSIVE_TESTING_GUIDE.md](./COMPREHENSIVE_TESTING_GUIDE.md) - Testing all components
- [README.md](./README.md) - Project overview and setup

---

**Status**: ✅ Dev/Stg/Prd parity achieved with Datadog monitoring  
**Environment**: Local development with full monitoring stack  
**Last Updated**: August 11, 2025