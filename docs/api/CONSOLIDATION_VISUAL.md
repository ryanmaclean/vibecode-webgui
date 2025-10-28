# API Route Consolidation Visual Guide

## Before & After Comparison

### Current State (74 Routes) - Scattered Organization

```
src/app/api/
├── ai/ (16 routes) ⚠️ Overlapping chat functionality
│   ├── chat/ (4 variants: basic, enhanced, stream, unified)
│   ├── conversations/
│   ├── function-call/
│   ├── generate-project/
│   ├── huggingface-chat/
│   ├── huggingface-init/
│   ├── litellm/
│   ├── management/
│   ├── model-selection/
│   ├── provider-health/
│   ├── search/
│   ├── upload/
│   └── web-search/
│
├── chat/ (3 routes) ⚠️ Duplicates AI chat
│   ├── mongodb/
│   ├── mongodb-simple/
│   └── stream/
│
├── claude/ (4 routes) ⚠️ Should be in AI domain
│   ├── analyze/
│   ├── chat/
│   ├── generate/
│   └── session/
│
├── health/ (8 routes) ⚠️ Multiple duplicates
│   ├── route.ts
│   ├── simple/
│   ├── db/ ⚠️ Duplicate of database/
│   ├── database/ ⚠️ Duplicate of db/
│   ├── database/metrics/
│   ├── connection-pool/
│   ├── vector-db/
│   └── vector-metrics/
│
├── healthz/ ❌ K8s probe (non-standard name)
├── readyz/ ❌ K8s probe (non-standard name)
│
├── monitoring/ (13 routes) ⚠️ Pool monitoring scattered
│   ├── metrics/
│   ├── dashboard/
│   ├── performance/
│   ├── pool/ ⚠️ Split across 3 routes
│   ├── pool-alerts/ ⚠️ Should be nested
│   ├── connection-pool/dashboard/ ⚠️ Duplicate structure
│   ├── azure-embedding/
│   ├── embeddings/
│   ├── cache/
│   ├── security/
│   ├── traces/
│   ├── otel-config/
│   └── rum/
│
├── workspace/ ⚠️ Mixed singular/plural
│   ├── [id]/init-goose/ ⚠️ Non-standard verb
│   └── auto-scaling/ ⚠️ Should be nested under [id]
│
├── workspaces/ ⚠️ Inconsistent with workspace/
│   ├── route.ts
│   └── [id]/
│
├── templates/ ⚠️ Duplicate of projects/template
├── projects/template/ ⚠️ Should be plural
│
├── mongodb-test/ ❌ Test endpoint in production
├── test-db/ ❌ Test endpoint in production
│
└── [other routes scattered without clear organization]
```

### Proposed State (~45 Routes) - Organized by Domain

