#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Verify Datadog Database Monitoring for pgvector on PostgreSQL
# This script validates that DBM is properly configured and collecting data

# Initialize log aggregation
init_log_aggregation


echo "🔍 Verifying Datadog Database Monitoring for pgvector on PostgreSQL"
echo "=================================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
warning() { echo -e "${YELLOW}⚠️${NC} $1"; }
error() { echo -e "${RED}❌${NC} $1"; }

decode_base64_portable() {
    local encoded_value="$1"
    if [ -z "$encoded_value" ]; then
        return 1
    fi

    if command -v base64 >/dev/null 2>&1; then
        if echo "dGVzdA==" | base64 --decode >/dev/null 2>&1; then
            printf "%s" "$encoded_value" | base64 --decode 2>/dev/null
            return $?
        elif echo "dGVzdA==" | base64 -D >/dev/null 2>&1; then
            printf "%s" "$encoded_value" | base64 -D 2>/dev/null
            return $?
        fi
    fi

    if command -v python3 >/dev/null 2>&1; then
        SECRET_DATA="$encoded_value" python3 - <<'PYCODE' 2>/dev/null
import base64
import os
import sys
import binascii

data = os.environ.get("SECRET_DATA", "")
if not data:
    sys.exit(1)
try:
    sys.stdout.write(base64.b64decode(data).decode())
except (binascii.Error, UnicodeDecodeError):
    sys.exit(1)
PYCODE
        return $?
    fi

    return 1
}

# Configuration (override via environment)
NAMESPACE="${NAMESPACE:-vibecode-platform}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres-service}"
DATADOG_AGENT_NAMESPACE="${DATADOG_AGENT_NAMESPACE:-datadog}"
DB_NAME="${DB_NAME:-vibecode}"
DB_USER="${DB_USER:-datadog}"

DB_ADMIN_USER="${DB_ADMIN_USER:-postgres}"
# Optional settings
# If true, store password in a Kubernetes Secret and reference via env in Datadog Agent
USE_SECRET_PASSWORD="${USE_SECRET_PASSWORD:-false}"
MONITORING_SECRET_NAME="${MONITORING_SECRET_NAME:-postgres-datadog-secret}"
MONITORING_SECRET_KEY="${MONITORING_SECRET_KEY:-password}"
# Search both the Datadog namespace and the Postgres namespace for the secret by default
MONITORING_SECRET_NAMESPACES="${MONITORING_SECRET_NAMESPACES:-$DATADOG_AGENT_NAMESPACE $NAMESPACE}"

# Track where the monitoring password comes from for logging/debugging
MONITORING_PASSWORD_SOURCE=""
if [ -n "${MONITORING_PASSWORD:-}" ]; then
    MONITORING_PASSWORD="${MONITORING_PASSWORD}"
    MONITORING_PASSWORD_SOURCE="MONITORING_PASSWORD env"
elif [ -n "${DD_POSTGRES_PASSWORD:-}" ]; then
    MONITORING_PASSWORD="${DD_POSTGRES_PASSWORD}"
    MONITORING_PASSWORD_SOURCE="DD_POSTGRES_PASSWORD env"
else
    MONITORING_PASSWORD=""
fi
DEFAULT_MONITORING_PASSWORD="datadog_monitoring_password"
# SSL mode for Datadog Postgres integration: disable|require|verify-ca|verify-full
SSL_MODE="${SSL_MODE:-disable}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    error "Cannot connect to Kubernetes cluster"
    exit 1
fi

# Resolve monitoring password source after confirming cluster access
SECRET_SOURCE_NAME=""
SECRET_SOURCE_NAMESPACE=""
if [ "$USE_SECRET_PASSWORD" = "true" ] && [ -z "$MONITORING_PASSWORD" ]; then
    for secret_name in $MONITORING_SECRET_NAME; do
        for secret_ns in $MONITORING_SECRET_NAMESPACES; do
            if [ -z "$secret_ns" ]; then
                continue
            fi
            if kubectl get secret "$secret_name" -n "$secret_ns" >/dev/null 2>&1; then
                SECRET_BASE64=$(kubectl get secret "$secret_name" -n "$secret_ns" -o jsonpath="{.data['${MONITORING_SECRET_KEY}']}" 2>/dev/null || echo "")
                if [ -n "$SECRET_BASE64" ]; then
                    SECRET_VALUE=$(decode_base64_portable "$SECRET_BASE64" || true)
                    if [ -n "$SECRET_VALUE" ]; then
                        MONITORING_PASSWORD="$SECRET_VALUE"
                        MONITORING_PASSWORD_SOURCE="secret:$secret_ns/$secret_name:$MONITORING_SECRET_KEY"
                        SECRET_SOURCE_NAME="$secret_name"
                        SECRET_SOURCE_NAMESPACE="$secret_ns"
                        break 2
                    fi
                fi
            fi
        done
    done

    if [ -z "$MONITORING_PASSWORD" ]; then
        warning "Unable to load monitoring password from secret '$MONITORING_SECRET_NAME' (namespaces: $MONITORING_SECRET_NAMESPACES)."
    fi
