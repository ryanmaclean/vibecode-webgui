#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL 16 + pgvector setup for AKS
# Creates production-ready PostgreSQL with Azure Disk storage and Datadog monitoring

NAMESPACE=${NAMESPACE:-vibecode-platform}
STORAGE_CLASS=${STORAGE_CLASS:-managed-csi}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}
DATADOG_PASSWORD=${DATADOG_PASSWORD:-$(openssl rand -base64 16)}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

ensure_postgresql_aks() {
  log "deploying PostgreSQL 16 + pgvector for AKS"
  
  # Create PostgreSQL namespace if different from main namespace
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  
  # Create PostgreSQL configuration with pgvector
  create_postgresql_aks_manifests
  
  log "applying PostgreSQL StatefulSet with Azure Disk storage"
  kubectl apply -f k8s/postgresql-aks-statefulset.yaml
  
  log "waiting for PostgreSQL to be ready"
  kubectl -n "$NAMESPACE" rollout status statefulset/postgresql --timeout=600s
  kubectl -n "$NAMESPACE" wait --for=condition=Ready pod -l app=postgresql --timeout=600s
  
  # Verify pgvector extension
  verify_pgvector_extension
  
  log "PostgreSQL 16 + pgvector deployment complete"
}

create_postgresql_aks_manifests() {
  log "creating PostgreSQL manifests for AKS with Azure Disk storage"
  
  mkdir -p k8s
  
  # PostgreSQL StatefulSet with Azure Disk PVC
  cat > k8s/postgresql-aks-statefulset.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgresql-secret
  namespace: $NAMESPACE
type: Opaque
stringData:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: $POSTGRES_PASSWORD
  POSTGRES_DB: vibecode
  # Datadog monitoring user
  DATADOG_USER: datadog
  DATADOG_PASSWORD: $DATADOG_PASSWORD
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgresql-init
  namespace: $NAMESPACE
data:
  init.sql: |
    -- Create pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    
    -- Create datadog monitoring user
    CREATE USER datadog WITH PASSWORD '$DATADOG_PASSWORD';
    GRANT pg_monitor TO datadog;
    GRANT pg_read_all_stats TO datadog;
    GRANT pg_read_all_settings TO datadog;
    GRANT SELECT ON pg_stat_database TO datadog;
    
    -- Create application schema
    CREATE SCHEMA IF NOT EXISTS app;
    GRANT USAGE ON SCHEMA app TO datadog;
    
    -- Create vector embeddings table
    CREATE TABLE IF NOT EXISTS app.document_embeddings (
      id SERIAL PRIMARY KEY,
      document_id VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(500),
      content TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create vector index
    CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
    ON app.document_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
    
    -- Grant permissions to datadog user
    GRANT SELECT ON app.document_embeddings TO datadog;
    
  postgresql.conf: |
    # PostgreSQL configuration optimized for pgvector
    shared_preload_libraries = 'pg_stat_statements,vector'
    
    # Memory settings
    shared_buffers = 256MB
    work_mem = 64MB
    maintenance_work_mem = 128MB
    
    # Vector-specific settings
    max_wal_size = 2GB
    checkpoint_completion_target = 0.9
    
    # Connection settings
    max_connections = 100
    
    # Logging for Datadog
    log_statement = 'all'
    log_min_duration_statement = 1000
    log_checkpoints = on
    log_connections = on
    log_disconnections = on
    log_lock_waits = on
    
    # Performance
    effective_cache_size = 1GB
    random_page_cost = 1.1
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: $NAMESPACE
  labels:
    app: postgresql
    version: "16"
    component: database
spec:
  serviceName: postgresql
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
        version: "16"
        component: database
      annotations:
        ad.datadoghq.com/postgresql.check_names: |
          ["postgres"]
        ad.datadoghq.com/postgresql.init_configs: |
          [{}]
        ad.datadoghq.com/postgresql.instances: |
          [{
            "host": "%%host%%",
            "port": 5432,
            "username": "datadog",
            "password": "$DATADOG_PASSWORD",
            "dbname": "vibecode",
            "dbm": true,
            "collect_schemas": {"enabled": true, "collection_interval": 600},
            "collect_activity": {"enabled": true, "collection_interval": 10},
            "collect_settings": {"enabled": true, "collection_interval": 600},
            "relations": [{"relation_regex": ".*", "relkind": ["r", "i", "S"]}],
            "custom_queries": [{
              "metric_prefix": "postgresql.pgvector",
              "query": "SELECT schemaname, tablename, n_live_tup as vector_count FROM pg_stat_user_tables WHERE tablename = 'document_embeddings'",
              "columns": [
                {"name": "schema", "type": "tag"},
                {"name": "table", "type": "tag"},
                {"name": "vector_count", "type": "gauge"}
              ],
              "tags": ["env:production", "provider:aks", "database:postgresql", "extension:pgvector"]
            }],
            "tags": ["env:production", "provider:aks"]
          }]
    spec:
      containers:
      - name: postgresql
        image: pgvector/pgvector:pg16
        ports:
        - containerPort: 5432
          name: postgresql
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: POSTGRES_DB
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgresql-storage
          mountPath: /var/lib/postgresql/data
        - name: postgresql-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        - name: postgresql-init
          mountPath: /docker-entrypoint-initdb.d/init.sql
          subPath: init.sql
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgresql-config
        configMap:
          name: postgresql-init
      - name: postgresql-init
        configMap:
          name: postgresql-init
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
      - key: kubernetes.azure.com/scalesetpriority
        operator: Equal
        value: spot
        effect: NoSchedule
  volumeClaimTemplates:
  - metadata:
      name: postgresql-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: $STORAGE_CLASS
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgresql
  namespace: $NAMESPACE
  labels:
    app: postgresql
spec:
  ports:
  - port: 5432
    targetPort: 5432
    name: postgresql
  selector:
    app: postgresql
  type: ClusterIP
EOF
  
  log "PostgreSQL StatefulSet manifest created"
}

verify_pgvector_extension() {
  log "verifying pgvector extension installation"
  
  # Wait for PostgreSQL to be fully ready
  sleep 30
  
  # Get the PostgreSQL pod name
  local pod_name
  pod_name=$(kubectl -n "$NAMESPACE" get pods -l app=postgresql -o jsonpath='{.items[0].metadata.name}')
  
  if [ -z "$pod_name" ]; then
    error "PostgreSQL pod not found"
  fi
  
  # Test pgvector extension
  local extension_check
  extension_check=$(kubectl -n "$NAMESPACE" exec "$pod_name" -- psql -U postgres -d vibecode -t -c "SELECT extname FROM pg_extension WHERE extname='vector';" 2>/dev/null | tr -d ' ' || echo "")
  
  if [ "$extension_check" = "vector" ]; then
    log "✅ pgvector extension verified successfully"
  else
    error "pgvector extension not found or not working"
  fi
  
  # Test vector operations
  log "testing vector operations"
  kubectl -n "$NAMESPACE" exec "$pod_name" -- psql -U postgres -d vibecode -c "
    INSERT INTO app.document_embeddings (document_id, title, content, embedding) 
    VALUES ('test-1', 'Test Document', 'This is a test document', '[0.1,0.2,0.3]'::vector)
    ON CONFLICT (document_id) DO NOTHING;
    
    SELECT document_id, title, embedding <-> '[0.1,0.2,0.3]'::vector as distance 
    FROM app.document_embeddings 
    WHERE document_id = 'test-1';
  " >/dev/null 2>&1
  
  log "✅ Vector operations test successful"
  
  # Save credentials for other scripts
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > .aks-postgres-credentials
  echo "DATADOG_PASSWORD=$DATADOG_PASSWORD" >> .aks-postgres-credentials
  log "PostgreSQL credentials saved to .aks-postgres-credentials"
}

# Run the setup
ensure_postgresql_aks
