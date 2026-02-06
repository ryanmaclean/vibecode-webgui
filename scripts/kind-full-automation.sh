#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Complete KIND Cluster Automation with Datadog Monitoring
# Creates, configures, and monitors a full VibeCode development environment

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 VibeCode KIND Full Cluster Automation"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
CLUSTER_NAME="vibecode-cluster"
DATADOG_NAMESPACE="datadog-system"
MONITORING_NAMESPACE="vibecode-monitoring"
VIBECODE_NAMESPACE="vibecode"

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

# Cleanup function
cleanup_cluster() {
    print_warning "Cleaning up existing cluster..."
    kind delete cluster --name $CLUSTER_NAME 2>/dev/null || true
    docker system prune -f 2>/dev/null || true
}

# Pre-flight checks
preflight_checks() {
    print_step "Running pre-flight checks..."
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi
    
    # Check KIND
    if ! command -v kind &> /dev/null; then
        print_error "KIND is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed" 
        exit 1
    fi
    
    # Check Helm
    if ! command -v helm &> /dev/null; then
        print_error "Helm is not installed"
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Create cluster
create_cluster() {
    print_step "Creating KIND cluster with multi-node configuration..."
    
    if kind get clusters | grep -q $CLUSTER_NAME; then
        print_warning "Cluster $CLUSTER_NAME already exists. Recreating..."
        cleanup_cluster
    fi
    
    # Create cluster with config
    kind create cluster --config k8s/vibecode-kind-config.yaml --name $CLUSTER_NAME
    
    # Verify cluster
    kubectl cluster-info --context kind-$CLUSTER_NAME
    kubectl get nodes
    
    print_success "KIND cluster created successfully"
}

# Setup namespaces
setup_namespaces() {
    print_step "Setting up namespaces..."
    
    kubectl create namespace $VIBECODE_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $DATADOG_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespaces for monitoring
    kubectl label namespace $VIBECODE_NAMESPACE monitoring=enabled --overwrite
    kubectl label namespace $DATADOG_NAMESPACE monitoring=system --overwrite
    kubectl label namespace $MONITORING_NAMESPACE monitoring=infrastructure --overwrite
    
    print_success "Namespaces configured"
}

# Install Nginx Ingress Controller
install_ingress() {
    print_step "Installing Nginx Ingress Controller..."
    
    # Install ingress-nginx
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
    
    # Wait for ingress controller to be ready
    print_status "Waiting for ingress controller..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s
    
    print_success "Ingress controller ready"
}

# Setup Datadog monitoring
setup_datadog_monitoring() {
    print_step "Setting up comprehensive Datadog monitoring..."
    
    # Check if API key is set
    if [ -z "$DD_API_KEY" ]; then
        print_warning "DD_API_KEY not set. Using placeholder for demo."
        DD_API_KEY="placeholder-key-set-real-key-for-production"
    fi
    
    # Add Datadog Helm repository
    helm repo add datadog https://helm.datadoghq.com
    helm repo update
    
    # Create Datadog secrets
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="$DD_API_KEY" \
        --namespace=$DATADOG_NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create comprehensive Datadog values file
    cat > /tmp/datadog-values.yaml << EOF
# Datadog Agent Configuration for VibeCode KIND Cluster
datadog:
  apiKey: "$DD_API_KEY"
  appKey: ""
  site: "datadoghq.com"
  clusterName: "vibecode-kind-cluster"
  
  # Logging configuration
  logs:
    enabled: true
    containerCollectAll: true
    containerCollectUsingFiles: true
    
  # APM and tracing
  apm:
    enabled: true
    portEnabled: true

  # Data Streams Monitoring (DSM) - enables Kafka pipeline visibility
  dataStreamsMonitoring:
    enabled: true

  # Process monitoring
  processAgent:
    enabled: true
    processCollection: true

  # Network monitoring
  networkMonitoring:
    enabled: true
    
  # Security monitoring
  securityAgent:
    runtime:
      enabled: true
    compliance:
      enabled: true
      
  # Kubernetes state metrics
  kubeStateMetricsEnabled: true
  
  # Custom tags for VibeCode
  tags:
    - "project:vibecode"
    - "env:development" 
    - "platform:kind"
    - "monitoring:comprehensive"

# Cluster Agent configuration
clusterAgent:
  enabled: true
  replicas: 2
  
  # Admission Controller
  admissionController:
    enabled: true
    mutateUnlabelled: false
    
  # External metrics provider
  metricsProvider:
    enabled: true
    
# Node Agent configuration  
agents:
  # Use minimal resources for KIND
  resources:
    requests:
      cpu: "50m"
      memory: "128Mi"
    limits:
      cpu: "200m" 
      memory: "512Mi"
      
  # Enable all monitoring features
  containers:
    agent:
      env:
        - name: DD_KUBERNETES_COLLECT_METADATA_TAGS
          value: "true"
        - name: DD_KUBERNETES_POD_LABELS_AS_TAGS
          value: "true"
        - name: DD_KUBERNETES_POD_ANNOTATIONS_AS_TAGS
          value: "true"
        - name: DD_COLLECT_KUBERNETES_EVENTS
          value: "true"
        - name: DD_LEADER_ELECTION
          value: "true"
        - name: DD_APM_ENABLED
          value: "true"
        - name: DD_LOGS_ENABLED
          value: "true"
        - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
          value: "true"
        - name: DD_DATA_STREAMS_ENABLED
          value: "true"
        - name: DD_APM_FEATURES
          value: "data_streams_enabled"
        - name: DD_AC_EXCLUDE
          value: "name:datadog-agent"
        - name: DD_CONTAINER_EXCLUDE
          value: "name:datadog-agent"

# Enable service monitoring for specific VibeCode services
podLabelsAsTags:
  app: app
  version: version
  component: component
  tier: tier
  workload: workload

podAnnotationsAsTags:
  monitoring: monitoring
  vibecode.io/service: service
  vibecode.io/environment: environment
  
# Tolerations for all nodes including control-plane
tolerations:
  - operator: Exists

# Node selector for monitoring all nodes
nodeSelector: {}

# Enable monitoring of the control plane
controlPlane:
  enabled: true
EOF

    # Install Datadog with comprehensive monitoring
    print_status "Installing Datadog Agent with comprehensive monitoring..."
    helm upgrade --install datadog-agent datadog/datadog \
        --namespace $DATADOG_NAMESPACE \
        --values /tmp/datadog-values.yaml \
        --wait --timeout=600s
    
    print_success "Datadog monitoring installed"
}

# Setup additional monitoring tools
setup_additional_monitoring() {
    print_step "Setting up additional monitoring infrastructure..."
    
    # Prometheus for internal metrics
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install kube-prometheus-stack (includes Prometheus, Grafana, AlertManager)
    cat > /tmp/prometheus-values.yaml << EOF
# Prometheus stack for VibeCode internal monitoring
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    serviceMonitorSelector: {}
    serviceMonitorNamespaceSelector: {}
    retention: 7d
    
grafana:
  enabled: true
  adminPassword: "vibecode-admin"
  service:
    type: NodePort
    nodePort: 30030
  
  # Pre-configure dashboards
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: 'vibecode'
        orgId: 1
        folder: 'VibeCode'
        folderUid: vibecode
        type: file
        disableDeletion: false
        editable: true
        options:
          path: /var/lib/grafana/dashboards/vibecode
          
alertmanager:
  enabled: true
  
kubeStateMetrics:
  enabled: true
  
nodeExporter:
  enabled: true
  
# Custom service monitors for VibeCode
additionalServiceMonitors:
  - name: vibecode-services
    selector:
      matchLabels:
        monitoring: enabled
    endpoints:
    - port: http
      interval: 30s
      path: /metrics
EOF

    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $MONITORING_NAMESPACE \
        --values /tmp/prometheus-values.yaml \
        --wait --timeout=600s
    
    print_success "Additional monitoring tools installed"
}

# Deploy VibeCode application with monitoring annotations
deploy_vibecode_app() {
    print_step "Deploying VibeCode application with monitoring..."
    
    # Create PostgreSQL with monitoring
    cat > /tmp/postgres-monitored.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: postgres
    component: database
    tier: storage
    monitoring: enabled
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
        component: database
        tier: storage
        monitoring: enabled
      annotations:
        datadog.ad.check_names: '["postgres"]'
        datadog.ad.init_configs: '[{}]'
        datadog.ad.instances: '[{"host":"%%host%%","port":"5432","username":"vibecode","password":"vibecode_password","dbname":"vibecode_db"}]'
        datadog.ad.logs: '[{"source":"postgresql","service":"vibecode-postgres"}]'
        prometheus.io/scrape: "true"
        prometheus.io/port: "9187"
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: vibecode_db
        - name: POSTGRES_USER
          value: vibecode
        - name: POSTGRES_PASSWORD
          value: vibecode_password
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
      # PostgreSQL exporter for Prometheus
      - name: postgres-exporter
        image: prometheuscommunity/postgres-exporter:latest
        ports:
        - containerPort: 9187
        env:
        - name: DATA_SOURCE_NAME
          value: "postgresql://vibecode:vibecode_password@localhost:5432/vibecode_db?sslmode=disable"
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: postgres
    monitoring: enabled
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9187"
spec:
  selector:
    app: postgres
  ports:
  - name: postgres
    port: 5432
    targetPort: 5432
  - name: metrics
    port: 9187
    targetPort: 9187
EOF

    # Create Redis with monitoring
    cat > /tmp/redis-monitored.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: redis
    component: cache
    tier: platform
    monitoring: enabled
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
        component: cache
        tier: platform
        monitoring: enabled
      annotations:
        datadog.ad.check_names: '["redisdb"]'
        datadog.ad.init_configs: '[{}]'
        datadog.ad.instances: '[{"host":"%%host%%","port":"6379"}]'
        datadog.ad.logs: '[{"source":"redis","service":"vibecode-redis"}]'
        prometheus.io/scrape: "true"
        prometheus.io/port: "9121"
    spec:
      containers:
      - name: redis
        image: redis:8.1-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
      # Redis exporter for Prometheus
      - name: redis-exporter
        image: oliver006/redis_exporter:latest
        ports:
        - containerPort: 9121
        env:
        - name: REDIS_ADDR
          value: "redis://localhost:6379"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: redis
    monitoring: enabled
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9121"
spec:
  selector:
    app: redis
  ports:
  - name: redis
    port: 6379
    targetPort: 6379
  - name: metrics
    port: 9121
    targetPort: 9121
EOF

    # Apply the monitored services
    kubectl apply -f /tmp/postgres-monitored.yaml
    kubectl apply -f /tmp/redis-monitored.yaml
    
    # Create VibeCode web application
    cat > /tmp/vibecode-web.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-web
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: vibecode-web
    component: frontend
    tier: application
    monitoring: enabled
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vibecode-web
  template:
    metadata:
      labels:
        app: vibecode-web
        component: frontend
        tier: application
        monitoring: enabled
      annotations:
        datadog.ad.check_names: '["http_check"]'
        datadog.ad.init_configs: '[{}]'
        datadog.ad.instances: '[{"name":"vibecode-health","url":"http://%%host%%:3000/api/health","timeout":5}]'
        datadog.ad.logs: '[{"source":"nodejs","service":"vibecode-web"}]'
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: vibecode-web
        image: node:18-alpine
        command: ["/bin/sh", "-c"]
        args:
        - |
          apk add --no-cache curl && 
          while true; do 
            echo "$(date) - VibeCode web server running on port 3000"
            curl -f http://localhost:3000/api/health || echo "Health check failed"
            sleep 30
          done
        ports:
        - containerPort: 3000
        - containerPort: 9090
        env:
        - name: NODE_ENV
          value: "development"
        - name: DATABASE_URL
          value: "postgresql://vibecode:vibecode_password@postgres:5432/vibecode_db"
        - name: REDIS_URL
          value: "redis://redis:6379"
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-web
  namespace: $VIBECODE_NAMESPACE
  labels:
    app: vibecode-web
    monitoring: enabled
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: vibecode-web
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
EOF

    kubectl apply -f /tmp/vibecode-web.yaml
    
    print_success "VibeCode application deployed with comprehensive monitoring"
}

# Setup ingress with monitoring
setup_ingress_monitoring() {
    print_step "Setting up ingress with monitoring..."
    
    cat > /tmp/vibecode-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-ingress
  namespace: $VIBECODE_NAMESPACE
  labels:
    monitoring: enabled
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    # Datadog monitoring annotations
    datadog.ad.check_names: '["nginx"]'
    datadog.ad.init_configs: '[{}]'
    datadog.ad.instances: '[{"nginx_status_url":"http://%%host%%:8080/nginx_status"}]'
    # Prometheus monitoring
    nginx.ingress.kubernetes.io/server-snippet: |
      location /metrics {
        stub_status on;
        access_log off;
      }
spec:
  ingressClassName: nginx
  rules:
  - host: vibecode.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode-web
            port:
              number: 80
  - host: grafana.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-grafana
            port:
              number: 80
EOF

    kubectl apply -f /tmp/vibecode-ingress.yaml
    print_success "Ingress with monitoring configured"
}

# Wait for all services to be ready
wait_for_services() {
    print_step "Waiting for all services to be ready..."
    
    # Wait for Datadog
    kubectl wait --for=condition=ready pod -l app=datadog-agent -n $DATADOG_NAMESPACE --timeout=300s
    
    # Wait for Prometheus
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n $MONITORING_NAMESPACE --timeout=300s
    
    # Wait for VibeCode services
    kubectl wait --for=condition=ready pod -l app=postgres -n $VIBECODE_NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $VIBECODE_NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=vibecode-web -n $VIBECODE_NAMESPACE --timeout=300s
    
    print_success "All services are ready"
}

# Display cluster information and monitoring endpoints
display_cluster_info() {
    print_step "Cluster Information and Monitoring Endpoints"
    echo "=============================================="
    
    echo ""
    echo "📊 Monitoring Dashboards:"
    echo "  • Grafana: http://localhost:30030 (admin/vibecode-admin)"
    echo "  • Datadog: https://app.datadoghq.com (if API key configured)"
    
    echo ""
    echo "🌐 Application Endpoints:"
    echo "  • VibeCode App: http://vibecode.local:8090 (add to /etc/hosts)"
    echo "  • Grafana: http://grafana.local:8090 (add to /etc/hosts)"
    
    echo ""
    echo "🔧 Kubernetes Resources:"
    kubectl get nodes -o wide
    echo ""
    kubectl get pods --all-namespaces -o wide
    echo ""
    kubectl get services --all-namespaces
    
    echo ""
    echo "📈 Monitoring Status:"
    echo "  Datadog Agents:"
    kubectl get pods -n $DATADOG_NAMESPACE
    echo ""
    echo "  Prometheus Stack:"
    kubectl get pods -n $MONITORING_NAMESPACE
    
    echo ""
    echo "✅ KIND cluster with comprehensive monitoring is fully operational!"
    echo "🔍 Check logs: kubectl logs -f deployment/datadog-agent -n $DATADOG_NAMESPACE"
    echo "📊 View metrics in Grafana or Datadog dashboard"
}

# Cleanup function for errors
cleanup_on_error() {
    print_error "Setup failed. Cleaning up..."
    kind delete cluster --name $CLUSTER_NAME 2>/dev/null || true
    exit 1
}

# Main execution
main() {
    trap cleanup_on_error ERR
    
    preflight_checks
    create_cluster
    setup_namespaces
    install_ingress
    setup_datadog_monitoring
    setup_additional_monitoring
    deploy_vibecode_app
    setup_ingress_monitoring
    wait_for_services
    display_cluster_info
    
    print_success "🎉 VibeCode KIND cluster with comprehensive Datadog monitoring is ready!"
}

# Handle command line arguments
case "${1:-}" in
    "cleanup")
        cleanup_cluster
        exit 0
        ;;
    "info")
        display_cluster_info
        exit 0
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [cleanup|info|help]"
        echo ""
        echo "Commands:"
        echo "  cleanup  - Delete the KIND cluster"
        echo "  info     - Display cluster information"
        echo "  help     - Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  DD_API_KEY - Datadog API key for monitoring (optional)"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac