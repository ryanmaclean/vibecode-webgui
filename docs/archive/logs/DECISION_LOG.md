# Decision Log

> **Purpose:** Document technical decisions and their rationale  
> **Last Updated:** 2025-09-29  
> **Extracted By:** Agent Cascade - Phase 19

This log captures architectural and technical decisions made during development.

---

## Infrastructure & Deployment

### Datadog Agentless Mode
**Date:** 2025-09-29  
**Decision:** Use agentless Datadog tracing for local development  
**Rationale:**
- Eliminates need for local Datadog agent installation
- Simplifies developer onboarding
- Reduces local resource usage
- Still captures full observability data

**Implementation:**
- Added `DD_AGENTLESS_ENABLED=true` flag in `src/instrument.ts`
- Traces sent directly to Datadog API
- No more ECONNREFUSED errors

**Trade-offs:**
- ✅ Simpler setup
- ✅ Fewer dependencies
- ⚠️ Requires valid API credentials
- ⚠️ Network dependency for traces

**Status:** Implemented and working  
**Owner:** Agent Claude Code

### Local pgvector Fallback for RAG Testing
**Date:** 2025-09-30  
**Decision:** Use the `vibecode-pgvector` Docker container as the default PostgreSQL endpoint for local RAG scripts when the Azure flexible server is unreachable.  
**Rationale:**
- Azure flexible server (`vibecode-pgflex-1758422944`) blocks direct laptop access (private endpoint / firewall)
- Waiting on networking fixes was stalling Datadog observability validation
- The local pgvector container already holds 225 embeddings from recent ingestion runs
- Switching `DATABASE_URL` unblocks agentless dd-trace smoke tests and LLM demos

**Implementation:**
- Updated `.env.local` to `postgresql://vibecode:vibecode123@192.168.107.2:5432/vibecode?schema=public&sslmode=disable`
- Verified container health with `docker exec vibecode-pgvector psql -U vibecode -d vibecode -c 'SELECT COUNT(*) FROM document_embeddings;'`
- Reran `npx tsx -r dd-trace/init scripts/rag-local-demo.ts` successfully; OpenRouter responded and tracer emitted spans

**Trade-offs:**
- ✅ Immediate unblock for local development
- ✅ No dependency on corporate networking during testing
- ⚠️ Local dataset may drift from production; requires periodic refresh
- ⚠️ Developers must ensure the container is running before executing scripts

**Status:** Implemented as interim workaround until Azure access returns  
**Owner:** Agent Codex

---

## Repository Organization

### File Organization Structure
**Date:** 2025-09-29  
**Decision:** Organize root directory into logical subdirectories  
**Rationale:**
- Root had 171 files, difficult to navigate
- Mixed concerns (scripts, configs, docs, tests)
- Hard to find specific file types

**Structure Decided:**
```text
scripts/          # All executable scripts
  debug/          # Debug and diagnostic scripts
docker/           # Dockerfiles and docker-compose files
configs/          # Configuration files
  datadog/        # Datadog-specific configs
  platforms/      # Platform configs (Azure, AWS, etc.)
k8s/              # Kubernetes manifests
  datadog/        # Datadog K8s resources
docs/             # Documentation
  reports/        # Test and validation reports
  guides/         # How-to guides
  summaries/      # Project summaries
  diagrams/       # Architecture diagrams
  logs/           # Activity and decision logs
```

**Implementation:**
- Phase 16: 51 files (scripts, Dockerfiles, configs, K8s)
- Phase 17: 23 .md files (reports, guides, summaries)
- Phase 18: 4 files (debug scripts, diagrams)

**Trade-offs:**
- ✅ Much cleaner root directory
- ✅ Easier to find files
- ✅ Logical grouping
- ⚠️ Longer paths for some files
- ⚠️ Need to update references

**Status:** Implemented (78 files organized)  
**Owner:** Agent Cascade

### Core Files in Root
**Date:** 2025-09-29  
**Decision:** Keep only essential files in root  
**Files Kept:**
- `README.md` - Project overview
- `CONTRIBUTING.md` - Contribution guidelines
- `TODO.md` - Current work tracking
- `AGENTS.md` - Agent guidelines
- `GEMINI.md` - AI assistant context

**Rationale:**
- These are the first files developers look for
- Standard locations expected by GitHub/tools
- Frequently accessed during development

**Status:** Implemented  
**Owner:** Agent Cascade

---

## Testing Strategy

### test:root:* Script Pattern
**Date:** 2025-09-29  
**Decision:** Maintain separate `test:root:*` scripts for different test scopes  
**Rationale:**
- GitHub Actions workflows need granular test control
- Different tests have different dependencies (Redis, Azure, etc.)
- Allows parallel test execution in CI
- Enables selective test runs

