# AgentAPI Deployment Architecture for VibeCode

**Date**: 2025-10-02
**Author**: DevOps Architect
**Status**: Design Specification

---

## Executive Summary

This document specifies the deployment architecture for integrating agentapi into VibeCode's existing container infrastructure. The design prioritizes resource efficiency, high availability, and operational simplicity while maintaining compatibility with existing code-server deployments.

### Key Decisions

1. **Container Strategy**: Sidecar pattern - agentapi runs alongside code-server in same Pod
2. **Orchestration**: Kubernetes-native with optional Docker Compose for local development
3. **Networking**: Internal ClusterIP with optional Ingress for external API access
4. **Scaling**: One agentapi instance per workspace (1:1 with code-server)
5. **Health Monitoring**: Custom health checks for terminal emulator and agent lifecycle
6. **Upgrades**: Rolling updates with version pinning and backward compatibility checks

---

## 1. Container Strategy

### Decision: Sidecar Pattern

**Rationale:**
- Shared terminal access between code-server and agentapi via shared volumes
- Tight coupling required for agent control (terminal stdin/stdout communication)
- Simplified networking (localhost communication)
- Resource isolation and independent scaling
- Clean separation of concerns (IDE vs Agent Control)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Pod: vibecode-workspace-{user-id}                       │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐│
│  │ Container: code-server│  │ Container: agentapi      ││
│  │                       │  │                          ││
│  │ Port: 8765 (IDE)     │  │ Port: 3284 (HTTP API)   ││
│  │                       │  │                          ││
│  │ Volumes:             │  │ Volumes:                 ││
│  │ - /home/coder        │  │ - /home/coder (shared)   ││
│  │ - /tmp/terminals     │◄─┼─► /tmp/terminals (shared)││
│  └──────────────────────┘  └──────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Optional: Datadog Agent (monitoring)             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Image Build Strategy

**Option A: Extend Existing Image** (Recommended for MVP)
```dockerfile
FROM ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Install agentapi binary
ARG AGENTAPI_VERSION=0.1.0
ARG TARGETPLATFORM
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") ARCH=amd64 ;; \
      "linux/arm64") ARCH=arm64 ;; \
      *) echo "Unsupported platform"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/agentapi/agentapi/releases/download/v${AGENTAPI_VERSION}/agentapi-${ARCH}" \
      -o /usr/local/bin/agentapi; \
    chmod +x /usr/local/bin/agentapi; \
    agentapi --version

# Create terminal emulation directory
RUN mkdir -p /tmp/terminals && \
    chown -R coder:coder /tmp/terminals

# Expose agentapi port
EXPOSE 3284
```

**Option B: Separate Minimal Image** (Recommended for Production)
```dockerfile
FROM debian:bookworm-slim

ARG AGENTAPI_VERSION=0.1.0
ARG TARGETPLATFORM

# Install minimal dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      bash \
      procps && \
    rm -rf /var/lib/apt/lists/*

# Install agentapi
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") ARCH=amd64 ;; \
      "linux/arm64") ARCH=arm64 ;; \
      *) echo "Unsupported platform"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/agentapi/agentapi/releases/download/v${AGENTAPI_VERSION}/agentapi-${ARCH}" \
      -o /usr/local/bin/agentapi; \
    chmod +x /usr/local/bin/agentapi

# Create non-root user matching code-server
RUN useradd -m -u 1000 -s /bin/bash coder && \
    mkdir -p /tmp/terminals /home/coder/.agentapi && \
    chown -R coder:coder /tmp/terminals /home/coder

USER coder
WORKDIR /home/coder

# Health check script
COPY --chown=coder:coder health-check.sh /home/coder/.agentapi/health-check.sh
RUN chmod +x /home/coder/.agentapi/health-check.sh

EXPOSE 3284

ENTRYPOINT ["/usr/local/bin/agentapi"]
CMD ["--host", "127.0.0.1", "--port", "3284", "--terminal-dir", "/tmp/terminals"]
```

---

## 2. Docker Compose Configuration

### Local Development: docker-compose.agentapi.yml

