# Docker Production Deployment

Production-grade Docker deployment patterns and best practices for VibeCode.

## Production Docker Compose

### Complete Stack

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Application
  vibecode:
    image: vibecode/webgui:${VERSION:-latest}
    container_name: vibecode-app
    restart: unless-stopped

    environment:
      # Application
      NODE_ENV: production
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}

      # Database
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?sslmode=require

      # Monitoring
      DD_AGENT_HOST: datadog-agent
      DD_ENV: production
      DD_SERVICE: vibecode-webgui
      DD_VERSION: ${VERSION:-latest}
      DD_TRACE_ENABLED: "true"
      DD_PROFILING_ENABLED: "true"
      DD_RUNTIME_METRICS_ENABLED: "true"

      # AI Providers
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

      # Performance
      NODE_OPTIONS: "--max-old-space-size=4096"

    ports:
      - "127.0.0.1:3000:3000"  # Only bind to localhost

    volumes:
      - app-cache:/app/.next/cache:rw
      - app-uploads:/app/uploads:rw

    networks:
      - frontend
      - backend

    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service,environment,version"

    security_opt:
      - no-new-privileges:true

    read_only: false  # Next.js needs write access

    tmpfs:
      - /tmp:rw,noexec,nosuid,size=1g

  # PostgreSQL Database
  postgres:
    image: pgvector/pgvector:pg16
    container_name: vibecode-db
    restart: unless-stopped

    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.utf8"
      PGDATA: /var/lib/postgresql/data/pgdata

      # Performance tuning
      POSTGRES_SHARED_BUFFERS: 2GB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 6GB
      POSTGRES_MAINTENANCE_WORK_MEM: 512MB
      POSTGRES_WORK_MEM: 10MB
      POSTGRES_MAX_CONNECTIONS: 200

    volumes:
      - postgres-data:/var/lib/postgresql/data:rw
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
      - postgres-backups:/backups:rw

    networks:
      - backend

    ports:
      - "127.0.0.1:5432:5432"  # Only expose locally

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
        reservations:
          cpus: '1.0'
          memory: 4G

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

    security_opt:
      - no-new-privileges:true

    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf

  # Redis Cache
  redis:
    image: valkey/valkey:7-alpine
    container_name: vibecode-cache
    restart: unless-stopped

    command:
      - valkey-server
      - --maxmemory 1gb
      - --maxmemory-policy allkeys-lru
      - --appendonly yes
      - --appendfsync everysec
      - --requirepass ${REDIS_PASSWORD}

    volumes:
      - redis-data:/data:rw

    networks:
      - backend

    ports:
      - "127.0.0.1:6379:6379"

    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M

    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"

    security_opt:
      - no-new-privileges:true

  # NGINX Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: vibecode-proxy
    restart: unless-stopped

    ports:
      - "80:80"
      - "443:443"

    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx-cache:/var/cache/nginx:rw
      - nginx-logs:/var/log/nginx:rw

    networks:
      - frontend

    depends_on:
      - vibecode

    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

    security_opt:
      - no-new-privileges:true

  # Datadog Agent
  datadog-agent:
    image: gcr.io/datadoghq/agent:7
    container_name: datadog-agent
    restart: unless-stopped

    environment:
      DD_API_KEY: ${DD_API_KEY}
      DD_SITE: ${DD_SITE:-datadoghq.com}
      DD_ENV: production
      DD_TAGS: "env:production service:vibecode"

      # APM
      DD_APM_ENABLED: "true"
      DD_APM_NON_LOCAL_TRAFFIC: "true"

      # Logs
      DD_LOGS_ENABLED: "true"
      DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"

      # Database Monitoring
      DD_DBM_ENABLED: "true"

      # Process monitoring
      DD_PROCESS_AGENT_ENABLED: "true"

      # Container monitoring
      DD_CONTAINER_INCLUDE: "name:vibecode-.*"
      DD_CONTAINER_EXCLUDE: "name:datadog-agent"

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - /etc/passwd:/etc/passwd:ro
      - ./datadog/conf.d:/conf.d:ro

    networks:
      - backend

    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"

    security_opt:
      - no-new-privileges:true

  # Backup Service
  backup:
    image: postgres:16-alpine
    container_name: vibecode-backup
    restart: "no"

    environment:
      PGHOST: postgres
      PGPORT: 5432
      PGDATABASE: ${DB_NAME}
      PGUSER: ${DB_USER}
      PGPASSWORD: ${DB_PASSWORD}

    volumes:
      - postgres-backups:/backups:rw
      - ./scripts/backup.sh:/backup.sh:ro

    networks:
      - backend

    depends_on:
      postgres:
        condition: service_healthy

    command: ["/backup.sh"]

    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"

networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
  backend:
    driver: bridge
    internal: true  # No external access
    ipam:
      config:
        - subnet: 172.21.0.0/24

volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/vibecode/postgres

  postgres-backups:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /backups/vibecode/postgres

  redis-data:
    driver: local

  app-cache:
    driver: local

  app-uploads:
    driver: local

  nginx-cache:
    driver: local

  nginx-logs:
    driver: local
```

### Environment Variables

```bash
# .env.production
# NEVER commit this file to version control

# Application Version
VERSION=1.0.0

