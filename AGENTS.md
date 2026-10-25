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

## Moved out (2026-10 split)

Source commit for every move is `129302a73` (2026-10-24). Each target keeps a provenance note
("Moved from ryanmaclean/vibecode-webgui@<sha> on 2026-10-24"). The target copy is canonical. Where the
status says **pending**, the files are still tracked here until that removal PR merges. Do not edit them
here. Change the target repo instead.

| Content | Now in | Companion (merge commit) | Status here |
|---|---|---|---|
| Gas Town / Tundra-Dome runtime: `.gastown/`, `daemon/`, `td/`, `tundra-dome/`, `airflow/dags`, `settings/`, `plugins/datadog`, gastown/openclaw dashboards | `ryanmaclean/gt` (private, MIT) `imports/vibecode-webgui/` | gt#4 `21ec9061` | removed (#2141, #2142, #2143) |
| `infra/tundra-dome` and its workflows | `ryanmaclean/gt` | gt#5 `e647c650` | **pending** #2157 (waits on #2137) |
| Agent skills: `.claude/skills/{datadog-operations,gastown-ops,apple-silicon,openrouter-models,context-graph}`, `datadog-dashboard-ops.skill`, `.codex/personas` | `ryanmaclean/skills` (MIT) | skills#12 `18f030a2` (the owner later split datadog-operations and datadog-dashboard-ops out of skills main; full copy at that commit) | removed (#2144, #2145) |
| VM/microVM tooling: `scripts/vfkit`, VM benches and launchers, `tests/vm*`, `tests/acceptance`, `experiments/microvm`, `tools/nodejs-vm`, qemu, Apple VZ experiments | `ryanmaclean/smolfire` (Apache-2.0; MIT notice in `LICENSES/vibecode-webgui-MIT.txt`) `imports/vibecode/`, `experiments/apple-vz/` | smolfire#133 `f9a252fb` | removed (#2151) |
| Image builders: `infrastructure/packer`, kernel/initramfs/rootfs builders, kernel configs, release-testing | `ryanmaclean/genoa` (BSD-2-Clause; MIT notice kept) `imports/vibecode-webgui/` | genoa#5 `1078977c` | **pending** #2155 |
| Agent SDK (`tools/sdk` Python), `tools/ralph_loop`, `src/lib/ai-cli-tools` | `ryanmaclean/moth` (MIT) `contrib/vibecode/` | moth#6 `901274c7` | removed (#2140) |
| Historical docs, session logs, old reports, root `archive/`, `release-archive/`, `.agents/` | in tree: `docs/archive/` ([INDEX](docs/archive/INDEX.md)) | n/a | WS10: duplicates removed (#2164); fold #2165 |

The split plan and per-workstream results are in #2125 (comment "Split plan for vibecode-webgui").

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