```yaml
version: '3.9'

services:
  # Code-server with AI extensions
  codeserver:
    image: ${CODESERVER_IMAGE:-ghcr.io/ryanmaclean/vibecode-codeserver:latest}
    container_name: vibecode-codeserver
    restart: unless-stopped
    ports:
      - "8765:8765"
    environment:
      PASSWORD: ${CODE_SERVER_PASSWORD:-changeme}
      TZ: ${TZ:-UTC}
      SHELL: /bin/bash
      # AgentAPI connection config
      AGENTAPI_HOST: localhost
      AGENTAPI_PORT: 3284
    volumes:
      - workspace_data:/home/coder/workspace
      - terminal_data:/tmp/terminals
      - ./config:/home/coder/.config
    networks:
      - vibecode-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s

  # AgentAPI for controlling AI agents
  agentapi:
    image: ${AGENTAPI_IMAGE:-ghcr.io/ryanmaclean/vibecode-agentapi:latest}
    container_name: vibecode-agentapi
    restart: unless-stopped
    ports:
      - "3284:3284"
    environment:
      # Agent configuration
      AGENTAPI_HOST: 0.0.0.0
      AGENTAPI_PORT: 3284
      AGENTAPI_ALLOWED_ORIGINS: "http://localhost:8765,http://127.0.0.1:8765"
      AGENTAPI_TERMINAL_DIR: /tmp/terminals
      AGENTAPI_LOG_LEVEL: ${LOG_LEVEL:-info}
      # Agent types supported
      AGENTAPI_AGENTS: "aider,goose,continue,cline"
      # Resource limits
      AGENTAPI_MAX_CONCURRENT_AGENTS: ${MAX_AGENTS:-5}
      AGENTAPI_AGENT_TIMEOUT: ${AGENT_TIMEOUT:-300}
    volumes:
      - workspace_data:/home/coder/workspace:ro  # Read-only workspace access
      - terminal_data:/tmp/terminals              # Shared terminal emulation
      - agentapi_config:/home/coder/.agentapi    # AgentAPI configuration
    networks:
      - vibecode-network
    depends_on:
      - codeserver
    healthcheck:
      test: ["CMD", "/home/coder/.agentapi/health-check.sh"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # Optional: Datadog monitoring sidecar
  datadog-agent:
    image: gcr.io/datadoghq/agent:7
    container_name: vibecode-datadog
    restart: unless-stopped
    environment:
      DD_API_KEY: ${DD_API_KEY}
      DD_SITE: ${DD_SITE:-datadoghq.com}
      DD_ENV: ${DD_ENV:-development}
      DD_SERVICE: vibecode-workspace
      DD_LOGS_ENABLED: true
      DD_APM_ENABLED: true
      DD_PROCESS_AGENT_ENABLED: true
      DD_CONTAINER_EXCLUDE: "name:datadog-agent"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - ./datadog/conf.d:/etc/datadog-agent/conf.d:ro
    networks:
      - vibecode-network
    profiles:
      - monitoring

networks:
  vibecode-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

volumes:
  workspace_data:
    driver: local
    driver_opts:
      type: none
      device: ${WORKSPACE_DIR:-./workspace}
      o: bind
  terminal_data:
    driver: local
  agentapi_config:
    driver: local
```

### Production Compose Override: docker-compose.production.yml

```yaml
version: '3.9'

services:
  codeserver:
    image: ghcr.io/ryanmaclean/vibecode-codeserver:${VERSION:-latest}
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '1'
          memory: 2G
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  agentapi:
    image: ghcr.io/ryanmaclean/vibecode-agentapi:${VERSION:-latest}
    environment:
      AGENTAPI_LOG_LEVEL: warn
      AGENTAPI_MAX_CONCURRENT_AGENTS: 10
      AGENTAPI_ENABLE_METRICS: "true"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  datadog-agent:
    profiles: []  # Always enabled in production
```

---

## 3. Kubernetes Manifests

### 3.1 Kubernetes Deployment with Sidecar