# Application URLs
NEXTAUTH_URL=https://vibecode.example.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DB_NAME=vibecode
DB_USER=vibecode
DB_PASSWORD=<strong-random-password>

# Redis
REDIS_PASSWORD=<strong-random-password>

# Monitoring
DD_API_KEY=<your-datadog-api-key>
DD_APP_KEY=<your-datadog-app-key>
DD_SITE=datadoghq.com

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# OAuth (if using)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Production NGINX Configuration

```nginx
# nginx/nginx.conf
user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format json escape=json '{'
        '"time":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"request_method":"$request_method",'
        '"request_uri":"$request_uri",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"upstream_response_time":"$upstream_response_time",'
        '"http_referrer":"$http_referer",'
        '"http_user_agent":"$http_user_agent"'
    '}';

    access_log /var/log/nginx/access.log json;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Timeouts
    client_body_timeout 60s;
    client_header_timeout 60s;
    send_timeout 60s;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

    # Cache
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=1g inactive=60m use_temp_path=off;

    # Upstream
    upstream vibecode_backend {
        least_conn;
        server vibecode:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        listen [::]:80;
        server_name vibecode.example.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name vibecode.example.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_stapling on;
        ssl_stapling_verify on;
        ssl_trusted_certificate /etc/nginx/ssl/chain.pem;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
        limit_conn conn_limit 10;

        # Proxy settings
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # API endpoints (no caching)
        location /api/ {
            limit_req zone=api_limit burst=50 nodelay;
            proxy_pass http://vibecode_backend;
            proxy_cache_bypass $http_upgrade;
            proxy_no_cache 1;
        }

        # Login endpoint (strict rate limiting)
        location /api/auth/signin {
            limit_req zone=login_limit burst=2 nodelay;
            proxy_pass http://vibecode_backend;
            proxy_cache_bypass $http_upgrade;
        }

        # Static files (aggressive caching)
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://vibecode_backend;
            proxy_cache app_cache;
            proxy_cache_valid 200 30d;
            proxy_cache_valid 404 1m;
            add_header X-Cache-Status $upstream_cache_status;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Next.js static files
        location /_next/static/ {
            proxy_pass http://vibecode_backend;
            proxy_cache app_cache;
            proxy_cache_valid 200 365d;
            add_header X-Cache-Status $upstream_cache_status;
            expires 365d;
            add_header Cache-Control "public, immutable";
        }

        # All other requests
        location / {
            proxy_pass http://vibecode_backend;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## PostgreSQL Production Configuration

```conf
# postgres/postgresql.conf
# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Memory Settings
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM
maintenance_work_mem = 512MB
work_mem = 10MB

# WAL Settings
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
wal_keep_size = 1GB
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'

# Checkpoint Settings
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# Query Tuning
random_page_cost = 1.1                  # SSD storage
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000       # Log queries > 1s
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Performance
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 10s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02

# Extensions
shared_preload_libraries = 'pg_stat_statements,pgvector'
```

## Deployment Scripts

### Deploy Script

```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

echo "Starting VibeCode production deployment..."

# Pre-deployment checks
echo "Running pre-deployment checks..."

# Check environment file
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found"
    exit 1
fi

# Check required variables
source "$ENV_FILE"
required_vars=("NEXTAUTH_SECRET" "DB_PASSWORD" "DD_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "Error: $var not set in $ENV_FILE"
        exit 1
    fi
done

# Pull latest images
echo "Pulling latest images..."
docker-compose -f "$COMPOSE_FILE" pull

# Backup database
echo "Creating database backup..."
docker-compose -f "$COMPOSE_FILE" run --rm backup

# Start services
echo "Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for health checks
echo "Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; do sleep 5; done'

# Run smoke tests
echo "Running smoke tests..."
curl -f http://localhost:3000/api/health || {
    echo "Health check failed!"
    docker-compose -f "$COMPOSE_FILE" logs vibecode
    exit 1
}

echo "Deployment completed successfully!"
echo "Application available at: $NEXTAUTH_URL"
```

### Backup Script

```bash
#!/bin/bash
# scripts/backup.sh - Database backup script

set -euo pipefail

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/vibecode_${TIMESTAMP}.sql.gz"

echo "Starting database backup..."

# Create backup
pg_dump -Fc -Z9 > "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    echo "Backup verified successfully"

    # Clean old backups (keep last 30 days)
    find "${BACKUP_DIR}" -name "vibecode_*.sql.gz" -mtime +30 -delete

    echo "Old backups cleaned"
else
    echo "Backup verification failed!"
    exit 1
fi
```

## Monitoring with Datadog

```yaml
# datadog/conf.d/postgres.d/conf.yaml
init_config:

instances:
  - host: postgres
    port: 5432
    username: datadog
    password: ${DD_POSTGRES_PASSWORD}
    dbname: vibecode

    dbm: true
    query_metrics:
      enabled: true
      run_sync: false
    query_samples:
      enabled: true
      run_sync: false

    tags:
      - env:production
      - service:vibecode-database

    relations:
      - relation_regex: .*
        schemas:
          - public
```

## Next Steps

- [Monitoring Configuration](./MONITORING.md)
- [Security Hardening](./SECURITY_HARDENING.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
