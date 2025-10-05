# API Route Mapping Reference

**Quick reference for route consolidation migration**

## Summary Statistics

- **Current Routes**: 74
- **Proposed Routes**: ~45
- **Reduction**: 40% (29 routes)
- **Deletions**: 2 (test endpoints)
- **Merges**: 15 route consolidations
- **Moves**: 18 route relocations
- **Unchanged**: 10 routes

## Migration Map

### Phase 1: Critical Deletions & Duplicates

#### DELETE - Test Endpoints
| Current Route | Action | Notes |
|--------------|--------|-------|
| `/api/mongodb-test` | **DELETE** | Development only, unsafe in production |
| `/api/test-db` | **DELETE** | Development only, unsafe in production |

#### MERGE - Health Checks
| Current Route | New Route | Migration |
|--------------|-----------|-----------|
| `/api/health` | `/api/health` | Keep as-is (comprehensive) |
| `/api/health/simple` | `/api/health` | Merge into main health |
| `/api/health/db` | `/api/health/components/database` | Standardize naming |
| `/api/health/database` | `/api/health/components/database` | Consolidate with db route |
| `/api/health/database/metrics` | `/api/health/components/database` | Merge metrics into main |
| `/api/health/connection-pool` | `/api/health/components/connections` | Move to components |
| `/api/health/vector-db` | `/api/health/components/vectors` | Standardize naming |
| `/api/health/vector-metrics` | `/api/health/components/vectors` | Merge into vectors |
| `/api/healthz` | `/api/health/live` | K8s liveness probe |
| `/api/readyz` | `/api/health/ready` | K8s readiness probe |

**Result**: 10 routes → 4 routes

#### MERGE - Connection Pool Monitoring
| Current Route | New Route | Migration |
|--------------|-----------|-----------|
| `/api/monitoring/pool` | `/api/monitoring/connections` | Rename for clarity |
| `/api/monitoring/pool-alerts` | `/api/monitoring/connections/alerts` | Nest under connections |
| `/api/monitoring/connection-pool/dashboard` | `/api/monitoring/connections/dashboard` | Consolidate dashboard |
| `/api/health/connection-pool` | `/api/health/components/connections` | Health check separation |

**Result**: 4 routes → 2 routes (plus 1 health component)

### Phase 2: Domain Reorganization

#### AI Domain Consolidation

##### MERGE - Chat Endpoints
| Current Route | New Route | Status |
|--------------|-----------|--------|
| `/api/ai/chat` | `/api/ai/chat` | Keep (standard) |
| `/api/ai/chat/enhanced` | `/api/ai/chat` | Merge features into standard |
| `/api/ai/chat/stream` | `/api/ai/chat/stream` | Keep (streaming) |
| `/api/ai/chat/unified` | `/api/ai/chat` | Redundant, merge into standard |
| `/api/chat/mongodb` | `/api/ai/chat` | Move to AI domain |
| `/api/chat/mongodb-simple` | `/api/ai/chat` | Merge into standard |
| `/api/chat/stream` | `/api/ai/chat/stream` | Consolidate streaming |

**Result**: 7 routes → 2 routes

##### MOVE - AI Operations
| Current Route | New Route | Purpose |
|--------------|-----------|---------|
| `/api/claude/analyze` | `/api/ai/analysis` | Code analysis |
| `/api/claude/generate` | `/api/ai/generation/code` | Code generation |
| `/api/ai/generate-project` | `/api/ai/generation/projects` | Project generation |
| `/api/code-completion` | `/api/ai/completions` | Code completion |
| `/api/ai/search` | `/api/ai/search/semantic` | Semantic search |
| `/api/ai/web-search` | `/api/ai/search/web` | Web search |

##### REORGANIZE - AI Support
| Current Route | New Route | Purpose |
|--------------|-----------|---------|
| `/api/ai/model-selection` | `/api/ai/models/selection` | Model selection |
| `/api/ai/provider-health` | `/api/ai/providers/health` | Provider health |
| `/api/ai/conversations/[workspaceId]` | `/api/ai/conversations/[id]` | Conversation CRUD |
| `/api/ai/litellm` | `/api/integrations/litellm` | External integration |
| `/api/claude/chat` | `/api/ai/chat` | Consolidate chat |
| `/api/claude/session` | `/api/workspaces/sessions` | Move to workspace |

**AI Domain Summary**:
- Before: 16 AI routes + 4 Claude routes + 3 chat routes = 23 routes
- After: 10 AI routes + 1 integration route = 11 routes
- Reduction: 52% (12 routes)

#### Workspace Domain Standardization

| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/workspaces` | `/api/workspaces` | Keep |
| `/api/workspaces/[id]` | `/api/workspaces/[id]` | Keep |
| `/api/workspace/[id]/init-goose` | `/api/workspaces/[id]/migrations` | Rename, standardize |
| `/api/workspace/auto-scaling` | `/api/workspaces/[id]/scaling` | Nest under workspace |
| `/api/code-server/session` | `/api/workspaces/sessions` | Move to workspace domain |
| `/api/code-server/session/[sessionId]` | `/api/workspaces/sessions/[id]` | Standardize ID param |

**Result**: Singular `/workspace` → Plural `/workspaces`, 6 routes → 4 routes

#### Files & Storage Separation

##### Files Domain
| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/files` | `/api/files` | Keep |
| `/api/files/sync` | `/api/files/sync` | Keep |
| `/api/uploads/pdf` | `/api/files/uploads/pdf` | Nest under files |
| `/api/ai/upload` | `/api/files/uploads` | Move from AI domain |

##### Storage Domain (New)
| Current Route | New Route | Purpose |
|--------------|-----------|---------|
| `/api/vector-store` | `/api/storage/vectors` | Vector operations |
| N/A | `/api/storage/embeddings` | Embedding operations |

**Result**: 4 routes → 3 files routes + 2 storage routes

#### Integrations Domain (New)

| Current Route | New Route | Integration |
|--------------|-----------|-------------|
| `/api/ai/huggingface-chat` | `/api/integrations/huggingface/chat` | HuggingFace |
| `/api/ai/huggingface-init` | `/api/integrations/huggingface/init` | HuggingFace |
| `/api/ollama/models` | `/api/integrations/ollama/models` | Ollama |
| `/api/gradio/run` | `/api/integrations/gradio/run` | Gradio |
| `/api/ai/litellm` | `/api/integrations/litellm` | LiteLLM |

**Result**: Scattered 5 routes → Organized 5 routes under `/integrations`

### Phase 3: Monitoring Consolidation

#### Monitoring Domain
| Current Route | New Route | Purpose |
|--------------|-----------|---------|
| `/api/monitoring/metrics` | `/api/monitoring/metrics` | System metrics |
| `/api/monitoring/dashboard` | Keep as separate UI | Dashboard interface |
| `/api/monitoring/performance` | `/api/monitoring/metrics/performance` | Performance metrics |
| `/api/monitoring/cache` | `/api/monitoring/metrics/cache` | Cache metrics |
| `/api/monitoring/security` | `/api/monitoring/security` | Security monitoring |
| `/api/monitoring/traces` | `/api/monitoring/traces` | Distributed tracing |
| `/api/monitoring/otel-config` | `/api/monitoring/traces/config` | OpenTelemetry config |
| `/api/monitoring/rum` | `/api/monitoring/rum` | Real User Monitoring |
| `/api/monitoring/embeddings` | `/api/monitoring/embeddings` | Embedding monitoring |
| `/api/monitoring/azure-embedding` | `/api/monitoring/embeddings/azure` | Azure-specific |

**Result**: 13 routes → 8 routes

### Phase 4: Template & Project Consolidation

| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/projects/template` | `/api/projects/templates` | Standardize plural |
| `/api/templates` | `/api/projects/templates` | Consolidate duplicates |

**Result**: 2 routes → 1 route

### Phase 5: Minor Reorganizations

#### User Management
| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/user/preferences` | `/api/users/[id]/preferences` | Add user ID context |

#### Documentation
| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/docs/search` | `/api/docs/search` | Keep as-is |

#### Experiments
| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/experiments` | `/api/experiments` | Keep as-is |

#### Terminal
| Current Route | New Route | Change |
|--------------|-----------|--------|
| `/api/terminal/session` | `/api/terminal/sessions` | Standardize plural |
| `/api/terminal/ws` | `/api/terminal/ws` | Keep WebSocket route |

## Backward Compatibility Matrix

### No Proxy Needed (Keep as-is)
- `/api/auth/**` - Already well-organized
- `/api/experiments` - Single route, no changes
- `/api/docs/search` - Single route, no changes

### Proxy Required (Deprecated)
All routes marked with 🔄 below require a proxy for backward compatibility during the 8-week deprecation period.

| Category | Routes Requiring Proxy | Deprecation End |
|----------|------------------------|-----------------|
| Health | 8 routes 🔄 | Week 12 |
| AI/Chat | 12 routes 🔄 | Week 12 |
| Workspace | 4 routes 🔄 | Week 12 |
| Files | 2 routes 🔄 | Week 12 |
| Monitoring | 6 routes 🔄 | Week 12 |
| Integrations | 5 routes 🔄 | Week 12 |

