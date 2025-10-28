# Code-Server Release Handoff (Updated 2025-10-01)

## Purpose
Centralise the cadence, validation, and observability expectations for shipping the VibeCode `code-server` multi-arch image so Platform Build and Observability can hand off cleanly.

## Cadence & Ownership
- **Weekly ship window:** Wednesdays by 17:00 UTC (Americas QA ready Thursday morning).
- **Nightly guardrail:** GitHub Actions workflow `codeserver-multiarch` runs at 05:15 UTC to catch regressions between releases.
- **Hotfix protocol:** Trigger `workflow_dispatch`, announce in `#platform-observability`, and append the run to the release digest.
- **DRI rotation:** Platform Build primary, Observability secondary (see `docs/handoff/shipping-dashboard.md`).

## Release-Day Checklist (Wednesdays)
1. Confirm the most recent nightly run succeeded (GitHub → Actions → `codeserver-multiarch`).
2. Ensure code changes touching `docker/code-server/**`, `scripts/test-code-server-kind.sh`, or the workflow have landed before triggering release.
3. Validate automated gates:
   - `npm run lint`, `npm run type-check`, `npm run test:unit -- --runInBand` (executed in the workflow `validate` job).
   - `scripts/test-code-server-kind.sh` KinD smoke (port-forward, NodePort, editor/aider/goose checks).
   - `docker run --platform linux/amd64|arm64 <ci tag> bash -lc "aider --version && goose -version"` steps succeed.
4. Review Datadog dashboards (Code-Server Shipping, Infra Cost Control) and acknowledge any open alerts.
5. Complete the release digest entry (template below) under `docs/logs/releases/code-server/<YYYY-MM-DD>.md` and link to the workflow run.
6. Post summary + outstanding risks in `#shipping-dashboard`.

### Release Digest Template
```
# Code-Server Release – <YYYY-MM-DD>
- Commit Range: <start…end>
- Lead Engineer: <name>
- Workflow Run: <GitHub Actions URL>
- Architectures: linux/amd64, linux/arm64
- KinD Smoke: scripts/test-code-server-kind.sh ✅/❌ (link to artifact)
- Observability: dashboards reviewed, alerts acknowledged (list)
- New Tooling / Upgrades: …
- Known Issues / Mitigations: …
- Follow-ups: [ ] Owner – Action – Due Date
```

