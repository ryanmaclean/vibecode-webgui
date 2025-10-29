# Production-ready Dockerfile for OpenVSCode Server with Datadog and MCP services
# Target: Alpine Linux 3.19 for minimal footprint
# Expected final size: < 500MB

# =============================================================================
# Stage 1: Builder - Download and prepare binaries
# =============================================================================
FROM alpine:3.19 AS builder

# Install build dependencies
RUN apk add --no-cache \
    wget \
    curl \
    tar \
    gzip \
    ca-certificates

# Create temporary build directories
WORKDIR /tmp/build

# Download OpenVSCode Server 1.95.3
RUN wget -q -O openvscode-server.tar.gz \
    "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.95.3/openvscode-server-v1.95.3-linux-x64.tar.gz" && \
    mkdir -p /opt/openvscode-server && \
    tar -xzf openvscode-server.tar.gz -C /opt/openvscode-server --strip-components=1 && \
    rm openvscode-server.tar.gz

# Download Datadog agent (Alpine compatible)
RUN wget -q -O datadog-agent.tar.gz \
    "https://s3.amazonaws.com/dd-agent/datadog-agent-7-latest.x86_64.tar.gz" && \
    mkdir -p /opt/datadog-agent && \
    tar -xzf datadog-agent.tar.gz -C /opt/datadog-agent --strip-components=1 && \
    rm datadog-agent.tar.gz

# Create MCP servers directory structure
RUN mkdir -p /opt/mcp-servers

# =============================================================================
# Stage 2: Runtime - Minimal production image
# =============================================================================
FROM alpine:3.19

# Metadata
LABEL maintainer="VibeCode Team" \
      description="OpenVSCode Server with Datadog monitoring and MCP services" \
      version="1.95.3"

# Install runtime dependencies
RUN apk add --no-cache \
    # Node.js 20 LTS
    nodejs~=20 \
    npm~=10 \
    # Python 3 for Datadog
    python3~=3.11 \
    py3-pip \
    # Essential tools
    git \
    curl \
    wget \
    bash \
    ca-certificates \
    # Required libraries for OpenVSCode Server
    libstdc++ \
    libgcc \
    musl \
    # Process management
    tini \
    # Additional utilities
    openssh-client \
    jq && \
    # Clean up
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1000 openvscode && \
    adduser -D -u 1000 -G openvscode -h /home/openvscode -s /bin/bash openvscode

# Copy OpenVSCode Server from builder
COPY --from=builder --chown=openvscode:openvscode /opt/openvscode-server /opt/openvscode-server

# Copy Datadog agent from builder
COPY --from=builder --chown=root:root /opt/datadog-agent /opt/datadog-agent

# Create necessary directories
RUN mkdir -p \
    /workspace \
    /opt/mcp-servers \
    /home/openvscode/.openvscode-server \
    /var/log/datadog \
    /etc/datadog-agent && \
    chown -R openvscode:openvscode /workspace /opt/mcp-servers /home/openvscode && \
    chown -R root:root /opt/datadog-agent /var/log/datadog /etc/datadog-agent

# Create Datadog configuration
RUN echo 'hostname: openvscode-container\n\
logs_enabled: true\n\
apm_config:\n\
  enabled: true\n\
  apm_non_local_traffic: true\n\
dogstatsd_config:\n\
  non_local_traffic: true' > /etc/datadog-agent/datadog.yaml

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "==> Starting VibeCode OpenVSCode Server"\n\
\n\
# Start Datadog agent if API key provided\n\
if [ -n "$DATADOG_API_KEY" ]; then\n\
    echo "==> Starting Datadog agent..."\n\
    export DD_API_KEY="$DATADOG_API_KEY"\n\
    export DD_SITE="${DATADOG_SITE:-datadoghq.com}"\n\
    /opt/datadog-agent/bin/agent/agent run > /var/log/datadog/agent.log 2>&1 &\n\
    echo "==> Datadog agent started"\n\
else\n\
    echo "==> Datadog agent disabled (no API key)"\n\
fi\n\
\n\
# Start MCP servers\n\
if [ -d /opt/mcp-servers ]; then\n\
    echo "==> Starting MCP servers..."\n\
    for server in /opt/mcp-servers/*.sh; do\n\
        if [ -f "$server" ] && [ -x "$server" ]; then\n\
            echo "    Starting $(basename $server)"\n\
            bash "$server" &\n\
        fi\n\
    done\n\
    echo "==> MCP servers started"\n\
fi\n\
\n\
# Configure OpenVSCode Server\n\
export OPENVSCODE_SERVER_ROOT=/opt/openvscode-server\n\
export WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"\n\
export VSCODE_PORT="${VSCODE_PORT:-3000}"\n\
export VSCODE_HOST="${VSCODE_HOST:-0.0.0.0}"\n\
\n\
echo "==> Starting OpenVSCode Server on $VSCODE_HOST:$VSCODE_PORT"\n\
echo "    Workspace: $WORKSPACE_DIR"\n\
\n\
# Start OpenVSCode Server\n\
exec /opt/openvscode-server/bin/openvscode-server \\\n\
    --host "$VSCODE_HOST" \\\n\
    --port "$VSCODE_PORT" \\\n\
    --without-connection-token \\\n\
    --accept-server-license-terms \\\n\
    --telemetry-level off \\\n\
    "$WORKSPACE_DIR"' > /opt/startup.sh && \
    chmod +x /opt/startup.sh

# Create example MCP server
RUN echo '#!/bin/bash\n\
# Example MCP Server\n\
echo "MCP Server: Example server running on port 8080"\n\
# Add your MCP server startup logic here\n\
sleep infinity' > /opt/mcp-servers/example-mcp.sh && \
    chmod +x /opt/mcp-servers/example-mcp.sh

# Set working directory
WORKDIR /workspace

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Switch to non-root user for OpenVSCode Server
USER openvscode

# Environment variables
ENV HOME=/home/openvscode \
    WORKSPACE_DIR=/workspace \
    VSCODE_PORT=3000 \
    VSCODE_HOST=0.0.0.0 \
    NODE_ENV=production

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start all services
CMD ["/bin/bash", "/opt/startup.sh"]