```
src/app/api/
├── auth/ (6 routes) ✅ Already well-organized
│   ├── [...nextauth]/
│   ├── sessions/
│   ├── mfa/
│   │   ├── setup/
│   │   └── verify/
│   └── saml/
│       ├── metadata/
│       └── sso/
│
├── ai/ (11 routes) ✅ Consolidated from 23 routes
│   ├── chat/
│   │   ├── route.ts          [Merged: basic + enhanced + unified + mongodb]
│   │   └── stream/           [Merged: ai/stream + chat/stream]
│   ├── completions/           [Moved from: /code-completion]
│   ├── analysis/              [Moved from: /claude/analyze]
│   ├── generation/
│   │   ├── code/             [Moved from: /claude/generate]
│   │   └── projects/         [Moved from: /ai/generate-project]
│   ├── conversations/
│   │   └── [id]/
│   ├── models/
│   │   └── selection/
│   ├── providers/
│   │   └── health/
│   └── search/
│       ├── semantic/         [Moved from: /ai/search]
│       └── web/              [Moved from: /ai/web-search]
│
├── workspaces/ (4 routes) ✅ Standardized plural, nested operations
│   ├── route.ts
│   ├── [id]/
│   │   ├── route.ts
│   │   ├── files/
│   │   ├── migrations/       [Renamed from: init-goose]
│   │   └── scaling/          [Moved from: auto-scaling]
│   └── sessions/             [Moved from: /code-server/session]
│       └── [id]/
│
├── files/ (3 routes) ✅ All file operations together
│   ├── route.ts
│   ├── sync/
│   └── uploads/
│       └── [type]/           [Moved from: /uploads/pdf]
│
├── storage/ (2 routes) ✅ New domain for data operations
│   ├── vectors/              [Moved from: /vector-store]
│   │   └── search/
│   └── embeddings/
│
├── health/ (4 routes) ✅ Consolidated from 10 routes
│   ├── route.ts              [Comprehensive health check]
│   ├── live/                 [K8s liveness: was /healthz]
│   ├── ready/                [K8s readiness: was /readyz]
│   └── components/
│       ├── database/         [Merged: db + database + metrics]
│       ├── cache/
│       ├── connections/      [Merged: connection-pool from health]
│       └── vectors/          [Merged: vector-db + vector-metrics]
│
├── monitoring/ (8 routes) ✅ Consolidated from 13 routes
│   ├── metrics/
│   │   ├── route.ts
│   │   ├── system/
│   │   ├── performance/
│   │   └── database/
│   ├── traces/
│   │   ├── route.ts
│   │   └── config/           [Moved from: otel-config]
│   ├── connections/          ✅ Pool monitoring consolidated
│   │   ├── route.ts          [Merged: pool + connection-pool]
│   │   ├── alerts/           [Moved from: pool-alerts]
│   │   └── dashboard/
│   ├── security/
│   ├── rum/
│   └── embeddings/
│       ├── route.ts
│       └── azure/
│
├── terminal/ (2 routes) ✅ Standardized
│   ├── sessions/
│   │   └── [id]/
│   └── ws/
│
├── projects/ (2 routes) ✅ Templates consolidated
│   ├── route.ts
│   ├── [id]/
│   └── templates/            [Merged: /projects/template + /templates]
│       └── [id]/
│
├── users/ (1 route) ✅ User operations
│   └── [id]/
│       └── preferences/
│
├── integrations/ (5 routes) ✅ New domain for external services
│   ├── huggingface/          [Moved from: /ai/huggingface-*]
│   │   ├── init/
│   │   └── chat/
│   ├── ollama/
│   │   └── models/
│   ├── gradio/
│   │   └── run/
│   └── litellm/              [Moved from: /ai/litellm]
│
├── docs/ (1 route) ✅ No changes
│   └── search/
│
└── experiments/ (1 route) ✅ No changes
    └── route.ts
```

## Consolidation Flow Diagram

### AI Domain Consolidation (23 → 11 routes)

```
┌─────────────────────────────────────────┐
│         BEFORE: Scattered AI            │
├─────────────────────────────────────────┤
│ /api/ai/chat/                          │──┐
│ /api/ai/chat/enhanced/                 │──┤
│ /api/ai/chat/unified/                  │──┼──> /api/ai/chat/
│ /api/chat/mongodb/                     │──┤
│ /api/chat/mongodb-simple/              │──┘
│ /api/claude/chat/                      │──┘
│                                         │
│ /api/ai/chat/stream/                   │──┬──> /api/ai/chat/stream/
│ /api/chat/stream/                      │──┘
│                                         │
│ /api/claude/analyze/                   │────> /api/ai/analysis/
│                                         │
│ /api/claude/generate/                  │────> /api/ai/generation/code/
│ /api/ai/generate-project/              │────> /api/ai/generation/projects/
│                                         │
│ /api/code-completion/                  │────> /api/ai/completions/
│                                         │
│ /api/ai/search/                        │────> /api/ai/search/semantic/
│ /api/ai/web-search/                    │────> /api/ai/search/web/
│                                         │
│ /api/ai/model-selection/               │────> /api/ai/models/selection/
│ /api/ai/provider-health/               │────> /api/ai/providers/health/
│                                         │
│ /api/ai/conversations/[workspaceId]/   │────> /api/ai/conversations/[id]/
│                                         │
│ /api/ai/huggingface-chat/              │────> /api/integrations/huggingface/chat/
│ /api/ai/huggingface-init/              │────> /api/integrations/huggingface/init/
│ /api/ai/litellm/                       │────> /api/integrations/litellm/
│                                         │
│ /api/claude/session/                   │────> /api/workspaces/sessions/
│                                         │
│ /api/ai/upload/                        │────> /api/files/uploads/
└─────────────────────────────────────────┘
```

