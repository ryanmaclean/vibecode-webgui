#!/bin/bash
set -e

## Categories used across generators (global scope for reuse)
categories=("deployment" "kubernetes" "ai-integration" "testing" "security" "monitoring")

# Generate Vector Activity for Datadog DBM Demo
# This script creates realistic pgvector activity to populate Datadog Database Monitoring

echo "🚀 Generating pgvector Activity for Datadog DBM Demo"
echo "=================================================="

# Configuration
NAMESPACE="${NAMESPACE:-vibecode-platform}"
DB_NAME="vibecode"
POSTGRES_POD=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
warning() { echo -e "${YELLOW}⚠️${NC} $1"; }

# Get PostgreSQL pod
get_postgres_pod() {
    # Try both common app labels: app=postgresql then app=postgres
    POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgresql -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -z "$POSTGRES_POD" ]; then
        POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    fi

    if [ -z "$POSTGRES_POD" ]; then
        echo "❌ No PostgreSQL pod found in namespace $NAMESPACE"
        echo "Please ensure PostgreSQL is running: kubectl get pods -n $NAMESPACE"
        echo "Hint: verify labels 'app=postgresql' or 'app=postgres' are set on the Postgres pod"
        exit 1
    fi

    success "Found PostgreSQL pod: $POSTGRES_POD"
}

# Execute SQL command
exec_sql() {
    local sql="$1"
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -c "$sql" 2>/dev/null
}

# Execute SQL query and return result
exec_sql_result() {
    local sql="$1"
    kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d $DB_NAME -t -c "$sql" 2>/dev/null | tr -d ' '
}

