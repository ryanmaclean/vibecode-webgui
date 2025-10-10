# VibeCode Custom code-server with pre-installed extensions
# OPTIMIZED VERSION - Reduced from 57 to 12 layers
FROM codercom/code-server:4.104.2

ARG TARGETPLATFORM
ARG TARGETARCH
ARG LAZYGIT_VERSION=0.55.1
ARG STARSHIP_VERSION=1.23.0
ARG ZOXIDE_VERSION=0.9.8
ARG NUSHELL_VERSION=0.99.1
ARG DELTA_VERSION=0.18.2
ARG CHEZMOI_VERSION=2.65.2
ARG JUST_VERSION=1.43.0
ARG STERN_VERSION=1.33.0
ARG HELMFILE_VERSION=0.169.1
ARG HELM_VERSION=3.19.0
ARG KUBECTL_VERSION=1.31.1
ARG KUBECTX_VERSION=0.9.5
ARG K9S_VERSION=0.50.13
ARG SOPS_VERSION=3.9.3
ARG GLAB_VERSION=1.22.0
ARG PROFILE=full
ARG BUILD_DATE
ARG GIT_COMMIT
ARG VERSION=1.2.0
ARG COSIGN_VERSION=2.2.4
ARG GO_VERSION=1.22.4
ARG POCKETBASE_VERSION=0.24.4

# Metadata
LABEL org.opencontainers.image.title="VibeCode Code-Server" \
      org.opencontainers.image.description="Code-server with AI assistants and development tools" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.source="https://github.com/ryanmaclean/vibecode-webgui" \
      org.opencontainers.image.profile="${PROFILE}"

USER root

# Layer 1: System dependencies and basic setup
RUN set -ex && \
    mkdir -p /tmp && chmod 1777 /tmp && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
