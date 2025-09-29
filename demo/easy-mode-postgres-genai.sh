#!/bin/bash
# Easy Mode: PostgreSQL + GenAI Demo
# Simple demonstration of vector search with PostgreSQL and AI

set -e

echo "🚀 Easy Mode: PostgreSQL + GenAI Demo"
echo "====================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() { echo -e "${BLUE}[DEMO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Configuration
DEMO_DB_NAME="vibecode_demo"
DEMO_USER="demo_user"
DEMO_PASSWORD="demo_password_123"

setup_local_postgres() {
    print_step "Setting up local PostgreSQL with pgvector..."
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        print_info "Starting PostgreSQL container directly..."
        
        # Run PostgreSQL with pgvector in Docker
        docker run --name vibecode-demo-postgres \
            -e POSTGRES_DB=$DEMO_DB_NAME \
            -e POSTGRES_USER=$DEMO_USER \
            -e POSTGRES_PASSWORD=$DEMO_PASSWORD \
            -p 15432:5432 \
            -d pgvector/pgvector:pg16
    else
        print_info "Using docker-compose for PostgreSQL..."
        
        # Create temporary docker-compose for demo
        cat > /tmp/demo-docker-compose.yml << EOF
version: '3.8'
services:
  postgres-demo:
    image: pgvector/pgvector:pg16
    container_name: vibecode-demo-postgres
    environment:
      POSTGRES_DB: $DEMO_DB_NAME
      POSTGRES_USER: $DEMO_USER
      POSTGRES_PASSWORD: $DEMO_PASSWORD
    ports:
      - "15432:5432"
    volumes:
      - demo_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $DEMO_USER -d $DEMO_DB_NAME"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  demo_postgres_data:
EOF
        
        docker-compose -f /tmp/demo-docker-compose.yml up -d
    fi
    
    print_info "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Test connection
    until docker exec vibecode-demo-postgres pg_isready -U $DEMO_USER -d $DEMO_DB_NAME; do
        print_info "Waiting for database to be ready..."
        sleep 2
    done
    
    print_success "PostgreSQL with pgvector is running on port 15432"
}

create_demo_schema() {
    print_step "Creating demo schema and sample data..."
    
    # Create the demo schema
    docker exec -i vibecode-demo-postgres psql -U $DEMO_USER -d $DEMO_DB_NAME << 'EOF'
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a simple documents table for demo
CREATE TABLE IF NOT EXISTS demo_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for vector similarity search
CREATE INDEX IF NOT EXISTS demo_documents_embedding_idx 
ON demo_documents USING hnsw (embedding vector_cosine_ops);

-- Insert some sample documents (with mock embeddings)
INSERT INTO demo_documents (title, content, embedding, category) VALUES 
('Introduction to PostgreSQL', 'PostgreSQL is a powerful, open source object-relational database system that uses and extends the SQL language combined with many features that safely store and scale the most complicated data workloads.', 
 array_fill(0.1, ARRAY[1536])::vector, 'database'),

('Vector Databases Explained', 'Vector databases are specialized databases designed to store and query high-dimensional vectors efficiently. They are essential for AI applications that work with embeddings from machine learning models.',
 array_fill(0.2, ARRAY[1536])::vector, 'ai'),

('Building AI Applications', 'Modern AI applications require efficient storage and retrieval of vector embeddings. PostgreSQL with pgvector extension provides a robust solution for vector similarity search.',
 array_fill(0.15, ARRAY[1536])::vector, 'ai'),

('Database Monitoring Best Practices', 'Effective database monitoring involves tracking key metrics like connection counts, query performance, and resource utilization. Tools like Datadog provide comprehensive monitoring solutions.',
 array_fill(0.3, ARRAY[1536])::vector, 'monitoring'),

('Scaling PostgreSQL for Production', 'Production PostgreSQL deployments require careful consideration of connection pooling, replication, backup strategies, and performance optimization.',
 array_fill(0.25, ARRAY[1536])::vector, 'database');

-- Show what we created
\dt
SELECT COUNT(*) as total_documents FROM demo_documents;
SELECT category, COUNT(*) as count FROM demo_documents GROUP BY category;
EOF

    print_success "Demo schema and sample data created"
}

demonstrate_vector_search() {
    print_step "Demonstrating vector similarity search..."
    
    print_info "Performing vector similarity search for 'AI and databases'..."
    
    # Demonstrate vector search (using mock query vector)
    docker exec -i vibecode-demo-postgres psql -U $DEMO_USER -d $DEMO_DB_NAME << 'EOF'
-- Simulate a search query with a mock embedding
-- In real applications, this would be generated from your AI model
WITH query_vector AS (
    SELECT array_fill(0.18, ARRAY[1536])::vector as embedding
)
SELECT 
    title,
    content,
    category,
    1 - (demo_documents.embedding <=> query_vector.embedding) as similarity_score
FROM demo_documents, query_vector
ORDER BY demo_documents.embedding <=> query_vector.embedding
LIMIT 3;
EOF

    print_success "Vector similarity search completed"
}

show_monitoring_queries() {
    print_step "Demonstrating monitoring and observability queries..."
    
    print_info "Database performance and monitoring queries:"
    
    docker exec -i vibecode-demo-postgres psql -U $DEMO_USER -d $DEMO_DB_NAME << 'EOF'
-- Database connection information
SELECT 
    datname as database,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back
FROM pg_stat_database 
WHERE datname = 'vibecode_demo';

-- Table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE tablename = 'demo_documents';

-- Index usage statistics
SELECT 
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE relname = 'demo_documents';

-- Show vector index details
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'demo_documents' AND indexname LIKE '%embedding%';
EOF

    print_success "Monitoring queries demonstrated"
}

simulate_genai_workflow() {
    print_step "Simulating a complete GenAI workflow..."
    
    print_info "1. Document ingestion with embedding generation (simulated)"
    print_info "2. Vector similarity search"
    print_info "3. Result ranking and retrieval"
    
    docker exec -i vibecode-demo-postgres psql -U $DEMO_USER -d $DEMO_DB_NAME << 'EOF'
-- Simulate adding a new document (in real app, embedding would come from AI model)
INSERT INTO demo_documents (title, content, embedding, category) VALUES (
    'Real-time Collaboration in AI Apps',
    'Real-time collaboration features in AI applications enable multiple users to work together on AI-powered documents and projects simultaneously.',
    array_fill(0.22, ARRAY[1536])::vector,
    'collaboration'
);

-- Simulate a RAG (Retrieval-Augmented Generation) query
-- This would typically be used to find relevant context for an AI model
WITH user_query AS (
    SELECT array_fill(0.21, ARRAY[1536])::vector as query_embedding
),
relevant_docs AS (
    SELECT 
        title,
        content,
        1 - (embedding <=> query_embedding) as relevance_score
    FROM demo_documents, user_query
    ORDER BY embedding <=> query_embedding
    LIMIT 3
)
SELECT 
    'Top relevant documents for GenAI context:' as info,
    title,
    LEFT(content, 100) || '...' as content_preview,
    ROUND(relevance_score::numeric, 3) as relevance
FROM relevant_docs;
EOF

    print_success "GenAI workflow simulation completed"
}

show_production_considerations() {
    print_step "Production considerations and friction points..."
    
    cat << 'EOF'

📊 PRODUCTION DEPLOYMENT CONSIDERATIONS:

✅ What's Working Well:
• pgvector extension provides efficient vector operations
• HNSW indexing offers good performance for similarity search
• PostgreSQL's ACID properties ensure data consistency
• Standard SQL interface makes integration straightforward

⚠️  Common Friction Points:

1. EMBEDDING DIMENSION MANAGEMENT
   • Problem: Changing embedding dimensions requires index recreation
   • Solution: Plan embedding dimensions carefully, use migration scripts

2. INDEX TUNING
   • Problem: HNSW parameters (m, ef_construction) need optimization per dataset
   • Solution: Test with your data size and query patterns

3. MEMORY REQUIREMENTS
   • Problem: Vector indexes can consume significant memory
   • Solution: Monitor memory usage, consider read replicas for scaling

4. BACKUP AND RECOVERY
   • Problem: Large vector datasets affect backup/restore times
   • Solution: Use pg_basebackup, consider incremental backups

5. MONITORING BLIND SPOTS
   • Problem: Standard PostgreSQL monitoring may miss vector-specific metrics
   • Solution: Custom metrics for vector operations, index size tracking

🔧 PRODUCTION DEPLOYMENT CHECKLIST:

□ Test embedding model consistency across environments
□ Configure appropriate connection pooling (pgBouncer)
□ Set up monitoring for vector index performance
□ Plan for index rebuild procedures
□ Test backup/restore procedures with vector data
□ Configure appropriate work_mem for vector operations
□ Monitor disk space growth from vector indexes

EOF

    print_info "See docs/postgres-vector-troubleshooting.md for detailed solutions"
}

cleanup_demo() {
    print_step "Cleaning up demo resources..."
    
    # Stop and remove containers
    docker stop vibecode-demo-postgres >/dev/null 2>&1 || true
    docker rm vibecode-demo-postgres >/dev/null 2>&1 || true
    
    # Clean up docker-compose if used
    if [ -f "/tmp/demo-docker-compose.yml" ]; then
        docker-compose -f /tmp/demo-docker-compose.yml down -v >/dev/null 2>&1 || true
        rm /tmp/demo-docker-compose.yml
    fi
    
    print_success "Demo cleanup completed"
}

show_next_steps() {
    print_step "Next Steps and Advanced Features..."
    
    cat << 'EOF'

🚀 NEXT STEPS FOR PRODUCTION:

1. AZURE DEPLOYMENT:
   • Use ARM template: ./infrastructure/arm/azuredeploy.json
   • Deploy with: az deployment group create --template-file azuredeploy.json
   • Configure managed identity authentication

2. REAL AI INTEGRATION:
   • Replace mock embeddings with OpenAI/Azure OpenAI embeddings
   • Set up proper embedding generation pipeline
   • Configure OpenRouter for multiple AI model access

3. MONITORING SETUP:
   • Deploy Datadog agent with PostgreSQL integration
   • Configure custom dashboards for vector operations
   • Set up alerts for performance degradation

4. SCALING CONSIDERATIONS:
   • Set up read replicas for query scaling
   • Configure connection pooling
   • Implement proper caching strategies

📚 LEARNING RESOURCES:
   • PostgreSQL + pgvector documentation
   • Azure PostgreSQL Flexible Server docs
   • Datadog PostgreSQL monitoring guide
   • Vector database performance tuning guide

🔧 DEVELOPMENT TOOLS:
   • Local KIND cluster: ./scripts/kind-datadog-core.sh
   • Full test suite: npm test
   • Production build: ./scripts/build-production.sh

EOF
}

# Main demo execution
main() {
    case "${1:-demo}" in
        "setup")
            setup_local_postgres
            create_demo_schema
            ;;
        "search")
            demonstrate_vector_search
            ;;
        "monitor")
            show_monitoring_queries
            ;;
        "genai")
            simulate_genai_workflow
            ;;
        "production")
            show_production_considerations
            ;;
        "cleanup")
            cleanup_demo
            ;;
        "demo"|"")
            # Run full demo
            setup_local_postgres
            create_demo_schema
            demonstrate_vector_search
            show_monitoring_queries
            simulate_genai_workflow
            show_production_considerations
            show_next_steps
            
            echo ""
            print_info "Demo completed! Database is running on port 15432"
            print_info "Run '$0 cleanup' to remove demo resources"
            ;;
        "help"|"-h"|"--help")
            echo "Easy Mode PostgreSQL + GenAI Demo"
            echo "================================="
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  demo (default)  - Run complete demo"
            echo "  setup          - Setup PostgreSQL and schema only"
            echo "  search         - Demonstrate vector search"
            echo "  monitor        - Show monitoring queries"
            echo "  genai          - Simulate GenAI workflow"
            echo "  production     - Show production considerations"
            echo "  cleanup        - Remove demo resources"
            echo "  help           - Show this help"
            exit 0
            ;;
        *)
            echo "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"