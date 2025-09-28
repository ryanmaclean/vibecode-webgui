#!/bin/bash
# Run Datadog Agent locally to monitor PostgreSQL container
# This approach works better than trying to connect from Kubernetes

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
CONTAINER_NAME="datadog-agent-local"
POSTGRES_CONTAINER="postgres-monitoring"
DD_API_KEY=${DD_API_KEY:-"dummy-key-for-local-dev"}
DD_APP_KEY=${DD_APP_KEY:-"dummy-app-key-for-local-dev"}

print_header "DATADOG AGENT LOCAL SETUP FOR POSTGRES DBM"

# Stop existing agent if running
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    print_status "Stopping existing Datadog agent container..."
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# Create temporary directory for configuration
TEMP_DIR=$(mktemp -d)
print_status "Creating Datadog configuration in $TEMP_DIR"

# Create postgres.yaml configuration
cat > "$TEMP_DIR/postgres.yaml" << 'EOF'
init_config:

instances:
  - host: postgres-monitoring
    port: 5432
    username: datadog
    password: datadog_monitoring_password
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
    database_autodiscovery:
      enabled: true
      include: ["vibecode", "postgres"]
      exclude: ["template.*", "rdsadmin"]
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
EOF

print_status "Starting Datadog agent container..."

# Run Datadog agent with PostgreSQL monitoring
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
    -e DD_HOSTNAME="vibecode-local" \
    -e DD_LOGS_ENABLED=true \
    -e DD_APM_ENABLED=true \
    -e DD_PROCESS_AGENT_ENABLED=true \
    -e DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true \
    -p 8125:8125/udp \
    -p 8126:8126 \
    gcr.io/datadoghq/agent:7

print_status "Waiting for Datadog agent to start..."
sleep 10

# Check if container is running
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    print_success "Datadog agent is running!"
    
    # Show container status
    echo ""
    print_status "Container status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" -f name="$CONTAINER_NAME"
    
    # Wait a bit more and check logs
    print_status "Checking agent logs for PostgreSQL integration..."
    sleep 15
    
    echo ""
    print_status "Recent logs:"
    docker logs "$CONTAINER_NAME" --tail 20 2>/dev/null | grep -i -E "(postgres|dbm|error|started|ready)" || echo "No specific PostgreSQL logs found yet"
    
    echo ""
    print_success "Datadog agent setup complete!"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Wait 2-3 minutes for metrics to appear"
    echo "2. Check agent status: docker exec $CONTAINER_NAME agent status"
    echo "3. Check PostgreSQL integration: docker exec $CONTAINER_NAME agent status | grep postgres"
    echo "4. View logs: docker logs $CONTAINER_NAME"
    echo "5. Stop agent: docker stop $CONTAINER_NAME"
    echo ""
    echo -e "${YELLOW}Note:${NC} Using dummy API keys for local testing"
    echo "For real monitoring, set DD_API_KEY and DD_APP_KEY environment variables"
    
else
    print_error "Failed to start Datadog agent container"
    exit 1
fi

# Cleanup function
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR" 2>/dev/null || true
}

trap cleanup EXIT
