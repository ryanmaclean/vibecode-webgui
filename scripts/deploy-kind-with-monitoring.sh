#!/usr/bin/env bash
set -euo pipefail

# VibeCode KIND Deployment with Full Monitoring Stack
# Deploys docs service + Datadog monitoring for dev/stg/prd parity

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"

log_step "VibeCode KIND Deployment with Monitoring"
cd "$REPO_ROOT"

# Configuration
CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode"
DATADOG_NAMESPACE="datadog"

# Check if KIND cluster exists
log_info "Checking KIND cluster..."
if ! kind get clusters | grep -q "$CLUSTER_NAME"; then
    log_info "Creating KIND cluster: $CLUSTER_NAME"
    kind create cluster --name "$CLUSTER_NAME"
    log_success "KIND cluster created"
else
    log_success "KIND cluster exists"
fi

# Ensure kubectl context is set
kubectl config use-context "kind-$CLUSTER_NAME"

# Create namespaces
log_info "Creating namespaces..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace "$DATADOG_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
log_success "Namespaces created"

# Build and load docs image
log_info "Building and loading docs image..."
cd "${REPO_ROOT}/docs"
docker build -t vibecode-docs:latest .
kind load docker-image vibecode-docs:latest --name "$CLUSTER_NAME"
log_success "Docs image built and loaded"

# Deploy docs service
log_info "Deploying docs service..."
cd "${REPO_ROOT}"
kubectl apply -f k8s/docs-deployment.yaml
log_success "Docs service deployed"

# Setup Datadog
log_info "Setting up Datadog monitoring..."

# Add Datadog Helm repo
helm repo add datadog https://helm.datadoghq.com >/dev/null 2>&1 || true
helm repo update >/dev/null 2>&1

# Create Datadog secret with dummy keys for local development
kubectl create secret generic datadog-secret \
    --from-literal=api-key="dummy-key-for-local-dev" \
    --from-literal=app-key="dummy-app-key-for-local-dev" \
    -n "$DATADOG_NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

# Install Datadog with minimal configuration for local development
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-config
  namespace: $DATADOG_NAMESPACE
data:
  datadog.yaml: |
    api_key: dummy-key-for-local-dev
    site: datadoghq.com
    dd_url: https://app.datadoghq.com
    
    # Local development settings
    cluster_name: "vibecode-kind-local"
    
    # Enable basic monitoring
    logs_enabled: true
    log_level: INFO
    
    # APM settings
    apm_config:
      enabled: true
      apm_dd_url: https://trace.agent.datadoghq.com
      
    # Process monitoring
    process_config:
      enabled: true
      
    # Tags for local environment
    tags:
      - env:developement
      - cluster:kind
      - project:vibecode
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: $DATADOG_NAMESPACE
  labels:
    app: datadog-agent
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
      name: datadog-agent
    spec:
      serviceAccountName: datadog-agent
      containers:
      - image: gcr.io/datadoghq/agent:7.66.1
        imagePullPolicy: Always
        name: datadog-agent
        ports:
          - containerPort: 8125
            name: dogstatsdport
            protocol: UDP
          - containerPort: 8126
            name: traceport
            protocol: TCP
        env:
          - name: DD_API_KEY
            valueFrom:
              secretKeyRef:
                name: datadog-secret
                key: api-key
          - name: DD_SITE
            value: "datadoghq.com"
          - name: DD_CLUSTER_NAME
            value: "vibecode-kind-local"
          - name: DD_LOGS_ENABLED
            value: "true"
          - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
            value: "true"
          - name: DD_APM_ENABLED
            value: "true"
          - name: DD_PROCESS_AGENT_ENABLED
            value: "true"
          - name: DD_ENV
            value: "developement"
          - name: KUBERNETES
            value: "true"
          - name: DD_KUBERNETES_KUBELET_HOST
            valueFrom:
              fieldRef:
                fieldPath: status.hostIP
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
        volumeMounts:
          - name: config-volume
            mountPath: /etc/datadog-agent
          - name: dockersocket
            mountPath: /var/run/docker.sock
            readOnly: true
          - name: procdir
            mountPath: /host/proc
            readOnly: true
          - name: cgroups
            mountPath: /host/sys/fs/cgroup
            readOnly: true
        livenessProbe:
          exec:
            command:
            - ./probe.sh
          initialDelaySeconds: 15
          periodSeconds: 5
      volumes:
        - name: config-volume
          configMap:
            name: datadog-config
        - name: dockersocket
          hostPath:
            path: /var/run/docker.sock
        - name: procdir
          hostPath:
            path: /proc
        - name: cgroups
          hostPath:
            path: /sys/fs/cgroup
      tolerations:
        - operator: Exists
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: datadog-agent
  namespace: $DATADOG_NAMESPACE
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: datadog-agent
rules:
- apiGroups: [""]
  resources:
  - services
  - events
  - endpoints
  - pods
  - nodes
  - componentstatuses
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources:
  - configmaps
  verbs: ["get", "update"]
- apiGroups: ["apps"]
  resources:
  - deployments
  - replicasets
  - daemonsets
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: datadog-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: datadog-agent
subjects:
- kind: ServiceAccount
  name: datadog-agent
  namespace: $DATADOG_NAMESPACE
EOF

log_success "Datadog monitoring configured"

# Wait for deployments to be ready
log_info "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/vibecode-docs -n "$NAMESPACE"
log_success "Docs deployment ready"

# Check Datadog status
sleep 10
DATADOG_PODS=$(kubectl get pods -n "$DATADOG_NAMESPACE" -l app=datadog-agent --no-headers | wc -l)
if [ "$DATADOG_PODS" -gt 0 ]; then
    log_success "Datadog agent deployed ($DATADOG_PODS pods)"
else
    log_warning "Datadog agent deployment pending"
fi

# Display status
printf '\n'
log_step "Deployment Status"
log_info "  ☸️  KIND Cluster: ${CLUSTER_NAME}"
log_info "  📚 Docs Service: $(kubectl get deployment vibecode-docs -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')/$(kubectl get deployment vibecode-docs -n "$NAMESPACE" -o jsonpath='{.spec.replicas}') replicas ready"
DATADOG_PODS=$(kubectl get pods -n "$DATADOG_NAMESPACE" -l app=datadog-agent --no-headers 2>/dev/null | wc -l)
log_info "  📊 Datadog Agent: ${DATADOG_PODS} pods deployed"
printf '\n'
log_step "Access URLs"
log_info "  📚 Docs: kubectl port-forward -n ${NAMESPACE} svc/vibecode-docs-service 8080:80"
log_info "  📊 Datadog: Agents emitting metrics with env tags"
printf '\n'
log_success "VibeCode KIND deployment with monitoring complete"
log_info "Ready for dev/stg/prd parity testing"

exit 0
