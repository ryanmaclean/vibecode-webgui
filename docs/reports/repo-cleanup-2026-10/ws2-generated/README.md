# WS2: generated, vendored and binary artifacts (2026-10-24)

Part of the #2125 cleanup and the 2026-10-24 repo split plan. Pure removals
from the tip. Nothing is moved to another repo, and history keeps every blob
(`removed.tsv` lists the blob sha of each removed path).

Before and after manifests come from `scripts/repo-inventory.nu`
(schema `vibecode.repo-inventory/v1`, cherry-picked unchanged from #2137):

| | tracked files | tracked bytes |
|---|---|---|
| before (`inventory-before.json`, main 129302a73) | 10,303 | 220,907,315 |
| after (`inventory-after.json`) | 9,084 | 183,518,589 |

1,221 files and 37,396,141 bytes were removed (about 17% of the tree). The PR
adds 2 files: this report's script and a Tauri README.

## What was removed and why it is safe

| Path | Files | Why it can go |
|---|---|---|
| `vendor/` | 1,191 | `go build ./cmd/vibecode` passes on Go 1.23.12 without it, both with `-mod=mod` and with the default mode that `release-assets.yml` uses, for linux/amd64, linux/arm64, darwin/arm64 and windows/amd64. `go.mod` and `go.sum` are unchanged and `go mod verify` passes. |
| `bun.lock`, `extensions/workspace-rag/bun.lock` | 2 | CI and the Dockerfiles use npm with `package-lock.json`. These files were force-added past `**/*.lock`. |
| `td/bin/td`, `vibecode-vm-dist` | 2 | Compiled binaries. `td/scripts/build.sh` rebuilds `td/bin/td`. |
| `fast-openvscode-vm-arm64/vmlinuz-ubuntu` | 1 | A saved HTTP 404 page, not a kernel. |
| `platforms/tauri/resources/extensions/workspace-rag-1.0.0.vsix` | 1 | A `vsce package` output. `install-extensions.sh` skips when no VSIX is present, and `tauri.conf.json` does not bundle the directory. |
| `platforms/kubernetes/helm/vibecode-platform/charts/datadog-3.60.0.tgz` | 1 | `helm dependency build` restores it from `Chart.lock`. The mongodb archive stays committed (see the chart README). |
| `.opencode/`, `airflow/airflow.db` | 4 | Local SQLite state. Scanned: gitleaks 8.30.1 found nothing, and the keyword hits are schema column names only. |
| `tests/results/`, `docs/archive/playwright-report/`, `docs/archive/logs/` | 8 | Test and run output. |
| `extensions/claude-code-vscode/`, `extensions/plugins/continue-vibe.ts`, `docs/docs/package-lock.json` | 3 | A package.json-only stub, an empty file and an 83-byte stub lockfile. The code-server Dockerfile `COPY` lines for the stub are replaced by a comment. |
| `platforms/azure/azure/SwiftUI-Apps/*.app`, `*.png`, `playwright-screenshots/` | 8 | A compiled macOS app bundle and screenshot evidence. The `test-results/` screenshots are removed in #2137, not here. |

`.gitignore` gains a matching WS2 block, so these paths stay out of the tree.

## Licence note (owner decision)

`vendor/` redistributed MPL-2.0 code: `hashicorp/errwrap` and
`hashicorp/go-multierror`, which dd-trace-go pulls in as transitive
dependencies. Untracking `vendor/` ends that redistribution from this repo.
`go.sum` still pins both modules, and builds fetch them from the Go module
proxy. Whether that is acceptable for vibecode (MIT), or whether dd-trace-go
should be dropped from `cmd/vibecode`, is an owner call. Every other vendored
module is Apache-2.0, BSD or MIT.