fi

if [ -z "$MONITORING_PASSWORD" ]; then
    MONITORING_PASSWORD="$DEFAULT_MONITORING_PASSWORD"
    if [ -z "$MONITORING_PASSWORD_SOURCE" ]; then
        MONITORING_PASSWORD_SOURCE="default value"
    fi
fi

if [ -n "$MONITORING_PASSWORD_SOURCE" ]; then
    log "Using monitoring password from: $MONITORING_PASSWORD_SOURCE"
fi

# Escape password for SQL statements (single quotes -> doubled)
SQL_MONITORING_PASSWORD=$(printf "%s" "$MONITORING_PASSWORD" | sed "s/'/''/g")

log "Starting Datadog DBM verification..."

# 1. Check PostgreSQL deployment
log "1. Checking PostgreSQL workload..."
# Autodetect app label and resource type (StatefulSet vs Deployment)
PG_LABEL_VALUE="postgres"
if kubectl get pods -n $NAMESPACE -l app=postgresql --no-headers >/dev/null 2>&1; then
  PG_LABEL_VALUE="postgresql"
elif kubectl get pods -n $NAMESPACE -l app=postgres-simple --no-headers >/dev/null 2>&1; then
  PG_LABEL_VALUE="postgres-simple"
fi

# Allow explicit override when multiple Postgres workloads exist
DEPLOY_KIND="${POSTGRES_WORKLOAD_KIND:-}"
DEPLOY_NAME="${POSTGRES_WORKLOAD_NAME:-}"

if [ -n "$DEPLOY_KIND" ] && [ -n "$DEPLOY_NAME" ]; then
  success "Using overridden PostgreSQL ${DEPLOY_KIND}/${DEPLOY_NAME}"
  kubectl -n $NAMESPACE rollout status ${DEPLOY_KIND}/${DEPLOY_NAME} --timeout=240s || true
else
  # Detect workload kind/name
  if kubectl get statefulset postgresql -n $NAMESPACE &> /dev/null; then
    DEPLOY_KIND="statefulset"
    DEPLOY_NAME="postgresql"
    success "PostgreSQL StatefulSet found"
    kubectl -n $NAMESPACE rollout status statefulset/postgresql --timeout=300s || true
  elif kubectl get deployment postgres -n $NAMESPACE &> /dev/null; then
    DEPLOY_KIND="deployment"
    DEPLOY_NAME="postgres"
    success "PostgreSQL Deployment found"
    kubectl -n $NAMESPACE rollout status deployment/postgres --timeout=240s || true
  else
    # Fallback: detect any workload containing 'postgres' in its name
    SS_CAND=$(kubectl -n $NAMESPACE get statefulset -o name 2>/dev/null | grep -E "postgres|postgresql" | head -n1 || true)
    DEP_CAND=$(kubectl -n $NAMESPACE get deployment -o name 2>/dev/null | grep -E "postgres|postgresql|postgres-simple" | head -n1 || true)
    if [ -n "$SS_CAND" ]; then
      DEPLOY_KIND="statefulset"
      DEPLOY_NAME="${SS_CAND#statefulset.apps/}"
      success "Detected PostgreSQL StatefulSet: $DEPLOY_NAME"
      kubectl -n $NAMESPACE rollout status statefulset/$DEPLOY_NAME --timeout=240s || true
    elif [ -n "$DEP_CAND" ]; then
      DEPLOY_KIND="deployment"
      DEPLOY_NAME="${DEP_CAND#deployment.apps/}"
      success "Detected PostgreSQL Deployment: $DEPLOY_NAME"
      kubectl -n $NAMESPACE rollout status deployment/$DEPLOY_NAME --timeout=240s || true
    else
      warning "PostgreSQL Deployment/StatefulSet not found in namespace $NAMESPACE; will try to find a pod directly"
    fi
  fi
fi

# 2. Check Datadog agent deployment
log "2. Checking Datadog agent deployment..."
DS_NAME=""
if kubectl get daemonset datadog-agent -n $DATADOG_AGENT_NAMESPACE &> /dev/null; then
    DS_NAME="datadog-agent"
elif kubectl get daemonset datadog -n $DATADOG_AGENT_NAMESPACE &> /dev/null; then
    DS_NAME="datadog"
fi

