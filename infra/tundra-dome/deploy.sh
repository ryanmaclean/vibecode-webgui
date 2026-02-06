#!/bin/bash
#
# Tundra Dome - KIND Deployment Script
# =====================================
# Deploys the complete Tundra Dome stack to a local KIND cluster
#
# Usage:
#   ./deploy.sh                    # Full deployment
#   ./deploy.sh --cluster-only     # Create cluster only
#   ./deploy.sh --stack-only       # Deploy stack to existing cluster
#   ./deploy.sh --crds-only        # Install CRDs only
#   ./deploy.sh --destroy          # Tear down everything
#   ./deploy.sh --status           # Show deployment status
#
# Prerequisites:
#   - kind, kubectl, docker installed
#   - DD_API_KEY environment variable set (for Datadog integration)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="tundra-dome"
NAMESPACE_TUNDRA="tundra-dome"
NAMESPACE_DATADOG="datadog"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

#
# Check prerequisites
#
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing=()

    command -v kind >/dev/null 2>&1 || missing+=("kind")
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v docker >/dev/null 2>&1 || missing+=("docker")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        echo "Install them with:"
        echo "  brew install kind kubectl docker"
        exit 1
    fi

    # Check Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Warn if DD_API_KEY not set
    if [ -z "$DD_API_KEY" ]; then
        log_warn "DD_API_KEY not set. Datadog integration will be limited."
        log_warn "Set it with: export DD_API_KEY=your_api_key"
    fi

    log_success "Prerequisites check passed"
}

#
# Create KIND cluster with custom config
#
create_cluster() {
    log_info "Creating KIND cluster: $CLUSTER_NAME"

    # Check if cluster exists
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_warn "Cluster '$CLUSTER_NAME' already exists"
        read -p "Delete and recreate? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kind delete cluster --name "$CLUSTER_NAME"
        else
            log_info "Using existing cluster"
            kubectl cluster-info --context "kind-${CLUSTER_NAME}" >/dev/null 2>&1 || {
                log_error "Cannot connect to existing cluster"
                exit 1
            }
            return 0
        fi
    fi

    # Create cluster config
    cat > /tmp/kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${CLUSTER_NAME}
nodes:
  - role: control-plane
  - role: worker
    extraPortMappings:
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
      - containerPort: 30092
        hostPort: 9092
        protocol: TCP
      - containerPort: 30125
        hostPort: 8125
        protocol: UDP
      - containerPort: 30126
        hostPort: 8126
        protocol: TCP
EOF

    kind create cluster --config /tmp/kind-config.yaml
    rm /tmp/kind-config.yaml

    # Set context
    kubectl cluster-info --context "kind-${CLUSTER_NAME}"

    log_success "KIND cluster created: $CLUSTER_NAME"
}

#
# Create namespaces
#
create_namespaces() {
    log_info "Creating namespaces..."

    kubectl create namespace "$NAMESPACE_TUNDRA" --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace "$NAMESPACE_DATADOG" --dry-run=client -o yaml | kubectl apply -f -

    # Label namespaces with metaphor
    kubectl label namespace "$NAMESPACE_TUNDRA" tundra.dome/town=tundra-dome --overwrite
    kubectl label namespace "$NAMESPACE_DATADOG" tundra.dome/town=datadog --overwrite

    log_success "Namespaces created"
}

#
# Create secrets
#
create_secrets() {
    log_info "Creating secrets..."

    local api_key="${DD_API_KEY:-placeholder-key}"

    # Tundra Dome secrets
    kubectl -n "$NAMESPACE_TUNDRA" create secret generic tundra-dome-secrets \
        --from-literal=DD_API_KEY="$api_key" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Datadog secrets
    kubectl -n "$NAMESPACE_DATADOG" create secret generic tundra-dome-secrets \
        --from-literal=DD_API_KEY="$api_key" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created"
}

#
# Install CRDs
#
install_crds() {
    log_info "Installing Tundra Dome CRDs..."

    kubectl apply -f "$SCRIPT_DIR/crds/bead.yaml"
    kubectl apply -f "$SCRIPT_DIR/crds/polecat.yaml"
    kubectl apply -f "$SCRIPT_DIR/crds/lane.yaml"
    kubectl apply -f "$SCRIPT_DIR/crds/playbook.yaml"
    kubectl apply -f "$SCRIPT_DIR/crds/station.yaml"

    log_success "CRDs installed"
}

