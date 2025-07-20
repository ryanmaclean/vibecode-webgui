# VibeCode WebGUI Dockerfile - Optimized for Yarn & Robustness (July 2025)

# Stage 1: Base image with necessary tools
FROM node:20-alpine AS base

# Install essential build tools and security updates first
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps

# Copy package definition and lockfile
COPY package.json yarn.lock* .npmrc ./

# Use Yarn to install dependencies. This is often more resilient.
# The --frozen-lockfile flag ensures we use the exact versions from the lockfile.
RUN yarn install --frozen-lockfile --network-timeout 100000 && yarn cache clean

# Stage 3: Build the application
FROM base AS builder

# Copy source code
COPY . .

# Copy dependencies from the previous stage for a clean build
COPY --from=deps /app/node_modules ./node_modules

# Set environment for production build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run the build command
RUN yarn build

# Stage 4: Production runner
FROM base AS runner

# Set environment for production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary production artifacts from the builder stage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Start the application using the standalone server
CMD ["node", "server.js"]