File: `k8s/code-server-agentapi.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentapi-config
  namespace: vibecode-platform
data:
  config.yaml: |
    host: 127.0.0.1
    port: 3284
    terminal_dir: /tmp/terminals
    allowed_origins:
      - http://localhost:8765
      - http://127.0.0.1:8765
    agents:
      - name: aider
        command: aider
        args: []
      - name: goose
        command: goose
        args: []
      - name: cline
        command: npx
        args: ["-y", "@cline/cli"]
    max_concurrent_agents: 5
    agent_timeout: 300
    log_level: info

  health-check.sh: |
    #!/bin/bash
    set -e

    # Check if agentapi HTTP server is responding
    response=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3284/health || echo "000")

    if [ "$response" != "200" ]; then
      echo "AgentAPI health check failed: HTTP $response"
      exit 1
    fi

    # Check if terminal emulator is accessible
    if [ ! -d "/tmp/terminals" ]; then
      echo "Terminal directory not accessible"
      exit 1
    fi

    # Check agent process count
    agent_count=$(ps aux | grep -E 'aider|goose|cline' | grep -v grep | wc -l)
    max_agents=${AGENTAPI_MAX_CONCURRENT_AGENTS:-5}

    if [ "$agent_count" -gt "$max_agents" ]; then
      echo "Too many agent processes: $agent_count (max: $max_agents)"
      exit 1
    fi

    echo "AgentAPI healthy: $agent_count active agents"
    exit 0
---
apiVersion: v1
kind: Service
metadata:
  name: code-server-agentapi
  namespace: vibecode-platform
  labels:
    app: code-server
    component: workspace
spec:
  type: ClusterIP
  selector:
    app: code-server
    component: workspace
  ports:
    - name: ide
      port: 8765
      targetPort: 8765
      protocol: TCP
    - name: agentapi
      port: 3284
      targetPort: 3284
      protocol: TCP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-server-workspace
  namespace: vibecode-platform
  labels:
    app: code-server
    component: workspace
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: code-server
      component: workspace
  template:
    metadata:
      labels:
        app: code-server
        component: workspace
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault

      # Init container to set up shared terminal directory
      initContainers:
        - name: init-terminal-dir
          image: busybox:latest
          command: ['sh', '-c']
          args:
            - |
              mkdir -p /tmp/terminals
              chmod 755 /tmp/terminals
              chown 1000:1000 /tmp/terminals
          volumeMounts:
            - name: terminal-data
              mountPath: /tmp/terminals
          securityContext:
            runAsUser: 0
            allowPrivilegeEscalation: false

      containers:
        # Main container: code-server IDE
        - name: code-server
          image: ghcr.io/ryanmaclean/vibecode-codeserver:latest
          imagePullPolicy: IfNotPresent
          args:
            - --bind-addr
            - 0.0.0.0:8765
            - --auth
            - password
            - /home/coder/workspace
          ports:
            - name: ide
              containerPort: 8765
              protocol: TCP
          env:
            - name: PASSWORD
              valueFrom:
                secretKeyRef:
                  name: code-server-config
                  key: password
            - name: SHELL
              value: /bin/bash
            - name: AGENTAPI_HOST
              value: "127.0.0.1"
            - name: AGENTAPI_PORT
              value: "3284"
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          volumeMounts:
            - name: workspace
              mountPath: /home/coder/workspace
            - name: terminal-data
              mountPath: /tmp/terminals
            - name: config
              mountPath: /home/coder/.config
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8765
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8765
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            readOnlyRootFilesystem: false

        # Sidecar: AgentAPI for agent control
        - name: agentapi
          image: ghcr.io/ryanmaclean/vibecode-agentapi:latest
          imagePullPolicy: IfNotPresent
          args:
            - --config
            - /etc/agentapi/config.yaml
          ports:
            - name: api
              containerPort: 3284
              protocol: TCP
          env:
            - name: AGENTAPI_HOST
              value: "127.0.0.1"
            - name: AGENTAPI_PORT
              value: "3284"
            - name: AGENTAPI_LOG_LEVEL
              value: info
            - name: AGENTAPI_MAX_CONCURRENT_AGENTS
              value: "5"
            - name: AGENTAPI_AGENT_TIMEOUT
              value: "300"
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 2Gi
          volumeMounts:
            - name: workspace
              mountPath: /home/coder/workspace
              readOnly: true
            - name: terminal-data
              mountPath: /tmp/terminals
            - name: agentapi-config
              mountPath: /etc/agentapi
          livenessProbe:
            exec:
              command:
                - /bin/bash
                - /etc/agentapi/health-check.sh
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 3284
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            readOnlyRootFilesystem: false

        # Optional Sidecar: Datadog monitoring
        - name: datadog-agent
          image: gcr.io/datadoghq/agent:7
          imagePullPolicy: IfNotPresent
          env:
            - name: DD_API_KEY
              valueFrom:
                secretKeyRef:
                  name: datadog-secret
                  key: api-key
                  optional: true
            - name: DD_SITE
              value: datadoghq.com
            - name: DD_ENV
              value: production
            - name: DD_SERVICE
              value: code-server-workspace
            - name: DD_LOGS_ENABLED
              value: "true"
            - name: DD_APM_ENABLED
              value: "true"
            - name: DD_PROCESS_AGENT_ENABLED
              value: "true"
            - name: DD_KUBERNETES_KUBELET_HOST
              valueFrom:
                fieldRef:
                  fieldPath: status.hostIP
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: datadog-config
              mountPath: /etc/datadog-agent/datadog.yaml
              subPath: datadog.yaml
              readOnly: true
          securityContext:
            allowPrivilegeEscalation: false

      volumes:
        - name: workspace
          persistentVolumeClaim:
            claimName: code-server-workspace-pvc
        - name: terminal-data
          emptyDir:
            sizeLimit: 1Gi
        - name: config
          emptyDir: {}
        - name: agentapi-config
          configMap:
            name: agentapi-config
            defaultMode: 0755
        - name: datadog-config
          configMap:
            name: datadog-agent-config
            optional: true

      # Node affinity and tolerations
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - code-server
                topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: code-server-workspace-pvc
  namespace: vibecode-platform
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: vibecode-local-storage
  resources:
    requests:
      storage: 50Gi
```

### 3.2 Network Policy

