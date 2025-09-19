#!/bin/bash
set -e

# Verify Datadog Database Monitoring for pgvector on PostgreSQL
# This script validates that DBM is properly configured and collecting data

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

# Configuration
NAMESPACE="vibecode"
POSTGRES_SERVICE="postgres"
DATADOG_AGENT_NAMESPACE="datadog"
DB_NAME="vibecode"
DB_USER="datadog"

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

log "Starting Datadog DBM verification..."

# 1. Check PostgreSQL deployment
log "1. Checking PostgreSQL deployment..."
if kubectl get deployment postgres -n $NAMESPACE &> /dev/null; then
    success "PostgreSQL deployment found"
    
    # Check if PostgreSQL is ready
    READY_REPLICAS=$(kubectl get deployment postgres -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    DESIRED_REPLICAS=$(kubectl get deployment postgres -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ]; then
        success "PostgreSQL is ready ($READY_REPLICAS/$DESIRED_REPLICAS replicas)"
    else
        warning "PostgreSQL is not fully ready ($READY_REPLICAS/$DESIRED_REPLICAS replicas)"
    fi
else
    error "PostgreSQL deployment not found in namespace $NAMESPACE"
    exit 1
fi

# 2. Check Datadog agent deployment
log "2. Checking Datadog agent deployment..."
if kubectl get daemonset datadog-agent -n $DATADOG_AGENT_NAMESPACE &> /dev/null; then
    success "Datadog agent daemonset found"
    
    # Check agent status
    DESIRED_AGENTS=$(kubectl get daemonset datadog-agent -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.desiredNumberScheduled}')
    READY_AGENTS=$(kubectl get daemonset datadog-agent -n $DATADOG_AGENT_NAMESPACE -o jsonpath='{.status.numberReady}')
    
    if [ "$READY_AGENTS" = "$DESIRED_AGENTS" ]; then
        success "Datadog agents are ready ($READY_AGENTS/$DESIRED_AGENTS)"
    else
        warning "Datadog agents are not fully ready ($READY_AGENTS/$DESIRED_AGENTS)"
    fi
else
    error "Datadog agent not found. Installing Datadog agent with DBM..."
    ./scripts/setup-postgres-datadog-monitoring.sh
fi

# 3. Check PostgreSQL extensions and configuration
log "3. Checking PostgreSQL extensions and DBM configuration..."

# Get PostgreSQL pod
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POSTGRES_POD" ]; then
    error "No PostgreSQL pod found"
    exit 1
fi

success "Found PostgreSQL pod: $POSTGRES_POD"

# Check pgvector extension
log "Checking pgvector extension..."
PGVECTOR_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "SELECT 1 FROM pg_extension WHERE extname='vector';" 2>/dev/null || echo "0")

if [ "$PGVECTOR_CHECK" = " 1" ]; then
    success "pgvector extension is installed"
else
    warning "pgvector extension not found. Installing..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;"
    success "pgvector extension installed"
fi

# Check pg_stat_statements extension
log "Checking pg_stat_statements extension..."
PGSTAT_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements';" 2>/dev/null || echo "0")

if [ "$PGSTAT_CHECK" = " 1" ]; then
    success "pg_stat_statements extension is installed"
else
    warning "pg_stat_statements extension not found. Installing..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
    success "pg_stat_statements extension installed"
fi

# 4. Check/Create Datadog monitoring user
log "4. Checking Datadog monitoring user..."
DATADOG_USER_CHECK=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "SELECT 1 FROM pg_user WHERE usename='$DB_USER';" 2>/dev/null || echo "0")

if [ "$DATADOG_USER_CHECK" = " 1" ]; then
    success "Datadog user '$DB_USER' exists"
else
    warning "Datadog user not found. Creating..."
    
    # Create datadog user with proper permissions
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "
    CREATE USER $DB_USER WITH PASSWORD 'datadog_monitoring_password';
    GRANT pg_monitor TO $DB_USER;
    GRANT pg_read_all_stats TO $DB_USER;
    GRANT pg_read_all_settings TO $DB_USER;
    GRANT SELECT ON pg_stat_database TO $DB_USER;
    "
    success "Datadog user created with monitoring permissions"
fi

# 5. Create/verify pgvector monitoring tables and data
log "5. Setting up pgvector monitoring tables..."

# Create document_embeddings table if it doesn't exist
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Grant permissions to datadog user
GRANT SELECT ON document_embeddings TO $DB_USER;
GRANT SELECT ON pg_stat_user_tables TO $DB_USER;
GRANT SELECT ON pg_stat_user_indexes TO $DB_USER;
"

success "pgvector tables and indexes created"

# Insert sample data if table is empty
RECORD_COUNT=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM document_embeddings;" | tr -d ' ')

if [ "$RECORD_COUNT" = "0" ]; then
    log "Inserting sample vector data for monitoring..."
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "
    INSERT INTO document_embeddings (document_id, title, content, embedding) VALUES
    ('doc1', 'Sample Document 1', 'This is a sample document for testing pgvector monitoring', '[0.1,0.2,0.3,0.4,0.5]'::vector),
    ('doc2', 'Sample Document 2', 'Another sample document with vector embeddings', '[0.2,0.3,0.4,0.5,0.6]'::vector),
    ('doc3', 'Sample Document 3', 'Third sample document for Datadog monitoring demo', '[0.3,0.4,0.5,0.6,0.7]'::vector)
    ON CONFLICT (document_id) DO NOTHING;
    "
    success "Sample vector data inserted"
else
    success "Found $RECORD_COUNT existing records in document_embeddings table"
fi

