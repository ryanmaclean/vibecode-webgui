# Audit: docker/code-server/Dockerfile Optional Installs (2025-10-01)

## Summary
Optional tooling layers caused intermittent failures on ARM64 runners (QEMU timeout installing security tooling). To unblock automated multi-arch builds we wrapped each optional installer with architecture guards while preserving AMD64 functionality.

## Findings
| Component | Impact | Action |
| --- | --- | --- |
| KubeHound install script | Shell installer assumes x86_64 binaries | Skip on non-AMD64 platforms; log skip message. |
| Stratus Red Team (pip) | Wheels missing for `aarch64` | Guard with `TARGETPLATFORM` case; skip for ARM64. |
| Eppo Agent (deb) | Package repo publishes AMD64 only | Skip for ARM64; document manual install requirement if needed. |
| Datadog Toto (pip) | Optional analytics CLI; no ARM64 wheel | Guard and skip for ARM64. |

## Follow-Up
- [ ] Confirm optional tooling availability with vendors and re-enable per arch when upstream support exists.
- [ ] Update release handoff doc once tooling parity improves.
- [ ] Re-run `codeserver-multiarch` workflow after merge to confirm ARM64 path completes without retries.

## References
- Commit: _TBD_ (fill once PR merges).
- Workflow issue tracker: `docs/logs/workflow-issues/docker-multiarch.yml.md`.
- Handoff doc: `docs/handoff/code-server-release.md`.
- Shipping dashboard snapshot: `docs/handoff/shipping-dashboard.md`.
