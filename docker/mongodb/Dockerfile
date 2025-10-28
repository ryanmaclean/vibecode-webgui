# MongoDB Dockerfile optimized for Chat-UI
# Based on official MongoDB with VibeCode-specific configurations

FROM mongo:7.0-jammy

# Install additional tools for monitoring and maintenance
RUN apt-get update && apt-get install -y \
    # MongoDB tools
    mongodb-org-tools \
    # Backup and restore utilities
    awscli \
    # Monitoring and debugging
    curl \
    jq \
    # Text processing
    grep \
    sed \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Create directories for custom scripts and backups
RUN mkdir -p /opt/vibecode/scripts \
    && mkdir -p /opt/vibecode/backups \
    && mkdir -p /docker-entrypoint-initdb.d

# Copy initialization scripts
COPY init-chatui-db.js /docker-entrypoint-initdb.d/
COPY setup-replica-set.sh /opt/vibecode/scripts/
COPY backup-script.sh /opt/vibecode/scripts/
COPY healthcheck.sh /opt/vibecode/scripts/

# Make scripts executable
RUN chmod +x /opt/vibecode/scripts/*.sh

# MongoDB user already exists in base image, just ensure permissions are set

# Set up proper permissions
RUN chown -R mongodb:mongodb /opt/vibecode \
    && chown -R mongodb:mongodb /data/db \
    && chown -R mongodb:mongodb /data/configdb

# Copy custom MongoDB configuration
COPY mongod.conf /etc/mongod.conf

# Environment variables
ENV MONGO_INITDB_ROOT_USERNAME=admin
ENV MONGO_INITDB_ROOT_PASSWORD=vibecode_admin_2025
ENV MONGO_INITDB_DATABASE=chatui
ENV CHATUI_DB_USER=chatui_user
ENV CHATUI_DB_PASSWORD=chatui_password_2025

# Health check script
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /opt/vibecode/scripts/healthcheck.sh

# Expose MongoDB port
EXPOSE 27017

# Labels for container metadata
LABEL maintainer="VibeCode Team <team@vibecode.dev>"
LABEL version="1.0.0" 
LABEL description="MongoDB optimized for VibeCode Chat-UI"
LABEL org.opencontainers.image.title="VibeCode MongoDB"
LABEL org.opencontainers.image.description="MongoDB with chat-ui specific configurations"
LABEL org.opencontainers.image.vendor="VibeCode Platform"
LABEL org.opencontainers.image.licenses="SSPL"
LABEL org.opencontainers.image.source="https://github.com/vibecode/vibecode-webgui"

# Use the default MongoDB entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["mongod", "--config", "/etc/mongod.conf"]