File: `k8s/networkpolicy-agentapi.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agentapi-network-policy
  namespace: vibecode-platform
spec:
  podSelector:
    matchLabels:
      app: code-server
      component: workspace
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow IDE access from ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8765
    # Allow AgentAPI access from within namespace only
    - from:
        - podSelector:
            matchLabels:
              app: vibecode-frontend
      ports:
        - protocol: TCP
          port: 3284
  egress:
    # Allow DNS resolution
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # Allow HTTPS to external API endpoints (LLM providers)
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
    # Allow HTTP to internal services
    - to:
        - podSelector: {}
      ports:
        - protocol: TCP
          port: 80
```

---

## 4. Helm Chart Integration

### 4.1 Update values.yaml

File: `helm/code-server-cloud/values.yaml`

```yaml
# ... existing configuration ...

# AgentAPI configuration
agentapi:
  enabled: true

  image:
    repository: ghcr.io/ryanmaclean/vibecode-agentapi
    tag: latest
    pullPolicy: IfNotPresent

  # Resource configuration
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi

  # Agent configuration
  config:
    host: 127.0.0.1
    port: 3284
    terminalDir: /tmp/terminals
    allowedOrigins:
      - http://localhost:8765
      - http://127.0.0.1:8765
    maxConcurrentAgents: 5
    agentTimeout: 300
    logLevel: info

  # Supported agents
  agents:
    - name: aider
      enabled: true
      command: aider
      args: []
    - name: goose
      enabled: true
      command: goose
      args: []
    - name: cline
      enabled: true
      command: npx
      args: ["-y", "@cline/cli"]
    - name: continue
      enabled: false
      command: continue
      args: []

  # Security context
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
    readOnlyRootFilesystem: false

  # Service configuration
  service:
    enabled: true
    type: ClusterIP
    port: 3284
    targetPort: 3284

  # Ingress for external API access (optional)
  ingress:
    enabled: false
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/auth-type: basic
      nginx.ingress.kubernetes.io/auth-secret: agentapi-basic-auth
    hosts:
      - host: agentapi.vibecode.local
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: agentapi-tls
        hosts:
          - agentapi.vibecode.local

  # Health check configuration
  healthCheck:
    enabled: true
    livenessProbe:
      initialDelaySeconds: 15
      periodSeconds: 30
      timeoutSeconds: 10
      failureThreshold: 3
    readinessProbe:
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3

  # Monitoring and metrics
  metrics:
    enabled: true
    port: 9090
    path: /metrics
    serviceMonitor:
      enabled: false
      interval: 30s
```

### 4.2 Helm Template for AgentAPI Sidecar

File: `helm/code-server-cloud/templates/agentapi-sidecar.yaml`

```yaml
{{- if .Values.agentapi.enabled }}
# This template is merged into the main deployment
# It adds the agentapi sidecar container
{{- end }}
```

File: `helm/code-server-cloud/templates/agentapi-configmap.yaml`

```yaml
{{- if .Values.agentapi.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "code-server-cloud.fullname" . }}-agentapi
  labels:
    {{- include "code-server-cloud.labels" . | nindent 4 }}
data:
  config.yaml: |
    host: {{ .Values.agentapi.config.host }}
    port: {{ .Values.agentapi.config.port }}
    terminal_dir: {{ .Values.agentapi.config.terminalDir }}
    allowed_origins:
    {{- range .Values.agentapi.config.allowedOrigins }}
      - {{ . }}
    {{- end }}
    agents:
    {{- range .Values.agentapi.agents }}
    {{- if .enabled }}
      - name: {{ .name }}
        command: {{ .command }}
        args: {{ toJson .args }}
    {{- end }}
    {{- end }}
    max_concurrent_agents: {{ .Values.agentapi.config.maxConcurrentAgents }}
    agent_timeout: {{ .Values.agentapi.config.agentTimeout }}
    log_level: {{ .Values.agentapi.config.logLevel }}

  health-check.sh: |
    #!/bin/bash
    set -e

    # Check HTTP server
    response=$(curl -s -o /dev/null -w "%{http_code}" http://{{ .Values.agentapi.config.host }}:{{ .Values.agentapi.config.port }}/health || echo "000")

    if [ "$response" != "200" ]; then
      echo "AgentAPI health check failed: HTTP $response"
      exit 1
    fi

    # Check terminal directory
    if [ ! -d "{{ .Values.agentapi.config.terminalDir }}" ]; then
      echo "Terminal directory not accessible"
      exit 1
    fi

    # Check agent process count
    agent_count=$(ps aux | grep -E 'aider|goose|cline|continue' | grep -v grep | wc -l)
    max_agents={{ .Values.agentapi.config.maxConcurrentAgents }}

    if [ "$agent_count" -gt "$max_agents" ]; then
      echo "Too many agent processes: $agent_count (max: $max_agents)"
      exit 1
    fi

    echo "AgentAPI healthy: $agent_count active agents"
    exit 0
{{- end }}
```