<<<<<<< Updated upstream
        ca-certificates curl bash-completion fish exa git zsh openssh-client \
        hyperfine ripgrep vim neovim elvish xonsh yash busybox age gh kubectx \
        sudo wget gnupg build-essential python3-pip python3-venv jq fzf bat \
        fd-find unzip xz-utils apt-transport-https software-properties-common clangd && \
    rm -rf /var/lib/apt/lists/* && \
    # Permissions and symlinks
    chmod 755 /usr/bin/code-server /usr/lib/code-server/bin/code-server && \
=======
    ca-certificates \
    curl \
    bash-completion \
    fish \
    exa \
    git \
    zsh \
    openssh-client \
    hyperfine \
    ripgrep \
    vim \
    neovim \
    elvish \
    xonsh \
    yash \
    busybox \
    age \
    gh \
    kubectx \
    sudo \
    wget \
    gnupg \
    build-essential \
    python3-pip \
    python3-venv \
    jq \
    fzf \
    bat \
    fd-find \
    unzip \
    xz-utils \
    apt-transport-https \
    software-properties-common; \
    rm -rf /var/lib/apt/lists/*

# Layer Optimization: Consolidated permissions and symlinks (Phase 1 - Issue #459)
RUN chmod 755 /usr/bin/code-server /usr/lib/code-server/bin/code-server && \
>>>>>>> Stashed changes
    ln -sf /usr/bin/fdfind /usr/local/bin/fd && \
    ln -sf /usr/bin/exa /usr/local/bin/eza

# Layer 2: Install all CLI tools in one consolidated layer
RUN set -eux && \
    # Determine platform architectures
    case "$TARGETPLATFORM" in \
<<<<<<< Updated upstream
=======
      "linux/amd64") ARCH=Linux_x86_64 ;; \
      "linux/arm64") ARCH=Linux_arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    LAZYGIT_ARCHIVE="lazygit_${LAZYGIT_VERSION}_${ARCH}.tar.gz"; \
    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/${LAZYGIT_ARCHIVE}" -o /tmp/lazygit.tar.gz; \
    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/checksums.txt" -o /tmp/lazygit.checksums.txt; \
    grep "${LAZYGIT_ARCHIVE}" /tmp/lazygit.checksums.txt | awk '{print $1 "  /tmp/lazygit.tar.gz"}' > /tmp/lazygit.sha256; \
    sha256sum --check --strict /tmp/lazygit.sha256; \
    tar -xf /tmp/lazygit.tar.gz -C /tmp lazygit; \
    install -m755 /tmp/lazygit /usr/local/bin/lazygit; \
    rm -rf /tmp/lazygit.tar.gz /tmp/lazygit /tmp/lazygit.checksums.txt /tmp/lazygit.sha256

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

# Install Node.js 18 LTS (verified download)
RUN set -eux; \
    NODE_VERSION="18.18.0"; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") NODE_ARCH=x64 ;; \
      "linux/arm64") NODE_ARCH=arm64 ;; \
      *) echo "Unsupported platform for Node.js: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"; \
    cd /tmp; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep "${NODE_TARBALL}" SHASUMS256.txt | sha256sum --check --strict -; \
    mkdir -p /usr/local/lib/nodejs; \
    tar -xJf "${NODE_TARBALL}" -C /usr/local/lib/nodejs --strip-components=1; \
    ln -sf /usr/local/lib/nodejs/bin/node /usr/local/bin/node; \
    ln -sf /usr/local/lib/nodejs/bin/npm /usr/local/bin/npm; \
    ln -sf /usr/local/lib/nodejs/bin/npx /usr/local/bin/npx; \
    rm -rf /tmp/*; \
    node --version; npm --version

# Install global npm packages
RUN npm install -g \
    yarn \
    pnpm \
    typescript \
    @types/node \
    prettier \
    eslint \
    ts-node

# Install cosign for binary verification
ARG COSIGN_VERSION=2.2.4
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") COSIGN_ARCH=amd64 ;; \
      "linux/arm64") COSIGN_ARCH=arm64 ;; \
      *) echo "Unsupported platform for cosign: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    COSIGN_BINARY="cosign-linux-${COSIGN_ARCH}"; \
    cd /tmp; \
    curl -fsSLO "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/${COSIGN_BINARY}"; \
    curl -fsSLO "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign_checksums.txt"; \
    awk -v target="${COSIGN_BINARY}" '$2 == target {print $0}' cosign_checksums.txt > cosign.sha256; \
    if [ ! -s cosign.sha256 ]; then echo "Checksum for ${COSIGN_BINARY} not found"; exit 1; fi; \
    sha256sum --check --strict cosign.sha256; \
    chmod +x "${COSIGN_BINARY}"; \
    mv "${COSIGN_BINARY}" /usr/local/bin/cosign; \
    rm -f cosign_checksums.txt cosign.sha256; \
    cosign version

# Install Go (match architecture for multi-arch builds)
ARG GO_VERSION=1.22.4
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
    sha256sum --check --strict "${GO_TARBALL}.sha256"; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"; \
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

# 3. PocketBase - Lightweight database (MIT License)
ARG POCKETBASE_VERSION=0.24.4
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") PB_ARCH=amd64 ;; \
      "linux/arm64") PB_ARCH=arm64 ;; \
      *) echo "Unsupported platform for PocketBase: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${PB_ARCH}.zip" -o /tmp/pocketbase.zip; \
    unzip /tmp/pocketbase.zip -d /tmp; \
    install -m755 /tmp/pocketbase /usr/local/bin/pocketbase; \
    rm -rf /tmp/pocketbase.zip /tmp/pocketbase

# 4. Devbox - Portable development environments (Apache 2.0)
RUN set -eux; \
    curl -fsSL https://get.jetify.com/devbox | bash -s -- -f

# 5. Clone OpenAI Cookbook for reference examples
RUN git clone --depth=1 https://github.com/openai/openai-cookbook /opt/openai-cookbook && \
    chmod -R a+rX /opt/openai-cookbook

# 6. Verify all required tools are installed (MUST succeed or build fails)
RUN set -e && \
    echo "🔍 Verifying installed tools..." && \
    echo "Testing vim..." && vim --version | head -1 && \
    echo "Testing nvim..." && nvim --version | head -1 && \
    echo "Testing aider..." && aider --version && \
    echo "Testing goose..." && goose -version 2>&1 | grep -i goose && \
    echo "Testing pocketbase..." && pocketbase --version && \
    echo "Testing devbox..." && devbox version && \
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
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) \
        pip3 install --break-system-packages stratus-red-team || echo "Stratus Red Team not available, skipping" \
        ;; \
      arm64) \
        echo "Stratus Red Team skipped for arm64" \
        ;; \
      *) \
        echo "Stratus Red Team skipped for ${TARGETARCH:-unknown}" \
        ;; \
    esac

# 6. Eppo (feature flagging) - REMOVED due to unverified curl|bash security issue
# See: docker/code-server/SECURITY_AUDIT.md - Issue #3
# Alternative: Use environment variables for feature flags or install manually if needed
RUN echo "Eppo agent removed - use environment-based feature flags or manual installation"

# 7. Toto (test observability) - optional
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) \
        pip3 install --break-system-packages datadog-toto || echo "Datadog Toto not available, skipping" \
        ;; \
      arm64) \
        echo "Datadog Toto skipped for arm64" \
        ;; \
      *) \
        echo "Datadog Toto skipped for ${TARGETARCH:-unknown}" \
        ;; \
    esac

# Layer Optimization: Consolidated workspace setup and permissions (Phase 1 - Issue #459)
WORKDIR /home/coder/workspace
RUN mkdir -p /home/coder/workspace/.datadog/templates && \
    chown -R coder:coder /home/coder

# Copy Datadog configuration script
COPY docker/code-server/configure-datadog.sh /tmp/configure-datadog.sh
RUN chmod +x /tmp/configure-datadog.sh && \
    /tmp/configure-datadog.sh && \
    chown -R coder:coder /home/coder/workspace/.datadog && \
    chown -R coder:coder /home/coder/workspace/verify-datadog-tools.sh

# Switch to coder user for extension installation
USER coder

ENV PATH="/home/coder/.local/bin:${PATH}"

# Layer Optimization: Create VSCode directories (consolidated - Phase 1 - Issue #459)
RUN mkdir -p /home/coder/.local/share/code-server/User/ /home/coder/.vscode/extensions/

# Install Extensions Based on Profile
# Profile-based installation reduces image size and build time
# Profiles: minimal, standard, ai, web, full

# Copy profile file
COPY --chown=coder:coder docker/code-server/profiles/${PROFILE}.txt /tmp/extensions-list.txt

# Install extensions from profile (combined into single layer for efficiency)
# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/home/coder/.cache/code-server \
    echo "📦 Installing extensions for profile: ${PROFILE}" && \
    grep -v '^#' /tmp/extensions-list.txt | grep -v '^$' | while read -r extension; do \
        if [ -n "$extension" ]; then \
            echo "Installing: $extension" && \
            /usr/bin/code-server --install-extension "$extension" --force || \
            echo "⚠️  Failed to install $extension, skipping"; \
        fi; \
    done && \
    rm -f /tmp/extensions-list.txt && \
    echo "✅ Extension installation complete for profile: ${PROFILE}"

# Patch extensions to work in code-server (remove desktop-only restrictions)
RUN for ext_dir in /home/coder/.local/share/code-server/extensions/anthropic.claude-code* \
                   /home/coder/.local/share/code-server/extensions/openai.chatgpt*; do \
    if [ -d "$ext_dir" ]; then \
        sed -i 's/"extensionKind":\s*\["ui"\]/"extensionKind": ["ui", "workspace"]/g' "$ext_dir/package.json" 2>/dev/null || true; \
        echo "Patched $(basename $ext_dir) for code-server compatibility"; \
    fi; \
done

# Clean up (as root)
USER root
RUN rm -rf /tmp/extensions
USER coder

# 5. Continue - Open-source autopilot (Apache 2.0) - SKIPPED (hangs during install)
# RUN code-server --install-extension Continue.continue

# 6. Aider - AI pair programming (Apache 2.0) - SKIPPED (not essential)
# RUN code-server --install-extension aider.aider-vscode

# Install Language Server Protocol (LSP) Servers
# Switch to root for system-level installations
USER root

# 1. Python LSP (pylsp) - installed as coder user
USER coder
RUN pip3 install --break-system-packages 'python-lsp-server[all]' pylsp-mypy python-lsp-black

# Install AI pair-programming CLIs for parity with KinD image
RUN python3 -m pip install --break-system-packages --no-cache-dir 'aider-chat==0.84.0' 'goose-ai==0.9.11' 'langfuse<3'

# Install additional permissively licensed shells and DevOps CLIs
USER root
RUN set -eux; \
    PLATFORM="${TARGETPLATFORM:-linux/$(uname -m)}"; \
    case "$PLATFORM" in \
      linux/aarch64) PLATFORM="linux/arm64" ;; \
      linux/x86_64) PLATFORM="linux/amd64" ;; \
    esac; \
    case "$PLATFORM" in \
>>>>>>> Stashed changes
      "linux/amd64") \
        LAZYGIT_ARCH=Linux_x86_64; \
        STARSHIP_ARCH=x86_64-unknown-linux-musl; \
        ZOXIDE_ARCH=amd64; \
        NUSHELL_PKG="nu-${NUSHELL_VERSION}-x86_64-unknown-linux-gnu"; \
        DELTA_ARCH="x86_64-unknown-linux-gnu"; \
        JUST_ARCH="x86_64-unknown-linux-musl"; \
        STERN_ARCH="linux_amd64"; \
        HELMFILE_ARCH="linux_amd64"; \
        HELM_TAR_ARCH="linux-amd64"; \
        HELM_TAR_DIR="linux-amd64"; \
        KUBECTL_ARCH="linux/amd64"; \
        K9S_ARCH="Linux_amd64"; \
        SOPS_SUFFIX="linux.amd64"; \
        GLAB_ARCH="Linux_x86_64"; \
        KUBE_SHORT_ARCH="linux_x86_64"; \
        COSIGN_ARCH="amd64"; \
        GO_ARCH="amd64"; \
        PB_ARCH="amd64"; \
        NODE_ARCH="x64" ;; \
      "linux/arm64") \
        LAZYGIT_ARCH=Linux_arm64; \
        STARSHIP_ARCH=aarch64-unknown-linux-musl; \
        ZOXIDE_ARCH=arm64; \
        NUSHELL_PKG="nu-${NUSHELL_VERSION}-aarch64-unknown-linux-gnu"; \
        DELTA_ARCH="aarch64-unknown-linux-gnu"; \
        JUST_ARCH="aarch64-unknown-linux-musl"; \
        STERN_ARCH="linux_arm64"; \
        HELMFILE_ARCH="linux_arm64"; \
        HELM_TAR_ARCH="linux-arm64"; \
        HELM_TAR_DIR="linux-arm64"; \
        KUBECTL_ARCH="linux/arm64"; \
        K9S_ARCH="Linux_arm64"; \
        SOPS_SUFFIX="linux.arm64"; \
        GLAB_ARCH="Linux_arm64"; \
        KUBE_SHORT_ARCH="linux_arm64"; \
        COSIGN_ARCH="arm64"; \
        GO_ARCH="arm64"; \
        PB_ARCH="arm64"; \
        NODE_ARCH="arm64" ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac && \
    # Install lazygit
    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_${LAZYGIT_ARCH}.tar.gz" -o /tmp/lazygit.tar.gz && \
    tar -xf /tmp/lazygit.tar.gz -C /tmp lazygit && install -m755 /tmp/lazygit /usr/local/bin/lazygit && \
    # Install starship
    curl -fsSL "https://github.com/starship/starship/releases/download/v${STARSHIP_VERSION}/starship-${STARSHIP_ARCH}.tar.gz" -o /tmp/starship.tar.gz && \
    tar -xf /tmp/starship.tar.gz -C /tmp && install -m755 /tmp/starship /usr/local/bin/starship && \
    # Install zoxide
    curl -fsSL "https://github.com/ajeetdsouza/zoxide/releases/download/v${ZOXIDE_VERSION}/zoxide_${ZOXIDE_VERSION}-1_${ZOXIDE_ARCH}.deb" -o /tmp/zoxide.deb && \
    apt-get update && apt-get install -y --no-install-recommends /tmp/zoxide.deb && \
    # Install nushell
    curl -fsSL "https://github.com/nushell/nushell/releases/download/${NUSHELL_VERSION}/${NUSHELL_PKG}.tar.gz" -o /tmp/nushell.tar.gz && \
    tar -xzf /tmp/nushell.tar.gz -C /tmp && find /tmp -type f -name "nu" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/nu && chmod 755 /usr/local/bin/nu && \
    # Install delta
    curl -fsSL "https://github.com/dandavison/delta/releases/download/${DELTA_VERSION}/delta-${DELTA_VERSION}-${DELTA_ARCH}.tar.gz" -o /tmp/delta.tar.gz && \
    tar -xzf /tmp/delta.tar.gz -C /tmp && find /tmp -type f -name "delta" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/delta && chmod 755 /usr/local/bin/delta && \
    # Install chezmoi
    curl -fsSL "https://github.com/twpayne/chezmoi/releases/download/v${CHEZMOI_VERSION}/chezmoi_${CHEZMOI_VERSION}_linux_${GO_ARCH}.tar.gz" -o /tmp/chezmoi.tar.gz && \
    tar -xzf /tmp/chezmoi.tar.gz -C /tmp && find /tmp -type f -name "chezmoi" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/chezmoi && chmod 755 /usr/local/bin/chezmoi && \
    # Install just
    curl -fsSL "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-${JUST_ARCH}.tar.gz" -o /tmp/just.tar.gz && \
    tar -xzf /tmp/just.tar.gz -C /tmp && find /tmp -type f -name "just" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/just && chmod 755 /usr/local/bin/just && \
    # Install stern
    curl -fsSL "https://github.com/stern/stern/releases/download/v${STERN_VERSION}/stern_${STERN_VERSION}_${STERN_ARCH}.tar.gz" -o /tmp/stern.tar.gz && \
    tar -xzf /tmp/stern.tar.gz -C /tmp && find /tmp -type f -name "stern" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/stern && chmod 755 /usr/local/bin/stern && \
    # Install helmfile
    curl -fsSL "https://github.com/helmfile/helmfile/releases/download/v${HELMFILE_VERSION}/helmfile_${HELMFILE_VERSION}_${HELMFILE_ARCH}.tar.gz" -o /tmp/helmfile.tar.gz && \
    tar -xzf /tmp/helmfile.tar.gz -C /tmp && find /tmp -type f -name "helmfile" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/helmfile && chmod 755 /usr/local/bin/helmfile && \
    # Install k9s
    curl -fsSL "https://github.com/derailed/k9s/releases/download/v${K9S_VERSION}/k9s_${K9S_ARCH}.tar.gz" -o /tmp/k9s.tar.gz && \
    tar -xzf /tmp/k9s.tar.gz -C /tmp && find /tmp -type f -name "k9s" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/k9s && chmod 755 /usr/local/bin/k9s && \
    # Install sops
    curl -fsSL "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.${SOPS_SUFFIX}" -o /usr/local/bin/sops && chmod 755 /usr/local/bin/sops && \
    # Install glab
    curl -fsSL "https://github.com/profclems/glab/releases/download/v${GLAB_VERSION}/glab_${GLAB_VERSION}_${GLAB_ARCH}.tar.gz" -o /tmp/glab.tar.gz && \
    tar -xzf /tmp/glab.tar.gz -C /tmp && find /tmp -type f -name "glab" -executable | head -1 | xargs -I {} cp {} /usr/local/bin/glab && chmod 755 /usr/local/bin/glab && \
    # Install cosign
    curl -fsSLO "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-${COSIGN_ARCH}" && \
    curl -fsSLO "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign_checksums.txt" && \
    awk -v target="cosign-linux-${COSIGN_ARCH}" '$2 == target {print $0}' cosign_checksums.txt > cosign.sha256 && \
    if [ ! -s cosign.sha256 ]; then echo "Checksum not found"; exit 1; fi && \
    sha256sum --check --strict cosign.sha256 && \
    chmod +x "cosign-linux-${COSIGN_ARCH}" && mv "cosign-linux-${COSIGN_ARCH}" /usr/local/bin/cosign && \
    rm -f cosign_checksums.txt cosign.sha256 && \
    # Install pocketbase
    curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${PB_ARCH}.zip" -o /tmp/pocketbase.zip && \
    unzip /tmp/pocketbase.zip -d /tmp && install -m755 /tmp/pocketbase /usr/local/bin/pocketbase && \
    # Install devbox
    curl -fsSL https://get.jetify.com/devbox | bash -s -- -f && \
    # Cleanup
    rm -rf /tmp/* /var/lib/apt/lists/*

# Layer 3: Install Node.js
RUN set -eux && \
    NODE_VERSION="18.18.0" && \
    case "$TARGETPLATFORM" in \
      "linux/amd64") NODE_ARCH=x64 ;; \
      "linux/arm64") NODE_ARCH=arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac && \
    NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" && \
    cd /tmp && \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}" && \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" && \
    grep "${NODE_TARBALL}" SHASUMS256.txt | sha256sum --check --strict - && \
    mkdir -p /usr/local/lib/nodejs && \
    tar -xJf "${NODE_TARBALL}" -C /usr/local/lib/nodejs --strip-components=1 && \
    ln -sf /usr/local/lib/nodejs/bin/node /usr/local/bin/node && \
    ln -sf /usr/local/lib/nodejs/bin/npm /usr/local/bin/npm && \
    ln -sf /usr/local/lib/nodejs/bin/npx /usr/local/bin/npx && \
    rm -rf /tmp/* && \
    node --version && npm --version

# Layer 4: Install Go
RUN set -eux && \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac && \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" && \
    cd /tmp && \
    curl -fsSLo "${GO_TARBALL}" "https://dl.google.com/go/${GO_TARBALL}" && \
    curl -fsSLo "${GO_TARBALL}.sha256" "https://dl.google.com/go/${GO_TARBALL}.sha256" && \
    sha256sum --check --strict "${GO_TARBALL}.sha256" && \
    tar -C /usr/local -xzf "${GO_TARBALL}" && \
    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256" && \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go

# Layer 5: Install Helm with verification and kubectl with kubectx
RUN set -eux && \
    case "$TARGETPLATFORM" in \
      "linux/amd64") \
        HELM_TAR_ARCH="linux-amd64"; HELM_TAR_DIR="linux-amd64"; \
        KUBECTL_ARCH="linux/amd64"; KUBE_SHORT_ARCH="linux_x86_64" ;; \
      "linux/arm64") \
        HELM_TAR_ARCH="linux-arm64"; HELM_TAR_DIR="linux-arm64"; \
        KUBECTL_ARCH="linux/arm64"; KUBE_SHORT_ARCH="linux_arm64" ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac && \
    # Install Helm
    HELM_ARCHIVE="helm-v${HELM_VERSION}-${HELM_TAR_ARCH}.tar.gz" && \
    curl -fsSL "https://get.helm.sh/${HELM_ARCHIVE}" -o /tmp/helm.tar.gz && \
    curl -fsSL "https://get.helm.sh/${HELM_ARCHIVE}.sha256sum" -o /tmp/helm.sha256sum && \
    curl -fsSL "https://get.helm.sh/${HELM_ARCHIVE}.sha256sum.sig" -o /tmp/helm.sha256sum.sig && \
    curl -fsSL "https://get.helm.sh/${HELM_ARCHIVE}.sha256sum.pem" -o /tmp/helm.sha256sum.pem && \
    cosign verify-blob \
      --signature /tmp/helm.sha256sum.sig \
      --certificate /tmp/helm.sha256sum.pem \
      --certificate-identity-regexp "https://github.com/helm/helm/.*" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      /tmp/helm.sha256sum && \
    HELM_SUM=$(awk '{print $1}' /tmp/helm.sha256sum) && \
    echo "${HELM_SUM}  /tmp/helm.tar.gz" | sha256sum --check --status && \
    tar -xzf /tmp/helm.tar.gz -C /tmp && \
    cp "/tmp/${HELM_TAR_DIR}/helm" /usr/local/bin/helm && chmod 755 /usr/local/bin/helm && \
    # Install kubectl
    curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl" -o /tmp/kubectl && \
    curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl.sha256" -o /tmp/kubectl.sha256 && \
    curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl.sha256.sig" -o /tmp/kubectl.sha256.sig && \
    curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl.sha256.pem" -o /tmp/kubectl.sha256.pem && \
    cosign verify-blob \
      --signature /tmp/kubectl.sha256.sig \
      --certificate /tmp/kubectl.sha256.pem \
      --certificate-identity "https://github.com/kubernetes/release" \
      --certificate-oidc-issuer "https://accounts.google.com" \
      /tmp/kubectl.sha256 && \
    echo "$(cat /tmp/kubectl.sha256)  /tmp/kubectl" | sha256sum --check --status && \
    install -m755 /tmp/kubectl /usr/local/bin/kubectl && \
    # Install kubectx/kubens
    KUBECTX_BASE="https://github.com/ahmetb/kubectx/releases/download/v${KUBECTX_VERSION}" && \
    curl -fsSL "${KUBECTX_BASE}/checksums.txt" -o /tmp/kubectx-checksums.txt && \
    curl -fsSL "${KUBECTX_BASE}/checksums.txt.sig" -o /tmp/kubectx-checksums.txt.sig && \
    curl -fsSL "${KUBECTX_BASE}/checksums.txt.pem" -o /tmp/kubectx-checksums.txt.pem && \
    cosign verify-blob \
      --signature /tmp/kubectx-checksums.txt.sig \
      --certificate /tmp/kubectx-checksums.txt.pem \
      --certificate-identity-regexp "https://github.com/ahmetb/kubectx/.+" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      /tmp/kubectx-checksums.txt && \
    # Install kubectx
    KUBECTX_ARCHIVE="kubectx_v${KUBECTX_VERSION}_${KUBE_SHORT_ARCH}.tar.gz" && \
    curl -fsSL "${KUBECTX_BASE}/${KUBECTX_ARCHIVE}" -o /tmp/${KUBECTX_ARCHIVE} && \
    KUBECTX_SUM=$(grep "  ${KUBECTX_ARCHIVE}$" /tmp/kubectx-checksums.txt | awk '{print $1}') && \
    echo "${KUBECTX_SUM}  /tmp/${KUBECTX_ARCHIVE}" | sha256sum --check --status && \
    tar -xzf /tmp/${KUBECTX_ARCHIVE} -C /tmp && install -m755 /tmp/kubectx /usr/local/bin/kubectx && \
    # Install kubens
    KUBENS_ARCHIVE="kubens_v${KUBECTX_VERSION}_${KUBE_SHORT_ARCH}.tar.gz" && \
    curl -fsSL "${KUBECTX_BASE}/${KUBENS_ARCHIVE}" -o /tmp/${KUBENS_ARCHIVE} && \
    KUBENS_SUM=$(grep "  ${KUBENS_ARCHIVE}$" /tmp/kubectx-checksums.txt | awk '{print $1}') && \
    echo "${KUBENS_SUM}  /tmp/${KUBENS_ARCHIVE}" | sha256sum --check --status && \
    tar -xzf /tmp/${KUBENS_ARCHIVE} -C /tmp && install -m755 /tmp/kubens /usr/local/bin/kubens && \
    # Cleanup
    rm -rf /tmp/*

# Layer 6: Install npm packages, Go tools, and Python packages in one layer
RUN set -eux && \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac && \
    # Install goose
    CGO_ENABLED=0 GOOS=linux GOARCH="${GO_ARCH}" GOBIN=/usr/local/bin go install github.com/pressly/goose/v3/cmd/goose@latest && \
    chmod 755 /usr/local/bin/goose && \
    mkdir -p /home/coder/.vscode/extensions/goose-integration && \
    echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc && \
    chown -R coder:coder /home/coder/.vscode && \
    # Install Python packages
    pip3 install --break-system-packages --no-cache-dir \
      aider-chat 'python-lsp-server[all]' pylsp-mypy python-lsp-black \
      'aider-chat==0.84.0' 'goose-ai==0.9.11' 'langfuse<3' && \
    # Optional installs for amd64 only
    if [ "${TARGETARCH:-amd64}" = "amd64" ]; then \
      curl -sSfL https://raw.githubusercontent.com/DataDog/kubehound/main/install.sh | sh || echo "KubeHound skipped"; \
      pip3 install --break-system-packages stratus-red-team || echo "Stratus skipped"; \
      (curl -sL https://packagecloud.io/install/repositories/eppo/eppo-server/script.deb.sh | bash && apt-get install -y eppo-agent) || echo "Eppo skipped"; \
      pip3 install --break-system-packages datadog-toto || echo "Toto skipped"; \
    fi && \
    # Clone OpenAI Cookbook
    git clone --depth=1 https://github.com/openai/openai-cookbook /opt/openai-cookbook && \
    chmod -R a+rX /opt/openai-cookbook && \
    # Verify tools
    echo "Verifying tools..." && \
    vim --version | head -1 && nvim --version | head -1 && \
    aider --version && goose -version 2>&1 | grep -i goose && \
    pocketbase --version && devbox version && \
    echo "All required tools verified"

# Layer 8: Setup rust-analyzer and shell completions
RUN set -eux && \
    # Install rust-analyzer
    curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-x86_64-unknown-linux-gnu.gz | gunzip -c - > /usr/local/bin/rust-analyzer && \
    chmod +x /usr/local/bin/rust-analyzer && \
    # Generate shell completions
    mkdir -p /etc/bash_completion.d /usr/share/zsh/site-functions /etc/fish/completions && \
    if command -v kubectl >/dev/null 2>&1; then \
      kubectl completion bash > /etc/bash_completion.d/kubectl && \
      kubectl completion zsh > /usr/share/zsh/site-functions/_kubectl && \
      kubectl completion fish > /etc/fish/completions/kubectl.fish && \
      chmod 644 /etc/bash_completion.d/kubectl /usr/share/zsh/site-functions/_kubectl /etc/fish/completions/kubectl.fish; \
    fi && \
    if command -v helm >/dev/null 2>&1; then \
      helm completion bash > /etc/bash_completion.d/helm && \
      helm completion zsh > /usr/share/zsh/site-functions/_helm && \
      helm completion fish > /etc/fish/completions/helm.fish && \
      chmod 644 /etc/bash_completion.d/helm /usr/share/zsh/site-functions/_helm /etc/fish/completions/helm.fish; \
    fi

<<<<<<< Updated upstream
# Layer 9: Setup workspace and Datadog configuration
RUN mkdir -p /home/coder/workspace/.datadog/templates && \
    chown -R coder:coder /home/coder && \
    chown -R coder:coder /home/coder/workspace/.datadog

WORKDIR /home/coder/workspace

# Copy Datadog configuration script
COPY docker/code-server/configure-datadog.sh /tmp/configure-datadog.sh
RUN chmod +x /tmp/configure-datadog.sh && \
    /tmp/configure-datadog.sh && \
    chown -R coder:coder /home/coder/workspace/.datadog && \
    chown -R coder:coder /home/coder/workspace/verify-datadog-tools.sh

# Switch to coder user
USER coder
ENV PATH="/home/coder/.local/bin:/home/coder/go/bin:${PATH}"
=======
# Layer Optimization: Consolidated LSP server installations (Phase 1 - Issue #459)
# Reduces 8 separate RUN commands (with USER switches) into optimized layers
# Group 1: Root-level npm and apt installations
RUN set -eux; \
    echo "📦 Installing LSP servers (root)..."; \
    npm install -g typescript-language-server vscode-langservers-extracted bash-language-server dockerfile-language-server-nodejs; \
    curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-x86_64-unknown-linux-gnu.gz | gunzip -c - > /usr/local/bin/rust-analyzer; \
    chmod +x /usr/local/bin/rust-analyzer; \
    apt-get update; \
    apt-get install -y clangd; \
    rm -rf /var/lib/apt/lists/*; \
    echo "✅ Root LSP installations complete"

# Group 2: User-level LSP installations (as coder)
USER coder
RUN set -eux; \
    echo "📦 Installing user LSP servers..."; \
    go install golang.org/x/tools/gopls@latest || echo "⚠️  gopls installation failed, skipping"; \
    mkdir -p /home/coder/.local/share/jdtls; \
    curl -L https://download.eclipse.org/jdtls/milestones/1.9.0/jdt-language-server-1.9.0-202203031534.tar.gz | tar xz -C /home/coder/.local/share/jdtls; \
    echo "✅ User LSP installations complete"

# Configure environment for LSP servers
ENV PATH="/home/coder/go/bin:${PATH}"
>>>>>>> Stashed changes
ENV NODE_PATH=/usr/local/lib/node_modules

# Create directories for VSCode
RUN mkdir -p /home/coder/.local/share/code-server/User/ \
    && mkdir -p /home/coder/.vscode/extensions/

# Layer 10: Install VSCode extensions based on profile
COPY --chown=coder:coder docker/code-server/profiles/${PROFILE}.txt /tmp/extensions-list.txt
RUN --mount=type=cache,target=/home/coder/.cache/code-server \
    echo "Installing extensions for profile: ${PROFILE}" && \
    grep -v '^#' /tmp/extensions-list.txt | grep -v '^$' | while read -r extension; do \
        if [ -n "$extension" ]; then \
            echo "Installing: $extension" && \
            /usr/bin/code-server --install-extension "$extension" --force || \
            echo "Failed to install $extension, skipping"; \
        fi; \
    done && \
    rm -f /tmp/extensions-list.txt && \
    # Patch extensions for code-server compatibility
    for ext_dir in /home/coder/.local/share/code-server/extensions/anthropic.claude-code* \
                   /home/coder/.local/share/code-server/extensions/openai.chatgpt*; do \
      if [ -d "$ext_dir" ]; then \
          sed -i 's/"extensionKind":\s*\["ui"\]/"extensionKind": ["ui", "workspace"]/g' "$ext_dir/package.json" 2>/dev/null || true; \
          echo "Patched $(basename $ext_dir) for code-server"; \
      fi; \
    done && \
    # Install essential Microsoft and permissively licensed extensions
    /usr/bin/code-server --install-extension ms-vscode.vscode-typescript-next || echo "TypeScript failed" && \
    /usr/bin/code-server --install-extension dbaeumer.vscode-eslint || echo "ESLint failed" && \
    /usr/bin/code-server --install-extension usernamehw.errorlens || echo "ErrorLens failed" && \
    /usr/bin/code-server --install-extension PKief.material-icon-theme || echo "Icons failed" && \
    /usr/bin/code-server --install-extension esbenp.prettier-vscode || echo "Prettier failed" && \
    /usr/bin/code-server --install-extension mhutchie.git-graph || echo "Git graph failed" && \
    /usr/bin/code-server --install-extension orta.vscode-jest || echo "Jest failed" && \
    /usr/bin/code-server --install-extension redhat.vscode-yaml || echo "YAML failed" && \
    /usr/bin/code-server --install-extension bradlc.vscode-tailwindcss || echo "Tailwind failed" && \
    /usr/bin/code-server --install-extension mikestead.dotenv || echo "dotenv failed" && \
    /usr/bin/code-server --install-extension datadog.datadog-vscode || echo "Datadog failed" && \
    /usr/bin/code-server --install-extension mtxr.sqltools || echo "SQLTools failed" && \
    /usr/bin/code-server --install-extension ms-azuretools.vscode-docker || echo "Docker failed" && \
    /usr/bin/code-server --install-extension humao.rest-client || echo "REST client failed" && \
    /usr/bin/code-server --install-extension yzhang.markdown-all-in-one || echo "Markdown failed" && \
    echo "Extension installation complete"

# Switch to root for final setup
USER root
RUN rm -rf /tmp/extensions
USER coder

# Layer 11: Install Go LSP and Java LSP
RUN go install golang.org/x/tools/gopls@latest || echo "gopls installation failed, skipping" && \
    mkdir -p /home/coder/.local/share/jdtls && \
    curl -L https://download.eclipse.org/jdtls/milestones/1.9.0/jdt-language-server-1.9.0-202203031534.tar.gz | tar xz -C /home/coder/.local/share/jdtls

# Switch to root for AI extensions script
USER root
COPY docker/code-server/configure-ai-extensions.sh /tmp/configure-ai-extensions.sh
RUN chmod +x /tmp/configure-ai-extensions.sh && \
    /tmp/configure-ai-extensions.sh && \
    rm /tmp/configure-ai-extensions.sh && \
    chown -R coder:coder /home/coder/.local/share/code-server/ && \
    chown -R coder:coder /home/coder/.vscode/
USER coder

# Layer 12: Copy VibeCode extensions and configure VS Code
COPY --chown=coder:coder extensions/vibecode-ai-assistant /home/coder/.vscode/extensions/vibecode-ai-assistant
COPY --chown=coder:coder extensions/vibecode-inline-edit /home/coder/.vscode/extensions/vibecode-inline-edit
COPY --chown=coder:coder extensions/vibecode-codebase-chat /home/coder/.vscode/extensions/vibecode-codebase-chat
COPY --chown=coder:coder extensions/claude-code-vscode /home/coder/.vscode/extensions/claude-code-vscode

<<<<<<< Updated upstream
# Copy VS Code configuration
COPY --chown=coder:coder docker/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder docker/code-server/keybindings.json /home/coder/.local/share/code-server/User/keybindings.json

# Build VibeCode extensions
RUN cd /home/coder/.vscode/extensions/vibecode-ai-assistant && \
    npm install && (npm run compile || npm run build || echo "No build script") && \
    cd /home/coder/.vscode/extensions/vibecode-inline-edit && \
    npm install && (npm run build || npm run compile || echo "No build script") && \
    cd /home/coder/.vscode/extensions/vibecode-codebase-chat && \
    npm install && (npm run build || npm run compile || echo "No build script")

# Verify ALL required CLI tools
RUN set -e && \
    echo "Verifying ALL required tools..." && \
    for tool in vim nvim nu delta chezmoi just stern helmfile helm kubectl kubectx kubens k9s sops glab; do \
      command -v "$tool" >/dev/null && echo "$tool OK" || { echo "$tool MISSING"; exit 1; }; \
    done && \
    aider --version >/dev/null && echo "aider OK" || { echo "aider MISSING"; exit 1; } && \
    /usr/local/bin/goose -version >/dev/null 2>&1 && echo "goose OK" || { echo "goose MISSING"; exit 1; } && \
    echo "All tools verified successfully"

=======
# Layer Optimization: Consolidated VSCode extension installation (Phase 1 - Issue #459)
# Reduces 14 separate RUN commands into 1 multi-line layer
# Extensions grouped by category for maintainability
RUN set -eux; \
    echo "📦 Installing VSCode extensions (consolidated layer)..."; \
    # Official Microsoft Extensions (MIT Licensed)
    /usr/bin/code-server --install-extension ms-vscode.vscode-typescript-next || echo "⚠️  TypeScript extension failed"; \
    /usr/bin/code-server --install-extension dbaeumer.vscode-eslint || echo "⚠️  ESLint extension failed"; \
    # Productivity and Developer Tools (MIT/BSD/Apache)
    /usr/bin/code-server --install-extension usernamehw.errorlens || echo "⚠️  ErrorLens failed"; \
    /usr/bin/code-server --install-extension PKief.material-icon-theme || echo "⚠️  Material icons failed"; \
    # Code Quality and Formatting (MIT)
    /usr/bin/code-server --install-extension esbenp.prettier-vscode || echo "⚠️  Prettier failed"; \
    # Git Tools (MIT)
    /usr/bin/code-server --install-extension mhutchie.git-graph || echo "⚠️  Git graph failed"; \
    # Testing and Debugging (MIT)
    /usr/bin/code-server --install-extension orta.vscode-jest || echo "⚠️  Jest extension failed"; \
    # Language Support (MIT/Apache)
    /usr/bin/code-server --install-extension redhat.vscode-yaml || echo "⚠️  YAML failed"; \
    /usr/bin/code-server --install-extension bradlc.vscode-tailwindcss || echo "⚠️  Tailwind failed"; \
    # Utilities (MIT)
    /usr/bin/code-server --install-extension mikestead.dotenv || echo "⚠️  dotenv failed"; \
    # Datadog Official Extension (Apache 2.0)
    /usr/bin/code-server --install-extension datadog.datadog-vscode || echo "⚠️  Datadog extension failed"; \
    # Database Tools (MIT/Apache)
    /usr/bin/code-server --install-extension mtxr.sqltools || echo "⚠️  SQLTools failed"; \
    # Docker and Kubernetes (Microsoft - MIT)
    /usr/bin/code-server --install-extension ms-azuretools.vscode-docker || echo "⚠️  Docker extension failed"; \
    # REST API Testing (MIT)
    /usr/bin/code-server --install-extension humao.rest-client || echo "⚠️  REST client failed"; \
    # Markdown and Documentation (MIT)
    /usr/bin/code-server --install-extension yzhang.markdown-all-in-one || echo "⚠️  Markdown failed"; \
    echo "✅ VSCode extension installation complete"

# Configure VS Code settings
COPY --chown=coder:coder docker/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder docker/code-server/keybindings.json /home/coder/.local/share/code-server/User/keybindings.json

# Layer Optimization: Consolidated VibeCode extension builds (Phase 1 - Issue #459)
# Reduces 3 separate RUN commands into 1 multi-line layer
RUN set -eux; \
    echo "🔨 Building VibeCode extensions..."; \
    cd /home/coder/.vscode/extensions/vibecode-ai-assistant && \
    npm install && \
    (npm run compile || npm run build || echo "⚠️  No build script, extension will load from source"); \
    cd /home/coder/.vscode/extensions/vibecode-inline-edit && \
    npm install && \
    (npm run build || npm run compile || echo "⚠️  No build script, extension will load from source"); \
    cd /home/coder/.vscode/extensions/vibecode-codebase-chat && \
    npm install && \
    (npm run build || npm run compile || echo "⚠️  No build script, extension will load from source"); \
    echo "✅ VibeCode extension builds complete"

# Claude Code extension - placeholder for future implementation
# RUN cd /home/coder/.vscode/extensions/claude-code-vscode \
#     && npm install \
#     && (npm run compile || npm run build || echo "No build script, extension will load from source")

# Set default shell to bash
>>>>>>> Stashed changes
ENV SHELL=/bin/bash
WORKDIR /home/coder/workspace

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8765/healthz || exit 1

CMD ["code-server", "--bind-addr", "0.0.0.0:8765", "--auth", "none", "/home/coder/workspace"]
