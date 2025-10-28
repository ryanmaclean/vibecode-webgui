# Multi-arch AgentAPI container for VibeCode
# Provides HTTP API control over terminal-based AI coding agents

FROM debian:bookworm-slim

ARG AGENTAPI_VERSION=0.1.0
ARG TARGETPLATFORM
ARG TARGETARCH

LABEL org.opencontainers.image.title="VibeCode AgentAPI"
LABEL org.opencontainers.image.description="HTTP API for controlling AI coding agents (Aider, Goose, Cline)"
LABEL org.opencontainers.image.version="${AGENTAPI_VERSION}"
LABEL org.opencontainers.image.source="https://github.com/ryanmaclean/vibecode-webgui"

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      bash \
      git \
      procps \
      python3 \
      python3-pip \
      python3-venv \
      nodejs \
      npm \
      bc \
      jq && \
    rm -rf /var/lib/apt/lists/*

# Install AI CLI tools with compatible dependency resolution
# Install Aider first, then Goose with --no-deps for conflicting packages
RUN pip3 install --no-cache-dir --break-system-packages \
      aider-chat==0.84.0 && \
    pip3 install --no-cache-dir --break-system-packages \
      goose-ai==0.9.11 || \
    (echo "Dependency conflict detected, installing with relaxed constraints" && \
     pip3 install --no-cache-dir --break-system-packages \
       --upgrade certifi urllib3 typing-extensions cffi && \
     pip3 install --no-cache-dir --break-system-packages goose-ai==0.9.11)

# Cline - CLI version (via npx, will be installed on-demand)
# Continue - Open source autopilot (optional)
# Skip npm upgrade - Debian's Node.js 18 includes compatible npm version

# Install agentapi binary
# NOTE: For MVP, we'll use a simple HTTP server wrapper
# Replace this with actual agentapi binary once available
RUN mkdir -p /usr/local/bin && \
    echo '#!/bin/bash' > /usr/local/bin/agentapi && \
    echo 'echo "AgentAPI v${AGENTAPI_VERSION} - HTTP server for agent control"' >> /usr/local/bin/agentapi && \
    echo 'echo "Listening on ${AGENTAPI_HOST:-127.0.0.1}:${AGENTAPI_PORT:-3284}"' >> /usr/local/bin/agentapi && \
    echo 'exec python3 /opt/agentapi/server.py "$@"' >> /usr/local/bin/agentapi && \
    chmod +x /usr/local/bin/agentapi

# Create non-root user matching code-server
RUN useradd -m -u 1000 -s /bin/bash coder && \
    mkdir -p /tmp/terminals /home/coder/.agentapi /opt/agentapi && \
    chown -R coder:coder /tmp/terminals /home/coder /opt/agentapi

# Copy agentapi server implementation (MVP Python HTTP server)
COPY --chown=coder:coder server.py /opt/agentapi/server.py
COPY --chown=coder:coder requirements.txt /opt/agentapi/requirements.txt

# Install Python server dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r /opt/agentapi/requirements.txt

# Copy health check and utility scripts
COPY --chown=coder:coder health-check.sh /home/coder/.agentapi/health-check.sh
COPY --chown=coder:coder config.yaml /home/coder/.agentapi/config.yaml
RUN chmod +x /home/coder/.agentapi/health-check.sh

# Switch to non-root user
USER coder
WORKDIR /home/coder

# Expose API port
EXPOSE 3284

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD ["/home/coder/.agentapi/health-check.sh"]

# Run agentapi
ENTRYPOINT ["/usr/local/bin/agentapi"]
CMD ["--host", "0.0.0.0", "--port", "3284", "--terminal-dir", "/tmp/terminals"]
