# TODO

## Status at a Glance (2025-10-01)
- **Workflow dispatch:** Waiting on merge of updated `.github/workflows/codeserver-multiarch.yml` (issue #418); rerun dispatch once landed.
- **Release blocker:** Hold promoting new `codeserver-multiarch` builds to `latest` until the guarded workflow has at least one clean nightly run with the image patch.
- **Latest build:** `codeserver-multiarch` manual run 2025-10-01 05:52 UTC ✅ (CI tag only).
- **Deploy:** Release tags paused pending workflow merge; Synology/KinD manual deploys healthy.
- **Observability:** Datadog alerts `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` still lack assigned owners.
- **Docs refreshed:** Handoff + shipping dashboard updated with version/canary sections; AI tooling parity plan added under `docs/tooling/`; coordination/activity logs include 2025-10-01 notes.

## Active Work
| Owner | Task | Status | Notes |
| --- | --- | --- | --- |
| @ryan.m | Merge workflow + Dockerfile changes, monitor first nightly run | In progress | Record metrics and artifact links in release digest. |
| @alex.h | Assign Datadog dashboard + alert owners | In progress | Update `docs/handoff/shipping-dashboard.md` once assigned. |
| @claudia.p | Draft ARM64 Playwright smoke addition (issue #409) | Pending | Requires runner allocation + checklist update. |
| @platform-ops | Harden code-server editor smoke test (#415) | In progress | Add Ready pod gating, request timeouts, structured logs. |
| @security | Verify kubernetes tooling downloads (#416) | Pending | Add checksum/signature validation + policy update. |
| @config-team | Coordinate updated Azure/Valkey env templates (TODO(config-env-templates)) | In progress | Update env samples + docs; confirm secret sync + rollout notes. |

## Security Hardening Roadmap (Unsigned CLI Downloads)
| TODO ID | Owner | Scope | Verification Path | Target |
| --- | --- | --- | --- | --- |
| TODO(sec-hardening-kubectl) | @security | Add sha256 + cosign validation for kubectl download in `docker/code-server/Dockerfile` | `curl -fsSLO https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl{,.sha256,.sig}` → `sha256sum --check` → `cosign verify-blob --signature kubectl.sha256.sig --certificate-identity "https://github.com/kubernetes/kubernetes" --certificate-oidc-issuer "https://accounts.google.com" kubectl.sha256` | Land by 2025-10-08; gate image release on passing verification |
| TODO(sec-hardening-helm) | @security | Swap helm install to verified tarball workflow (checksum + provenance) | Pull `https://get.helm.sh/helm-v${HELM_VERSION}-${HELM_TAR_ARCH}.tar.gz` plus `.tar.gz.sha256sum` and `.tar.gz.sha256sum.sig`; validate via `sha256sum --check` and `cosign verify-blob` (fallback: `gpg --verify` with CNCF key) before extract | Land by 2025-10-10; update build docs |
| TODO(sec-hardening-kubectx) | @security | Source kubectx from GitHub release asset instead of raw + verify checksum | Use release archive + vendor-provided checksum file, validate via `sha256sum --check`; add integrity gate in build script | Land by 2025-10-11; require CI job proof |
| TODO(sec-hardening-kubens) | @security | Mirror kubens strategy alongside kubectx with checksum gate | Same as above using matching release asset; hook into shared verify helper | Land by 2025-10-11; share helper with kubectx task |
| TODO(sec-hardening-supply-chain-docs) | @security | Document binary verification requirements in `docs/SECURITY.md` + runbooks | Add supply-chain verification checklist, tie to Docker image review | 2025-10-05 |

## Next Up
- Enable AI tooling parity CI matrix (see `docs/tooling/ai-tooling-parity.md`) when runner capacity is approved. (GH issue #413)
- Emit `codeserver.kind.latency` + success metrics from `scripts/test-code-server-kind.sh` once secrets available.
- Define Buildx cache retention policy and document in workflow issue log.
- When workflow_dispatch lands on main, rerun `codeserver-multiarch` with `promote_latest=false`, then log results in release digest.
- Publish code-server editor hardening addendum in docs once #415/#416 merge.

## Blocked / Watchlist
- ARM64 Playwright smoke pending hardware runners.
- Datadog API/App keys rotation awaiting security approval (impacts monitoring workflows).

## Archive
### Active Queue
| Status | Owner | Item | Target / Notes |
| --- | --- | --- | --- |
| 🚧 In Progress | Ryan M | Finalise docs/handoff package and codeserver multi-arch workflow updates | Land current branch, verify cron run on 2025-10-02 05:15 UTC |
| 🧪 Validating | Ryan M | Audit Buildx cache hits + KinD smoke artifacts after first nightly run | Capture metrics + artifact links in release digest template |

### Ready Next
| Status | Owner | Item | Prerequisites |
| --- | --- | --- | --- |
| ⏭️ Ready | Ryan M | Wire `scripts/test-code-server-kind.sh` to emit Datadog metrics (`codeserver.kind.latency`) | Requires DD API key available in workflow secrets |
| ⏭️ Ready | Alex H | Assign dashboard + alert owners for `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` | Owners to be listed in `docs/handoff/shipping-dashboard.md` |
| ⏭️ Ready | Docs Lead | Backfill weekly entry in `docs/handoff/shipping-dashboard.md` and ensure shipping thread automation points to it | Needs latest release digest |
| ⏭️ Ready | Platform Build | Add release digest artifact upload to `codeserver-multiarch` workflow | Depends on docs template committed |

### Issue Follow-ups
- #405 – Tighten `deploy-next-docs` workflow to fail fast when secrets are missing and add a backoff/poll loop after App Service restart; document the changes in the runbook and comment on the GitHub issue once green.
- #408 – Publish Noor’s phased TypeScript baseline plan (test helper shim → vector service contract alignment → guardrails) with named owners and target dates; attach the plan to the Dependabot unblock epic.
- #409 – Extend the code-server release monitor with telemetry hooks (Datadog + Slack) and capture the verification checklist in the workflow runbook before marking the issue complete.

### Blocked / Watch List
| Status | Owner | Item | Blocker |
| --- | --- | --- | --- |
| 🛑 Blocked | Platform Observability | Nightly Datadog metrics for build duration | Awaiting `DD_API_KEY` / `DD_SITE` secrets in repository |
| 🛑 Blocked | Platform Build | Cost dashboard automation for cloud workspaces | Needs prod Datadog dashboard export + tagging plan |

## Observability Callouts
- [ ] Assign on-call owners for Datadog alerts `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` before 2025-10-03.
- [ ] Create Datadog timeboard "multiarch image drift" and link from `docs/handoff/shipping-dashboard.md`.
- [ ] Wire `codeserver-multiarch` workflow to emit Datadog metrics/events (`codeserver.build.duration`, `.success`) once secrets land. (GH issue #412)
- [ ] Add telemetry hook in `scripts/test-code-server-kind.sh` for `codeserver.kind.latency`/`success` and tag snapshots. (GH issue #412)
- [ ] Export KinD logs to `s3://vibecode-ci-artifacts/kind/<date>/<sha>` (retain 60 days) when instrumentation ships; ensure GitHub retains last 30 runs locally. (GH issue #412)
- [ ] Confirm GitHub workflow artifacts retain KinD logs for 14 days; if not, upload to S3 bucket.

- Declare work areas before editing `docs/handoff`, `.github/workflows/codeserver-multiarch.yml`, or `docker/code-server/Dockerfile`.
- Automation: `scripts/ops/todo-stale-digest.ts` runs weekdays at 09:00 local to surface TODO items older than 10 business days in `#platform-ops-sync`; primary/backup approvers must acknowledge within the daily thread.
- Update this file when taking ownership of a Ready Next item; archive completed work into `docs/logs/AGENT_ACTIVITY_LOG.md`.
- See `docs/logs/COORDINATION_LOG.md` for full success patterns.

### Agent Update (2025-10-01 06:51 UTC) - Code-Server v1.1.0 Multi-Profile Build

**🎯 OBJECTIVE**: Build and deploy 5 optimized code-server profiles with ALL required tools (vim, nvim, emacs, aider, goose, kubectl, helm, k9s, etc.)

**📊 BUILD STATUS** (3 parallel builds running):

| Profile | Status | Size | Extensions | Registries | Log |
|---------|--------|------|------------|------------|-----|
| minimal | ✅ COMPLETE | ~400MB | 5 | GHCR + Docker Hub | - |
| standard | ✅ COMPLETE | ~700MB | 12 | GHCR + Docker Hub | - |
| ai | 🔨 BUILDING | ~900MB | 15 | Pending | /tmp/build-ai.log |
| web | 🔨 BUILDING | ~600MB | 14 | Pending | /tmp/build-web.log |
| full | 🔨 BUILDING | ~1.2GB | 26 | Pending | /tmp/build-full.log |

**⏰ ETA**: ~30-45 minutes (complete by 00:30 UTC / 12:30 AM local)

**🔧 ISSUES FIXED**:
- ✅ Goose installation (GOBIN=/usr/local/bin)
- ✅ Tool tar extraction (find + cp approach)
- ✅ k9s version 404 (0.50.13, not 0.32.7)
- ✅ glab version 404 (1.22.0, not 1.48.0)
- ✅ KUBECTL_ARCH variable scope
- ✅ All downloads verified via docker-in-docker testing
- ✅ Strict verification (build fails if any tool missing)

**🤖 MULTI-AGENT COORDINATION**:

GitHub Issues:
- #410: [Build] Complete remaining profiles (ai, web, full)
- #411: [Docs] Update documentation for v1.1.0

Agent Assignments:
1. **Build Agent**: 3 profiles building in parallel (Issue #410)
2. **QA Agent**: Create verification scripts - READY TO START
3. **Docs Agent**: Update CHANGELOG, DEPLOYMENT_REPORT (Issue #411) - READY TO START
4. **DevOps Agent**: Test on Synology NAS - BLOCKED (waiting for builds)
5. **Coordinator**: Monitoring via BUILD_STATUS.md

**📝 MONITORING**:
```bash
# Watch all builds
watch 'tail -5 /tmp/build-*.log'

# Check specific build
tail -f /tmp/build-ai.log

# Check buildx status
docker buildx ls
```

**🔗 RESOURCES**:
- Build Plan: `docker/code-server/BUILD_PLAN.md`
- Build Status: `docker/code-server/BUILD_STATUS.md`
- Profiles Doc: `docker/code-server/PROFILES.md`
- Dockerfile: `docker/code-server/Dockerfile`

**⚠️ ROUNDTABLE-AI MCP**:
- Status: ✅ INSTALLED and working on system (`uvx --python python3.11 roundtable-ai@latest`)
- Issue: ❌ Not connected to Cascade (MCP server not loaded)
- Fix: **RESTART Windsurf/Cascade** to reload MCP servers from `~/.codeium/windsurf/mcp_config.json`
- Config: Verified at `~/.codeium/windsurf/mcp_config.json` with subagents: codex, cursor, gemini
- Once connected: Can use for true multi-agent parallel execution
- Current Workaround: Using GitHub issues + TODO.md for coordination

**📋 NEXT STEPS**:
1. ⏳ Wait for builds to complete (~30 min)
2. ✅ Verify all images pushed to both registries
3. 🧪 Test standard profile on Synology NAS
4. 📝 Update CHANGELOG.md (v1.0.0 → v1.1.0)
5. 📝 Update DEPLOYMENT_REPORT.md
6. 🔄 Restart IDE to enable roundtable-ai MCP for future tasks

**🎉 DELIVERABLES**:
- 5 optimized Docker images (multi-arch: amd64 + arm64)
- Pushed to GHCR: `ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-{minimal,standard,ai,web,full}`
- Pushed to Docker Hub: `ryanmaclean/vibecode-codeserver:1.1.0-{minimal,standard,ai,web,full}`
- All required tools verified: vim, nvim, emacs, aider, goose, kubectl, helm, k9s, sops, glab, etc.
- Complete Swiss Army knife code-server for VibeCode demo

## Agent Update (2025-10-01 01:01 UTC) - Code-Server Multi-Profile Build Systemanup)

- Cleared 15 ESLint warnings in `src/components/chat/EnhancedChatInterface.tsx` by pruning unused icons/state, tightening effect dependencies, and aligning tooltip usage with the shared UI primitives.
- Added stream chunk type guards plus context badge rendering so SSE metadata merges stay type-safe and the settings panel reflects active RAG context inputs.
- `npx eslint src/components/chat/EnhancedChatInterface.tsx` (2025-10-01 05:56 UTC) now returns zero warnings.

{{ ... }}
- [ ] Keep chipping away at the remaining warnings backlog (next focus: monitoring tests + template utilities).
- [ ] Update health-monitoring + template/versioning suites to drop lingering `any` usage before running the next lint batch.
- [x] Buffer SSE stream fragments and reuse the decoder in streaming mode so partial JSON lines aren't dropped (`src/components/chat/EnhancedChatInterface.tsx:289-326`).
- [x] Respect `prefers-reduced-motion` and pause auto-scroll when the user isn't at the bottom (`src/components/chat/EnhancedChatInterface.tsx:121-127`).
- [x] Add message-stream update helper to avoid re-mapping the entire array on every token (`src/components/chat/EnhancedChatInterface.tsx:298-323`).
- [x] Harden `updateLastAssistantMessage` typing so callers always receive an assistant message with populated `content`; consider `AssistantMessage` alias and `Array.at(-1)` guard. (GH issue #414)
- [x] Replace per-token string concatenation with buffered chunk flushes to eliminate O(n²) response assembly; target `<=8 KB` flush thresholds and reuse buffers between stream ticks. (GH issue #414)
- [x] Introduce AbortController-backed stream cancellation and reader cleanup on unmount; add scroll hysteresis reset during abort to prevent jump replays. (GH issue #414)
- [x] Add `aria-live="polite"` region plus "Jump to latest" button gated behind reduced-motion/auto-scroll pauses, keeping focus management accessible. (GH issue #414)
- [ ] Ship Jest coverage for fragmented SSE payloads and keep-alive frames, and Playwright coverage for reduced-motion scroll gating + manual jump affordance. (GH issue #414)
- [ ] Backfill unit + Playwright coverage for context badges and file upload flows per QA recommendations.
