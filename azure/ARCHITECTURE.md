# Azure Container Architecture for OpenVSCode Server with Datadog and MCP

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Author:** Azure Architecture Team
**Status:** Design Document

---

## Executive Summary

This document outlines a production-ready Azure container architecture for deploying OpenVSCode Server 1.95.3 with integrated Datadog monitoring and Model Context Protocol (MCP) services. The design prioritizes small container footprint, security, and operational excellence.

**Key Highlights:**
- **Recommended Service:** Azure Container Apps (with Container Instances as alternative)
- **Base Image:** Alpine Linux 3.19 (final image ~450MB)
- **Estimated Cost:** $15-45/month for single container 24/7 operation
- **Security:** Hardened container with non-root user, secret management via Key Vault
- **Monitoring:** Full-stack observability with Datadog APM, logs, and custom metrics

---

## Table of Contents

1. [Container Architecture](#1-container-architecture)
2. [Azure Service Comparison & Recommendation](#2-azure-service-comparison--recommendation)
3. [Datadog Integration](#3-datadog-integration)
4. [MCP Services Architecture](#4-mcp-services-architecture)
5. [File System Layout](#5-file-system-layout)
6. [Environment Configuration](#6-environment-configuration)
7. [Networking Design](#7-networking-design)
8. [Storage Strategy](#8-storage-strategy)
9. [Security Hardening](#9-security-hardening)
10. [Deployment Guide](#10-deployment-guide)
11. [Cost Analysis](#11-cost-analysis)
12. [Scaling Strategy](#12-scaling-strategy)
13. [Monitoring & Observability](#13-monitoring--observability)

---

## 1. Container Architecture

### 1.1 Base Image Selection

**Decision: Alpine Linux 3.19**

**Rationale:**
- **Size:** Alpine base is ~7MB vs Ubuntu ~78MB (10x smaller)
- **Security:** Minimal attack surface, fewer CVEs
- **Performance:** Lower memory footprint (important for container density)
- **Package Management:** apk is faster than apt for container builds

**Trade-offs:**
| Aspect | Alpine | Ubuntu |
|--------|--------|--------|
| Base Size | 7MB | 78MB |
| Final Image Size | ~450MB | ~800MB |
| Startup Time | <3s | 5-8s |
| Compatibility | musl libc (99% compatible) | glibc (100% compatible) |
| Package Availability | 10K+ packages | 50K+ packages |
| Build Complexity | Medium (manual compilation sometimes needed) | Low (pre-built binaries) |

**Recommendation:** Use Alpine for production; Ubuntu for development/debugging.

### 1.2 Multi-Stage Build Strategy

```dockerfile
# Stage 1: Build dependencies
FROM alpine:3.19 AS builder
# Compile native modules, download binaries

# Stage 2: Runtime dependencies
FROM alpine:3.19 AS runtime-deps
# Install only runtime packages

# Stage 3: Final image
FROM alpine:3.19
# Copy artifacts, configure runtime
```

**Benefits:**
- Reduces final image size by 60-70%
- Separates build-time from runtime dependencies
- Improves security (no build tools in production image)
- Enables layer caching for faster rebuilds

### 1.3 Size Optimization Techniques

```dockerfile
# 1. Multi-stage builds (covered above)

# 2. Combined RUN commands to reduce layers
RUN apk add --no-cache curl git && \
    npm install -g @modelcontextprotocol/sdk && \
    npm cache clean --force && \
    apk del build-dependencies

# 3. Aggressive cleanup
RUN rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.cache

# 4. Use .dockerignore
.git
node_modules
*.md
docs/
tests/

# 5. Specific package versions (avoid wildcards)
RUN apk add --no-cache \
    nodejs=20.11.1-r0 \
    npm=10.2.4-r0

# 6. Strip debug symbols (for compiled binaries)
RUN strip --strip-debug /usr/local/bin/*

# 7. Use distroless for final stage (alternative to Alpine)
FROM gcr.io/distroless/nodejs20-debian12
```

**Expected Size Breakdown:**
```
Alpine base:              7 MB
Node.js 20 + npm:        60 MB
OpenVSCode Server:      250 MB
VS Code extensions:      80 MB
Datadog agent:           35 MB
MCP servers:             15 MB
System tools:             3 MB
--------------------------------
Total:                  450 MB
```

### 1.4 Security Hardening

```dockerfile
# 1. Non-root user
RUN addgroup -g 1000 vscode && \
    adduser -u 1000 -G vscode -s /bin/sh -D vscode

# 2. Read-only root filesystem
docker run --read-only --tmpfs /tmp --tmpfs /var/run

# 3. Drop capabilities
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE

# 4. Secrets management (never in Dockerfile)
ENV DATADOG_API_KEY=${DATADOG_API_KEY}  # BAD
# Use Azure Key Vault or --env-file instead

# 5. Security scanning
RUN apk add --no-cache trivy && \
    trivy image --exit-code 1 --severity HIGH,CRITICAL .

# 6. SBOM generation
RUN syft . -o spdx-json > sbom.json
```

**Security Checklist:**
- [ ] No root user
- [ ] No secrets in image
- [ ] Minimal packages installed
- [ ] All packages from official repositories
- [ ] Regular base image updates
- [ ] Vulnerability scanning in CI/CD
- [ ] SBOM available
- [ ] Signed images (Docker Content Trust)

---

## 2. Azure Service Comparison & Recommendation

### 2.1 Service Comparison Matrix

| Feature | Azure Container Instances (ACI) | Azure Container Apps (ACA) | Azure Web App for Containers |
|---------|--------------------------------|----------------------------|------------------------------|
| **Pricing Model** | Per-second billing | Request-based + compute | Fixed app service plan |
| **Startup Time** | 10-30s | 5-15s (after cold start) | 20-60s |
| **Scaling** | Manual (no autoscale) | Automatic (KEDA-based) | Manual or automatic |
| **Networking** | Virtual Network integration | Built-in ingress/egress | VNet integration (P1v3+) |
| **Persistent Storage** | Azure Files mount | Azure Files + emptyDir | Azure Files mount |
| **Monitoring** | Basic (Container Insights) | Advanced (Dapr + App Insights) | App Insights integration |
| **Load Balancing** | External required | Built-in | Built-in |
| **SSL/TLS** | Bring your own | Automatic (Let's Encrypt) | Automatic |
| **Custom Domains** | Manual DNS | Built-in | Built-in |
| **Sidecar Support** | Yes (multi-container groups) | Yes (native) | Limited |
| **Min Cost/month** | $10 | $15 | $55 (B1) / $120 (P1v3) |
| **Best For** | Simple, stateless workloads | Microservices, event-driven | Traditional web apps |

### 2.2 Recommended Service: Azure Container Apps

**Primary Recommendation: Azure Container Apps**

**Justification:**
1. **Cost-Effective:** Scales to zero when idle, pay only for actual usage
2. **Modern Architecture:** Built on Kubernetes + Dapr + KEDA
3. **Automatic Scaling:** KEDA scales based on HTTP requests, CPU, memory, or custom metrics
4. **Built-in Ingress:** No need for separate load balancer or Application Gateway
5. **Dapr Integration:** Simplifies MCP service discovery and communication
6. **Developer-Friendly:** Simpler than AKS, more features than ACI
7. **Azure Integration:** Native Key Vault, Managed Identity, Log Analytics

**When to Use Alternative:**

**Azure Container Instances (ACI):**
- Prototyping/testing
- Batch jobs or scheduled tasks
- Very simple single-container deployments
- Need fastest startup time
- Budget under $15/month

**Azure Web App for Containers:**
- Existing App Service ecosystem
- Need deployment slots (staging/production)
- Enterprise compliance requires PCI DSS, HIPAA, SOC
- Predictable, fixed-cost billing preferred

### 2.3 Architecture Diagram (Azure Container Apps)

```
                                    Internet
                                       |
                                       v
                          ┌────────────────────────┐
                          │  Azure Front Door      │
                          │  (CDN + WAF)           │
                          │  - DDoS protection     │
                          │  - SSL termination     │
                          └────────────┬───────────┘
                                       |
                          ┌────────────v───────────┐
                          │  Azure Container Apps  │
                          │  Environment           │
                          │  ┌──────────────────┐  │
                          │  │  Ingress         │  │
                          │  │  (Load Balancer) │  │
                          │  └────────┬─────────┘  │
                          │           |            │
                          │  ┌────────v─────────┐  │
                          │  │ OpenVSCode       │  │
                          │  │ Container App    │  │
                          │  │                  │  │
                          │  │  ┌────────────┐  │  │
                          │  │  │ Main       │  │  │
                          │  │  │ Container  │  │  │
                          │  │  │ :3000      │  │  │
                          │  │  └──────┬─────┘  │  │
                          │  │         |        │  │
                          │  │  ┌──────v─────┐  │  │
                          │  │  │ Datadog    │  │  │
                          │  │  │ Sidecar    │  │  │
                          │  │  └──────┬─────┘  │  │
                          │  │         |        │  │
                          │  │  ┌──────v─────┐  │  │
                          │  │  │ MCP Server │  │  │
                          │  │  │ Sidecar    │  │  │
                          │  │  └────────────┘  │  │
                          │  └──────────────────┘  │
                          └────────────┬───────────┘
                                       |
                ┌──────────────────────┼──────────────────────┐
                |                      |                      |
                v                      v                      v
    ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │ Azure Files       │  │ Azure Key Vault  │  │ Datadog Cloud    │
    │ (Workspace)       │  │ (Secrets)        │  │ (Metrics/Logs)   │
    └───────────────────┘  └──────────────────┘  └──────────────────┘
                |                      |
                v                      v
    ┌───────────────────┐  ┌──────────────────┐
    │ Azure Blob        │  │ Log Analytics    │
    │ (Backups)         │  │ (Container Logs) │
    └───────────────────┘  └──────────────────┘
```

---

## 3. Datadog Integration

### 3.1 Agent Installation Method

**Approach: Sidecar Container (Recommended for Azure Container Apps)**

```yaml
# Azure Container Apps YAML
properties:
  template:
    containers:
      # Main container
      - name: openvscode-server
        image: yourregistry.azurecr.io/openvscode-mcp:latest
        resources:
          cpu: 1.0
          memory: 2Gi
        env:
          - name: DD_AGENT_HOST
            value: localhost
          - name: DD_TRACE_AGENT_PORT
            value: "8126"
          - name: DD_DOGSTATSD_PORT
            value: "8125"

      # Datadog sidecar
      - name: datadog-agent
        image: gcr.io/datadoghq/agent:7
        resources:
          cpu: 0.5
          memory: 512Mi
        env:
          - name: DD_API_KEY
            secretRef: datadog-api-key
          - name: DD_SITE
            value: "datadoghq.com"
          - name: DD_APM_ENABLED
            value: "true"
          - name: DD_APM_NON_LOCAL_TRAFFIC
            value: "true"
          - name: DD_LOGS_ENABLED
            value: "true"
          - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
            value: "true"
          - name: DD_CONTAINER_EXCLUDE
            value: "name:datadog-agent"
          - name: DD_PROCESS_AGENT_ENABLED
            value: "true"
          - name: DD_ENV
            value: "production"
          - name: DD_SERVICE
            value: "openvscode-server"
          - name: DD_VERSION
            value: "1.95.3"
```

**Alternative: Embedded Agent (Single Container)**

```dockerfile
FROM alpine:3.19

# Install Datadog agent
RUN apk add --no-cache curl && \
    DD_AGENT_MAJOR_VERSION=7 DD_INSTALL_ONLY=true \
    bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)" && \
    apk del curl

# Configure agent
COPY datadog.yaml /etc/datadog-agent/datadog.yaml

# Supervisor to manage both processes
RUN apk add --no-cache supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
```

**supervisord.conf:**
```ini
[supervisord]
nodaemon=true

[program:datadog-agent]
command=/opt/datadog-agent/bin/agent/agent run
autostart=true
autorestart=true
stderr_logfile=/var/log/datadog-agent.err.log
stdout_logfile=/var/log/datadog-agent.out.log

[program:openvscode-server]
command=/opt/openvscode-server/bin/openvscode-server --port 3000 --host 0.0.0.0
autostart=true
autorestart=true
stderr_logfile=/var/log/openvscode.err.log
stdout_logfile=/var/log/openvscode.out.log
```

**Recommendation:** Use **sidecar approach** for Azure Container Apps (cleaner, easier to upgrade independently).

### 3.2 APM Configuration for Node.js

**Instrumentation in OpenVSCode Server:**

```javascript
// server/src/main.js (add at the very top)
const tracer = require('dd-trace').init({
  service: 'openvscode-server',
  env: process.env.DD_ENV || 'production',
  version: process.env.DD_VERSION || '1.95.3',
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || 8126,
  runtimeMetrics: true,
  logInjection: true,
  profiling: true,
  tags: {
    'azure.region': process.env.AZURE_REGION || 'eastus',
    'azure.resource_group': process.env.AZURE_RESOURCE_GROUP,
    'container.id': process.env.HOSTNAME,
  },
});

// Add custom tracing
tracer.use('http', {
  headers: ['user-agent', 'x-request-id'],
  hooks: {
    request: (span, req) => {
      span.setTag('user.workspace', req.headers['x-workspace-id']);
    },
  },
});

tracer.use('express', {
  middleware: true,
  routes: ['/api/*'],
});

// Start server
require('./server');
```

**Package.json:**
```json
{
  "dependencies": {
    "dd-trace": "^5.0.0"
  },
  "scripts": {
    "start": "node -r dd-trace/init server/src/main.js"
  }
}
```

### 3.3 Log Collection Setup

**Datadog Agent Configuration (datadog.yaml):**

```yaml
api_key: ${DD_API_KEY}
site: ${DD_SITE}
env: ${DD_ENV}

logs_enabled: true
logs_config:
  container_collect_all: true
  processing_rules:
    - type: exclude_at_match
      name: exclude_healthcheck
      pattern: "GET /healthz"

    - type: mask_sequences
      name: mask_api_keys
      replace_placeholder: "[API_KEY_REDACTED]"
      pattern: "api_key=[A-Za-z0-9]{32}"

apm_config:
  enabled: true
  apm_non_local_traffic: true
  receiver_port: 8126
  profiling_enabled: true
  analyzed_spans:
    openvscode-server|express.request: 1.0

process_config:
  enabled: true
  scrub_args: true

# Custom checks
confd_path: /etc/datadog-agent/conf.d
checks_path: /etc/datadog-agent/checks.d
```

**Application Log Format (Structured JSON):**

```javascript
// Use winston or pino for structured logging
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'openvscode-server',
    dd: {
      trace_id: () => tracer.scope().active()?.context().toTraceId(),
      span_id: () => tracer.scope().active()?.context().toSpanId(),
    },
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/var/log/openvscode/app.log' }),
  ],
});

// Usage
logger.info('User logged in', {
  user_id: '12345',
  workspace_id: 'ws-abc',
  action: 'login',
});
```

### 3.4 Custom Metrics to Track

```javascript
// Custom metrics using StatsD
const StatsD = require('hot-shots');
const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_DOGSTATSD_PORT || 8125,
  prefix: 'openvscode.',
  globalTags: {
    env: process.env.DD_ENV,
    service: 'openvscode-server',
  },
});

// 1. Active workspace sessions
dogstatsd.gauge('workspace.active_sessions', getActiveSessionCount());

// 2. Extension load time
dogstatsd.histogram('extension.load_time_ms', loadTimeMs, {
  extension_id: 'ms-python.python',
});

// 3. File operations
dogstatsd.increment('file.operation', 1, {
  operation: 'save',
  file_type: 'typescript',
});

// 4. MCP server requests
dogstatsd.timing('mcp.request.duration', durationMs, {
  server: 'filesystem',
  operation: 'read',
});

// 5. Memory usage per workspace
dogstatsd.gauge('workspace.memory_mb', process.memoryUsage().heapUsed / 1024 / 1024, {
  workspace_id: workspaceId,
});

// 6. Language server protocol (LSP) latency
dogstatsd.histogram('lsp.response_time_ms', latency, {
  language: 'typescript',
  method: 'textDocument/definition',
});

// 7. Terminal sessions
dogstatsd.gauge('terminal.active_count', terminalCount);

// 8. Extension marketplace API calls
dogstatsd.increment('marketplace.api_call', 1, {
  status: 'success',
  endpoint: 'extension-query',
});
```

**Pre-defined Datadog Integrations:**

```yaml
# /etc/datadog-agent/conf.d/nodejs.yaml
init_config:

instances:
  - host: localhost
    port: 3000
    min_collection_interval: 60
    tags:
      - service:openvscode-server
      - env:production
```

### 3.5 Dashboard Recommendations

**Dashboard 1: OpenVSCode Server Overview**

```json
{
  "title": "OpenVSCode Server - Production Overview",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "title": "Request Throughput (req/s)",
        "requests": [{
          "q": "avg:openvscode.request.count{service:openvscode-server}.as_rate()"
        }]
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "title": "P95 Response Time (ms)",
        "requests": [{
          "q": "p95:openvscode.request.duration{service:openvscode-server}"
        }]
      }
    },
    {
      "definition": {
        "type": "query_value",
        "title": "Active Workspaces",
        "requests": [{
          "q": "sum:openvscode.workspace.active_sessions{*}"
        }]
      }
    },
    {
      "definition": {
        "type": "toplist",
        "title": "Slowest Extensions",
        "requests": [{
          "q": "top(avg:openvscode.extension.load_time_ms{*} by {extension_id}, 10, 'mean', 'desc')"
        }]
      }
    },
    {
      "definition": {
        "type": "heatmap",
        "title": "MCP Request Latency Distribution",
        "requests": [{
          "q": "avg:openvscode.mcp.request.duration{*} by {server}"
        }]
      }
    }
  ]
}
```

**Dashboard 2: Infrastructure Health**

- Container CPU/Memory usage
- Network I/O
- Disk I/O (Azure Files)
- Container restart count
- Error rate by endpoint
- Datadog agent health

**Dashboard 3: User Experience**

- Time to interactive (workspace load)
- Extension activation time
- Language server initialization time
- Terminal spawn time
- File save latency

**Recommended Monitors:**

1. **High Error Rate:** Alert when error rate > 5% for 5 minutes
2. **Slow Response Time:** Alert when P95 > 2000ms for 10 minutes
3. **Memory Leak Detection:** Alert when memory increases >20% over 1 hour
4. **Container Restart Loop:** Alert when restarts > 3 in 15 minutes
5. **Datadog Agent Down:** Alert immediately if agent stops reporting
6. **MCP Server Timeout:** Alert when MCP request duration > 5s

---

## 4. MCP Services Architecture

### 4.1 Running MCP Servers in Container

**Architecture Decision: Multi-Container Sidecar Pattern**

```
┌─────────────────────────────────────────────────────────┐
│  Container Group (Azure Container Apps)                 │
│                                                          │
│  ┌────────────────────┐       ┌────────────────────┐   │
│  │ OpenVSCode Server  │       │ MCP Filesystem     │   │
│  │ :3000              │◄─────►│ :3001              │   │
│  │                    │ HTTP  │ (Node.js)          │   │
│  └────────────────────┘       └────────────────────┘   │
│           │                            │                │
│           │                            │                │
│           │                    ┌────────────────────┐   │
│           │                    │ MCP Git            │   │
│           └───────────────────►│ :3002              │   │
│                    HTTP        │ (Node.js)          │   │
│                                └────────────────────┘   │
│                                         │               │
│                                ┌────────────────────┐   │
│                                │ MCP Database       │   │
│                                │ :3003              │   │
│                                │ (Python)           │   │
│                                └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Container Apps Configuration:**

```yaml
properties:
  template:
    containers:
      - name: openvscode-server
        image: openvscode-mcp:latest
        resources:
          cpu: 1.0
          memory: 2Gi
        env:
          - name: MCP_SERVERS_CONFIG
            value: /config/mcp-servers.json
        volumeMounts:
          - volumeName: config
            mountPath: /config
          - volumeName: workspace
            mountPath: /workspace

      - name: mcp-filesystem
        image: mcp-server-filesystem:latest
        resources:
          cpu: 0.25
          memory: 256Mi
        env:
          - name: MCP_PORT
            value: "3001"
          - name: ALLOWED_PATHS
            value: /workspace
        volumeMounts:
          - volumeName: workspace
            mountPath: /workspace

      - name: mcp-git
        image: mcp-server-git:latest
        resources:
          cpu: 0.25
          memory: 256Mi
        env:
          - name: MCP_PORT
            value: "3002"
        volumeMounts:
          - volumeName: workspace
            mountPath: /workspace

      - name: mcp-database
        image: mcp-server-database:latest
        resources:
          cpu: 0.25
          memory: 512Mi
        env:
          - name: MCP_PORT
            value: "3003"
          - name: DB_CONNECTION_STRING
            secretRef: database-connection-string

    volumes:
      - name: config
        storageType: AzureFile
        storageName: openvscode-config
      - name: workspace
        storageType: AzureFile
        storageName: openvscode-workspace
```

### 4.2 IPC vs HTTP Communication

**Comparison:**

| Aspect | IPC (Unix Domain Sockets) | HTTP |
|--------|--------------------------|------|
| **Performance** | ~50% faster | Sufficient for most cases |
| **Complexity** | Medium | Low |
| **Debugging** | Harder (no tcpdump) | Easy (curl, browser dev tools) |
| **Azure Support** | Limited (requires shared volume) | Native |
| **Load Balancing** | Not possible | Easy with Azure services |
| **Language Agnostic** | Yes | Yes |
| **Authentication** | File permissions | Bearer tokens, API keys |

**Recommendation: HTTP (REST/JSON-RPC over HTTP)**

**Rationale:**
1. Azure Container Apps has native HTTP routing
2. Easier to add authentication/authorization
3. Can scale MCP servers independently
4. Better observability (Datadog can trace HTTP)
5. Works with Azure API Management for rate limiting

**Implementation:**

```typescript
// OpenVSCode Server - MCP Client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

class MCPManager {
  private clients: Map<string, Client> = new Map();

  async connectToServer(serverName: string, url: string) {
    const transport = new SSEClientTransport(new URL(url));
    const client = new Client({
      name: 'openvscode-client',
      version: '1.0.0',
    }, {
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
    });

    await client.connect(transport);
    this.clients.set(serverName, client);

    // Add Datadog tracing
    this.instrumentClient(client, serverName);
  }

  private instrumentClient(client: Client, serverName: string) {
    const originalSend = client.request.bind(client);
    client.request = async (request: any) => {
      const span = tracer.startSpan('mcp.request', {
        tags: {
          'mcp.server': serverName,
          'mcp.method': request.method,
        },
      });

      try {
        const response = await originalSend(request);
        span.setTag('mcp.status', 'success');
        return response;
      } catch (error) {
        span.setTag('mcp.status', 'error');
        span.setTag('error', true);
        throw error;
      } finally {
        span.finish();
      }
    };
  }
}
```

### 4.3 Example MCP Server Configurations

**mcp-servers.json** (mounted in container):

```json
{
  "mcpServers": {
    "filesystem": {
      "url": "http://localhost:3001/sse",
      "transport": "sse",
      "timeout": 5000,
      "capabilities": ["resources", "tools"],
      "description": "Access workspace files and directories",
      "env": {
        "ALLOWED_PATHS": "/workspace"
      }
    },
    "git": {
      "url": "http://localhost:3002/sse",
      "transport": "sse",
      "timeout": 10000,
      "capabilities": ["tools", "prompts"],
      "description": "Git operations and version control",
      "env": {
        "GIT_WORKSPACE": "/workspace"
      }
    },
    "database": {
      "url": "http://localhost:3003/sse",
      "transport": "sse",
      "timeout": 30000,
      "capabilities": ["resources", "tools"],
      "description": "Database query and management",
      "env": {
        "DB_TYPE": "postgresql",
        "DB_MAX_CONNECTIONS": "10"
      }
    },
    "azure-resources": {
      "url": "http://localhost:3004/sse",
      "transport": "sse",
      "timeout": 30000,
      "capabilities": ["resources", "tools"],
      "description": "Azure resource management",
      "env": {
        "AZURE_SUBSCRIPTION_ID": "${AZURE_SUBSCRIPTION_ID}",
        "AZURE_TENANT_ID": "${AZURE_TENANT_ID}"
      },
      "auth": {
        "type": "managed-identity"
      }
    }
  }
}
```

**MCP Server Implementation (Filesystem Server):**

```typescript
// mcp-servers/filesystem/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_PATHS = process.env.ALLOWED_PATHS?.split(':') || ['/workspace'];

const server = new Server({
  name: 'filesystem-server',
  version: '1.0.0',
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Implement MCP protocol handlers
server.setRequestHandler('resources/list', async () => {
  const files = await fs.readdir(ALLOWED_PATHS[0], { recursive: true });
  return {
    resources: files.map(file => ({
      uri: `file://${path.join(ALLOWED_PATHS[0], file)}`,
      name: file,
      mimeType: 'application/octet-stream',
    })),
  };
});

server.setRequestHandler('resources/read', async (request) => {
  const filePath = new URL(request.params.uri).pathname;

  // Security check
  if (!ALLOWED_PATHS.some(p => filePath.startsWith(p))) {
    throw new Error('Access denied: Path not in allowed list');
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: 'text/plain',
      text: content,
    }],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'write_file':
      await fs.writeFile(args.path, args.content);
      return { content: [{ type: 'text', text: 'File written successfully' }] };

    case 'search_files':
      // Implement grep-like functionality
      const results = await searchFiles(args.pattern, args.path);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// HTTP/SSE transport (for Azure Container Apps)
const app = express();
app.use(express.json());

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  // Handle SSE messages
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', server: 'filesystem-server' });
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, () => {
  console.log(`MCP Filesystem Server listening on port ${PORT}`);
});
```

### 4.4 Extension Integration Patterns

**VS Code Extension for MCP (Claude Code Extension):**

```typescript
// extensions/mcp-client/src/extension.ts
import * as vscode from 'vscode';
import { MCPManager } from './mcpManager';

export function activate(context: vscode.ExtensionContext) {
  const mcpManager = new MCPManager();

  // Load MCP servers from config
  const config = vscode.workspace.getConfiguration('mcp');
  const serversConfig = config.get<any>('servers');

  // Connect to all configured servers
  for (const [name, serverConfig] of Object.entries(serversConfig)) {
    mcpManager.connectToServer(name, serverConfig.url);
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mcp.listResources', async () => {
      const resources = await mcpManager.listResources('filesystem');
      // Display in Quick Pick
      const selected = await vscode.window.showQuickPick(
        resources.map(r => ({ label: r.name, description: r.uri }))
      );
      if (selected) {
        const content = await mcpManager.readResource('filesystem', selected.description);
        // Open in editor
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp.callTool', async () => {
      const tools = await mcpManager.listTools();
      const selected = await vscode.window.showQuickPick(tools);
      // Execute tool
    })
  );

  // Register completion provider (AI-powered)
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('*', {
      async provideCompletionItems(document, position) {
        // Use MCP to get AI completions
        const context = document.getText(
          new vscode.Range(position.translate(-10), position)
        );

        const completions = await mcpManager.callTool('ai-completions', {
          prompt: context,
          language: document.languageId,
        });

        return completions.map(c => new vscode.CompletionItem(c.text));
      },
    })
  );
}
```

**Settings.json for Extension:**

```json
{
  "mcp.servers": {
    "filesystem": {
      "url": "http://localhost:3001/sse"
    },
    "git": {
      "url": "http://localhost:3002/sse"
    }
  },
  "mcp.enableAutoComplete": true,
  "mcp.enableCodeActions": true,
  "mcp.telemetry": {
    "enabled": true,
    "endpoint": "https://your-datadog-endpoint"
  }
}
```

---

## 5. File System Layout

```
/
├── opt/
│   ├── openvscode-server/          # IDE installation
│   │   ├── bin/
│   │   │   └── openvscode-server   # Main binary
│   │   ├── extensions/             # Built-in extensions
│   │   ├── node_modules/           # Dependencies
│   │   └── resources/              # UI assets
│   │
│   ├── mcp-servers/                # MCP service binaries
│   │   ├── filesystem/
│   │   │   ├── index.js
│   │   │   ├── package.json
│   │   │   └── node_modules/
│   │   ├── git/
│   │   ├── database/
│   │   └── azure-resources/
│   │
│   └── datadog/                    # Datadog agent (if embedded)
│       ├── bin/
│       ├── conf.d/
│       └── checks.d/
│
├── workspace/                      # User workspace (Azure Files)
│   ├── projects/                   # User code
│   ├── .git/                       # Git repositories
│   └── .vscode/                    # Workspace settings
│
├── config/                         # Configuration (Azure Files)
│   ├── mcp-servers.json            # MCP server config
│   ├── settings.json               # VS Code settings
│   ├── keybindings.json            # Custom keybindings
│   └── extensions.json             # Extension config
│
├── home/
│   └── vscode/                     # User home directory
│       ├── .bashrc
│       ├── .vscode-server/         # VS Code server data
│       ├── .local/                 # User-installed tools
│       └── .ssh/                   # SSH keys (mounted secret)
│
├── var/
│   └── log/                        # Application logs
│       ├── openvscode/
│       │   ├── app.log             # Application logs
│       │   └── access.log          # HTTP access logs
│       ├── mcp/                    # MCP server logs
│       │   ├── filesystem.log
│       │   ├── git.log
│       │   └── database.log
│       └── datadog/                # Datadog agent logs
│
└── tmp/                            # Temporary files
    ├── mcp/                        # MCP temp files
    └── workspace/                  # Workspace temp files
```

**Volume Mounts (Azure Container Apps):**

```yaml
volumeMounts:
  # Persistent workspace (Azure Files)
  - volumeName: workspace
    mountPath: /workspace
    readOnly: false

  # Configuration (Azure Files)
  - volumeName: config
    mountPath: /config
    readOnly: true

  # SSH keys (Azure Key Vault secret)
  - volumeName: ssh-keys
    mountPath: /home/vscode/.ssh
    readOnly: true

  # Temporary files (emptyDir)
  - volumeName: tmp
    mountPath: /tmp

  # Logs (emptyDir, streamed to Log Analytics)
  - volumeName: logs
    mountPath: /var/log

volumes:
  - name: workspace
    storageType: AzureFile
    storageName: openvscode-workspace

  - name: config
    storageType: AzureFile
    storageName: openvscode-config

  - name: ssh-keys
    storageType: Secret
    secrets:
      - secretRef: ssh-private-key
        path: id_rsa
      - secretRef: ssh-public-key
        path: id_rsa.pub

  - name: tmp
    storageType: EmptyDir

  - name: logs
    storageType: EmptyDir
```

---

## 6. Environment Configuration

### 6.1 Required Environment Variables

```bash
# ============================================
# Azure Configuration
# ============================================
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_RESOURCE_GROUP=openvscode-rg
AZURE_REGION=eastus
AZURE_STORAGE_ACCOUNT=openvscodestorage
AZURE_FILES_SHARE_WORKSPACE=workspace
AZURE_FILES_SHARE_CONFIG=config

# ============================================
# Datadog Configuration
# ============================================
DD_API_KEY=<from-azure-key-vault>
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=openvscode-server
DD_VERSION=1.95.3
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_DOGSTATSD_PORT=8125
DD_LOGS_ENABLED=true
DD_APM_ENABLED=true
DD_PROFILING_ENABLED=true

# ============================================
# OpenVSCode Server Configuration
# ============================================
OPENVSCODE_SERVER_PORT=3000
OPENVSCODE_SERVER_HOST=0.0.0.0
OPENVSCODE_SERVER_CONNECTION_TOKEN=<random-token>
OPENVSCODE_SERVER_WORKSPACE=/workspace
OPENVSCODE_SERVER_USER_DATA_DIR=/home/vscode/.vscode-server
OPENVSCODE_SERVER_EXTENSIONS_DIR=/opt/openvscode-server/extensions

# ============================================
# MCP Configuration
# ============================================
MCP_SERVERS_CONFIG=/config/mcp-servers.json
MCP_FILESYSTEM_PORT=3001
MCP_GIT_PORT=3002
MCP_DATABASE_PORT=3003
MCP_AZURE_RESOURCES_PORT=3004

# ============================================
# Security & Authentication
# ============================================
AUTH_TYPE=oauth2  # or none, basic, token
OAUTH2_CLIENT_ID=<from-azure-key-vault>
OAUTH2_CLIENT_SECRET=<from-azure-key-vault>
OAUTH2_REDIRECT_URI=https://your-app.azurecontainerapps.io/oauth/callback
ALLOWED_DOMAINS=yourdomain.com,yourcompany.com

# ============================================
# Logging & Monitoring
# ============================================
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json
ENABLE_ACCESS_LOGS=true
TELEMETRY_ENDPOINT=https://api.datadoghq.com

# ============================================
# Performance Tuning
# ============================================
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=1536"
UV_THREADPOOL_SIZE=128
WORKSPACE_MAX_SIZE_GB=50

# ============================================
# Feature Flags
# ============================================
ENABLE_MCP_SERVERS=true
ENABLE_TERMINAL=true
ENABLE_EXTENSIONS_MARKETPLACE=true
ENABLE_GIT_INTEGRATION=true
ENABLE_REMOTE_TUNNELS=false
```

### 6.2 Secret Management Strategy

**Use Azure Key Vault (Recommended):**

```bash
# Create Key Vault
az keyvault create \
  --name openvscode-kv \
  --resource-group openvscode-rg \
  --location eastus

# Store secrets
az keyvault secret set --vault-name openvscode-kv \
  --name datadog-api-key --value "xxx"
az keyvault secret set --vault-name openvscode-kv \
  --name oauth2-client-secret --value "xxx"
az keyvault secret set --vault-name openvscode-kv \
  --name ssh-private-key --file ~/.ssh/id_rsa

# Grant Container App managed identity access
IDENTITY_ID=$(az containerapp show \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --query identity.principalId -o tsv)

az keyvault set-policy \
  --name openvscode-kv \
  --object-id $IDENTITY_ID \
  --secret-permissions get list
```

**Reference in Container Apps:**

```yaml
properties:
  configuration:
    secrets:
      - name: datadog-api-key
        keyVaultUrl: https://openvscode-kv.vault.azure.net/secrets/datadog-api-key
      - name: oauth2-client-secret
        keyVaultUrl: https://openvscode-kv.vault.azure.net/secrets/oauth2-client-secret

  template:
    containers:
      - name: openvscode-server
        env:
          - name: DD_API_KEY
            secretRef: datadog-api-key
          - name: OAUTH2_CLIENT_SECRET
            secretRef: oauth2-client-secret
```

---

## 7. Networking Design

### 7.1 Port Allocation

```
┌─────────────────────────────────────────────────────────┐
│  Container Group                                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ OpenVSCode Server                                  │ │
│  │   :3000  ◄─── HTTP/WebSocket (IDE interface)      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ MCP Servers (internal only)                        │ │
│  │   :3001  ◄─── Filesystem server                   │ │
│  │   :3002  ◄─── Git server                          │ │
│  │   :3003  ◄─── Database server                     │ │
│  │   :3004  ◄─── Azure resources server              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Datadog Agent (internal only)                      │ │
│  │   :8125  ◄─── DogStatsD (UDP)                     │ │
│  │   :8126  ◄─── APM traces                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│  Azure Container Apps Ingress                            │
│  External :443 (HTTPS) ───► Internal :3000               │
└─────────────────────────────────────────────────────────┘
```

**Ingress Configuration:**

```yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 3000
      transport: auto  # HTTP/2, WebSocket support
      allowInsecure: false
      traffic:
        - latestRevision: true
          weight: 100
      customDomains:
        - name: ide.yourdomain.com
          certificateId: /subscriptions/.../certificates/wildcard-cert
      corsPolicy:
        allowedOrigins:
          - https://yourdomain.com
        allowedMethods:
          - GET
          - POST
          - OPTIONS
        allowedHeaders:
          - Content-Type
          - Authorization
        allowCredentials: true
```

### 7.2 Network Security

```yaml
# Network Security Group (if using VNet integration)
az network nsg rule create \
  --nsg-name openvscode-nsg \
  --name AllowHTTPS \
  --priority 100 \
  --source-address-prefixes Internet \
  --destination-port-ranges 443 \
  --access Allow \
  --protocol Tcp

# Restrict to corporate IP ranges
az containerapp ingress access-restriction rule add \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --rule-name corporate-network \
  --ip-address 203.0.113.0/24 \
  --action Allow

# Enable Azure Front Door for DDoS protection
az afd profile create \
  --profile-name openvscode-afd \
  --resource-group openvscode-rg \
  --sku Premium_AzureFrontDoor
```

### 7.3 Service-to-Service Communication

**Internal DNS (Container Apps Environment):**

```bash
# MCP servers can reach each other via:
# http://<container-name>:port
# Example: http://mcp-filesystem:3001
```

**Dapr Service Discovery (Optional):**

```yaml
properties:
  template:
    containers:
      - name: openvscode-server
        env:
          - name: DAPR_HTTP_PORT
            value: "3500"
          - name: MCP_FILESYSTEM_URL
            value: http://localhost:3500/v1.0/invoke/mcp-filesystem/method/sse

    dapr:
      enabled: true
      appId: openvscode-server
      appPort: 3000
```

---

## 8. Storage Strategy

### 8.1 Azure Files vs Azure Blob

**Comparison:**

| Aspect | Azure Files (SMB/NFS) | Azure Blob (Block) |
|--------|----------------------|-------------------|
| **Protocol** | SMB 3.0, NFS 4.1 | REST API |
| **POSIX Compliance** | Full (NFS) / Partial (SMB) | None |
| **Performance** | Up to 100K IOPS | 20K IOPS per blob |
| **Latency** | 1-5ms | 10-20ms |
| **Concurrent Access** | Excellent | Limited |
| **Cost (100GB)** | $20/month | $2/month |
| **Max File Size** | 4 TiB | 190 TiB |
| **Best For** | Shared workspace | Backups, archives |

**Recommendation:**

1. **Azure Files (Premium SMB)** for `/workspace` - User code, Git repos
2. **Azure Blob (Hot tier)** for backups and archives
3. **EmptyDir** for `/tmp` and logs (ephemeral)

### 8.2 Storage Configuration

**Create Storage Account:**

```bash
# Create storage account
az storage account create \
  --name openvscodestorage \
  --resource-group openvscode-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2

# Create file shares
az storage share create \
  --name workspace \
  --account-name openvscodestorage \
  --quota 100

az storage share create \
  --name config \
  --account-name openvscodestorage \
  --quota 10

# Get storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name openvscodestorage \
  --query '[0].value' -o tsv)

# Add to Container Apps environment
az containerapp env storage set \
  --name openvscode-env \
  --resource-group openvscode-rg \
  --storage-name workspace \
  --storage-type AzureFile \
  --azure-file-account-name openvscodestorage \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name workspace \
  --access-mode ReadWrite
```

### 8.3 Backup Strategy

```bash
# Azure Backup for Files
az backup vault create \
  --name openvscode-backup-vault \
  --resource-group openvscode-rg \
  --location eastus

az backup protection enable-for-azurefileshare \
  --vault-name openvscode-backup-vault \
  --resource-group openvscode-rg \
  --policy-name DefaultPolicy \
  --storage-account openvscodestorage \
  --azure-file-share workspace

# Daily snapshots
az storage share snapshot \
  --name workspace \
  --account-name openvscodestorage
```

### 8.4 Size Recommendations

| Component | Initial Size | Growth Rate | Recommended Monitoring |
|-----------|-------------|-------------|------------------------|
| Workspace | 50 GB | 5 GB/month | Alert at 80% |
| Config | 1 GB | 100 MB/month | Alert at 80% |
| Logs | 5 GB (rotating) | N/A | Log Analytics retention |
| Backups | 50 GB | 10 GB/month | Archive old backups |

---

## 9. Security Hardening

### 9.1 Container Security Checklist

- [ ] **Run as non-root user** (`USER vscode`)
- [ ] **Read-only root filesystem** (`readOnlyRootFilesystem: true`)
- [ ] **Drop all capabilities** (`drop: [ALL]`)
- [ ] **No privileged mode** (`privileged: false`)
- [ ] **Resource limits enforced** (CPU/memory limits)
- [ ] **Secrets in Key Vault** (not environment variables)
- [ ] **Vulnerability scanning** (Trivy, Snyk)
- [ ] **Image signing** (Docker Content Trust)
- [ ] **Network policies** (ingress/egress rules)
- [ ] **HTTPS only** (TLS 1.2+)
- [ ] **SBOM available** (Syft, CycloneDX)
- [ ] **Regular updates** (base image + dependencies)

### 9.2 Azure Security Best Practices

```yaml
# Enable Managed Identity
identity:
  type: SystemAssigned

# Disable HTTP
properties:
  configuration:
    ingress:
      allowInsecure: false

# Enable Azure Defender
az security pricing create \
  --name ContainerApps \
  --tier Standard

# Enable diagnostic logs
az monitor diagnostic-settings create \
  --name openvscode-diagnostics \
  --resource <container-app-id> \
  --logs '[{"category":"ContainerAppConsoleLogs","enabled":true}]' \
  --workspace <log-analytics-workspace-id>

# Enable Azure Policy
az policy assignment create \
  --name 'container-no-privileged' \
  --policy '/providers/Microsoft.Authorization/policyDefinitions/95edb821-ddaf-4404-9732-666045e056b4' \
  --scope /subscriptions/<sub-id>/resourceGroups/openvscode-rg
```

### 9.3 Authentication & Authorization

**OAuth2 with Azure AD:**

```javascript
// server/src/auth.js
const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;

passport.use(new OIDCStrategy({
  identityMetadata: `https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`,
  clientID: process.env.OAUTH2_CLIENT_ID,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET,
  redirectUrl: process.env.OAUTH2_REDIRECT_URI,
  allowHttpForRedirectUrl: false,
  responseType: 'code',
  responseMode: 'query',
  scope: ['openid', 'profile', 'email'],
  validateIssuer: true,
}, (iss, sub, profile, accessToken, refreshToken, done) => {
  // Verify user is in allowed group
  if (!profile._json.groups?.includes(ALLOWED_GROUP_ID)) {
    return done(null, false, { message: 'Unauthorized' });
  }
  return done(null, profile);
}));

app.get('/login', passport.authenticate('azuread-openidconnect', { failureRedirect: '/login-failed' }));

app.get('/oauth/callback',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);
```

---

## 10. Deployment Guide

### 10.1 Dockerfile

```dockerfile
# =========================================
# Stage 1: Builder
# =========================================
FROM node:20-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache \
    git curl python3 make g++ \
    libx11-dev libxkbfile-dev libsecret-dev

# Download OpenVSCode Server
ARG OPENVSCODE_VERSION=1.95.3
RUN curl -fsSL https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-x64.tar.gz \
    | tar -xz -C /build --strip-components=1

# Install MCP SDK
RUN npm install -g @modelcontextprotocol/sdk

# Build MCP servers
COPY mcp-servers/ /build/mcp-servers/
RUN cd /build/mcp-servers/filesystem && npm install --production && npm run build && \
    cd /build/mcp-servers/git && npm install --production && npm run build

# =========================================
# Stage 2: Runtime
# =========================================
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    nodejs npm git bash curl \
    ca-certificates libstdc++ \
    openssh-client

# Create non-root user
RUN addgroup -g 1000 vscode && \
    adduser -u 1000 -G vscode -s /bin/bash -D vscode

# Copy OpenVSCode Server
COPY --from=builder --chown=vscode:vscode /build /opt/openvscode-server

# Copy MCP servers
COPY --from=builder --chown=vscode:vscode /build/mcp-servers /opt/mcp-servers

# Install VS Code extensions
USER vscode
RUN /opt/openvscode-server/bin/openvscode-server \
    --install-extension dbaeumer.vscode-eslint \
    --install-extension esbenp.prettier-vscode \
    --install-extension ms-python.python \
    --install-extension ms-azuretools.vscode-docker \
    --install-extension GitHub.copilot \
    && rm -rf /tmp/*

# Create directories
RUN mkdir -p /workspace /config /home/vscode/.vscode-server

# Copy entrypoint script
COPY --chown=vscode:vscode docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/healthz || exit 1

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/opt/openvscode-server/bin/openvscode-server", \
     "--host", "0.0.0.0", \
     "--port", "3000", \
     "--without-connection-token"]
```

**entrypoint.sh:**

```bash
#!/bin/bash
set -euo pipefail

# Start MCP servers in background
/opt/mcp-servers/filesystem/index.js &
/opt/mcp-servers/git/index.js &

# Configure Datadog tracing
export DD_TRACE_STARTUP_LOGS=true
export DD_TRACE_DEBUG=false

# Wait for MCP servers to start
sleep 2

# Start OpenVSCode Server
exec "$@"
```

### 10.2 Build and Push

```bash
# Set variables
REGISTRY=openvscodecr.azurecr.io
IMAGE_NAME=openvscode-mcp
VERSION=1.95.3

# Build multi-architecture image
docker buildx create --use --name multiarch-builder
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag $REGISTRY/$IMAGE_NAME:$VERSION \
  --tag $REGISTRY/$IMAGE_NAME:latest \
  --build-arg OPENVSCODE_VERSION=$VERSION \
  --push \
  .

# Scan for vulnerabilities
trivy image $REGISTRY/$IMAGE_NAME:$VERSION

# Generate SBOM
syft $REGISTRY/$IMAGE_NAME:$VERSION -o spdx-json > sbom.json
```

### 10.3 Azure CLI Deployment Commands

**1. Create Resource Group:**

```bash
RESOURCE_GROUP=openvscode-rg
LOCATION=eastus

az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

**2. Create Container Registry:**

```bash
REGISTRY_NAME=openvscodecr

az acr create \
  --name $REGISTRY_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku Basic \
  --admin-enabled true

# Login
az acr login --name $REGISTRY_NAME
```

**3. Create Log Analytics Workspace:**

```bash
WORKSPACE_NAME=openvscode-logs

az monitor log-analytics workspace create \
  --workspace-name $WORKSPACE_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

**4. Create Container Apps Environment:**

```bash
ENV_NAME=openvscode-env

az containerapp env create \
  --name $ENV_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --logs-workspace-id $(az monitor log-analytics workspace show \
    --workspace-name $WORKSPACE_NAME \
    --resource-group $RESOURCE_GROUP \
    --query customerId -o tsv) \
  --logs-workspace-key $(az monitor log-analytics workspace get-shared-keys \
    --workspace-name $WORKSPACE_NAME \
    --resource-group $RESOURCE_GROUP \
    --query primarySharedKey -o tsv)
```

**5. Create Storage and Secrets:**

```bash
# Storage account
STORAGE_ACCOUNT=openvscodestorage
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_LRS

# File shares
az storage share create --name workspace --account-name $STORAGE_ACCOUNT --quota 100
az storage share create --name config --account-name $STORAGE_ACCOUNT --quota 10

# Add storage to environment
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --query '[0].value' -o tsv)

az containerapp env storage set \
  --name $ENV_NAME \
  --resource-group $RESOURCE_GROUP \
  --storage-name workspace \
  --storage-type AzureFile \
  --azure-file-account-name $STORAGE_ACCOUNT \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name workspace \
  --access-mode ReadWrite

# Key Vault for secrets
KEYVAULT_NAME=openvscode-kv
az keyvault create \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store Datadog API key
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name datadog-api-key \
  --value "YOUR_DATADOG_API_KEY"
```

**6. Deploy Container App:**

```bash
APP_NAME=openvscode-app

# Create app with managed identity
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENV_NAME \
  --image $REGISTRY_NAME.azurecr.io/openvscode-mcp:latest \
  --registry-server $REGISTRY_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $REGISTRY_NAME --query username -o tsv) \
  --registry-password $(az acr credential show --name $REGISTRY_NAME --query 'passwords[0].value' -o tsv) \
  --target-port 3000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars \
    DD_SITE=datadoghq.com \
    DD_ENV=production \
    DD_SERVICE=openvscode-server \
    DD_VERSION=1.95.3 \
    OPENVSCODE_SERVER_PORT=3000 \
  --system-assigned

# Get managed identity ID
IDENTITY_ID=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query identity.principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $IDENTITY_ID \
  --secret-permissions get list

# Add secrets from Key Vault
az containerapp secret set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --secrets \
    datadog-api-key=keyvaultref:https://$KEYVAULT_NAME.vault.azure.net/secrets/datadog-api-key,identityref:system

# Update app to use secrets
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars DD_API_KEY=secretref:datadog-api-key
```

**7. Add Storage Mounts:**

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --add-volume name=workspace,storage-name=workspace \
  --add-mount volume=workspace,mount-path=/workspace
```

**8. Configure Scaling:**

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 5 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 10
```

**9. Get App URL:**

```bash
APP_URL=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "OpenVSCode Server URL: https://$APP_URL"
```

### 10.4 Bicep Template (Infrastructure as Code)

```bicep
// main.bicep
@description('Location for all resources')
param location string = resourceGroup().location

@description('Container registry name')
param registryName string

@description('Container image tag')
param imageTag string = 'latest'

@description('Datadog API key')
@secure()
param datadogApiKey string

// Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// Log Analytics
resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'openvscode-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'openvscodestorage${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}

resource workspaceShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storageAccount.name}/default/workspace'
  properties: {
    shareQuota: 100
  }
}

resource configShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storageAccount.name}/default/config'
  properties: {
    shareQuota: 10
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'openvscode-kv-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}

resource datadogSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'datadog-api-key'
  properties: {
    value: datadogApiKey
  }
}

// Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'openvscode-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

resource storageMount 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: environment
  name: 'workspace'
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: 'workspace'
      accessMode: 'ReadWrite'
    }
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'openvscode-app'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'datadog-api-key'
          keyVaultUrl: datadogSecret.properties.secretUri
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'openvscode-server'
          image: '${acr.properties.loginServer}/openvscode-mcp:${imageTag}'
          resources: {
            cpu: 1
            memory: '2Gi'
          }
          env: [
            {
              name: 'DD_API_KEY'
              secretRef: 'datadog-api-key'
            }
            {
              name: 'DD_SITE'
              value: 'datadoghq.com'
            }
            {
              name: 'DD_ENV'
              value: 'production'
            }
            {
              name: 'DD_SERVICE'
              value: 'openvscode-server'
            }
            {
              name: 'DD_VERSION'
              value: '1.95.3'
            }
          ]
          volumeMounts: [
            {
              volumeName: 'workspace'
              mountPath: '/workspace'
            }
          ]
        }
        {
          name: 'datadog-agent'
          image: 'gcr.io/datadoghq/agent:7'
          resources: {
            cpu: 0.5
            memory: '512Mi'
          }
          env: [
            {
              name: 'DD_API_KEY'
              secretRef: 'datadog-api-key'
            }
            {
              name: 'DD_APM_ENABLED'
              value: 'true'
            }
            {
              name: 'DD_APM_NON_LOCAL_TRAFFIC'
              value: 'true'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
      volumes: [
        {
          name: 'workspace'
          storageName: 'workspace'
          storageType: 'AzureFile'
        }
      ]
    }
  }
}

// Grant Key Vault access to Container App
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, containerApp.id, 'KeyVaultSecretsUser')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output registryLoginServer string = acr.properties.loginServer
```

**Deploy Bicep:**

```bash
az deployment group create \
  --resource-group openvscode-rg \
  --template-file main.bicep \
  --parameters \
    registryName=openvscodecr \
    imageTag=latest \
    datadogApiKey="YOUR_API_KEY"
```

---

## 11. Cost Analysis

### 11.1 Azure Container Apps Pricing (East US)

**Consumption Plan:**

```
Base Costs (per month):
- Consumption vCPU: $0.000024/vCPU-second
- Consumption Memory: $0.000002667/GB-second

Example: 1 vCPU, 2 GB RAM, 24/7 operation:
  vCPU:    1 × $0.000024 × 2,592,000 seconds = $62.21
  Memory:  2 × $0.000002667 × 2,592,000 seconds = $13.82
  Total: $76.03/month
```

**Dedicated Plan (Workload Profiles):**

```
D4 Profile (4 vCPU, 16 GB RAM):
- Cost: $0.304/hour = $221/month
- Can run multiple containers
- Better for consistent workloads

D2 Profile (2 vCPU, 8 GB RAM):
- Cost: $0.152/hour = $110/month
```

### 11.2 Total Cost Breakdown (Single Container, 24/7)

| Component | Consumption Plan | Dedicated Plan (D2) |
|-----------|-----------------|---------------------|
| **Compute (Container Apps)** | $76 | $110 |
| **Azure Files (100 GB)** | $20 | $20 |
| **Log Analytics (10 GB/month)** | $2.30 | $2.30 |
| **Container Registry (Basic)** | $5 | $5 |
| **Key Vault** | $0.03 | $0.03 |
| **Bandwidth (50 GB egress)** | $4.30 | $4.30 |
| **Datadog (Pro plan)** | $15 | $15 |
| **Azure Backup (optional)** | $5 | $5 |
| **Total** | **$127.63** | **$161.63** |

**Cost Optimization Tips:**

1. **Scale to Zero:** Enable autoscaling to 0 replicas during non-business hours → Save 50%
2. **Use Azure Files Standard instead of Premium:** Save $10/month
3. **Reduce Log Retention:** 7 days instead of 30 → Save $1.50/month
4. **Use Datadog Logs without Live Tail:** Save $5/month
5. **Reserved Capacity:** 1-year commitment → Save 20%

**Optimized Cost (with scale-to-zero):**

```
Compute (12 hours/day): $38/month
Storage: $20/month
Services: $26.63/month
Datadog: $10/month (reduced tier)
Total: $94.63/month
```

### 11.3 Alternative Services Cost Comparison

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| **Azure Container Apps (Consumption)** | $94-127 | Recommended, scales to zero |
| **Azure Container Instances** | $45 | No autoscaling, basic features |
| **Azure Web App (B1)** | $55 | Fixed cost, limited resources |
| **Azure Web App (P1v3)** | $120 | Better performance, deployment slots |
| **Azure Kubernetes Service** | $200+ | Overkill for single app, complex |

---

## 12. Scaling Strategy

### 12.1 Horizontal Scaling (Replicas)

```yaml
properties:
  template:
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        # HTTP-based scaling
        - name: http-rule
          http:
            metadata:
              concurrentRequests: "10"

        # CPU-based scaling
        - name: cpu-rule
          custom:
            type: cpu
            metadata:
              type: Utilization
              value: "70"

        # Memory-based scaling
        - name: memory-rule
          custom:
            type: memory
            metadata:
              type: Utilization
              value: "80"

        # Time-based scaling (CRON)
        - name: business-hours
          custom:
            type: cron
            metadata:
              timezone: "America/New_York"
              start: "0 8 * * MON-FRI"  # 8 AM weekdays
              end: "0 18 * * MON-FRI"   # 6 PM weekdays
              desiredReplicas: "3"
```

### 12.2 Vertical Scaling (Resources)

```bash
# Scale up resources
az containerapp update \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --cpu 2.0 \
  --memory 4Gi

# Create revision with new resources (zero-downtime)
az containerapp revision copy \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --cpu 2.0 \
  --memory 4Gi
```

### 12.3 Performance Benchmarks

**Expected Performance (1 vCPU, 2 GB RAM):**

- **Concurrent Users:** 5-10
- **Workspace Load Time:** 3-5 seconds
- **Extension Activation:** 1-3 seconds
- **File Save Latency:** <100ms
- **Memory per Session:** ~200 MB
- **CPU per Session:** 10-20%

**Scaling Recommendations:**

| Concurrent Users | vCPU | Memory | Replicas |
|-----------------|------|--------|----------|
| 1-5 | 1 | 2 GB | 1 |
| 5-10 | 1 | 2 GB | 2 |
| 10-25 | 2 | 4 GB | 2-3 |
| 25-50 | 2 | 4 GB | 3-5 |
| 50-100 | 4 | 8 GB | 5-10 |

### 12.4 Blue-Green Deployment

```bash
# Deploy new version as revision
az containerapp revision copy \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --image openvscodecr.azurecr.io/openvscode-mcp:v2.0.0

# Split traffic (blue-green)
az containerapp ingress traffic set \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --revision-weight \
    openvscode-app--v1=50 \
    openvscode-app--v2=50

# Full cutover
az containerapp ingress traffic set \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --revision-weight \
    openvscode-app--v2=100

# Rollback if needed
az containerapp ingress traffic set \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --revision-weight \
    openvscode-app--v1=100
```

---

## 13. Monitoring & Observability

### 13.1 Datadog Dashboard Configuration

**Import Dashboard JSON:**

```json
{
  "title": "OpenVSCode Server - Production",
  "description": "Comprehensive monitoring for OpenVSCode Server on Azure",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "type": "timeseries",
        "requests": [{
          "q": "avg:azure.containerapp.requests{service:openvscode-server}.as_rate()",
          "display_type": "line"
        }],
        "title": "Request Rate"
      }
    },
    {
      "id": 2,
      "definition": {
        "type": "timeseries",
        "requests": [{
          "q": "avg:azure.containerapp.cpu_usage{service:openvscode-server}",
          "display_type": "area"
        }],
        "title": "CPU Usage (%)"
      }
    },
    {
      "id": 3,
      "definition": {
        "type": "query_value",
        "requests": [{
          "q": "avg:azure.containerapp.replica_count{service:openvscode-server}",
          "aggregator": "last"
        }],
        "title": "Active Replicas"
      }
    },
    {
      "id": 4,
      "definition": {
        "type": "heatmap",
        "requests": [{
          "q": "avg:trace.express.request.duration{service:openvscode-server} by {resource_name}"
        }],
        "title": "Endpoint Latency Distribution"
      }
    }
  ],
  "template_variables": [
    {
      "name": "env",
      "default": "production",
      "prefix": "env"
    }
  ],
  "layout_type": "ordered"
}
```

### 13.2 Alerting Rules

```yaml
# Monitor 1: High Error Rate
name: "OpenVSCode - High Error Rate"
type: metric alert
query: "avg(last_5m):sum:trace.express.request.errors{service:openvscode-server}.as_rate() > 10"
message: |
  OpenVSCode Server error rate is {{value}} errors/sec
  Check logs: https://app.datadoghq.com/logs
  @slack-devops @pagerduty
thresholds:
  critical: 10
  warning: 5

# Monitor 2: Memory Leak Detection
name: "OpenVSCode - Memory Leak"
type: metric alert
query: "avg(last_1h):avg:system.mem.used{service:openvscode-server} > avg(last_1h):avg:system.mem.used{service:openvscode-server} offset_by(1h) + 200000000"
message: "Potential memory leak detected (>200 MB increase over 1 hour)"

# Monitor 3: Container Restart Loop
name: "OpenVSCode - Restart Loop"
type: metric alert
query: "change(sum(last_15m),last_15m):avg:azure.containerapp.restart_count{service:openvscode-server} > 3"
message: "Container restarting frequently (>3 times in 15min)"
```

### 13.3 Log Queries (Datadog)

```
# Find failed authentication attempts
status:error service:openvscode-server @auth.result:failed

# Trace slow requests (>2s)
service:openvscode-server @duration:>2000

# Find workspace errors
service:openvscode-server @workspace.error:*

# Monitor MCP server health
service:mcp-* status:error

# Track user activity
service:openvscode-server @user.action:* -@user.action:healthcheck
```

### 13.4 Azure Monitor Integration

```bash
# Enable Container Insights
az containerapp logs show \
  --name openvscode-app \
  --resource-group openvscode-rg \
  --type console

# Query with KQL
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'openvscode-app' | where Log_s contains 'ERROR' | top 100 by TimeGenerated desc"
```

---

## Conclusion

This architecture provides a production-ready, cost-effective solution for running OpenVSCode Server with Datadog monitoring and MCP services on Azure.

**Key Takeaways:**

1. **Azure Container Apps** is the optimal service for this workload (balance of features, cost, simplicity)
2. **Alpine Linux** provides a small, secure base image (~450 MB final size)
3. **Sidecar pattern** for Datadog and MCP servers enables independent scaling and upgrades
4. **Azure Files** for persistent workspace storage with automatic backups
5. **Estimated cost:** $95-127/month for single container 24/7 (can be reduced with scale-to-zero)
6. **Security:** Managed identities, Key Vault secrets, non-root containers, HTTPS-only
7. **Observability:** Full-stack monitoring with Datadog APM, logs, and custom metrics

**Next Steps:**

1. Review and approve architecture
2. Set up Azure resources (Resource Group, Container Registry, Key Vault)
3. Build and push container image
4. Deploy using Bicep template
5. Configure Datadog dashboards and alerts
6. Test with sample workspace
7. Set up CI/CD pipeline (GitHub Actions or Azure DevOps)
8. Document runbooks for common operations

---

**Document Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-28 | Azure Architecture Team | Initial version |

---

**References:**

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Alpine Linux Security](https://alpinelinux.org/about/)
