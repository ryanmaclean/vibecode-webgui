# vfkit Demo Environment Guide

Complete setup for VibeCode demo using vfkit + Alpine ARM64 VMs on M-Series hardware.

## Architecture

**3 VMs running Alpine ARM64**:
1. **Development VM** (4 CPU, 4GB): code-server + Node.js + VibeCode API
2. **Database VM** (2 CPU, 2GB): PostgreSQL with dedicated data disk
3. **Services VM** (2 CPU, 1GB): Valkey (Redis alternative) + nginx reverse proxy

**Total Resources**: 8 CPU cores, 7GB RAM (of 24 cores, 64GB available on M2 Ultra)

## Quick Start

### 1. Setup Environment
```bash
cd /Users/studio/Documents/vibecode-webgui
./scripts/vfkit/setup-demo-environment.sh
```

This creates:
- `~/.vfkit/vms/` - VM launch scripts
- `~/.vfkit/disks/` - Disk images
- `~/.vfkit/start-demo.sh` - Start all VMs

### 2. Install Alpine on VMs

For each VM, boot Alpine ISO and install:

```bash
# Download Alpine ARM64
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-virt-3.19.1-aarch64.iso \
  -o ~/.vfkit/alpine.iso

# Boot VM with ISO (example for dev-vm)
vfkit \
  --cpus 4 \
  --memory 4096 \
  --bootloader efi,variable-store=~/.vfkit/disks/dev-vm-vars.fd,create \
  --device virtio-blk,path=~/.vfkit/alpine.iso \
  --device virtio-blk,path=~/.vfkit/disks/dev-vm.img \
  --device virtio-serial,stdio

# In VM console:
setup-alpine
# Follow prompts, install to /dev/vdb (second disk)
```

### 3. Configure Services

**Development VM**:
```bash
# SSH into dev VM
apk add code-server nodejs npm git

# Configure code-server
mkdir -p ~/.config/code-server
cat > ~/.config/code-server/config.yaml <<EOF
bind-addr: 0.0.0.0:8080
auth: password
password: vibecode
cert: false
EOF

# Start code-server
code-server &
```

**Database VM**:
```bash
# SSH into db VM
apk add postgresql postgresql-contrib

# Initialize PostgreSQL
rc-update add postgresql
/etc/init.d/postgresql setup
/etc/init.d/postgresql start

# Create database
psql -U postgres -c "CREATE DATABASE vibecode;"
psql -U postgres -c "CREATE USER vibecode WITH PASSWORD 'vibecode';"
psql -U postgres -c "GRANT ALL ON DATABASE vibecode TO vibecode;"
```

**Services VM**:
```bash
# SSH into services VM
apk add nginx build-base

# Compile Valkey (Redis alternative) with musl
cd /tmp
wget https://github.com/valkey-io/valkey/archive/refs/tags/7.2.5.tar.gz
tar xzf 7.2.5.tar.gz
cd valkey-7.2.5

# Build with musl optimizations
make MALLOC=libc USE_SYSTEMD=no \
  CFLAGS="-Os -fomit-frame-pointer -pipe" \
  LDFLAGS="-static"

# Install
make PREFIX=/usr/local install

# Create valkey user and directories
adduser -D -s /sbin/nologin valkey
mkdir -p /var/lib/valkey /var/log/valkey
chown -R valkey:valkey /var/lib/valkey /var/log/valkey

# Configure valkey
cat > /etc/valkey.conf <<EOF
bind 0.0.0.0
port 6379
daemonize yes
pidfile /var/run/valkey.pid
logfile /var/log/valkey/valkey.log
dir /var/lib/valkey
save 900 1
save 300 10
maxmemory 512mb
maxmemory-policy allkeys-lru
EOF

# Start Valkey
su - valkey -s /bin/sh -c "/usr/local/bin/valkey-server /etc/valkey.conf"

# Configure nginx
cat > /etc/nginx/http.d/vibecode.conf <<EOF
upstream code_server {
    server 192.168.64.2:8080;
}

server {
    listen 80;
    location /ide/ {
        proxy_pass http://code_server/;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
    }
}
EOF

rc-update add nginx
/etc/init.d/nginx start
```

### 4. Start Demo
```bash
~/.vfkit/start-demo.sh
```

## Access Services

- **code-server**: http://localhost:8080 (password: vibecode)
- **PostgreSQL**: localhost:5432 (user: vibecode, password: vibecode)
- **Valkey**: localhost:6379 (Redis-compatible)
- **nginx**: http://localhost:80

## Resource Usage

**M2 Ultra (24 cores, 64GB)**:
- Used: 8 cores, 7GB RAM
- Available: 16 cores, 57GB RAM
- Headroom: Plenty for other work

## Benefits

**Alpine ARM64**:
- Minimal: ~130MB base image
- Fast: <5s boot time
- Native: ARM64 on M-Series (no emulation)

**vfkit**:
- Apple Virtualization framework
- Near-native performance
- Simple configuration

## Monitoring

```bash
# Check VM processes
ps aux | grep vfkit

# View logs
tail -f ~/.vfkit/vms/*.log

# Resource usage
top -pid $(pgrep vfkit)
```

## Stop VMs

```bash
pkill vfkit
```
