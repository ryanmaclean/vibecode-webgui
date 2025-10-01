# Code-Server Shipping Dashboard

_Last updated: 2025-10-01_

## Snapshot
| Track | Owner | Latest Status | Next Checkpoint |
| --- | --- | --- | --- |
| Build (linux/amd64, linux/arm64) | Platform Build rotation (`@ryan.m`) | ✅ Nightly run 2025-10-01 05:52 UTC succeeded | 2025-10-02 05:15 UTC (nightly) |
| Tests | QA Assist (`@alex.h`) | ✅ `scripts/test-code-server-kind.sh` passed (Editors, aider, goose) | Add ARM64 Playwright smoke (issue #409 follow-up) |
| Deploy | Platform Ops (`@sasha.g`) | ⚠️ GitHub Actions deploy step disabled pending workflow enhancement | Re-enable once workflow updates merge |

## Key Links
- Release handoff: `docs/handoff/code-server-release.md`
- Workflow health: `.github/workflows/codeserver-multiarch.yml`
- Workflow issue tracker: `docs/logs/workflow-issues/docker-multiarch.yml.md`
- Cloud deployment log: `docs/logs/issues/code-server-cloud-deployment.md`

## SLA & Alert Summary
- **Nightly build**: completes < 30 minutes; alert if failure rate > 2% over 6h (`codeserver.build.success` monitor).
- **KinD smoke**: success ratio 100%; page immediately on failure (`codeserver.kind.smoke.success`).
- **Digest update**: release digest in `docs/logs/releases/code-server/` within 2 hours of successful run.

## Open Actions
- [ ] Add ARM64 Playwright smoke test and capture runbook in release handoff.
- [ ] Assign dashboard ownership for `multiarch-builds` Datadog board.
- [ ] Finalize GitHub Actions cache retention policy (see workflow issue log).

Update this dashboard after every nightly or manual release run.
