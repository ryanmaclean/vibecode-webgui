# API Route Consolidation Plan

**Status**: Planning Phase
**Issue**: #499
**Priority**: HIGH
**Date**: 2025-10-01
**Total Routes**: 74

## Executive Summary

The VibeCode WebGUI API layer has grown to 74 routes with inconsistent naming conventions, scattered organization, and functional overlap. This consolidation plan proposes a systematic reorganization to improve maintainability, reduce technical debt, and establish clear REST conventions.

## Current State Analysis

### Route Inventory by Domain

#### AI Domain (16 routes)
```
/api/ai/chat/route.ts                          - Standard chat endpoint
/api/ai/chat/enhanced/route.ts                 - Enhanced chat features
/api/ai/chat/stream/route.ts                   - Streaming chat (OpenRouter)
/api/ai/chat/unified/route.ts                  - Unified chat interface
/api/ai/conversations/[workspaceId]/route.ts   - Conversation management
/api/ai/function-call/route.ts                 - Function calling support
/api/ai/generate-project/route.ts              - Project generation
/api/ai/huggingface-chat/route.ts             - HuggingFace integration
/api/ai/huggingface-init/route.ts             - HuggingFace initialization
/api/ai/litellm/route.ts                       - LiteLLM proxy
/api/ai/management/route.ts                    - AI service management
/api/ai/model-selection/route.ts               - Model selection logic
/api/ai/provider-health/route.ts               - Provider health checks
/api/ai/search/route.ts                        - AI-powered search
/api/ai/upload/route.ts                        - File upload for AI context
/api/ai/web-search/route.ts                    - Web search integration
```

**Issues**:
- Multiple overlapping chat endpoints (chat, enhanced, stream, unified)
- Inconsistent verb usage (generate-project vs model-selection)
- Mixed concerns (upload in AI domain vs dedicated uploads domain)

#### Chat Domain (3 routes)
```
/api/chat/mongodb/route.ts                     - MongoDB persistence
/api/chat/mongodb-simple/route.ts              - Simplified MongoDB chat
/api/chat/stream/route.ts                      - Streaming chat (MongoDB)
```

