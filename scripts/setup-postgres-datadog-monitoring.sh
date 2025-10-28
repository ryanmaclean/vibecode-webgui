#!/usr/bin/env bash
# Configure Datadog Database Monitoring for an existing PostgreSQL deployment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

NAMESPACE=${NAMESPACE:-"vibecode-platform"}
DATADOG_NAMESPACE=${DATADOG_NAMESPACE:-"datadog"}
RELEASE_NAME=${RELEASE_NAME:-"vector-db"}

log_step "Datadog PostgreSQL Monitoring Setup"
log_info "App namespace: ${NAMESPACE}"
log_info "Datadog namespace: ${DATADOG_NAMESPACE}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command '$1' not available."
    exit 1
  fi
}

require_cmd kubectl

if ! kubectl cluster-info >/dev/null 2>&1; then
  log_error "Cannot connect to Kubernetes cluster."
  exit 1
fi

log_step "Validating PostgreSQL deployment"
if ! kubectl get deployment postgres -n "$NAMESPACE" >/dev/null 2>&1; then
  log_error "PostgreSQL deployment 'postgres' not found in namespace ${NAMESPACE}."
  exit 1
fi

POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
if [[ -z "$POSTGRES_POD" ]]; then
  log_error "No running postgres pods found with label app=postgres."
  exit 1
fi
log_info "Using pod ${POSTGRES_POD}"

log_step "Creating/refreshing monitoring user"
cat > /tmp/datadog-monitor-user.sql <<'SQL'
#!/bin/bash
# Quick setup script for adding PostgreSQL Database Monitoring to existing KIND cluster
# This script configures an existing PostgreSQL deployment for Datadog monitoring

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-"vibecode-platform"}
DATADOG_NAMESPACE=${DATADOG_NAMESPACE:-"datadog"}

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
    
    # Check if PostgreSQL exists
    if ! kubectl get deployment postgres -n "$NAMESPACE" &> /dev/null; then
        print_error "PostgreSQL deployment not found in namespace $NAMESPACE"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create PostgreSQL monitoring user setup
setup_monitoring_user() {
    print_status "Setting up PostgreSQL monitoring user..."
    
    local postgres_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$postgres_pod" ]; then
        print_error "PostgreSQL pod not found"
        exit 1
    fi
    
    # Create monitoring user and grant permissions
    kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U vibecode -d postgres << 'EOF'
-- Create monitoring user for Datadog Database Monitoring
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
        CREATE USER datadog WITH PASSWORD 'datadog_monitoring_password';
    ELSE
        ALTER USER datadog WITH PASSWORD 'datadog_monitoring_password';
        RAISE NOTICE 'Created datadog user';
    ELSE
        ALTER USER datadog WITH PASSWORD 'datadog_monitoring_password';
        RAISE NOTICE 'Updated datadog user password';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO datadog;
GRANT pg_monitor TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
SQL

kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- psql -U vibecode -d postgres -f /dev/stdin < /tmp/datadog-monitor-user.sql
rm -f /tmp/datadog-monitor-user.sql
log_success "Monitoring user ready"

log_step "Creating Datadog secret"
cat > /tmp/datadog-postgres-creds.yaml <<DDSECRET
apiVersion: v1
kind: Secret
metadata:
  name: datadog-postgres-creds
  namespace: ${NAMESPACE}
stringData:
  username: datadog
  password: datadog_monitoring_password
DDSECRET

kubectl apply -f /tmp/datadog-postgres-creds.yaml --validate=false
rm -f /tmp/datadog-postgres-creds.yaml
log_success "datadog-postgres-creds secret applied"

log_step "Configuring Datadog Agent"
cat > /tmp/datadog-agent-postgres-config.yaml <<DDCONFIG
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agent-postgres-config
  namespace: ${DATADOG_NAMESPACE}
data:
  postgres.yaml: |
    init_config:
    instances:
      - dbm: true
        host: ${RELEASE_NAME}-postgresql.${NAMESPACE}.svc.cluster.local
        port: 5432
        username: datadog
        password: datadog_monitoring_password
        dbname: postgres
        tags:
          - service:vibecode-postgres
          - env:development
DDCONFIG

kubectl apply -f /tmp/datadog-agent-postgres-config.yaml --validate=false
rm -f /tmp/datadog-agent-postgres-config.yaml
log_success "Datadog Agent ConfigMap applied"

log_step "Patching Datadog agent daemonset"
cat > /tmp/datadog-agent-patch.yaml <<'DDPATCH'
spec:
  template:
    spec:
      volumes:
        - name: postgres-config
          configMap:
            name: datadog-agent-postgres-config
      containers:
        - name: agent
          volumeMounts:
            - name: postgres-config
              mountPath: /conf.d
              readOnly: true
DDPATCH

kubectl patch daemonset datadog-agent -n "$DATADOG_NAMESPACE" --patch-file /tmp/datadog-agent-patch.yaml
rm -f /tmp/datadog-agent-patch.yaml
log_success "Datadog agent patched for DBM"

log_step "Summary"
log_success "Datadog monitoring user provisioned in namespace ${NAMESPACE}"
log_success "Secret datadog-postgres-creds applied"
log_success "Datadog agent config map available"
log_success "Daemonset datadog-agent patched for DB monitoring"

log_info "Next steps:"
log_info "  • Verify metrics in Datadog Database Monitoring dashboard"
log_info "  • Rotate 'datadog_monitoring_password' for production"

log_success "PostgreSQL Datadog monitoring setup complete"
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

-- Enable pg_stat_statements if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT EXECUTE ON FUNCTION pg_stat_statements_reset() TO datadog;
EOF

    # Setup application database permissions
    kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U vibecode -d vibecode << 'EOF'
-- Grant database connection and schema access
GRANT CONNECT ON DATABASE vibecode TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO datadog;

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
EOF

    print_success "PostgreSQL monitoring user setup completed"
}

