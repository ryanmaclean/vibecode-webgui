# VibeCode Custom code-server with pre-installed extensions
FROM codercom/code-server:4.104.2

ARG TARGETPLATFORM
ARG LAZYGIT_VERSION=0.55.1
ARG STARSHIP_VERSION=1.23.0
ARG ZOXIDE_VERSION=0.9.8
ARG NUSHELL_VERSION=0.99.1
ARG DELTA_VERSION=0.18.2
ARG CHEZMOI_VERSION=2.65.2
ARG JUST_VERSION=1.43.0
ARG STERN_VERSION=1.33.0
ARG HELMFILE_VERSION=1.1.7
ARG K9S_VERSION=0.50.13
ARG SOPS_VERSION=3.11.0
ARG GLAB_VERSION=1.22.0
ARG PROFILE=full
ARG BUILD_DATE
ARG GIT_COMMIT
ARG VERSION=1.0.0

# Metadata
LABEL org.opencontainers.image.title="VibeCode Code-Server"
LABEL org.opencontainers.image.description="Code-server with AI assistants and development tools"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.source="https://github.com/ryanmaclean/vibecode-webgui"
LABEL org.opencontainers.image.profile="${PROFILE}"

# Switch to root for setup
USER root

# Install system dependencies
RUN set -eux; \
    mkdir -p /tmp && chmod 1777 /tmp; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fish \
    exa \
    git \
    zsh \
    openssh-client \
    hyperfine \
    ripgrep \
    vim \
    neovim \
    emacs-nox \
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

RUN chmod 755 /usr/bin/code-server /usr/lib/code-server/bin/code-server

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

# Install Go
RUN wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz \
    && rm go1.22.4.linux-amd64.tar.gz \
    && ln -s /usr/local/go/bin/go /usr/local/bin/go

# Install AI CLI tools and database tools
# 1. Goose for database migrations (install as root, make accessible to coder user)
RUN CGO_ENABLED=0 go install github.com/pressly/goose/v3/cmd/goose@latest && \
    cp /root/go/bin/goose /usr/local/bin/goose && \
    chmod 755 /usr/local/bin/goose && \
    echo 'export PATH=$PATH:/usr/local/bin' >> /home/coder/.bashrc && \
    mkdir -p /home/coder/.vscode/extensions/goose-integration && \
    echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc

# 2. Aider - AI pair programming CLI
RUN pip3 install --break-system-packages --no-cache-dir aider-chat

# 3. Verify all required tools are installed (MUST succeed or build fails)
RUN set -e && \
    echo "🔍 Verifying installed tools..." && \
    echo "Testing vim..." && vim --version | head -1 && \
    echo "Testing nvim..." && nvim --version | head -1 && \
    echo "Testing emacs..." && emacs --version | head -1 && \
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
RUN curl -sSfL https://raw.githubusercontent.com/DataDog/kubehound/main/install.sh | sh || echo "KubeHound not available, skipping"

# 5. Stratus Red Team (security testing) - optional
RUN pip3 install --break-system-packages stratus-red-team || echo "Stratus Red Team not available, skipping"

# 6. Eppo (feature flagging) - optional
RUN (curl -sL https://packagecloud.io/install/repositories/eppo/eppo-server/script.deb.sh | bash && \
    apt-get install -y eppo-agent) || echo "Eppo not available, skipping"

# 7. Toto (test observability) - optional
RUN pip3 install --break-system-packages datadog-toto || echo "Datadog Toto not available, skipping"

# Create workspace and set permissions
WORKDIR /home/coder/workspace
RUN chown -R coder:coder /home/coder

# Create Datadog configuration directory and copy scripts
RUN mkdir -p /home/coder/workspace/.datadog/templates && \
    chown -R coder:coder /home/coder/workspace/.datadog

# Copy Datadog configuration script
COPY docker/code-server/configure-datadog.sh /tmp/configure-datadog.sh
RUN chmod +x /tmp/configure-datadog.sh && \
    /tmp/configure-datadog.sh && \
    chown -R coder:coder /home/coder/workspace/.datadog && \
    chown -R coder:coder /home/coder/workspace/verify-datadog-tools.sh

# Switch to coder user for extension installation
USER coder

ENV PATH="/home/coder/.local/bin:${PATH}"