if [ -n "$DS_NAME" ]; then
    success "Datadog agent daemonset found: $DS_NAME"
    # Check agent status
    DESIRED_AGENTS=$(kubectl get daemonset "$DS_NAME" -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.desiredNumberScheduled}')
    READY_AGENTS=$(kubectl get daemonset "$DS_NAME" -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.numberReady}')
    if [ "$READY_AGENTS" = "$DESIRED_AGENTS" ]; then
        success "Datadog agents are ready ($READY_AGENTS/$DESIRED_AGENTS)"
    else
        warning "Datadog agents are not fully ready ($READY_AGENTS/$DESIRED_AGENTS)"
    fi
else
    error "Datadog agent DaemonSet not found in namespace $DATADOG_AGENT_NAMESPACE"
    warning "Skipping automatic install. Ensure the Datadog Agent with DBM is deployed."
fi

# 2b. Check Datadog Cluster Agent
log "2b. Checking Datadog Cluster Agent..."
if kubectl get deployment datadog-cluster-agent -n $DATADOG_AGENT_NAMESPACE &> /dev/null; then
    kubectl -n $DATADOG_AGENT_NAMESPACE rollout status deployment/datadog-cluster-agent --timeout=240s || true
    DCA_DESIRED=$(kubectl get deployment datadog-cluster-agent -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
    DCA_READY=$(kubectl get deployment datadog-cluster-agent -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    if [ -z "$DCA_DESIRED" ] || [ "$DCA_DESIRED" = "" ]; then DCA_DESIRED=0; fi
    if [ -z "$DCA_READY" ] || [ "$DCA_READY" = "" ]; then DCA_READY=0; fi

    if [ "$DCA_READY" = "$DCA_DESIRED" ] && [ "$DCA_READY" != "0" ]; then
        success "Datadog Cluster Agent is ready ($DCA_READY/$DCA_DESIRED)"
    else
        warning "Datadog Cluster Agent not fully ready yet ($DCA_READY/$DCA_DESIRED)"
        # Basic diagnostics: check pod status and logs for crash loops
        DCA_PODS=$(kubectl get pods -n $DATADOG_AGENT_NAMESPACE -l app=datadog-cluster-agent -o jsonpath='{.items[*].metadata.name}')
        if [ -n "$DCA_PODS" ]; then
            for p in $DCA_PODS; do
                state=$(kubectl get pod "$p" -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || echo "")
                restarts=$(kubectl get pod "$p" -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
                if [ -n "$state" ] || [ "$restarts" -gt 0 ]; then
                    warning "Cluster Agent pod $p state=$state restarts=$restarts"
                    log "Last 50 logs from $p:"
                    kubectl logs -n $DATADOG_AGENT_NAMESPACE "$p" --tail=50 || true
                fi
            done
        fi
        log "Tip: Ensure DD_CLUSTER_AGENT_AUTH_TOKEN matches, and RBAC/leader election permissions are configured."
    fi
else
    warning "Datadog Cluster Agent deployment not found in namespace $DATADOG_AGENT_NAMESPACE"
fi

# 3. Check PostgreSQL extensions and configuration
log "3. Checking PostgreSQL extensions and DBM configuration..."

# Get PostgreSQL pod
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=$PG_LABEL_VALUE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -z "$POSTGRES_POD" ]; then
  # Fallback: match by pod name containing postgres
  POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -o name 2>/dev/null | grep -E "postgres|postgresql" | head -n1 | sed 's#pod/##' || true)
fi

if [ -z "$POSTGRES_POD" ]; then
    error "No PostgreSQL pod found"
    exit 1
fi

success "Found PostgreSQL pod: $POSTGRES_POD"

# Check pgvector extension
log "Checking pgvector extension..."
## Detect the correct main container name in the pod
PG_CONTAINER_NAME=$(kubectl get pod -n $NAMESPACE $POSTGRES_POD -o jsonpath='{.spec.containers[0].name}' 2>/dev/null || echo "")
if [ -z "$PG_CONTAINER_NAME" ]; then
    PG_CONTAINER_NAME="postgres"
fi
success "Using PostgreSQL container: $PG_CONTAINER_NAME"

PGVECTOR_AVAILABLE=1
PGVECTOR_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT 1 FROM pg_extension WHERE extname='vector';" 2>/dev/null | tr -d '[:space:]')

if [ "$PGVECTOR_CHECK" = "1" ]; then
    success "pgvector extension is installed"
else
    warning "pgvector extension not found. Attempting to install..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || true
    PGVECTOR_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT 1 FROM pg_extension WHERE extname='vector';" 2>/dev/null | tr -d '[:space:]')
    if [ "$PGVECTOR_CHECK" = "1" ]; then
        success "pgvector extension installed"
    else
        PGVECTOR_AVAILABLE=0
        warning "pgvector extension not available on this image. Skipping vector-specific steps."
    fi
fi

# Check pg_stat_statements extension in primary database
log "Checking pg_stat_statements extension..."
PGSTAT_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements';" 2>/dev/null | tr -d '[:space:]')

if [ "$PGSTAT_CHECK" = "1" ]; then
    success "pg_stat_statements extension is installed in $DB_NAME"
else
    warning "pg_stat_statements extension not found in $DB_NAME. Installing..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
    success "pg_stat_statements extension installed in $DB_NAME"
fi

# Ensure pg_stat_statements is installed in the postgres database for Datadog's default connection
if [ "$DB_NAME" != "postgres" ]; then
  log "Ensuring pg_stat_statements extension exists in postgres database..."
  PGSTAT_DEFAULT=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d postgres -t -c "SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements';" 2>/dev/null | tr -d '[:space:]')
  if [ "$PGSTAT_DEFAULT" = "1" ]; then
      success "pg_stat_statements extension is installed in postgres"
  else
      kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" >/dev/null 2>&1 && 
        success "pg_stat_statements extension installed in postgres" || 
        warning "Unable to install pg_stat_statements extension in postgres"
  fi
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d postgres -c "GRANT SELECT ON pg_stat_statements TO $DB_USER;" >/dev/null 2>&1 || true
fi

