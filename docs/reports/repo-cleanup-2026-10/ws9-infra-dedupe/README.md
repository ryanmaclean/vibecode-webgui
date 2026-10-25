# WS9 infra/config/observability dedupe (2026-10-24)

Part of the vibecode-webgui split plan (issues #2125, #2128, #2131). This change is in-repo only and has
no companion repo. Base: main 45b66abb0.

`removed.tsv` lists every path that WS9 deletes, with its git blob SHA-1 at the base commit. When a
byte-identical copy stays in the tree, `identical_copy_kept` names it. The `part` column gives the PR
that removes the path. History keeps every file (`git show 45b66abb0:<path>`).

| part | content |
|---|---|
| 1 | `infrastructure/ops/` (duplicate tree), `etc_sudoers.d_lima`, `.dockerignore.enhanced`, `azure/build-unified-services-with-datadog.sh`; root `monitoring/.../ci-health.json` moves to `infrastructure/monitoring/datadog/dashboards/` |
| 2 | dated Datadog exports under `infrastructure/datadog/`; exact duplicates in `config/alternatives/` and `config/platforms/` |
| 3-5 | `config/data/uploads/` (upload-route test output); `config/data/doc_sources.json` moves to `tests/fixtures/`; `platforms/macos/macos-*` duplicate trees |
| 6 | unreferenced infra leaves archived in-tree (moves, not deletions) |

Notes:

- `platforms/macos/macos-native-build/` duplicates `platforms/macos/native-build/`. WS5 (#2151) moves that
  copy to ryanmaclean/smolfire.
- `platforms/macos/macos-vm/Sources/main.swift` is an older revision of
  `platforms/macos/vm/Sources/main.swift`. The kept file is a superset (#1937).
- Live infra is untouched: `infrastructure/{terraform,monitoring,kubernetes,gitops,postgres,arm}`,
  `config/datadog`, `config/templates` and `deploy/helm`.
- The `config/alternatives` backups `eslint.config.mjs.backup`, `fix-merge-conflicts.sh.backup` and
  `jest.config.mjs.backup` are left to #2137.
