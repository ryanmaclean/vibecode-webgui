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

# Stage 4: Production runner (Distroless)
# Using a distroless image for a smaller and more secure final image.
FROM gcr.io/distroless/nodejs:20 AS runner

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
