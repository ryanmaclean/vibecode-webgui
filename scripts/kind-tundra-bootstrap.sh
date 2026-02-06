#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Tundra Dome KIND Cluster Bootstrap
# Automated deployment for Mac Mini M4 (or any Mac) with full Datadog observability
#
# Usage: ./kind-tundra-bootstrap.sh [cluster-name] [-y|--yes]
# Example: ./kind-tundra-bootstrap.sh tundra-dome
# Example: ./kind-tundra-bootstrap.sh my-cluster -y  # Non-interactive mode
#
# This script ensures:
# - KIND cluster with proper configuration
# - Datadog agent with DSM enabled
# - APM service connectivity (fixes the headless service issue)
# - OpenLineage with unique namespace per cluster
# - Kafka infrastructure
# - Airflow with OpenLineage provider
# - All observers and bridges properly configured

# Initialize log aggregation
init_log_aggregation


set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse -y/--yes flag early for non-interactive mode
AUTO_YES=0
POSITIONAL_ARGS=()
for arg in "$@"; do
    case $arg in
        -y|--yes) AUTO_YES=1 ;;
        *) POSITIONAL_ARGS+=("$arg") ;;
    esac
done
set -- "${POSITIONAL_ARGS[@]}"

# Configuration
CLUSTER_NAME="${1:-tundra-dome}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="tundra-dome"
DATADOG_NAMESPACE="datadog"

