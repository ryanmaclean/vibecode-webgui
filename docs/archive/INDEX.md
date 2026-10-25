# Archive index

`docs/archive/` is the single archive root of this repo (WS10 of the 2026-10 split plan, #2125 phase 2,
#2129). Everything here is **historical**: session logs, old reports, superseded guides and retired build
trees. It is not part of the docs site build, it is not linted, and Jest ignores it. Current docs live
elsewhere under `docs/`.

- Machine-readable: [`INDEX.json`](INDEX.json) (schema `vibecode.docs-archive-index.v1`) and the
  per-file [`INDEX.tsv`](INDEX.tsv) (`path, original_path, last_changed, origin`).
- Source commit for every move and date: `24e77ca06`. `last_changed` is the date of the last commit that
  touched the original path before WS10.
- 1146 files, 469 of them moved here by WS10. Exact duplicates were removed first; the manifest
  with blob ids is `docs/reports/repo-cleanup-2026-10/ws10-docs/dedupe-removed.tsv`.
- Do not add new material here unless it is historical. A file that becomes current again moves out
  and leaves a pointer.

## Sections

| Section | Files | Changed (first to last) | Original location |
|---|---|---|---|
| [`agent-briefs/`](agent-briefs/) | 22 | 2026-01-31 to 2026-01-31 | .agents |
| [`agent-reports-2026-01/`](agent-reports-2026-01/) | 218 | 2026-01-07 to 2026-04-30 | docs/archive/agent-reports-2026-01 |
| [`agents/`](agents/) | 15 | 2025-10-28 to 2025-10-28 | docs/archive/agents |
| [`archive/`](archive/) | 28 | 2025-10-28 to 2025-10-31 | docs/archive/archive |
| [`benchmark-results/`](benchmark-results/) | 1 | 2026-01-20 to 2026-01-20 | docs/archive/benchmark-results |
| [`consolidated-wiki/`](consolidated-wiki/) | 86 | 2025-10-28 to 2026-04-30 | docs/archive/consolidated-wiki |
| [`content/`](content/) | 127 | 2026-01-20 to 2026-04-30 | docs/archive/content |
| [`experiments/`](experiments/) | 2 | 2026-01-20 to 2026-01-20 | docs/archive/experiments |
| [`historical/`](historical/) | 40 | 2025-10-27 to 2025-10-28 | docs/historical |
| [`implementation-reports/`](implementation-reports/) | 4 | 2025-10-28 to 2026-04-30 | docs/archive/implementation-reports |
| [`incomplete-script-consolidation/`](incomplete-script-consolidation/) | 6 | 2025-10-28 to 2025-10-28 | docs/archive/incomplete-script-consolidation |
| [`infra-1024/`](infra-1024/) | 45 | 2026-10-25 to 2026-10-25 | archive |
| [`logs/`](logs/) | 76 | 2025-10-27 to 2025-10-28 | docs/logs |
| [`old-reports/`](old-reports/) | 24 | 2025-10-28 to 2025-10-28 | docs/archive/old-reports |
| [`releases/`](releases/) | 3 | 2026-01-31 to 2026-05-07 | release-v5.1.0-beta |
| [`releases-index/`](releases-index/) | 3 | 2026-02-13 to 2026-02-13 | release-archive |
| [`reports/`](reports/) | 156 | 2025-10-27 to 2026-10-25 | docs/reports, docs/archive/reports |
| [`root-cleanup/`](root-cleanup/) | 23 | 2026-02-05 to 2026-02-07 | archive |
| [`root-docs/`](root-docs/) | 3 | 2026-01-20 to 2026-10-25 | .env.ide.example, SECURITY-AUDIT.md, SPEC_SHEET.md |
| [`root-md-files/`](root-md-files/) | 60 | 2025-10-28 to 2026-04-30 | docs/archive/root-md-files |
| [`sessions/`](sessions/) | 144 | 2025-10-28 to 2026-04-30 | docs/sessions |
| [`status-reports/`](status-reports/) | 8 | 2025-10-28 to 2025-10-28 | docs/archive/status-reports |
| (top-level files) | 20 | 2025-10-28 to 2026-04-30 | docs/archive/ |
| [`vibecode-v1.4a-package/`](vibecode-v1.4a-package/) | 6 | 2026-01-20 to 2026-01-20 | docs/archive/vibecode-v1.4a-package |
| [`wiki/`](wiki/) | 26 | 2025-10-27 to 2026-02-03 | docs/archive/wiki, docs/wiki |

## Folded in by WS10

| Old location | Now |
|---|---|
| `docs/sessions/` | `docs/archive/sessions/` |
| `docs/historical/` | `docs/archive/historical/` |
| `docs/wiki/` | `docs/archive/wiki/` (merged; no name collisions) |
| `docs/logs/` | `docs/archive/logs/` |
| `docs/reports/` (static reports) | `docs/archive/reports/` (merged). `docs/reports/CLEANUP_AUDIT_REPORT.md` and `docs/reports/repo-cleanup-2026-*` stay live |
| `archive/` (root) | `docs/archive/` (`archive/root-cleanup/` is now `docs/archive/root-cleanup/`) |
| `release-archive/` | `docs/archive/releases-index/` |
| `release-v5.1.0-beta/*.py` | `docs/archive/releases/v5.1.0-beta/` (the release notes went to `docs/releases/v5.1.0-beta/`) |
| `.agents/` | `docs/archive/agent-briefs/` |
| `.env.ide.example`, `SPEC_SHEET.md`, `SECURITY-AUDIT.md` | `docs/archive/root-docs/` |
| `archive/infra-1024/` (WS9, #2163) | `docs/archive/infra-1024/` (its own INDEX.md lists each leaf) |

`docs/feature-audit/` and `docs/feature-audits/` stay live because `tests/feature-audit/` reads them (#2168). Still at the old
path because an open PR edits it: `archive/root-cleanup/secret.yaml` (#2139, empty file) and `RELEASE_PROCESS.md` (#2155).
`feature_audit/`, `docs/test_output.txt` and `docs/branches-to-delete.txt` were generated output. They
were deleted and are now in `.gitignore`.
