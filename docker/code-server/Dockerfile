# VibeCode Custom code-server with pre-installed extensions
FROM codercom/code-server:4.101.2

# Switch to root for setup
USER root

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
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
RUN go install github.com/pressly/goose/v3/cmd/goose@latest \
    && echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> /home/coder/.bashrc \
    && mkdir -p /home/coder/.vscode/extensions/goose-integration \
    && echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc

# Install Datadog tools
# 1. Datadog Agent
RUN if [ -n "$DD_API_KEY" ]; then \
    DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=$DD_API_KEY bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)" && \
    systemctl disable datadog-agent; \
    fi

# 2. Datadog CLI
RUN npm install -g @datadog/datadog-ci

# 3. Vector (for log collection)
RUN curl -1sLf 'https://repositories.timber.io/public/vector/cfg/setup/bash.deb.sh' | bash && \
    apt-get update && apt-get install -y vector || \
    (echo "Vector installation failed, installing manually" && \
     curl -L https://releases.timber.io/vector/latest/vector-amd64.deb -o vector.deb && \
     dpkg -i vector.deb && rm vector.deb)

# 4. KubeHound (Kubernetes security)
RUN curl -sSfL https://raw.githubusercontent.com/DataDog/kubehound/main/install.sh | sh

# 5. Stratus Red Team (security testing)
RUN pip3 install stratus-red-team

# 6. Eppo (feature flagging)
RUN curl -sL https://packagecloud.io/install/repositories/eppo/eppo-server/script.deb.sh | bash && \
    apt-get install -y eppo-agent

# 7. Toto (test observability)
RUN pip3 install datadog-toto

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

# Install AI/ML and Pair Programming Extensions
# 1. GitHub Copilot and related extensions
RUN code-server --install-extension GitHub.copilot \
    && code-server --install-extension GitHub.copilot-chat \
    && code-server --install-extension GitHub.copilot-labs

# 2. Codeium - Free AI Code Completion
RUN code-server --install-extension Codeium.codeium \
    && code-server --install-extension Codeium.codeium-enterprise-edition

# 3. Tabnine - AI Code Completion
RUN code-server --install-extension TabNine.tabnine-vscode

# 4. Amazon Q (formerly CodeWhisperer)
RUN code-server --install-extension AmazonWebServices.aws-toolkit-vscode

# 5. Cursor - AI-first editor features
RUN code-server --install-extension cwchasesm.cursor-tools

# 6. Sourcegraph Cody - AI coding assistant
RUN code-server --install-extension sourcegraph.cody-ai

# 7. Continue - Open-source autopilot
RUN code-server --install-extension Continue.continue

# Install Language Server Protocol (LSP) Servers
# 1. Python LSP (pylsp)
RUN pip3 install 'python-lsp-server[all]' pylsp-mypy python-lsp-black

# 2. TypeScript/JavaScript LSP
RUN npm install -g typescript-language-server vscode-langservers-extracted

# 3. Rust LSP (rust-analyzer)
RUN curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-x86_64-unknown-linux-gnu.gz | gunzip -c - > /usr/local/bin/rust-analyzer \
    && chmod +x /usr/local/bin/rust-analyzer

# 4. Go LSP (gopls)
RUN go install golang.org/x/tools/gopls@latest

# 5. Java LSP (jdtls)
RUN mkdir -p /home/coder/.local/share/jdtls \
    && curl -L https://download.eclipse.org/jdtls/milestones/1.9.0/jdt-language-server-1.9.0-202203031534.tar.gz | tar xz -C /home/coder/.local/share/jdtls

# 6. C/C++ LSP (clangd)
RUN apt-get update && apt-get install -y clangd-12 \
    && update-alternatives --install /usr/bin/clangd clangd /usr/bin/clangd-12 100

# 7. Bash LSP
RUN npm install -g bash-language-server

# 8. Docker LSP
RUN npm install -g dockerfile-language-server-nodejs

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

# Official Microsoft Extensions Only (MIT Licensed)
RUN code-server --install-extension ms-vscode.vscode-typescript-next \
    && code-server --install-extension ms-vscode.vscode-json \
    && code-server --install-extension ms-vscode.vscode-eslint \
    && code-server --install-extension ms-vscode.vscode-css-languagefeatures \
    && code-server --install-extension ms-vscode.vscode-html-languagefeatures

# Configure VS Code settings
COPY --chown=coder:coder docker/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder docker/code-server/keybindings.json /home/coder/.local/share/code-server/User/keybindings.json

# Install VibeCode extension dependencies
RUN cd /home/coder/.vscode/extensions/vibecode-ai-assistant \
    && npm install \
    && npm run build

# Set default shell to bash
ENV SHELL=/bin/bash

# Set workspace as default directory
WORKDIR /home/coder/workspace

# Expose code-server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/healthz || exit 1

# Start command
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/workspace"]
