#!/bin/bash
# Run Datadog Agent with FIXED PostgreSQL configuration
# Fix the dbname + database_autodiscovery conflict

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
CONTAINER_NAME="datadog-agent-fixed"
POSTGRES_CONTAINER="postgres-monitoring"
DD_API_KEY=${DD_API_KEY:-"dummy-key-for-local-dev"}
DD_APP_KEY=${DD_APP_KEY:-"dummy-app-key-for-local-dev"}

print_header "DATADOG AGENT WITH FIXED POSTGRES CONFIGURATION"

# Stop existing agents
for container in datadog-agent-local datadog-agent-fixed; do
    if docker ps -q -f name="$container" | grep -q .; then
        print_status "Stopping existing $container..."
        docker stop "$container" >/dev/null 2>&1 || true
        docker rm "$container" >/dev/null 2>&1 || true
    fi
done

# Create temporary directory for configuration
TEMP_DIR=$(mktemp -d)
print_status "Creating FIXED Datadog configuration in $TEMP_DIR"

# Create postgres.yaml configuration - FIXED VERSION
cat > "$TEMP_DIR/postgres.yaml" << 'EOF'
init_config:

instances:
  # Option 1: Use specific database without autodiscovery
  - host: postgres-monitoring
    port: 5432
    username: datadog
    password: datadog_monitoring_password
    dbname: vibecode
    dbm: true
    collect_schemas:
      enabled: true
      collection_interval: 600
    collect_activity:
      enabled: true
      collection_interval: 10
    collect_settings:
      enabled: true
      collection_interval: 600
    relations:
      - relation_regex: ".*"
        relkind: ["r", "i", "S"]
    custom_queries:
      - metric_prefix: "vibecode.postgres.tables"
        query: "SELECT schemaname, relname as tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup FROM pg_stat_user_tables"
        columns:
          - name: "schema"
            type: "tag"
          - name: "table"
            type: "tag"
          - name: "vibecode.postgres.table.inserts"
            type: "gauge"
          - name: "vibecode.postgres.table.updates"
            type: "gauge"
          - name: "vibecode.postgres.table.deletes"
            type: "gauge"
          - name: "vibecode.postgres.table.live_tuples"
            type: "gauge"
          - name: "vibecode.postgres.table.dead_tuples"
            type: "gauge"
        tags: ["env:developement", "service:vibecode", "database:vibecode"]
      - metric_prefix: "vibecode.postgres.indexes"
        query: "SELECT schemaname, relname as tablename, indexrelname as indexname, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes"
        columns:
          - name: "schema"
            type: "tag"
          - name: "table"
            type: "tag"
          - name: "index"
            type: "tag"
          - name: "vibecode.postgres.index.tuples_read"
            type: "gauge"
          - name: "vibecode.postgres.index.tuples_fetched"
            type: "gauge"
        tags: ["env:developement", "service:vibecode", "database:vibecode"]
    tags:
      - "env:developement"
      - "service:vibecode-webgui"
      - "application:vibecode-platform"
      - "version:1.0.0"
      - "database:vibecode"
      - "component:postgres"

  # Option 2: Additional instance for postgres database
  - host: postgres-monitoring
    port: 5432
    username: datadog
    password: datadog_monitoring_password
    dbname: postgres
    dbm: false
    tags:
      - "env:developement"
      - "service:postgres-system"
      - "database:postgres"
EOF

print_status "Starting FIXED Datadog agent container..."

# Run Datadog agent with FIXED PostgreSQL configuration
docker run -d \
    --name "$CONTAINER_NAME" \
    --link "$POSTGRES_CONTAINER:postgres-monitoring" \
    -v "$TEMP_DIR:/etc/datadog-agent/conf.d/postgres.d/" \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v /proc/:/host/proc/:ro \
    -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
    -e DD_API_KEY="$DD_API_KEY" \
    -e DD_APP_KEY="$DD_APP_KEY" \
    -e DD_SITE="datadoghq.com" \
    -e DD_HOSTNAME="vibecode-local-fixed" \
    -e DD_LOGS_ENABLED=true \
    -e DD_APM_ENABLED=true \
    -e DD_PROCESS_AGENT_ENABLED=true \
    -e DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true \
    -p 8125:8125/udp \
    -p 8126:8126 \
    gcr.io/datadoghq/agent:7

print_status "Waiting for Datadog agent to start..."
sleep 15

# Check if container is running
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    print_success "FIXED Datadog agent is running!"
    
    # Show container status
    echo ""
    print_status "Container status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" -f name="$CONTAINER_NAME"
    
    # Wait and check PostgreSQL integration specifically
    print_status "Waiting for PostgreSQL integration to initialize..."
    sleep 20
    
    echo ""
    print_status "Checking PostgreSQL integration status:"
    docker exec "$CONTAINER_NAME" agent status | grep -A30 -B5 postgres || echo "PostgreSQL check not found in status"
    
    echo ""
    print_status "Checking for any PostgreSQL errors:"
    docker logs "$CONTAINER_NAME" --tail 50 | grep -i -E "(postgres|error|dbm)" || echo "No PostgreSQL errors found"
    
    echo ""
    print_success "FIXED Datadog agent setup complete!"
    echo ""
    echo -e "${CYAN}Validation commands:${NC}"
    echo "1. Check overall status: docker exec $CONTAINER_NAME agent status"
    echo "2. Check PostgreSQL specifically: docker exec $CONTAINER_NAME agent status | grep -A20 postgres"
    echo "3. Test PostgreSQL connection: docker exec $CONTAINER_NAME agent check postgres"
    echo "4. View all logs: docker logs $CONTAINER_NAME"
    echo "5. Stop agent: docker stop $CONTAINER_NAME"
    
else
    print_error "Failed to start FIXED Datadog agent container"
    exit 1
fi

# Cleanup function
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR" 2>/dev/null || true
}

trap cleanup EXIT