# Generate sample documents with embeddings
generate_sample_data() {
    log "Generating sample documentation with vector embeddings..."
    
    exec_sql "
    -- Ensure table exists with proper structure
    CREATE TABLE IF NOT EXISTS document_embeddings (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(500),
        content TEXT NOT NULL,
        category VARCHAR(100),
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for performance monitoring
    CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
    ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

    CREATE INDEX IF NOT EXISTS idx_document_embeddings_category 
    ON document_embeddings(category);

    CREATE INDEX IF NOT EXISTS idx_document_embeddings_created_at 
    ON document_embeddings(created_at);
    "

    # Generate realistic documentation embeddings
    local doc_count=0

    for category in "${categories[@]}"; do
        for i in {1..20}; do
            doc_count=$((doc_count + 1))
            
            # Generate a random-ish embedding vector (1536 dimensions)
            local embedding="["
            for j in {1..1536}; do
                # Generate values between -1 and 1
                local val=$(echo "scale=6; ($RANDOM - 16384) / 16384" | bc -l)
                embedding="${embedding}${val}"
                if [ $j -lt 1536 ]; then
                    embedding="${embedding},"
                fi
            done
            embedding="${embedding}]"

            exec_sql "
            INSERT INTO document_embeddings (document_id, title, content, category, embedding, metadata) 
            VALUES (
                '${category}-doc-${i}',
                '${category^} Documentation ${i}',
                'This is sample documentation content for ${category} topic number ${i}. It contains detailed information about implementing ${category} in the VibeCode platform.',
                '${category}',
                '${embedding}'::vector,
                '{\"source\": \"generated\", \"version\": \"1.0\", \"topic\": \"${category}\"}'::jsonb
            ) ON CONFLICT (document_id) DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP,
                embedding = EXCLUDED.embedding;
            "
            
            if [ $((doc_count % 10)) -eq 0 ]; then
                log "Generated $doc_count documents..."
            fi
        done
    done

    success "Generated $doc_count sample documents with embeddings"
}

# Perform various vector search operations
perform_vector_searches() {
    log "Performing vector search operations to generate DBM activity..."

    # Get a sample of existing embeddings to use as search queries
    local sample_embeddings=($(exec_sql_result "
    SELECT embedding::text 
    FROM document_embeddings 
    ORDER BY RANDOM() 
    LIMIT 5;
    "))

    for i in {1..50}; do
        local search_type=$((i % 4))
        
        case $search_type in
            0) # Cosine similarity search
                exec_sql "
                SELECT document_id, title, category, embedding <=> '[0.1,0.2,0.3]'::vector as cosine_distance
                FROM document_embeddings 
                ORDER BY embedding <=> '[0.1,0.2,0.3]'::vector 
                LIMIT 10;
                " > /dev/null
                ;;
            1) # L2 distance search
                exec_sql "
                SELECT document_id, title, category, embedding <-> '[0.2,0.4,0.1]'::vector as l2_distance
                FROM document_embeddings 
                ORDER BY embedding <-> '[0.2,0.4,0.1]'::vector 
                LIMIT 5;
                " > /dev/null
                ;;
            2) # Category-filtered search
                local category=${categories[$((RANDOM % ${#categories[@]}))]}
                exec_sql "
                SELECT document_id, title, embedding <=> '[0.3,0.1,0.5]'::vector as distance
                FROM document_embeddings 
                WHERE category = '$category'
                ORDER BY embedding <=> '[0.3,0.1,0.5]'::vector 
                LIMIT 8;
                " > /dev/null
                ;;
            3) # Hybrid search (vector + text)
                exec_sql "
                SELECT document_id, title, category,
                       embedding <=> '[0.4,0.2,0.6]'::vector as vector_score,
                       ts_rank_cd(to_tsvector('english', content), plainto_tsquery('deployment')) as text_score
                FROM document_embeddings 
                WHERE to_tsvector('english', content) @@ plainto_tsquery('deployment')
                ORDER BY (embedding <=> '[0.4,0.2,0.6]'::vector) * 0.7 + 
                         (1 - ts_rank_cd(to_tsvector('english', content), plainto_tsquery('deployment'))) * 0.3
                LIMIT 15;
                " > /dev/null
                ;;
        esac
        
        if [ $((i % 10)) -eq 0 ]; then
            log "Completed $i vector searches..."
        fi
        
        # Small delay to create realistic query patterns
        sleep 0.1
    done

    success "Completed 50 vector search operations"
}

# Generate index maintenance activity
generate_index_activity() {
    log "Generating index maintenance activity..."

    # Analyze tables to update statistics
    exec_sql "ANALYZE document_embeddings;"

    # Check index usage statistics
    exec_sql "
    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE relname = 'document_embeddings';
    " > /dev/null

    # Vacuum to generate maintenance activity
    exec_sql "VACUUM ANALYZE document_embeddings;"

    success "Index maintenance completed"
}

# Generate concurrent connections to simulate load
simulate_concurrent_load() {
    log "Simulating concurrent database load..."

    # Create multiple background processes for concurrent queries
    for i in {1..5}; do
        (
            for j in {1..10}; do
                exec_sql "
                SELECT COUNT(*) as total_docs,
                       AVG(array_length(embedding, 1)) as avg_dimensions,
                       COUNT(DISTINCT category) as categories
                FROM document_embeddings;
                " > /dev/null
                
                exec_sql "
                SELECT category, COUNT(*) as doc_count,
                       AVG(pg_column_size(embedding)) as avg_embedding_size
                FROM document_embeddings 
                GROUP BY category;
                " > /dev/null
                
                sleep 0.2
            done
        ) &
    done

    # Wait for background processes
    wait

    success "Concurrent load simulation completed"
}

# Check database metrics that Datadog should be collecting
check_metrics() {
    log "Checking database metrics for Datadog collection..."

    echo ""
    echo "📊 Current Database Metrics:"
    echo "============================"

    # Total documents
    local total_docs=$(exec_sql_result "SELECT COUNT(*) FROM document_embeddings;")
    echo "Total documents: $total_docs"

    # Vector dimensions
    local dimensions=$(exec_sql_result "SELECT array_length(embedding, 1) FROM document_embeddings LIMIT 1;")
    echo "Vector dimensions: $dimensions"

    # Table size
    local table_size=$(exec_sql_result "SELECT pg_size_pretty(pg_total_relation_size('document_embeddings'));")
    echo "Table size: $table_size"

    # Index usage
    echo ""
    echo "Index Usage Statistics:"
    exec_sql "
    SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch,
           pg_size_pretty(pg_relation_size(indexrelid)) as index_size
    FROM pg_stat_user_indexes 
    WHERE relname = 'document_embeddings';
    "

    # Query statistics from pg_stat_statements
    echo ""
    echo "Vector Query Statistics:"
    exec_sql "
    SELECT query, calls, mean_exec_time, rows
    FROM pg_stat_statements 
    WHERE query LIKE '%embedding%' OR query LIKE '%vector%'
    ORDER BY calls DESC 
    LIMIT 5;
    " 2>/dev/null || echo "pg_stat_statements not available"

    echo ""
    success "Metrics check completed"
}

# Main execution
main() {
    log "Starting pgvector activity generation for Datadog DBM..."

    get_postgres_pod
    generate_sample_data
    perform_vector_searches
    generate_index_activity
    simulate_concurrent_load
    check_metrics

    echo ""
    echo "🎉 Vector activity generation completed!"
    echo "======================================"
    echo ""
    echo "📋 What was generated:"
    echo "• 120 sample documents with 1536-dimensional embeddings"
    echo "• 50+ vector similarity searches (cosine, L2, hybrid)"
    echo "• Index maintenance operations (ANALYZE, VACUUM)"
    echo "• Concurrent database load simulation"
    echo "• Vector-specific database statistics"
    echo ""
    echo "🔍 Check Datadog Database Monitoring:"
    echo "1. Go to Datadog → Database Monitoring"
    echo "2. Look for host: postgres.$NAMESPACE.svc.cluster.local"
    echo "3. Check Query Samples for vector operations"
    echo "4. Monitor custom metrics: postgresql.pgvector.*"
    echo ""
    echo "⏱️ Metrics should appear in Datadog within 5-10 minutes"
    echo ""
    echo "🔄 To generate more activity, run this script again:"
    echo "   ./scripts/generate-vector-activity.sh"
}

# Handle script arguments
case "${1:-generate}" in
    "generate")
        main
        ;;
    "check")
        get_postgres_pod
        check_metrics
        ;;
    "search-only")
        get_postgres_pod
        perform_vector_searches
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [generate|check|search-only|help]"
        echo ""
        echo "Commands:"
        echo "  generate     - Generate full vector activity (default)"
        echo "  check        - Check current database metrics"
        echo "  search-only  - Only perform vector searches"
        echo "  help         - Show this help message"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
