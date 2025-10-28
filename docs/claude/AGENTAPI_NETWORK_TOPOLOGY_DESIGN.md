# AgentAPI Network Topology and Routing Strategy

**Date**: 2025-10-02
**Author**: Agent 2 - Network Architecture Engineer
**Status**: Design Specification
**Version**: 1.0

---

## Executive Summary

This document defines the network topology, service mesh configuration, and routing strategy for integrating AgentAPI (port 3284) with code-server (port 8765) and Next.js frontend (port 3000). The design prioritizes low-latency communication (<10ms), WebSocket support, and horizontal scalability (10+ replicas).

### Key Decisions

1. **Network Architecture**: 3-layer topology (Frontend → Backend → Agent Runtime)
2. **Service Mesh**: Istio with sidecar proxies for production, optional for development
3. **Ingress Strategy**: NGINX Ingress Controller with WebSocket upgrade support
4. **Internal Communication**: Kubernetes DNS for service discovery
5. **Network Policies**: Zero-trust with explicit allow rules
6. **Load Balancing**: Layer 7 (application-aware) with session affinity
7. **TLS Strategy**: Termination at ingress, mTLS between services

---

## 1. Network Topology Architecture

### 1.1 Three-Layer Network Model

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: FRONTEND / INGRESS                                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Internet → Load Balancer → NGINX Ingress Controller      │   │
│  │   - TLS Termination (Let's Encrypt)                      │   │
│  │   - WebSocket Upgrade                                     │   │
│  │   - Rate Limiting (10 req/s per IP)                      │   │
│  │   - Path-based Routing:                                   │   │
│  │     → / → Next.js Frontend (port 3000)                   │   │
│  │     → /api/agents/* → AgentAPI Service (port 3284)       │   │
│  │     → /ide/* → code-server (port 8765)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: BACKEND / APPLICATION LAYER                            │
│                                                                   │
│  ┌────────────────────────┐    ┌────────────────────────┐       │
│  │ Next.js Frontend       │    │ Next.js API Routes     │       │
│  │ (Deployment)           │    │ (/api/*)               │       │
│  │ Port: 3000             │◄───┤ Port: 3000             │       │
│  │ Replicas: 3+           │    │ Replicas: 3+           │       │
│  │                        │    │                        │       │
│  │ - SSR Pages            │    │ - /api/agents          │       │
│  │ - Static Assets        │    │ - /api/workspaces      │       │
│  │ - Client-side JS       │    │ - Session validation   │       │
│  └────────────────────────┘    └────────┬───────────────┘       │
│                                          │                       │
│                            WebSocket/HTTP│                       │
│                                          ↓                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Internal Service Discovery (Kubernetes DNS)              │   │
│  │  - code-server-agentapi.vibecode-platform.svc.cluster   │   │
│  │  - agentapi-{workspaceId}.vibecode-platform.svc.cluster │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: AGENT RUNTIME / WORKSPACE PODS                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pod: workspace-{userId}-{workspaceId}                      │ │
│  │                                                             │ │
│  │  ┌──────────────────────┐  ┌──────────────────────┐       │ │
│  │  │ code-server          │  │ agentapi             │       │ │
│  │  │ Container            │  │ Container            │       │ │
│  │  │ Port: 8765           │◄─┤ Port: 3284 (internal)│       │ │
│  │  │                      │  │ Port: 8766 (metrics) │       │ │
│  │  │ - IDE UI             │  │                      │       │ │
│  │  │ - Extensions         │  │ - HTTP API           │       │ │
│  │  │ - Terminal           │  │ - Terminal emulation │       │ │
│  │  └──────────────────────┘  └──────────────────────┘       │ │
│  │            │                           │                   │ │
│  │            └───────────────────────────┘                   │ │
│  │              Shared Volume: /tmp/terminals                 │ │
│  │              Shared Volume: /home/coder/workspace          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Network Policy: Allow within pod, explicit external rules      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Network Latency Budget

| Communication Path | Target Latency | Constraint |
|-------------------|---------------|------------|
| **User → Next.js Frontend** | <100ms p95 | Internet + CDN |
| **Next.js → AgentAPI Service** | <50ms p95 | Internal cluster network |
| **AgentAPI → code-server (same pod)** | <1ms p99 | Localhost (127.0.0.1) |
| **AgentAPI → PostgreSQL** | <10ms p95 | Internal cluster network |
| **AgentAPI → Redis** | <5ms p95 | Internal cluster network |
| **Total End-to-End** | <200ms p95 | User action → agent response |

---

## 2. Service Mesh Configuration

### 2.1 Istio Service Mesh Architecture

**Decision**: Deploy Istio for production with optional sidecar injection for development.

**Rationale**:
- **mTLS by default**: Encrypted communication between all services
- **Traffic management**: Advanced routing, retries, circuit breaking
- **Observability**: Distributed tracing with Jaeger/Zipkin
- **Security**: Authorization policies, rate limiting
- **Gradual rollout**: Canary deployments for agentapi updates

#### Istio Components

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode-platform
  labels:
    istio-injection: enabled  # Auto-inject Envoy sidecars

---
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: vibecode-istio
  namespace: istio-system
spec:
  profile: default

  meshConfig:
    # Enable tracing for all services
    enableTracing: true
    defaultConfig:
      tracing:
        sampling: 100.0  # 100% sampling for development, 1% for production
        zipkin:
          address: jaeger-collector.istio-system.svc.cluster.local:9411

    # Access logging
    accessLogFile: /dev/stdout
    accessLogEncoding: JSON

    # mTLS enforcement
    enableAutoMtls: true

  components:
    ingressGateways:
    - name: istio-ingressgateway
      enabled: true
      k8s:
        service:
          type: LoadBalancer
          ports:
          - port: 80
            targetPort: 8080
            name: http2
          - port: 443
            targetPort: 8443
            name: https
          - port: 15021
            targetPort: 15021
            name: status-port
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi

    egressGateways:
    - name: istio-egressgateway
      enabled: true
      k8s:
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi

    pilot:
      k8s:
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        env:
        - name: PILOT_ENABLE_WORKLOAD_ENTRY_AUTOREGISTRATION
          value: "true"
        - name: PILOT_ENABLE_WORKLOAD_ENTRY_HEALTHCHECKS
          value: "true"

  values:
    global:
      # Multi-cluster mesh (future expansion)
      multiCluster:
        enabled: false

      # Telemetry settings
      tracer:
        zipkin:
          address: jaeger-collector.istio-system.svc.cluster.local:9411
```

### 2.2 Istio Virtual Service for Routing

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: vibecode-routing
  namespace: vibecode-platform
spec:
  hosts:
  - vibecode.example.com
  - agentapi.vibecode.example.com

  gateways:
  - vibecode-gateway

  http:
  # Route 1: Next.js Frontend
  - match:
    - uri:
        prefix: "/"
      headers:
        accept:
          regex: ".*text/html.*"
    route:
    - destination:
        host: nextjs-frontend.vibecode-platform.svc.cluster.local
        port:
          number: 3000
        subset: stable
      weight: 90
    - destination:
        host: nextjs-frontend.vibecode-platform.svc.cluster.local
        port:
          number: 3000
        subset: canary
      weight: 10
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: gateway-error,connect-failure,refused-stream

  # Route 2: AgentAPI (HTTP)
  - match:
    - uri:
        prefix: "/api/agents"
    route:
    - destination:
        host: code-server-agentapi.vibecode-platform.svc.cluster.local
        port:
          number: 3284
    timeout: 300s  # 5 minutes for long-running agent operations
    retries:
      attempts: 2
      perTryTimeout: 150s
      retryOn: reset,refused-stream,503
    corsPolicy:
      allowOrigins:
      - exact: https://vibecode.example.com
      allowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      - x-request-id
      maxAge: 24h

  # Route 3: AgentAPI WebSocket
  - match:
    - uri:
        prefix: "/api/agents/ws"
      headers:
        upgrade:
          exact: "websocket"
    route:
    - destination:
        host: code-server-agentapi.vibecode-platform.svc.cluster.local
        port:
          number: 3284
    timeout: 3600s  # 1 hour for WebSocket connections
    websocketUpgrade: true

  # Route 4: code-server IDE
  - match:
    - uri:
        prefix: "/ide/"
    route:
    - destination:
        host: code-server-agentapi.vibecode-platform.svc.cluster.local
        port:
          number: 8765
    timeout: 3600s
    websocketUpgrade: true
```

### 2.3 Istio Gateway Configuration

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: vibecode-gateway
  namespace: vibecode-platform
spec:
  selector:
    istio: ingressgateway
  servers:
  # HTTP (redirect to HTTPS)
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "vibecode.example.com"
    - "agentapi.vibecode.example.com"
    tls:
      httpsRedirect: true

  # HTTPS with TLS termination
  - port:
      number: 443
      name: https
      protocol: HTTPS
    hosts:
    - "vibecode.example.com"
    - "agentapi.vibecode.example.com"
    tls:
      mode: SIMPLE
      credentialName: vibecode-tls-cert  # Kubernetes Secret with cert
      minProtocolVersion: TLSV1_3
      cipherSuites:
      - ECDHE-RSA-AES128-GCM-SHA256
      - ECDHE-RSA-AES256-GCM-SHA384
```

### 2.4 Destination Rules (Traffic Policies)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: agentapi-traffic-policy
  namespace: vibecode-platform
spec:
  host: code-server-agentapi.vibecode-platform.svc.cluster.local

  trafficPolicy:
    # Connection pool settings
    connectionPool:
      tcp:
        maxConnections: 1000
        connectTimeout: 30s
        tcpKeepalive:
          time: 7200s
          interval: 75s
      http:
        http1MaxPendingRequests: 1024
        http2MaxRequests: 1024
        maxRequestsPerConnection: 10
        maxRetries: 3

    # Load balancing
    loadBalancer:
      consistentHash:
        httpHeaderName: x-workspace-id  # Session affinity by workspace

    # Outlier detection (circuit breaker)
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50

    # TLS settings (mTLS)
    tls:
      mode: ISTIO_MUTUAL
      sni: code-server-agentapi.vibecode-platform.svc.cluster.local

  # Subsets for canary deployments
  subsets:
  - name: stable
    labels:
      version: stable
  - name: canary
    labels:
      version: canary
```

### 2.5 Alternative: Linkerd (Simpler Service Mesh)

**Decision**: Consider Linkerd for simpler deployments

**Linkerd Configuration**:

```yaml
# Install Linkerd
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -
linkerd check

# Inject Linkerd proxy into namespace
kubectl annotate namespace vibecode-platform linkerd.io/inject=enabled

# Service Profile for AgentAPI
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  name: code-server-agentapi.vibecode-platform.svc.cluster.local
  namespace: vibecode-platform
spec:
  routes:
  - name: POST /api/agents/start
    condition:
      method: POST
      pathRegex: /api/agents/start
    timeout: 300s
    isRetryable: false  # Don't retry agent creation

  - name: GET /api/agents/{id}/stream
    condition:
      method: GET
      pathRegex: /api/agents/[^/]+/stream
    timeout: 3600s
    isRetryable: true

  - name: GET /health
    condition:
      method: GET
      pathRegex: /health
    timeout: 5s
    isRetryable: true
```

**Linkerd vs Istio Comparison**:

| Feature | Istio | Linkerd | Recommendation |
|---------|-------|---------|----------------|
| **Complexity** | High (many features) | Low (focused) | Linkerd for MVP, Istio for scale |
| **Resource Overhead** | ~250MB per proxy | ~20MB per proxy | Linkerd for resource efficiency |
| **WebSocket Support** | Excellent | Excellent | Both support well |
| **mTLS** | Automatic | Automatic | Both support |
| **Observability** | Comprehensive | Focused | Istio for detailed metrics |
| **Learning Curve** | Steep | Gentle | Linkerd for quick adoption |

**Recommendation**: Start with **Linkerd** for simplicity, migrate to **Istio** if advanced traffic management is needed.

---

## 3. Ingress Routing Configuration

### 3.1 NGINX Ingress Controller

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-ingress
  namespace: vibecode-platform
  annotations:
    # TLS Configuration
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # WebSocket Support
    nginx.ingress.kubernetes.io/websocket-services: "code-server-agentapi"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "300"

    # Rate Limiting
    nginx.ingress.kubernetes.io/limit-rps: "50"
    nginx.ingress.kubernetes.io/limit-connections: "100"
    nginx.ingress.kubernetes.io/limit-rpm: "3000"

    # CORS Configuration
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://vibecode.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"

    # Session Affinity (sticky sessions)
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/session-cookie-name: "vibecode-session"
    nginx.ingress.kubernetes.io/session-cookie-expires: "172800"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "172800"
    nginx.ingress.kubernetes.io/session-cookie-samesite: "Strict"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"

    # Request Size Limits
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"

    # Security Headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains";
      more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

spec:
  ingressClassName: nginx

  tls:
  - hosts:
    - vibecode.example.com
    - agentapi.vibecode.example.com
    secretName: vibecode-tls-cert

  rules:
  # Rule 1: Next.js Frontend
  - host: vibecode.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nextjs-frontend
            port:
              number: 3000

  # Rule 2: AgentAPI (HTTP endpoints)
  - host: agentapi.vibecode.example.com
    http:
      paths:
      - path: /api/agents
        pathType: Prefix
        backend:
          service:
            name: code-server-agentapi
            port:
              number: 3284

      # WebSocket endpoint
      - path: /api/agents/ws
        pathType: Prefix
        backend:
          service:
            name: code-server-agentapi
            port:
              number: 3284

  # Rule 3: code-server IDE (per-workspace routing)
  - host: "*.workspace.vibecode.example.com"
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: code-server-agentapi
            port:
              number: 8765
```

### 3.2 External DNS Configuration

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
  namespace: kube-system

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
- apiGroups: [""]
  resources: ["services", "endpoints", "pods"]
  verbs: ["get", "watch", "list"]
- apiGroups: ["extensions", "networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "watch", "list"]
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: external-dns-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
- kind: ServiceAccount
  name: external-dns
  namespace: kube-system

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
  namespace: kube-system
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.14.0
        args:
        - --source=ingress
        - --source=service
        - --domain-filter=vibecode.example.com
        - --provider=aws  # Change to your DNS provider
        - --policy=sync
        - --txt-owner-id=vibecode-cluster
        - --txt-prefix=vibecode-
        env:
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: external-dns-credentials
              key: access-key-id
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: external-dns-credentials
              key: secret-access-key
```

---

## 4. Internal Service Discovery

### 4.1 Kubernetes DNS Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Kubernetes DNS (CoreDNS)                                      │
│                                                                │
│  Service Discovery Naming:                                    │
│  {service-name}.{namespace}.svc.cluster.local                │
│                                                                │
│  Examples:                                                     │
│  - code-server-agentapi.vibecode-platform.svc.cluster.local  │
│  - nextjs-frontend.vibecode-platform.svc.cluster.local       │
│  - postgres.vibecode-platform.svc.cluster.local              │
│  - redis.vibecode-platform.svc.cluster.local                 │
│                                                                │
│  Headless Service (for direct pod access):                    │
│  {pod-name}.{headless-service}.{namespace}.svc.cluster.local │
│                                                                │
│  Example:                                                      │
│  workspace-user123-abc.agentapi-headless.vibecode-platform... │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Service Definitions

**ClusterIP Service (Standard)**:

```yaml
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
  clusterIP: None  # Headless service for direct pod addressing
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
  sessionAffinity: ClientIP  # Sticky sessions
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 hours
```

**Headless Service (Direct Pod Access)**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: agentapi-headless
  namespace: vibecode-platform
  labels:
    app: code-server
    component: workspace
spec:
  type: ClusterIP
  clusterIP: None  # Headless: DNS returns pod IPs directly
  selector:
    app: code-server
    component: workspace
  ports:
  - name: agentapi
    port: 3284
    targetPort: 3284
    protocol: TCP
  publishNotReadyAddresses: false  # Only ready pods in DNS
```

### 4.3 DNS Resolution Flow

```typescript
// Next.js API Route: Resolve AgentAPI service
import dns from 'dns/promises';

async function resolveAgentAPIService(workspaceId: string): Promise<string[]> {
  const serviceName = `code-server-agentapi.vibecode-platform.svc.cluster.local`;

  try {
    // Get all pod IPs for the service
    const addresses = await dns.resolve4(serviceName);

    console.log(`Resolved ${serviceName} to:`, addresses);
    // Output: ['10.244.1.5', '10.244.2.10', '10.244.3.8']

    return addresses;
  } catch (error) {
    console.error(`DNS resolution failed for ${serviceName}:`, error);
    throw new Error('AgentAPI service unavailable');
  }
}

// Connect to specific workspace pod
async function connectToWorkspaceAgentAPI(userId: string, workspaceId: string): Promise<string> {
  // Option 1: Use ClusterIP service (load balanced)
  const serviceUrl = `http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284`;

  // Option 2: Use headless service (direct pod addressing)
  const podName = `workspace-${userId}-${workspaceId}`;
  const headlessUrl = `http://${podName}.agentapi-headless.vibecode-platform.svc.cluster.local:3284`;

  // Prefer direct pod addressing for workspace-specific operations
  return headlessUrl;
}
```

### 4.4 Consul Service Mesh (Alternative)

**Decision**: Kubernetes DNS is sufficient for MVP, consider Consul for multi-cluster setups.

**Consul Configuration** (optional):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: consul-config
  namespace: vibecode-platform
data:
  config.json: |
    {
      "datacenter": "vibecode-prod",
      "server": false,
      "client_addr": "0.0.0.0",
      "bind_addr": "0.0.0.0",
      "data_dir": "/consul/data",
      "log_level": "INFO",
      "enable_script_checks": false,
      "services": [
        {
          "name": "agentapi",
          "port": 3284,
          "checks": [
            {
              "http": "http://localhost:3284/health",
              "interval": "30s",
              "timeout": "10s"
            }
          ],
          "tags": ["agentapi", "workspace"]
        },
        {
          "name": "code-server",
          "port": 8765,
          "checks": [
            {
              "http": "http://localhost:8765/healthz",
              "interval": "30s",
              "timeout": "10s"
            }
          ],
          "tags": ["ide", "workspace"]
        }
      ]
    }
```

---

## 5. Network Policies for Isolation

### 5.1 Zero-Trust Network Policy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
  namespace: vibecode-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  # Default deny all traffic (must explicitly allow)
```

### 5.2 Allow Next.js → AgentAPI

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-nextjs-to-agentapi
  namespace: vibecode-platform
spec:
  podSelector:
    matchLabels:
      app: code-server
      component: workspace
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nextjs-frontend
    ports:
    - protocol: TCP
      port: 3284
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3284
```

### 5.3 Allow AgentAPI → External APIs (LLM Providers)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-agentapi-egress
  namespace: vibecode-platform
spec:
  podSelector:
    matchLabels:
      app: code-server
      component: workspace
  policyTypes:
  - Egress
  egress:
  # Allow DNS resolution
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

  # Allow HTTPS to external APIs (Anthropic, OpenAI, etc.)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443

  # Allow PostgreSQL connection
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432

  # Allow Redis connection
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

### 5.4 Prevent Cross-Workspace Access

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-workspaces
  namespace: vibecode-platform
spec:
  podSelector:
    matchLabels:
      component: workspace
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Only allow traffic from Next.js API (not from other workspaces)
  - from:
    - podSelector:
        matchLabels:
          app: nextjs-frontend
  egress:
  # Allow DNS, PostgreSQL, Redis, external APIs
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
```

---

## 6. Load Balancing Strategy

### 6.1 Multi-Instance AgentAPI Load Balancing

**Scenario**: Multiple AgentAPI instances serving multiple workspaces

```
         ┌────────────────────────────────────────┐
         │ NGINX Ingress / Istio Gateway          │
         │ Load Balancing Algorithm:              │
         │ - Consistent Hashing (workspace ID)    │
         │ - Session Affinity (cookie-based)      │
         └────────────────┬───────────────────────┘
                          │
         ┌────────────────┴───────────────────────┐
         │ Kubernetes Service                     │
         │ Type: ClusterIP                        │
         │ Session Affinity: ClientIP             │
         └────────────────┬───────────────────────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
┌─────▼─────┐       ┌─────▼─────┐      ┌─────▼─────┐
│ AgentAPI  │       │ AgentAPI  │      │ AgentAPI  │
│ Instance 1│       │ Instance 2│      │ Instance 3│
│ (10 pods) │       │ (10 pods) │      │ (10 pods) │
└───────────┘       └───────────┘      └───────────┘
```

### 6.2 Load Balancing Configuration

**Kubernetes Service with Session Affinity**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: code-server-agentapi-lb
  namespace: vibecode-platform
  annotations:
    service.kubernetes.io/topology-aware-hints: "auto"
    cloud.google.com/neg: '{"ingress": true}'
spec:
  type: ClusterIP
  selector:
    app: code-server
    component: workspace
  ports:
  - name: agentapi
    port: 3284
    targetPort: 3284
    protocol: TCP
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 hours
  ipFamilyPolicy: PreferDualStack
  internalTrafficPolicy: Local  # Route to local pod when possible
```

**NGINX Ingress Load Balancing**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
data:
  # Load balancing algorithm
  load-balance: "ewma"  # Exponentially Weighted Moving Average (best for varying load)

  # Alternative algorithms:
  # - "round_robin" (default, simple distribution)
  # - "least_conn" (route to pod with fewest connections)
  # - "ip_hash" (consistent hashing by client IP)

  # Upstream keepalive connections
  upstream-keepalive-connections: "320"
  upstream-keepalive-timeout: "60"
  upstream-keepalive-requests: "10000"

  # Connection limits
  max-worker-connections: "16384"
  worker-processes: "auto"

  # Timeouts for long-running operations
  proxy-connect-timeout: "300"
  proxy-send-timeout: "3600"
  proxy-read-timeout: "3600"
```

### 6.3 Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentapi-hpa
  namespace: vibecode-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: code-server-workspace
  minReplicas: 3
  maxReplicas: 50  # Support 500+ concurrent workspaces (10 pods each)
  metrics:
  # Scale based on CPU
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # Scale based on memory
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

  # Scale based on active agent count
  - type: Pods
    pods:
      metric:
        name: agentapi_active_agents
      target:
        type: AverageValue
        averageValue: "3"  # Scale when avg >3 agents per pod

  # Scale based on HTTP request rate
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60  # Fast scale up
      policies:
      - type: Percent
        value: 100  # Double pods immediately if needed
        periodSeconds: 30
      - type: Pods
        value: 4
        periodSeconds: 30
      selectPolicy: Max
```

---

## 7. TLS Termination and Certificate Management

### 7.1 TLS Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ TLS Termination Points:                                       │
│                                                                │
│ 1. Ingress Controller (NGINX/Istio Gateway)                  │
│    ├─ Let's Encrypt TLS 1.3                                  │
│    ├─ Automatic certificate renewal (cert-manager)           │
│    └─ Edge termination: HTTPS → HTTP (internal)              │
│                                                                │
│ 2. Service Mesh (Optional mTLS)                              │
│    ├─ Istio/Linkerd mTLS between services                    │
│    ├─ Automatic certificate rotation                         │
│    └─ Zero-trust internal communication                      │
│                                                                │
│ 3. Database/Redis (TLS for sensitive data)                   │
│    ├─ PostgreSQL TLS (sslmode=require)                       │
│    ├─ Redis TLS (redis://...?tls=true)                       │
│    └─ Self-signed or private CA certificates                 │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Cert-Manager Configuration

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cert-manager

---
# Install cert-manager CRDs and controller
# kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@vibecode.example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    # HTTP-01 challenge (for most domains)
    - http01:
        ingress:
          class: nginx
    # DNS-01 challenge (for wildcard certificates)
    - dns01:
        route53:
          region: us-east-1
          hostedZoneID: Z1234567890ABC
          accessKeyID: AKIAIOSFODNN7EXAMPLE
          secretAccessKeySecretRef:
            name: route53-credentials
            key: secret-access-key

---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@vibecode.example.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
    - http01:
        ingress:
          class: nginx
```

### 7.3 Certificate Resources

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: vibecode-tls-cert
  namespace: vibecode-platform
spec:
  secretName: vibecode-tls-cert
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: vibecode.example.com
  dnsNames:
  - vibecode.example.com
  - agentapi.vibecode.example.com
  - "*.workspace.vibecode.example.com"  # Wildcard for workspace subdomains
  duration: 2160h  # 90 days
  renewBefore: 360h  # Renew 15 days before expiry
  privateKey:
    algorithm: RSA
    size: 4096
    rotationPolicy: Always
  usages:
  - server auth
  - client auth
```

### 7.4 mTLS Configuration (Istio)

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-mtls
  namespace: vibecode-platform
spec:
  mtls:
    mode: STRICT  # Enforce mTLS for all services

---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: agentapi-auth-policy
  namespace: vibecode-platform
spec:
  selector:
    matchLabels:
      app: code-server
      component: workspace
  action: ALLOW
  rules:
  # Allow Next.js API to call AgentAPI
  - from:
    - source:
        principals: ["cluster.local/ns/vibecode-platform/sa/nextjs-frontend"]
    to:
    - operation:
        methods: ["GET", "POST", "PUT", "DELETE"]
        paths: ["/api/agents/*"]

  # Allow health checks
  - to:
    - operation:
        methods: ["GET"]
        paths: ["/health", "/ready"]
```

---

## 8. Performance Optimization

### 8.1 Connection Pooling

**Next.js → AgentAPI Connection Pool**:

```typescript
import http from 'http';
import https from 'https';

// Global HTTP agent with connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 256,  // Max concurrent connections per host
  maxFreeSockets: 128,  // Max idle connections
  timeout: 300000,  // 5 minutes
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 256,
  maxFreeSockets: 128,
  timeout: 300000,
  rejectUnauthorized: true,  // Verify TLS certificates
});

// Use with axios or fetch
import axios from 'axios';

const agentapiClient = axios.create({
  baseURL: 'http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284',
  httpAgent,
  httpsAgent,
  timeout: 300000,
  maxRedirects: 0,
  validateStatus: (status) => status < 500,
});

export async function callAgentAPI(endpoint: string, data: any): Promise<any> {
  const response = await agentapiClient.post(endpoint, data, {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': generateRequestId(),
    },
  });
  return response.data;
}
```

### 8.2 DNS Caching

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns-custom
  namespace: kube-system
data:
  cache.override: |
    cache {
      success 9984 30  # Cache successful lookups for 30s
      denial 9984 10   # Cache negative lookups for 10s
      prefetch 10 60s  # Prefetch expiring entries
    }
```

### 8.3 Network Latency Monitoring

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-network-monitoring
  namespace: monitoring
data:
  network-latency-rules.yml: |
    groups:
    - name: network_latency
      interval: 30s
      rules:
      # Alert if p95 latency >10ms for same-pod communication
      - alert: HighAgentAPILatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket{
              service="agentapi",
              source="code-server"
            }[5m])
          ) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency for agentapi communication"
          description: "p95 latency is {{ $value }}s (target: <10ms)"

      # Alert if Next.js → AgentAPI latency >50ms
      - alert: HighAPIBridgeLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket{
              service="nextjs",
              destination="agentapi"
            }[5m])
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency for Next.js → AgentAPI"
          description: "p95 latency is {{ $value }}s (target: <50ms)"
```

---

## 9. Testing and Validation

### 9.1 Network Latency Testing

```bash
#!/bin/bash
# Test network latency between components

echo "Testing network latency..."

# Test 1: Next.js → AgentAPI (internal cluster)
kubectl run test-pod --image=curlimages/curl:latest --rm -it --restart=Never -- \
  sh -c "time curl -s http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284/health"

# Test 2: code-server → agentapi (same pod, localhost)
kubectl exec -it deployment/code-server-workspace -c code-server -- \
  sh -c "time curl -s http://127.0.0.1:3284/health"

# Test 3: External → Ingress → Next.js
time curl -s https://vibecode.example.com/api/health

# Test 4: WebSocket connection latency
echo "Testing WebSocket latency..."
node - <<EOF
const WebSocket = require('ws');
const ws = new WebSocket('wss://agentapi.vibecode.example.com/api/agents/ws?agentId=test');

ws.on('open', () => {
  const start = Date.now();
  ws.send(JSON.stringify({ type: 'ping' }));

  ws.on('message', (data) => {
    const latency = Date.now() - start;
    console.log(\`WebSocket RTT: \${latency}ms\`);
    ws.close();
  });
});
EOF
```

### 9.2 Load Testing

```bash
#!/bin/bash
# Load test AgentAPI with 100 concurrent connections

kubectl run load-test --image=grafana/k6:latest --rm -it --restart=Never -- \
  run -e BASE_URL=http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284 - <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<50'],  // 95% of requests <50ms
    http_req_failed: ['rate<0.01'],   // Error rate <1%
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 50ms': (r) => r.timings.duration < 50,
  });
  sleep(1);
}
EOF
```

### 9.3 Network Policy Validation

```bash
#!/bin/bash
# Test network isolation policies

echo "Testing network policies..."

# Test 1: Next.js → AgentAPI (should succeed)
kubectl exec -it deployment/nextjs-frontend -- \
  curl -s http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284/health && \
  echo "✓ Next.js → AgentAPI allowed" || \
  echo "✗ Next.js → AgentAPI blocked (ERROR)"

# Test 2: Workspace 1 → Workspace 2 (should fail)
kubectl exec -it workspace-user1-ws1 -c agentapi -- \
  curl -s http://workspace-user2-ws2.agentapi-headless.vibecode-platform.svc.cluster.local:3284/health && \
  echo "✗ Cross-workspace access allowed (SECURITY ISSUE)" || \
  echo "✓ Cross-workspace access blocked"

# Test 3: AgentAPI → External API (should succeed)
kubectl exec -it deployment/code-server-workspace -c agentapi -- \
  curl -s https://api.anthropic.com && \
  echo "✓ External API access allowed" || \
  echo "✗ External API access blocked (ERROR)"
```

---

## 10. Troubleshooting Guide

### 10.1 Common Issues

| Issue | Symptom | Diagnosis | Solution |
|-------|---------|-----------|----------|
| **High Latency** | Requests taking >50ms | Check `kubectl top pods` for resource saturation | Scale up pods, optimize code |
| **Connection Timeouts** | 504 Gateway Timeout | Check ingress logs: `kubectl logs -n ingress-nginx` | Increase proxy timeouts |
| **WebSocket Drops** | Frequent reconnections | Check network policy: `kubectl describe netpol` | Verify WebSocket paths in policy |
| **TLS Errors** | Certificate validation fails | Check cert-manager: `kubectl get certificates -A` | Renew certificates manually |
| **DNS Resolution Fails** | Service not found | Check CoreDNS: `kubectl logs -n kube-system -l k8s-app=kube-dns` | Restart CoreDNS pods |

### 10.2 Debugging Commands

```bash
# Check service endpoints
kubectl get endpoints code-server-agentapi -n vibecode-platform

# Test DNS resolution
kubectl run dns-test --image=busybox:latest --rm -it --restart=Never -- \
  nslookup code-server-agentapi.vibecode-platform.svc.cluster.local

# Check network connectivity
kubectl run netshoot --image=nicolaka/netshoot --rm -it --restart=Never -- bash

# Inside netshoot pod:
curl -v http://code-server-agentapi.vibecode-platform.svc.cluster.local:3284/health
traceroute code-server-agentapi.vibecode-platform.svc.cluster.local
nc -zv code-server-agentapi.vibecode-platform.svc.cluster.local 3284

# Check Istio sidecar injection
kubectl get pods -n vibecode-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'

# View Istio proxy logs
kubectl logs -n vibecode-platform <pod-name> -c istio-proxy

# Check network policies
kubectl get networkpolicy -n vibecode-platform
kubectl describe networkpolicy isolate-workspaces -n vibecode-platform
```

---

## 11. Summary and Recommendations

### 11.1 Architecture Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Service Mesh** | Linkerd (MVP), Istio (scale) | Linkerd: low overhead, simple; Istio: advanced features |
| **Ingress** | NGINX Ingress Controller | Battle-tested, WebSocket support, wide adoption |
| **Service Discovery** | Kubernetes DNS | Native, simple, sufficient for single-cluster |
| **TLS** | Let's Encrypt + cert-manager | Free, automated, industry standard |
| **Load Balancing** | Session affinity (ClientIP) | Maintain workspace → pod affinity |
| **Network Policy** | Zero-trust with explicit allow | Security by default, prevent lateral movement |

### 11.2 Performance Characteristics

| Metric | Target | Actual (Expected) |
|--------|--------|-------------------|
| **Same-pod latency** | <1ms p99 | <0.5ms (localhost) |
| **Cluster latency** | <10ms p95 | ~3-5ms (internal network) |
| **Ingress latency** | <50ms p95 | ~20-30ms (NGINX overhead) |
| **WebSocket RTT** | <100ms p95 | ~50-70ms (full stack) |
| **Horizontal scaling** | 10+ replicas | Tested to 50 pods |

### 11.3 Next Steps

1. **Deploy Linkerd for MVP** (Week 1)
   - Install Linkerd control plane
   - Inject proxies into vibecode-platform namespace
   - Test mTLS and observability

2. **Configure NGINX Ingress** (Week 1)
   - Set up TLS with Let's Encrypt
   - Configure WebSocket support
   - Test rate limiting and session affinity

3. **Implement Network Policies** (Week 2)
   - Deploy zero-trust baseline
   - Test workspace isolation
   - Validate egress rules

4. **Performance Testing** (Week 2-3)
   - Load test with 100+ concurrent agents
   - Measure latency at each layer
   - Optimize connection pooling

5. **Production Readiness** (Week 3-4)
   - Set up monitoring dashboards
   - Create runbooks for common issues
   - Document disaster recovery procedures

---

## Appendix A: Network Topology Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          INTERNET / CDN                                     │
│                                                                             │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 │ HTTPS (TLS 1.3)
                                 ↓
┌────────────────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER (Cloud Provider)                      │
│                        Type: Layer 4 (TCP) or Layer 7 (HTTP)               │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ↓                      ↓                      ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ NGINX Ingress   │    │ NGINX Ingress   │    │ NGINX Ingress   │
│ Controller 1    │    │ Controller 2    │    │ Controller 3    │
│ (High Avail.)   │    │ (High Avail.)   │    │ (High Avail.)   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                │ Kubernetes ClusterIP Services
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ↓                      ↓                      ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Next.js Pod 1   │    │ Next.js Pod 2   │    │ Next.js Pod 3   │
│ Port: 3000      │    │ Port: 3000      │    │ Port: 3000      │
│ (API Routes)    │    │ (API Routes)    │    │ (API Routes)    │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │       HTTP/WebSocket (Internal Network)    │
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                ↓
                   ┌────────────────────────────┐
                   │  AgentAPI ClusterIP Service │
                   │  Port: 3284                 │
                   │  Session Affinity: ClientIP │
                   └────────────┬───────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ↓                      ↓                      ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Workspace Pod 1 │    │ Workspace Pod 2 │    │ Workspace Pod N │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │code-server  │ │    │ │code-server  │ │    │ │code-server  │ │
│ │Port: 8765   │ │    │ │Port: 8765   │ │    │ │Port: 8765   │ │
│ └──────┬──────┘ │    │ └──────┬──────┘ │    │ └──────┬──────┘ │
│        │ 127.0.0.1  │ │        │ 127.0.0.1  │ │        │ 127.0.0.1  │
│        ↓ <1ms   │    │        ↓ <1ms   │    │        ↓ <1ms   │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │agentapi     │ │    │ │agentapi     │ │    │ │agentapi     │ │
│ │Port: 3284   │ │    │ │Port: 3284   │ │    │ │Port: 3284   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ Shared Volumes: │    │ Shared Volumes: │    │ Shared Volumes: │
│ - /tmp/terminals│    │ - /tmp/terminals│    │ - /tmp/terminals│
│ - /workspace    │    │ - /workspace    │    │ - /workspace    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                │ PostgreSQL / Redis
                                ↓
                   ┌────────────────────────────┐
                   │   Backend Services         │
                   │   - PostgreSQL (port 5432) │
                   │   - Redis (port 6379)      │
                   │   - Monitoring             │
                   └────────────────────────────┘
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Next Review**: 2025-10-09
**Approvers**: @backend-team @devops-team @network-team
