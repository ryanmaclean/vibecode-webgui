# API Endpoints Documentation

This document enumerates all API endpoints in the vibecode codebase across three frameworks: Next.js, Express (AI Gateway), and aiohttp (Agent API).

**Last Updated:** 2026-01-19
**Total Endpoints:** 216

---

## Next.js API Routes (185 endpoints)

| HTTP Method | Route Path | Handler | Source File |
|------------|-----------|---------|------------|
| POST | /api/agent-builder/session | POST handler | src/app/api/agent-builder/session/route.ts |
| GET | /api/agents/[...path] | Proxy handler for agent operations | src/app/api/agents/[...path]/route.ts |
| POST | /api/agents/[...path] | Create/update agent | src/app/api/agents/[...path]/route.ts |
| DELETE | /api/agents/[...path] | Delete agent | src/app/api/agents/[...path]/route.ts |
| POST | /api/ai/chat/enhanced | Enhanced chat completion | src/app/api/ai/chat/enhanced/route.ts |
| OPTIONS | /api/ai/chat/enhanced | CORS preflight | src/app/api/ai/chat/enhanced/route.ts |
| POST | /api/ai/chat/stream | Streaming chat | src/app/api/ai/chat/stream/route.ts |
| OPTIONS | /api/ai/chat/stream | CORS preflight | src/app/api/ai/chat/stream/route.ts |
| POST | /api/ai/chat/unified | Unified chat endpoint | src/app/api/ai/chat/unified/route.ts |
| OPTIONS | /api/ai/chat/unified | CORS preflight | src/app/api/ai/chat/unified/route.ts |
| GET | /api/ai/conversations/[workspaceId] | List conversations | src/app/api/ai/conversations/[workspaceId]/route.ts |
| POST | /api/ai/conversations/[workspaceId] | Create conversation | src/app/api/ai/conversations/[workspaceId]/route.ts |
| DELETE | /api/ai/conversations/[workspaceId] | Delete conversation | src/app/api/ai/conversations/[workspaceId]/route.ts |
| POST | /api/ai/function-call | Function calling | src/app/api/ai/function-call/route.ts |
| POST | /api/ai/generate-project | Generate project | src/app/api/ai/generate-project/route.ts |
| GET | /api/ai/huggingface-chat | HuggingFace chat | src/app/api/ai/huggingface-chat/route.ts |
| POST | /api/ai/huggingface-chat | HuggingFace chat | src/app/api/ai/huggingface-chat/route.ts |
| GET | /api/ai/huggingface-init | HuggingFace init | src/app/api/ai/huggingface-init/route.ts |
| POST | /api/ai/huggingface-init | HuggingFace init | src/app/api/ai/huggingface-init/route.ts |
| GET | /api/ai/litellm | Get LiteLLM config | src/app/api/ai/litellm/route.ts |
| POST | /api/ai/litellm | Create LiteLLM request | src/app/api/ai/litellm/route.ts |
| PUT | /api/ai/litellm | Update LiteLLM config | src/app/api/ai/litellm/route.ts |
| GET | /api/ai/management | AI management | src/app/api/ai/management/route.ts |
| POST | /api/ai/management | AI management | src/app/api/ai/management/route.ts |
| GET | /api/ai/model-selection | Get model selection | src/app/api/ai/model-selection/route.ts |
| POST | /api/ai/model-selection | Select model | src/app/api/ai/model-selection/route.ts |
| GET | /api/ai/provider-health | Get provider health | src/app/api/ai/provider-health/route.ts |
| POST | /api/ai/provider-health | Check provider health | src/app/api/ai/provider-health/route.ts |
| GET | /api/ai/search | AI search | src/app/api/ai/search/route.ts |
| POST | /api/ai/search | AI search | src/app/api/ai/search/route.ts |
| GET | /api/ai/upload.disabled | Upload (disabled) | src/app/api/ai/upload.disabled/route.ts |
| POST | /api/ai/upload.disabled | Upload (disabled) | src/app/api/ai/upload.disabled/route.ts |
| POST | /api/ai/upload | File upload | src/app/api/ai/upload/route.ts |
| OPTIONS | /api/ai/upload | CORS preflight | src/app/api/ai/upload/route.ts |
| GET | /api/ai/web-search.disabled | Web search (disabled) | src/app/api/ai/web-search.disabled/route.ts |
| POST | /api/ai/web-search.disabled | Web search (disabled) | src/app/api/ai/web-search.disabled/route.ts |
| GET | /api/ai/web-search | Web search | src/app/api/ai/web-search/route.ts |
| POST | /api/ai/web-search | Web search | src/app/api/ai/web-search/route.ts |
| GET | /api/auth/csrf | Get CSRF token | src/app/api/auth/csrf/route.ts |
| OPTIONS | /api/auth/csrf | CORS preflight | src/app/api/auth/csrf/route.ts |
| GET | /api/auth/login-tracking | Get login tracking | src/app/api/auth/login-tracking/route.ts |
| POST | /api/auth/login-tracking | Track login | src/app/api/auth/login-tracking/route.ts |
| POST | /api/auth/mfa/setup | Setup MFA | src/app/api/auth/mfa/setup/route.ts |
| PUT | /api/auth/mfa/setup | Update MFA | src/app/api/auth/mfa/setup/route.ts |
| GET | /api/auth/mfa/verify | Get MFA verification | src/app/api/auth/mfa/verify/route.ts |
| POST | /api/auth/mfa/verify | Verify MFA | src/app/api/auth/mfa/verify/route.ts |
| PUT | /api/auth/mfa/verify | Update MFA verification | src/app/api/auth/mfa/verify/route.ts |
| DELETE | /api/auth/mfa/verify | Delete MFA | src/app/api/auth/mfa/verify/route.ts |
| GET | /api/auth/saml/metadata | SAML metadata | src/app/api/auth/saml/metadata/route.ts |
| GET | /api/auth/saml/sso | SAML SSO login | src/app/api/auth/saml/sso/route.ts |
| POST | /api/auth/saml/sso | SAML SSO callback | src/app/api/auth/saml/sso/route.ts |
| PUT | /api/auth/saml/sso | Update SAML config | src/app/api/auth/saml/sso/route.ts |
| GET | /api/chat/mongodb-simple | Get chat (MongoDB simple) | src/app/api/chat/mongodb-simple/route.ts |
| POST | /api/chat/mongodb-simple | Create chat (MongoDB simple) | src/app/api/chat/mongodb-simple/route.ts |
| GET | /api/chat/mongodb | Get chat (MongoDB) | src/app/api/chat/mongodb/route.ts |
| POST | /api/chat/mongodb | Create chat (MongoDB) | src/app/api/chat/mongodb/route.ts |
| POST | /api/chat/stream | Stream chat | src/app/api/chat/stream/route.ts |
| POST | /api/claude/analyze | Claude code analysis | src/app/api/claude/analyze/route.ts |
| OPTIONS | /api/claude/analyze | CORS preflight | src/app/api/claude/analyze/route.ts |
| POST | /api/claude/chat | Claude chat | src/app/api/claude/chat/route.ts |
| POST | /api/claude/generate | Claude code generation | src/app/api/claude/generate/route.ts |
| OPTIONS | /api/claude/generate | CORS preflight | src/app/api/claude/generate/route.ts |
| GET | /api/claude/session | Get Claude session | src/app/api/claude/session/route.ts |
| GET | /api/code-completion | Get code completion | src/app/api/code-completion/route.ts |
| POST | /api/code-completion | Request code completion | src/app/api/code-completion/route.ts |
| GET | /api/code-server/session/[sessionId] | Get code-server session | src/app/api/code-server/session/[sessionId]/route.ts |
| DELETE | /api/code-server/session/[sessionId] | Delete code-server session | src/app/api/code-server/session/[sessionId]/route.ts |
| PATCH | /api/code-server/session/[sessionId] | Update code-server session | src/app/api/code-server/session/[sessionId]/route.ts |
| GET | /api/code-server/session | List code-server sessions | src/app/api/code-server/session/route.ts |
| POST | /api/code-server/session | Create code-server session | src/app/api/code-server/session/route.ts |
| GET | /api/containers/[id] | Get container | src/app/api/containers/[id]/route.ts |
| DELETE | /api/containers/[id] | Delete container | src/app/api/containers/[id]/route.ts |
| GET | /api/containers | List containers | src/app/api/containers/route.ts |
| POST | /api/containers | Create container | src/app/api/containers/route.ts |
| GET | /api/dashboard/ai-usage | AI usage dashboard | src/app/api/dashboard/ai-usage/route.ts |
| GET | /api/dashboard/overview | Dashboard overview | src/app/api/dashboard/overview/route.ts |
| GET | /api/dashboard/performance | Performance dashboard | src/app/api/dashboard/performance/route.ts |
| GET | /api/dashboard/status | Dashboard status | src/app/api/dashboard/status/route.ts |
| GET | /api/docker/status | Docker status | src/app/api/docker/status/route.ts |
| POST | /api/docker/status | Update Docker status | src/app/api/docker/status/route.ts |
| GET | /api/docs/search | Search docs | src/app/api/docs/search/route.ts |
| POST | /api/docs/search | Search docs | src/app/api/docs/search/route.ts |
| GET | /api/experiments | List experiments | src/app/api/experiments/route.ts |
| POST | /api/experiments | Create experiment | src/app/api/experiments/route.ts |
| GET | /api/files | List files | src/app/api/files/route.ts |
| POST | /api/files | Upload file | src/app/api/files/route.ts |
| PUT | /api/files | Update file | src/app/api/files/route.ts |
| DELETE | /api/files | Delete file | src/app/api/files/route.ts |
| OPTIONS | /api/files | CORS preflight | src/app/api/files/route.ts |
| GET | /api/files/sync | Get file sync status | src/app/api/files/sync/route.ts |
| POST | /api/files/sync | Sync files | src/app/api/files/sync/route.ts |
| OPTIONS | /api/files/sync | CORS preflight | src/app/api/files/sync/route.ts |
| POST | /api/gradio/run | Run Gradio app | src/app/api/gradio/run/route.ts |
| GET | /api/health/connection-pool | Connection pool health | src/app/api/health/connection-pool/route.ts |
| POST | /api/health/connection-pool | Test connection pool | src/app/api/health/connection-pool/route.ts |
| GET | /api/health/database/metrics | Database metrics | src/app/api/health/database/metrics/route.ts |
| GET | /api/health/database | Database health | src/app/api/health/database/route.ts |
| GET | /api/health/db | Database health (simple) | src/app/api/health/db/route.ts |
| GET | /api/health | Health check | src/app/api/health/route.ts |
| OPTIONS | /api/health | CORS preflight | src/app/api/health/route.ts |
| GET | /api/health/simple | Simple health check | src/app/api/health/simple/route.ts |
| GET | /api/health/vector-db | Vector DB health | src/app/api/health/vector-db/route.ts |
| GET | /api/health/vector-metrics | Vector DB metrics | src/app/api/health/vector-metrics/route.ts |
| GET | /api/healthz | Kubernetes health probe | src/app/api/healthz/route.ts |
| GET | /api/monitoring/azure-embedding | Azure embedding monitoring | src/app/api/monitoring/azure-embedding/route.ts |
| GET | /api/monitoring/cache | Cache monitoring | src/app/api/monitoring/cache/route.ts |
| POST | /api/monitoring/cache | Clear cache | src/app/api/monitoring/cache/route.ts |
| GET | /api/monitoring/connection-pool/dashboard | Connection pool dashboard | src/app/api/monitoring/connection-pool/dashboard/route.ts |
| POST | /api/monitoring/connection-pool/dashboard | Update connection pool config | src/app/api/monitoring/connection-pool/dashboard/route.ts |
| GET | /api/monitoring/dashboard | Monitoring dashboard | src/app/api/monitoring/dashboard/route.ts |
| GET | /api/monitoring/embeddings | Embeddings monitoring | src/app/api/monitoring/embeddings/route.ts |
| GET | /api/monitoring/metrics | System metrics | src/app/api/monitoring/metrics/route.ts |
| POST | /api/monitoring/metrics | Record metric | src/app/api/monitoring/metrics/route.ts |
| PUT | /api/monitoring/metrics | Update metric | src/app/api/monitoring/metrics/route.ts |
| GET | /api/monitoring/otel-config | OpenTelemetry config | src/app/api/monitoring/otel-config/route.ts |
| POST | /api/monitoring/otel-config | Update OpenTelemetry config | src/app/api/monitoring/otel-config/route.ts |
| GET | /api/monitoring/page-load | Page load monitoring | src/app/api/monitoring/page-load/route.ts |
| POST | /api/monitoring/page-load | Record page load | src/app/api/monitoring/page-load/route.ts |
| GET | /api/monitoring/performance | Performance monitoring | src/app/api/monitoring/performance/route.ts |
| POST | /api/monitoring/performance | Record performance | src/app/api/monitoring/performance/route.ts |
| GET | /api/monitoring/pool-alerts | Connection pool alerts | src/app/api/monitoring/pool-alerts/route.ts |
| GET | /api/monitoring/pool | Connection pool monitoring | src/app/api/monitoring/pool/route.ts |
| POST | /api/monitoring/pool | Update pool config | src/app/api/monitoring/pool/route.ts |
| GET | /api/monitoring/rum | Real user monitoring | src/app/api/monitoring/rum/route.ts |
| POST | /api/monitoring/rum | Record RUM data | src/app/api/monitoring/rum/route.ts |
| GET | /api/monitoring/security | Security monitoring | src/app/api/monitoring/security/route.ts |
| POST | /api/monitoring/security | Record security event | src/app/api/monitoring/security/route.ts |
| GET | /api/monitoring/traces | Distributed traces | src/app/api/monitoring/traces/route.ts |
| POST | /api/monitoring/traces | Record trace | src/app/api/monitoring/traces/route.ts |
| GET | /api/monitoring/user-journey | User journey tracking | src/app/api/monitoring/user-journey/route.ts |
| POST | /api/monitoring/user-journey | Record user journey | src/app/api/monitoring/user-journey/route.ts |
| GET | /api/monitoring/web-vitals | Core web vitals | src/app/api/monitoring/web-vitals/route.ts |
| POST | /api/monitoring/web-vitals | Record web vitals | src/app/api/monitoring/web-vitals/route.ts |
| GET | /api/ollama/models | List Ollama models | src/app/api/ollama/models/route.ts |
| POST | /api/ollama/models | Create Ollama model | src/app/api/ollama/models/route.ts |
| OPTIONS | /api/ollama/models | CORS preflight | src/app/api/ollama/models/route.ts |
| GET | /api/projects/template | Get project templates | src/app/api/projects/template/route.ts |
| POST | /api/projects/template | Create from template | src/app/api/projects/template/route.ts |
| GET | /api/readyz | Kubernetes readiness probe | src/app/api/readyz/route.ts |
| POST | /api/security/csp-report | CSP violation report | src/app/api/security/csp-report/route.ts |
| GET | /api/templates | List templates | src/app/api/templates/route.ts |
| POST | /api/templates | Create template | src/app/api/templates/route.ts |
| GET | /api/terminal/session | Get terminal session | src/app/api/terminal/session/route.ts |
| GET | /api/terminal/ws | Terminal WebSocket | src/app/api/terminal/ws/route.ts |
| POST | /api/upload | File upload | src/app/api/upload/route.ts |
| OPTIONS | /api/upload | CORS preflight | src/app/api/upload/route.ts |
| POST | /api/uploads/pdf | PDF upload | src/app/api/uploads/pdf/route.ts |
| GET | /api/user/preferences | Get user preferences | src/app/api/user/preferences/route.ts |
| POST | /api/user/preferences | Update user preferences | src/app/api/user/preferences/route.ts |
| GET | /api/vector-search | Vector search | src/app/api/vector-search/route.ts |
| POST | /api/vector-search | Perform vector search | src/app/api/vector-search/route.ts |
| GET | /api/vector-store | List vector store | src/app/api/vector-store/route.ts |
| POST | /api/vector-store | Add to vector store | src/app/api/vector-store/route.ts |
| PUT | /api/vector-store | Update vector store | src/app/api/vector-store/route.ts |
| DELETE | /api/vector-store | Delete from vector store | src/app/api/vector-store/route.ts |
| OPTIONS | /api/vector-store | CORS preflight | src/app/api/vector-store/route.ts |
| POST | /api/workspace/[id]/init-goose | Initialize Goose agent | src/app/api/workspace/[id]/init-goose/route.ts |
| GET | /api/workspace/auto-scaling | Get auto-scaling config | src/app/api/workspace/auto-scaling/route.ts |
| POST | /api/workspace/auto-scaling | Create auto-scaling config | src/app/api/workspace/auto-scaling/route.ts |
| PUT | /api/workspace/auto-scaling | Update auto-scaling config | src/app/api/workspace/auto-scaling/route.ts |
| DELETE | /api/workspace/auto-scaling | Delete auto-scaling config | src/app/api/workspace/auto-scaling/route.ts |
| PATCH | /api/workspace/auto-scaling | Patch auto-scaling config | src/app/api/workspace/auto-scaling/route.ts |
| GET | /api/workspaces/[id] | Get workspace | src/app/api/workspaces/[id]/route.ts |
| DELETE | /api/workspaces/[id] | Delete workspace | src/app/api/workspaces/[id]/route.ts |
| PATCH | /api/workspaces/[id] | Update workspace | src/app/api/workspaces/[id]/route.ts |
| GET | /api/workspaces | List workspaces | src/app/api/workspaces/route.ts |
| POST | /api/workspaces | Create workspace | src/app/api/workspaces/route.ts |