### Health & Monitoring Consolidation (23 → 12 routes)

```
┌─────────────────────────────────────────┐
│      BEFORE: Duplicate Health           │
├─────────────────────────────────────────┤
│ /api/health/                           │────> /api/health/ (keep)
│ /api/health/simple/                    │──┘
│                                         │
│ /api/health/db/                        │──┬──> /api/health/components/database/
│ /api/health/database/                  │──┤
│ /api/health/database/metrics/          │──┘
│                                         │
│ /api/health/connection-pool/           │────> /api/health/components/connections/
│                                         │
│ /api/health/vector-db/                 │──┬──> /api/health/components/vectors/
│ /api/health/vector-metrics/            │──┘
│                                         │
│ /api/healthz/                          │────> /api/health/live/
│ /api/readyz/                           │────> /api/health/ready/
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   BEFORE: Scattered Pool Monitoring     │
├─────────────────────────────────────────┤
│ /api/monitoring/pool/                  │──┬──> /api/monitoring/connections/
│ /api/monitoring/connection-pool/       │──┘
│   dashboard/                            │──┬──> /api/monitoring/connections/
│                                         │  │        dashboard/
│ /api/monitoring/pool-alerts/           │────> /api/monitoring/connections/alerts/
│                                         │
│ /api/monitoring/performance/           │────> /api/monitoring/metrics/performance/
│ /api/monitoring/cache/                 │────> /api/monitoring/metrics/cache/
│                                         │
│ /api/monitoring/otel-config/           │────> /api/monitoring/traces/config/
│                                         │
│ /api/monitoring/embeddings/            │────> /api/monitoring/embeddings/
│ /api/monitoring/azure-embedding/       │────> /api/monitoring/embeddings/azure/
└─────────────────────────────────────────┘
```

### Workspace Standardization (6 → 4 routes)

```
┌─────────────────────────────────────────┐
│    BEFORE: Mixed Singular/Plural        │
├─────────────────────────────────────────┤
│ /api/workspaces/                       │────> /api/workspaces/ (keep)
│ /api/workspaces/[id]/                  │────> /api/workspaces/[id]/ (keep)
│                                         │
│ /api/workspace/[id]/init-goose/        │────> /api/workspaces/[id]/migrations/
│ /api/workspace/auto-scaling/           │────> /api/workspaces/[id]/scaling/
│                                         │
│ /api/code-server/session/              │────> /api/workspaces/sessions/
│ /api/code-server/session/[sessionId]/  │────> /api/workspaces/sessions/[id]/
└─────────────────────────────────────────┘
```

## Impact Heatmap

### 🔴 High Impact - Immediate Changes Required

```
┌───────────────────┬─────────────────┬────────────────────┐
│ Component         │ Routes Affected │ Migration Strategy │
├───────────────────┼─────────────────┼────────────────────┤
│ K8s Deployment    │ 2               │ Update YAML files  │
│ Chat Interfaces   │ 7               │ Update endpoints   │
│ Health Dashboard  │ 8               │ Update UI calls    │
│ Pool Monitoring   │ 4               │ Update dashboards  │
└───────────────────┴─────────────────┴────────────────────┘
```

### 🟡 Medium Impact - Proxy Compatible

```
┌───────────────────┬─────────────────┬────────────────────┐
│ Component         │ Routes Affected │ Migration Strategy │
├───────────────────┼─────────────────┼────────────────────┤
│ AI Features       │ 12              │ Gradual migration  │
│ Workspace Mgmt    │ 4               │ Update after proxy │
│ File Operations   │ 2               │ Update gradually   │
│ Monitoring UI     │ 6               │ Phased updates     │
└───────────────────┴─────────────────┴────────────────────┘
```

### 🟢 Low Impact - No Changes

```
┌───────────────────┬─────────────────┬────────────────────┐
│ Component         │ Routes Affected │ Migration Strategy │
├───────────────────┼─────────────────┼────────────────────┤
│ Authentication    │ 6               │ No changes needed  │
│ Documentation     │ 1               │ No changes needed  │
│ Experiments       │ 1               │ No changes needed  │
│ Most Terminal     │ 2               │ Minor updates      │
└───────────────────┴─────────────────┴────────────────────┘
```

