# Multi-stage Docker build for VibeCode WebGUI
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build so standalone output contains it
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Ensure Prisma schema and generated client are available at runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Bring instrumentation helper for Datadog bootstrap
COPY --from=builder --chown=nextjs:nodejs /app/src/instrument.cjs ./instrument.cjs

# Ensure Datadog env helper is available at runtime for agentless monitoring
RUN mkdir -p lib/monitoring
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/monitoring/datadog-env.shared.js ./lib/monitoring/datadog-env.shared.js

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--require ./src/instrument.cjs"
ENV DD_TRACE_AGENT_URL="http://127.0.0.1:8126"
ENV DD_TRACE_STARTUP_LOGS=false
ENV DD_LOGS_INJECTION=true
ENV DD_LLMOBS_ENABLED=true
ENV DD_LLMOBS_ML_APP="vibechat-rag"
ENV DD_LLMOBS_AGENTLESS_ENABLED=true
ENV DD_IAST_ENABLED=true

CMD ["node", "server.js"]