# Update PostgreSQL deployment with monitoring annotations
update_postgres_annotations() {
    print_status "Updating PostgreSQL deployment with Datadog monitoring annotations..."
    
    # Create patch for annotations
    cat > /tmp/postgres-annotations-patch.yaml << 'EOF'
spec:
  template:
    metadata:
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
EOF

    # Apply the patch
    kubectl patch deployment postgres -n "$NAMESPACE" --patch-file /tmp/postgres-annotations-patch.yaml
    
    # Add monitoring label
    kubectl label deployment postgres -n "$NAMESPACE" monitoring=datadog --overwrite
    
    print_success "PostgreSQL deployment updated with monitoring annotations"
}

# Update Datadog to enable database monitoring
update_datadog_config() {
    print_status "Updating Datadog configuration to enable Database Monitoring..."
    
    # Check if Datadog is deployed via Helm
    if helm list -n "$DATADOG_NAMESPACE" | grep -q datadog-agent; then
        print_status "Found Datadog Helm deployment, updating..."
        
        # Get current values and update DBM setting
        helm get values datadog-agent -n "$DATADOG_NAMESPACE" > /tmp/current-datadog-values.yaml
        
        # Update the values to enable DBM
        cat >> /tmp/current-datadog-values.yaml << 'EOF'

# Enable Database Monitoring
datadog:
  dbm:
    enabled: true
EOF
        
        # Upgrade Datadog with new values
        helm upgrade datadog-agent datadog/datadog \
            --namespace "$DATADOG_NAMESPACE" \
            --values /tmp/current-datadog-values.yaml \
            --reuse-values
            
        print_success "Datadog updated with Database Monitoring enabled"
    else
        print_warning "Datadog not found as Helm deployment. You may need to manually enable DBM in your Datadog configuration."
    fi
}

# Restart PostgreSQL to pick up new annotations
restart_postgres() {
    print_status "Restarting PostgreSQL to apply monitoring configuration..."
    
    kubectl rollout restart deployment/postgres -n "$NAMESPACE"
    kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=300s
    
    print_success "PostgreSQL restarted successfully"
}

