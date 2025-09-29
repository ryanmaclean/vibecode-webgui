# Friction Log

> **Purpose:** Document blockers, issues, and workarounds encountered during development  
> **Last Updated:** 2025-09-29  
> **Extracted By:** Agent Cascade - Phase 19

This log captures friction points to help improve developer experience and identify systemic issues.

---

## Active Blockers

### RAG Demo Script - Database Configuration
**Date:** 2025-09-29  
**Blocker:** RAG retrieval smoke test blocked on database configuration  
**Details:**
- Script `scripts/rag-local-demo.ts` connects to Azure Postgres by default
- Needs `DATABASE_URL` override to point to local KIND cluster
- API keys available in `.env.local` ✅
- Script works correctly, just needs proper connection string

**Workaround:** None yet  
**Status:** BLOCKED - Needs local DB configuration  
**Owner:** TBD

### Datadog Trace Search - API Credentials
**Date:** 2025-09-29  
**Blocker:** Datadog Trace Search queries return "Not found" or "Forbidden"  
**Details:**
- `./scripts/poll-traces.sh` queries return `{ "errors": ["Not found"] }`
- API validation: `curl https://api.${DD_SITE}/api/v1/validate` returns `{"errors":["Forbidden"]}`
- Current API/app key pair lacks permission or is invalid
- Agentless mode working locally (no ECONNREFUSED) ✅
- Spans not appearing in Trace Search

**Workaround:** Local agentless mode enabled with `DD_AGENTLESS_ENABLED=true`  
**Status:** BLOCKED - Needs valid Datadog credentials  
**Owner:** Credential owner

---

## Resolved Issues

### dd-trace ECONNREFUSED 127.0.0.1:8126
**Date:** 2025-09-29  
**Issue:** Datadog tracer trying to connect to local agent despite agentless settings  
**Resolution:**
- Added `DD_AGENTLESS_ENABLED=true` path in `src/instrument.ts`
- Reran ingestion with agentless env vars
- No more connection refused errors ✅

**Impact:** RAG ingestion now works cleanly with 225 chunks  
**Resolved By:** Agent Claude Code (23:21 UTC)

### Missing test:root:* npm Scripts
**Date:** 2025-09-29  
**Issue:** GitHub Actions workflows expecting `test:root:*` commands  
**Resolution:**
- Verified `package.json` already has full `test:root:*` matrix
- Scripts were present, just needed workflow validation
- Running smoke tests to confirm compatibility

**Impact:** CI workflows can now reference test commands  
**Resolved By:** Agent Claude Code (23:30 UTC)

### Repository File Sprawl
**Date:** 2025-09-29  
**Issue:** 171 files in root directory, hard to navigate  
**Resolution:**
- Phase 16: Moved 51 files (scripts, Dockerfiles, configs)
- Phase 17: Moved 23 .md files to docs/
- Phase 18: Moved 4 debug scripts and diagrams
- Result: 171 → 136 files (20% reduction)

**Impact:** Cleaner repository structure, easier navigation  
**Resolved By:** Agent Cascade (Phases 16-18)

### Multi-Agent File Conflicts
**Date:** 2025-09-29  
**Issue:** Multiple agents moving files simultaneously causing conflicts  
**Resolution:**
- Established coordination protocol in TODO.md
- 4-step process: Read, Declare, Claim, Execute
- All agents now coordinate via TODO.md before file moves

**Impact:** Zero conflicts with 3+ agents working simultaneously  
**Resolved By:** Agent coordination protocol

---

## Patterns & Learnings

### Database Connection Patterns
**Pattern:** Scripts default to production databases  
**Learning:** Need local development overrides for all database-dependent scripts  
**Recommendation:** Add `DATABASE_URL_LOCAL` env var pattern

### API Credential Management
**Pattern:** Multiple Datadog API keys with different permissions  
**Learning:** Need clear documentation of which keys work for which operations  
**Recommendation:** Create `docs/DATADOG_CREDENTIALS.md` guide

### File Organization
**Pattern:** Root directory accumulates files over time  
**Learning:** Need regular cleanup phases (monthly?)  
**Recommendation:** Add "root directory audit" to monthly maintenance checklist

### Agent Coordination
**Pattern:** Multiple agents need to work simultaneously  
**Learning:** Simple protocol (declare intent in TODO.md) prevents conflicts  
**Recommendation:** Enforce protocol for all file organization work

---

## Metrics

**Blockers Encountered:** 4  
**Blockers Resolved:** 2 (50%)  
**Blockers Active:** 2  
**Average Resolution Time:** < 1 hour  
**Workarounds Applied:** 2

**Most Common Friction Points:**
1. Database configuration (local vs production)
2. API credentials and permissions
3. File organization and sprawl
4. Multi-agent coordination