**Issues**:
- Duplicates AI chat functionality
- Unclear distinction from /api/ai/chat/*
- Should be consolidated into AI domain or clarified

#### Authentication (6 routes)
```
/api/auth/[...nextauth]/route.ts              - NextAuth handler
/api/auth/login-tracking/route.ts             - Login event tracking
/api/auth/mfa/setup/route.ts                  - MFA setup
/api/auth/mfa/verify/route.ts                 - MFA verification
/api/auth/saml/metadata/route.ts              - SAML metadata
/api/auth/saml/sso/route.ts                   - SAML SSO handler
```

**Status**: Well-organized, follows REST conventions

#### Health & Monitoring (18 routes)
```
/api/health/route.ts                           - Main health check
/api/health/simple/route.ts                    - Simple health check
/api/health/db/route.ts                        - Database health
/api/health/database/route.ts                  - Database health (duplicate)
/api/health/database/metrics/route.ts          - Database metrics
/api/health/connection-pool/route.ts           - Connection pool health
/api/health/vector-db/route.ts                 - Vector DB health
/api/health/vector-metrics/route.ts            - Vector metrics
/api/healthz/route.ts                          - Kubernetes liveness probe
/api/readyz/route.ts                           - Kubernetes readiness probe

/api/monitoring/metrics/route.ts               - System metrics
/api/monitoring/dashboard/route.ts             - Monitoring dashboard
/api/monitoring/performance/route.ts           - Performance metrics
/api/monitoring/pool/route.ts                  - Connection pool monitoring
/api/monitoring/pool-alerts/route.ts           - Pool alerts
/api/monitoring/connection-pool/dashboard/route.ts - Pool dashboard
/api/monitoring/azure-embedding/route.ts       - Azure embedding monitoring
/api/monitoring/embeddings/route.ts            - Embeddings monitoring
/api/monitoring/cache/route.ts                 - Cache monitoring
/api/monitoring/security/route.ts              - Security monitoring
/api/monitoring/traces/route.ts                - Distributed tracing
/api/monitoring/otel-config/route.ts           - OpenTelemetry config
/api/monitoring/rum/route.ts                   - Real User Monitoring
```

**Critical Issues**:
- Severe duplication: health/db vs health/database
- Confusion: health vs healthz vs readyz
- Pool monitoring scattered across 3 locations
- Unclear boundaries between health checks and monitoring metrics

#### Workspace Management (4 routes)
```
/api/workspaces/route.ts                       - List/create workspaces
/api/workspaces/[id]/route.ts                  - Workspace operations
/api/workspace/[id]/init-goose/route.ts        - Goose initialization
/api/workspace/auto-scaling/route.ts           - Auto-scaling config
```

**Issues**:
- Inconsistent plural/singular: /workspaces vs /workspace
- Specialized operations mixed with CRUD

#### Code Server (3 routes)
```
/api/code-server/session/route.ts             - Session management
/api/code-server/session/[sessionId]/route.ts - Specific session
/api/claude/session/route.ts                  - Claude session (misplaced?)
```

**Issues**:
- Claude session route should be in /api/claude, not floating

#### Claude Integration (4 routes)
```
/api/claude/analyze/route.ts                   - Code analysis
/api/claude/chat/route.ts                      - Claude chat
/api/claude/generate/route.ts                  - Code generation
/api/claude/session/route.ts                   - Session management
```

**Status**: Well-organized but overlaps with AI domain

#### Files & Storage (4 routes)
```
/api/files/route.ts                            - File operations
/api/files/sync/route.ts                       - File synchronization
/api/uploads/pdf/route.ts                      - PDF uploads
/api/vector-store/route.ts                     - Vector store operations
```

**Issues**:
- Uploads should be under files
- Vector-store is data operation, not file operation

#### Miscellaneous (16 routes)
```
/api/code-completion/route.ts                  - Code completion
/api/docs/search/route.ts                      - Documentation search
/api/experiments/route.ts                      - Feature flags/experiments
/api/gradio/run/route.ts                       - Gradio app execution
/api/mongodb-test/route.ts                     - Test endpoint (should be removed)
/api/ollama/models/route.ts                    - Ollama model management
/api/projects/template/route.ts                - Project templates
/api/templates/route.ts                        - Template management (duplicate)
/api/terminal/session/route.ts                 - Terminal session
/api/terminal/ws/route.ts                      - Terminal WebSocket
/api/test-db/route.ts                          - Test endpoint (should be removed)
/api/user/preferences/route.ts                 - User preferences
```

**Issues**:
- Test endpoints in production code
- Duplicate template routes
- No clear organization

## Key Problems Identified

### 1. Naming Inconsistencies
- **Plural vs Singular**: `/workspace` vs `/workspaces`, `/template` vs `/templates`
- **Verb Placement**: `generate-project` vs `project/generate`
- **Separator Style**: Kebab-case (`login-tracking`) vs camelCase inconsistency

### 2. Functional Duplication
- **Chat Endpoints**: 4 different chat implementations across 2 domains
- **Health Checks**: `health/db` vs `health/database`
- **Template Management**: `/projects/template` vs `/templates`
- **Connection Pool Monitoring**: Split across 3 different routes

### 3. Domain Boundaries
- **AI vs Claude**: Unclear separation of concerns
- **Chat vs AI/Chat**: Redundant nesting
- **Health vs Monitoring**: Overlapping responsibilities

### 4. Security Concerns
- Test endpoints (`mongodb-test`, `test-db`) should not exist in production
- Some routes may lack proper authentication checks

## Proposed New Structure

### Principles
1. **RESTful Resource Naming**: Use plural nouns for collections
2. **Consistent Hierarchy**: Group by domain, then resource, then operation
3. **Clear Separation**: Distinct boundaries between domains
4. **Versioning Ready**: Structure allows for future `/v1/` prefix
5. **Action Verbs**: Use HTTP methods, reserve verbs for non-CRUD operations

### New Directory Structure

```
/api/
├── auth/                          # Authentication & Authorization
│   ├── [...nextauth]/route.ts    # NextAuth handler
│   ├── sessions/
│   │   └── route.ts              # Session management
│   ├── mfa/
│   │   ├── setup/route.ts        # MFA setup
│   │   └── verify/route.ts       # MFA verification
│   ├── saml/
│   │   ├── metadata/route.ts     # SAML metadata
│   │   └── sso/route.ts          # SAML SSO
│   └── events/
│       └── route.ts              # Login tracking (renamed)
│
├── ai/                            # AI Services (Consolidated)
│   ├── chat/
│   │   ├── route.ts              # POST /ai/chat - Standard chat
│   │   └── stream/route.ts       # POST /ai/chat/stream - Streaming
│   ├── completions/
│   │   └── route.ts              # POST /ai/completions - Code completion
│   ├── analysis/
│   │   └── route.ts              # POST /ai/analysis - Code analysis
│   ├── generation/
│   │   ├── code/route.ts         # POST /ai/generation/code
│   │   └── projects/route.ts     # POST /ai/generation/projects
│   ├── conversations/
│   │   ├── route.ts              # GET/POST /ai/conversations
│   │   └── [id]/route.ts         # GET/PUT/DELETE /ai/conversations/:id
│   ├── models/
│   │   ├── route.ts              # GET /ai/models - List models
│   │   └── selection/route.ts    # POST /ai/models/selection
│   ├── providers/
│   │   ├── route.ts              # GET /ai/providers
│   │   └── health/route.ts       # GET /ai/providers/health
│   └── search/
│       ├── semantic/route.ts     # POST /ai/search/semantic
│       └── web/route.ts          # POST /ai/search/web
│
├── workspaces/                    # Workspace Management (Consolidated)
│   ├── route.ts                  # GET/POST /workspaces
│   ├── [id]/
│   │   ├── route.ts              # GET/PUT/DELETE /workspaces/:id
│   │   ├── files/route.ts        # GET/POST /workspaces/:id/files
│   │   ├── migrations/route.ts   # POST /workspaces/:id/migrations (Goose)
│   │   └── scaling/route.ts      # GET/PUT /workspaces/:id/scaling
│   └── sessions/
│       ├── route.ts              # GET/POST /workspaces/sessions
│       └── [sessionId]/route.ts  # GET/DELETE /workspaces/sessions/:id
│
├── files/                         # File Operations
│   ├── route.ts                  # GET/POST/PUT/DELETE /files
│   ├── sync/route.ts             # POST /files/sync
│   └── uploads/
│       ├── route.ts              # POST /files/uploads (general)
│       └── [type]/route.ts       # POST /files/uploads/pdf, etc.
│
├── storage/                       # Data Storage Services
│   ├── vectors/
│   │   ├── route.ts              # POST /storage/vectors - Store/query
│   │   └── search/route.ts       # POST /storage/vectors/search
│   └── embeddings/
│       └── route.ts              # POST /storage/embeddings
│
├── health/                        # Health Checks (Consolidated)
│   ├── route.ts                  # GET /health - Comprehensive check
│   ├── live/route.ts             # GET /health/live (K8s liveness)
│   ├── ready/route.ts            # GET /health/ready (K8s readiness)
│   └── components/
│       ├── database/route.ts     # GET /health/components/database
│       ├── cache/route.ts        # GET /health/components/cache
│       ├── connections/route.ts  # GET /health/components/connections
│       └── vectors/route.ts      # GET /health/components/vectors
│
├── monitoring/                    # Observability & Metrics
│   ├── metrics/
│   │   ├── route.ts              # GET/POST /monitoring/metrics
│   │   ├── system/route.ts       # GET /monitoring/metrics/system
│   │   ├── performance/route.ts  # GET /monitoring/metrics/performance
│   │   └── database/route.ts     # GET /monitoring/metrics/database
│   ├── traces/
│   │   ├── route.ts              # GET /monitoring/traces
│   │   └── config/route.ts       # GET/PUT /monitoring/traces/config
│   ├── connections/
│   │   ├── route.ts              # GET /monitoring/connections
│   │   ├── alerts/route.ts       # GET/POST /monitoring/connections/alerts
│   │   └── dashboard/route.ts    # GET /monitoring/connections/dashboard
│   ├── security/route.ts         # GET /monitoring/security
│   ├── rum/route.ts              # POST /monitoring/rum (Real User Monitoring)
│   └── embeddings/
│       ├── route.ts              # GET /monitoring/embeddings
│       └── azure/route.ts        # GET /monitoring/embeddings/azure
│
├── terminal/                      # Terminal Services
│   ├── sessions/
│   │   ├── route.ts              # GET/POST /terminal/sessions
│   │   └── [id]/route.ts         # GET/DELETE /terminal/sessions/:id
│   └── ws/route.ts               # WebSocket handler
│
├── projects/                      # Project Management
│   ├── route.ts                  # GET/POST /projects
│   ├── [id]/route.ts             # GET/PUT/DELETE /projects/:id
│   └── templates/
│       ├── route.ts              # GET /projects/templates
│       └── [id]/route.ts         # GET /projects/templates/:id
│
├── users/                         # User Management
│   ├── [id]/
│   │   ├── route.ts              # GET/PUT /users/:id
│   │   └── preferences/route.ts  # GET/PUT /users/:id/preferences
│   └── sessions/route.ts         # GET /users/sessions
│
├── integrations/                  # External Integrations
│   ├── huggingface/
│   │   ├── init/route.ts         # POST /integrations/huggingface/init
│   │   └── chat/route.ts         # POST /integrations/huggingface/chat
│   ├── ollama/
│   │   └── models/route.ts       # GET /integrations/ollama/models
│   ├── gradio/
│   │   └── run/route.ts          # POST /integrations/gradio/run
│   └── litellm/
│       └── route.ts              # Proxy endpoint
│
├── docs/                          # Documentation Services
│   └── search/route.ts           # GET /docs/search
│
└── experiments/                   # Feature Flags
    └── route.ts                  # GET /experiments
```

## Consolidation Strategy

### Phase 1: Critical Duplicates (Week 1)
**Goal**: Eliminate dangerous duplicates and test endpoints

#### Tasks:
1. **Remove Test Endpoints**
   - Delete `/api/mongodb-test/route.ts`
   - Delete `/api/test-db/route.ts`
   - Impact: None (development only)

2. **Consolidate Health Checks**
   - Merge `/api/health/db/route.ts` into `/api/health/database/route.ts`
   - Keep comprehensive `/api/health/route.ts`
   - Rename `/api/healthz/route.ts` to `/api/health/live/route.ts`
   - Rename `/api/readyz/route.ts` to `/api/health/ready/route.ts`
   - Impact: Kubernetes deployment configs need update

3. **Consolidate Connection Pool Monitoring**
   - Merge functionality from:
     - `/api/health/connection-pool/route.ts`
     - `/api/monitoring/pool/route.ts`
     - `/api/monitoring/pool-alerts/route.ts`
     - `/api/monitoring/connection-pool/dashboard/route.ts`
   - Into:
     - `/api/monitoring/connections/route.ts`
     - `/api/monitoring/connections/alerts/route.ts`
     - `/api/monitoring/connections/dashboard/route.ts`
   - Impact: Frontend dashboards need endpoint updates

4. **Consolidate Templates**
   - Merge `/api/projects/template/route.ts` and `/api/templates/route.ts`
   - Move to `/api/projects/templates/route.ts`
   - Impact: Frontend template loading code

### Phase 2: Domain Reorganization (Week 2-3)
**Goal**: Establish clear domain boundaries

#### Tasks:
1. **AI Domain Consolidation**
   - Merge chat endpoints:
     - Keep `/api/ai/chat/route.ts` (standard)
     - Keep `/api/ai/chat/stream/route.ts` (streaming)
     - Deprecate `/api/ai/chat/enhanced/route.ts` (merge features into standard)
     - Deprecate `/api/ai/chat/unified/route.ts` (redundant with standard)
     - Move `/api/chat/*` routes to `/api/ai/chat/*` or deprecate

   - Reorganize AI operations:
     - Move `/api/claude/analyze/route.ts` to `/api/ai/analysis/route.ts`
     - Move `/api/claude/generate/route.ts` to `/api/ai/generation/code/route.ts`
     - Move `/api/ai/generate-project/route.ts` to `/api/ai/generation/projects/route.ts`
     - Move `/api/code-completion/route.ts` to `/api/ai/completions/route.ts`

   - Provider management:
     - Keep `/api/ai/model-selection/route.ts` as `/api/ai/models/selection/route.ts`
     - Keep `/api/ai/provider-health/route.ts` as `/api/ai/providers/health/route.ts`

2. **Workspace Domain Consolidation**
   - Standardize on plural `/api/workspaces/`
   - Move `/api/workspace/[id]/init-goose/route.ts` to `/api/workspaces/[id]/migrations/route.ts`
   - Move `/api/workspace/auto-scaling/route.ts` to `/api/workspaces/[id]/scaling/route.ts`
   - Move code-server sessions to workspace domain: `/api/workspaces/sessions/`

3. **Files & Storage Separation**
   - Keep `/api/files/*` for file system operations
   - Move `/api/uploads/pdf/route.ts` to `/api/files/uploads/pdf/route.ts`
   - Move `/api/vector-store/route.ts` to `/api/storage/vectors/route.ts`
   - Create `/api/storage/embeddings/route.ts` for embedding operations

4. **Integrations Domain**
   - Move HuggingFace routes to `/api/integrations/huggingface/`
   - Move Ollama routes to `/api/integrations/ollama/`
   - Move Gradio routes to `/api/integrations/gradio/`
   - Move LiteLLM to `/api/integrations/litellm/`

### Phase 3: Naming Standardization (Week 4)
**Goal**: Apply consistent naming conventions

#### Rules:
1. **Resource Names**: Always plural (`workspaces`, not `workspace`)
2. **URL Structure**: `/resource/[id]/sub-resource/[sub-id]`
3. **Action Verbs**: Only for non-CRUD operations (search, sync, analyze)
4. **Kebab-case**: For multi-word segments (`code-completion` → keep consistent)
5. **HTTP Methods**: Use appropriate verbs (GET, POST, PUT, DELETE, PATCH)

#### Tasks:
1. Rename all singular resource routes to plural
2. Standardize verb placement (move to end of path)
3. Update all route handlers to use consistent response formats
4. Add OpenAPI/Swagger documentation

### Phase 4: Middleware & Standards (Week 5)
**Goal**: Establish consistent patterns

#### Tasks:
1. **Create Shared Middleware**
   - Authentication middleware
   - Rate limiting middleware
   - Error handling middleware
   - Logging middleware
   - CORS middleware

2. **Response Standardization**
   - Implement consistent response format:
     ```typescript
     {
       success: boolean,
       data?: any,
       error?: { code: string, message: string },
       meta?: { timestamp, version, etc }
     }
     ```

3. **Error Handling**
   - Standardize error codes
   - Implement error tracking
   - Add request ID propagation

4. **Documentation**
   - Generate OpenAPI spec
   - Create API documentation site
   - Add inline JSDoc comments

## Migration Path

### Backward Compatibility Strategy

To prevent breaking existing integrations, we'll use a phased deprecation approach:

#### 1. Dual Routing (Weeks 1-4)
- Create new routes alongside old routes
- Old routes proxy to new routes with deprecation warnings
- Add `X-Deprecated-Endpoint` header to responses

#### 2. Deprecation Notice (Weeks 5-8)
- Update documentation to show old routes as deprecated
- Add console warnings in development mode
- Email notifications to API consumers

#### 3. Sunset Period (Weeks 9-12)
- Old routes return 410 Gone with migration guide
- Monitor traffic to deprecated endpoints
- Provide migration assistance

#### 4. Removal (Week 13+)
- Remove old route files
- Clean up middleware and tests

### Implementation Example

```typescript
// Old route: /api/workspace/[id]/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, context: any) {
  // Proxy to new endpoint
  const newUrl = request.url.replace('/api/workspace/', '/api/workspaces/')
  const response = await fetch(newUrl, {
    method: 'GET',
    headers: request.headers
  })

  // Add deprecation header
  const headers = new Headers(response.headers)
  headers.set('X-Deprecated-Endpoint', 'true')
  headers.set('X-New-Endpoint', newUrl)
  headers.set('X-Deprecation-Date', '2025-11-01')

  console.warn(`[DEPRECATED] /api/workspace/* → /api/workspaces/*`)

  return new Response(response.body, {
    status: response.status,
    headers
  })
}
```

## Route Mapping Table

| Old Route | New Route | Status | Breaking? |
|-----------|-----------|--------|-----------|
| `/api/workspace/[id]/*` | `/api/workspaces/[id]/*` | Rename | No (proxy) |
| `/api/workspace/auto-scaling` | `/api/workspaces/[id]/scaling` | Move | Yes |
| `/api/health/db` | `/api/health/components/database` | Consolidate | No (proxy) |
| `/api/healthz` | `/api/health/live` | Rename | Yes (K8s) |
| `/api/readyz` | `/api/health/ready` | Rename | Yes (K8s) |
| `/api/chat/*` | `/api/ai/chat/*` | Move | No (proxy) |
| `/api/claude/analyze` | `/api/ai/analysis` | Move | No (proxy) |
| `/api/claude/generate` | `/api/ai/generation/code` | Move | No (proxy) |
| `/api/code-completion` | `/api/ai/completions` | Move | No (proxy) |
| `/api/uploads/pdf` | `/api/files/uploads/pdf` | Move | No (proxy) |
| `/api/vector-store` | `/api/storage/vectors` | Move | No (proxy) |
| `/api/templates` | `/api/projects/templates` | Consolidate | No (proxy) |
| `/api/monitoring/pool*` | `/api/monitoring/connections/*` | Consolidate | Yes |
| `/api/test-db` | N/A | Delete | Yes |
| `/api/mongodb-test` | N/A | Delete | Yes |

## Testing Strategy

### 1. Route Testing
- Create integration tests for all new routes
- Test backward compatibility proxies
- Verify deprecation headers
- Test error handling

### 2. Contract Testing
- Use Pact or similar for consumer-driven contracts
- Verify response schemas
- Test HTTP status codes

### 3. Performance Testing
- Benchmark new routes vs old routes
- Ensure no performance regression
- Test under load

### 4. Security Testing
- Verify authentication on all routes
- Test authorization logic
- Check for injection vulnerabilities
- Validate input sanitization

## Rollout Plan

### Week 1: Foundation
- [ ] Create new directory structure
- [ ] Implement shared middleware
- [ ] Set up backward compatibility layer
- [ ] Remove test endpoints

### Week 2: Health & Monitoring
- [ ] Consolidate health checks
- [ ] Merge connection pool monitoring
- [ ] Update K8s deployment configs
- [ ] Test health check integrations

### Week 3: AI Domain
- [ ] Consolidate chat endpoints
- [ ] Reorganize AI operations
- [ ] Merge Claude routes
- [ ] Update frontend AI clients

### Week 4: Workspaces & Files
- [ ] Standardize workspace routes
- [ ] Consolidate file operations
- [ ] Move storage routes
- [ ] Update workspace UI

### Week 5: Integrations & Polish
- [ ] Move integration routes
- [ ] Apply naming conventions
- [ ] Generate API documentation
- [ ] Final testing

### Week 6-12: Deprecation Period
- [ ] Monitor deprecated endpoint usage
- [ ] Communicate with API consumers
- [ ] Provide migration support
- [ ] Update documentation

### Week 13+: Cleanup
- [ ] Remove deprecated routes
- [ ] Clean up unused code
- [ ] Final documentation update
- [ ] Post-mortem review

## Success Metrics

### Quantitative
- Reduce total routes from 74 to ~45 (40% reduction)
- 100% route test coverage
- <100ms additional latency from proxying
- Zero breaking changes for critical endpoints
- 95%+ API consumer migration rate

### Qualitative
- Clear, predictable URL structure
- Consistent naming conventions
- Improved developer experience
- Better API discoverability
- Reduced maintenance burden

## Risks & Mitigation

### Risk 1: Breaking Changes
**Mitigation**:
- Maintain backward compatibility proxies
- Extended deprecation period
- Clear migration documentation
- Proactive communication

### Risk 2: Frontend Integration Failures
**Mitigation**:
- Comprehensive integration testing
- Staged rollout
- Feature flags for new routes
- Quick rollback capability

### Risk 3: Performance Regression
**Mitigation**:
- Benchmark testing before/after
- Monitor response times
- Load testing
- Caching strategy

### Risk 4: Incomplete Migration
**Mitigation**:
- Track deprecated endpoint usage
- Automated migration tools
- Direct consumer support
- Incremental migration path

## Next Steps

1. **Review & Approval** (This document)
   - Team review of consolidation plan
   - Stakeholder sign-off
   - Timeline confirmation

2. **Preparation** (Week 0)
   - Create feature branch
   - Set up testing environment
   - Prepare monitoring dashboards

3. **Execution** (Weeks 1-5)
   - Follow weekly rollout plan
   - Daily stand-ups for progress
   - Continuous testing

4. **Monitoring** (Weeks 6-12)
   - Track deprecation metrics
   - Support API consumers
   - Address issues promptly

5. **Completion** (Week 13+)
   - Remove deprecated code
   - Final documentation
   - Post-implementation review

## Appendices

### Appendix A: Full Route Listing

```
Total: 74 routes

AI Domain (16):
- /api/ai/chat/route.ts
- /api/ai/chat/enhanced/route.ts
- /api/ai/chat/stream/route.ts
- /api/ai/chat/unified/route.ts
- /api/ai/conversations/[workspaceId]/route.ts
- /api/ai/function-call/route.ts
- /api/ai/generate-project/route.ts
- /api/ai/huggingface-chat/route.ts
- /api/ai/huggingface-init/route.ts
- /api/ai/litellm/route.ts
- /api/ai/management/route.ts
- /api/ai/model-selection/route.ts
- /api/ai/provider-health/route.ts
- /api/ai/search/route.ts
- /api/ai/upload/route.ts
- /api/ai/web-search/route.ts

Chat Domain (3):
- /api/chat/mongodb/route.ts
- /api/chat/mongodb-simple/route.ts
- /api/chat/stream/route.ts

Authentication (6):
- /api/auth/[...nextauth]/route.ts
- /api/auth/login-tracking/route.ts
- /api/auth/mfa/setup/route.ts
- /api/auth/mfa/verify/route.ts
- /api/auth/saml/metadata/route.ts
- /api/auth/saml/sso/route.ts

Health (8):
- /api/health/route.ts
- /api/health/simple/route.ts
- /api/health/db/route.ts
- /api/health/database/route.ts
- /api/health/database/metrics/route.ts
- /api/health/connection-pool/route.ts
- /api/health/vector-db/route.ts
- /api/health/vector-metrics/route.ts

K8s Probes (2):
- /api/healthz/route.ts
- /api/readyz/route.ts

Monitoring (13):
- /api/monitoring/metrics/route.ts
- /api/monitoring/dashboard/route.ts
- /api/monitoring/performance/route.ts
- /api/monitoring/pool/route.ts
- /api/monitoring/pool-alerts/route.ts
- /api/monitoring/connection-pool/dashboard/route.ts
- /api/monitoring/azure-embedding/route.ts
- /api/monitoring/embeddings/route.ts
- /api/monitoring/cache/route.ts
- /api/monitoring/security/route.ts
- /api/monitoring/traces/route.ts
- /api/monitoring/otel-config/route.ts
- /api/monitoring/rum/route.ts

Workspaces (4):
- /api/workspaces/route.ts
- /api/workspaces/[id]/route.ts
- /api/workspace/[id]/init-goose/route.ts
- /api/workspace/auto-scaling/route.ts

Code Server (2):
- /api/code-server/session/route.ts
- /api/code-server/session/[sessionId]/route.ts

Claude (4):
- /api/claude/analyze/route.ts
- /api/claude/chat/route.ts
- /api/claude/generate/route.ts
- /api/claude/session/route.ts

Files (4):
- /api/files/route.ts
- /api/files/sync/route.ts
- /api/uploads/pdf/route.ts
- /api/vector-store/route.ts

Miscellaneous (12):
- /api/code-completion/route.ts
- /api/docs/search/route.ts
- /api/experiments/route.ts
- /api/gradio/run/route.ts
- /api/mongodb-test/route.ts
- /api/ollama/models/route.ts
- /api/projects/template/route.ts
- /api/templates/route.ts
- /api/terminal/session/route.ts
- /api/terminal/ws/route.ts
- /api/test-db/route.ts
- /api/user/preferences/route.ts
```

### Appendix B: Naming Convention Standards

#### Resource Naming
- **Always Plural**: `/users`, `/workspaces`, `/files`
- **Kebab-case**: `/user-preferences`, `/code-completion`
- **Hierarchical**: `/workspaces/[id]/files/[fileId]`

#### HTTP Methods
- **GET**: Retrieve resource(s)
- **POST**: Create new resource or trigger action
- **PUT**: Replace entire resource
- **PATCH**: Partial update
- **DELETE**: Remove resource

#### Action Verbs (Non-CRUD)
Use verbs only for operations that don't map to CRUD:
- `/files/sync` - Synchronization operation
- `/ai/search/semantic` - Search operation
- `/workspaces/[id]/scale` - Scaling operation

#### Response Format
```typescript
// Success Response
{
  success: true,
  data: {
    // Resource data
  },
  meta: {
    timestamp: "2025-10-01T12:00:00Z",
    version: "1.0.0",
    requestId: "req_abc123"
  }
}

// Error Response
{
  success: false,
  error: {
    code: "WORKSPACE_NOT_FOUND",
    message: "Workspace with ID 123 not found",
    details: {}
  },
  meta: {
    timestamp: "2025-10-01T12:00:00Z",
    version: "1.0.0",
    requestId: "req_abc123"
  }
}
```

### Appendix C: Authentication Requirements

All routes except health checks require authentication:

```typescript
// Middleware applied to all /api/* routes
export async function middleware(request: NextRequest) {
  const publicPaths = [
    '/api/health',
    '/api/health/live',
    '/api/health/ready',
    '/api/auth'
  ]

  if (!isPublicPath(request.nextUrl.pathname, publicPaths)) {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}
```

## Conclusion

This consolidation plan provides a systematic approach to reorganizing 74 API routes into a maintainable, scalable structure. By following RESTful principles and maintaining backward compatibility, we can significantly reduce technical debt while minimizing disruption to existing integrations.

The phased approach allows for incremental progress with continuous testing and validation. Success metrics will ensure we achieve our goals while maintaining system reliability.

**Estimated Effort**: 13 weeks (5 weeks active development, 8 weeks deprecation monitoring)
**Team Size**: 2-3 developers
**Risk Level**: Medium (mitigated by backward compatibility)
**Expected Benefits**: 40% reduction in routes, improved maintainability, better developer experience

---

**Document Status**: Draft for Review
**Next Review**: Team meeting to discuss timeline and resource allocation
**Owner**: Backend Architecture Team
**Reviewers**: Engineering leads, Product managers, Frontend team leads
