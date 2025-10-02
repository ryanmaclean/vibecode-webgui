# TODO Security Hardening excerpt
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

### Ready Next
| Status | Owner | Item | Prerequisites |
| --- | --- | --- | --- |
| ⏭️ Ready | Ryan M | Wire `scripts/test-code-server-kind.sh` to emit Datadog metrics (`codeserver.kind.latency`) | Requires DD API key available in workflow secrets (SLA 2025-10-04) |
| ⏭️ Ready | Alex H | Assign dashboard + alert owners for `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` | Owners to be listed in `docs/handoff/shipping-dashboard.md` by 2025-10-03 |
| ⏭️ Ready | Docs Lead | Backfill weekly entry in `docs/handoff/shipping-dashboard.md` and ensure shipping thread automation points to it | Needs latest release digest (due 2025-10-02 18:00 UTC) |
| ⏭️ Ready | Platform Build | Add release digest artifact upload to `codeserver-multiarch` workflow | Depends on docs template committed before 2025-10-04 |

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
- [ ] Update docs/runbooks for deploy-next-docs with log locations, monitor IDs, and rollback steps (tie to issue #405).

- Declare work areas before editing `docs/handoff`, `.github/workflows/codeserver-multiarch.yml`, or `docker/code-server/Dockerfile`.
- Automation: `scripts/ops/todo-stale-digest.ts` runs weekdays at 09:00 local to surface TODO items older than 10 business days in `#platform-ops-sync`; primary/backup approvers must acknowledge within the daily thread.
- Update this file when taking ownership of a Ready Next item; archive completed work into `docs/logs/AGENT_ACTIVITY_LOG.md`.
- See `docs/logs/COORDINATION_LOG.md` for full success patterns.

### Agent Update (2025-10-01 17:17 UTC) - Code-Server v1.1.0 Final Build Execution

**🎯 FINAL PUSH - ALL BUILDS ACTIVE**


**📊 BUILD STATUS** (Using GitHub Actions for faster/more reliable builds):

| Profile | Status | Size | Extensions | Registries | Build Method |
|---------|--------|------|------------|------------|--------------|
| minimal | ✅ COMPLETE | ~400MB | 5 | GHCR + Docker Hub | Local |
| standard | ✅ COMPLETE | ~700MB | 12 | GHCR + Docker Hub | Local |
| ai | ✅ COMPLETE | ~900MB | 15 | GHCR + Docker Hub | Local |
| web | 🔨 BUILDING | ~600MB | 14 | GHCR | Local (Active) |
| full | 🔨 BUILDING | ~1.2GB | 26 | GHCR | Local (Active) |

**⏰ ETA**: ~30-45 minutes (local multi-arch builds)
**🔗 Monitor**: 
- `tail -f /tmp/build-web-now.log`
- `tail -f /tmp/build-full-now.log`
- `ps aux | grep "docker buildx build"`

**🤖 5-PERSONA COORDINATION** (Simulated via Sequential Thinking):

| Persona | Role | Status | Contribution |
|---------|------|--------|--------------|

# Dockerfile verification excerpt
44:    curl \
90:    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_${ARCH}.tar.gz" -o /tmp/lazygit.tar.gz; \
101:    curl -fsSL "https://github.com/starship/starship/releases/download/v${STARSHIP_VERSION}/starship-${ARCH}.tar.gz" -o /tmp/starship.tar.gz; \
112:    curl -fsSL "https://github.com/ajeetdsouza/zoxide/releases/download/v${ZOXIDE_VERSION}/zoxide_${ZOXIDE_VERSION}-1_${DEB_ARCH}.deb" -o /tmp/zoxide.deb; \
118:RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \

RUN ln -sf /usr/bin/fdfind /usr/local/bin/fd && \
    ln -sf /usr/bin/exa /usr/local/bin/eza

RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") ARCH=Linux_x86_64 ;; \
      "linux/arm64") ARCH=Linux_arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_${ARCH}.tar.gz" -o /tmp/lazygit.tar.gz; \
    tar -xf /tmp/lazygit.tar.gz -C /tmp lazygit; \
    install -m755 /tmp/lazygit /usr/local/bin/lazygit; \
    rm -rf /tmp/lazygit.tar.gz /tmp/lazygit

RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") ARCH=x86_64-unknown-linux-musl ;; \
      "linux/arm64") ARCH=aarch64-unknown-linux-musl ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/starship/starship/releases/download/v${STARSHIP_VERSION}/starship-${ARCH}.tar.gz" -o /tmp/starship.tar.gz; \
    tar -xf /tmp/starship.tar.gz -C /tmp; \
    install -m755 /tmp/starship /usr/local/bin/starship; \
    rm -rf /tmp/starship.tar.gz /tmp/starship

RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") DEB_ARCH=amd64 ;; \
      "linux/arm64") DEB_ARCH=arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/ajeetdsouza/zoxide/releases/download/v${ZOXIDE_VERSION}/zoxide_${ZOXIDE_VERSION}-1_${DEB_ARCH}.deb" -o /tmp/zoxide.deb; \
    apt-get update; \
    apt-get install -y --no-install-recommends /tmp/zoxide.deb; \
    rm -rf /tmp/zoxide.deb /var/lib/apt/lists/*

# Install Node.js 18 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install global npm packages
RUN npm install -g \
    yarn \
    pnpm \
    typescript \
    @types/node \
    prettier \
    eslint \
    ts-node

# Install Go (match architecture for multi-arch builds)
ARG GO_VERSION=1.22.4
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm "${GO_TARBALL}"; \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go

# Install AI CLI tools and database tools
# 1. Goose for database migrations (install as root, make globally accessible)
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for goose install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    CGO_ENABLED=0 GOOS=linux GOARCH="${GO_ARCH}" GOBIN=/usr/local/bin go install github.com/pressly/goose/v3/cmd/goose@latest && \
    chmod 755 /usr/local/bin/goose && \
    mkdir -p /home/coder/.vscode/extensions/goose-integration && \
    echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc && \
    chown -R coder:coder /home/coder/.vscode

# 2. Aider - AI pair programming CLI
RUN pip3 install --break-system-packages --no-cache-dir aider-chat

# 3. Verify all required tools are installed (MUST succeed or build fails)
RUN set -e && \
    echo "🔍 Verifying installed tools..." && \
    echo "Testing vim..." && vim --version | head -1 && \
    echo "Testing nvim..." && nvim --version | head -1 && \
    echo "Testing aider..." && aider --version && \
    echo "Testing goose..." && goose -version 2>&1 | grep -i goose && \
    echo "✅ All required tools verified!"

# Install Datadog tools
# 1. Datadog Agent - SKIPPED in build (configure at runtime with DD_API_KEY env var)
# The agent should be configured when the container runs, not baked into the image
# RUN if [ -n "$DD_API_KEY" ]; then \
#     DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=$DD_API_KEY bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)" && \
#     systemctl disable datadog-agent; \
#     fi

# 2. Datadog CLI
RUN npm install -g @datadog/datadog-ci

# 3. Vector (for log collection)
RUN echo "Skipping vector agent install for local build"

# 4. KubeHound (Kubernetes security) - optional
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) \
        curl -sSfL https://raw.githubusercontent.com/DataDog/kubehound/main/install.sh | sh || echo "KubeHound not available, skipping" \
        ;; \
      arm64) \
        echo "KubeHound install skipped for arm64" \
        ;; \
      *) \
        echo "KubeHound install skipped for ${TARGETARCH:-unknown}" \
        ;; \
    esac

# 5. Stratus Red Team (security testing) - optional