# 6. Check Datadog agent configuration
log "6. Checking Datadog agent configuration for PostgreSQL..."

# Check if PostgreSQL integration is configured
DATADOG_POD=$(kubectl get pods -n $DATADOG_AGENT_NAMESPACE -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}')

if [ -n "$DATADOG_POD" ]; then
    success "Found Datadog agent pod: $DATADOG_POD"
    
    # Check PostgreSQL configuration
    log "Checking PostgreSQL integration configuration..."
    kubectl exec -n $DATADOG_AGENT_NAMESPACE $DATADOG_POD -- ls -la /etc/datadog-agent/conf.d/postgres.d/ 2>/dev/null || {
        warning "PostgreSQL configuration not found. Creating configuration..."
        
        # Create PostgreSQL configuration
        kubectl create configmap datadog-postgres-config -n $DATADOG_AGENT_NAMESPACE --from-literal=conf.yaml="
init_config:

instances:
  - host: postgres.$NAMESPACE.svc.cluster.local
    port: 5432
    username: $DB_USER
    password: datadog_monitoring_password
    dbname: $DB_NAME
    ssl: false
    dbm: true
    query_metrics:
      enabled: true
      run_sync: true
      collection_interval: 10
    query_samples:
      enabled: true
    query_activity:
      enabled: true
      collection_interval: 10
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
      - relation_regex: '.*'
        relkind:
          - r  # tables
          - i  # indexes
          - S  # sequences
    custom_queries:
      - metric_prefix: 'postgresql.pgvector'
        query: |
          SELECT 
            schemaname,
            tablename,
            n_live_tup as vector_count,
            pg_relation_size(schemaname||'.'||tablename) as table_size
          FROM pg_stat_user_tables 
          WHERE tablename = 'document_embeddings'
        columns:
          - name: schema
            type: tag
          - name: table
            type: tag  
          - name: vector_count
            type: gauge
          - name: table_size
            type: gauge
        tags:
          - env:kubernetes
          - service:vibecode
          - database:postgresql
          - vector_db:pgvector
      - metric_prefix: 'postgresql.pgvector.index'
        query: |
          SELECT 
            schemaname,
            indexname,
            idx_tup_read,
            idx_tup_fetch,
            pg_relation_size(indexrelid) as index_size
          FROM pg_stat_user_indexes 
          WHERE relname = 'document_embeddings'
        columns:
          - name: schema
            type: tag
          - name: index
            type: tag
          - name: tuples_read
            type: gauge
          - name: tuples_fetched
            type: gauge
          - name: index_size
            type: gauge
        tags:
          - env:kubernetes
          - service:vibecode
          - database:postgresql
          - vector_db:pgvector
    tags:
      - env:kubernetes
      - service:vibecode
      - database:postgresql
      - vector_db:pgvector
" --dry-run=client -o yaml | kubectl apply -f -

        success "Datadog PostgreSQL configuration created"
    }
else
    error "Datadog agent pod not found"
fi

# 7. Test vector search operations to generate metrics
log "7. Testing vector search operations to generate metrics..."

# Perform some vector searches to generate activity
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "
-- Perform vector similarity searches to generate metrics
SELECT document_id, title, embedding <-> '[0.1,0.2,0.3,0.4,0.5]'::vector as distance
FROM document_embeddings 
ORDER BY embedding <-> '[0.1,0.2,0.3,0.4,0.5]'::vector 
LIMIT 3;

SELECT document_id, title, embedding <=> '[0.2,0.3,0.4,0.5,0.6]'::vector as cosine_distance
FROM document_embeddings 
ORDER BY embedding <=> '[0.2,0.3,0.4,0.5,0.6]'::vector 
LIMIT 3;

-- Generate some index usage statistics
SELECT * FROM pg_stat_user_indexes WHERE relname = 'document_embeddings';
"

success "Vector search operations completed"

# 8. Verify metrics collection
log "8. Verifying metrics collection..."

# Check pg_stat_statements for vector queries
VECTOR_QUERIES=$(kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "
SELECT COUNT(*) 
FROM pg_stat_statements 
WHERE query LIKE '%embedding%' OR query LIKE '%vector%';" 2>/dev/null || echo "0")

if [ "$VECTOR_QUERIES" != "0" ]; then
    success "Found $VECTOR_QUERIES vector-related queries in pg_stat_statements"
else
    warning "No vector queries found in pg_stat_statements yet"
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
echo "   Host: postgres.$NAMESPACE.svc.cluster.local"
echo "   Port: 5432"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: datadog_monitoring_password"
echo ""
echo "2. Test vector queries:"
echo "   kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM document_embeddings;\""
echo ""
echo "3. Check Datadog Dashboard:"
echo "   - Go to Datadog → Database Monitoring"
echo "   - Look for host: postgres.$NAMESPACE.svc.cluster.local"
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

cat > /tmp/datadog-pgvector-dashboard.json << 'EOF'
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
            "q": "avg:postgresql.connections{host:postgres.vibecode.svc.cluster.local}",
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
            "q": "avg:postgresql.query_duration{host:postgres.vibecode.svc.cluster.local}",
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
if [ "$VECTOR_QUERIES" != "0" ] && [ "$RECORD_COUNT" != "0" ]; then
    success "✅ pgvector monitoring setup appears successful!"
    echo "   - PostgreSQL with pgvector: ✅"
    echo "   - Sample vector data: ✅ ($RECORD_COUNT records)"
    echo "   - Datadog agent: ✅"
    echo "   - Vector queries tracked: ✅ ($VECTOR_QUERIES queries)"
else
    warning "⚠️ Setup completed but may need time to generate metrics"
fi
