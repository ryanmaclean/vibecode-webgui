#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Deploy KIND Cluster with PostgreSQL Database Monitoring
# This script creates a complete KIND cluster with Datadog PostgreSQL monitoring

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME=${CLUSTER_NAME:-"vibecode-kind"}
NAMESPACE=${NAMESPACE:-"vibecode-platform"}
DATADOG_NAMESPACE=${DATADOG_NAMESPACE:-"datadog"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v kind &> /dev/null; then
        missing_tools+=("kind")
    fi
    
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v helm &> /dev/null; then
        missing_tools+=("helm")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    print_status "Loading environment variables..."
    
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        set -a
        source "$PROJECT_ROOT/.env.local"
        set +a
        print_success "Loaded environment from .env.local"
    elif [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
        print_success "Loaded environment from .env"
    else
        print_warning "No .env file found, using default values"
    fi
    
    # Set default values if not provided
    export DD_API_KEY=${DD_API_KEY:-"dummy-key-for-local-dev"}
    export DD_APP_KEY=${DD_APP_KEY:-"dummy-app-key-for-local-dev"}
    export DD_SITE=${DD_SITE:-"datadoghq.com"}
}

# Create KIND cluster
create_kind_cluster() {
    print_status "Creating KIND cluster..."
    
    # Check if cluster already exists
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        print_warning "KIND cluster '${CLUSTER_NAME}' already exists"
        print_status "Deleting existing cluster..."
        kind delete cluster --name "$CLUSTER_NAME"
    fi
    
    # Use existing KIND config if available
    local kind_config="$PROJECT_ROOT/k8s/kind-cluster-config.yaml"
    if [ ! -f "$kind_config" ]; then
        kind_config="$PROJECT_ROOT/infrastructure/kind/cluster-config.yaml"
    fi
    
    if [ -f "$kind_config" ]; then
        print_status "Using KIND config: $kind_config"
        kind create cluster --name "$CLUSTER_NAME" --config "$kind_config"
    else
        print_status "Using default KIND configuration"
        kind create cluster --name "$CLUSTER_NAME"
    fi
    
    # Set kubectl context
    kubectl cluster-info --context "kind-${CLUSTER_NAME}"
    
    print_success "KIND cluster created successfully"
}

# Setup namespaces
setup_namespaces() {
    print_status "Setting up namespaces..."
    
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace "$DATADOG_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Namespaces created"
}

# Create Datadog secrets
create_datadog_secrets() {
    print_status "Creating Datadog secrets..."
    
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="$DD_API_KEY" \
        --from-literal=app-key="$DD_APP_KEY" \
        --namespace="$DATADOG_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Datadog secrets created"
}

# Create PostgreSQL monitoring configuration
create_postgres_monitoring_config() {
    print_status "Creating PostgreSQL monitoring configuration..."
    
    cat > /tmp/postgres-dbm-config.yaml << 'EOF'
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-dbm-config
  namespace: vibecode-platform
data:
  postgresql.conf: |
    # Database Monitoring Configuration
    shared_preload_libraries = 'pg_stat_statements'
    pg_stat_statements.track = all
    pg_stat_statements.track_utility = on
    pg_stat_statements.save = on
    pg_stat_statements.max = 10000
    
    # Connection settings
    max_connections = 100
    
    # Memory settings
    shared_buffers = 256MB
    effective_cache_size = 1GB
    work_mem = 8MB
    maintenance_work_mem = 128MB
    
    # Logging for monitoring
    logging_collector = on
    log_destination = 'stderr'
    log_statement = 'all'
    log_duration = on
    log_min_duration_statement = 1000
    log_checkpoints = on
    log_connections = on
    log_disconnections = on
    log_lock_waits = on
    
    # Statistics settings
    track_activities = on
    track_counts = on
    track_io_timing = on
    track_functions = all

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-dbm-init
  namespace: vibecode-platform
data:
  01-create-monitoring-user.sql: |
    -- Create monitoring user for Datadog Database Monitoring
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
            CREATE USER datadog WITH PASSWORD 'datadog_monitoring_password';
            RAISE NOTICE 'Created datadog user';
        ELSE
            RAISE NOTICE 'datadog user already exists';
        END IF;
    END
    $$;
    
    -- Grant necessary permissions for Database Monitoring
    GRANT pg_monitor TO datadog;
    GRANT SELECT ON pg_stat_database TO datadog;
    GRANT SELECT ON pg_stat_activity TO datadog;
    GRANT SELECT ON pg_stat_statements TO datadog;
    GRANT SELECT ON pg_stat_user_tables TO datadog;
    GRANT SELECT ON pg_stat_user_indexes TO datadog;
    GRANT SELECT ON pg_statio_user_tables TO datadog;
    GRANT SELECT ON pg_statio_user_indexes TO datadog;
    GRANT SELECT ON pg_stat_replication TO datadog;
    GRANT SELECT ON pg_stat_bgwriter TO datadog;
    GRANT EXECUTE ON FUNCTION pg_database_size(oid) TO datadog;
    GRANT EXECUTE ON FUNCTION pg_relation_size(regclass) TO datadog;
    GRANT EXECUTE ON FUNCTION pg_stat_statements_reset() TO datadog;
    
  02-setup-application-database.sql: |
    -- Switch to the application database
    \c vibecode
    
    -- Grant database connection and schema access
    GRANT CONNECT ON DATABASE vibecode TO datadog;
    GRANT USAGE ON SCHEMA public TO datadog;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
    GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO datadog;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO datadog;
    
    -- Create extension for monitoring
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    
    -- Create monitoring health check function
    CREATE OR REPLACE FUNCTION datadog_monitoring_health()
    RETURNS TABLE(check_name text, status text, details text) AS $$
    BEGIN
        RETURN QUERY 
        SELECT 'pg_stat_statements'::text,
               CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') 
                   THEN 'OK'::text ELSE 'MISSING'::text END,
               'Extension for query performance monitoring'::text;
        
        RETURN QUERY
        SELECT 'datadog_permissions'::text,
               CASE WHEN has_table_privilege('datadog', 'pg_stat_database', 'SELECT')
                   THEN 'OK'::text ELSE 'INSUFFICIENT'::text END,
               'Datadog user database monitoring permissions'::text;
        
        RETURN QUERY
        SELECT 'database_connection'::text, 'OK'::text,
               'Successfully connected to vibecode database'::text;
    END;
    $$ LANGUAGE plpgsql;
    
    GRANT EXECUTE ON FUNCTION datadog_monitoring_health() TO datadog;
    
    DO $$
    BEGIN
        RAISE NOTICE 'Datadog Database Monitoring setup completed for vibecode database';
    END $$;
EOF

    kubectl apply -f /tmp/postgres-dbm-config.yaml
    print_success "PostgreSQL monitoring configuration created"
}

# Deploy PostgreSQL with monitoring
deploy_postgres_with_monitoring() {
    print_status "Deploying PostgreSQL with Database Monitoring..."
    
    cat > /tmp/postgres-dbm-deployment.yaml << 'EOF'
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: vibecode-platform
  labels:
    app: postgres
    component: database
    tier: storage
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
        tier: storage
        monitoring: datadog
      annotations:
        ad.datadoghq.com/postgres.check_names: |
          ["postgres"]
        ad.datadoghq.com/postgres.init_configs: |
          [{}]
        ad.datadoghq.com/postgres.instances: |
          [{
            "host": "%%host%%",
            "port": 5432,
            "username": "datadog",
            "password": "datadog_monitoring_password",
            "dbname": "vibecode",
            "dbm": true,
            "collect_schemas": {"enabled": true, "collection_interval": 600},
            "collect_activity": {"enabled": true, "collection_interval": 10},
            "collect_settings": {"enabled": true, "collection_interval": 600},
            "relations": [{"relation_regex": ".*", "relkind": ["r", "i", "S"]}],
            "database_autodiscovery": {
              "enabled": true,
              "include": ["vibecode", "postgres"],
              "exclude": ["template.*", "rdsadmin"]
            },
            "custom_queries": [{
              "metric_prefix": "vibecode.postgres.tables",
              "query": "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup FROM pg_stat_user_tables",
              "columns": [
                {"name": "schema", "type": "tag"},
                {"name": "table", "type": "tag"},
                {"name": "vibecode.postgres.table.inserts", "type": "gauge"},
                {"name": "vibecode.postgres.table.updates", "type": "gauge"},
                {"name": "vibecode.postgres.table.deletes", "type": "gauge"},
                {"name": "vibecode.postgres.table.live_tuples", "type": "gauge"},
                {"name": "vibecode.postgres.table.dead_tuples", "type": "gauge"}
              ],
              "tags": ["env:kind", "service:vibecode", "database:vibecode"]
            }],
            "tags": [
              "env:kind",
              "service:vibecode-postgres",
              "cluster:vibecode-kind",
              "database:vibecode",
              "component:database"
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
            }],
            "tags": ["env:kind", "service:vibecode-postgres", "component:database"]
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
          value: "vibecode"
        - name: POSTGRES_USER
          value: "vibecode"
        - name: POSTGRES_PASSWORD
          value: "vibecode_password"
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        - name: POSTGRES_INITDB_ARGS
          value: "--encoding=UTF-8 --data-checksums"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        - name: postgres-init
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
        readinessProbe:
          exec:
            command: ["pg_isready", "-U", "vibecode", "-d", "vibecode"]
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          exec:
            command: ["pg_isready", "-U", "vibecode", "-d", "vibecode"]
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: postgres-storage
        emptyDir: {}
      - name: postgres-config
        configMap:
          name: postgres-dbm-config
      - name: postgres-init
        configMap:
          name: postgres-dbm-init
          defaultMode: 0755

---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: vibecode-platform
  labels:
    app: postgres
    component: database
    monitoring: datadog
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
      nodePort: 30001
      name: postgres
  type: NodePort
EOF

    kubectl apply -f /tmp/postgres-dbm-deployment.yaml
    print_success "PostgreSQL deployed with Database Monitoring"
}

# Deploy Datadog with database monitoring
deploy_datadog_with_dbm() {
    print_status "Deploying Datadog with Database Monitoring..."
    
    # Add Datadog Helm repository
    helm repo add datadog https://helm.datadoghq.com
    helm repo update
    
    # Use the updated values file
    local datadog_values="$PROJECT_ROOT/k8s/datadog-values-kind.yaml"
    
    if [ ! -f "$datadog_values" ]; then
        print_error "Datadog values file not found: $datadog_values"
        exit 1
    fi
    
    # Install or upgrade Datadog
    helm upgrade --install datadog-agent datadog/datadog \
        --namespace "$DATADOG_NAMESPACE" \
        --values "$datadog_values" \
        --timeout=600s \
        --wait
    
    print_success "Datadog deployed with Database Monitoring enabled"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment/postgres -n "$NAMESPACE"
    
    # Wait for Datadog agent
    print_status "Waiting for Datadog agent..."
    kubectl wait --for=condition=ready --timeout=300s \
        pod -l app=datadog-agent -n "$DATADOG_NAMESPACE"
    
    print_success "All services are ready"
}

# Verify the setup
verify_setup() {
    print_status "Verifying Database Monitoring setup..."
    
    # Check PostgreSQL pod
    local postgres_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$postgres_pod" ]; then
        print_error "PostgreSQL pod not found"
        return 1
    fi
    
    print_status "PostgreSQL pod: $postgres_pod"
    
    # Test database connection
    if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U vibecode -d vibecode -c "SELECT 1;" &> /dev/null; then
        print_success "PostgreSQL database connection test passed"
    else
        print_warning "PostgreSQL database connection test failed"
    fi
    
    # Test monitoring user connection
    if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U datadog -d vibecode -c "SELECT datadog_monitoring_health();" &> /dev/null; then
        print_success "Datadog monitoring user connection test passed"
    else
        print_warning "Datadog monitoring user connection test failed"
    fi
    
    # Check Datadog agent logs for PostgreSQL integration
    local datadog_pod=$(kubectl get pods -n "$DATADOG_NAMESPACE" -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$datadog_pod" ]; then
        print_status "Checking Datadog agent logs for PostgreSQL integration..."
        if kubectl logs -n "$DATADOG_NAMESPACE" "$datadog_pod" | grep -i "postgres.*check" &> /dev/null; then
            print_success "Datadog PostgreSQL integration is active"
        else
            print_warning "Datadog PostgreSQL integration may not be active yet"
        fi
    fi
    
    print_success "Setup verification completed"
}

# Display connection information
display_connection_info() {
    print_status "Connection Information:"
    echo "KIND Cluster: $CLUSTER_NAME"
    echo "Namespace: $NAMESPACE"
    echo "Datadog Namespace: $DATADOG_NAMESPACE"
    echo ""
    echo "PostgreSQL Connection:"
    echo "  Host: localhost"
    echo "  Port: 30001 (NodePort)"
    echo "  Database: vibecode"
    echo "  User: vibecode"
    echo "  Password: vibecode_password"
    echo ""
    echo "Monitoring User:"
    echo "  User: datadog"
    echo "  Password: datadog_monitoring_password"
    echo ""
    echo "Useful Commands:"
    echo "  # Port forward PostgreSQL:"
    echo "  kubectl port-forward -n $NAMESPACE service/postgres-service 5432:5432"
    echo ""
    echo "  # Connect to database:"
    echo "  psql -h localhost -p 5432 -U vibecode -d vibecode"
    echo ""
    echo "  # Check PostgreSQL logs:"
    echo "  kubectl logs -n $NAMESPACE -l app=postgres"
    echo ""
    echo "  # Check Datadog agent logs:"
    echo "  kubectl logs -n $DATADOG_NAMESPACE -l app=datadog-agent | grep postgres"
    echo ""
    echo "  # Test monitoring health:"
    echo "  kubectl exec -n $NAMESPACE deployment/postgres -- psql -U datadog -d vibecode -c \"SELECT * FROM datadog_monitoring_health();\""
    echo ""
    print_success "KIND cluster with PostgreSQL Database Monitoring is ready!"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -f /tmp/postgres-dbm-config.yaml /tmp/postgres-dbm-deployment.yaml
}

# Main execution
main() {
    print_status "Starting KIND cluster deployment with PostgreSQL Database Monitoring..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    load_environment
    create_kind_cluster
    setup_namespaces
    create_datadog_secrets
    create_postgres_monitoring_config
    deploy_postgres_with_monitoring
    deploy_datadog_with_dbm
    wait_for_services
    
    # Give some time for monitoring to initialize
    print_status "Waiting for monitoring initialization..."
    sleep 30
    
    verify_setup
    display_connection_info
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Deploy KIND cluster with PostgreSQL Database Monitoring"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  CLUSTER_NAME         KIND cluster name (default: vibecode-kind)"
        echo "  NAMESPACE           Application namespace (default: vibecode-platform)"
        echo "  DATADOG_NAMESPACE   Datadog namespace (default: datadog)"
        echo "  DD_API_KEY          Datadog API key"
        echo "  DD_APP_KEY          Datadog application key"
        echo "  DD_SITE             Datadog site (default: datadoghq.com)"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
