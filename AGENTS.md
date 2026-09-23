# AGENTS.md

## Role

VibeCode is the user-facing IDE/control surface. Keep it focused on developer experience, UI, editor integration, and product-facing orchestration views.

## Owns

- web/desktop IDE experience
- editor, terminal, browser, and workspace UI
- user-facing MCP/tool integration
- application/browser observability
- product packaging and supported client surfaces

## Do not duplicate

Before adding new infrastructure, consult these sibling repos:

- `ryanmaclean/bop` — work/card/run identity and orchestration
- `ryanmaclean/moth` — tiny reusable agent execution harness
- `ryanmaclean/smolfire` — smallest microVM/runtime substrate and storage research
- `ryanmaclean/genoa` — image/artifact build, deployment, verification, receipts
- `ryanmaclean/skills` — workflow/policy/skills layer
- `ryanmaclean/agent-jail` — BSD jail-based agent isolation
- `ryanmaclean/dd-agent-FreeBSD` — prior FreeBSD Datadog compatibility work

Avoid adding another:
- scheduler/work database
- actor/subagent runtime
- VM/image factory
- provider quota router
- canonical lineage store
- tiny-runtime telemetry client

unless a VibeCode-specific requirement is demonstrated.

## Current cleanup map

- #2125 repository hygiene
- #2126 canonical product surfaces
- #2127 dependency pruning
- #2128 platform/infrastructure consolidation
- #2129 docs/archive deduplication
- #2130 sibling-repo integration boundaries
- #2131 observability consolidation

## Agent delegation

- Primary GitHub coding agent: Copilot when available.
- Fallback: delegate issue/PR work to Codex with `@codex`.
- Keep canonical work state in GitHub issues/BOP/filesystem state, not in agent conversation state.


## Binding cross-project constraints

Before proposing architecture or cross-project primitives, read:

- `ryanmaclean/skills/docs/CONSTRAINTS.md`
- `ryanmaclean/skills/docs/RESEARCH-INDEX.md`
- this repo's `.project.toml`

Do not repeat research already indexed unless new evidence or requirements materially change the conclusion.

New architecture proposals must identify:
- the invariant uniquely owned by the new layer
- why a lower existing layer cannot own it
- what duplicated state or layer the proposal removes

Key constraints include:
- visibility is not durability
- identity, order, content hash, and presentation remain distinct
- ordering has one source
- retries reuse logical operation identity
- queues/rings are transport, not semantics
- derived views are disposable
- push invariants down; pull policy up
- formalize durable primitives before RTL/FPGA
- RISC-V is optional control plane, not the v0 datapath
- ASIC requires measured FPGA justification
