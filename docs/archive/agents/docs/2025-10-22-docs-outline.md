# Documentation Outline – MCP + MicroVM Updates

## 1. demos/README.md
- Add sections:
  - "Fast OpenVSCode Releases" – stable vs insiders, download links, SHA verification.
  - "Automated Packaging" – describe new CI workflow and how to trigger.
  - "Nightly Verification" – link to checklist, emphasize MCP health check.

## 2. AGENTS.md
- Summaries of:
  - Roundtable CLI helper usage (`scripts/roundtable/run-roundtable.sh`).
  - Day 0 task table reference (`archive/agents/2025-10-22-mcp-roundtable-plan.md`).
  - MCP sequential API testing instructions.

## 3. Release Notes (new file under `docs/releases/`)
- Sections:
  - Highlights (handshake fix, benchmarks, release automation).
  - Upgrade steps (download artifacts, verify SHA, run smoke test).
  - Verification (refers to nightly checklist).

## Pending Inputs
- Final release workflow details (from Codex-Release).
- Benchmark metrics (from Codex-Benchmarks).
- Verification checklist (from Codex-Verification).
