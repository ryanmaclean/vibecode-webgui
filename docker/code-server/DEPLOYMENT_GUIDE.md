# VibeCode Code-Server Deployment Guide

Complete guide for deploying the custom code-server with AI extensions and Datadog monitoring.

## Quick Reference

- **Image**: `vibecode-codeserver:latest` (multi-arch: ARM64 + AMD64)
- **Port**: 8765 (VibeCode's unique port)
- **OAuth Port**: 46203 (for Claude Code & OpenAI ChatGPT authentication)
- **Size**: ~6GB (includes all extensions and LSP servers)

## Prerequisites

### Required Environment Variables

```bash
# Authentication (optional but recommended)
PASSWORD=your_secure_password

# AI Extension API Keys (optional - for subscribers)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
CODEIUM_API_KEY=...

# Datadog Monitoring (optional)
DD_API_KEY=your_datadog_api_key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=vibecode-codeserver
DD_VERSION=1.0.0
```

### Optional Environment Variables

```bash
# OpenRouter (alternative to direct API keys)
OPENROUTER_API_KEY=sk-or-...

# Workspace Configuration
WORKSPACE_DIR=/home/coder/workspace
USER=coder
HOME=/home/coder

# Code-Server Settings
HASHED_PASSWORD=  # Alternative to PASSWORD
PROXY_DOMAIN=localhost
```

## Deployment Options

### Option 1: Docker Run (Quick Test)

```bash
# Basic deployment
docker run -d \
  --name vibecode-codeserver \
  -p 8765:8765 \
  -p 46203:46203 \
  -e PASSWORD=your_password \
  -v $(pwd)/workspace:/home/coder/workspace \
  vibecode-codeserver:latest-arm64

# With AI extensions
docker run -d \
  --name vibecode-codeserver \
  -p 8765:8765 \
  -p 46203:46203 \
  -e PASSWORD=your_password \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  -e GITHUB_TOKEN=ghp_... \
  -v $(pwd)/workspace:/home/coder/workspace \
  vibecode-codeserver:latest-arm64

# Access at: http://localhost:8765
```

### Option 2: Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  code-server:
    image: vibecode-codeserver:latest-arm64
    container_name: vibecode-codeserver
    ports:
      - "8765:8765"
      - "46203:46203"
    environment:
      - PASSWORD=${PASSWORD}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - CODEIUM_API_KEY=${CODEIUM_API_KEY}
      - DD_AGENT_HOST=datadog-agent
      - DD_ENV=production
      - DD_SERVICE=vibecode-codeserver
      - DD_VERSION=1.0.0
    volumes:
      - workspace:/home/coder/workspace
      - ./config:/home/coder/.local/share/code-server
    restart: unless-stopped
    labels:
      com.datadoghq.ad.check_names: '["code-server"]'
      com.datadoghq.ad.init_configs: '[{}]'
      com.datadoghq.ad.instances: '[{"url":"http://%%host%%:8765/healthz"}]'
      com.datadoghq.tags.service: "vibecode-codeserver"
      com.datadoghq.tags.env: "production"

  datadog-agent:
    image: gcr.io/datadoghq/agent:latest
    container_name: datadog-agent
    ports:
      - "8126:8126/tcp"  # APM
      - "8125:8125/udp"  # DogStatsD
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=${DD_SITE:-datadoghq.com}
      - DD_APM_ENABLED=true
      - DD_APM_NON_LOCAL_TRAFFIC=true
      - DD_LOGS_ENABLED=true
      - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
      - DD_PROCESS_AGENT_ENABLED=true
      - DD_LLM_OBS_ENABLED=true
      - DD_LLM_OBS_ML_APP=vibecode-ai-extensions
      - DD_CONTAINER_EXCLUDE="name:datadog-agent"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - ./datadog-agent.yaml:/etc/datadog-agent/datadog.yaml:ro
    restart: unless-stopped

volumes:
  workspace:
```

Create `.env` file:

```bash
# Copy from .env.example
PASSWORD=your_secure_password
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
CODEIUM_API_KEY=...
DD_API_KEY=...
DD_SITE=datadoghq.com
```

Deploy:

```bash
docker compose up -d
docker compose logs -f code-server
```

> **Troubleshooting:** Run `docker compose --env-file .env -f docker-compose.yml config` before `docker compose up` to validate your configuration without launching containers.

### Option 3: Kubernetes (Production)

#### Step 1: Create Secrets

```bash
# Create namespace
kubectl create namespace vibecode-platform

# Create code-server secrets
kubectl create secret generic code-server-secrets \
  --namespace vibecode-platform \
  --from-literal=password='your_secure_password' \
  --from-literal=anthropic-api-key='sk-ant-...' \
  --from-literal=openai-api-key='sk-...' \
  --from-literal=github-token='ghp_...' \
  --from-literal=codeium-api-key='...'

# Create Datadog secret
kubectl create secret generic datadog-secret \
  --namespace vibecode-platform \
  --from-literal=api-key='your_datadog_api_key'
```

#### Step 2: Deploy Code-Server

Use the updated manifest from `k8s/code-server-custom.yaml`:

```bash
kubectl apply -f k8s/code-server-custom.yaml
```

Or create a custom deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-code-server
  namespace: vibecode-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibecode-code-server
  template:
    metadata:
      labels:
        app: vibecode-code-server
        component: ide
      annotations:
        ad.datadoghq.com/code-server.check_names: '["code-server"]'
        ad.datadoghq.com/code-server.init_configs: '[{}]'
        ad.datadoghq.com/code-server.instances: |
          [
            {
              "url": "http://%%host%%:8765/healthz",
              "tags": ["service:code-server"]
            }
          ]
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: code-server
        image: vibecode-codeserver:latest-arm64
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8765
          name: http
        - containerPort: 46203
          name: oauth
        env:
        - name: PASSWORD
          valueFrom:
            secretKeyRef:
              name: code-server-secrets
              key: password
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: code-server-secrets
              key: anthropic-api-key
              optional: true
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: code-server-secrets
              key: openai-api-key
              optional: true
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: code-server-secrets
              key: github-token
              optional: true
        - name: CODEIUM_API_KEY
          valueFrom:
            secretKeyRef:
              name: code-server-secrets
              key: codeium-api-key
              optional: true
        - name: DD_AGENT_HOST
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP
        - name: DD_ENV
          value: "production"
        - name: DD_SERVICE
          value: "vibecode-codeserver"
        - name: DD_VERSION
          value: "1.0.0"
        - name: DD_TRACE_AGENT_PORT
          value: "8126"
        - name: DD_DOGSTATSD_PORT
          value: "8125"
        volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
        - name: config
          mountPath: /home/coder/.local/share/code-server
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8765
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8765
          initialDelaySeconds: 10
          periodSeconds: 10
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: code-server-workspace
      - name: config
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: code-server
  namespace: vibecode-platform
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8765
    name: http
  - port: 46203
    targetPort: 46203
    name: oauth
  selector:
    app: vibecode-code-server
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: code-server-workspace
  namespace: vibecode-platform
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

#### Step 3: Create Ingress (Optional)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: code-server
  namespace: vibecode-platform
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - code.yourdomain.com
    secretName: code-server-tls
  rules:
  - host: code.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: code-server
            port:
              number: 80
```

#### Step 4: Verify Deployment

```bash
# Check pods
kubectl get pods -n vibecode-platform

# Check logs
kubectl logs -n vibecode-platform -l app=vibecode-code-server -f

# Port forward for testing
kubectl port-forward -n vibecode-platform svc/code-server 8765:80

# Access at: http://localhost:8765
```

### Option 4: NAS Deployment (Synology, QNAP, etc.)

See `docs/NAS_DEPLOYMENT.md` for detailed NAS-specific instructions.

Quick start:

```bash
# Copy environment template
cp nas.env.example nas.env

# Edit nas.env with your credentials
nano nas.env

# Deploy with NAS-specific compose file
docker compose --env-file nas.env -f docker-compose.nas.yml up -d

# Access at: http://nas-ip:8765
```

## Post-Deployment Configuration

### 1. Configure AI Extensions

After first login, configure API keys for AI extensions:

**Claude Code (Anthropic):**
1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Search for "Claude Code: Set API Key"
3. Enter your Anthropic API key
4. Or use OAuth (requires port 46203 accessible)

**OpenAI ChatGPT:**
1. Open Command Palette
2. Search for "ChatGPT: Set API Key"
3. Enter your OpenAI API key
4. Or use OAuth (requires port 46203 accessible)

**GitHub Copilot:**
1. Click on Copilot icon in status bar
2. Sign in with GitHub account
3. Authorize the extension

**Codeium:**
1. Open Command Palette
2. Search for "Codeium: Login"
3. Follow authentication flow

### 2. Verify Extensions

```bash
# List installed extensions
docker exec vibecode-codeserver code-server --list-extensions

# Should include:
# - anthropic.claude-code
# - openai.chatgpt
# - github.copilot
# - github.copilot-chat
# - codeium.codeium
# - saoudrizwan.claude-dev
```

### 3. Configure Trusted Domains

Trusted domains are pre-configured for:
- Anthropic (api.anthropic.com, console.anthropic.com)
- OpenAI (api.openai.com, platform.openai.com)
- GitHub (github.com, api.github.com)
- Codeium (codeium.com, api.codeium.com)
- Windsurf (codeium.com)
- OpenRouter (openrouter.ai)

No additional configuration needed!

### 4. Test OAuth Authentication

```bash
# Verify OAuth port is accessible
curl http://localhost:46203

# Test from code-server
# 1. Open Claude Code extension
# 2. Click "Sign in with Anthropic"
# 3. Should redirect to OAuth flow
# 4. Callback should work on port 46203
```

## Monitoring & Observability

### Datadog Integration

If you deployed with Datadog Agent:

1. **View Metrics**: Navigate to Datadog → Infrastructure → Containers
2. **View Logs**: Navigate to Datadog → Logs → Search for `service:vibecode-codeserver`
3. **View Traces**: Navigate to Datadog → APM → Services → vibecode-codeserver
4. **LLM Observability**: Navigate to Datadog → APM → LLM Observability

### Custom Dashboards

Import the dashboard templates from `docker/code-server/DATADOG_INTEGRATION.md`:
- AI Extension Performance Dashboard
- Code-Server Health Dashboard

### Alerts

Set up alerts for:
- High AI API costs (> $10/hour)
- Extension host crashes
- High latency (> 5 seconds)
- Memory usage (> 80%)

## Troubleshooting

### Extension Not Working

```bash
# Check extension logs
docker exec vibecode-codeserver cat /home/coder/.local/share/code-server/logs/$(date +%Y-%m-%d).log

# Reinstall extension
docker exec vibecode-codeserver code-server --install-extension anthropic.claude-code --force
```

### OAuth Not Working

```bash
# Verify port 46203 is accessible
netstat -an | grep 46203

# Check firewall rules
sudo ufw status

# Test OAuth callback
curl http://localhost:46203/callback
```

### Performance Issues

```bash
# Check resource usage
docker stats vibecode-codeserver

# Increase memory limit
docker update --memory 8g vibecode-codeserver

# Check extension processes
docker exec vibecode-codeserver ps aux | grep extensionHost
```

### API Key Issues

```bash
# Verify environment variables
docker exec vibecode-codeserver env | grep API_KEY

# Test API connectivity
docker exec vibecode-codeserver curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages

# Check extension settings
docker exec vibecode-codeserver cat /home/coder/.local/share/code-server/User/settings.json
```

## Upgrading

### Docker

```bash
# Pull latest image
docker pull vibecode-codeserver:latest-arm64

# Stop and remove old container
docker stop vibecode-codeserver
docker rm vibecode-codeserver

# Start new container (preserving volumes)
docker compose up -d
```

### Kubernetes

```bash
# Update image in deployment
kubectl set image deployment/vibecode-code-server \
  code-server=vibecode-codeserver:latest-arm64 \
  -n vibecode-platform

# Or apply updated manifest
kubectl apply -f k8s/code-server-custom.yaml

# Watch rollout
kubectl rollout status deployment/vibecode-code-server -n vibecode-platform
```

## Security Best Practices

1. **Always set a strong PASSWORD**
2. **Use HTTPS in production** (via ingress/reverse proxy)
3. **Limit network access** (firewall rules, network policies)
4. **Rotate API keys regularly**
5. **Enable Datadog security monitoring**
6. **Keep image updated** (security patches)
7. **Use secrets management** (Kubernetes secrets, Vault, etc.)
8. **Enable audit logging**
9. **Restrict workspace permissions** (runAsUser, fsGroup)
10. **Monitor for suspicious activity** (Datadog APM Security)

## Performance Tuning

### Resource Limits

```yaml
resources:
  requests:
    cpu: "1"
    memory: "2Gi"
  limits:
    cpu: "4"
    memory: "8Gi"
```

### Extension Performance

```json
{
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "telemetry.telemetryLevel": "off",
  "workbench.enableExperiments": false
}
```

### Network Optimization

```bash
# Enable HTTP/2
# Add to nginx ingress annotations
nginx.ingress.kubernetes.io/http2-push-preload: "true"

# Enable compression
nginx.ingress.kubernetes.io/enable-compression: "true"
```

## Backup & Recovery

### Backup Workspace

```bash
# Docker
docker run --rm \
  --volumes-from vibecode-codeserver \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/workspace-$(date +%Y%m%d).tar.gz /home/coder/workspace

# Kubernetes
kubectl exec -n vibecode-platform vibecode-code-server-xxx -- \
  tar czf - /home/coder/workspace | \
  cat > workspace-backup-$(date +%Y%m%d).tar.gz
```

### Restore Workspace

```bash
# Docker
docker run --rm \
  --volumes-from vibecode-codeserver \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/workspace-20250930.tar.gz -C /

# Kubernetes
kubectl exec -n vibecode-platform vibecode-code-server-xxx -- \
  tar xzf - -C / < workspace-backup-20250930.tar.gz
```

## Support & Resources

- **Documentation**: `docker/code-server/README.md`
- **Datadog Integration**: `docker/code-server/DATADOG_INTEGRATION.md`
- **Multi-Arch Build**: `docker/code-server/MULTIARCH_BUILD.md`
- **Trusted Domains**: `docker/code-server/TRUSTED_DOMAINS.md`
- **NAS Deployment**: `docs/NAS_DEPLOYMENT.md`
- **GitHub Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues

## Changelog

- **2025-09-30**: Initial release with AI extensions and Datadog integration
  - Port changed from 8080 to 8765
  - Added OAuth support (port 46203)
  - Multi-architecture support (ARM64 + AMD64)
  - 9 AI assistants pre-installed
  - Comprehensive Datadog monitoring
  - Security hardening