**Scripts:**
- `test:root:infrastructure` - Infrastructure tests
- `test:root:azure-embedding` - Azure embedding tests
- `test:root:ai` - AI/LLM tests
- etc.

**Trade-offs:**
- ✅ Granular control
- ✅ Faster CI (parallel execution)
- ✅ Clear test boundaries
- ⚠️ More scripts to maintain
- ⚠️ Need to keep in sync with workflows

**Status:** Verified and working  
**Owner:** Agent Claude Code

---

## Development Workflow

### Agent Coordination Protocol
**Date:** 2025-09-29  
**Decision:** Require agents to declare intent in TODO.md before file moves  
**Rationale:**
- Multiple agents were causing file conflicts
- No visibility into what others were doing
- Reverted work and wasted effort

**Protocol:**
1. **Read TODO.md** - Check what others are doing
2. **Declare Intent** - Add planned changes to TODO.md
3. **Claim Work Area** - Specify files/directories
4. **Execute** - Do the work and update status

**Implementation:**
- Added coordination section to TODO.md
- All agents follow 4-step process
- Clear "ACTIVE WORK AREAS" section

**Trade-offs:**
- ✅ Zero conflicts (100% success rate)
- ✅ Clear communication
- ✅ Parallel work possible
- ⚠️ Extra step before starting
- ⚠️ Requires discipline

**Status:** Implemented and proven  
**Owner:** Multi-agent collaboration

### TODO.md as Activity Log
**Date:** 2025-09-29  
**Decision:** Extract historical entries from TODO.md to separate logs  
**Rationale:**
- TODO.md grew to 1,269 lines
- Mix of current work and historical entries
- Hard to find active tasks
- Should focus on "what needs to be done"

**Solution:**
- Extract history to `docs/logs/` (activity, friction, decision, coordination)
- Keep TODO.md focused on current work (~200 lines)
- Preserve all context in proper documentation

**Trade-offs:**
- ✅ Cleaner TODO.md
- ✅ Better organized history
- ✅ Easier to find current work
- ⚠️ Need to check multiple files for full context

**Status:** In progress (Phase 19)  
**Owner:** Agent Cascade

---

## Patterns & Principles

### Prefer Full Implementations Over Stubs
**Source:** User preference (MEMORY)  
**Principle:** When fixing build/test issues, implement full modules rather than temporary stubs  
**Rationale:**
- Stubs accumulate technical debt
- Full implementations are more maintainable
- Better long-term code quality

**Application:** All monitoring, testing, and infrastructure code

### Keep Sequential Plans Updated
**Source:** User preference (MEMORY)  
**Principle:** Maintain clear, sequential plans in TODO.md  
**Rationale:**
- Helps coordinate multiple agents
- Provides clear progress tracking
- Enables better planning

**Application:** All major features and refactoring work

---

## Future Decisions Needed

### Database URL Management
**Question:** How to handle local vs production database URLs?  
**Options:**
1. Environment-specific .env files
2. DATABASE_URL_LOCAL pattern
3. Runtime detection and override

**Status:** Open for discussion

### Datadog Credential Rotation
**Question:** How to manage Datadog API key permissions?  
**Options:**
1. Document required permissions
2. Create role-specific keys
3. Implement key rotation process

**Status:** Blocked on credential access

### Monthly Maintenance Schedule
**Question:** Should we schedule regular repository cleanup?  
**Options:**
1. Monthly root directory audit
2. Quarterly dependency updates
3. Automated cleanup scripts

**Status:** Recommendation pending

### Local Database Fallback for RAG Testing
**Date:** 2025-09-30  
**Decision:** Point `.env.local` `DATABASE_URL` to the local `vibecode-pgvector` container when Azure Postgres is unreachable.  
**Rationale:**
- Azure flexible server access is currently blocked / offline.
- Local ingestion already populated 225 vectors in `vibecode-pgvector`.
- Enables continuing RAG verification and Datadog tracing exercises without waiting on Azure networking.

**Implementation:**
- Update `.env.local` to `postgresql://vibecode:vibecode123@<container-ip>:5432/vibecode`.
- Run `docker exec vibecode-pgvector ... COUNT(*)` to confirm row count.
- Execute `npx tsx -r dd-trace/init scripts/rag-local-demo.ts` against the local DB.

**Trade-offs:**
- ✅ Restores local RAG testing immediately.
- ✅ Keeps agentless Datadog spans flowing.
- ⚠️ Requires resetting `.env.local` once Azure is available again.
- ⚠️ Ingest data lives only in Docker volume, not the shared Azure instance.

**Status:** Active until Azure access is restored.  
**Owner:** Agent Codex