# 4. Check/Create Datadog monitoring user
log "4. Checking Datadog monitoring user..."
DATADOG_USER_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT 1 FROM pg_user WHERE usename='$DB_USER';" 2>/dev/null | tr -d '[:space:]')

if [ "$DATADOG_USER_CHECK" = "1" ]; then
    success "Datadog user '$DB_USER' exists"
else
    warning "Datadog user not found. Creating..."

    # Create datadog user with proper permissions (idempotent)
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN CREATE ROLE $DB_USER LOGIN PASSWORD '${SQL_MONITORING_PASSWORD}'; END IF; END \$\$;" || true
    success "Datadog user ensured with monitoring permissions"
fi

  # Ensure required monitoring privileges are present (idempotent)
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -v ON_ERROR_STOP=1 -c "\
    GRANT pg_monitor TO $DB_USER; \
    GRANT pg_read_all_stats TO $DB_USER; \
    GRANT pg_read_all_settings TO $DB_USER; \
    GRANT SELECT ON pg_stat_database TO $DB_USER; \
    GRANT EXECUTE ON FUNCTION pg_catalog.pg_ls_dir(text) TO $DB_USER; \
    GRANT EXECUTE ON FUNCTION pg_catalog.pg_stat_file(text) TO $DB_USER; \
    GRANT EXECUTE ON FUNCTION pg_catalog.pg_ls_waldir() TO $DB_USER; \
    GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER; \
    GRANT USAGE ON SCHEMA public TO $DB_USER;" || warning "Unable to grant monitoring privileges to $DB_USER"

  # Ensure password matches expected value
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -v ON_ERROR_STOP=1 -c "ALTER ROLE $DB_USER WITH PASSWORD '${SQL_MONITORING_PASSWORD}';" || warning "Unable to reset password for $DB_USER"

  # Ensure CONNECT on the default 'postgres' database as well (Datadog often connects there)
  if [ "$DB_NAME" != "postgres" ]; then
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE postgres TO $DB_USER;" || true
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -c "GRANT USAGE ON SCHEMA public TO $DB_USER;" || true
  fi

# 4b. Annotate Postgres for Datadog Autodiscovery (DBM)
log "4b. Ensuring Datadog Autodiscovery annotations on Postgres workload..."
if [ -n "$DEPLOY_KIND" ] && [ -n "$DEPLOY_NAME" ]; then
  # Select password source for annotations (env var if secret mode enabled)
  if [ "$USE_SECRET_PASSWORD" = "true" ]; then
    ANNO_PASSWORD_VALUE="%%env_DD_POSTGRES_PASSWORD%%"
  else
    ANNO_PASSWORD_VALUE="${MONITORING_PASSWORD}"
  fi
  # Determine container name from the workload template; default to 'postgres'
  ANNO_CONTAINER_NAME=$(kubectl get -n $NAMESPACE $DEPLOY_KIND/$DEPLOY_NAME -o jsonpath='{.spec.template.spec.containers[0].name}' 2>/dev/null || echo "")
  if [ -z "$ANNO_CONTAINER_NAME" ]; then
    ANNO_CONTAINER_NAME="postgres"
  fi
  kubectl annotate -n $NAMESPACE $DEPLOY_KIND/$DEPLOY_NAME \
    "ad.datadoghq.com/${ANNO_CONTAINER_NAME}.check_names=[\"postgres\"]" \
    "ad.datadoghq.com/${ANNO_CONTAINER_NAME}.init_configs=[{}]" \
    "ad.datadoghq.com/${ANNO_CONTAINER_NAME}.instances=[{\"host\":\"%%host%%\",\"port\":5432,\"username\":\"$DB_USER\",\"password\":\"${ANNO_PASSWORD_VALUE}\",\"dbname\":\"$DB_NAME\",\"dbm\":true,\"ssl\":\"${SSL_MODE}\",\"query_metrics\":{\"enabled\":true},\"query_activity\":{\"enabled\":false},\"query_samples\":{\"enabled\":false}}]" \
    --overwrite || true
  kubectl rollout restart -n $NAMESPACE $DEPLOY_KIND/$DEPLOY_NAME || true
  kubectl -n $NAMESPACE rollout status $DEPLOY_KIND/$DEPLOY_NAME --timeout=300s || true
  # Refresh the Postgres pod reference after rollout
  POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=$PG_LABEL_VALUE --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | awk '{print $NF}')
  if [ -z "$POSTGRES_POD" ]; then
    POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -o name 2>/dev/null | grep -E "postgres|postgresql" | tail -n1 | sed 's#pod/##' || true)
  fi
  if [ -n "$POSTGRES_POD" ]; then
    success "Updated PostgreSQL pod reference: $POSTGRES_POD"
    kubectl wait --for=condition=Ready pod/$POSTGRES_POD -n $NAMESPACE --timeout=300s || warning "PostgreSQL pod not ready after restart"
  else
    warning "Unable to refresh PostgreSQL pod reference after restart"
  fi