---

## Express AI Gateway Routes (19 endpoints)

**Base Path:** `/api/v1` (all routes are prefixed with this in production)

| HTTP Method | Route Path | Handler | Source File |
|------------|-----------|---------|------------|
| POST | /chat/completions | AIController.chatCompletion | services/ai-gateway/src/routes/ai-routes.ts:12 |
| POST | /chat/completions/stream | AIController.streamChatCompletion | services/ai-gateway/src/routes/ai-routes.ts:33 |
| GET | /models | AIController.getModels | services/ai-gateway/src/routes/ai-routes.ts:50 |
| GET | /models/:modelId | AIController.getModel | services/ai-gateway/src/routes/ai-routes.ts:64 |
| POST | /models/recommend | AIController.getModelRecommendations | services/ai-gateway/src/routes/ai-routes.ts:74 |
| POST | /models/select | AIController.selectModel | services/ai-gateway/src/routes/ai-routes.ts:90 |
| GET | /models/:modelId/metrics | AIController.getModelMetrics | services/ai-gateway/src/routes/ai-routes.ts:101 |
| GET | /usage | AIController.getUsageStatistics | services/ai-gateway/src/routes/ai-routes.ts:111 |
| GET | /usage/costs | AIController.getCostAnalysis | services/ai-gateway/src/routes/ai-routes.ts:125 |
| POST | /validate | AIController.validateCredentials | services/ai-gateway/src/routes/ai-routes.ts:138 |
| GET | /status | AIController.getServiceStatus | services/ai-gateway/src/routes/ai-routes.ts:148 |
| POST | /models/refresh | AIController.refreshModels | services/ai-gateway/src/routes/ai-routes.ts:154 |
| DELETE | /cache | AIController.clearCache | services/ai-gateway/src/routes/ai-routes.ts:160 |
| GET | /health | Basic health check | services/ai-gateway/src/routes/health-routes.ts:12 |
| GET | /health/detailed | Detailed health check | services/ai-gateway/src/routes/health-routes.ts:23 |
| GET | /health/ready | Kubernetes readiness probe | services/ai-gateway/src/routes/health-routes.ts:79 |
| GET | /health/live | Kubernetes liveness probe | services/ai-gateway/src/routes/health-routes.ts:108 |
| GET | /metrics | Basic metrics | services/ai-gateway/src/routes/metrics-routes.ts:12 |
| GET | /metrics/performance | Performance metrics | services/ai-gateway/src/routes/metrics-routes.ts:35 |
| GET | /metrics/usage | Usage metrics by time | services/ai-gateway/src/routes/metrics-routes.ts:54 |
| GET | /metrics/costs | Cost metrics | services/ai-gateway/src/routes/metrics-routes.ts:76 |
| GET | /metrics/prometheus | Prometheus metrics format | services/ai-gateway/src/routes/metrics-routes.ts:98 |