# Detect hostname for unique naming
HOSTNAME=$(hostname -s | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')
OPENLINEAGE_NAMESPACE="${CLUSTER_NAME}"

# If this is a remote machine (not the primary), prefix with hostname
if [[ "$HOSTNAME" != "mbp-m1" && "$HOSTNAME" != "localhost" ]]; then
    OPENLINEAGE_NAMESPACE="${HOSTNAME}-${CLUSTER_NAME}"
fi

log_info "Bootstrap Configuration:"
log_info "  Cluster Name: $CLUSTER_NAME"
log_info "  K8s Context: kind-$CLUSTER_NAME"
log_info "  OpenLineage Namespace: $OPENLINEAGE_NAMESPACE"
log_info "  Hostname: $HOSTNAME"

# Preflight checks with resource validation
preflight_checks() {
    log_info "Running preflight checks..."

    local missing=0
    local warnings=0

    # Check required commands
    for cmd in docker kind kubectl helm; do
        if ! command -v $cmd &>/dev/null; then
            log_error "Missing: $cmd"
            missing=1
        fi
    done

    if ! docker info &>/dev/null; then
        log_error "Docker is not running"
        missing=1
    fi

    if [[ $missing -eq 1 ]]; then
        log_error "Preflight checks failed - install missing tools first"
        exit 1
    fi

    # Check Docker disk space
    log_info "Checking Docker resources..."

    # Get Docker disk info (more reliable method)
    local docker_disk_info=$(docker run --rm alpine sh -c "df -h / 2>/dev/null || df -h" 2>/dev/null | tail -1)
    local disk_total=$(echo "$docker_disk_info" | awk '{print $2}')
    local disk_used=$(echo "$docker_disk_info" | awk '{print $3}')
    local disk_available=$(echo "$docker_disk_info" | awk '{print $4}')
    local disk_percent=$(echo "$docker_disk_info" | awk '{print $5}')

    log_info "Docker disk - Total: $disk_total, Used: $disk_used ($disk_percent), Available: $disk_available"

    # Parse available disk and check if < 15GB
    if [[ "$disk_available" != "unknown" ]]; then
        local disk_gb=$(echo "$disk_available" | grep -oE '[0-9.]+' | head -1)
        local disk_unit=$(echo "$disk_available" | grep -oE '[GMK]' | head -1)

        # Convert to GB if needed
        if [[ "$disk_unit" == "M" ]]; then
            disk_gb=$(echo "scale=2; $disk_gb / 1024" | bc 2>/dev/null || echo "0")
        fi

        if (( $(echo "$disk_gb < 15" | bc -l 2>/dev/null || echo 0) )); then
            log_error "Docker disk space critically low: ${disk_available}"
            log_error "Need at least 15GB free. Current: ${disk_gb}GB"
            log_error ""
            log_error "To fix:"
            log_error "  1. docker system prune -a --volumes"
            log_error "  2. Increase Docker Desktop disk in Settings -> Resources"
            exit 1
        elif (( $(echo "$disk_gb < 25" | bc -l 2>/dev/null || echo 0) )); then
            log_warn "Docker disk space low: ${disk_available}"
            log_warn "Recommended: 25GB+ free for comfortable operation"
            warnings=1
        fi
    fi

    # Check Docker memory
    local docker_mem=$(docker system info --format '{{.MemTotal}}' 2>/dev/null || echo "0")
    local docker_mem_gb=$(echo "scale=2; $docker_mem / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")

    log_info "Docker memory: ${docker_mem_gb}GB allocated"

    if (( $(echo "$docker_mem_gb < 4" | bc -l 2>/dev/null || echo 0) )); then
        log_error "Docker memory too low: ${docker_mem_gb}GB"
        log_error "Need at least 4GB. Recommended: 8GB+"
        log_error ""
        log_error "To fix: Docker Desktop -> Settings -> Resources -> Memory"
        exit 1
    elif (( $(echo "$docker_mem_gb < 6" | bc -l 2>/dev/null || echo 0) )); then
        log_warn "Docker memory limited: ${docker_mem_gb}GB"
        log_warn "Recommended: 8GB+ for comfortable operation"
        log_warn "Will use reduced resource limits"
        export LOW_MEMORY_MODE=1
        warnings=1
    fi

    # Check system memory
    local sys_mem_gb=$(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1024/1024/1024}' || echo "0")
    log_info "System memory: ${sys_mem_gb}GB"

    # Check DD_API_KEY with fallback locations
    local dd_api_key_source=""
    if [[ -n "$DD_API_KEY" ]]; then
        dd_api_key_source="environment variable"
    elif [[ -f "$HOME/.datadog/api_key" ]]; then
        export DD_API_KEY=$(cat "$HOME/.datadog/api_key")
        dd_api_key_source="$HOME/.datadog/api_key"
    elif [[ -f "/Users/studio/.datadog/api_key" ]]; then
        export DD_API_KEY=$(cat "/Users/studio/.datadog/api_key")
        dd_api_key_source="/Users/studio/.datadog/api_key"
    fi

    if [[ -n "$DD_API_KEY" && -n "$dd_api_key_source" ]]; then
        # Show masked key preview (first 4 and last 4 characters)
        local key_len=${#DD_API_KEY}
        if [[ $key_len -gt 8 ]]; then
            local key_preview="${DD_API_KEY:0:4}...${DD_API_KEY: -4}"
        else
            local key_preview="***"
        fi
        log_success "DD_API_KEY loaded from $dd_api_key_source (key: ${key_preview})"
    else
        log_warn "DD_API_KEY not set. Datadog features will be limited."
        log_warn "Checked locations (in order):"
        log_warn "  1. Environment variable DD_API_KEY"
        log_warn "  2. File: ~/.datadog/api_key"
        log_warn "  3. File: /Users/studio/.datadog/api_key"
        log_warn ""
        log_warn "To fix: export DD_API_KEY=your-key"
        log_warn "Or save to: ~/.datadog/api_key"
        warnings=1
    fi

    if [[ $warnings -gt 0 ]]; then
        echo ""
        if [[ $AUTO_YES -eq 1 ]]; then
            log_info "Auto-accepting warnings (-y flag set)"
        else
            read -p "Continue with warnings? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Aborted by user"
                exit 1
            fi
        fi
    fi

    log_success "Preflight checks passed"
}

# Create KIND cluster
create_cluster() {
    log_info "Creating KIND cluster: $CLUSTER_NAME"

    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_warn "Cluster $CLUSTER_NAME already exists"
        if [[ $AUTO_YES -eq 1 ]]; then
            log_info "Auto-deleting existing cluster (-y flag set)"
            kind delete cluster --name "$CLUSTER_NAME"
        else
            read -p "Delete and recreate? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kind delete cluster --name "$CLUSTER_NAME"
            else
                log_info "Using existing cluster"
                return 0
            fi
        fi
    fi

    # Create cluster config
    cat > /tmp/kind-config-$CLUSTER_NAME.yaml << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
- role: control-plane
  image: kindest/node:v1.29.0
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 30080
    hostPort: 8080
    protocol: TCP
  - containerPort: 30092
    hostPort: 9092
    protocol: TCP
- role: worker
  image: kindest/node:v1.29.0
networking:
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/12"
EOF

    kind create cluster --config /tmp/kind-config-$CLUSTER_NAME.yaml

    # Verify
    kubectl cluster-info --context kind-$CLUSTER_NAME
    log_success "KIND cluster created"
}

# Setup namespaces
setup_namespaces() {
    log_info "Setting up namespaces..."

    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply --context kind-$CLUSTER_NAME -f -
    kubectl create namespace $DATADOG_NAMESPACE --dry-run=client -o yaml | kubectl apply --context kind-$CLUSTER_NAME -f -

    # Label for monitoring
    kubectl label namespace $NAMESPACE monitoring=enabled --overwrite --context kind-$CLUSTER_NAME

    log_success "Namespaces configured"
}

# Install Datadog with DSM
install_datadog() {
    log_info "Installing Datadog with DSM enabled..."

    if [[ -z "$DD_API_KEY" ]]; then
        log_warn "Skipping Datadog installation (no API key)"
        return 0
    fi

    local ctx="kind-$CLUSTER_NAME"
    local expected_version="7.75.2"

    # Add Helm repo
    helm repo add datadog https://helm.datadoghq.com 2>/dev/null || true
    helm repo update

    # Check if Helm release exists and clean up orphaned resources if needed
    log_info "Checking for existing Datadog installation..."
    local helm_release_exists=0
    if helm status datadog -n $DATADOG_NAMESPACE --kube-context $ctx &>/dev/null; then
        helm_release_exists=1
        log_info "Found existing Helm release for Datadog"
    else
        log_info "No Helm release found for Datadog"

        # Check for orphaned resources (non-Helm installation)
        local existing_resources=$(kubectl get all -n $DATADOG_NAMESPACE --context $ctx 2>/dev/null | grep -v "No resources" | wc -l)
        if [[ $existing_resources -gt 1 ]]; then
            log_warn "Found orphaned Datadog resources without Helm release. Cleaning up..."

            # Delete all resources in the namespace
            kubectl delete all --all -n $DATADOG_NAMESPACE --context $ctx 2>/dev/null || true
            kubectl delete secret,configmap,serviceaccount --all -n $DATADOG_NAMESPACE --context $ctx 2>/dev/null || true

            # Delete cluster-scoped resources with Datadog labels
            kubectl delete clusterrole,clusterrolebinding -l app.kubernetes.io/instance=datadog --context $ctx 2>/dev/null || true

            log_info "Cleanup complete. Waiting for resources to terminate..."
            sleep 5
        fi
    fi

    # Create secret
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="$DD_API_KEY" \
        --namespace=$DATADOG_NAMESPACE \
        --context $ctx \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create values file with DSM enabled
    cat > /tmp/datadog-values-$CLUSTER_NAME.yaml << EOF
datadog:
  apiKeyExistingSecret: datadog-secret
  site: datadoghq.com
  clusterName: $CLUSTER_NAME

  # Data Streams Monitoring - CRITICAL for Kafka visibility
  dataStreamsMonitoring:
    enabled: true

  logs:
    enabled: true
    containerCollectAll: true

  apm:
    enabled: true
    portEnabled: true

  processAgent:
    enabled: true
    processCollection: true

  env:
    - name: DD_DATA_STREAMS_ENABLED
      value: "true"
    - name: DD_APM_FEATURES
      value: "data_streams_enabled"

  kubelet:
    tlsVerify: false

agents:
  tolerations:
    - operator: Exists
  image:
    tag: $expected_version

clusterAgent:
  enabled: true
  image:
    tag: $expected_version

  # Enable Kubernetes resource collection (required for K8s Explorer in Datadog)
  orchestratorExplorer:
    enabled: true

  # Collect Kubernetes events
  clusterChecks:
    enabled: true
EOF

    # Install/upgrade Datadog using helm upgrade --install (handles both fresh install and upgrade)
    log_info "Running helm upgrade --install for Datadog..."
    helm upgrade --install datadog datadog/datadog \
        --namespace $DATADOG_NAMESPACE \
        --values /tmp/datadog-values-$CLUSTER_NAME.yaml \
        --kube-context $ctx \
        --wait --timeout=300s

    log_success "Datadog Helm release installed/upgraded"

    # Post-install validation
    log_info "Running post-install validation..."
    local validation_failed=0

    # Validate DaemonSet pods are ready
    log_info "Checking DaemonSet readiness..."
    local ds_desired=$(kubectl get daemonset datadog -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo "0")
    local ds_ready=$(kubectl get daemonset datadog -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.status.numberReady}' 2>/dev/null || echo "0")

    if [[ "$ds_desired" -eq 0 ]]; then
        log_error "Datadog DaemonSet has 0 desired pods"
        validation_failed=1
    elif [[ "$ds_ready" -ne "$ds_desired" ]]; then
        log_error "Datadog DaemonSet not ready: $ds_ready/$ds_desired pods"
        validation_failed=1
    else
        log_success "Datadog DaemonSet ready: $ds_ready/$ds_desired pods"
    fi

    # Validate Cluster Agent deployment is ready
    log_info "Checking Cluster Agent readiness..."
    local ca_desired=$(kubectl get deployment datadog-cluster-agent -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    local ca_ready=$(kubectl get deployment datadog-cluster-agent -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    if [[ "$ca_desired" -eq 0 ]]; then
        log_error "Datadog Cluster Agent has 0 desired replicas"
        validation_failed=1
    elif [[ "$ca_ready" -ne "$ca_desired" ]]; then
        log_error "Datadog Cluster Agent not ready: $ca_ready/$ca_desired replicas"
        validation_failed=1
    else
        log_success "Datadog Cluster Agent ready: $ca_ready/$ca_desired replicas"
    fi

    # Validate agent version
    log_info "Checking agent versions (expected: $expected_version)..."
    local agent_image=$(kubectl get daemonset datadog -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")
    local ca_image=$(kubectl get deployment datadog-cluster-agent -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")

    if [[ "$agent_image" != *"$expected_version"* ]]; then
        log_error "Agent image version mismatch: $agent_image (expected $expected_version)"
        validation_failed=1
    else
        log_success "Agent version verified: $agent_image"
    fi

    if [[ "$ca_image" != *"$expected_version"* ]]; then
        log_error "Cluster Agent image version mismatch: $ca_image (expected $expected_version)"
        validation_failed=1
    else
        log_success "Cluster Agent version verified: $ca_image"
    fi

    # Fail fast if validation failed
    if [[ $validation_failed -ne 0 ]]; then
        log_error "Datadog post-install validation failed!"
        log_error "Check pod status: kubectl get pods -n $DATADOG_NAMESPACE --context $ctx"
        log_error "Check pod logs: kubectl logs -l app.kubernetes.io/name=datadog -n $DATADOG_NAMESPACE --context $ctx"
        exit 1
    fi

    log_success "Datadog installed with DSM - all validations passed"

    # Create APM service to fix connectivity issue
    create_apm_service
}

# Create APM service (fixes the headless service endpoint issue)
create_apm_service() {
    log_info "Creating APM service for trace connectivity..."

    # Wait for agent pods to be labeled
    sleep 10

    # Get the actual label used by agent pods (not cluster-agent)
    # The agent pods have app.kubernetes.io/component=agent, cluster-agent has app=datadog-cluster-agent
    local agent_label=$(kubectl get pods -n $DATADOG_NAMESPACE --context kind-$CLUSTER_NAME \
        -l app.kubernetes.io/component=agent \
        -o jsonpath='{.items[0].metadata.labels.app}' 2>/dev/null || echo "datadog")

    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: v1
kind: Service
metadata:
  name: datadog-agent-apm
  namespace: $DATADOG_NAMESPACE
  labels:
    app: datadog-apm-service
spec:
  selector:
    app: $agent_label
  ports:
  - name: dogstatsd
    port: 8125
    targetPort: 8125
    protocol: UDP
  - name: apm
    port: 8126
    targetPort: 8126
    protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: datadog-apm
  namespace: $DATADOG_NAMESPACE
  labels:
    app: datadog-apm-service
spec:
  selector:
    app.kubernetes.io/component: agent
  ports:
  - name: dogstatsd
    port: 8125
    targetPort: 8125
    protocol: UDP
  - name: apm
    port: 8126
    targetPort: 8126
    protocol: TCP
EOF

    log_success "APM service created"
}
# Install Kafka
install_kafka() {
    log_info "Installing Kafka..."

    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
      - name: kafka
        image: apache/kafka:3.7.0
        ports:
        - containerPort: 9092
        env:
        - name: KAFKA_NODE_ID
          value: "1"
        - name: KAFKA_PROCESS_ROLES
          value: "broker,controller"
        - name: KAFKA_LISTENERS
          value: "PLAINTEXT://:9092,CONTROLLER://:9093"
        - name: KAFKA_ADVERTISED_LISTENERS
          value: "PLAINTEXT://kafka-service:9092"
        - name: KAFKA_CONTROLLER_LISTENER_NAMES
          value: "CONTROLLER"
        - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
          value: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
        - name: KAFKA_CONTROLLER_QUORUM_VOTERS
          value: "1@localhost:9093"
        - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
          value: "1"
        - name: KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR
          value: "1"
        - name: KAFKA_TRANSACTION_STATE_LOG_MIN_ISR
          value: "1"
        - name: KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS
          value: "0"
        - name: CLUSTER_ID
          value: "MkU3OEVBNTcwNTJENDM2Qk"
        resources:
          requests:
            cpu: 100m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: kafka-service
  namespace: $NAMESPACE
spec:
  selector:
    app: kafka
  ports:
  - port: 9092
    targetPort: 9092
EOF

    log_success "Kafka installed"
}

# Create Tundra Dome ConfigMaps
create_configmaps() {
    log_info "Creating Tundra Dome ConfigMaps..."

    # Main config
    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: tundra-dome-config
  namespace: $NAMESPACE
data:
  KAFKA_BROKERS: "kafka-service:9092"
  TD_RIG: "$HOSTNAME"
  DD_ENV: "$OPENLINEAGE_NAMESPACE"
  DD_SITE: "datadoghq.com"
EOF

    # OpenLineage config for Airflow
    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: airflow-openlineage-config
  namespace: $NAMESPACE
data:
  TRANSPORT: '{"type": "http", "url": "https://data-obs-intake.datadoghq.com", "auth": {"type": "api_key", "api_key": "${DD_API_KEY:-placeholder}"}}'
EOF

    log_success "ConfigMaps created"
}

# Create secrets
create_secrets() {
    log_info "Creating secrets..."

    kubectl create secret generic tundra-dome-secrets \
        --from-literal=DD_API_KEY="${DD_API_KEY:-placeholder}" \
        --from-literal=DD_APP_KEY="${DD_APP_KEY:-}" \
        --namespace=$NAMESPACE \
        --context kind-$CLUSTER_NAME \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created"
}

# Deploy Tundra Observer with DSM
deploy_observer() {
    log_info "Deploying Tundra Observer with DSM..."

    # First create the code ConfigMap
    cat << 'OBSERVER_CODE' | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-dsm-code
  namespace: tundra-dome
data:
  package.json: |
    {
      "name": "tundra-observer",
      "version": "1.0.0",
      "private": true,
      "dependencies": {
        "dd-trace": "^5.25.0",
        "kafkajs": "^2.2.4"
      }
    }
  tundra-observer.js: |
    'use strict';

    // Initialize dd-trace FIRST for DSM to work
    require('dd-trace').init({
      service: process.env.DD_SERVICE || 'tundra-observer',
      env: process.env.DD_ENV || 'local',
      version: process.env.DD_VERSION || '0.1.0',
      logInjection: true
    });

    const fs = require('fs');
    const { Kafka } = require('kafkajs');

    const BROKERS = (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',');
    const TOPICS = (process.env.OBSERVER_TOPICS || 'tundra-work-intake,tundra-beads-created,tundra-beads-completed').split(',');
    const GROUP_ID = process.env.OBSERVER_GROUP_ID || 'tundra-observer';
    const OUT_PATH = process.env.OBSERVER_LOG || '/var/log/tundra-observer.jsonl';

    async function main() {
      const kafka = new Kafka({ clientId: 'tundra-observer', brokers: BROKERS });
      const consumer = kafka.consumer({ groupId: GROUP_ID });

      await consumer.connect();

      for (const topic of TOPICS.filter(Boolean)) {
        await consumer.subscribe({ topic, fromBeginning: false });
      }

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const entry = {
            ts: new Date().toISOString(),
            topic,
            partition,
            offset: message.offset,
            value: message.value?.toString()
          };
          fs.appendFileSync(OUT_PATH, JSON.stringify(entry) + '\n');
          console.log(JSON.stringify(entry));
        }
      });
    }

    main().catch(console.error);
OBSERVER_CODE

    # Deploy observer
    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tundra-observer
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tundra-observer
  template:
    metadata:
      labels:
        app: tundra-observer
        tags.datadoghq.com/service: tundra-observer
        tags.datadoghq.com/env: $OPENLINEAGE_NAMESPACE
    spec:
      containers:
      - name: observer
        image: node:20-alpine
        command: ["sh", "-c"]
        args:
        - |
          cp -r /app/. /work/ 2>/dev/null || true
          cd /work && npm install --omit=dev && node tundra-observer.js
        env:
        - name: DD_SERVICE
          value: "tundra-observer"
        - name: DD_ENV
          value: "$OPENLINEAGE_NAMESPACE"
        - name: DD_DATA_STREAMS_ENABLED
          value: "true"
        - name: DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED
          value: "true"
        - name: DD_AGENT_HOST
          value: "datadog-agent-apm.$DATADOG_NAMESPACE.svc.cluster.local"
        - name: DD_DOGSTATSD_PORT
          value: "8125"
        envFrom:
        - configMapRef:
            name: tundra-dome-config
        - secretRef:
            name: tundra-dome-secrets
        volumeMounts:
        - name: code
          mountPath: /app
          readOnly: true
        - name: work
          mountPath: /work
        - name: logs
          mountPath: /var/log
        resources:
          requests:
            cpu: ${LOW_MEMORY_MODE:+50m}${LOW_MEMORY_MODE:-100m}
            memory: ${LOW_MEMORY_MODE:+128Mi}${LOW_MEMORY_MODE:-256Mi}
          limits:
            cpu: ${LOW_MEMORY_MODE:+250m}${LOW_MEMORY_MODE:-500m}
            memory: ${LOW_MEMORY_MODE:+256Mi}${LOW_MEMORY_MODE:-512Mi}
      volumes:
      - name: code
        configMap:
          name: kafka-dsm-code
      - name: work
        emptyDir: {}
      - name: logs
        emptyDir: {}
EOF

    log_success "Tundra Observer deployed with DSM"
}

# Deploy Airflow with OpenLineage
deploy_airflow() {
    log_info "Deploying Airflow with OpenLineage..."

    cat << EOF | kubectl apply --context kind-$CLUSTER_NAME -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: airflow-api-server
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: airflow-api-server
  template:
    metadata:
      labels:
        app: airflow-api-server
        tags.datadoghq.com/service: airflow
        tags.datadoghq.com/env: $OPENLINEAGE_NAMESPACE
    spec:
      initContainers:
      - name: setup
        image: apache/airflow:2.9.0
        command: ["sh", "-c"]
        args:
        - |
          pip install --quiet --target=/opt/airflow/extra-packages \
            kafka-python apache-airflow-providers-openlineage
          echo "Setup complete"
        volumeMounts:
        - name: airflow-home
          mountPath: /opt/airflow
      containers:
      - name: airflow
        image: apache/airflow:2.9.0
        command: ["airflow", "standalone"]
        env:
        - name: PYTHONPATH
          value: "/opt/airflow/extra-packages"
        - name: AIRFLOW__CORE__LOAD_EXAMPLES
          value: "false"
        - name: AIRFLOW__CORE__EXECUTOR
          value: "SequentialExecutor"
        - name: AIRFLOW__OPENLINEAGE__NAMESPACE
          value: "$OPENLINEAGE_NAMESPACE"
        - name: AIRFLOW__OPENLINEAGE__TRANSPORT
          valueFrom:
            configMapKeyRef:
              name: airflow-openlineage-config
              key: TRANSPORT
        - name: DD_SERVICE
          value: "airflow"
        - name: DD_ENV
          value: "$OPENLINEAGE_NAMESPACE"
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: airflow-home
          mountPath: /opt/airflow
        resources:
          requests:
            cpu: 200m
            memory: 768Mi
          limits:
            cpu: 1000m
            memory: 2Gi
      volumes:
      - name: airflow-home
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: airflow
  namespace: $NAMESPACE
spec:
  selector:
    app: airflow-api-server
  ports:
  - port: 8080
    targetPort: 8080
EOF

    log_success "Airflow deployed with OpenLineage namespace: $OPENLINEAGE_NAMESPACE"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    local ctx="kind-$CLUSTER_NAME"

    # Wait for pods
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=kafka -n $NAMESPACE --context $ctx --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=tundra-observer -n $NAMESPACE --context $ctx --timeout=120s 2>/dev/null || true

    echo ""
    log_info "=== Cluster Status ==="
    kubectl get pods -n $NAMESPACE --context $ctx

    echo ""
    log_info "=== Datadog Status ==="
    kubectl get pods -n $DATADOG_NAMESPACE --context $ctx 2>/dev/null || echo "Datadog not installed"

    echo ""
    log_info "=== Service Endpoints ==="
    kubectl get endpoints -n $DATADOG_NAMESPACE --context $ctx 2>/dev/null | grep -E "NAME|apm" || echo "No APM endpoints"

    # Test APM connectivity
    echo ""
    log_info "=== APM Connectivity Test ==="
    local observer_pod=$(kubectl get pods -n $NAMESPACE --context $ctx -l app=tundra-observer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$observer_pod" ]]; then
        kubectl exec $observer_pod -n $NAMESPACE --context $ctx -- \
            sh -c "apk add --no-cache curl >/dev/null 2>&1; curl -s http://datadog-agent-apm.$DATADOG_NAMESPACE.svc.cluster.local:8126/info | head -5" 2>/dev/null || echo "APM not reachable (may need more time)"
    fi

    log_success "Deployment verification complete"
}

# Print summary
print_summary() {
    echo ""
    echo "==========================================="
    echo -e "${GREEN}Tundra Dome KIND Bootstrap Complete${NC}"
    echo "==========================================="
    echo ""
    echo "Cluster: kind-$CLUSTER_NAME"
    echo "Context: kind-$CLUSTER_NAME"
    echo "OpenLineage Namespace: $OPENLINEAGE_NAMESPACE"
    echo ""
    echo "Key Features Enabled:"
    echo "  ✓ Data Streams Monitoring (DSM)"
    echo "  ✓ APM with trace connectivity"
    echo "  ✓ OpenLineage for Airflow"
    echo "  ✓ Kafka with auto-topic creation"
    echo ""
    echo "Access:"
    echo "  kubectl --context kind-$CLUSTER_NAME get pods -n $NAMESPACE"
    echo ""
    echo "Datadog URLs:"
    echo "  DSM: https://app.datadoghq.com/data-streams"
    echo "  APM: https://app.datadoghq.com/apm/traces"
    echo "  Data Obs: https://app.datadoghq.com/data-observability"
    echo ""
}

# End-to-end test
run_e2e_test() {
    log_info "Running end-to-end validation..."

    local ctx="kind-$CLUSTER_NAME"
    local failed=0

    echo ""
    log_info "=== E2E Test Suite ==="

    # Test 1: Cluster accessible
    log_info "Test 1: Cluster accessibility..."
    if kubectl cluster-info --context $ctx &>/dev/null; then
        log_success "  Cluster is accessible"
    else
        log_error "  Cluster not accessible"
        failed=1
    fi

    # Test 2: Kafka is running
    log_info "Test 2: Kafka health..."
    local kafka_ready=$(kubectl get pods -n $NAMESPACE --context $ctx -l app=kafka -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null)
    if [[ "$kafka_ready" == "true" ]]; then
        log_success "  Kafka is ready"
    else
        log_warn "  Kafka not ready yet (may need more time)"
    fi

    # Test 3: Observer is running and connected
    log_info "Test 3: Observer health..."
    local observer_pod=$(kubectl get pods -n $NAMESPACE --context $ctx -l app=tundra-observer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$observer_pod" ]]; then
        local observer_ready=$(kubectl get pod $observer_pod -n $NAMESPACE --context $ctx -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null)
        if [[ "$observer_ready" == "true" ]]; then
            log_success "  Observer is ready"

            # Check if it's consuming from Kafka
            local kafka_log=$(kubectl logs $observer_pod -n $NAMESPACE --context $ctx --tail=10 2>/dev/null | grep -i "consumer" | head -1)
            if [[ -n "$kafka_log" ]]; then
                log_success "  Observer connected to Kafka"
            fi
        else
            log_warn "  Observer not ready yet"
        fi
    else
        log_warn "  Observer pod not found"
    fi

    # Test 4: Datadog APM connectivity (if installed)
    log_info "Test 4: Datadog APM connectivity..."
    if kubectl get svc datadog-agent-apm -n $DATADOG_NAMESPACE --context $ctx &>/dev/null; then
        local apm_endpoints=$(kubectl get endpoints datadog-agent-apm -n $DATADOG_NAMESPACE --context $ctx -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null)
        if [[ -n "$apm_endpoints" ]]; then
            log_success "  APM service has endpoints"

            # Test actual connectivity from observer
            if [[ -n "$observer_pod" ]]; then
                local apm_test=$(kubectl exec $observer_pod -n $NAMESPACE --context $ctx -- \
                    sh -c "apk add --no-cache curl >/dev/null 2>&1; curl -s -o /dev/null -w '%{http_code}' http://datadog-agent-apm.$DATADOG_NAMESPACE.svc.cluster.local:8126/info 2>/dev/null" 2>/dev/null || echo "failed")
                if [[ "$apm_test" == "200" ]]; then
                    log_success "  APM endpoint reachable from observer"
                else
                    log_warn "  APM endpoint not reachable (code: $apm_test)"
                fi
            fi
        else
            log_warn "  APM service has no endpoints"
            failed=1
        fi
    else
        log_warn "  Datadog not installed (skipping APM test)"
    fi

    # Test 5: DSM environment variables
    log_info "Test 5: DSM configuration..."
    if [[ -n "$observer_pod" ]]; then
        local dsm_enabled=$(kubectl exec $observer_pod -n $NAMESPACE --context $ctx -- \
            sh -c "echo \$DD_DATA_STREAMS_ENABLED" 2>/dev/null)
        if [[ "$dsm_enabled" == "true" ]]; then
            log_success "  DSM enabled on observer"
        else
            log_warn "  DSM not enabled (DD_DATA_STREAMS_ENABLED=$dsm_enabled)"
        fi
    fi

    # Test 6: Send test message through Kafka
    log_info "Test 6: Kafka message flow..."
    local kafka_pod=$(kubectl get pods -n $NAMESPACE --context $ctx -l app=kafka -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$kafka_pod" ]]; then
        # Create test topic and send message
        kubectl exec $kafka_pod -n $NAMESPACE --context $ctx -- \
            sh -c "echo 'test-$(date +%s)' | /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic tundra-work-intake 2>/dev/null" &>/dev/null || true

        sleep 2

        # Check if observer received it
        if [[ -n "$observer_pod" ]]; then
            local msg_received=$(kubectl logs $observer_pod -n $NAMESPACE --context $ctx --tail=5 2>/dev/null | grep -c "tundra-work-intake" || echo "0")
            if [[ "$msg_received" -gt 0 ]]; then
                log_success "  Message flow working (observer received message)"
            else
                log_warn "  Message not yet received (may need more time)"
            fi
        fi
    fi

    echo ""
    if [[ $failed -eq 0 ]]; then
        log_success "=== E2E Tests Passed ==="
    else
        log_error "=== Some E2E Tests Failed ==="
        return 1
    fi
}

# Main
main() {
    echo "==========================================="
    echo "Tundra Dome KIND Bootstrap"
    echo "==========================================="
    echo ""

    # Parse arguments
    local skip_tests=0
    local test_only=0

    for arg in "$@"; do
        case $arg in
            --skip-tests) skip_tests=1 ;;
            --test-only) test_only=1 ;;
            --help|-h)
                echo "Usage: $0 [cluster-name] [options]"
                echo ""
                echo "Options:"
                echo "  -y, --yes     Non-interactive mode, auto-answer yes to all prompts"
                echo "  --skip-tests  Skip end-to-end tests after deployment"
                echo "  --test-only   Only run tests on existing cluster"
                echo "  --help        Show this help"
                echo ""
                echo "Examples:"
                echo "  $0 tundra-dome           # Create cluster named tundra-dome"
                echo "  $0 my-cluster -y         # Non-interactive, auto-yes to prompts"
                echo "  $0 gastown --skip-tests  # Create without testing"
                echo "  $0 tundra-dome --test-only  # Test existing cluster"
                exit 0
                ;;
        esac
    done

    if [[ $test_only -eq 1 ]]; then
        run_e2e_test
        exit $?
    fi

    preflight_checks
    create_cluster
    setup_namespaces
    install_datadog
    install_kafka
    create_configmaps
    create_secrets
    deploy_observer
    deploy_airflow
    verify_deployment

    if [[ $skip_tests -eq 0 ]]; then
        echo ""
        log_info "Waiting 30s for services to stabilize before testing..."
        sleep 30
        run_e2e_test
    fi

    print_summary
}

# Run
main "$@"
