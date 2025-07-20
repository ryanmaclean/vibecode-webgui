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

# Create workspace and set permissions
WORKDIR /home/coder/workspace
RUN chown -R coder:coder /home/coder

# Switch to coder user for extension installation
USER coder

# Create directories for VSCode
RUN mkdir -p /home/coder/.local/share/code-server/User/ \
    && mkdir -p /home/coder/.vscode/extensions/

# Copy VibeCode extensions
COPY --chown=coder:coder extensions/vibecode-ai-assistant /home/coder/.vscode/extensions/vibecode-ai-assistant

# Install VS Code extensions
RUN code-server --install-extension ms-python.python \
    && code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension ms-vscode.vscode-typescript-next \
    && code-server --install-extension dbaeumer.vscode-eslint \
    && code-server --install-extension eamodio.gitlens \
    && code-server --install-extension ms-azuretools.vscode-docker \
    && code-server --install-extension ms-vscode-remote.remote-containers \
    && code-server --install-extension ms-vscode-remote.remote-ssh \
    && code-server --install-extension ms-vscode-remote.remote-wsl \
    && code-server --install-extension redhat.vscode-yaml \
    && code-server --install-extension editorconfig.editorconfig \
    && code-server --install-extension github.copilot \
    && code-server --install-extension github.copilot-chat \
    && code-server --install-extension ms-kubernetes-tools.vscode-kubernetes-tools

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

# Install additional VS Code extensions
RUN code-server --install-extension ms-vscode.vscode-json \
    && code-server --install-extension redhat.vscode-yaml \
    && code-server --install-extension ms-vscode.theme-github

# Start command
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/workspace"]

# Switch back to coder user
USER coder

# Expose code-server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/healthz || exit 1

# Start code-server
ENTRYPOINT ["code-server"]
CMD ["--bind-addr", "0.0.0.0:8080", "--auth", "password", "/home/coder/workspace"]