---

## aiohttp Agent API Routes (7 endpoints)

**Base URL:** `http://0.0.0.0:3284` (default)

| HTTP Method | Route Path | Handler | Source File |
|------------|-----------|---------|------------|
| GET | /health | AgentAPIServer.health_check | docker/agentapi/server.py:126 |
| GET | /metrics | AgentAPIServer.metrics_endpoint | docker/agentapi/server.py:141 |
| GET | /v1/agents | AgentAPIServer.list_agents | docker/agentapi/server.py:172 |
| POST | /v1/agents/start | AgentAPIServer.start_agent | docker/agentapi/server.py:184 |
| GET | /v1/agents/{agent_id}/status | AgentAPIServer.agent_status | docker/agentapi/server.py:311 |
| GET | /v1/agents/{agent_id}/stream | AgentAPIServer.stream_agent_output | docker/agentapi/server.py:322 |
| POST | /v1/agents/{agent_id}/stop | AgentAPIServer.stop_agent | docker/agentapi/server.py:351 |
| GET | /v1/terminals | AgentAPIServer.list_terminals | docker/agentapi/server.py:395 |

---

## Summary by Framework

| Framework | Endpoint Count | Primary Use Case |
|-----------|---------------|------------------|
| Next.js | 185 | Main application API (health, monitoring, AI, auth, workspaces, files) |
| Express | 19 | AI Gateway service (model management, chat completions, metrics) |
| aiohttp | 7 | Agent API (managing terminal-based AI coding agents) |
| **Total** | **211** | |