### Breaking Changes (K8s Only)
- `/api/healthz` → `/api/health/live` (Update deployment YAML)
- `/api/readyz` → `/api/health/ready` (Update deployment YAML)

## Implementation Checklist

### Week 1: Critical Fixes
- [ ] Delete `/api/mongodb-test`
- [ ] Delete `/api/test-db`
- [ ] Create `/api/health/components/**`
- [ ] Merge health check duplicates
- [ ] Update K8s probes configuration

### Week 2: AI Domain
- [ ] Create `/api/ai/analysis`
- [ ] Create `/api/ai/generation/**`
- [ ] Create `/api/ai/completions`
- [ ] Consolidate chat endpoints
- [ ] Set up proxies for old routes

### Week 3: Workspaces & Files
- [ ] Standardize `/api/workspaces`
- [ ] Move code-server sessions
- [ ] Create `/api/storage/**`
- [ ] Move file uploads
- [ ] Set up proxies

### Week 4: Monitoring & Integrations
- [ ] Consolidate monitoring routes
- [ ] Create `/api/integrations/**`
- [ ] Move provider-specific routes
- [ ] Set up proxies

### Week 5: Polish & Documentation
- [ ] Apply naming conventions
- [ ] Generate OpenAPI spec
- [ ] Update all documentation
- [ ] Final testing

### Weeks 6-12: Deprecation Monitoring
- [ ] Monitor proxy usage metrics
- [ ] Track deprecated endpoint calls
- [ ] Send deprecation notices
- [ ] Support migration

### Week 13+: Cleanup
- [ ] Remove proxy routes
- [ ] Delete old route files
- [ ] Final documentation update
- [ ] Post-mortem

## Quick Reference: New Structure

```
/api/
├── auth/                    # 6 routes (unchanged)
├── ai/                      # 11 routes (was 23)
│   ├── chat/               # 2 routes
│   ├── completions/        # 1 route
│   ├── analysis/           # 1 route
│   ├── generation/         # 2 routes
│   ├── conversations/      # 2 routes
│   ├── models/            # 1 route
│   ├── providers/         # 1 route
│   └── search/            # 2 routes
├── workspaces/            # 4 routes (was 6)
├── files/                 # 3 routes (was 4)
├── storage/               # 2 routes (new)
├── health/                # 4 routes (was 10)
├── monitoring/            # 8 routes (was 13)
├── terminal/              # 2 routes (standardized)
├── projects/              # 2 routes (was 2)
├── users/                 # 1 route (standardized)
├── integrations/          # 5 routes (organized)
├── docs/                  # 1 route (unchanged)
└── experiments/           # 1 route (unchanged)

Total: ~45 routes (was 74)
```

## Frontend Impact Assessment

### High Impact (Update Required)
- **Chat components**: Multiple chat endpoints consolidated
- **Health dashboards**: Endpoint paths changed
- **Workspace management**: Plural standardization
- **File uploads**: New nested structure

### Medium Impact (Proxy Compatible)
- **AI features**: Proxy maintains compatibility
- **Monitoring dashboards**: Gradual migration
- **Integration panels**: Proxy maintains compatibility

### Low Impact (No Changes)
- **Authentication flows**: No changes
- **Documentation search**: No changes
- **Experiments/feature flags**: No changes

## Testing Requirements

### Integration Tests
- [ ] All new routes return expected responses
- [ ] All proxies forward correctly
- [ ] Deprecation headers present
- [ ] Authentication works on all routes

### Contract Tests
- [ ] Response schemas match documentation
- [ ] HTTP status codes correct
- [ ] Error responses consistent

### Performance Tests
- [ ] Proxy latency <100ms
- [ ] No degradation in response times
- [ ] Load testing passes

### Security Tests
- [ ] All routes require authentication
- [ ] Authorization logic correct
- [ ] Input validation works
- [ ] No injection vulnerabilities

## Support Resources

### Documentation
- Full plan: `docs/api/CONSOLIDATION_PLAN.md`
- OpenAPI spec: `docs/api/openapi.yaml` (TBD)
- Migration guide: `docs/api/MIGRATION_GUIDE.md` (TBD)

### Monitoring
- Proxy usage dashboard: TBD
- Deprecation metrics: TBD
- Error tracking: Datadog

### Communication
- Slack channel: `#api-consolidation` (TBD)
- Email updates: Weekly deprecation reports
- Documentation: Updated continuously

---

**Last Updated**: 2025-10-01
**Status**: Ready for implementation
**Owner**: Backend Architecture Team
