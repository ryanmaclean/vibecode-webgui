# Use Node 20 Alpine for better performance and smaller size
FROM node:20-alpine

# Install system dependencies including Docker CLI and tools for Model Runner
RUN apk add --no-cache \
    curl \
    bash \
    git \
    python3 \
    py3-pip \
    docker-cli \
    docker-cli-compose \
    make \
    g++

# Create app directory
WORKDIR /app

# Install global packages
RUN npm install -g @modelcontextprotocol/sdk typescript ts-node

# Copy package configuration
COPY package*.json ./

# Install Node.js dependencies with comprehensive error handling and debugging
RUN echo "=== Starting npm install with debug info ===" && \
    echo "Current directory: $(pwd)" && \
    echo "Contents of current directory:" && ls -la && \
    echo "\n=== npm config before changes ===" && npm config list && \
    \
    # Configure npm for better debugging
    npm config set loglevel silly && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    \
    echo "\n=== npm config after changes ===" && npm config list && \
    echo "\n=== Verifying npm cache ===" && npm cache verify || true && \
    \
    # Attempt npm install with full debug output
    echo "\n=== Starting npm install ===" && \
    if npm install --legacy-peer-deps --loglevel silly; then \
        echo "npm install completed successfully" && \
        npm cache clean --force; \
    else \
        echo "\n!!! npm install failed, showing debug info..." && \
        echo "\n=== npm version ===" && npm --version && \
        echo "\n=== node version ===" && node --version && \
        echo "\n=== npm config ===" && npm config list && \
        echo "\n=== npm cache info ===" && npm cache verify && \
        echo "\n=== Disk space info ===" && df -h && \
        echo "\n=== Current directory contents ===" && ls -la && \
        echo "\n=== node_modules contents (if any) ===" && ls -la node_modules/ 2>/dev/null || echo "No node_modules directory"; \
        exit 1; \
    fi

# Install Python MCP requirements
RUN pip3 install --no-cache-dir --break-system-packages \
    mcp \
    anthropic \
    openai \
    requests \
    aiohttp

# Copy server files (using paths relative to the build context)
COPY servers/ ./servers/
COPY scripts/ ./scripts/

# Make scripts executable
RUN chmod +x scripts/*.sh

# Create volumes for Docker Model Runner cache
RUN mkdir -p /app/models /app/uploads

# Expose ports for different MCP servers
EXPOSE 3001 3002 3003

# Health check that includes Model Runner connectivity
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health && \
      curl -f http://model-runner.docker.internal/engines/v1/models || exit 1

# Start all MCP servers with Model Runner integration
CMD ["./scripts/start-with-model-runner.sh"]