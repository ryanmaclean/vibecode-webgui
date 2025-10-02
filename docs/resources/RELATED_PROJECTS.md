# Related Projects and External Resources

This document catalogs external projects, frameworks, and resources that relate to VibeCode's architecture, features, or ecosystem. These projects may provide architectural inspiration, complementary functionality, or alternative approaches to similar problems.

---

## Agent Orchestration

### CodeArkt

**Repository:** https://github.com/IlyaGusev/codearkt
**License:** Apache-2.0
**Language:** Python 3.12+
**Status:** Active (updated 2025-10-01)

**Description:**
Battery-included implementation of the CodeAct agentic framework with multi-agent orchestration, secure Docker sandboxing, and MCP server integration. Provides hierarchical manager/worker patterns for autonomous agent coordination with event-driven observability.

**Key Features:**
- Multi-agent hierarchies with configurable iteration limits
- Secure Python execution via ephemeral Docker containers
- MCP tool auto-discovery and registration
- Event bus architecture with OpenTelemetry integration
- Gradio web UI and terminal client
- Production-ready with strict typing (mypy --strict)

**Relevance to VibeCode:**
- Demonstrates hierarchical agent orchestration patterns potentially applicable to multi-workspace collaboration
- Shows secure code execution architecture via Docker sandboxing (reference for terminal security enhancements)
- Provides event-driven observability patterns for AI operations monitoring
- Example of MCP server integration in Python ecosystem (complementary to VibeCode's TypeScript implementation)
- Planning interval concept could inspire long-running AI operation management

**When to Use:**
- Research multi-agent coordination patterns for future VibeCode features
- Study secure execution environments for untrusted code
- Reference for Python-based AI agent development alongside VibeCode
- Learn event bus patterns for AI operation observability

**When NOT to Use:**
- Direct integration with VibeCode (language mismatch: Python vs TypeScript)
- Replacing VibeCode's existing MCP implementation
- IDE features (CodeArkt focuses on autonomous agents, not editor integration)

**Evaluation Report:** See `docs/integrations/CODEARKT_EVALUATION.md` for comprehensive analysis (issue #396)

---

## Model Context Protocol (MCP) Ecosystem

### Official MCP Resources

**Repository:** https://github.com/modelcontextprotocol
**License:** MIT
**Specification:** https://spec.modelcontextprotocol.io

**Description:**
Open protocol for connecting AI assistants to data sources and tools. VibeCode implements MCP server functionality at `src/mcp/server.ts`.

**VibeCode MCP Tools:**
- Code analysis and generation
- Workspace management
- Testing integration
- Deployment operations

**Related MCP Projects:**
- **MCP TypeScript SDK:** `@modelcontextprotocol/sdk` (used by VibeCode)
- **MCP Python SDK:** For Python-based tool servers (e.g., CodeArkt)
- **Community MCP Servers:** Various domain-specific tool implementations

---

## AI-Powered Development Tools

### Continue

**Repository:** https://github.com/continuedev/continue
**License:** Apache-2.0

**Description:**
Open-source AI code assistant with IDE integration. Available as VibeCode extension.

**Relevance to VibeCode:**
- Complementary tool for AI-assisted coding workflows
- Example of LLM integration patterns in editor context

### Codeium

**Website:** https://codeium.com
**License:** Proprietary (free tier available)

**Description:**
AI-powered code completion and chat. Available as VibeCode extension.

**Relevance to VibeCode:**
- Alternative AI completion provider
- Demonstrates autocomplete API integration patterns

### Aider

**Repository:** https://github.com/paul-gauthier/aider
**License:** Apache-2.0

**Description:**
AI pair programming tool with Git integration. Can be used in VibeCode terminals.

**Relevance to VibeCode:**
- Git-aware AI editing patterns
- Command-line workflow integration

---

## Code Execution and Sandboxing

### code-server

**Repository:** https://github.com/coder/code-server
**License:** MIT

**Description:**
VS Code in the browser. Used by VibeCode for cloud workspace functionality.

**Integration Status:** ✅ INTEGRATED
- Deployed via Docker: `docker/code-server/`
- Kubernetes deployment: `k8s/code-server/`
- Documentation: `docker/code-server/DEPLOYMENT_GUIDE.md`

**Relevance to VibeCode:**
- Core component for browser-based development environment
- Provides remote editor capabilities

### Docker

**Website:** https://www.docker.com
**License:** Apache-2.0 (open-source components)

**Description:**
Container platform for isolated execution environments.

**Integration Status:** ✅ INTEGRATED
- Used for code-server deployment
- Reference in CodeArkt evaluation for secure code execution patterns

**Relevance to VibeCode:**
- Current deployment target
- Potential future use for terminal sandboxing (inspired by CodeArkt)

---

## Vector Search and Embeddings

### pgvector

**Repository:** https://github.com/pgvector/pgvector
**License:** PostgreSQL License

**Description:**
Open-source vector similarity search for PostgreSQL.

**Integration Status:** ✅ INTEGRATED
- Used for semantic code search in VibeCode
- HNSW index implementation for efficient similarity queries

**Relevance to VibeCode:**
- Core component for codebase chat and semantic search features
- Enables "Ask questions about your code" functionality

### Weaviate

**Repository:** https://github.com/weaviate/weaviate
**License:** BSD-3-Clause

**Description:**
Cloud-native vector database.

**Integration Status:** ✅ INTEGRATED (via `@langchain/weaviate`)

**Relevance to VibeCode:**
- Alternative vector storage backend
- Used in LangChain integration workflows

---

## Monitoring and Observability

### Datadog

**Website:** https://www.datadoghq.com
**License:** Proprietary

**Description:**
Cloud monitoring and observability platform.

**Integration Status:** ✅ INTEGRATED
- APM (Application Performance Monitoring)
- DBM (Database Monitoring)
- RUM (Real User Monitoring)
- Log aggregation

**Relevance to VibeCode:**
- Production monitoring infrastructure
- Observability patterns for distributed systems

### OpenTelemetry

**Repository:** https://github.com/open-telemetry
**License:** Apache-2.0

**Description:**
Vendor-neutral observability framework.

**Integration Status:** ✅ INTEGRATED
- Used alongside Datadog for distributed tracing
- Configured at `scripts/setup-opentelemetry.ts`

**Relevance to VibeCode:**
- Standard observability instrumentation
- Event-driven patterns (see CodeArkt evaluation for agent-specific patterns)

---

## Kubernetes and Infrastructure

### KinD (Kubernetes in Docker)

**Repository:** https://github.com/kubernetes-sigs/kind
**License:** Apache-2.0

**Description:**
Tool for running local Kubernetes clusters using Docker containers.

**Integration Status:** ✅ SUPPORTED
- Test environment for VibeCode Kubernetes deployments
- Quick start: `kind create cluster --name vibecode`

**Relevance to VibeCode:**
- Local development and testing infrastructure
- Validates Kubernetes deployment configurations

### Helm

**Repository:** https://github.com/helm/helm
**License:** Apache-2.0

**Description:**
Kubernetes package manager.

**Integration Status:** ✅ SUPPORTED
- Helm charts for VibeCode deployment (future roadmap)
- Test coverage: `npm run test:k8s:helm`

**Relevance to VibeCode:**
- Production deployment packaging
- Infrastructure as code patterns

---

## Contributing

To add a project to this list:

1. **Verify Relevance**: Ensure the project relates to VibeCode's architecture, features, or ecosystem
2. **Required Information:**
   - Repository URL and license
   - Clear description of functionality
   - Specific relevance to VibeCode (with examples)
   - Integration status (integrated, evaluated, reference-only)
3. **Evaluation Process:**
   - For integration candidates, create evaluation document in `docs/integrations/`
   - Include license compatibility analysis
   - Document decision rationale (vendor/fork/reference/none)
4. **Submit PR** with addition to appropriate section

**Categories:**
- Agent Orchestration (autonomous agents, multi-agent systems)
- MCP Ecosystem (Model Context Protocol tools and servers)
- AI Development Tools (code assistants, completion engines)
- Code Execution (sandboxing, container runtimes)
- Vector Search (semantic search, embeddings)
- Monitoring (observability, tracing, metrics)
- Infrastructure (Kubernetes, deployment tools)

---

## License Compatibility Reference

| License | Compatible with MIT | Attribution Required | Notes |
|---------|---------------------|----------------------|-------|
| **MIT** | ✅ Yes | Optional (best practice) | Same as VibeCode |
| **Apache-2.0** | ✅ Yes | Yes (NOTICE file) | Stronger patent protection |
| **BSD-3-Clause** | ✅ Yes | Yes | Similar to MIT with endorsement clause |
| **PostgreSQL** | ✅ Yes | Yes | Similar to MIT/BSD |
| **Proprietary** | ⚠️ Terms-dependent | Varies | Check license agreement |
| **GPL/AGPL** | ❌ No | N/A | Copyleft incompatible with MIT |

**Guidance:**
- ✅ MIT, Apache-2.0, BSD: Safe for integration with proper attribution
- ⚠️ Proprietary: Review terms carefully, often integration/API use only
- ❌ GPL/AGPL: Reference only, no code integration

---

**Document Maintained By:** VibeCode Team
**Last Updated:** 2025-10-01
**Related Issues:** #396 (CodeArkt evaluation)
