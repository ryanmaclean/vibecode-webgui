# pgvector Agent Task Distribution

## For OpenCode Agent
```bash
# Task: Implement production Kubernetes manifests
opencode --task "Create production-ready PostgreSQL with pgvector deployment"
```

**Deliverables:**
- `k8s/postgres-production.yaml` with 16-32Gi memory allocation
- `k8s/postgres-tls-config.yaml` for encrypted connections
- `k8s/postgres-network-policy.yaml` for security isolation
- `k8s/postgres-monitoring.yaml` for metrics collection

**Requirements:**
- HNSW index configuration for scale
- Persistent volume claims with NVMe storage class
- Resource limits and requests properly configured
- Health checks and readiness probes

## For Claude Code Agent
```bash
# Task: Implement AI workflow integration
claude-code --integrate "Connect pgvector to existing AI project generation"
```

**Deliverables:**
- `src/lib/vector-search.ts` - Vector similarity search functions
- `src/lib/embedding-generator.ts` - Generate embeddings from code/docs
- `src/app/api/vector-search/route.ts` - API endpoint for semantic search
- Integration with existing `src/app/api/ai/generate-project/route.ts`

**Requirements:**
- Use OpenAI embeddings API for consistency
- Implement hybrid search (vector + metadata)
- Cache frequently accessed embeddings
- Error handling and fallback strategies

## Current Agent (Cascade) Tasks

### 1. Production Infrastructure Setup
```bash
# Create production-ready Helm chart
helm create vibecode-pgvector
```

### 2. Security Implementation
- TLS certificate generation and rotation
- Network policy enforcement
- Secrets management with encryption at rest

### 3. Scale Testing Framework
```sql
-- Generate realistic test data
INSERT INTO embeddings (content_type, embedding, metadata)
SELECT 
    'code',
    (SELECT array_agg(random()) FROM generate_series(1, 1536))::vector,
    jsonb_build_object('language', languages[i % 4 + 1], 'framework', frameworks[i % 3 + 1])
FROM generate_series(1, 100000) i,
     (VALUES (ARRAY['typescript', 'python', 'rust', 'go'])) AS t1(languages),
     (VALUES (ARRAY['react', 'fastapi', 'actix'])) AS t2(frameworks);
```

### 4. Monitoring Integration
- Datadog dashboard for pgvector metrics
- Query performance tracking
- Index health monitoring
- Memory usage alerts

## Coordination Protocol

### Status Updates
- Update `todo.md` when tasks complete
- Use commit messages with `[pgvector]` prefix
- Tag other agents in PR reviews

### Testing Requirements
- All changes must pass existing test suite
- New vector operations require performance benchmarks
- Security changes require penetration testing

### Deployment Strategy
- Blue-green deployment for zero downtime
- Canary releases for performance validation
- Rollback procedures for each component