---

## Notes

- **Dynamic Routes:** Routes with `[param]` or `[...path]` are dynamic Next.js routes that accept path parameters
- **CORS:** Many Next.js endpoints include OPTIONS handlers for CORS preflight requests
- **Authentication:** Express AI Gateway routes use `requirePermission` middleware for authorization
- **Monitoring:** Extensive monitoring endpoints across all frameworks for observability
- **Disabled Endpoints:** Some endpoints (e.g., `/api/ai/upload.disabled`, `/api/ai/web-search.disabled`) appear to be feature-flagged or deprecated
- **Missing Endpoint:** The `/api/auth/[...nextauth]/route.ts` file uses NextAuth.js dynamic handlers and doesn't export standard HTTP methods

---

## Endpoint Categories

### AI & Chat (48 endpoints)
- Chat completions (streaming & non-streaming)
- Model management and selection
- AI search and web search
- Function calling
- Claude-specific endpoints
- HuggingFace integration
- LiteLLM integration
- Ollama integration

### Health & Monitoring (54 endpoints)
- Health checks (simple, detailed, database, vector DB, connection pool)
- Metrics (system, performance, RUM, web vitals)
- OpenTelemetry configuration
- Distributed tracing
- Security monitoring
- User journey tracking

### Authentication & Security (13 endpoints)
- NextAuth.js integration
- CSRF protection
- MFA (setup & verification)
- SAML SSO
- Login tracking
- CSP reporting

### Workspace & File Management (20 endpoints)
- Workspace CRUD
- File operations (list, upload, update, delete, sync)
- Container management
- Code-server sessions
- Auto-scaling configuration

### Agent Management (12 endpoints)
- Agent lifecycle (start, stop, status)
- Agent operations proxy
- Terminal sessions
- Goose agent initialization
- Agent output streaming

### Database & Storage (14 endpoints)
- MongoDB chat storage
- Vector search and storage
- Database health checks
- Connection pool management

### Dashboard & Analytics (10 endpoints)
- Dashboard overview
- AI usage analytics
- Performance analytics
- Status monitoring

### Templates & Projects (6 endpoints)
- Project templates
- Template CRUD
- Project generation

### Miscellaneous (34 endpoints)
- Document search
- PDF uploads
- User preferences
- Experiments
- Gradio integration
- Docker status
