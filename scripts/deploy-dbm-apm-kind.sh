#!/bin/bash

# Deploy DBM-APM Configuration to KIND Local Development
# This script deploys the updated DBM-APM configuration to the local KIND cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-vibecode-local}"
NAMESPACE="vibecode-platform"
ENV_FILE=".env.local"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists docker; then
        missing_tools+=("docker")
    fi
    
    if ! command_exists kind; then
        missing_tools+=("kind")
    fi
    
    if ! command_exists kubectl; then
        missing_tools+=("kubectl")
    fi
    
    if ! command_exists helm; then
        missing_tools+=("helm")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_status "ERROR" "Missing required tools: ${missing_tools[*]}"
        print_status "INFO" "Please install the missing tools and try again."
        exit 1
    fi
    
    print_status "SUCCESS" "All prerequisites are available"
}

# Function to load environment variables
load_environment() {
    print_status "INFO" "Loading environment variables..."
    
    if [ -f "$ENV_FILE" ]; then
        print_status "SUCCESS" "Found $ENV_FILE"
        # Source environment variables
        set -a
        source "$ENV_FILE"
        set +a
        
        # Validate required variables
        local required_vars=(
            "DD_API_KEY"
            "DD_SERVICE"
            "DD_ENV"
            "DD_VERSION"
            "DD_DBM_PROPAGATION_MODE"
        )
        
        local missing_vars=()
        for var in "${required_vars[@]}"; do
            if [ -z "${!var}" ]; then
                missing_vars+=("$var")
            fi
        done
        
        if [ ${#missing_vars[@]} -gt 0 ]; then
            print_status "WARNING" "Missing environment variables: ${missing_vars[*]}"
            print_status "INFO" "Setting default values for missing variables..."
            
            # Set defaults
            export DD_SERVICE=${DD_SERVICE:-"vibecode-webgui"}
            export DD_ENV=${DD_ENV:-"developement"}
            export DD_VERSION=${DD_VERSION:-"0.1.0-dev"}
            export DD_DBM_PROPAGATION_MODE=${DD_DBM_PROPAGATION_MODE:-"full"}
        fi
        
        print_status "SUCCESS" "Environment variables loaded"
    else
        print_status "WARNING" "$ENV_FILE not found, using defaults"
        export DD_SERVICE="vibecode-webgui"
        export DD_ENV="developement"
        export DD_VERSION="0.1.0-dev"
        export DD_DBM_PROPAGATION_MODE="full"
    fi
}

# Function to check KIND cluster status
check_kind_cluster() {
    print_status "INFO" "Checking KIND cluster status..."
    
    if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        print_status "ERROR" "KIND cluster '$CLUSTER_NAME' not found"
        print_status "INFO" "Please create the cluster first using: ./scripts/setup-kind-cluster.sh"
        exit 1
    fi
    
    # Set kubectl context
    kubectl config use-context "kind-${CLUSTER_NAME}"
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_status "ERROR" "Cannot connect to KIND cluster"
        exit 1
    fi
    
    print_status "SUCCESS" "KIND cluster is running and accessible"
}

# Function to create namespace if it doesn't exist
create_namespace() {
    print_status "INFO" "Creating namespace if it doesn't exist..."
    
    if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        kubectl create namespace "$NAMESPACE"
        print_status "SUCCESS" "Created namespace: $NAMESPACE"
    else
        print_status "SUCCESS" "Namespace already exists: $NAMESPACE"
    fi
}

# Function to create Datadog secret
create_datadog_secret() {
    print_status "INFO" "Creating Datadog secret..."
    
    if [ -z "$DD_API_KEY" ]; then
        print_status "WARNING" "DD_API_KEY not set, skipping Datadog secret creation"
        return 0
    fi
    
    # Create or update Datadog secret
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="$DD_API_KEY" \
        --from-literal=site="${DD_SITE:-datadoghq.com}" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_status "SUCCESS" "Datadog secret created/updated"
}

# Function to deploy Datadog agent with DBM-APM configuration
deploy_datadog_agent() {
    print_status "INFO" "Deploying Datadog agent with DBM-APM configuration..."
    
    # Create Datadog agent configuration
    cat > /tmp/datadog-agent-kind.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agent-config
  namespace: $NAMESPACE
data:
  datadog.yaml: |
    api_key: <DD_API_KEY>
    site: ${DD_SITE:-datadoghq.com}
    
    # Core settings
    hostname: \${HOSTNAME}
    tags:
      - "env:${DD_ENV}"
      - "service:${DD_SERVICE}"
      - "version:${DD_VERSION}"
      - "cluster:kind"
      - "namespace:${NAMESPACE}"
    
    # APM Configuration
    apm_config:
      enabled: true
      apm_non_local_traffic: true
      max_traces_per_second: 50
    
    # Database Monitoring
    database_monitoring:
      enabled: true
    
    # Log collection
    logs_enabled: true
    logs_config:
      container_collect_all: true
      use_http: true
    
    # Process monitoring
    process_config:
      enabled: true
    
    # Network monitoring
    network_config:
      enabled: true

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: $NAMESPACE
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
    spec:
      serviceAccountName: datadog-agent
      containers:
      - image: datadog/agent:7.66.1
        name: datadog-agent
        env:
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: api-key
        - name: DD_SITE
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: site
        - name: DD_SERVICE
          value: "${DD_SERVICE}"
        - name: DD_ENV
          value: "${DD_ENV}"
        - name: DD_VERSION
          value: "${DD_VERSION}"
        - name: DD_DBM_PROPAGATION_MODE
          value: "${DD_DBM_PROPAGATION_MODE}"
        - name: DD_DBM_TRACE_INJECTION
          value: "true"
        - name: DD_TRACE_SAMPLE_RATE
          value: "1.0"
        - name: DD_TRACE_ENABLED
          value: "true"
        - name: DD_LOGS_ENABLED
          value: "true"
        - name: DD_PROCESS_AGENT_ENABLED
          value: "true"
        - name: DD_SYSTEM_PROBE_ENABLED
          value: "true"
        - name: DD_APM_ENABLED
          value: "true"
        - name: DD_DBM_ENABLED
          value: "true"
        - name: DD_HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: DD_KUBERNETES_KUBELET_HOST
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP
        volumeMounts:
        - name: datadog-config
          mountPath: /etc/datadog-agent/datadog.yaml
          subPath: datadog.yaml
        - name: procdir
          mountPath: /host/proc
          readOnly: true
        - name: cgroups
          mountPath: /host/sys/fs/cgroup
          readOnly: true
        - name: docker-sock
          mountPath: /var/run/docker.sock
          readOnly: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: datadog-config
        configMap:
          name: datadog-agent-config
      - name: procdir
        hostPath:
          path: /proc
      - name: cgroups
        hostPath:
          path: /sys/fs/cgroup
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
      tolerations:
      - effect: NoSchedule
        operator: Exists
      - effect: NoExecute
        operator: Exists

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: datadog-agent
  namespace: $NAMESPACE

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: datadog-agent
rules:
- apiGroups: [""]
  resources: ["services", "events", "endpoints", "pods", "nodes", "componentstatuses"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["quota.openshift.io"]
  resources: ["clusterresourcequotas"]
  verbs: ["get", "list"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["list", "watch"]
- apiGroups: [""]
  resources: ["nodes/metrics"]
  verbs: ["get"]
- nonResourceURLs: ["/metrics", "/healthz"]
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
  namespace: $NAMESPACE
EOF

    # Apply the Datadog agent configuration
    kubectl apply -f /tmp/datadog-agent-kind.yaml
    
    print_status "SUCCESS" "Datadog agent deployed with DBM-APM configuration"
}

# Function to deploy application with DBM-APM configuration
deploy_application() {
    print_status "INFO" "Deploying application with DBM-APM configuration..."
    
    # Create application deployment with DBM-APM environment variables
    cat > /tmp/vibecode-app-kind.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibecode-webgui
  template:
    metadata:
      labels:
        app: vibecode-webgui
    spec:
      containers:
      - name: vibecode-webgui
        image: vibecode-webgui:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "development"
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: api-key
        - name: DD_SITE
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: site
        - name: DD_SERVICE
          value: "${DD_SERVICE}"
        - name: DD_ENV
          value: "${DD_ENV}"
        - name: DD_VERSION
          value: "${DD_VERSION}"
        - name: DD_DBM_PROPAGATION_MODE
          value: "${DD_DBM_PROPAGATION_MODE}"
        - name: DD_DBM_TRACE_INJECTION
          value: "true"
        - name: DD_TRACE_SAMPLE_RATE
          value: "1.0"
        - name: DD_TRACE_ENABLED
          value: "true"
        - name: DD_TRACE_DEBUG
          value: "true"
        - name: DD_TRACE_STARTUP_LOGS
          value: "true"
        - name: DD_PROFILING_ENABLED
          value: "true"
        - name: DD_RUNTIME_METRICS_ENABLED
          value: "true"
        - name: DD_LLMOBS_ENABLED
          value: "true"
        - name: DD_LLMOBS_AGENTLESS_ENABLED
          value: "true"
        - name: DD_LLMOBS_ML_APP
          value: "vibecode-ai-dev"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-webgui-service
  namespace: $NAMESPACE
spec:
  selector:
    app: vibecode-webgui
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: NodePort

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-webgui-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: vibecode.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode-webgui-service
            port:
              number: 80
EOF

    # Apply the application deployment
    kubectl apply -f /tmp/vibecode-app-kind.yaml
    
    print_status "SUCCESS" "Application deployed with DBM-APM configuration"
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    print_status "INFO" "Waiting for deployment to be ready..."
    
    kubectl wait --for=condition=available --timeout=300s deployment/vibecode-webgui -n "$NAMESPACE"
    
    print_status "SUCCESS" "Deployment is ready"
}

# Function to validate deployment
validate_deployment() {
    print_status "INFO" "Validating deployment..."
    
    # Check if pods are running
    local pod_status=$(kubectl get pods -n "$NAMESPACE" -l app=vibecode-webgui --no-headers | awk '{print $3}')
    if [ "$pod_status" = "Running" ]; then
        print_status "SUCCESS" "Application pod is running"
    else
        print_status "ERROR" "Application pod is not running: $pod_status"
        return 1
    fi
    
    # Check if Datadog agent is running
    local datadog_status=$(kubectl get pods -n "$NAMESPACE" -l app=datadog-agent --no-headers | awk '{print $3}')
    if [ "$datadog_status" = "Running" ]; then
        print_status "SUCCESS" "Datadog agent pod is running"
    else
        print_status "WARNING" "Datadog agent pod is not running: $datadog_status"
    fi
    
    # Check environment variables
    print_status "INFO" "Checking environment variables..."
    kubectl exec -n "$NAMESPACE" deployment/vibecode-webgui -- env | grep -E "DD_|NODE_ENV" || true
    
    print_status "SUCCESS" "Deployment validation completed"
}

# Function to show access information
show_access_info() {
    print_status "INFO" "Deployment completed! Access information:"
    echo
    echo "🌐 Application URLs:"
    echo "   Local: http://localhost:3000 (via port-forward)"
    echo "   Ingress: http://vibecode.local (add to /etc/hosts)"
    echo
    echo "🔧 Port Forward Commands:"
    echo "   kubectl port-forward -n $NAMESPACE svc/vibecode-webgui-service 3000:80"
    echo
    echo "📊 Monitoring:"
    echo "   Datadog: https://app.datadoghq.com/"
    echo "   Service: $DD_SERVICE"
    echo "   Environment: $DD_ENV"
    echo "   Version: $DD_VERSION"
    echo
    echo "🔍 Debug Commands:"
    echo "   kubectl logs -n $NAMESPACE deployment/vibecode-webgui -f"
    echo "   kubectl logs -n $NAMESPACE daemonset/datadog-agent -f"
    echo "   kubectl get pods -n $NAMESPACE"
    echo
    echo "✅ DBM-APM Connection Status:"
    echo "   DD_DBM_PROPAGATION_MODE: $DD_DBM_PROPAGATION_MODE"
    echo "   DD_DBM_TRACE_INJECTION: true"
    echo "   DD_TRACE_SAMPLE_RATE: 1.0"
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 Deploying DBM-APM Configuration to KIND Local Development${NC}"
    echo "=================================================================="
    echo
    
    check_prerequisites
    load_environment
    check_kind_cluster
    create_namespace
    create_datadog_secret
    deploy_datadog_agent
    deploy_application
    wait_for_deployment
    validate_deployment
    show_access_info
    
    print_status "SUCCESS" "DBM-APM configuration deployed successfully to KIND!"
}

# Run main function
main "$@"

