# Multi-stage build for OpenAI Agents runtime
# Optimized for production deployment with minimal attack surface

ARG PYTHON_VERSION=3.11
ARG NODE_VERSION=18

# Stage 1: Build stage
FROM python:${PYTHON_VERSION}-slim as builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      git \
      curl && \
    rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python dependencies
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements.txt

# Stage 2: Runtime stage
FROM python:${PYTHON_VERSION}-slim

LABEL maintainer="VibeCode DevOps <devops@vibecode.io>"
LABEL description="OpenAI Agents runtime for VibeCode"
LABEL version="1.0.0"

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      nodejs \
      npm && \
    rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd -r agents -g 1000 && \
    useradd -r -g agents -u 1000 -m -s /sbin/nologin agents && \
    mkdir -p /app /data /var/log/agents && \
    chown -R agents:agents /app /data /var/log/agents

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=agents:agents src/ /app/src/
COPY --chown=agents:agents config/ /app/config/
COPY --chown=agents:agents scripts/ /app/scripts/

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Switch to non-root user
USER agents

# Expose ports
EXPOSE 8080 9090 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8081/health/live || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production

# Run application
CMD ["python", "-m", "src.agents.server"]