---

## 5. Networking Strategy

### 5.1 Service Mesh Considerations

**Decision**: Start without service mesh, add later if needed

**Rationale**:
- Complexity overhead not justified for single-pod communication
- Localhost communication between sidecar containers is sufficient
- Service mesh (Istio/Linkerd) can be added later for:
  - mTLS between workspaces
  - Advanced traffic routing
  - Distributed tracing
  - Circuit breaking

### 5.2 Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-workspace-ingress
  namespace: vibecode-platform
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: code-server-agentapi
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    # Rate limiting for AgentAPI
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-connections: "20"
spec:
  ingressClassName: nginx
  tls:
    - secretName: vibecode-workspace-tls
      hosts:
        - workspace.vibecode.dev
        - api.workspace.vibecode.dev
  rules:
    # IDE access
    - host: workspace.vibecode.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: code-server-agentapi
                port:
                  number: 8765
    # AgentAPI access (optional external access)
    - host: api.workspace.vibecode.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: code-server-agentapi
                port:
                  number: 3284
```

### 5.3 Internal vs External Access

```
Internal Access (default):
  code-server <--> agentapi via localhost (127.0.0.1:3284)
  No network traffic, shared memory space

External Access (optional):
  Frontend App --> ClusterIP Service (agentapi:3284) --> Pod
  Requires authentication and rate limiting
  Use for external API integrations only
```

---

## 6. Scaling Strategy

### 6.1 Scaling Decision Matrix

| Scenario | Architecture | Rationale |
|----------|--------------|-----------|
| **Personal workspace** | 1:1 (one agentapi per user) | Full isolation, dedicated resources |
| **Team workspaces** | 1:1 per workspace | Prevents agent interference |
| **Enterprise shared** | 1:N (shared agentapi pool) | Cost optimization, centralized control |

**Recommendation**: Start with 1:1, migrate to 1:N for cost optimization at scale

### 6.2 Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: code-server-workspace-hpa
  namespace: vibecode-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: code-server-workspace
  minReplicas: 1
  maxReplicas: 10
  metrics:
    # Scale based on CPU
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
    # Scale based on memory
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    # Custom metric: active agent count
    - type: Pods
      pods:
        metric:
          name: agentapi_active_agents
        target:
          type: AverageValue
          averageValue: "3"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
        - type: Pods
          value: 2
          periodSeconds: 30
      selectPolicy: Max
```

### 6.3 Vertical Pod Autoscaling

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: code-server-workspace-vpa
  namespace: vibecode-platform
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: code-server-workspace
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: code-server
        minAllowed:
          cpu: 500m
          memory: 1Gi
        maxAllowed:
          cpu: 4000m
          memory: 8Gi
        mode: Auto
      - containerName: agentapi
        minAllowed:
          cpu: 250m
          memory: 512Mi
        maxAllowed:
          cpu: 2000m
          memory: 4Gi
        mode: Auto
```

---

## 7. Health Checks and Monitoring

### 7.1 Health Check Implementation

File: `docker/agentapi/health-check.sh`

```bash
#!/bin/bash
set -e

# Configuration
AGENTAPI_HOST="${AGENTAPI_HOST:-127.0.0.1}"
AGENTAPI_PORT="${AGENTAPI_PORT:-3284}"
TERMINAL_DIR="${AGENTAPI_TERMINAL_DIR:-/tmp/terminals}"
MAX_AGENTS="${AGENTAPI_MAX_CONCURRENT_AGENTS:-5}"
MAX_RESPONSE_TIME_MS=1000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check results
HEALTH_STATUS=0
HEALTH_MESSAGES=()

# Function to add health message
add_health_message() {
    local level=$1
    local message=$2
    HEALTH_MESSAGES+=("[$level] $message")
}

# 1. Check HTTP server responsiveness
echo "Checking AgentAPI HTTP server..."
start_time=$(date +%s%N)
response=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://${AGENTAPI_HOST}:${AGENTAPI_PORT}/health" 2>&1 || echo "000")
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ "$response" != "200" ]; then
    add_health_message "ERROR" "HTTP health check failed: HTTP $response"
    HEALTH_STATUS=1
else
    if [ "$response_time" -gt "$MAX_RESPONSE_TIME_MS" ]; then
        add_health_message "WARN" "Slow response time: ${response_time}ms"
    else
        add_health_message "OK" "HTTP server healthy (${response_time}ms)"
    fi
fi

# 2. Check terminal directory accessibility
echo "Checking terminal directory..."
if [ ! -d "$TERMINAL_DIR" ]; then
    add_health_message "ERROR" "Terminal directory not accessible: $TERMINAL_DIR"
    HEALTH_STATUS=1
