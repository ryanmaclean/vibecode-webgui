# AI Tooling Parity Plan (Draft – 2025-10-01)

## Goals
_Tracking: GitHub issue #413._
- Maintain aider/goose CLI parity across linux/amd64, linux/arm64, macOS (arm/x64), and Windows x64.
- Validate bundled AI extensions end to end on each supported platform before releasing code-server images.
- Publish minimum runtime requirements and manual QA evidence ahead of release sign-off.

## CI Matrix
| Platform | Executors | Test Buckets |
| --- | --- | --- |
| macOS 14 arm64 | GitHub Actions `macos-14` | Install smoke, functional prompt replay, regression transcript diff |
| macOS 13 x64 | `macos-13` | Same as above |
| Ubuntu 24.04 amd64 | `ubuntu-24.04` | Smoke + functional + regression |
| Ubuntu 24.04 arm64 | `ubuntu-24.04-arm64` (QEMU/native) | Smoke + functional + regression |
| Windows 2025 x64 | `windows-2025` | Smoke + functional (PowerShell harness) |

## Required Checks
1. CLI invocation passes (`aider --version`, `goose -version`, scripted prompt/response) with artefacts retained for 30 days.
2. `scripts/ci/probe-runtime.ts` records Python/Node/OpenSSL versions per arch → publish to `docs/tooling/min-runtime.md`.
3. `npm run tooling:lock-audit` diff enforces lockfile / checksum parity; failure opens `AI-Tooling-Parity` issue automatically.
4. Playwright extension smoke runs (VS Code / JetBrains) on each architecture with HAR + latency histogram exports.
5. Nightly `npm run tooling:parity-report` aggregates CI outcomes; three consecutive failures page AI Tooling on-call.

## Manual QA Checklist
- Apple Silicon (MacBook Pro M3) and Windows 11 x64 VM prior to each release:
  - Install aider/goose, authenticate providers, run sample prompts.
  - Exercise core AI extensions (inline edit, continue agent, chat, codebase search).
  - Validate offline fallback & error handling.
  - Archive logs/screenshots to `compliance/tooling/<release>`.

## Follow-ups
- After parity CI is live, surface the report in `docs/handoff/shipping-dashboard.md` under Version & Cross-Links.
- Coordinate runner capacity request with DevInfra before enabling arm64/windows lanes.
- Update release digest template with parity status once automation is green.

## References
- Handoff context: `docs/handoff/code-server-release.md` (Version & Tag Policy + Canary plan).
- Shipping overview: `docs/handoff/shipping-dashboard.md` (owner roster, SLA snapshot).
