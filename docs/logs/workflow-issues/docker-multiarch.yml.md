# Workflow Report: codeserver-multiarch (Updated 2025-10-01)

- **Workflow file:** `.github/workflows/codeserver-multiarch.yml`
- **Status:** Re-enabled (nightly + path-triggered)
- **Last Run:** Pending (post-refactor awaiting merge)
- **Primary Owner:** Platform Observability (ryan.m)
- **Backup Owner:** Platform Build (alex.h)

## Trigger Matrix
| Trigger | Details |
| --- | --- |
| `schedule` | `cron: '15 5 * * *'` nightly smoke + publish |
| `push` | Paths: `docker/code-server/**`, `scripts/test-code-server-kind.sh`, `scripts/build-codeserver-multiarch.sh`, workflow file |
| `workflow_dispatch` | Manual hotfix or verification runs |

## Job Summary
1. **validate**
   - Checks out repo, runs `npm ci`, `npm run lint`, `npm run type-check`, and targeted unit tests.
   - Builds an `linux/amd64` validation image (`ci-<run id>`) with Buildx cache reuse (`scope=codeserver`).
   - Verifies aider/goose binaries inside the image.
   - Spins up KinD via `helm/kind-action@v1.10.0` and executes `scripts/test-code-server-kind.sh` (port-forward, NodePort, editor checks).
   - Uploads KinD diagnostics (`pods`, `deployment`, `logs`) as workflow artifacts.
2. **build-push**
   - Depends on `validate`; only runs on canonical repo.
   - Builds and pushes multi-arch image (`linux/amd64`, `linux/arm64`) with tags: `latest`, commit SHA, `ci-<run id>`, and `nightly` (for scheduled runs).
   - Enables Buildx provenance + SBOM export.
   - Verifies aider/goose on both architectures via `docker run --platform ...`.
   - Optionally emits Datadog metric `codeserver.build.duration` when `DD_API_KEY`/`DD_SITE` secrets exist.

## Observability Hooks
- Datadog metric stub present; telemetry blocked until secrets added (tracked in TODO queue).
- KinD diagnostics retained via uploaded artifacts (`kind-smoke-<run id>`).
- Release digest template referenced in `docs/handoff/code-server-release.md` for post-run summary.

## Known Gaps / Follow-ups
- Assign owners for Datadog alerts `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` (callout in TODO + shipping dashboard).
- Add telemetry emission to `scripts/test-code-server-kind.sh` (Datadog metric + event) once secrets provisioned.
- Monitor first nightly run for QEMU/arm64 runtime duration; adjust cache scope if Buildx thrashes.

## References
- `docs/handoff/code-server-release.md`
- `docs/handoff/shipping-dashboard.md`
- `docs/logs/issues/code-server-cloud-deployment.md`
- `scripts/test-code-server-kind.sh`
