# Production-ready code-server container with security hardening
FROM codercom/code-server:4.101.2 AS base

# Switch to root for setup
USER root

# Install security updates and essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    openssh-client \
    sudo \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Docker CLI for container management
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian bookworm stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce docker-buildx-plugin \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code SDK and development tools
RUN npm install -g \
    yarn \
    pnpm \
    typescript \
    @types/node \
    prettier \
    eslint

# Create workspace with proper permissions
WORKDIR /home/coder/workspace
RUN chown -R coder:coder /home/coder

# Configure VS Code settings
COPY --chown=coder:coder settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder extensions.json /home/coder/.local/share/code-server/extensions.json

# Install essential VS Code extensions
RUN code-server --install-extension ms-python.python \
    && code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension ms-vscode.vscode-typescript-next \
    && code-server --install-extension ms-vscode.vscode-json \
    && code-server --install-extension redhat.vscode-yaml \
    && code-server --install-extension ms-vscode.theme-github

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