else
  warning "Could not determine workload kind/name for annotations; attempting to annotate Pod directly"
  if [ -n "$POSTGRES_POD" ]; then
    if [ "$USE_SECRET_PASSWORD" = "true" ]; then
      ANNO_PASSWORD_VALUE="%%env_DD_POSTGRES_PASSWORD%%"
    else
      ANNO_PASSWORD_VALUE="${MONITORING_PASSWORD}"
    fi
    # Determine the pod's first container name for annotation key
    POD_CONTAINER_NAME=$(kubectl get pod -n $NAMESPACE $POSTGRES_POD -o jsonpath='{.spec.containers[0].name}' 2>/dev/null || echo "postgres")
    kubectl annotate -n $NAMESPACE pod/$POSTGRES_POD \
      "ad.datadoghq.com/${POD_CONTAINER_NAME}.check_names=[\"postgres\"]" \
      "ad.datadoghq.com/${POD_CONTAINER_NAME}.init_configs=[{}]" \
      "ad.datadoghq.com/${POD_CONTAINER_NAME}.instances=[{\"host\":\"%%host%%\",\"port\":5432,\"username\":\"$DB_USER\",\"password\":\"${ANNO_PASSWORD_VALUE}\",\"dbname\":\"$DB_NAME\",\"dbm\":true,\"ssl\":\"${SSL_MODE}\",\"query_metrics\":{\"enabled\":true},\"query_activity\":{\"enabled\":false},\"query_samples\":{\"enabled\":false}}]" \
      --overwrite || true
  fi
fi

# 5. Create/verify pgvector monitoring tables and data
log "5. Setting up pgvector monitoring tables..."

if [ "$PGVECTOR_AVAILABLE" = "1" ]; then
  # Create document_embeddings table if it doesn't exist
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- bash -lc "cat | psql -U '$DB_ADMIN_USER' -d '$DB_NAME'" <<'PSQLSQL'
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    embedding vector(5),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 10);

-- Grant permissions to datadog user
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'datadog') THEN
    GRANT SELECT ON document_embeddings TO datadog;
    GRANT SELECT ON pg_stat_user_tables TO datadog;
    GRANT SELECT ON pg_stat_user_indexes TO datadog;
  END IF;
END;
$$;
PSQLSQL

  success "pgvector tables and indexes created"

  # Ensure required columns and unique index exist on document_embeddings (idempotent)
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- bash -lc "cat | psql -U '$DB_ADMIN_USER' -d '$DB_NAME' -v ON_ERROR_STOP=1" <<'PSQLSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'title') THEN
    ALTER TABLE document_embeddings ADD COLUMN title VARCHAR(500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'content') THEN
    ALTER TABLE document_embeddings ADD COLUMN content TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'embedding') THEN
    -- Default dimension when missing; existing deployments may already have a different dimension.
    ALTER TABLE document_embeddings ADD COLUMN embedding vector(5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'metadata') THEN
    ALTER TABLE document_embeddings ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'created_at') THEN
    ALTER TABLE document_embeddings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_embeddings' AND column_name = 'updated_at') THEN
    ALTER TABLE document_embeddings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
  -- Ensure a unique index on document_id exists for ON CONFLICT to work
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'document_embeddings'
      AND indexname = 'document_embeddings_document_id_idx'
  ) THEN
    CREATE UNIQUE INDEX document_embeddings_document_id_idx ON document_embeddings(document_id);
  END IF;
END $$;
PSQLSQL

  # Insert sample data if table is empty
RECORD_COUNT=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT COUNT(*) FROM document_embeddings;" | tr -d '[:space:]')

