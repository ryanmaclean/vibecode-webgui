# VibeCode Architecture

## Overview

VibeCode is an AI-powered development platform that provides a cloud-based VS Code experience with integrated AI capabilities. This document outlines the overall system architecture and the Model Context Protocol (MCP) server design.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     VibeCode Platform                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   MCP Server │  │   Backend    │      │
│  │  Next.js 15  │◄─┤   (stdio)    ├─►│   API Layer  │      │
│  │  React 19    │  │   Tools      │  │   Services   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼───────┐    │
│  │           Shared Infrastructure Layer               │    │
│  │  • Vector Search (pgvector + ChromaDB)             │    │
│  │  • AI Services (OpenAI, Anthropic, etc)            │    │
│  │  • Code Analysis & Completion                       │    │
│  │  • Workspace Management                             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                   │                   │
    ┌────▼───┐          ┌───▼────┐         ┌───▼────┐
    │ Monaco │          │ Vector │         │  K8s   │
    │ Editor │          │   DB   │         │ Pods   │
    └────────┘          └────────┘         └────────┘
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Monaco Editor 0.53.0 with Monacopilot

**Backend:**
- Node.js 18+
- Express.js
- Next.js API Routes
- WebSocket (Socket.io)

**AI Infrastructure:**
- LangChain (AI orchestration)
- Vector Databases: pgvector (PostgreSQL) + ChromaDB
- Embedding Models: OpenAI, Azure OpenAI
- LLM Providers: OpenAI, Anthropic, Gemini, Groq, DeepSeek

**Storage:**
- PostgreSQL 16 + pgvector (HNSW indexes)
- Redis (caching, rate limiting)
- MongoDB (optional document store)

**Infrastructure:**
- Kubernetes (AKS)
- Docker
- Helm Charts
- code-server (browser-based VS Code)

**Monitoring:**
- Datadog (APM, DBM, RUM, Logs)
- OpenTelemetry
- Prometheus

## Core Capabilities

### 1. Code Editing
- Monaco Editor with AI completion (Monacopilot)
- Inline edit suggestions (Cmd+K)
- Multi-language support
- Syntax highlighting and IntelliSense

### 2. AI Code Intelligence
- **Smart Code Completion**: Context-aware suggestions using LangChain
- **Natural Language to Code**: Generate code from descriptions
- **Code Analysis**: Security, performance, quality checks
- **Semantic Search**: Vector-based code search across projects

### 3. Workspace Management
- Multi-workspace support
- Project templates (React, Next.js, Python, Go, Rust)
- File synchronization
- Terminal access

### 4. Vector Search & Embeddings
- Semantic code search using pgvector + ChromaDB
- Hybrid search (semantic + keyword)
- Automatic code embedding and indexing
- Context retrieval for AI operations

### 5. Testing & Deployment
- Automated test execution
- CI/CD integration
- Kubernetes deployment
- Environment management (dev/staging/prod)

## Data Flow

### AI Code Completion Flow
```
User Input → Monaco Editor → Smart Completion Service
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    │                                     │
            Context Analysis                      Vector Search
                    │                                     │
                    └──────────────┬──────────────────────┘
                                   ↓
                            LangChain Pipeline
                                   ↓
                      ┌────────────┴────────────┐
                      │                         │
              OpenAI API              Local Knowledge Base
                      │                         │
                      └────────────┬────────────┘
                                   ↓
                          Ranked Suggestions
                                   ↓
                            Monaco Editor
```

### Vector Search Flow
```
Code Query → Embedding Service → Query Embedding
                                        ↓
                            ┌───────────┴───────────┐
                            │                       │
                    pgvector Search      ChromaDB Search
                            │                       │
                            └──────────┬────────────┘
                                       ↓
                            Hybrid Ranking Algorithm
                                       ↓
                            Semantic Search Results
```

## Security Architecture

### Authentication
- NextAuth.js with multiple providers
- JWT tokens
- Session management
- 2FA support (TOTP)

### Authorization
- Role-based access control (RBAC)
- Workspace-level permissions
- API key management
- Rate limiting (Upstash Redis)

### Data Protection
- Secrets management (environment variables)
- Database encryption at rest
- TLS/HTTPS in transit
- Secret scanning in CI/CD

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers
- Load balancing via Kubernetes
- Distributed caching (Redis)
- Database connection pooling

### Performance Optimization
- Edge caching (Vercel Edge)
- Lazy loading components
- Code splitting
- CDN for static assets

### Resource Management
- Kubernetes resource limits
- Auto-scaling policies
- Rate limiting per user/workspace
- Database query optimization (HNSW indexes)

## Monitoring & Observability

### Metrics
- Request latency (P50, P95, P99)
- Error rates
- Database query performance
- Vector search latency

### Logging
- Structured JSON logs
- Request tracing (OpenTelemetry)
- Error tracking
- Audit logs

### Alerting
- Performance degradation
- Error rate thresholds
- Resource exhaustion
- Security incidents

## Integration Points

### External Services
- GitHub API (repository integration)
- OpenRouter (LLM gateway)
- LiteLLM (multi-provider proxy)
- Hugging Face (model inference)

### MCP Clients
- Windsurf IDE
- Claude Desktop
- Aider
- Goose
- Cursor

## Future Architecture Considerations

### Planned Enhancements
1. Multi-tenant workspace isolation
2. Real-time collaboration (CRDT)
3. Plugin/extension marketplace
4. Advanced code analysis (AST-based)
5. Custom model fine-tuning

### Technical Debt
- Consolidate vector database implementations
- Refactor authentication layer
- Improve error handling consistency
- Add comprehensive E2E tests

## Related Documentation
- [MCP Server Architecture](./mcp/MCP_SERVER_ARCHITECTURE.md)
- [MCP Integration RFC](./mcp/MCP_INTEGRATION_RFC.md)
- [Deployment Guide](../docker/code-server/DEPLOYMENT_GUIDE.md)