#
# Deploy Datadog Agent
#
deploy_datadog() {
    log_info "Deploying Datadog Agent..."

    # Create RBAC
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: datadog-agent
  namespace: $NAMESPACE_DATADOG
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: datadog-agent
rules:
  - apiGroups: [""]
    resources: ["nodes", "pods", "services", "endpoints", "events", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "daemonsets", "replicasets", "statefulsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["tundra.dome"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
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
    namespace: $NAMESPACE_DATADOG
EOF

    # Create ConfigMap for agent config
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agent-config
  namespace: $NAMESPACE_DATADOG
data:
  datadog.yaml: |
    api_key: \${DD_API_KEY}
    site: datadoghq.com
    logs_enabled: true
    apm_config:
      enabled: true
    process_config:
      enabled: true
EOF

    # Create DaemonSet
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: $NAMESPACE_DATADOG
  labels:
    tundra.dome/role: patrol
    tundra.dome/crew: observability
    tundra.dome/town: datadog
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
        tundra.dome/role: patrol
        tundra.dome/crew: observability
    spec:
      serviceAccountName: datadog-agent
      hostNetwork: true
      hostPID: true
      containers:
        - name: agent
          image: gcr.io/datadoghq/agent:7
          env:
            - name: DD_API_KEY
              valueFrom:
                secretKeyRef:
                  name: tundra-dome-secrets
                  key: DD_API_KEY
                  optional: true
            - name: DD_SITE
              value: datadoghq.com
            - name: DD_ENV
              value: kind
            - name: DD_APM_ENABLED
              value: "true"
            - name: DD_LOGS_ENABLED
              value: "true"
            - name: DD_PROCESS_AGENT_ENABLED
              value: "true"
            - name: DD_DOGSTATSD_NON_LOCAL_TRAFFIC
              value: "true"
            - name: DD_KUBERNETES_KUBELET_HOST
              valueFrom:
                fieldRef:
                  fieldPath: status.hostIP
            - name: DD_COLLECT_KUBERNETES_EVENTS
              value: "true"
            - name: DD_LEADER_ELECTION
              value: "true"
            - name: DD_ORCHESTRATOR_EXPLORER_ENABLED
              value: "true"
            - name: DD_KUBERNETES_COLLECT_METADATA_TAGS
              value: "true"
            - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
              value: "true"
            - name: DD_CONTAINER_EXCLUDE
              value: "name:datadog-agent"
            - name: DD_HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            - name: DD_TAGS
              value: "env:kind,cluster:tundra-dome"
            - name: DD_OL_PROXY_CONFIG_ENABLED
              value: "true"
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 250m
              memory: 512Mi
          volumeMounts:
            - name: dockersocket
              mountPath: /var/run/docker.sock
            - name: procdir
              mountPath: /host/proc
              readOnly: true
            - name: cgroups
              mountPath: /host/sys/fs/cgroup
              readOnly: true
      volumes:
        - name: dockersocket
          hostPath:
            path: /var/run/docker.sock
        - name: procdir
          hostPath:
            path: /proc
        - name: cgroups
          hostPath:
            path: /sys/fs/cgroup
---
apiVersion: v1
kind: Service
metadata:
  name: datadog-agent
  namespace: $NAMESPACE_DATADOG
  labels:
    tundra.dome/station-type: observability
spec:
  selector:
    app: datadog-agent
  ports:
    - name: statsd
      port: 8125
      targetPort: 8125
      protocol: UDP
    - name: apm
      port: 8126
      targetPort: 8126
      protocol: TCP
EOF

    log_success "Datadog Agent deployed"
}

#
# Deploy Tundra Dome stack
#
deploy_stack() {
    log_info "Deploying Tundra Dome stack..."

    # Apply main manifest (with error handling for duplicate env vars)
    kubectl apply -f "$SCRIPT_DIR/tundra-dome.clean.yaml" 2>&1 | grep -v "hides previous definition" || true

    log_success "Tundra Dome stack deployed"
}

#
# Deploy example resources
#
deploy_examples() {
    log_info "Deploying example Tundra Dome resources..."

    kubectl apply -f "$SCRIPT_DIR/examples/"

    log_success "Example resources deployed"
}

#
# Wait for pods to be ready
#
wait_for_ready() {
    log_info "Waiting for pods to be ready..."

    # Wait for Datadog
    kubectl wait --for=condition=ready pod -l app=datadog-agent -n "$NAMESPACE_DATADOG" --timeout=120s 2>/dev/null || log_warn "Datadog agent not ready"

    # Wait for Kafka
    kubectl wait --for=condition=ready pod -l app=kafka -n "$NAMESPACE_TUNDRA" --timeout=120s 2>/dev/null || log_warn "Kafka not ready"

    # Wait for Airflow
    kubectl wait --for=condition=ready pod -l app=airflow-scheduler -n "$NAMESPACE_TUNDRA" --timeout=180s 2>/dev/null || log_warn "Airflow scheduler not ready"

    log_success "Core pods ready"
}

#
# Show deployment status
#
show_status() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                    TUNDRA DOME STATUS"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    echo "📦 PODS"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get pods -n "$NAMESPACE_TUNDRA" -o wide 2>/dev/null || echo "  No pods found"
    echo ""
    kubectl get pods -n "$NAMESPACE_DATADOG" -o wide 2>/dev/null || echo "  No Datadog pods"
    echo ""

    echo "🏷️  DEPLOYMENTS (with Metaphor Labels)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get deployments -n "$NAMESPACE_TUNDRA" -L tundra.dome/role,tundra.dome/crew 2>/dev/null || echo "  No deployments"
    echo ""

    echo "📋 BEADS (Work Items)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get beads -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No beads"
    echo ""

    echo "🛤️  LANES (Priority Queues)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get lanes -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No lanes"
    echo ""

    echo "🦝 POLECATS (Workers)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get polecats -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No polecats"
    echo ""

    echo "📖 PLAYBOOKS (Workflows)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get playbooks -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No playbooks"
    echo ""

    echo "🚉 STATIONS (Services)"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get stations -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No stations"
    echo ""

    echo "🔗 SERVICES"
    echo "───────────────────────────────────────────────────────────────"
    kubectl get svc -n "$NAMESPACE_TUNDRA" 2>/dev/null || echo "  No services"
    echo ""

    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Access Airflow UI: kubectl port-forward svc/airflow-api-service 8080:8080 -n tundra-dome"
    echo "                   Then visit http://localhost:8080 (tundra/admin)"
    echo ""
}

