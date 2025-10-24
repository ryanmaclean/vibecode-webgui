# syntax=docker/dockerfile:1.4
# Consolidated VibeCode WebGUI Dockerfile
# Supports multiple environments via build arguments

# ===== Build Arguments =====
ARG NODE_VERSION=24
ARG BASE_OS=alpine
ARG BUILD_TARGET=production
ARG INCLUDE_DEV_DEPS=false
ARG ENABLE_SOURCE_MAPS=false
ARG ENABLE_DATADOG=false
ARG ENABLE_LIGHTNINGCSS=true
ARG ENABLE_PRISMA=true
ARG ENABLE_HEALTH_CHECK=true

# ===== Base Stage =====
FROM node:${NODE_VERSION}-${BASE_OS} AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Install system dependencies based on base OS
RUN if [ "${BASE_OS}" = "alpine" ]; then \
        apk add --no-cache libc6-compat python3 make g++ curl dumb-init; \
    else \
        apt-get update && apt-get install -y --no-install-recommends \
            ca-certificates python3 make g++ curl dumb-init tini && \
            rm -rf /var/lib/apt/lists/*; \
    fi

# ===== Dependencies Stage =====
FROM base AS deps
COPY package.json package-lock.json* ./

# Install dependencies based on environment
RUN if [ "${INCLUDE_DEV_DEPS}" = "true" ]; then \
        npm ci --legacy-peer-deps --include=dev; \
    else \
        npm ci --only=production --legacy-peer-deps; \
    fi

# Install LightningCSS if enabled
RUN if [ "${ENABLE_LIGHTNINGCSS}" = "true" ]; then \
        npm install tailwindcss@next @tailwindcss/postcss lightningcss --legacy-peer-deps && \
        npm rebuild lightningcss; \
    fi

# ===== Builder Stage =====
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies for build
RUN npm ci --legacy-peer-deps

# Install LightningCSS if enabled
RUN if [ "${ENABLE_LIGHTNINGCSS}" = "true" ]; then \
        npm install tailwindcss@next @tailwindcss/postcss lightningcss --legacy-peer-deps && \
        npm rebuild lightningcss; \
    fi

# Copy source code
COPY . .

# Generate Prisma client if enabled
RUN if [ "${ENABLE_PRISMA}" = "true" ]; then \
        npx prisma generate; \
    fi

# Set build environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Enable source maps if requested
RUN if [ "${ENABLE_SOURCE_MAPS}" = "true" ]; then \
        export GENERATE_SOURCEMAP=true && \
        export NEXT_BUILD_SOURCEMAP=true; \
    fi

# Build the application
RUN npm run build

# ===== Production Runtime Stage =====
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Datadog configuration (if enabled)
RUN if [ "${ENABLE_DATADOG}" = "true" ]; then \
        echo "DD_TRACE_ENABLED=true" >> /etc/environment && \
        echo "DD_RUNTIME_METRICS_ENABLED=true" >> /etc/environment && \
        echo "DD_PROFILING_ENABLED=true" >> /etc/environment && \
        echo "DD_LOGS_INJECTION=true" >> /etc/environment && \
        echo "DD_DYNAMIC_INSTRUMENTATION_ENABLED=true" >> /etc/environment && \
        echo "DD_SOURCE_MAP_PATH=/app/source-maps" >> /etc/environment && \
        echo "DD_IAST_ENABLED=true" >> /etc/environment; \
    fi

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files if enabled
RUN if [ "${ENABLE_PRISMA}" = "true" ]; then \
        mkdir -p ./prisma && \
        mkdir -p ./node_modules/.prisma && \
        mkdir -p ./node_modules/@prisma; \
    fi

COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy source maps if enabled
RUN if [ "${ENABLE_SOURCE_MAPS}" = "true" ]; then \
        mkdir -p ./source-maps/.next && \
        mkdir -p ./source-maps/src; \
    fi

COPY --from=builder --chown=nextjs:nodejs /app/.next ./source-maps/.next
COPY --from=builder --chown=nextjs:nodejs /app/src ./source-maps/src

# Create health check script if enabled
RUN if [ "${ENABLE_HEALTH_CHECK}" = "true" ]; then \
        cat <<'EOF' > /app/healthcheck.js && \
        const http = require('http'); \
        const options = { \
          hostname: 'localhost', \
          port: 3000, \
          path: '/api/health', \
          method: 'GET', \
          timeout: 5000 \
        }; \
        const req = http.request(options, (res) => { \
          if (res.statusCode === 200) { \
            process.exit(0); \
          } else { \
            console.error(\`Health check failed with status: \${res.statusCode}\`); \
            process.exit(1); \
          } \
        }); \
        req.on('error', (err) => { \
          console.error(\`Health check error: \${err.message}\`); \
          process.exit(1); \
        }); \
        req.on('timeout', () => { \
          console.error('Health check timeout'); \
          req.destroy(); \
          process.exit(1); \
        }); \
        req.end(); \
        EOF \
        chmod +x /app/healthcheck.js; \
    fi

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check if enabled
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node /app/healthcheck.js || exit 1

# Use appropriate init system based on base OS
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# ===== Development Stage =====
FROM builder AS development
WORKDIR /app

# Install development dependencies
RUN npm ci --include=dev --legacy-peer-deps

# Install curl for health checks
RUN if [ "${BASE_OS}" = "alpine" ]; then \
        apk add --no-cache curl; \
    else \
        apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*; \
    fi

# Create development user
USER node

# Expose development ports
EXPOSE 3000 9229

# Development environment
ENV NODE_ENV=development

# Start in development mode
CMD ["npm", "run", "dev"]

# ===== Testing Stage =====
FROM builder AS testing
WORKDIR /app

# Install all dependencies including dev
RUN npm ci --include=dev --legacy-peer-deps

# Copy test configuration
COPY jest.config.* ./
COPY *.config.* ./

# Set test environment
ENV NODE_ENV=test

# Expose test port
EXPOSE 3000

# Run tests
CMD ["npm", "test"]

# ===== Ingestion Worker Stage =====
FROM base AS ingestion
WORKDIR /app

# Install system dependencies for ingestion
RUN if [ "${BASE_OS}" = "alpine" ]; then \
        apk add --no-cache python3 make g++ openssl bash curl; \
    else \
        apt-get update && apt-get install -y python3 make g++ openssl bash curl && \
            rm -rf /var/lib/apt/lists/*; \
    fi

# Copy package files and install ALL deps (including dev for tsx)
COPY package*.json ./
RUN npm install --include=dev

# Copy only the files needed for ingestion
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY docs ./docs
COPY tsconfig.json ./tsconfig.json

# Generate Prisma client
RUN npx prisma generate

# Set ingestion environment
ENV NODE_ENV=production \
    RAG_DOCS_PATH=/app/docs/src/content/docs \
    RAG_INTER_CHUNK_DELAY_MS=250 \
    RAG_CHUNK_MAX_ATTEMPTS=5 \
    RAG_RETRY_BACKOFF_MS=2000 \
    RAG_SKIP_TEST_SEARCH=true \
    USE_LOCAL_EMBEDDINGS=true

# Run the ingestion
CMD ["npx", "tsx", "scripts/ingest-docs-to-rag.ts"]
