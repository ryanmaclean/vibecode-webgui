# VibeCode Custom code-server with pre-installed extensions
FROM codercom/code-server:4.104.2

# Switch to root for setup
USER root

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fish \
    git \
    openssh-client \
    sudo \
    wget \
    gnupg \
    build-essential \
    python3-pip \
    python3-venv \
    jq \
    unzip \
    apt-transport-https \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

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

# Install Goose for database migrations
RUN CGO_ENABLED=0 go install github.com/pressly/goose/v3/cmd/goose@latest \
    && echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> /home/coder/.bashrc \
    && mkdir -p /home/coder/.vscode/extensions/goose-integration \
    && echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc

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

# Create directories for VSCode
RUN mkdir -p /home/coder/.local/share/code-server/User/ \
    && mkdir -p /home/coder/.vscode/extensions/

# Install AI/ML Extensions (MIT/BSD/Apache only)
# Note: Some extensions can hang during installation, so we install them with timeouts

# 1. Anthropic Claude Code - Official Claude extension
RUN timeout 120 code-server --install-extension anthropic.claude-code || echo "Claude Code installation timed out or failed, skipping"

# 2. OpenAI ChatGPT - Official OpenAI extension
RUN timeout 120 code-server --install-extension openai.chatgpt || echo "OpenAI ChatGPT installation timed out or failed, skipping"

# 3. GitHub Copilot - OpenAI Codex integration (requires GitHub account)
RUN timeout 120 code-server --install-extension GitHub.copilot || echo "GitHub Copilot installation timed out or failed, skipping"

# 4. GitHub Copilot Chat
RUN timeout 120 code-server --install-extension GitHub.copilot-chat || echo "GitHub Copilot Chat installation timed out or failed, skipping"

# 3. Codeium - Free AI Code Completion (MIT)
RUN timeout 120 code-server --install-extension Codeium.codeium || echo "Codeium installation timed out or failed, skipping"

# 4. Cline (formerly Claude Dev) - AI coding assistant (Apache 2.0)
RUN timeout 120 code-server --install-extension saoudrizwan.claude-dev || echo "Cline installation timed out or failed, skipping"

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

# Copy and run AI extensions configuration script
COPY --chown=coder:coder docker/code-server/configure-ai-extensions.sh /tmp/configure-ai-extensions.sh
RUN chmod +x /tmp/configure-ai-extensions.sh && \
    /tmp/configure-ai-extensions.sh && \
    rm /tmp/configure-ai-extensions.sh

# Copy VibeCode extensions
COPY --chown=coder:coder extensions/vibecode-ai-assistant /home/coder/.vscode/extensions/vibecode-ai-assistant
COPY --chown=coder:coder extensions/vibecode-inline-edit /home/coder/.vscode/extensions/vibecode-inline-edit
COPY --chown=coder:coder extensions/vibecode-codebase-chat /home/coder/.vscode/extensions/vibecode-codebase-chat
COPY --chown=coder:coder extensions/claude-code-vscode /home/coder/.vscode/extensions/claude-code-vscode

# Official Microsoft Extensions Only (MIT Licensed) - install with fallback
RUN code-server --install-extension ms-vscode.vscode-typescript-next || echo "TypeScript extension failed" \
    && code-server --install-extension dbaeumer.vscode-eslint || echo "ESLint extension failed"

# Productivity and Developer Tools (MIT/BSD/Apache only) - essential only
RUN code-server --install-extension usernamehw.errorlens || echo "ErrorLens failed" \
    && code-server --install-extension PKief.material-icon-theme || echo "Material icons failed"

# Code Quality and Formatting (MIT)
RUN code-server --install-extension esbenp.prettier-vscode || echo "Prettier failed"

# Git Tools (MIT) - optional
RUN code-server --install-extension mhutchie.git-graph || echo "Git graph failed"

# Testing and Debugging (MIT) - optional
RUN code-server --install-extension orta.vscode-jest || echo "Jest extension failed"

# Project Management (MIT) - skipped for faster build
# RUN code-server --install-extension alefragnani.project-manager || echo "Project manager failed"

# Language Support (MIT/Apache) - essential only
RUN code-server --install-extension redhat.vscode-yaml || echo "YAML failed" \
    && code-server --install-extension bradlc.vscode-tailwindcss || echo "Tailwind failed"

# Utilities (MIT) - optional
RUN code-server --install-extension mikestead.dotenv || echo "dotenv failed"

# Datadog Official Extension (Apache 2.0) - optional
RUN code-server --install-extension datadog.datadog-vscode || echo "Datadog extension failed"

# Database Tools (MIT/Apache) - optional
RUN code-server --install-extension mtxr.sqltools || echo "SQLTools failed"

# Docker and Kubernetes (Microsoft - MIT) - optional
RUN code-server --install-extension ms-azuretools.vscode-docker || echo "Docker extension failed"

# REST API Testing (MIT) - optional
RUN code-server --install-extension humao.rest-client || echo "REST client failed"

# Markdown and Documentation (MIT) - optional
RUN code-server --install-extension yzhang.markdown-all-in-one || echo "Markdown failed"

# Python Development (Microsoft - MIT) - optional
RUN code-server --install-extension ms-python.python || echo "Python extension failed"

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