# Create directories for VSCode
RUN mkdir -p /home/coder/.local/share/code-server/User/ \
    && mkdir -p /home/coder/.vscode/extensions/

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
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") \
        PLATFORM_TAG="linux_amd64"; \
        NUSHELL_PKG="nu-${NUSHELL_VERSION}-x86_64-unknown-linux-gnu"; \
        DELTA_ARCH="x86_64-unknown-linux-gnu"; \
        JUST_ARCH="x86_64-unknown-linux-musl"; \
        STERN_ARCH="linux_amd64"; \
        HELMFILE_ARCH="Linux_x86_64"; \
        K9S_ARCH="Linux_x86_64"; \
        SOPS_SUFFIX="linux.amd64"; \
        GLAB_ARCH="Linux_x86_64"; \
        ;; \
      "linux/arm64") \
        PLATFORM_TAG="linux_arm64"; \
        NUSHELL_PKG="nu-${NUSHELL_VERSION}-aarch64-unknown-linux-gnu"; \
        DELTA_ARCH="aarch64-unknown-linux-gnu"; \
        JUST_ARCH="aarch64-unknown-linux-musl"; \
        STERN_ARCH="linux_arm64"; \
        HELMFILE_ARCH="Linux_arm64"; \
        K9S_ARCH="Linux_arm64"; \
        SOPS_SUFFIX="linux.arm64"; \
        GLAB_ARCH="Linux_arm64"; \
        ;; \
      *) echo "Unsupported platform: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/nushell/nushell/releases/download/${NUSHELL_VERSION}/${NUSHELL_PKG}.tar.gz" -o /tmp/nushell.tar.gz; \
    tar -xf /tmp/nushell.tar.gz -C /tmp; \
    install -m755 /tmp/${NUSHELL_PKG}/nu /usr/local/bin/nu; \
    rm -rf /tmp/nushell.tar.gz /tmp/${NUSHELL_PKG}; \
    curl -fsSL "https://github.com/dandavison/delta/releases/download/${DELTA_VERSION}/delta-${DELTA_VERSION}-${DELTA_ARCH}.tar.gz" -o /tmp/delta.tar.gz; \
    tar -xf /tmp/delta.tar.gz -C /tmp; \
    install -m755 /tmp/delta-${DELTA_VERSION}-${DELTA_ARCH}/delta /usr/local/bin/delta; \
    rm -rf /tmp/delta.tar.gz /tmp/delta-${DELTA_VERSION}-${DELTA_ARCH}; \
    curl -fsSL "https://github.com/twpayne/chezmoi/releases/download/v${CHEZMOI_VERSION}/chezmoi_${CHEZMOI_VERSION}_${PLATFORM_TAG}.tar.gz" -o /tmp/chezmoi.tar.gz; \
    tar -xf /tmp/chezmoi.tar.gz -C /tmp; \
    install -m755 /tmp/chezmoi_${CHEZMOI_VERSION}_${PLATFORM_TAG}/chezmoi /usr/local/bin/chezmoi; \
    rm -rf /tmp/chezmoi.tar.gz /tmp/chezmoi_${CHEZMOI_VERSION}_${PLATFORM_TAG}; \
    curl -fsSL "https://github.com/casey/just/releases/download/v${JUST_VERSION}/just-${JUST_VERSION}-${JUST_ARCH}.tar.gz" -o /tmp/just.tar.gz; \
    tar -xf /tmp/just.tar.gz -C /tmp; \
    install -m755 /tmp/just-${JUST_VERSION}-${JUST_ARCH}/just /usr/local/bin/just; \
    rm -rf /tmp/just.tar.gz /tmp/just-${JUST_VERSION}-${JUST_ARCH}; \
    curl -fsSL "https://github.com/stern/stern/releases/download/v${STERN_VERSION}/stern_${STERN_VERSION}_${STERN_ARCH}.tar.gz" -o /tmp/stern.tar.gz; \
    tar -xf /tmp/stern.tar.gz -C /tmp; \
    install -m755 /tmp/stern_${STERN_VERSION}_${STERN_ARCH}/stern /usr/local/bin/stern; \
    rm -rf /tmp/stern.tar.gz /tmp/stern_${STERN_VERSION}_${STERN_ARCH}; \
    curl -fsSL "https://github.com/helmfile/helmfile/releases/download/v${HELMFILE_VERSION}/helmfile_${HELMFILE_VERSION}_${HELMFILE_ARCH}.tar.gz" -o /tmp/helmfile.tar.gz; \
    tar -xf /tmp/helmfile.tar.gz -C /tmp; \
    install -m755 /tmp/helmfile /usr/local/bin/helmfile; \
    rm -rf /tmp/helmfile.tar.gz /tmp/helmfile; \
    curl -fsSL "https://github.com/derailed/k9s/releases/download/v${K9S_VERSION}/k9s_${K9S_ARCH}.tar.gz" -o /tmp/k9s.tar.gz; \
    tar -xf /tmp/k9s.tar.gz -C /tmp; \
    install -m755 /tmp/k9s /usr/local/bin/k9s; \
    rm -rf /tmp/k9s.tar.gz /tmp/k9s; \
    curl -fsSL "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.${SOPS_SUFFIX}" -o /usr/local/bin/sops; \
    chmod 755 /usr/local/bin/sops; \
    curl -fsSL "https://github.com/profclems/glab/releases/download/v${GLAB_VERSION}/glab_${GLAB_VERSION}_${GLAB_ARCH}.tar.gz" -o /tmp/glab.tar.gz; \
    tar -xf /tmp/glab.tar.gz -C /tmp; \
    install -m755 /tmp/glab_${GLAB_VERSION}_${GLAB_ARCH}/bin/glab /usr/local/bin/glab; \
    rm -rf /tmp/glab.tar.gz /tmp/glab_${GLAB_VERSION}_${GLAB_ARCH}; \
    curl -fsSL https://raw.githubusercontent.com/ahmetb/kubectx/master/kubens -o /usr/local/bin/kubens; \
    chmod 755 /usr/local/bin/kubens