if [ "$RECORD_COUNT" = "0" ]; then
    log "Inserting sample vector data for monitoring..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- bash -lc "cat | psql -U '$DB_ADMIN_USER' -d '$DB_NAME' -v ON_ERROR_STOP=1" <<'PSQLSQL'
DO $$
DECLARE
  dim INT;
  vec TEXT;
BEGIN
  -- Determine the embedding vector dimension if present; default to 5
  SELECT atttypmod - 4 INTO dim
  FROM pg_attribute
  WHERE attrelid = 'document_embeddings'::regclass
    AND attname = 'embedding';
  IF dim IS NULL OR dim < 1 THEN
    dim := 5;
  END IF;

  -- Build a vector literal with 'dim' random floats between 0 and 1
  WITH s(i) AS (
    SELECT generate_series(1, dim)
  ),
  v(t) AS (
    SELECT '[' || string_agg((random())::text, ',' ORDER BY i) || ']' FROM s
  )
  SELECT t INTO vec FROM v;

  -- Insert sample rows with a vector of the correct dimension
  INSERT INTO document_embeddings (document_id, content, embedding) VALUES
    ('doc1', 'This is a sample document for testing pgvector monitoring', vec::vector),
    ('doc2', 'Another sample document with vector embeddings', vec::vector),
    ('doc3', 'Third sample document for Datadog monitoring demo', vec::vector)
  ON CONFLICT (document_id) DO NOTHING;
END $$;
PSQLSQL
      success "Sample vector data inserted"
  else
      success "Found $RECORD_COUNT existing records in document_embeddings table"
  fi
else
  warning "Skipping vector table/index setup because pgvector is not available"
  RECORD_COUNT=0
fi

# 6. Check Datadog agent configuration
log "6. Checking Datadog agent configuration for PostgreSQL..."

# Check if PostgreSQL integration is configured
DATADOG_POD=$(kubectl get pods -n $DATADOG_AGENT_NAMESPACE -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -z "$DATADOG_POD" ]; then
    DATADOG_POD=$(kubectl get pods -n $DATADOG_AGENT_NAMESPACE -l app=datadog -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
fi

if [ -n "$DATADOG_POD" ]; then
    success "Found Datadog agent pod: $DATADOG_POD"
    
    # Check PostgreSQL configuration
    log "Checking PostgreSQL integration configuration..."
    if ! kubectl exec -n $DATADOG_AGENT_NAMESPACE $DATADOG_POD -- ls -la /etc/datadog-agent/conf.d/postgres.d/ >/dev/null 2>&1; then
        if [ "$PGVECTOR_AVAILABLE" = "1" ]; then
          warning "PostgreSQL configuration directory missing on agent. It will be created with pgvector support."
        else
          warning "PostgreSQL configuration directory missing on agent. It will be created."
        fi
    fi

    # Optional: store password in a Secret and expose to Datadog Agent as env var
    if [ "$USE_SECRET_PASSWORD" = "true" ]; then
      kubectl -n $DATADOG_AGENT_NAMESPACE create secret generic dd-postgres-creds \
        --from-literal=DD_POSTGRES_PASSWORD="$MONITORING_PASSWORD" \
        --dry-run=client -o yaml | kubectl apply -f -
      if [ -n "$DS_NAME" ]; then
        if ! kubectl -n $DATADOG_AGENT_NAMESPACE set env daemonset/$DS_NAME --from=secret/dd-postgres-creds --keys=DD_POSTGRES_PASSWORD --containers=agent --overwrite >/dev/null 2>&1; then
          warning "Unable to set DD_POSTGRES_PASSWORD env on daemonset/$DS_NAME"
        fi
      else
        warning "Datadog agent daemonset not detected; DD_POSTGRES_PASSWORD env not injected"
      fi
      CONF_PASSWORD_VALUE="%%env_DD_POSTGRES_PASSWORD%%"
    else
      CONF_PASSWORD_VALUE="$MONITORING_PASSWORD"
    fi

    cat <<EOF >/tmp/datadog-postgres-conf.yaml
init_config:

instances:
  - host: ${POSTGRES_SERVICE}.${NAMESPACE}.svc.cluster.local
    port: 5432
    username: ${DB_USER}
    password: "${CONF_PASSWORD_VALUE}"
    dbname: ${DB_NAME}
    ssl: '${SSL_MODE}'
    dbm: true
    query_metrics:
      enabled: true
      run_sync: true
      collection_interval: 10
    query_samples:
      enabled: false
    query_activity:
      enabled: false
    collect_schemas:
      enabled: true
      collection_interval: 600
    collect_activity:
      enabled: true
      collection_interval: 10
    collect_settings:
      enabled: true
      collection_interval: 600
    tags:
      - env:kubernetes
      - service:vibecode
      - database:postgresql
      - vector_db:pgvector
EOF

    kubectl create configmap datadog-postgres-config -n $DATADOG_AGENT_NAMESPACE \
      --from-file=conf.yaml=/tmp/datadog-postgres-conf.yaml \
      --dry-run=client -o yaml | kubectl apply -f -

    success "Datadog PostgreSQL configuration applied"

    TARGET_DAEMONSETS=""
    if [ -n "$DS_NAME" ]; then
      TARGET_DAEMONSETS="$DS_NAME"
    else
      TARGET_DAEMONSETS="datadog-agent datadog"
    fi

    for ds in $TARGET_DAEMONSETS; do
      if kubectl get daemonset "$ds" -n $DATADOG_AGENT_NAMESPACE >/dev/null 2>&1; then
        kubectl rollout restart daemonset/$ds -n $DATADOG_AGENT_NAMESPACE || true
        kubectl rollout status daemonset/$ds -n $DATADOG_AGENT_NAMESPACE --timeout=300s || true
        break
      fi
    done
else
    error "Datadog agent pod not found"
fi

# 7. Test vector search operations to generate metrics
log "7. Testing vector search operations to generate metrics..."

# Refresh pod/container before activity to avoid stale references
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=$PG_LABEL_VALUE --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | awk '{print $NF}')
if [ -z "$POSTGRES_POD" ]; then
  POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -o name 2>/dev/null | grep -E "postgres|postgresql" | tail -n1 | sed 's#pod/##' || true)
