# Workflow Report: codeserver-multiarch (Updated 2025-10-01)

- **Workflow file:** `.github/workflows/codeserver-multiarch.yml`
- **Status:** Refactored (awaiting first nightly post-merge)
- **Last manual run:** 2025-10-01 05:52 UTC (validation only)
- **Primary owner:** Platform Build rotation (`@ryan.m`)
- **Backup owner:** Observability rotation (`@alex.h`)

## Triggers
| Trigger | Details |
| --- | --- |
| `schedule` | `cron: '15 5 * * *'` nightly validation + promotion |
| `push` | Paths: `docker/code-server/**`, `scripts/test-code-server-kind.sh`, `scripts/build-codeserver-multiarch.sh`, workflow file |
| `workflow_dispatch` | Manual hotfix / verification runs |

## Job Overview
1. **validate**
   - Executes repository QA (`npm ci`, `npm run lint`, `npm run type-check`, `npm run test:unit -- --runInBand`).
   - Builds a multi-arch CI tag (`ghcr.io/<owner>/vibecode-codeserver:ci-<run id>`) with Buildx cache reuse.
   - Verifies aider/goose in both `linux/amd64` and `linux/arm64` containers via `docker run --platform ...`.
   - Runs `scripts/test-code-server-kind.sh` against the CI tag (script now patches deployment image when `CODE_SERVER_IMAGE` set).
   - Uploads KinD diagnostics (`pods`, `describe`, `logs`) as artifacts.
2. **build-push**
   - Canonical repo only; promotes the CI tag to `latest`, commit SHA, and `nightly` (for scheduled runs) using `docker buildx imagetools create`.
   - Generates an SBOM (`sbom-code-server.spdx.json`) for the CI tag and uploads it as an artifact.

## Observability Hooks
- Workflow emits `codeserver.build.duration`/`codeserver.build.success` when Datadog secrets are present (GitHub issue #412).
- KinD smoke script publishes `codeserver.kind.latency`/`codeserver.kind.success` metrics + event when `datadog-ci` is available.
- KinD logs retained as `kind-smoke-<run id>` artifacts; confirm retention ≥14 days.
- Release digest template lives in `docs/handoff/code-server-release.md`; ensure each run appends an entry.

## Outstanding Actions
- [ ] Assign alert owners for `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` (tracked in TODO + shipping dashboard).
- [ ] Add Datadog metric/event emission inside `scripts/test-code-server-kind.sh` once secrets land.
- [ ] Monitor first nightly run for QEMU performance; adjust Buildx cache scope if arm64 build time spikes.
- [ ] Add lint to clean up old `ci-*` tags in GHCR weekly.

## References
- `.github/workflows/codeserver-multiarch.yml`
- `docs/handoff/code-server-release.md`
- `docs/handoff/shipping-dashboard.md`
- `docs/logs/issues/docker-multiarch-audit.md`
- `scripts/test-code-server-kind.sh`

- **Update 2025-10-01:** Dockerfile now verifies SHA256 sums for helm/kubectl/kubectx/kubens before copying binaries; update issue #416 with validation links.
