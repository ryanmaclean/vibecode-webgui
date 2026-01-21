# Theia IDE - Minimal Profile with AI Support
# Base: Eclipse Theia official image
# Architecture: ARM64/AMD64 multi-platform
# Profile: minimal (5 essential extensions + Theia AI)

FROM elswork/theia:latest

LABEL org.opencontainers.image.title="VibeCode Theia Minimal" \
      org.opencontainers.image.description="Theia IDE with AI assistants and minimal extensions" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/ryanmaclean/vibecode-webgui" \
      org.opencontainers.image.profile="theia-minimal"

# Switch to root for installations
USER root

# Install essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    ca-certificates \
    bash \
    vim \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install aider-chat for AI assistance
RUN pip3 install --no-cache-dir aider-chat

# Create plugins directory
RUN mkdir -p /home/theia/plugins

# Download minimal extensions from OpenVSX
# Using wget to download .vsix files directly
WORKDIR /tmp

# Extension 1: Python (ms-python.python)
RUN wget -q https://open-vsx.org/api/ms-python/python/2024.22.1/file/ms-python.python-2024.22.1.vsix && \
    unzip -q ms-python.python-2024.22.1.vsix -d /home/theia/plugins/ms-python.python && \
    rm ms-python.python-2024.22.1.vsix

# Extension 2: ESLint (dbaeumer.vscode-eslint)
RUN wget -q https://open-vsx.org/api/dbaeumer/vscode-eslint/3.0.13/file/dbaeumer.vscode-eslint-3.0.13.vsix && \
    unzip -q dbaeumer.vscode-eslint-3.0.13.vsix -d /home/theia/plugins/dbaeumer.vscode-eslint && \
    rm dbaeumer.vscode-eslint-3.0.13.vsix

# Extension 3: Prettier (esbenp.prettier-vscode)
RUN wget -q https://open-vsx.org/api/esbenp/prettier-vscode/11.0.0/file/esbenp.prettier-vscode-11.0.0.vsix && \
    unzip -q esbenp.prettier-vscode-11.0.0.vsix -d /home/theia/plugins/esbenp.prettier-vscode && \
    rm esbenp.prettier-vscode-11.0.0.vsix

# Extension 4: GitLens (eamodio.gitlens)
RUN wget -q https://open-vsx.org/api/eamodio/gitlens/2025.1.405/file/eamodio.gitlens-2025.1.405.vsix && \
    unzip -q eamodio.gitlens-2025.1.405.vsix -d /home/theia/plugins/eamodio.gitlens && \
    rm eamodio.gitlens-2025.1.405.vsix

# Extension 5: Continue (Continue.continue)
RUN wget -q https://open-vsx.org/api/Continue/continue/0.9.219/file/Continue.continue-0.9.219.vsix && \
    unzip -q Continue.continue-0.9.219.vsix -d /home/theia/plugins/Continue.continue && \
    rm Continue.continue-0.9.219.vsix

# Set permissions
RUN chown -R theia:theia /home/theia/plugins

# Configure Theia settings
RUN mkdir -p /home/theia/.theia && \
    echo '{\n\
  "extensions": {\n\
    "ignoreRecommendations": false\n\
  },\n\
  "workbench.colorTheme": "Dark (Visual Studio)",\n\
  "editor.fontSize": 14,\n\
  "editor.tabSize": 2,\n\
  "files.autoSave": "afterDelay",\n\
  "terminal.integrated.fontSize": 14\n\
}' > /home/theia/.theia/settings.json && \
    chown -R theia:theia /home/theia/.theia

# Set OpenVSX registry URL (use public instance)
ENV VSX_REGISTRY_URL=https://open-vsx.org

# Expose Theia port
EXPOSE 3000

# Switch back to theia user
USER theia

# Set working directory
WORKDIR /home/project

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start Theia IDE
ENTRYPOINT ["/usr/local/bin/node", "/home/theia/src-gen/backend/main.js", "/home/project", "--hostname=0.0.0.0", "--port=3000"]