fi
if [ -n "$POSTGRES_POD" ]; then
  kubectl wait --for=condition=Ready pod/$POSTGRES_POD -n $NAMESPACE --timeout=240s || warning "PostgreSQL pod not ready for activity"
fi
PG_CONTAINER_NAME=$(kubectl get pod -n $NAMESPACE $POSTGRES_POD -o jsonpath='{.spec.containers[0].name}' 2>/dev/null || echo "$PG_CONTAINER_NAME")
success "Using PostgreSQL pod for activity: $POSTGRES_POD (container: $PG_CONTAINER_NAME)"

# Perform activity to generate metrics
if [ "$PGVECTOR_AVAILABLE" = "1" ]; then
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- bash -lc "cat | psql -U '$DB_ADMIN_USER' -d '$DB_NAME'" <<'PSQLSQL'
-- Perform vector similarity searches to generate metrics
SELECT document_id, embedding <-> '[0.1,0.2,0.3,0.4,0.5]'::vector as distance
FROM document_embeddings 
ORDER BY embedding <-> '[0.1,0.2,0.3,0.4,0.5]'::vector 
LIMIT 3;

SELECT document_id, embedding <=> '[0.2,0.3,0.4,0.5,0.6]'::vector as cosine_distance
FROM document_embeddings 
ORDER BY embedding <=> '[0.2,0.3,0.4,0.5,0.6]'::vector 
LIMIT 3;

-- Generate some index usage statistics
SELECT * FROM pg_stat_user_indexes WHERE relname = 'document_embeddings';
PSQLSQL
else
  kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -c "
  -- Generate general DB activity (non-vector)
  SELECT now();
  SELECT datname FROM pg_database LIMIT 3;
  SELECT schemaname, relname FROM pg_stat_user_tables LIMIT 5;
  "
fi

success "Vector search operations completed"

# 8. Verify metrics collection
log "8. Verifying metrics collection..."

# Check pg_stat_statements for recent queries
if [ "$PGVECTOR_AVAILABLE" = "1" ]; then
  VECTOR_QUERIES=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "
  SELECT COUNT(*) 
  FROM pg_stat_statements 
  WHERE query LIKE '%embedding%' OR query LIKE '%vector%';" 2>/dev/null || echo "0")
  if [ "$VECTOR_QUERIES" != "0" ]; then
      success "Found $VECTOR_QUERIES vector-related queries in pg_stat_statements"
  else
      warning "No vector queries found in pg_stat_statements yet"
  fi
else
  TOTAL_QUERIES=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -c "$PG_CONTAINER_NAME" -- psql -U "$DB_ADMIN_USER" -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_stat_statements;" 2>/dev/null || echo "0")
  if [ "$TOTAL_QUERIES" != "0" ]; then
      success "Found $TOTAL_QUERIES statements tracked in pg_stat_statements"
  else
      warning "No statements found in pg_stat_statements yet"
  fi
fi

# 9. Check Datadog agent logs for PostgreSQL integration
log "9. Checking Datadog agent logs..."

if [ -n "$DATADOG_POD" ]; then
    log "Recent Datadog agent logs (PostgreSQL integration):"
    kubectl logs -n $DATADOG_AGENT_NAMESPACE $DATADOG_POD --tail=20 | grep -i postgres || true
    
    log "Checking for DBM-specific logs:"
    kubectl logs -n $DATADOG_AGENT_NAMESPACE $DATADOG_POD --tail=50 | grep -i "dbm\|database monitoring" || true
fi

