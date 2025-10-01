# Code-Server Release Handoff

_Last updated: 2025-10-01_

## 1. Purpose
Provide a single source of truth for releasing the VibeCode multi-architecture `code-server` image (linux/amd64 and linux/arm64), including cadence, validation gates, observability hooks, and escalation paths.

## 2. Release Cadence & Ownership
- **Primary DRI:** Platform Build rotation (`@ryan.m` week of 2025-09-29). Backup: Observability rotation (`@alex.h`).
- **Ship window:** Wednesdays by 17:00 UTC (aligns with Americas QA Thursday AM).
- **Nightly guardrail:** Scheduled `codeserver-multiarch` run (05:15 UTC) ensures images stay healthy between releases.
- **Hotfix policy:** Trigger manual `workflow_dispatch` with Slack notice in `#platform-observability` and record the run in the release digest.

## 3. Latest Artifacts
| Tag | Architecture | Digest | Notes |
| --- | --- | --- | --- |
| `ghcr.io/ryanmaclean/vibecode-codeserver:latest` | multi-arch manifest | `sha256:8a1081edb149fd4aa501f0538d91157e371784a4e7bdabd7c7432a35b038a136` | Pushed 2025-10-01 05:52 UTC via `scripts/build-codeserver-multiarch.sh`. |
| `...:latest-arm64` | linux/arm64 | (auto from manifest) | Validated with KinD + aide/goose CLI checks. |
| `...:latest-amd64` | linux/amd64 | (auto from manifest) | Validated with KinD + aide/goose CLI checks. |

> Update this section after every successful release or manual rebuild.

## 4. Release Day Checklist (Wednesdays)
1. Confirm the previous night’s scheduled run succeeded (GitHub → Actions → `codeserver-multiarch`).
2. Re-run the workflow if commits touched `docker/code-server/**`, `scripts/test-code-server-kind.sh`, or AI tooling packages since the nightly build.
3. Validate gates:
   - `npm run lint`, `npm run build`, `npm run type-check`, `npm run test:unit`, `npm run test:integration` completed for both architectures.
   - `scripts/test-code-server-kind.sh` passed (port-forward + NodePort + editor/aider/goose checks).
   - Optional: `npm run test:production:smoke` (Playwright) on AMD64, and `npm run test:e2e -- --project arm64` on ARM runner if available.
4. Review Datadog dashboard **Code-Server Shipping** for build duration, smoke latency, and alert status.
5. Update the daily digest file under `docs/logs/releases/code-server/` using the template below and link to workflow run.
6. Announce completion in `#shipping-dashboard` with summary + blockers.

### Release Digest Template
```
# Code-Server Release – <YYYY-MM-DD>
- Commit Range: <start…end>
- Lead Engineer: <name>
- Architectures: linux/amd64, linux/arm64
- Workflow Run: <GitHub URL>
- Smoke Test: scripts/test-code-server-kind.sh ✅/❌ (logs link)
- Additional QA: <Playwright/Manual notes>
- Observability: dashboards reviewed, alerts acknowledged
- New Features / Upgrades: ...
- Known Issues / Mitigations: ...
- Follow-ups: [ ] Owner – Action – Due date
```

## 5. Runbook (GitHub Actions `codeserver-multiarch`)
1. **Triggers**
   - Push affecting `docker/code-server/**`, `scripts/test-code-server-kind.sh`, `.github/workflows/codeserver-multiarch.yml`.
   - Nightly cron `15 5 * * *`.
   - Manual `workflow_dispatch` for hotfixes.
2. **Jobs**
   - `build-test` (matrix: amd64, arm64) → Build via Buildx, run repository checks, execute aide/goose smoke script inside container, upload SBOM + size metrics.
   - `kind-smoke` → Load amd64 image into KinD, run `scripts/test-code-server-kind.sh`, publish logs & Datadog metrics (`codeserver.kind.latency`, `codeserver.kind.success`).
   - `publish` → Push multi-arch manifest, tag `latest`, `nightly`, and `${GITHUB_SHA}`. Requires success from previous jobs.
3. **Caching**
   - Buildx cache keyed by `codeserver-${{ matrix.arch }}` stored via `cache-from/to type=gha, scope=codeserver`.
4. **Outputs & Artifacts**
   - Digest text file for each arch.
   - KinD smoke logs and port-forward output.
   - Release digest stub.

## 6. Observability & Alerting
- Metrics: `codeserver.build.duration`, `codeserver.build.success`, `codeserver.kind.smoke.latency`, `codeserver.kind.smoke.success` (export via Datadog CI statsd).
- Dashboards: `code-server-shipping`, `infra-k8s-cost`, `multiarch-builds` (assign on-call owner each release).
- Alerts (must stay green before release):
  - Build duration p95 < 25m.
  - Nightly build failure rate < 2% rolling 6h.
  - KinD smoke failure immediate page (PagerDuty: Platform Build).
  - Missing coordination events (heartbeat) > 6h during active release window.

## 7. Escalation Matrix
| Symptom | Immediate Action | Escalation |
| --- | --- | --- |
| Buildx/QEMU failure | Retry with `--no-cache`; if reproducible, switch builder to native arch host | Ping Platform Build rotation → open incident if two runs fail |
| Registry auth error | Rotate `GHCR_PUSH_TOKEN` secret | Escalate to DevSecOps (`@sec-ops`) |
| KinD smoke failure | Inspect `kind-smoke.log`; re-run locally; if failing on optional tools, disable optional layer and document | Notify Observability + create TODO entry |
| Telemetry missing | Run `npm run monitoring:trace` to verify; check Datadog API key; file issue | Observability rotation |

## 8. Related References
- `docs/logs/workflow-issues/docker-multiarch.yml.md`
- `docs/logs/issues/code-server-cloud-deployment.md`
- `docs/handoff/shipping-dashboard.md`
- `docker/code-server/MULTIARCH_BUILD.md`
- `scripts/build-codeserver-multiarch.sh`
- `scripts/test-code-server-kind.sh`
- `TODO.md` (Status at a Glance → Release Blockers)

Update this document anytime workflow triggers, cadence shifts, or ownership rolls change.
