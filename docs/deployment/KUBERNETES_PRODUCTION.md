# Kubernetes Production Deployment

Production-grade Kubernetes deployment patterns and best practices for VibeCode.

## High Availability Architecture

### Multi-Node Cluster Design

```yaml
# Production cluster topology
Control Plane:
  - 3 master nodes (etcd, API server, scheduler)
  - Distributed across availability zones

Worker Nodes:
  - Minimum 3 worker nodes
  - 4+ CPU cores, 16GB+ RAM per node
  - Spread across availability zones

Storage:
  - SSD-backed persistent volumes
  - Redundant storage backend
  - Automated volume snapshots
```

### High Availability Deployment

```yaml
# ha-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: vibecode-production
  labels:
    app: vibecode
    component: webgui
    version: v1
spec:
  replicas: 3  # Minimum for HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime deployments
  selector:
    matchLabels:
      app: vibecode
      component: webgui
  template:
    metadata:
      labels:
        app: vibecode
        component: webgui
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/api/metrics"
    spec:
      # Anti-affinity to spread pods across nodes
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
                  - vibecode
              topologyKey: kubernetes.io/hostname
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            preference:
              matchExpressions:
              - key: node-role
                operator: In
                values:
                - application

      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault

      containers:
      - name: vibecode
        image: vibecode/webgui:1.0.0  # Use specific version tags in production
        imagePullPolicy: IfNotPresent

        ports:
        - name: http
          containerPort: 3000
          protocol: TCP

        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: database-url
        - name: NEXTAUTH_URL
          valueFrom:
            configMapKeyRef:
              name: vibecode-config
              key: nextauth-url
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: nextauth-secret
        - name: DD_AGENT_HOST
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP
        - name: DD_ENV
          value: "production"
        - name: DD_SERVICE
          value: "vibecode-webgui"
        - name: DD_VERSION
          value: "1.0.0"

        # Resource management
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

        # Health checks
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3

        startupProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 30

        # Security hardening
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false  # Next.js needs write access
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop:
            - ALL

        # Volume mounts
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: next-cache
          mountPath: /app/.next/cache

      volumes:
      - name: tmp
        emptyDir: {}
      - name: next-cache
        emptyDir: {}

      # DNS configuration for faster lookups
      dnsConfig:
        options:
        - name: ndots
          value: "1"

      # Graceful shutdown
      terminationGracePeriodSeconds: 60

      # Image pull secrets for private registry
      imagePullSecrets:
      - name: registry-credentials
```

## Autoscaling Configuration

### Horizontal Pod Autoscaler (HPA)

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-webgui-hpa
  namespace: vibecode-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  minReplicas: 3
  maxReplicas: 20
  metrics:
  # CPU-based scaling
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # Memory-based scaling
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

  # Custom metrics (requires metrics server)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5 minutes
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min

    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 4
        periodSeconds: 30
      selectPolicy: Max
```

### Vertical Pod Autoscaler (VPA)

```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: vibecode-webgui-vpa
  namespace: vibecode-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  updatePolicy:
    updateMode: "Auto"  # Or "Recreate" for stateful apps
  resourcePolicy:
    containerPolicies:
    - containerName: vibecode
      minAllowed:
        cpu: 500m
        memory: 1Gi
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
      controlledResources:
      - cpu
      - memory
```

## Database High Availability

### PostgreSQL with Replication

```yaml
# postgres-ha.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: vibecode-production
data:
  postgresql.conf: |
    # Connection settings
    max_connections = 200
    superuser_reserved_connections = 3

    # Memory settings
    shared_buffers = 4GB
    effective_cache_size = 12GB
    maintenance_work_mem = 1GB
    work_mem = 10MB

    # WAL settings for replication
    wal_level = replica
    max_wal_senders = 10
    max_replication_slots = 10
    hot_standby = on

    # Checkpoint settings
    checkpoint_timeout = 15min
    checkpoint_completion_target = 0.9
    max_wal_size = 4GB
    min_wal_size = 1GB

    # Query tuning
    random_page_cost = 1.1  # SSD storage
    effective_io_concurrency = 200

    # Logging
    log_min_duration_statement = 1000
    log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
    log_checkpoints = on
    log_connections = on
    log_disconnections = on
    log_lock_waits = on

    # Monitoring
    shared_preload_libraries = 'pg_stat_statements'
    pg_stat_statements.track = all

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-primary
  namespace: vibecode-production
spec:
  serviceName: postgres-primary
  replicas: 1
  selector:
    matchLabels:
      app: postgres
      role: primary
  template:
    metadata:
      labels:
        app: postgres
        role: primary
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: vibecode
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata

        resources:
          requests:
            memory: "8Gi"
            cpu: "2000m"
          limits:
            memory: "16Gi"
            cpu: "4000m"

        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql

        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10

        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5

      volumes:
      - name: postgres-config
        configMap:
          name: postgres-config

  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 500Gi

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-replica
  namespace: vibecode-production
