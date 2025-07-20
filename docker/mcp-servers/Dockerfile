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
    docker-cli-compose

# Create app directory
WORKDIR /app

# Install global packages
RUN npm install -g @modelcontextprotocol/sdk typescript ts-node

# Copy package configuration
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Python MCP requirements
RUN pip3 install --no-cache-dir \
    mcp \
    anthropic \
    openai \
    requests \
    aiohttp

# Copy server files
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