# VibeCode WebGUI Dockerfile - Optimized for Yarn & Robustness (July 2025)

# Stage 1: Base image with necessary tools
FROM node:20-alpine AS base

# Install essential build tools and security updates first
RUN apk add --no-cache libc6-compat python3 make g++

# Set platform-specific environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Ensure we only install production dependencies when needed
ENV NEXT_SHARP_PATH="/tmp/node_modules/sharp"

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps

# Copy package definition and lockfile
COPY package.json yarn.lock* .npmrc ./

# Use Yarn to install dependencies with specific platform overrides
# 1. Set the target platform to Linux x64 to avoid downloading macOS-specific binaries
# 2. Use --ignore-optional to skip optional dependencies
# 3. Use --production=false to include devDependencies needed for build
# 4. Use --frozen-lockfile to ensure consistent dependency resolution
RUN yarn config set target_platform linux-x64 && \
    yarn install --frozen-lockfile --network-timeout 100000 --production=false --ignore-optional && \
    yarn cache clean && \
    # Remove any macOS-specific SWC binaries that might have been installed
    find node_modules -name "*darwin*" -type d -prune -exec rm -rf {} + || true

# Stage 3: Build the application
FROM base AS builder

# Copy source code
COPY . .

# Copy dependencies from the previous stage for a clean build
COPY --from=deps /app/node_modules ./node_modules

# Remove any platform-specific dependencies and binaries that might have been installed
RUN rm -rf node_modules/.bin/next-swc-* && \
    # Remove any remaining platform-specific SWC binaries
    find node_modules -name "*darwin*" -type d -prune -exec rm -rf {} + || true && \
    find node_modules -name "*darwin*" -type f -delete || true

# Set environment for production build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run the build command
RUN yarn build

# Stage 4: Production runner (Distroless)
# Using a distroless image for a smaller and more secure final image.
FROM gcr.io/distroless/nodejs20-debian12 AS runner

WORKDIR /app

# Set environment for production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy only the necessary production artifacts from the builder stage.
# The distroless image has a default non-root user 'nonroot' (uid: 65532).
COPY --from=builder --chown=65532:65532 /app/public ./public
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static

# Expose the application port
EXPOSE 3000

# Start the application using the standalone server
CMD ["node", "server.js"]
