# Canonical product surfaces

Status: accepted classification for the 2026 cleanup (#2125, #2126). Snapshot of `main` at 129302a73
(2026-10-24). It comes from the import-graph and reference mapping in the split plan
(`ryanmaclean/vibecode-webgui` cleanup, 2026-10-24) and from the open cleanup issues #2125-#2132.

This file only classifies surfaces. Deletions and moves happen in follow-up PRs that cite it.

## Status vocabulary

| Status | Meaning | What a change may do |
|---|---|---|
| `canonical` | The supported product path. CI builds and tests it. | Normal development. |
| `supported-secondary` | Kept working, with a narrower CI gate. | Fix and keep green; no new features without an issue. |
| `experiment` | Kept to learn from, not supported. | May be moved to the owning repo or deleted once nothing imports it. |
| `historical` | Kept as a record only. | Move under `docs/archive/`; never import or build it. |
| `generated` | Built or runtime output. | Untrack it and add a `.gitignore` rule. |
| `externalized` | Belongs to another repo. | Move it there; leave a pointer here. |
| `owner` | Status needs an owner decision. | Leave it in place until the decision is recorded. |

## Surfaces

| Surface | Path(s) | Status | Notes |
|---|---|---|---|
| Next.js web application | `src/app`, `src/components`, `src/lib`, `src/middleware.ts`, `next.config.mjs` | canonical | 256 page/route files (189 under `api`). |
| Server instrumentation hook | `src/instrumentation.ts`, `src/instrument.ts` | canonical | Next.js loads `src/instrumentation.ts` when `src/` exists. The root `instrumentation.ts` is a dead copy. |
| Database schema | `prisma/schema.prisma`, `prisma/migrations` | canonical | `prisma/schema-{agentapi,original,test}.prisma` have no references and are dead. |
| Test configs | `jest.config.js`, `playwright.config.ts`, `config/jest/` | canonical | `jest.config.js` is frozen while #2135 is held. |
| Web root static files | `public/` | canonical | `public/docs-index.json` is live (`/api/docs/search`). The Next.js placeholder SVGs and `public/index.html` are dead. The manual test pages belong under `tests/manual/`. |
| Tauri desktop app | `platforms/tauri`, `next.config.tauri.js` | supported-secondary | Built by `tauri-release.yml` and `npm run build:tauri`. |
| WebSocket/terminal server | `tools/server` | supported-secondary | `server/` is a byte-identical older copy of `tools/server/graceful-shutdown.js`. |
| macOS native shell | `platforms/macos/VibeCodeSwift`, `VibeCode-VMs`, `homebrew-vibecode` | supported-secondary | Live CI and sidecar. |
| CLIs | `vibecode` (bash), `cmd/vibecode` (Go), `packages/vibecode-cli` (Ink) | owner | Three overlapping CLIs. Recommendation: bash stays canonical until Go has parity. The `Makefile` targets a missing `./cmd/vibecode-demo`. |
| MCP and agent framework | `src/lib/mcp`, `src/lib/agent-framework`, `src/lib/gastown` | owner | `src/lib/mcp` has no importers. |
| Platform dashboards and container variants | `platforms/web-dashboard`, `platforms/docker`, `platforms/azure` | owner | Platform matrix: #2128. |
| VM configs | `config/vfkit`, `config/lima`, `config/colima`, cloud-init | owner | Runtime code itself is externalized (next row). |
| VM/microVM runtime and experiments | `scripts/vfkit`, `tests/vm*`, `experiments/microvm`, `fast-openvscode-vm`, `tools/nodejs-vm`, `swift/`, macOS VZ trees | externalized | Target: `ryanmaclean/smolfire` (#2130). |
| Image/rootfs builders | `infrastructure/packer`, `scripts/release-testing`, kernel/initramfs builders | externalized | Target: `ryanmaclean/genoa`. |
| Agent harness tools | `src/lib/ai-cli-tools`, `tools/sdk/python`, `tools/ralph_loop` | externalized | Target: `ryanmaclean/moth`. |
| Gas Town / Tundra-Dome runtime | `.gastown`, `daemon/`, `td/`, `tundra-dome/`, `infra/tundra-dome`, `airflow/dags`, `settings/` | externalized | Target: `ryanmaclean/gt` (private). |
| Agent skills | `.claude/skills/*` (generic ones), `.codex/personas` | externalized | Target: `ryanmaclean/skills`. |
| Electron app | `platforms/electron-vibecode` | historical | Replaced by Tauri (#488, #509). |
| Dead product code | `src/components/workflow`, `src/types/shared`, `src/lib/database`, `src/lib/prisma/client.ts`, root `index.html` | experiment | No app, route or script imports these. They are removed in the WS8 follow-up PR. |
| Test-only vector adapters | `src/lib/vector` | experiment | Only tests import it, one of them the quarantined `tests/integration/offline-vector-storage.test.ts`. It stays until that quarantine is resolved (#2135, #2138). The live vector code is `src/lib/vector-db` and `src/lib/vector-store.ts`. |
| Ad-hoc debug and verify scripts | `tools/debug`, `tools/test`, unreferenced `scripts/verify-*`, `scripts/test-*` | experiment | No references. Removed in WS8. |
| Build and runtime output | `node_modules/`, `vendor/`, `.next/`, test results, `*.tfstate`, `.opencode/`, `gitea/` | generated | Untracked by #2137, #2139 and WS2. |
| Old reports, session logs, release archives | `archive/`, `release-archive/`, `docs/archive/` | historical | One archive root: #2129. |

## Machine-readable form

```json
{
  "schema": "vibecode.canonical-surfaces.v1",
  "source_commit": "129302a73",
  "date": "2026-10-24",
  "canonical": ["src/app", "src/components", "src/lib", "src/middleware.ts", "src/instrumentation.ts", "src/instrument.ts", "next.config.mjs", "prisma/schema.prisma", "prisma/migrations", "public"],
  "supported_secondary": ["platforms/tauri", "next.config.tauri.js", "tools/server", "platforms/macos/VibeCodeSwift", "platforms/macos/VibeCode-VMs", "platforms/macos/homebrew-vibecode"],
  "owner": ["vibecode", "cmd/vibecode", "packages/vibecode-cli", "src/lib/mcp", "src/lib/agent-framework", "src/lib/gastown", "platforms/web-dashboard", "platforms/docker", "platforms/azure", "config/vfkit", "config/lima", "config/colima"],
  "externalized": {
    "ryanmaclean/smolfire": ["scripts/vfkit", "tests/vm", "tests/vm-integration", "tests/acceptance", "experiments/microvm", "fast-openvscode-vm", "tools/nodejs-vm", "swift"],
    "ryanmaclean/genoa": ["infrastructure/packer", "scripts/release-testing"],
    "ryanmaclean/moth": ["src/lib/ai-cli-tools", "tools/sdk/python", "tools/ralph_loop"],
    "ryanmaclean/gt": [".gastown", "daemon", "td", "tundra-dome", "infra/tundra-dome", "airflow/dags", "settings"],
    "ryanmaclean/skills": [".codex/personas"]
  },
  "historical": ["platforms/electron-vibecode", "archive", "release-archive", "docs/archive"],
  "experiment_test_only": ["src/lib/vector"],
  "experiment_dead": ["src/components/workflow", "src/types/shared", "src/lib/database", "src/lib/prisma/client.ts", "index.html", "instrumentation.ts", "server", "tools/debug", "tools/test"]
}
```

## Follow-ups

- WS8 (dead product code, scripts, tests): removes the `experiment_dead` entries after `tsc --noEmit` and
  `next build` confirm nothing breaks.
- #2127: dependency pruning, including the broken `generate:chatbot-data` and `lima:*` npm scripts.
- #2128: platform matrix for the `owner` platform rows.
- #2129: archive consolidation.
- #2130: repo boundaries for the `externalized` rows.