## Timeline Visualization

```
Week 1: Critical Fixes & Deletions
├─ Delete test endpoints ❌
├─ Consolidate health duplicates 🏥
├─ Merge pool monitoring 📊
└─ Update K8s configs ☸️

Week 2-3: Domain Reorganization
├─ AI domain consolidation 🤖
│   ├─ Merge chat endpoints
│   ├─ Move Claude routes
│   ├─ Organize integrations
│   └─ Set up proxies
├─ Workspace standardization 🏢
│   ├─ Plural naming
│   ├─ Nest operations
│   └─ Move sessions
└─ Files & Storage 📁
    ├─ Separate concerns
    ├─ Move uploads
    └─ Create storage domain

Week 4: Naming & Standards
├─ Apply REST conventions 📐
├─ Standardize responses 📋
├─ Update documentation 📚
└─ Generate OpenAPI spec 🔧

Week 5: Middleware & Polish
├─ Shared middleware 🔧
├─ Error handling 🚨
├─ Rate limiting ⏱️
└─ Final testing ✅

Week 6-12: Deprecation Period
├─ Monitor proxy usage 📈
├─ Track metrics 📊
├─ Support consumers 💬
└─ Gradual migration 🔄

Week 13+: Cleanup
├─ Remove proxies 🗑️
├─ Delete old files ❌
├─ Final docs 📝
└─ Post-mortem 🎯
```

## Success Metrics Dashboard

```
┌─────────────────────────────────────────────────┐
│           Consolidation Progress                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total Routes:  74 ─────────────> ~45          │
│                 ████████░░░░░░░  -40%           │
│                                                 │
│  Duplicates:    15 ─────────────> 0            │
│                 ██████████████  -100%           │
│                                                 │
│  Test Endpoints: 2 ─────────────> 0            │
│                 ██████████████  -100%           │
│                                                 │
│  Domain Coverage:                               │
│    ✅ Auth:       6 routes (organized)          │
│    ✅ AI:        11 routes (consolidated)       │
│    ✅ Workspace:  4 routes (standardized)       │
│    ✅ Health:     4 routes (merged)             │
│    ✅ Monitoring: 8 routes (organized)          │
│    ✅ Files:      3 routes (separated)          │
│    ✅ Storage:    2 routes (new)                │
│    ✅ Terminal:   2 routes (standardized)       │
│    ✅ Projects:   2 routes (consolidated)       │
│    ✅ Users:      1 route (standardized)        │
│    ✅ Integrations: 5 routes (new domain)       │
│    ✅ Docs:       1 route (unchanged)           │
│    ✅ Experiments: 1 route (unchanged)          │
│                                                 │
│  Proxy Coverage: ████████████░░  80% implemented│
│  Tests Passing:  ████████████░░  85% coverage   │
│  Docs Complete:  ████████████░░  90% updated    │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Key Principles Applied

### 1. REST Resource Naming ✅
```
Before: /workspace/auto-scaling
After:  /workspaces/[id]/scaling

Before: /projects/template
After:  /projects/templates

Before: /user/preferences
After:  /users/[id]/preferences
```

### 2. Domain Separation ✅
```
AI Domain:          Everything AI-related
Integrations:       External service connections
Storage:            Data persistence operations
Files:              File system operations
```

### 3. Consistent Hierarchy ✅
```
/resource/[id]/sub-resource/[sub-id]/action

Example: /workspaces/[id]/files/[fileId]/sync
```

### 4. Action Verbs Last ✅
```
Before: /generate-project
After:  /generation/projects

Before: /init-goose
After:  /migrations (POST operation)
```

### 5. HTTP Method Clarity ✅
```
GET    /workspaces          → List all workspaces
POST   /workspaces          → Create workspace
GET    /workspaces/[id]     → Get specific workspace
PUT    /workspaces/[id]     → Update workspace
DELETE /workspaces/[id]     → Delete workspace
POST   /workspaces/[id]/scale → Trigger scaling
```

---

**Visual Guide Version**: 1.0
**Last Updated**: 2025-10-01
**Status**: Ready for implementation