# 10. Display connection information for manual verification
log "10. Connection information for manual verification..."

echo ""
echo "📋 Manual Verification Steps:"
echo "=============================="
echo ""
echo "1. PostgreSQL Connection:"
echo "   Host: ${POSTGRES_SERVICE}.$NAMESPACE.svc.cluster.local"
echo "   Port: 5432"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
if [ "$USE_SECRET_PASSWORD" = "true" ]; then
  echo "   Password: [from Secret/env: DD_POSTGRES_PASSWORD]"
else
  echo "   Password: ${MONITORING_PASSWORD}"
fi
echo ""
echo "2. Test vector queries:"
echo "   kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM document_embeddings;\""
echo ""
echo "3. Check Datadog Dashboard:"
echo "   - Go to Datadog → Database Monitoring"
echo "   - Look for host: ${POSTGRES_SERVICE}.$NAMESPACE.svc.cluster.local"
echo "   - Check for custom metrics: postgresql.pgvector.*"
echo ""
echo "4. Expected Datadog Metrics:"
echo "   - postgresql.pgvector.vector_count"
echo "   - postgresql.pgvector.table_size" 
echo "   - postgresql.pgvector.index.tuples_read"
echo "   - postgresql.pgvector.index.tuples_fetched"
echo "   - postgresql.pgvector.index.index_size"
echo ""

# 11. Create a monitoring dashboard configuration
log "11. Creating Datadog dashboard configuration..."

cat > /tmp/datadog-pgvector-dashboard.json << EOF
{
  "title": "PostgreSQL pgvector Monitoring - VibeCode",
  "description": "Comprehensive monitoring for pgvector operations on PostgreSQL",
  "widgets": [
    {
      "id": 0,
      "definition": {
        "title": "Vector Embeddings Count",
        "type": "query_value",
        "requests": [
          {
            "q": "avg:postgresql.pgvector.vector_count{service:vibecode}",
            "aggregator": "avg"
          }
        ],
        "precision": 0
      }
    },
    {
      "id": 1,
      "definition": {
        "title": "Vector Table Size",
        "type": "query_value",
        "requests": [
          {
            "q": "avg:postgresql.pgvector.table_size{service:vibecode}",
            "aggregator": "avg"
          }
        ],
        "precision": 0
      }
    },
    {
      "id": 2,
      "definition": {
        "title": "Vector Index Performance",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:postgresql.pgvector.index.tuples_read{service:vibecode}",
            "display_type": "line"
          },
          {
            "q": "avg:postgresql.pgvector.index.tuples_fetched{service:vibecode}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "id": 3,
      "definition": {
        "title": "Database Connections",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:postgresql.connections{host:${POSTGRES_SERVICE}.${NAMESPACE}.svc.cluster.local}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "id": 4,
      "definition": {
        "title": "Query Performance",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:postgresql.query_duration{host:${POSTGRES_SERVICE}.${NAMESPACE}.svc.cluster.local}",
            "display_type": "line"
          }
        ]
      }
    }
  ],
  "template_variables": [
    {
      "name": "service",
      "default": "vibecode",
      "prefix": "service"
    }
  ],
  "layout_type": "ordered"
}
EOF

success "Datadog dashboard configuration created at /tmp/datadog-pgvector-dashboard.json"

echo ""
echo "🎉 Datadog DBM verification completed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Wait 5-10 minutes for metrics to appear in Datadog"
echo "2. Check Datadog → Database Monitoring for your PostgreSQL instance"
echo "3. Import the dashboard configuration from /tmp/datadog-pgvector-dashboard.json"
echo "4. Run vector search operations to generate more metrics"
echo ""
echo "If you don't see data in Datadog:"
echo "1. Check DD_API_KEY is set correctly in Datadog agent"
echo "2. Verify network connectivity from cluster to Datadog"
echo "3. Check Datadog agent logs for errors"
echo ""

# Final status
if [ "$PGVECTOR_AVAILABLE" = "1" ]; then
  if [ "${VECTOR_QUERIES:-0}" != "0" ] && [ "${RECORD_COUNT:-0}" != "0" ]; then
      success "✅ pgvector monitoring setup appears successful!"
      echo "   - PostgreSQL with pgvector: ✅"
      echo "   - Sample vector data: ✅ ($RECORD_COUNT records)"
      echo "   - Datadog agent: ✅"
      echo "   - Vector queries tracked: ✅ ($VECTOR_QUERIES queries)"
  else
      warning "⚠️ Setup completed but may need time to generate pgvector metrics"
  fi
else
  if [ "${TOTAL_QUERIES:-0}" != "0" ]; then
      success "✅ DBM baseline active without pgvector (statements tracked: $TOTAL_QUERIES). Consider upgrading Postgres image to include pgvector."
  else
      warning "⚠️ Setup completed but may need time to generate metrics"
  fi
fi