# Verify the monitoring setup
verify_monitoring() {
    print_status "Verifying Database Monitoring setup..."
    
    local postgres_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$postgres_pod" ]; then
        print_error "PostgreSQL pod not found after restart"
        return 1
    fi
    
    # Wait a bit for the pod to be ready
    kubectl wait --for=condition=ready pod/"$postgres_pod" -n "$NAMESPACE" --timeout=60s
    
    # Test monitoring user connection
    print_status "Testing monitoring user connection..."
    if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U datadog -d vibecode -c "SELECT * FROM datadog_monitoring_health();" &> /dev/null; then
        print_success "Monitoring user connection test passed"
        
        # Show the health check results
        print_status "Monitoring health check results:"
        kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U datadog -d vibecode -c "SELECT * FROM datadog_monitoring_health();"
    else
        print_warning "Monitoring user connection test failed"
    fi
    
    # Check if Datadog agent is picking up the PostgreSQL integration
    local datadog_pod=$(kubectl get pods -n "$DATADOG_NAMESPACE" -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$datadog_pod" ]; then
        print_status "Checking Datadog agent logs for PostgreSQL integration..."
        sleep 10  # Give some time for the integration to initialize
        
        if kubectl logs -n "$DATADOG_NAMESPACE" "$datadog_pod" --tail=50 | grep -i "postgres.*check" &> /dev/null; then
            print_success "Datadog PostgreSQL integration is active"
        else
            print_warning "Datadog PostgreSQL integration may not be active yet (check logs in a few minutes)"
        fi
    else
        print_warning "Datadog agent pod not found"
    fi
    
    print_success "Monitoring verification completed"
}

# Display monitoring information
display_monitoring_info() {
    print_status "PostgreSQL Database Monitoring Setup Complete!"
    echo ""
    echo "Monitoring User Details:"
    echo "  Username: datadog"
    echo "  Password: datadog_monitoring_password"
    echo "  Database: vibecode"
    echo ""
    echo "Verification Commands:"
    echo "  # Test monitoring user connection:"
    echo "  kubectl exec -n $NAMESPACE deployment/postgres -- psql -U datadog -d vibecode -c \"SELECT * FROM datadog_monitoring_health();\""
    echo ""
    echo "  # Check PostgreSQL logs:"
    echo "  kubectl logs -n $NAMESPACE -l app=postgres"
    echo ""
    echo "  # Check Datadog agent logs for PostgreSQL:"
    echo "  kubectl logs -n $DATADOG_NAMESPACE -l app=datadog-agent | grep -i postgres"
    echo ""
    echo "  # Port forward to access PostgreSQL:"
    echo "  kubectl port-forward -n $NAMESPACE service/postgres-service 5432:5432"
    echo ""
    echo "Expected Datadog Metrics:"
    echo "  - postgresql.*"
    echo "  - vibecode.postgres.table.*"
    echo "  - Database query performance metrics"
    echo "  - Connection and activity metrics"
    echo ""
    print_success "Setup completed! Database monitoring should be active in Datadog."
}

# Cleanup temporary files
cleanup() {
    rm -f /tmp/postgres-annotations-patch.yaml /tmp/current-datadog-values.yaml
}

# Main execution
main() {
    print_status "Setting up PostgreSQL Database Monitoring for existing KIND cluster..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    setup_monitoring_user
    update_postgres_annotations
    update_datadog_config
    restart_postgres
    
    # Give some time for monitoring to initialize
    print_status "Waiting for monitoring initialization..."
    sleep 20
    
    verify_monitoring
    display_monitoring_info
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Setup PostgreSQL Database Monitoring for existing KIND cluster"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  NAMESPACE           Application namespace (default: vibecode-platform)"
        echo "  DATADOG_NAMESPACE   Datadog namespace (default: datadog)"
        echo ""
        echo "Prerequisites:"
        echo "  - KIND cluster must be running"
        echo "  - PostgreSQL deployment must exist in the specified namespace"
        echo "  - Datadog agent must be deployed"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
