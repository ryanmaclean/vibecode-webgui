# Code-Server CI Observability Runbook (Draft)

_Last updated: 2025-10-01 — Tracking GitHub issue #412_

## Metrics
- `codeserver.build.duration` (gauge): emitted at the end of `.github/workflows/codeserver-multiarch.yml` with tags `workflow:codeserver-multiarch`, `repo:<owner/repo>`, `run:<run_id>`.
- `codeserver.build.success` (gauge): emits `1` upon successful build promotion.
- `codeserver.kind.latency` (gauge): emitted by `scripts/test-code-server-kind.sh` after KinD smoke with tags `cluster:<name>`, `image:<tag>`, `run:<run_id>`.
- `codeserver.kind.success` (gauge): emits `1` when KinD smoke passes.

## Events
- Build completion: `code-server build complete` with run metadata.
- KinD smoke success: `code-server KinD smoke success` with cluster/image context.

## Dashboards & Monitors
- Dashboard: **code-server-shipping** (include new widgets for build/kind metrics).
- Monitors:
  - `codeserver.build.duration.p95` — Warn > 12 min, Page > 25 min (owner: Platform Build).
  - `codeserver.kind.smoke.failure` — Warn success < 98% over 6h, Page on first failure (owner: Observability).
  - Missing data monitor (>2 consecutive runs without build metrics) routed to `#codeserver-ci`.

## Artefact Retention
- GitHub Actions retains the last 30 `kind-smoke-<run>` artefacts.
- Full KinD logs exported to `s3://vibecode-ci-artifacts/kind/<date>/<sha>` with a 60-day lifecycle policy.

## Runbook Steps
1. **Validate metrics**: `datadog-ci metrics query codeserver.build.duration --tags workflow:codeserver-multiarch` to confirm ingestion.
2. **Investigate alert**:
   - Review the latest workflow run logs.
  - Sync S3 artefacts via `aws s3 sync s3://vibecode-ci-artifacts/kind/<date>/<sha> ./kind-logs`.
  - Check dashboards for latency/error anomalies.
3. **Communicate**: update `#release-ops`, note findings in the incident ticket, resolve monitors after mitigation.

## References
- `.github/workflows/codeserver-multiarch.yml`
- `scripts/test-code-server-kind.sh`
- `docs/handoff/code-server-release.md`
- `docs/handoff/shipping-dashboard.md`
- `TODO.md` (Observability Callouts)