#
# Destroy everything
#
destroy() {
    log_warn "This will delete the KIND cluster and all resources!"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deleting KIND cluster..."
        kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
        log_success "Cluster deleted"
    else
        log_info "Cancelled"
    fi
}

#
# Full deployment
#
full_deploy() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           TUNDRA DOME - KIND DEPLOYMENT                       ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""

    check_prerequisites
    create_cluster
    create_namespaces
    create_secrets
    install_crds
    deploy_datadog
    deploy_stack
    deploy_examples
    wait_for_ready
    show_status

    echo ""
    log_success "Tundra Dome deployment complete!"
    echo ""
}

#
# Main
#
case "${1:-}" in
    --cluster-only)
        check_prerequisites
        create_cluster
        create_namespaces
        create_secrets
        ;;
    --stack-only)
        check_prerequisites
        install_crds
        deploy_datadog
        deploy_stack
        deploy_examples
        wait_for_ready
        show_status
        ;;
    --crds-only)
        check_prerequisites
        install_crds
        deploy_examples
        ;;
    --destroy)
        destroy
        ;;
    --status)
        show_status
        ;;
    --help|-h)
        echo "Tundra Dome KIND Deployment Script"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  (none)           Full deployment (cluster + stack)"
        echo "  --cluster-only   Create KIND cluster only"
        echo "  --stack-only     Deploy stack to existing cluster"
        echo "  --crds-only      Install CRDs and examples only"
        echo "  --destroy        Delete KIND cluster"
        echo "  --status         Show deployment status"
        echo "  --help           Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  DD_API_KEY       Datadog API key (required for full observability)"
        echo ""
        ;;
    *)
        full_deploy
        ;;
esac
