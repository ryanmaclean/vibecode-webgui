# Code-Server Shipping Dashboard

_Last updated: 2025-10-01_

## Snapshot
| Track | Owner | Latest Status | Next Checkpoint |
| --- | --- | --- | --- |
| Build (linux/amd64, linux/arm64) | Avery Chen (primary) / Jordan Lee (backup) | ✅ Nightly run 2025-10-01 05:52 UTC succeeded | 2025-10-02 05:15 UTC (nightly) |
| Tests | QA Assist (`@alex.h`) | ✅ `scripts/test-code-server-kind.sh` passed (Editors, aider, goose) | Add ARM64 Playwright smoke (issue #409 follow-up) |
| Deploy | Sasha Gomez (escalation mgr) | ⚠️ GitHub Actions deploy step disabled pending workflow enhancement | Re-enable once workflow updates merge |

## Key Links
- Release handoff: [`docs/handoff/code-server-release.md`](./code-server-release.md)
- Workflow health: `.github/workflows/codeserver-multiarch.yml`
- Workflow issue tracker: `docs/logs/workflow-issues/docker-multiarch.yml.md`
- Cloud deployment log: `docs/logs/issues/code-server-cloud-deployment.md`

## Version & Cross-Links
- Version/tag policy: follow ["Version & Tag Policy"](./code-server-release.md#version--tag-policy) for promotion steps and tag naming.
- Canary plan draft: mirror ["Canary & Promotion Safeguards"](./code-server-release.md#canary--promotion-safeguards-release-engineering-draft) when staging `:canary` tags.
- Optional install guard rails: `docs/logs/issues/docker-multiarch-audit.md`.
- Workflow anatomy & telemetry hooks: `docs/logs/workflow-issues/docker-multiarch.yml.md`.
- Observability runbook: [`docs/observability/codeserver-ci.md`](../observability/codeserver-ci.md) (GH issue #412).
- AI tooling parity plan: [`docs/tooling/ai-tooling-parity.md`](../tooling/ai-tooling-parity.md) (GH issue #413).
- Release digests live in `docs/logs/releases/code-server/`; always link the latest entry in the shipping thread.
- Rollback playbook placeholder: update `docs/handoff/code-server-release.md` once Ops publishes the step-by-step reversal.

## SLA & Alert Summary
- **Nightly build**: completes < 30 minutes; alert if failure rate > 2% over 6h (`codeserver.build.success` monitor).
- **KinD smoke**: success ratio 100%; page immediately on failure (`codeserver.kind.smoke.success`).
- **Digest update**: release digest in `docs/logs/releases/code-server/` within 2 hours of successful run.

## Approver Roster
- **Primary Approver:** Avery Chen (Platform Build) – leads weekly release sign-off and build promotion.
- **Backup Approver:** Jordan Lee (Observability) – validates telemetry, flips to primary when Avery is OOO, and co-signs sign-off threads.
- **Escalation Manager:** Sasha Gomez (Platform Ops) – drives rollback decisions, ensures stakeholder updates, and re-enables deploy automation post-incident.

## Release Sign-off Checklist
1. Confirm `codeserver-multiarch` workflow latest run is green with ≤ 1 retry per job.
2. Review release digest draft and attach KinD smoke + Datadog screenshots before `#shipping-dashboard` update.
3. Sweep `TODO.md` and this dashboard for stale code-server items and assign next dates/owners.
4. Post sign-off thread tagging backup approver; backup responds with ✅ to log dual-ack.
5. File checklist outcome under `docs/logs/releases/code-server/<date>.md`.

## Rollback Trigger Matrix
| Trigger | Signal | Required Action | Approver | Notes |
| --- | --- | --- | --- | --- |
| Build artefact regression | KinD smoke failure ≥ 2 steps or helper mismatch | Pause promotion, rebuild previous passing commit, rerun smoke | Primary | Backup owns communications |
| Latency/error spike | `codeserver.build.duration.p95` > SLO or `codeserver.kind.smoke.failure` alert | Disable deploy job, open incident bridge, prep rollback | Backup | Escalation manager coordinates observers |
| Customer escalation | Support ticket ties regression to new image | Re-tag prior good release as `latest`, document in incident log | Escalation manager | Primary + backup co-sign |
| Supply chain alert | SBOM scan flags high severity CVE | Stop deployments, notify SecOps, prep patched build | Primary | Resume only after SecOps approval |

## TODO Hygiene Cadence
- Monday 16:00 UTC: Primary runs async checklist review (TODO + dashboard) and tags overdue owners.
- Weekday 09:00 local: Backup reviews automation surfaced stale items (see `TODO.md` automation note) and posts summary in `#platform-ops-sync`.
- Escalation manager verifies hygiene closure is logged in `docs/logs/COORDINATION_LOG.md` during Tuesday ops stand-up.

## Open Actions
- [ ] Add ARM64 Playwright smoke test and capture runbook in release handoff. (GH issue #409)
- [ ] Assign dashboard ownership for `multiarch-builds` Datadog board.
- [ ] Finalize GitHub Actions cache retention policy (see workflow issue log).
- [ ] Implement canary promotion gate per "Canary & Promotion Safeguards" draft once workflows support staged tags. (tie-in with GH issue #412)

Update this dashboard after every nightly or manual release run.
