#!/bin/sh
# Alpine Linux service setup script for VibeCode
# Run this inside the Alpine VM after first boot

set -e

echo "=== VibeCode Alpine Service Setup ==="
echo ""

# Update package index
echo "📦 Updating package index..."
apk update

echo ""
echo "=== Installing Required Packages ==="
echo ""

# Core build tools
echo "1/10 Installing build essentials..."
apk add build-base gcc g++ make python3 python3-dev

# Git for version control
echo "2/10 Installing git..."
apk add git

# PostgreSQL
echo "3/10 Installing PostgreSQL..."
apk add postgresql postgresql-dev postgresql-contrib

# Redis
echo "4/10 Installing Redis..."
apk add redis

# Additional utilities
echo "5/10 Installing utilities..."
apk add curl wget ca-certificates openssl bash nano

# Python pip (for some npm packages that need Python)
echo "6/10 Installing Python pip..."
apk add py3-pip

# Add virtiofs support (if not already in kernel)
echo "7/10 Installing filesystem utilities..."
apk add util-linux coreutils

# Networking utilities
echo "8/10 Installing network tools..."
apk add iproute2 iptables net-tools

# Process management
echo "9/10 Installing process management tools..."
apk add supervisor

# Development libraries that might be needed by npm packages
echo "10/10 Installing development libraries..."
apk add libpq-dev zlib-dev jpeg-dev libffi-dev

echo ""
echo "=== Configuring Services ==="
echo ""

# Initialize PostgreSQL
echo "🗄️  Initializing PostgreSQL..."
mkdir -p /run/postgresql
chown postgres:postgres /run/postgresql

# Check if PostgreSQL data directory exists
if [ ! -d "/var/lib/postgresql/data" ]; then
    mkdir -p /var/lib/postgresql/data
    chown postgres:postgres /var/lib/postgresql/data

    # Initialize database as postgres user
    su postgres -c "initdb -D /var/lib/postgresql/data"

    echo "✅ PostgreSQL initialized"
else
    echo "✅ PostgreSQL data directory already exists"
fi

# Configure PostgreSQL to listen on all interfaces
echo "📝 Configuring PostgreSQL..."
cat >> /var/lib/postgresql/data/postgresql.conf << 'EOF'

# VibeCode Configuration
listen_addresses = '*'
port = 5432
max_connections = 100
shared_buffers = 128MB
EOF

# Configure PostgreSQL authentication
cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               md5
EOF

echo "✅ PostgreSQL configured"

# Configure Redis
echo "📝 Configuring Redis..."
cat > /etc/redis.conf << 'EOF'
# VibeCode Redis Configuration
bind 0.0.0.0
port 6379
protected-mode no
daemonize no
supervised no
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis.log
dir /var/lib/redis
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

mkdir -p /var/lib/redis /var/log/redis /var/run/redis
chown redis:redis /var/lib/redis /var/log/redis /var/run/redis

echo "✅ Redis configured"

# Create supervisor configuration for services
echo "📝 Creating supervisor configuration..."
mkdir -p /etc/supervisor.d

# PostgreSQL supervisor config
cat > /etc/supervisor.d/postgresql.ini << 'EOF'
[program:postgresql]
command=/usr/bin/postgres -D /var/lib/postgresql/data
user=postgres
autostart=true
autorestart=true
stderr_logfile=/var/log/postgresql/postgres.err.log
stdout_logfile=/var/log/postgresql/postgres.out.log
EOF

# Redis supervisor config
cat > /etc/supervisor.d/redis.ini << 'EOF'
[program:redis]
command=/usr/bin/redis-server /etc/redis.conf
user=redis
autostart=true
autorestart=true
stderr_logfile=/var/log/redis/redis.err.log
stdout_logfile=/var/log/redis/redis.out.log
EOF

mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql

echo "✅ Supervisor configured"

# Create start script
echo "📝 Creating service start script..."
cat > /usr/local/bin/start-services << 'EOF'
#!/bin/sh
# Start all VibeCode services

echo "Starting VibeCode services..."

# Start supervisor (which will start postgres and redis)
supervisord -c /etc/supervisord.conf

echo "✅ All services started"
echo ""
echo "Service status:"
supervisorctl status

echo ""
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
EOF

chmod +x /usr/local/bin/start-services

# Create stop script
cat > /usr/local/bin/stop-services << 'EOF'
#!/bin/sh
# Stop all VibeCode services

echo "Stopping VibeCode services..."
supervisorctl stop all
killall supervisord

echo "✅ All services stopped"
EOF

chmod +x /usr/local/bin/stop-services

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Installed:"
echo "  ✅ PostgreSQL 16.x"
echo "  ✅ Redis 7.x"
echo "  ✅ Git"
echo "  ✅ Build tools (gcc, make, python3)"
echo "  ✅ Node.js 20.11.1 (from rootfs)"
echo "  ✅ npm package manager"
echo ""
echo "Service Management:"
echo "  Start all services: start-services"
echo "  Stop all services: stop-services"
echo "  Check status: supervisorctl status"
echo ""
echo "Database Setup:"
echo "  Create VibeCode database:"
echo "    su postgres -c 'createdb vibecode'"
echo "    su postgres -c 'createuser vibecode'"
echo ""
echo "Next steps:"
echo "  1. Mount shared directory: mkdir -p /mnt/vibecode && mount -t virtiofs vibecode /mnt/vibecode"
echo "  2. cd /mnt/vibecode"
echo "  3. npm install"
echo "  4. Start services: start-services"
echo "  5. Create .env file with DATABASE_URL and REDIS_URL"
echo "  6. npx prisma migrate deploy"
echo "  7. npm run build"
echo "  8. npm start"
echo ""