spec:
  serviceName: postgres-replica
  replicas: 2  # Two read replicas
  selector:
    matchLabels:
      app: postgres
      role: replica
  template:
    metadata:
      labels:
        app: postgres
        role: replica
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_PRIMARY_HOST
          value: postgres-primary
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata

        resources:
          requests:
            memory: "8Gi"
            cpu: "2000m"
          limits:
            memory: "16Gi"
            cpu: "4000m"

        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: replica-config
          mountPath: /etc/postgresql

      volumes:
      - name: replica-config
        configMap:
          name: postgres-replica-config

  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 500Gi
```

## Service Mesh Integration

### Istio Configuration

```yaml
# istio-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: vibecode-gateway
  namespace: vibecode-production
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: vibecode-tls
    hosts:
    - "vibecode.example.com"
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "vibecode.example.com"
    tls:
      httpsRedirect: true

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: vibecode-routes
  namespace: vibecode-production
spec:
  hosts:
  - "vibecode.example.com"
  gateways:
  - vibecode-gateway
  http:
  - match:
    - uri:
        prefix: /api
    route:
    - destination:
        host: vibecode-webgui
        port:
          number: 3000
    retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: 5xx,reset,connect-failure,refused-stream
    timeout: 30s
    corsPolicy:
      allowOrigins:
      - exact: "https://vibecode.example.com"
      allowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
      allowHeaders:
      - content-type
      - authorization
      maxAge: "24h"

---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: vibecode-destination
  namespace: vibecode-production
spec:
  host: vibecode-webgui
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 1000
      http:
        http1MaxPendingRequests: 1000
        http2MaxRequests: 1000
        maxRequestsPerConnection: 100
    loadBalancer:
      simple: LEAST_REQUEST
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50
```

## Network Policies

```yaml
# network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: vibecode-webgui-policy
  namespace: vibecode-production
spec:
  podSelector:
    matchLabels:
      app: vibecode
      component: webgui
  policyTypes:
  - Ingress
  - Egress

  ingress:
  # Allow from ingress controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000

  # Allow from monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000

  egress:
  # Allow to database
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  # Allow to external APIs (AI providers)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443

  # Allow DNS
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-policy
  namespace: vibecode-production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  - Egress

  ingress:
  # Allow from application
  - from:
    - podSelector:
        matchLabels:
          app: vibecode
    ports:
    - protocol: TCP
      port: 5432

  # Allow from monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 5432

  # Allow replication between postgres instances
  - from:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  egress:
  # Allow DNS
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

  # Allow replication
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

## Pod Disruption Budgets

```yaml
# pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: vibecode-webgui-pdb
  namespace: vibecode-production
spec:
  minAvailable: 2  # Always keep at least 2 pods running
  selector:
    matchLabels:
      app: vibecode
      component: webgui

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: postgres-primary-pdb
  namespace: vibecode-production
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: postgres
      role: primary
```

## Resource Quotas

```yaml
# resource-quotas.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: vibecode-quota
  namespace: vibecode-production
spec:
  hard:
    requests.cpu: "50"
    requests.memory: 100Gi
    limits.cpu: "100"
    limits.memory: 200Gi
    persistentvolumeclaims: "10"
    services.loadbalancers: "2"

---
apiVersion: v1
kind: LimitRange
metadata:
  name: vibecode-limits
  namespace: vibecode-production
spec:
  limits:
  - max:
      cpu: "4"
      memory: 8Gi
    min:
      cpu: 100m
      memory: 128Mi
    default:
      cpu: "1"
      memory: 2Gi
    defaultRequest:
      cpu: 500m
      memory: 1Gi
    type: Container
```

## Rolling Update Strategy

```bash
# Zero-downtime deployment script
#!/bin/bash

set -euo pipefail

NAMESPACE="vibecode-production"
DEPLOYMENT="vibecode-webgui"
NEW_IMAGE="$1"

echo "Starting rolling update to ${NEW_IMAGE}..."

# Update image
kubectl set image deployment/${DEPLOYMENT} \
  vibecode=${NEW_IMAGE} \
  -n ${NAMESPACE} \
  --record

# Watch rollout status
kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}

# Verify deployment
READY_REPLICAS=$(kubectl get deployment ${DEPLOYMENT} -n ${NAMESPACE} -o jsonpath='{.status.readyReplicas}')
DESIRED_REPLICAS=$(kubectl get deployment ${DEPLOYMENT} -n ${NAMESPACE} -o jsonpath='{.spec.replicas}')

if [ "${READY_REPLICAS}" == "${DESIRED_REPLICAS}" ]; then
  echo "Deployment successful! ${READY_REPLICAS}/${DESIRED_REPLICAS} replicas ready"
else
  echo "Deployment failed! Only ${READY_REPLICAS}/${DESIRED_REPLICAS} replicas ready"
  echo "Rolling back..."
  kubectl rollout undo deployment/${DEPLOYMENT} -n ${NAMESPACE}
  exit 1
fi

# Run smoke tests
echo "Running smoke tests..."
kubectl run smoke-test \
  --image=curlimages/curl:latest \
  --rm -it --restart=Never \
  --namespace=${NAMESPACE} \
  -- curl -f http://vibecode-webgui:3000/api/health

echo "Deployment completed successfully!"
```

## Next Steps

- [Security Hardening](./SECURITY_HARDENING.md)
- [Monitoring Configuration](./MONITORING.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
