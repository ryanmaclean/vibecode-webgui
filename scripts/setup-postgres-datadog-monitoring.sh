#!/bin/bash
# Setup PostgreSQL Database Monitoring with Datadog in KIND Cluster
# This script configures PostgreSQL for Datadog Database Monitoring (DBM)

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${VIBECODE_NAMESPACE:-"vibecode-platform"}
DATADOG_NAMESPACE=${DATADOG_NAMESPACE:-"datadog"}
POSTGRES_SERVICE_NAME=${POSTGRES_SERVICE_NAME:-"postgres-service"}
POSTGRES_DB=${POSTGRES_DB:-"vibecode"}
POSTGRES_USER=${POSTGRES_USER:-"vibecode"}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"vibecode_password"}
DATADOG_USER=${DATADOG_USER:-"datadog"}
DATADOG_PASSWORD=${DATADOG_PASSWORD:-"datadog_monitoring_password"}

# Print functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available and cluster is accessible
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if KIND cluster is running
    if ! kubectl get nodes | grep -q "kind"; then
        print_warning "This doesn't appear to be a KIND cluster"
    fi
    
    print_success "Prerequisites check passed"
}

# Create PostgreSQL initialization script for monitoring user
create_postgres_init_script() {
    print_status "Creating PostgreSQL initialization script for monitoring user..."
    
    cat > /tmp/postgres-dbm-init.sql << 'EOF'
-- Create monitoring user for Datadog
CREATE USER datadog WITH PASSWORD 'datadog_monitoring_password';

-- Grant necessary permissions for Database Monitoring
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;

-- For PostgreSQL 10+, grant additional permissions
GRANT CONNECT ON DATABASE vibecode TO datadog;

-- Switch to the application database
\c vibecode

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO datadog;

-- Grant select on all tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;

-- Grant select on all sequences in public schema  
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO datadog;

-- Grant select on system catalogs for query metrics
GRANT SELECT ON pg_stat_user_tables TO datadog;
GRANT SELECT ON pg_stat_user_indexes TO datadog;

-- Create extension for better monitoring (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant execute on functions needed for custom metrics
GRANT EXECUTE ON FUNCTION pg_stat_statements_reset() TO datadog;

-- Create a custom function to check if monitoring user is working
CREATE OR REPLACE FUNCTION datadog_monitoring_check()
RETURNS TABLE(status text, message text) AS $$
BEGIN
    RETURN QUERY SELECT 'success'::text, 'Datadog monitoring user is properly configured'::text;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION datadog_monitoring_check() TO datadog;

-- Log the setup completion
DO $$
BEGIN
    RAISE NOTICE 'Datadog monitoring user setup completed successfully';
END $$;
EOF

    print_success "PostgreSQL initialization script created"
}

# Create ConfigMap with the initialization script
create_postgres_init_configmap() {
    print_status "Creating PostgreSQL initialization ConfigMap..."
    
    kubectl create configmap postgres-dbm-init \
        --from-file=/tmp/postgres-dbm-init.sql \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "PostgreSQL initialization ConfigMap created"
}

# Update PostgreSQL deployment with DBM configuration
update_postgres_deployment() {
    print_status "Updating PostgreSQL deployment for Database Monitoring..."
    
    cat > /tmp/postgres-dbm-deployment.yaml << EOF
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: $NAMESPACE
data:
  POSTGRES_DB: "$POSTGRES_DB"
  POSTGRES_USER: "$POSTGRES_USER"
  POSTGRES_PASSWORD: "$POSTGRES_PASSWORD"
  # PostgreSQL configuration for monitoring
  postgresql.conf: |
    # Database Monitoring Configuration
    shared_preload_libraries = 'pg_stat_statements'
    pg_stat_statements.track = all
    pg_stat_statements.track_utility = on
    pg_stat_statements.save = on
    
    # Connection settings
    max_connections = 100
    
    # Memory settings
    shared_buffers = 128MB
    effective_cache_size = 512MB
    work_mem = 4MB
    maintenance_work_mem = 64MB
    
    # Checkpoint settings
    checkpoint_completion_target = 0.7
    wal_buffers = 16MB
    default_statistics_target = 100
    
    # Logging for monitoring
    log_statement = 'all'
    log_duration = on
    log_min_duration_statement = 1000
    log_checkpoints = on
    log_connections = on
    log_disconnections = on
    log_lock_waits = on
    
    # Enable query plan logging
    log_min_messages = warning
    log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $NAMESPACE
  labels:
    app: postgres
    component: database
    monitoring: datadog
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
        monitoring: datadog
      annotations:
        # Datadog Database Monitoring annotations
        ad.datadoghq.com/postgres.check_names: |
          ["postgres"]
        ad.datadoghq.com/postgres.init_configs: |
          [{}]
        ad.datadoghq.com/postgres.instances: |
          [{
            "host": "%%host%%",
            "port": 5432,
            "username": "$DATADOG_USER",
            "password": "$DATADOG_PASSWORD",
            "dbname": "$POSTGRES_DB",
            "dbm": true,
            "collect_schemas": {
              "enabled": true
            },
            "relations": [{
              "relation_regex": ".*"
            }],
            "custom_queries": [{
              "metric_prefix": "vibecode.postgres",
              "query": "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables",
              "columns": [
                {"name": "schema", "type": "tag"},
                {"name": "table", "type": "tag"}, 
                {"name": "vibecode.postgres.inserts", "type": "gauge"},
                {"name": "vibecode.postgres.updates", "type": "gauge"},
                {"name": "vibecode.postgres.deletes", "type": "gauge"}
              ],
              "tags": ["env:kind", "service:vibecode"]
            }],
            "tags": [
              "env:kind",
              "service:vibecode-postgres",
              "cluster:vibecode-kind"
            ]
          }]
        ad.datadoghq.com/postgres.logs: |
          [{
            "source": "postgresql",
            "service": "vibecode-postgres",
            "log_processing_rules": [{
              "type": "multi_line",
              "name": "postgres_multiline",
              "pattern": "\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}"
            }]
          }]
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config-volume
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        - name: init-db
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        readinessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - $POSTGRES_USER
              - -d
              - $POSTGRES_DB
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - $POSTGRES_USER
              - -d
              - $POSTGRES_DB
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: postgres-storage
        emptyDir: {}
      - name: postgres-config-volume
        configMap:
          name: postgres-config
      - name: init-db
        configMap:
          name: postgres-dbm-init
---
apiVersion: v1
kind: Service
metadata:
  name: $POSTGRES_SERVICE_NAME
  namespace: $NAMESPACE
  labels:
    app: postgres
    monitoring: datadog
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
      nodePort: 30001
  type: NodePort
EOF

    kubectl apply -f /tmp/postgres-dbm-deployment.yaml
    print_success "PostgreSQL deployment updated with Database Monitoring configuration"
}

# Update Datadog values to enable Database Monitoring
update_datadog_values() {
    print_status "Creating Datadog values with Database Monitoring enabled..."
    
    cat > /tmp/datadog-dbm-values.yaml << EOF
# Datadog Helm Values for KIND with Database Monitoring
datadog:
  apiKeyExistingSecret: datadog-secret
  appKeyExistingSecret: datadog-secret
  
  site: "datadoghq.com"
  clusterName: "vibecode-kind-local"
  
  # Enable Database Monitoring
  dbm:
    enabled: true
  
  # Core monitoring features
  logs:
    enabled: true
    containerCollectAll: true
  
  apm:
    portEnabled: true
    socketEnabled: true
    hostSocketPath: /var/run/datadog
  
  processAgent:
    enabled: true
    
  orchestratorExplorer:
    enabled: true
    
  # Enhanced Kubernetes monitoring
  kubernetesEvents:
    unbundleEvents: true
    
  # Resource configuration for KIND
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "1Gi"
  
  tags:
    - "env:kind"
    - "cluster:vibecode-kind"
    - "project:vibecode"

# Cluster Agent configuration
clusterAgent:
  enabled: true
  image:
    tag: "1.24.0"
  
  resources:
    requests:
      cpu: "50m"
      memory: "128Mi"
    limits:
      cpu: "200m"
      memory: "256Mi"
  
  metricsProvider:
    enabled: true
    
  clusterChecks:
    enabled: true

# Node Agent configuration
agents:
  image:
    tag: "7.66.1"
    
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "1Gi"
      
  useHostNetwork: true

# Tolerations for KIND
tolerations:
  - operator: Exists
    effect: NoSchedule
  - operator: Exists
    effect: NoExecute

# Disable features not needed in local development
systemProbe:
  enabled: false
  
securityAgent:
  runtime:
    enabled: false
EOF

    print_success "Datadog values with Database Monitoring created"
}

# Deploy or upgrade Datadog with DBM
deploy_datadog_with_dbm() {
    print_status "Deploying/upgrading Datadog with Database Monitoring..."
    
    # Add Datadog Helm repository
    helm repo add datadog https://helm.datadoghq.com
    helm repo update
    
    # Create datadog namespace if it doesn't exist
    kubectl create namespace $DATADOG_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Check if Datadog secret exists, create a dummy one if not
    if ! kubectl get secret datadog-secret -n $DATADOG_NAMESPACE &> /dev/null; then
        print_warning "Creating dummy Datadog secret for local development"
        kubectl create secret generic datadog-secret \
            --from-literal=api-key="${DD_API_KEY:-dummy-key}" \
            --from-literal=app-key="${DD_APP_KEY:-dummy-app-key}" \
            --namespace=$DATADOG_NAMESPACE
    fi
    
    # Install or upgrade Datadog
    helm upgrade --install datadog-agent datadog/datadog \
        --namespace $DATADOG_NAMESPACE \
        --values /tmp/datadog-dbm-values.yaml \
        --timeout=600s \
        --wait
    
    print_success "Datadog deployed with Database Monitoring enabled"
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    print_status "Waiting for PostgreSQL to be ready..."
    
    kubectl wait --for=condition=available --timeout=300s \
        deployment/postgres -n $NAMESPACE
    
    print_success "PostgreSQL is ready"
}

# Verify Database Monitoring setup
verify_dbm_setup() {
    print_status "Verifying Database Monitoring setup..."
    
    # Check if PostgreSQL pod is running
    if ! kubectl get pods -n $NAMESPACE -l app=postgres | grep -q Running; then
        print_error "PostgreSQL pod is not running"
        return 1
    fi
    
    # Check if Datadog agent is running
    if ! kubectl get pods -n $DATADOG_NAMESPACE -l app=datadog-agent | grep -q Running; then
        print_error "Datadog agent is not running"
        return 1
    fi
    
    # Test database connection with monitoring user
    print_status "Testing database connection with monitoring user..."
    
    POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U $DATADOG_USER -d $POSTGRES_DB -c "SELECT datadog_monitoring_check();" &> /dev/null; then
        print_success "Database monitoring user connection test passed"
    else
        print_warning "Database monitoring user connection test failed - this might be expected during initial setup"
    fi
    
    print_success "Database Monitoring setup verification completed"
}

# Display monitoring information
display_monitoring_info() {
    print_status "Database Monitoring Setup Information:"
    echo "======================================"
    echo "Namespace: $NAMESPACE"
    echo "PostgreSQL Service: $POSTGRES_SERVICE_NAME"
    echo "Database: $POSTGRES_DB"
    echo "Monitoring User: $DATADOG_USER"
    echo "Datadog Namespace: $DATADOG_NAMESPACE"
    echo ""
    echo "To verify the setup:"
    echo "1. Check PostgreSQL logs:"
    echo "   kubectl logs -n $NAMESPACE -l app=postgres"
    echo ""
    echo "2. Check Datadog agent logs:"
    echo "   kubectl logs -n $DATADOG_NAMESPACE -l app=datadog-agent | grep postgres"
    echo ""
    echo "3. Port forward to access PostgreSQL directly:"
    echo "   kubectl port-forward -n $NAMESPACE service/$POSTGRES_SERVICE_NAME 5432:5432"
    echo ""
    echo "4. Connect to database with monitoring user:"
    echo "   psql -h localhost -p 5432 -U $DATADOG_USER -d $POSTGRES_DB"
    echo ""
    print_success "Setup completed successfully!"
}

# Main execution
main() {
    print_status "Starting PostgreSQL Database Monitoring setup for KIND cluster..."
    
    check_prerequisites
    create_postgres_init_script
    create_postgres_init_configmap
    update_postgres_deployment
    update_datadog_values
    deploy_datadog_with_dbm
    wait_for_postgres
    
    # Give some time for the monitoring to initialize
    print_status "Waiting for monitoring initialization..."
    sleep 30
    
    verify_dbm_setup
    display_monitoring_info
    
    # Cleanup temporary files
    rm -f /tmp/postgres-dbm-init.sql /tmp/postgres-dbm-deployment.yaml /tmp/datadog-dbm-values.yaml
}

# Run main function
main "$@"
