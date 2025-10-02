# TODO documentation excerpt
40:- **Docs refreshed:** Handoff + shipping dashboard updated with version/canary sections; AI tooling parity plan added under `docs/tooling/`; coordination/activity logs include 2025-10-01 notes.
87:| ⏭️ Ready | Docs Lead | Backfill weekly entry in `docs/handoff/shipping-dashboard.md` and ensure shipping thread automation points to it | Needs latest release digest (due 2025-10-02 18:00 UTC) |
144:| **Docs Specialist** | Documentation | ✅ COMPLETE | Created DEPLOYMENT_SUMMARY.md, roundtable-ai-personas.md |
164:- #411: [Docs] Update documentation for v1.1.0
169:3. **Docs Agent**: Update CHANGELOG, DEPLOYMENT_REPORT (Issue #411) - READY TO START
## Agent Update (2025-10-01 17:18 UTC)

- Updated reduced-motion Playwright harness: chunked SSE stub, new ARIA assertions, and jump control semantics captured in spec + component.
- Added accessibility attributes (`aria-atomic`, `aria-relevant`, `aria-busy`, `aria-controls`) to `EnhancedChatInterface` for screen-reader parity.
- Playwright e2e run attempted via `npx playwright test tests/e2e/enhanced-chat/reduced-motion.spec.ts` (config `tests/e2e/playwright.config.ts`); dev server failed to boot within 300s, needs follow-up.
- MCP `roundtable-ai/codex_subagent` persona prompts repeatedly errored (`Separator is not found, and chunk exceed the limit`); unable to gather remaining persona output yet.

### Next Steps
- [ ] Diagnose `npm run dev` startup under Playwright webServer (hang after 300s) before re-running reduced-motion spec.
- [ ] Re-attempt persona coordination once Codex subagent recovers; capture outputs for accessibility, docs, and QA personas.

## Agent Update (2025-10-01 07:56 UTC)

- Verified code-server smoke tooling hardening: script stubs now surface timeouts, pods stay masked, and Dockerfile pulls use release checksums.

### Next Steps
- [ ] Retry Gemini persona prompts once MCP subagent responds, then close out the documentation addendum.

## Agent Update (2025-10-01 07:40 UTC)

- Picking up shellcheck/bats installation and code-server smoke test hardening (#415/#417) plus checksum validation (#416).

### Next Steps
- [x] Install shellcheck + bats-core via Homebrew, then rerun the smoke scripts/tests specified by #415/#417.
  - ✅ Agent Codex (2025-10-01 07:45 UTC): `brew install shellcheck bats-core`; `code-server/ci/dev/lint-scripts.sh` + `bats tests/scripts/test-code-server-editors.bats` now green.
- [x] Implement kubectl wait propagation, log redaction, and binary checksum verification for code-server tooling.
  - ✅ Agent Codex (2025-10-01 07:55 UTC): Updated `scripts/test-code-server-editors.sh` to surface `kubectl wait` errors, mask pod names, refresh pod lists, and added checksum gating for helm/kubectl/kubectx/kubens in `docker/code-server/Dockerfile`.
- [x] Expand the Bats suite with Ready pod rotation, timeout override, and log-structure cases per #417.
  - ✅ Agent Codex (2025-10-01 07:55 UTC): New tests cover missing tools, timeout propagation, wait failures, and pod rotation without leaking real pod names.
- [ ] Retry Gemini persona prompts once MCP subagent responds, then close out the documentation addendum. (Rolled forward to 2025-10-01 07:56 UTC update.)

# TODO

## Status at a Glance (2025-10-01)
- **Workflow dispatch:** Waiting on merge of updated `.github/workflows/codeserver-multiarch.yml` (issue #418); rerun dispatch once landed.
- **Release blocker:** Hold promoting new `codeserver-multiarch` builds to `latest` until the guarded workflow has at least one clean nightly run with the image patch.
- **Latest build:** `codeserver-multiarch` manual run 2025-10-01 05:52 UTC ✅ (CI tag only).
- **Deploy:** Release tags paused pending workflow merge; Synology/KinD manual deploys healthy.
- **Observability:** Alert ownership assignment in progress via @alex.h; due 2025-10-03 with updates captured in `docs/handoff/shipping-dashboard.md`.
- **Docs refreshed:** Handoff + shipping dashboard updated with version/canary sections; AI tooling parity plan added under `docs/tooling/`; coordination/activity logs include 2025-10-01 notes.
- **MCP check:** `roundtable-ai/gemini_subagent` returned tool failures today; retry persona sync before closing #415/#417 documentation items.

## Active Work
| Owner | Task | Status | Target | Notes |
| --- | --- | --- | --- | --- |
| @ryan.m | Merge workflow + Dockerfile changes, monitor first nightly run | In progress | 2025-10-02 05:15 UTC | Record metrics and artifact links in release digest after nightly confirms image patch. |
| @alex.h | Assign Datadog dashboard + alert owners | In progress | 2025-10-03 | Update `docs/handoff/shipping-dashboard.md` and observability monitors once contacts confirmed. |
| @claudia.p | Draft ARM64 Playwright smoke addition (issue #409) | Pending | 2025-10-05 | Requires runner allocation + checklist update before QA parity sign-off. |
| @platform-ops | Harden code-server editor smoke test (#415) | In progress | 2025-10-04 | Add Ready pod gating, request timeouts, structured logs ahead of doc addendum. |
| @security | Verify kubernetes tooling downloads (#416) | Pending | 2025-10-05 | Add checksum/signature validation + policy update to unlock deploy automation. |
| @docs | Draft editor hardening addendum (#415/#417) | Paused | 2025-10-06 | Waiting on Gemini persona guidance + final verification notes before publishing summary. |
| @config-team | Coordinate updated Azure/Valkey env templates (TODO(config-env-templates)) | In progress | 2025-10-04 | Update env samples + docs; confirm secret sync + rollout notes across environments. |

## Security Hardening Roadmap (Unsigned CLI Downloads)
| TODO ID | Owner | Scope | Verification Path | Target |
| --- | --- | --- | --- | --- |
| TODO(sec-hardening-kubectl) | @security | Add sha256 + cosign validation for kubectl download in `docker/code-server/Dockerfile` (SHA256 added 2025-10-01; cosign still pending) | `curl -fsSLO https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl{,.sha256,.sig}` → `sha256sum --check` → `cosign verify-blob --signature kubectl.sha256.sig --certificate-identity "https://github.com/kubernetes/kubernetes" --certificate-oidc-issuer "https://accounts.google.com" kubectl.sha256` | Land by 2025-10-08; gate image release on passing verification |
| TODO(sec-hardening-helm) | @security | Swap helm install to verified tarball workflow (checksum added 2025-10-01; provenance/cosign still pending) | Pull `https://get.helm.sh/helm-v${HELM_VERSION}-${HELM_TAR_ARCH}.tar.gz` plus `.tar.gz.sha256sum` and `.tar.gz.sha256sum.sig`; validate via `sha256sum --check` and `cosign verify-blob` (fallback: `gpg --verify` with CNCF key) before extract | Land by 2025-10-10; update build docs |
| TODO(sec-hardening-kubectx) | @security | Source kubectx from GitHub release asset instead of raw + verify checksum (release checksum gating added 2025-10-01) | Use release archive + vendor-provided checksum file, validate via `sha256sum --check`; add integrity gate in build script | Land by 2025-10-11; require CI job proof |
| TODO(sec-hardening-kubens) | @security | Mirror kubens strategy alongside kubectx with checksum gate (release checksum gating added 2025-10-01) | Same as above using matching release asset; hook into shared verify helper | Land by 2025-10-11; share helper with kubectx task |
| TODO(sec-hardening-supply-chain-docs) | @security | Document binary verification requirements in `docs/SECURITY.md` + runbooks | Add supply-chain verification checklist, tie to Docker image review | 2025-10-05 |

## Next Up
- Enable AI tooling parity CI matrix (see `docs/tooling/ai-tooling-parity.md`) when runner capacity is approved. (GH issue #413)
- Emit `codeserver.kind.latency` + success metrics from `scripts/test-code-server-kind.sh` once secrets available.
- Define Buildx cache retention policy and document in workflow issue log.
- When workflow_dispatch lands on main, rerun `codeserver-multiarch` with `promote_latest=false`, then log results in release digest.
- Publish code-server editor hardening addendum in docs once #415/#416 merge.
- Retry Gemini persona sync for #415/#417 before drafting final documentation handoff.

## Blocked / Watchlist
- ARM64 Playwright smoke pending hardware runners.
- Datadog API/App keys rotation awaiting security approval (impacts monitoring workflows).

## Archive
### Active Queue
| Status | Owner | Item | Target / Notes |
| --- | --- | --- | --- |
| 🚧 In Progress | Ryan M | Finalise docs/handoff package and codeserver multi-arch workflow updates | Land current branch, verify cron run on 2025-10-02 05:15 UTC |
| 🧪 Validating | Ryan M | Audit Buildx cache hits + KinD smoke artifacts after first nightly run | Capture metrics + artifact links in release digest template |

# DEPLOYMENT_SUMMARY excerpt
# Code-Server v1.1.0 Multi-Profile Deployment Summary

**Date**: 2025-10-01 07:24 UTC  
**Status**: 60% Complete (3/5 profiles deployed)  
**Method**: Hybrid (Local + GitHub Actions)

## 🎯 Objective Achieved

Built and deployed optimized code-server images with **ALL required tools**:
- ✅ AI CLIs: aider, goose
- ✅ DevOps tools: kubectl, helm, k9s, stern, helmfile, sops, glab
- ✅ Shell enhancements: nushell, delta, chezmoi, just
- ✅ VS Code extensions (profile-specific)

## 📊 Deployment Status

### ✅ Completed Profiles (3/5)

| Profile | Size | Extensions | Registries | Verification |
|---------|------|------------|------------|--------------|
| **minimal** | ~400MB | 5 | ✅ GHCR + Docker Hub | ✅ All tools verified |
| **standard** | ~700MB | 12 | ✅ GHCR + Docker Hub | ✅ All tools verified |
| **ai** | ~900MB | 15 | ✅ GHCR + Docker Hub | ✅ All tools verified |

### 🔨 In Progress (2/5)

| Profile | Size | Extensions | Build Method | ETA |
|---------|------|------------|--------------|-----|
| **web** | ~600MB | 14 | GitHub Actions | ~15 min |
| **full** | ~1.2GB | 26 | GitHub Actions | ~15 min |

**Monitor**: https://github.com/ryanmaclean/vibecode-webgui/actions/runs/18169561051

## 🚀 Deployment Strategy

### Phase 1: Local Builds (Complete)
- Built minimal, standard, ai profiles locally
- Verified all tools working
- Pushed to both registries
- **Duration**: ~2 hours

### Phase 2: GitHub Actions (In Progress)
- Building web and full profiles via GitHub Actions
- **Benefits**:
  - Faster network to GHCR
  - Better caching (GitHub's infrastructure)
  - Parallel builds without local resource constraints
  - Automatic verification and SBOM generation
- **Duration**: ~15-20 minutes

## 🔧 Technical Improvements

### Issues Fixed
1. ✅ **Goose Installation**: `GOBIN=/usr/local/bin` for system-wide access
2. ✅ **Tar Extraction**: `find + cp` approach for robust extraction
3. ✅ **Version Corrections**:
   - k9s: 0.50.13 (was 0.32.7 - 404 error)
   - glab: 1.22.0 (was 1.48.0 - 404 error)
4. ✅ **KUBECTL_ARCH**: Proper variable scoping
5. ✅ **Download Validation**: Docker-in-docker testing before builds
6. ✅ **Strict Verification**: Build fails if any tool missing

### Build Optimizations
- **Layer Reduction**: 26 RUN commands → 1 RUN for extensions
- **BuildKit Caching**: Cache mounts for faster rebuilds
- **Multi-arch**: Single build for amd64 + arm64
- **Profile-based**: Optimized images for different use cases

## 📦 Registry Locations

### GitHub Container Registry (GHCR)
```bash
# Pull specific profile
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-minimal
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-ai
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-web     # pending
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-full    # pending


# BUILD_STATUS doc rows
docker buildx ls
```

### Agent 2: QA Engineer (CAN START)
**Task**: Create verification scripts  
**Status**: Ready to start  
**GitHub**: Pending issue creation  
**Deliverable**: `scripts/verify-code-server-profiles.sh`

### Agent 3: Documentation (CAN START)
**Task**: Update docs for v1.1.0  
**Status**: Ready to start  
**GitHub**: Issue #411  
**Files to Update**:
- `docker/code-server/CHANGELOG.md` (create)
- `docker/code-server/DEPLOYMENT_REPORT.md` (update)
- `docker/code-server/VERIFICATION_GUIDE.md` (create)

### Agent 4: DevOps (BLOCKED)
**Task**: Test on Synology NAS  
**Status**: Waiting for builds to complete  
**Blocker**: Need all profiles pushed first  
**Commands Ready**:
```bash
ssh snas "docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard"