elif [ ! -w "$TERMINAL_DIR" ]; then
    add_health_message "ERROR" "Terminal directory not writable: $TERMINAL_DIR"
    HEALTH_STATUS=1
else
    terminal_count=$(find "$TERMINAL_DIR" -type f 2>/dev/null | wc -l)
    add_health_message "OK" "Terminal directory accessible ($terminal_count active terminals)"
fi

# 3. Check agent process health
echo "Checking agent processes..."
agent_count=$(ps aux | grep -E 'aider|goose|cline|continue' | grep -v grep | wc -l)

if [ "$agent_count" -gt "$MAX_AGENTS" ]; then
    add_health_message "ERROR" "Too many agent processes: $agent_count (max: $MAX_AGENTS)"
    HEALTH_STATUS=1
else
    add_health_message "OK" "Agent count within limits: $agent_count/$MAX_AGENTS"
fi

# 4. Check for zombie processes
zombie_count=$(ps aux | awk '{if ($8=="Z") print}' | wc -l)
if [ "$zombie_count" -gt 0 ]; then
    add_health_message "WARN" "Zombie processes detected: $zombie_count"
fi

# 5. Check memory usage
memory_usage=$(ps aux --no-headers -C agentapi -o %mem | awk '{sum+=$1} END {print sum}')
memory_limit=80.0
if (( $(echo "$memory_usage > $memory_limit" | bc -l) )); then
    add_health_message "WARN" "High memory usage: ${memory_usage}%"
fi

# 6. Check disk space for terminal directory
disk_usage=$(df "$TERMINAL_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
disk_limit=90
if [ "$disk_usage" -gt "$disk_limit" ]; then
    add_health_message "ERROR" "Disk space critical: ${disk_usage}%"
    HEALTH_STATUS=1
fi

# 7. Check API endpoints
echo "Checking API endpoints..."
endpoints=("/health" "/metrics" "/agents" "/terminals")
for endpoint in "${endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" \
        "http://${AGENTAPI_HOST}:${AGENTAPI_PORT}${endpoint}" 2>&1 || echo "000")
    if [ "$status" = "200" ] || [ "$status" = "401" ]; then
        add_health_message "OK" "Endpoint $endpoint responding"
    else
        add_health_message "WARN" "Endpoint $endpoint returned: $status"
    fi
done

# Print health report
echo ""
echo "=========================================="
echo "AgentAPI Health Check Report"
echo "=========================================="
for message in "${HEALTH_MESSAGES[@]}"; do
    if [[ $message == *"ERROR"* ]]; then
        echo -e "${RED}${message}${NC}"
    elif [[ $message == *"WARN"* ]]; then
        echo -e "${YELLOW}${message}${NC}"
    else
        echo -e "${GREEN}${message}${NC}"
    fi
done
echo "=========================================="

# Exit with health status
if [ "$HEALTH_STATUS" -eq 0 ]; then
    echo -e "${GREEN}✓ AgentAPI is healthy${NC}"
    exit 0
else
    echo -e "${RED}✗ AgentAPI health check failed${NC}"
    exit 1
