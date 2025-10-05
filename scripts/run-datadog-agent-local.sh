#!/usr/bin/env bash
# Run a Datadog Agent container locally to monitor the Postgres instance used for DBM demos.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

CONTAINER_NAME="datadog-agent-local"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres-monitoring}"
DD_API_KEY=${DD_API_KEY:-"dummy-key-for-local-dev"}
DD_APP_KEY=${DD_APP_KEY:-"dummy-app-key-for-local-dev"}

log_step "Datadog Agent Local Setup for PostgreSQL DBM"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command '$1' not available."
    exit 1
  fi
}

require_cmd docker
require_cmd mktemp

TEMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if docker ps -a -q -f name="$CONTAINER_NAME" | grep -q .; then
  log_info "Removing existing Datadog agent container"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

log_info "Writing postgres.yaml configuration into ${TEMP_DIR}"
cat > "$TEMP_DIR/postgres.yaml" <<'POSTGRES_YAML'
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
        query: "SELECT schemaname, relname AS tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup FROM pg_stat_user_tables"
        columns:
          - name: schema
            type: tag
          - name: table
            type: tag
          - name: vibecode.postgres.table.inserts
            type: gauge
          - name: vibecode.postgres.table.updates
            type: gauge
          - name: vibecode.postgres.table.deletes
            type: gauge
          - name: vibecode.postgres.table.live_tuples
            type: gauge
          - name: vibecode.postgres.table.dead_tuples
            type: gauge
        tags: ["env:development", "service:vibecode", "database:vibecode"]
      - metric_prefix: "vibecode.postgres.indexes"
        query: "SELECT schemaname, relname AS tablename, indexrelname AS indexname, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes"
        columns:
          - name: schema
            type: tag
          - name: table
            type: tag
          - name: index
            type: tag
          - name: vibecode.postgres.index.tuples_read
            type: gauge
          - name: vibecode.postgres.index.tuples_fetched
            type: gauge
        tags: ["env:development", "service:vibecode", "database:vibecode"]
    tags:
      - env:development
      - service:vibecode-webgui
      - application:vibecode-platform
      - version:1.0.0
      - database:vibecode
      - component:postgres
POSTGRES_YAML

log_info "Starting Datadog agent container"
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
  gcr.io/datadoghq/agent:7 >/dev/null

log_info "Waiting for Datadog agent to initialize"
sleep 10

if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
  log_success "Datadog agent container is running"
  log_info "Container status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" -f name="$CONTAINER_NAME"
  log_info "Recent logs:"
  docker logs "$CONTAINER_NAME" --tail 20
else
  log_error "Datadog agent container failed to start"
fi

log_success "Local Datadog agent ready"
