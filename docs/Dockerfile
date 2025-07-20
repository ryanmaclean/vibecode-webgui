# Multi-stage Dockerfile for VibeCode Documentation Site (Astro)

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the static site
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy built site from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S vibecode -u 1001 -G nginx

# Set proper permissions
RUN chown -R vibecode:nginx /usr/share/nginx/html && \
    chown -R vibecode:nginx /var/cache/nginx && \
    chown -R vibecode:nginx /var/log/nginx && \
    chown -R vibecode:nginx /etc/nginx/conf.d

# Create pid directory and set permissions
RUN mkdir -p /var/run/nginx && \
    chown -R vibecode:nginx /var/run/nginx

# Switch to non-root user
USER vibecode

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Labels
LABEL maintainer="VibeCode Team <team@vibecode.dev>"
LABEL version="1.0.0"
LABEL description="VibeCode Documentation Site - Astro + Starlight"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]