#!/usr/bin/env bash
# Deploy PostgreSQL + pgvector with monitoring-ready configuration in Kubernetes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

NAMESPACE=${NAMESPACE:-"vibecode-db"}
RELEASE_NAME=${RELEASE_NAME:-"vector-db"}
POSTGRES_VERSION=${POSTGRES_VERSION:-"15.4.0"}
STORAGE_CLASS=${STORAGE_CLASS:-"standard"}
REPLICAS=${REPLICAS:-3}
VECTOR_EXTENSION_VERSION=${VECTOR_EXTENSION_VERSION:-"0.5.1"}

log_step "Kubernetes PostgreSQL/pgvector Deployment"
log_info "Namespace: ${NAMESPACE}"
log_info "Release name: ${RELEASE_NAME}"
log_info "PostgreSQL version: ${POSTGRES_VERSION}"
log_info "Storage class: ${STORAGE_CLASS}"
log_info "Replicas: ${REPLICAS}"
log_info "pgvector version: ${VECTOR_EXTENSION_VERSION}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command '$1' not available."
    exit 1
  fi
}

require_cmd kubectl
require_cmd helm
require_cmd openssl
require_cmd git

log_step "Ensuring namespace ${NAMESPACE}"
if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  log_info "Namespace ${NAMESPACE} already exists"
else
  kubectl create namespace "$NAMESPACE"
  log_success "Created namespace ${NAMESPACE}"
fi

log_step "Adding/updating Helm repositories"
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo add datadog https://helm.datadoghq.com >/dev/null 2>&1 || true
helm repo update >/dev/null
log_success "Helm repositories refreshed"

VALUES_FILE="${RELEASE_NAME}-values.yaml"
CONFIGMAP_NAME="${RELEASE_NAME}-init-scripts"
SECRET_NAME="${RELEASE_NAME}-credentials"
CREDENTIALS_FILE="${RELEASE_NAME}-credentials.txt"
INIT_DIR="init-scripts"

cleanup() {
  rm -rf "$INIT_DIR"
  rm -f "$VALUES_FILE"
}
trap cleanup EXIT

log_step "Creating initialization scripts ConfigMap"
rm -rf "$INIT_DIR"
mkdir -p "$INIT_DIR"

cat > "$INIT_DIR/init-pgvector.sh" <<'INIT_SH'
#!/usr/bin/env bash
set -e

echo "Installing pgvector extension"
apt-get update
apt-get install -y build-essential postgresql-server-dev-$PG_MAJOR git
cd /tmp
git clone --depth 1 --branch "v$VECTOR_EXTENSION_VERSION" https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
psql <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL
INIT_SH

cat > "$INIT_DIR/setup-test-tables.sql" <<'INIT_SQL'
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    embedding_generation_time_ms INTEGER,
    search_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings USING ivfflat (embedding vector_l2_ops);

CREATE TABLE IF NOT EXISTS connection_routing_test (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    node_name TEXT NOT NULL,
    data JSONB DEFAULT '{}'
);
INIT_SQL

kubectl create configmap "$CONFIGMAP_NAME" \
  --namespace "$NAMESPACE" \
  --from-file="$INIT_DIR" \
  --dry-run=client -o yaml | kubectl apply -f -
log_success "ConfigMap ${CONFIGMAP_NAME} applied"

log_step "Generating PostgreSQL credentials"
POSTGRES_PASSWORD=$(openssl rand -hex 12)
REPLICATION_PASSWORD=$(openssl rand -hex 12)

kubectl create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  --from-literal=postgres-password="$POSTGRES_PASSWORD" \
  --from-literal=replication-password="$REPLICATION_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
log_success "Secret ${SECRET_NAME} applied"

echo "PostgreSQL Credentials (testing only)" > "$CREDENTIALS_FILE"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> "$CREDENTIALS_FILE"
echo "REPLICATION_PASSWORD=${REPLICATION_PASSWORD}" >> "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"
log_warn "Credentials saved locally at ${CREDENTIALS_FILE}. Remove after use."

log_step "Writing Helm values file"
cat > "$VALUES_FILE" <<EOF
architecture: replication
primary:
  initdb:
    scriptsConfigMap: "$CONFIGMAP_NAME"
    user: postgres
  extraEnvVars:
    - name: PG_MAJOR
      value: "${POSTGRES_VERSION%%.*}"
  containerSecurityContext:
    allowPrivilegeEscalation: true
  persistence:
    size: 10Gi
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  service:
    type: ClusterIP
  livenessProbe:
    initialDelaySeconds: 60
    periodSeconds: 20
    failureThreshold: 6
  readinessProbe:
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3

readReplicas:
  replicaCount: $((REPLICAS - 1))
  extraEnvVars:
    - name: PG_MAJOR
      value: "${POSTGRES_VERSION%%.*}"
  persistence:
    size: 10Gi
  resources:
    requests:
      memory: 1Gi
      cpu: 500m

metrics:
  enabled: true
  serviceMonitor:
    enabled: true

volumePermissions:
  enabled: true

global:
  postgresql:
    auth:
      existingSecret: "$SECRET_NAME"
      username: postgres
      database: vibecode
  storageClass: "$STORAGE_CLASS"
EOF

log_success "Values file ${VALUES_FILE} created"

log_step "Installing PostgreSQL via Helm"
helm upgrade --install "$RELEASE_NAME" bitnami/postgresql   --namespace "$NAMESPACE"   --version "$POSTGRES_VERSION"   --values "$VALUES_FILE"   --timeout 10m0s
log_success "Helm release ${RELEASE_NAME} applied"

log_step "Waiting for PostgreSQL pods"
kubectl rollout status statefulset "${RELEASE_NAME}-postgresql" -n "$NAMESPACE" --timeout=5m
log_success "PostgreSQL statefulset ready"

cleanup

log_step "Summary"
log_success "Primary + replicas deployed under namespace ${NAMESPACE}"
log_success "Credentials stored in Secret ${SECRET_NAME}"
log_success "Init scripts packaged in ConfigMap ${CONFIGMAP_NAME}"
log_success "Local credential file: ${CREDENTIALS_FILE}"

log_info "Next steps:"
log_info "  • Remove ${CREDENTIALS_FILE} when no longer needed"
log_info "  • Configure Datadog monitoring: scripts/setup-postgres-datadog-monitoring.sh"
log_info "  • Validate replication: kubectl exec -n ${NAMESPACE} statefulset/${RELEASE_NAME}-postgresql -- psql"

log_success "Kubernetes pgvector deployment complete"