## Version & Tag Policy
- Cross-check nightly/tag status via the shipping dashboard's ["Version & Cross-Links"](./shipping-dashboard.md#version--cross-links) section before promoting a new image.
- **Stable tags:** `ghcr.io/<owner>/vibecode-codeserver:latest` and commit SHA tags promote only after the Ops sign-off checklist is completed.
- **Nightly tag:** `:nightly` updates solely from the scheduled run; if a night fails, retain the previous nightly tag and record the miss in the release digest.
- **Canary tags (planned):** `:amd64-canary` and `:arm64-canary` will stage traffic ahead of `:latest` once Release Engineering finalises safeguards (see staging cues in [`docs/handoff/shipping-dashboard.md`](./shipping-dashboard.md#version--cross-links)).
- **Release digests:** Each run logs to `docs/logs/releases/code-server/<YYYY-MM-DD>.md`; reference that entry in the `#shipping-dashboard` announcement.
- **Rollback guidance:** Pending Ops update—will live in a dedicated subsection under the Rollback Trigger Matrix once authored.

## Cross-References
- Shipping dashboard snapshot: [`docs/handoff/shipping-dashboard.md`](./shipping-dashboard.md#version--cross-links) (owner roster, cadence, nightly status).
- Optional tooling audit: `docs/logs/issues/docker-multiarch-audit.md` (architecture guard rationale).
- Workflow tracker: `docs/logs/workflow-issues/docker-multiarch.yml.md` (job breakdown, observability hooks).
- AI tooling parity plan: [`docs/tooling/ai-tooling-parity.md`](../tooling/ai-tooling-parity.md) (GH issue #413).
- Observability runbook: [`docs/observability/codeserver-ci.md`](../observability/codeserver-ci.md) (GH issue #412).

## Canary & Promotion Safeguards (Release Engineering Draft)
- Confirm planned canary staging windows against the shipping dashboard's ["Version & Cross-Links"](./shipping-dashboard.md#version--cross-links) before flipping traffic.
- **Tag staging:** promote builds first to `:amd64-canary` / `:arm64-canary`, hold for a 60-minute observation window, then manually approve promotion to `:latest` via GitHub Actions environment protection.
- **Success criteria:** <1% HTTP 5xx, <5% p95 latency regression versus prior stable, CPU/RAM variance within ±10%, synthetic checks green on both architectures.
- **Rollback triggers:** Any success metric breaching threshold for ≥5 minutes, Datadog alert severity ≥ Warning, or Playwright smoke failure against canary URL—re-tag previous stable and re-run smoke before reopening promotion.
- **Test matrix per arch:** lint → type-check → unit → build → integration (`npm run test:integration`) → KinD smoke → Playwright (`npm run test:e2e`), followed by `npm run test:production:smoke` post-promotion.
- **Observability hooks:** record canary annotations in Datadog, capture before/after snapshots, archive approval metadata with the release digest entry.

## Release Sign-off & Approvers
- **Primary Approver:** Avery Chen (Platform Build) – on hook for the weekly ship window and final release sign-off.
- **Backup Approver:** Jordan Lee (Observability) – covers the window when the primary is OOO and owns telemetry/alert validation.
- **Escalation Manager:** Sasha Gomez (Platform Ops) – confirms rollback decision and coordinates cross-team comms.

### Sign-off Checklist (complete between 15:00–17:00 UTC)
1. Validate the release digest draft includes commit range, KinD smoke status, and Datadog summary for the run.
2. Confirm all automated gates in the latest workflow run are green and no retry steps exceeded 2 attempts.
3. Review Datadog monitors `codeserver.build.duration.p95`, `codeserver.kind.smoke.failure`, and `codeserver.deploy.error`—acknowledge or remediate any active alerts.
4. Check `TODO.md` for open code-server items; move stale entries (older than 14 days) to Archive or assign a new owner/date.
5. Capture the sign-off note in `docs/logs/releases/code-server/<YYYY-MM-DD>.md` and post the confirmation thread in `#shipping-dashboard` with workflow + digest links.
6. Notify the backup approver of completion; if primary signs off, backup adds an emoji confirmation, and vice versa.

## Rollback Trigger Matrix
### Rollback Playbook
1. **Preconditions:** Publish pipeline validation failure, customer incident tied to new image, on-call directive to revert, or product approval to restore previous stable tag.
2. **Identify good digest:** `docker buildx imagetools inspect ghcr.io/${OWNER}/vibecode-codeserver:stable --raw` → copy the `sha256` of the last known-good multi-arch manifest.
3. **Re-tag canary:** `docker buildx imagetools create --tag ghcr.io/${OWNER}/vibecode-codeserver:amd64-canary --tag ghcr.io/${OWNER}/vibecode-codeserver:arm64-canary --digest sha256:<digest>`
4. **Re-tag stable:** `docker buildx imagetools create --tag ghcr.io/${OWNER}/vibecode-codeserver:latest --tag ghcr.io/${OWNER}/vibecode-codeserver:stable --digest sha256:<digest>` (repeat if separate arch manifests maintained).
5. **Disable publish job:** In GitHub Actions → `codeserver-multiarch` → “Disable workflow” or edit `publish` job permissions to `if: false` until post-mortem complete.
6. **Re-run validation only:** Trigger workflow dispatch selecting “validation-only” inputs or run ``gh workflow run codeserver-multiarch.yml --ref main --field validate_only=true`` (requires CLI inputs patch).
7. **Communications:**
   - Post in `#release-ops` Slack thread with root cause, commands executed, ETA for recovery.
   - Create/update incident ticket (`OPS-####` in Jira) documenting digest, commands, workflow status.
   - Add rollback note to `docs/logs/releases/code-server/<date>.md` referencing the incident ticket.
8. **Post-rollback validation:**
   - Run `npm run test:unit`, `npm run test:integration`, `npm run test:production:smoke`.
   - Provision staging workspace using restored tag; confirm logs show success.
   - Check Datadog monitors (`codeserver.build.duration.p95`, `codeserver.kind.smoke.failure`) returned to baseline; attach screenshots to incident ticket.
9. **Close-out:** Update Slack + incident once validation complete, re-enable publish job, schedule follow-up retro.

| Trigger | Signal | Required Action | Approver | Notes |
| --- | --- | --- | --- | --- |
| Build artefact regression | Automated KinD smoke fails ≥ 2 consecutive steps or helper bin mismatch | Pause promotion, rebuild with previous passing commit, rerun KinD smoke | Primary Approver | Backup handles communication while primary reruns workflow |
| Latency or error spike | `codeserver.build.duration.p95` or `codeserver.kind.smoke.failure` monitor breaching | Initiate rollback branch, disable deploy job, open incident bridge | Backup Approver | Escalation Manager coordinates Datadog + Slack updates |
| Customer-impacting bug | Support or customer escalation tied to new image | Re-tag prior stable release as `latest`, publish hotfix plan | Escalation Manager | Primary and backup co-sign decision in incident log |
| Supply chain alert | GH Advisory or SBOM scan flags high-severity CVE in dependencies | Stop deployments, notify SecOps, prepare patched build | Primary Approver | Roll forward only after SecOps `ok-to-ship` |

## TODO Hygiene Cadence
- Every Monday 16:00 UTC, the primary approver leads a 15-minute async sweep of `TODO.md` and the shipping dashboard open actions, tagging owners with refreshed due dates.
- Backup approver reviews the automation surfacing (see `TODO.md`) each weekday at 09:00 local time and flags items older than 10 business days in `#platform-ops-sync`.
- Record completed clean-ups in `docs/logs/COORDINATION_LOG.md` under the "code-server" section for traceability.

## Workflow Runbook (`.github/workflows/codeserver-multiarch.yml`)
1. **Triggers**
   - Pushes touching `docker/code-server/**`, `scripts/test-code-server-kind.sh`, `scripts/build-codeserver-multiarch.sh`, or the workflow itself.
   - Nightly cron `15 5 * * *`.
   - Manual `workflow_dispatch` for hotfix validation.
2. **Jobs**
   - `validate`
     - `npm ci`, lint, type-check, and targeted unit tests.
     - Build `linux/amd64` validation image tagged `ci-<run id>` with Buildx cache scope `codeserver`.
     - Verify aider/goose binaries and run KinD smoke via `helm/kind-action` + `scripts/test-code-server-kind.sh`.
     - Upload KinD diagnostics (`pods`, `describe`, `logs`) as artifacts.
   - `build-push`
     - Depends on `validate`; guarded to run on canonical repo only.
     - Builds and pushes multi-arch manifest with tags: `latest`, commit SHA, `ci-<run id>`, and `nightly` (cron only).
     - Generates provenance/SBOM and verifies aider/goose on amd64 + arm64 using QEMU emulation.
     - Emits Datadog metric (`codeserver.build.duration`) when `DD_API_KEY` / `DD_SITE` secrets are present.
3. **Caching**
   - Buildx cache stored via `type=gha,scope=codeserver` for reuse across jobs and runs.
4. **Artifacts**
   - `kind-smoke-<run id>` (KinD diagnostics).
   - SBOM (`sbom-code-server.spdx.json`).
   - GitHub Step Summary lists pushed tags for quick auditing.

## Blockers & Escalation Paths
| Symptom | Immediate Action | Escalate To |
| --- | --- | --- |
| Buildx/QEMU failure | Retry with `--no-cache`; if reproducible, rotate to backup runner | Platform Build on-call |
| GHCR push denied | Rotate `GITHUB_TOKEN` / PAT and confirm repo visibility | DevSecOps (`@sec-ops`) |
| KinD smoke failure | Inspect artifact logs; rerun locally with `KIND_CLUSTER_NAME=vibecode-ci` | Observability on-call |
| Telemetry missing | Validate Datadog API key, rerun `npm run monitoring:trace` | Platform Observability |

## Observability Gaps (Oct 2025)
### Observability Implementation Plan
_Tracking: GitHub issue #412._
1. Instrument `codeserver-multiarch` workflow with `datadog-ci metric submit` for `codeserver.build.duration`/`success` and emit change events at start/end (pending `DD_API_KEY` / `DD_SITE`).
2. Extend `scripts/test-code-server-kind.sh` (and follow-up metrics helper) to report `codeserver.kind.latency`/`success`, tagging `arch`, `git_sha`, and `cluster`.
3. Provision Datadog monitors:
   - `codeserver.build.duration.p95` (Warn > 12 min / Page > 25 min) – owner: Platform Build.
   - `codeserver.kind.smoke.failure` (Warn when success < 98% rolling 6h, Page immediately on failure) – owner: Observability.
   - Missing data monitor for build metrics > 2 runs – routes to `#codeserver-ci`.
4. Archive KinD smoke artefacts: retain last 30 runs in GitHub; export full logs to `s3://vibecode-ci-artifacts/kind/<date>/<sha>` with 60-day lifecycle.
5. Document monitor ownership and retrieval steps in `docs/observability/codeserver-ci.md` once instrumentation lands.

- ⚠️ Assign owners for Datadog alerts `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` (currently unassigned).
- ⚠️ Create Datadog timeboard **multiarch image drift** and link it from the shipping dashboard.
- ⚠️ Instrument `scripts/test-code-server-kind.sh` to emit `codeserver.kind.latency` and success/failure events via `@datadog/datadog-ci`.
- ⚠️ Verify workflow artifacts retain KinD logs for 14 days; if not, mirror to long-term storage (S3 bucket TBD).

## References
- `docs/logs/workflow-issues/docker-multiarch.yml.md`
- `docs/logs/issues/code-server-cloud-deployment.md`
- `docs/handoff/shipping-dashboard.md`
- `scripts/test-code-server-kind.sh`
- `TODO.md`
