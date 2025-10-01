# Platform Observability Queue (Updated 2025-10-01 12:20 UTC)

## Active Queue
| Status | Owner | Item | Target / Notes |
| --- | --- | --- | --- |
| 🚧 In Progress | Ryan M | Finalise docs/handoff package and codeserver multi-arch workflow updates | Land current branch, verify cron run on 2025-10-02 05:15 UTC |
| 🧪 Validating | Ryan M | Audit Buildx cache hits + KinD smoke artifacts after first nightly run | Capture metrics + artifact links in release digest template |

## Ready Next
| Status | Owner | Item | Prerequisites |
| --- | --- | --- | --- |
| ⏭️ Ready | Ryan M | Wire `scripts/test-code-server-kind.sh` to emit Datadog metrics (`codeserver.kind.latency`) | Requires DD API key available in workflow secrets |
| ⏭️ Ready | Alex H | Assign dashboard + alert owners for `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` | Owners to be listed in `docs/handoff/shipping-dashboard.md` |
| ⏭️ Ready | Docs Lead | Backfill weekly entry in `docs/handoff/shipping-dashboard.md` and ensure shipping thread automation points to it | Needs latest release digest |
| ⏭️ Ready | Platform Build | Add release digest artifact upload to `codeserver-multiarch` workflow | Depends on docs template committed |

## Blocked / Watch List
| Status | Owner | Item | Blocker |
| --- | --- | --- | --- |
| 🛑 Blocked | Platform Observability | Nightly Datadog metrics for build duration | Awaiting `DD_API_KEY` / `DD_SITE` secrets in repository |
| 🛑 Blocked | Platform Build | Cost dashboard automation for cloud workspaces | Needs prod Datadog dashboard export + tagging plan |

## Observability Callouts
- [ ] Assign on-call owners for Datadog alerts `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` before 2025-10-03.
- [ ] Create Datadog timeboard "multiarch image drift" and link from `docs/handoff/shipping-dashboard.md`.
- [ ] Add telemetry hook in `scripts/test-code-server-kind.sh` (Datadog metric + event) once secrets available.
- [ ] Confirm GitHub workflow artifacts retain KinD logs for 14 days; if not, upload to S3 bucket.

## Coordination Notes
- Declare work areas before editing `docs/handoff`, `.github/workflows/codeserver-multiarch.yml`, or `docker/code-server/Dockerfile`.
- Update this file when taking ownership of a Ready Next item; archive completed work into `docs/logs/AGENT_ACTIVITY_LOG.md`.
- See `docs/logs/COORDINATION_LOG.md` for full success patterns.
