# WS10 docs consolidation manifests (2026-10-25)

Part of the vibecode-webgui split plan (#2125 phase 2, #2129). WS10 makes `docs/archive/` the single
archive root. Each PR in the WS10 series adds its manifest here. All files are TSV with a header row.

| File | PR | Content |
|---|---|---|
| `dedupe-removed.tsv` | WS10 1 (dedupe) | `blob_sha, bytes, removed_path, kept_path`: exact duplicates removed from the tip. The removed copy and the kept copy had the same git blob id at base `24e77ca06`. |
| `dedupe-relinks.tsv` | WS10 1 (dedupe) | `file, old_link, new_link`: relative Markdown links repointed from a removed copy to its kept copy. |
| `fold-moves.tsv` | WS10 2 (fold) | `old_path, new_path`: every rename into `docs/archive/` (and `SERVICE_DEPENDENCIES.md` to `docs/architecture/`, release notes to `docs/releases/v5.1.0-beta/`). |
| `fold-relinks.tsv` | WS10 2 (fold) | Relative Markdown links rewritten because the linking file or its target moved. |
| `fold-deleted.tsv` | WS10 2 (fold) | Generated output removed from the tip (now in `.gitignore`). |
| `images-removed.tsv` | WS10 3 (entrypoints) | Large unreferenced image removed from the tip, with blob id. |

## How the kept copy is chosen

The live location wins: anything outside the archive families first, then `docs/src/content/docs/`, then
the other live `docs/` trees, then `docs/archive/`, then `docs/historical|reports|wiki|logs`, then
`docs/sessions/`, root `archive/` and `release-*`. Ties go to the shortest path. Empty files, `.gitkeep`,
`.gitignore` and `__init__.py` are never treated as duplicates.

Deferred: groups where the removed or kept path is touched by a still-open PR (#2152, #2154, #2159).
A later WS10 PR handles them after those PRs land.

## Verify

```sh
base=24e77ca06
tail -n +2 docs/reports/repo-cleanup-2026-10/ws10-docs/dedupe-removed.tsv |
while IFS="$(printf '\t')" read -r sha bytes removed kept; do
  [ "$(git rev-parse "$base:$removed")" = "$sha" ] && [ "$(git rev-parse "$base:$kept")" = "$sha" ] || echo "MISMATCH $removed"
done
```

No output means every row is hash-proven. Kept copies whose own links were repointed (listed in
`dedupe-relinks.tsv`) differ from the base blob only in those link targets.