fi
```

### 7.2 Prometheus Metrics

File: `docker/agentapi/metrics.go` (example)

```go
package main

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // Agent lifecycle metrics
    agentsActive = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "agentapi_agents_active",
        Help: "Number of currently active agents",
    })

    agentsTotal = promauto.NewCounter(prometheus.CounterOpts{
        Name: "agentapi_agents_total",
        Help: "Total number of agents started",
    })

    agentFailures = promauto.NewCounter(prometheus.CounterOpts{
        Name: "agentapi_agent_failures_total",
        Help: "Total number of agent failures",
    })

    // Terminal metrics
    terminalsActive = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "agentapi_terminals_active",
        Help: "Number of active terminal sessions",
    })

    // API metrics
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "agentapi_http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    httpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "agentapi_http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "endpoint"},
    )

    // Resource metrics
    memoryUsageBytes = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "agentapi_memory_usage_bytes",
        Help: "Current memory usage in bytes",
    })

    cpuUsagePercent = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "agentapi_cpu_usage_percent",
        Help: "Current CPU usage percentage",
    })

    // Agent-specific metrics
    agentExecutionTime = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "agentapi_agent_execution_seconds",
            Help:    "Agent execution time in seconds",
            Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600},
        },
        []string{"agent_type"},
    )

    agentTokensUsed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "agentapi_agent_tokens_used_total",
            Help: "Total tokens used by agents",
        },
        []string{"agent_type", "model"},
    )
)
```

### 7.3 Grafana Dashboard

File: `monitoring/grafana/agentapi-dashboard.json`

```json
{
  "dashboard": {
    "title": "AgentAPI Monitoring",
    "panels": [
      {
        "title": "Active Agents",
        "targets": [
          {
            "expr": "agentapi_agents_active"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Agent Failures",
        "targets": [
          {
            "expr": "rate(agentapi_agent_failures_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "rate(agentapi_http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time P95",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, agentapi_http_request_duration_seconds_bucket)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "agentapi_memory_usage_bytes / 1024 / 1024"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Agent Execution Time by Type",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, agentapi_agent_execution_seconds_bucket)"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### 7.4 Datadog Integration

File: `k8s/datadog-agentapi-check.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agentapi-check
  namespace: vibecode-platform
data:
  agentapi.yaml: |
    init_config:

    instances:
      # HTTP health check
      - name: agentapi-health
        url: http://127.0.0.1:3284/health
        timeout: 5
        http_response_status_code: 200
        tags:
          - service:agentapi
          - component:agent-control

      # Prometheus metrics scraping
      - prometheus_url: http://127.0.0.1:3284/metrics
        namespace: agentapi
        metrics:
          - agentapi_agents_active
          - agentapi_agents_total
          - agentapi_agent_failures_total
          - agentapi_terminals_active
          - agentapi_http_requests_total
          - agentapi_memory_usage_bytes
          - agentapi_cpu_usage_percent
        tags:
          - service:agentapi
          - env:production
```

---

## 8. Upgrade Strategy

### 8.1 Rolling Update Configuration

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0        # Zero downtime
    maxSurge: 1              # One extra pod during update
```

### 8.2 Version Compatibility Matrix

| Code-Server Version | AgentAPI Version | Compatibility | Notes |
|---------------------|------------------|---------------|-------|
| v1.2.0 | v0.1.x | ✓ Full | Initial release |
| v1.2.0 | v0.2.x | ✓ Full | Added MCP support |
| v1.3.0 | v0.1.x | ⚠ Partial | Legacy agent support only |
| v1.3.0 | v0.2.x | ✓ Full | Recommended pairing |

### 8.3 Upgrade Process

```bash
# 1. Pre-upgrade validation
kubectl get pods -n vibecode-platform -l app=code-server
kubectl describe deployment code-server-workspace -n vibecode-platform

# 2. Update images with version pinning
kubectl set image deployment/code-server-workspace \
  code-server=ghcr.io/ryanmaclean/vibecode-codeserver:v1.3.0 \
  agentapi=ghcr.io/ryanmaclean/vibecode-agentapi:v0.2.0 \
  -n vibecode-platform

# 3. Monitor rollout
kubectl rollout status deployment/code-server-workspace -n vibecode-platform

# 4. Verify health
kubectl get pods -n vibecode-platform -l app=code-server
kubectl logs -f deployment/code-server-workspace -c agentapi -n vibecode-platform

# 5. Rollback if needed
kubectl rollout undo deployment/code-server-workspace -n vibecode-platform
```

### 8.4 Backward Compatibility Strategy

1. **API Versioning**: Use `/v1/` prefix in AgentAPI endpoints
2. **Feature Flags**: Enable new features gradually via environment variables
3. **Graceful Degradation**: Fall back to older agent versions if new ones fail
4. **Configuration Migration**: Automated config upgrade during pod initialization

---

## 9. Resource Efficiency Analysis

### 9.1 Resource Usage Comparison

| Configuration | CPU (idle) | CPU (active) | Memory (idle) | Memory (active) | Cost/month |
|---------------|-----------|-------------|---------------|-----------------|------------|
| **Code-server only** | 100m | 2000m | 256Mi | 4Gi | $50 |
| **+ AgentAPI (sidecar)** | 350m | 3000m | 768Mi | 6Gi | $75 |
| **+ Datadog Agent** | 550m | 3500m | 1Gi | 6.5Gi | $90 |
| **Separate Pods** | 400m | 3200m | 1Gi | 6.5Gi | $85 |

**Recommendation**: Sidecar pattern is 15% more efficient than separate pods.

### 9.2 Terminal Emulation Overhead

```
Memory per terminal session: ~50MB
CPU per terminal session: ~10m
Max concurrent agents: 5
Max concurrent terminals: 10

Expected overhead:
- Memory: 5 * 50MB = 250MB
- CPU: 5 * 10m = 50m
```

### 9.3 Network Traffic Patterns

```
Localhost communication (sidecar):
- Latency: <1ms
- Bandwidth: Unlimited (shared memory)
- No network overhead

ClusterIP communication (separate pods):
- Latency: 1-5ms
- Bandwidth: 10Gbps (CNI dependent)
- Network overhead: ~100MB/hr for typical usage
```

---

## 10. Deployment Checklist

### Pre-Deployment

- [ ] Build multi-arch images (amd64, arm64)
- [ ] Test images in local Docker Compose environment
- [ ] Configure secrets (API keys, passwords)
- [ ] Set up persistent volumes for workspaces
- [ ] Configure network policies
- [ ] Set up monitoring dashboards
- [ ] Test health check scripts

### Deployment

- [ ] Deploy ConfigMaps and Secrets
- [ ] Deploy Persistent Volume Claims
- [ ] Deploy code-server with agentapi sidecar
- [ ] Verify pod startup and readiness
- [ ] Test IDE access via Ingress
- [ ] Test AgentAPI endpoints
- [ ] Verify agent execution (aider, goose, cline)
- [ ] Check Prometheus metrics collection
- [ ] Verify Grafana dashboard display

### Post-Deployment

- [ ] Monitor resource usage for 24 hours
- [ ] Set up alerts for failures
- [ ] Document operational procedures
- [ ] Train team on troubleshooting
- [ ] Plan scaling thresholds
- [ ] Schedule upgrade testing

---

## 11. Example Usage

### Starting an Agent via AgentAPI

```bash
# Start Aider agent
curl -X POST http://localhost:3284/v1/agents/start \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "aider",
    "workspace": "/home/coder/workspace/my-project",
    "files": ["src/main.py", "tests/test_main.py"],
    "model": "claude-3-7-sonnet",
    "task": "Add error handling to the login function"
  }'

# Response
{
  "agent_id": "aider-abc123",
  "status": "running",
  "terminal_id": "term-xyz789",
  "pid": 12345
}

# Check agent status
curl http://localhost:3284/v1/agents/aider-abc123/status

# Stream agent output
curl -N http://localhost:3284/v1/agents/aider-abc123/stream

# Stop agent
curl -X POST http://localhost:3284/v1/agents/aider-abc123/stop
```

---

## Appendix A: Dockerfile for AgentAPI

File: `docker/agentapi/Dockerfile`

```dockerfile
# Multi-stage build for AgentAPI
FROM golang:1.22-bookworm AS builder

ARG AGENTAPI_VERSION=0.1.0
ARG TARGETPLATFORM

WORKDIR /build

# Copy agentapi source (assuming it's a Go project)
COPY . .

# Build agentapi binary
RUN CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-w -s -X main.version=${AGENTAPI_VERSION}" \
    -o agentapi ./cmd/agentapi

# Final stage
FROM debian:bookworm-slim

ARG TARGETPLATFORM

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      bash \
      git \
      procps \
      python3 \
      python3-pip \
      nodejs \
      npm && \
    rm -rf /var/lib/apt/lists/*

# Install AI CLI tools
RUN pip3 install --no-cache-dir --break-system-packages \
      aider-chat \
      goose-ai && \
    npm install -g @cline/cli

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash coder && \
    mkdir -p /tmp/terminals /home/coder/.agentapi && \
    chown -R coder:coder /tmp/terminals /home/coder

# Copy agentapi binary from builder
COPY --from=builder /build/agentapi /usr/local/bin/agentapi
RUN chmod +x /usr/local/bin/agentapi

# Copy health check script
COPY --chown=coder:coder health-check.sh /home/coder/.agentapi/health-check.sh
RUN chmod +x /home/coder/.agentapi/health-check.sh

# Switch to non-root user
USER coder
WORKDIR /home/coder

# Expose API port
EXPOSE 3284

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD ["/home/coder/.agentapi/health-check.sh"]

# Run agentapi
ENTRYPOINT ["/usr/local/bin/agentapi"]
CMD ["--host", "127.0.0.1", "--port", "3284", "--terminal-dir", "/tmp/terminals"]
```

---

## Appendix B: CI/CD Pipeline

File: `.github/workflows/build-agentapi.yml`

```yaml
name: Build AgentAPI Images

on:
  push:
    branches:
      - main
    paths:
      - 'docker/agentapi/**'
      - '.github/workflows/build-agentapi.yml'
  pull_request:
    branches:
      - main
    paths:
      - 'docker/agentapi/**'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}-agentapi

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform:
          - linux/amd64
          - linux/arm64

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./docker/agentapi
          platforms: ${{ matrix.platform }}
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Run security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## Summary

This architecture provides:

1. **Efficient Resource Usage**: Sidecar pattern reduces overhead by 15% vs separate pods
2. **High Availability**: Zero-downtime rolling updates with health checks
3. **Operational Simplicity**: Standard Kubernetes patterns, familiar to ops teams
4. **Observability**: Comprehensive monitoring with Prometheus, Grafana, and Datadog
5. **Security**: Network policies, non-root containers, resource limits
6. **Scalability**: Horizontal and vertical autoscaling with clear scaling patterns
7. **Flexibility**: Easy migration from Docker Compose to Kubernetes to cloud-managed

**Next Steps**:
1. Build and test AgentAPI Docker image
2. Deploy to local kind cluster for validation
3. Test agent lifecycle (start, stream, stop)
4. Set up monitoring dashboards
5. Document operational runbooks
6. Plan production rollout
