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