# Verify key CLI tools are reachable for the coder user
RUN set -eux; \
    for tool in vim nvim emacs nu delta chezmoi just stern helmfile k9s sops glab kubectx kubens; do \
      command -v "$tool" >/dev/null; \
    done; \
    aider --version >/dev/null; \
    /root/go/bin/goose --help >/dev/null

# 2. TypeScript/JavaScript LSP - needs root
USER root
RUN npm install -g typescript-language-server vscode-langservers-extracted

# 3. Rust LSP (rust-analyzer)
RUN curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-x86_64-unknown-linux-gnu.gz | gunzip -c - > /usr/local/bin/rust-analyzer \
    && chmod +x /usr/local/bin/rust-analyzer

# 4. Go LSP (gopls) - as coder user - optional due to architecture issues
USER coder
RUN go install golang.org/x/tools/gopls@latest || echo "gopls installation failed, skipping"

# 5. Java LSP (jdtls)
RUN mkdir -p /home/coder/.local/share/jdtls \
    && curl -L https://download.eclipse.org/jdtls/milestones/1.9.0/jdt-language-server-1.9.0-202203031534.tar.gz | tar xz -C /home/coder/.local/share/jdtls

# 6. C/C++ LSP (clangd) - needs root
USER root
RUN apt-get update && apt-get install -y clangd \
    && rm -rf /var/lib/apt/lists/*

# 7. Bash LSP
RUN npm install -g bash-language-server

# 8. Docker LSP
RUN npm install -g dockerfile-language-server-nodejs

# Switch back to coder user
USER coder

# Configure environment for LSP servers
ENV PATH="/home/coder/go/bin:${PATH}"
ENV NODE_PATH=/usr/local/lib/node_modules

# Copy and run AI extensions configuration script (as root for symf install)
USER root
COPY docker/code-server/configure-ai-extensions.sh /tmp/configure-ai-extensions.sh
RUN chmod +x /tmp/configure-ai-extensions.sh && \
    /tmp/configure-ai-extensions.sh && \
    rm /tmp/configure-ai-extensions.sh && \
    chown -R coder:coder /home/coder/.local/share/code-server/ && \
    chown -R coder:coder /home/coder/.vscode/
USER coder

# Copy VibeCode extensions
COPY --chown=coder:coder extensions/vibecode-ai-assistant /home/coder/.vscode/extensions/vibecode-ai-assistant
COPY --chown=coder:coder extensions/vibecode-inline-edit /home/coder/.vscode/extensions/vibecode-inline-edit
COPY --chown=coder:coder extensions/vibecode-codebase-chat /home/coder/.vscode/extensions/vibecode-codebase-chat
COPY --chown=coder:coder extensions/claude-code-vscode /home/coder/.vscode/extensions/claude-code-vscode

# Official Microsoft Extensions Only (MIT Licensed) - install with fallback
RUN /usr/bin/code-server --install-extension ms-vscode.vscode-typescript-next || echo "TypeScript extension failed" \
    && /usr/bin/code-server --install-extension dbaeumer.vscode-eslint || echo "ESLint extension failed"

# Productivity and Developer Tools (MIT/BSD/Apache only) - essential only
RUN /usr/bin/code-server --install-extension usernamehw.errorlens || echo "ErrorLens failed" \
    && /usr/bin/code-server --install-extension PKief.material-icon-theme || echo "Material icons failed"

# Code Quality and Formatting (MIT)
RUN /usr/bin/code-server --install-extension esbenp.prettier-vscode || echo "Prettier failed"

# Git Tools (MIT) - optional
RUN /usr/bin/code-server --install-extension mhutchie.git-graph || echo "Git graph failed"

# Testing and Debugging (MIT) - optional
RUN /usr/bin/code-server --install-extension orta.vscode-jest || echo "Jest extension failed"

# Project Management (MIT) - skipped for faster build
# RUN /usr/bin/code-server --install-extension alefragnani.project-manager || echo "Project manager failed"

# Language Support (MIT/Apache) - essential only
RUN /usr/bin/code-server --install-extension redhat.vscode-yaml || echo "YAML failed" \
    && /usr/bin/code-server --install-extension bradlc.vscode-tailwindcss || echo "Tailwind failed"

# Utilities (MIT) - optional
RUN /usr/bin/code-server --install-extension mikestead.dotenv || echo "dotenv failed"

# Datadog Official Extension (Apache 2.0) - optional
RUN /usr/bin/code-server --install-extension datadog.datadog-vscode || echo "Datadog extension failed"

# Database Tools (MIT/Apache) - optional
RUN /usr/bin/code-server --install-extension mtxr.sqltools || echo "SQLTools failed"

# Docker and Kubernetes (Microsoft - MIT) - optional
RUN /usr/bin/code-server --install-extension ms-azuretools.vscode-docker || echo "Docker extension failed"

# REST API Testing (MIT) - optional
RUN /usr/bin/code-server --install-extension humao.rest-client || echo "REST client failed"

# Markdown and Documentation (MIT) - optional
RUN /usr/bin/code-server --install-extension yzhang.markdown-all-in-one || echo "Markdown failed"

# Python Development (Microsoft - MIT) - optional (already installed earlier)
# RUN /usr/bin/code-server --install-extension ms-python.python || echo "Python extension failed"

# Remote Development (Microsoft - MIT) - skipped (not needed in container)
# RUN code-server --install-extension ms-vscode-remote.remote-ssh || echo "Remote SSH failed"

# Configure VS Code settings
COPY --chown=coder:coder docker/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder docker/code-server/keybindings.json /home/coder/.local/share/code-server/User/keybindings.json

# Install VibeCode extension dependencies
RUN cd /home/coder/.vscode/extensions/vibecode-ai-assistant \
    && npm install \
    && (npm run compile || npm run build || echo "No build script, extension will load from source")

RUN cd /home/coder/.vscode/extensions/vibecode-inline-edit \
    && npm install \
    && (npm run build || npm run compile || echo "No build script, extension will load from source")

RUN cd /home/coder/.vscode/extensions/vibecode-codebase-chat \
    && npm install \
    && (npm run build || npm run compile || echo "No build script, extension will load from source")

# Claude Code extension - placeholder for future implementation
# RUN cd /home/coder/.vscode/extensions/claude-code-vscode \
#     && npm install \
#     && (npm run compile || npm run build || echo "No build script, extension will load from source")

# Set default shell to bash
ENV SHELL=/bin/bash

# Set workspace as default directory
WORKDIR /home/coder/workspace

# Expose code-server port (8765 = VibeCode's unique port)
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8765/healthz || exit 1

# Start command
CMD ["code-server", "--bind-addr", "0.0.0.0:8765", "--auth", "none", "/home/coder/workspace"]
