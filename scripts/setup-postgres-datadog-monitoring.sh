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
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
        CREATE USER datadog WITH PASSWORD 'datadog_monitoring_password';
    ELSE
        ALTER USER datadog WITH PASSWORD 'datadog_monitoring_password';
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
