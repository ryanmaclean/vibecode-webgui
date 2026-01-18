# Agent Y: Developer Experience Enhancement Design

**Date:** January 5, 2026
**Agent:** Agent Y - Developer Experience Specialist
**Mission:** Transform unified services VM into a developer productivity powerhouse

---

## Executive Summary

This document outlines a comprehensive developer experience (DX) enhancement strategy for the unified services VM. The current system is production-ready but lacks modern developer tooling. This design adds hot reload, remote debugging, live monitoring, file sync, and a rich plugin ecosystem while maintaining the fast boot time and stability.

**Goal:** Reduce development iteration time from 8 minutes (full rebuild) to <30 seconds (hot reload).

---

## Current State Analysis

### What Works Well ✅

1. **Fast Boot Time:** 52 seconds from cold start to all services ready
2. **Service Integration:** 4 services running harmoniously
   - OpenVSCode on port 8080
   - PostgreSQL 16 on port 5432
   - Valkey 8.0.1 on port 6379
   - Dropbear SSH on port 22
3. **Resource Efficiency:** 65MB compressed initramfs
4. **Network Stability:** Robust DHCP with static fallback (192.168.64.10)
5. **Host Volume Mounting:** virtio-fs support for /mnt/host

### Critical Pain Points ❌

1. **No Hot Reload**
   - Code changes require full VM rebuild (~8 minutes)
   - No selective service restart
   - OpenVSCode extensions require full rebuild

2. **No Remote Debugging**
   - Cannot attach debuggers to Node.js processes
   - No PostgreSQL plpgsql debugging
   - No Valkey command monitoring

3. **No Live Monitoring**
   - Must SSH in to view logs
   - No real-time service status
   - No resource usage visibility
   - No centralized log streaming

4. **Limited Developer Tools**
   - Missing code formatters (prettier, black, gofmt)
   - Missing linters (eslint, pylint, shellcheck)
   - Missing API testing tools (httpie, postman CLI)
   - No database migration tools

5. **No File Synchronization**
   - No bi-directional sync with host
   - No watch mode for automatic updates
   - Manual file copying required

6. **Minimal Plugin Ecosystem**
   - Only 7 pre-installed VS Code extensions
   - No extension marketplace access
   - No language servers for common languages

7. **No Database GUI Tools**
   - No pgAdmin for PostgreSQL
   - No Redis Commander for Valkey
   - Command-line only access

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST MACHINE (macOS)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐      ┌──────────────────┐             │
│  │  Dev Dashboard  │◄────►│  File Watcher    │             │
│  │  (localhost:    │      │  (rsync daemon)  │             │
│  │   3000)         │      └──────────────────┘             │
│  └─────────────────┘              │                         │
│         │                          │                         │
│         │                          ▼                         │
│         │                  ┌──────────────────┐             │
│         │                  │  Host Shared Dir │             │
│         │                  │  /mnt/host       │             │
│         └──────────────────┴──────────────────┴─────────────┤
│                            │                                 │
│  ┌─────────────────────────┼────────────────────────────┐  │
│  │    UNIFIED SERVICES VM (192.168.64.10)               │  │
│  ├─────────────────────────┼────────────────────────────┤  │
│  │                         ▼                             │  │
│  │   /mnt/host  (virtio-fs shared directory)            │  │
│  │         │                                             │  │
│  │         ├── config/   (app configurations)           │  │
│  │         ├── data/     (persistent data)              │  │
│  │         ├── logs/     (service logs)                 │  │
│  │         ├── sync/     (hot-reload watched files)     │  │
│  │         └── tools/    (dev utilities)                │  │
│  │                                                        │  │
│  │   ┌──────────────────────────────────────────┐       │  │
│  │   │     DEV SERVICES LAYER                   │       │  │
│  │   ├──────────────────────────────────────────┤       │  │
│  │   │  Hot Reload Watcher (inotify-tools)      │       │  │
│  │   │  File Sync Daemon (rsync)                │       │  │
│  │   │  Dev Dashboard API (port 9090)           │       │  │
│  │   │  Log Aggregator (multitail)              │       │  │
│  │   │  Resource Monitor (htop/btop)            │       │  │
│  │   └──────────────────────────────────────────┘       │  │
│  │                                                        │  │
│  │   ┌──────────────────────────────────────────┐       │  │
│  │   │     APPLICATION SERVICES                 │       │  │
│  │   ├──────────────────────────────────────────┤       │  │
│  │   │  OpenVSCode :8080  (with debugger port)  │       │  │
│  │   │  PostgreSQL :5432  (with pgAdmin)        │       │  │
│  │   │  Valkey     :6379  (with Commander)      │       │  │
│  │   │  SSH        :22    (with key auth)       │       │  │
│  │   └──────────────────────────────────────────┘       │  │
│  │                                                        │  │
│  │   ┌──────────────────────────────────────────┐       │  │
│  │   │     DATABASE GUI TOOLS                   │       │  │
│  │   ├──────────────────────────────────────────┤       │  │
│  │   │  pgAdmin 4       :5050                   │       │  │
│  │   │  Redis Commander :8081                   │       │  │
│  │   └──────────────────────────────────────────┘       │  │
│  │                                                        │  │
│  │   ┌──────────────────────────────────────────┐       │  │
│  │   │     DEVELOPER UTILITIES                  │       │  │
│  │   ├──────────────────────────────────────────┤       │  │
│  │   │  Git, curl, wget, jq, yq                 │       │  │
│  │   │  Node.js, Python, Go (compilers)         │       │  │
│  │   │  prettier, eslint, pylint, shellcheck    │       │  │
│  │   │  npm, pip, cargo (package managers)      │       │  │
│  │   │  psql, redis-cli (database clients)      │       │  │
│  │   └──────────────────────────────────────────┘       │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Port Allocation

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| OpenVSCode | 8080 | HTTP | IDE interface |
| OpenVSCode Debug | 9229 | WebSocket | Node.js debugging |
| PostgreSQL | 5432 | TCP | Database |
| pgAdmin | 5050 | HTTP | PostgreSQL GUI |
| Valkey | 6379 | TCP | Cache/DB |
| Redis Commander | 8081 | HTTP | Valkey GUI |
| SSH | 22 | TCP | Remote access |
| Dev Dashboard API | 9090 | HTTP/WS | Live monitoring |
| Hot Reload Webhook | 9091 | HTTP | File change notifications |

---

## Feature 1: Hot Reload System

### Overview

Implement file watching with selective service restart to reduce iteration time from 8 minutes to <30 seconds.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST: File changes detected in project directory           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  SYNC: rsync daemon copies changed files to /mnt/host/sync  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  VM: inotify watcher detects file changes in /mnt/host/sync │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  CLASSIFY: Determine which services need restart            │
│  - .js/.ts → OpenVSCode extension reload                   │
│  - .sql → PostgreSQL reload                                 │
│  - .conf → Valkey reload                                    │
│  - init script → Full VM restart required                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  RESTART: Selective service restart (no full VM rebuild)    │
│  - Send SIGHUP to target service                            │
│  - Verify service health after restart                      │
│  - Log restart time and success                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Components

1. **File Watcher (inotify-tools)**
   - Monitor /mnt/host/sync directory
   - Detect file changes, creates, deletes
   - Debounce changes (500ms window)

2. **Service Classifier**
   - Map file extensions to services
   - Determine restart strategy (reload vs restart)
   - Handle dependencies (PostgreSQL schema → restart)

3. **Service Controller**
   - Graceful restart using supervisord or systemd
   - Health checks after restart
   - Rollback on failure

4. **Notification System**
   - WebSocket to dev dashboard
   - Desktop notifications via webhook
   - VS Code extension integration

### Configuration Files

**`.hotreload.yml`** (in /mnt/host/config)
```yaml
# Hot reload configuration
version: 1

watch:
  paths:
    - /mnt/host/sync/**/*.js
    - /mnt/host/sync/**/*.ts
    - /mnt/host/sync/**/*.sql
    - /mnt/host/sync/**/*.conf

  exclude:
    - node_modules/**
    - .git/**
    - **/*.log

services:
  openvscode:
    trigger_patterns:
      - "**/*.js"
      - "**/*.ts"
      - "**/extensions/**"
    restart_command: "/opt/openvscode/bin/openvscode-server --reload"
    health_check: "curl -f http://localhost:8080/healthz"
    timeout: 15

  postgresql:
    trigger_patterns:
      - "**/*.sql"
      - "**/postgresql.conf"
    restart_command: "su postgres -c 'pg_ctl reload -D /var/lib/postgresql/data'"
    health_check: "pg_isready -h localhost"
    timeout: 10

  valkey:
    trigger_patterns:
      - "**/valkey.conf"
    restart_command: "redis-cli CONFIG RELOAD"
    health_check: "redis-cli PING"
    timeout: 5

debounce:
  delay_ms: 500
  max_delay_ms: 5000

notifications:
  webhook_url: "http://host.docker.internal:9091/reload"
  desktop_notifications: true
```

### Performance Targets

| Operation | Target | Current |
|-----------|--------|---------|
| File change to service reload | <10s | 8 minutes |
| OpenVSCode extension reload | <15s | 8 minutes |
| PostgreSQL config reload | <5s | 8 minutes |
| Valkey config reload | <2s | 8 minutes |
| Multiple file changes (batched) | <20s | 8 minutes |

---

## Feature 2: Remote Debugging

### Overview

Enable VS Code remote debugging for all services running in the VM.

### Debugging Capabilities

#### 1. Node.js Debugging (OpenVSCode Server)

**Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Debug OpenVSCode Server",
      "address": "192.168.64.10",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/opt/openvscode",
      "skipFiles": [
        "<node_internals>/**"
      ],
      "sourceMaps": true,
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ]
    }
  ]
}
```

**VM Changes:**
- Start OpenVSCode with `--inspect=0.0.0.0:9229`
- Install V8 Inspector support
- Configure source map paths

#### 2. PostgreSQL Debugging (plpgsql)

**Tools:**
- pldebugger extension for plpgsql
- VS Code PostgreSQL extension with debugger
- pgAdmin 4 with integrated debugger

**Setup:**
```sql
-- Enable plpgsql debugger
CREATE EXTENSION pldbgapi;

-- Debug stored procedure
SELECT pldbg_create_listener();
SELECT pldbg_wait_for_target(12345);
```

#### 3. Valkey Command Monitoring

**Tools:**
- `MONITOR` command streaming
- Redis Insights (CLI alternative)
- Custom monitoring dashboard

**Implementation:**
```bash
# Stream all Valkey commands to log
redis-cli MONITOR > /tmp/valkey-commands.log &

# Real-time command display in dashboard
redis-cli --csv MONITOR | tee /tmp/valkey-monitor.csv
```

#### 4. Remote Shell Debugging

**Setup SSH with key-based auth:**
```bash
# Generate SSH key on host
ssh-keygen -t ed25519 -f ~/.ssh/vibecode_vm -N ""

# Copy public key to VM
cat ~/.ssh/vibecode_vm.pub | ssh root@192.168.64.10 'cat >> ~/.ssh/authorized_keys'

# Configure SSH client
cat >> ~/.ssh/config << EOF
Host vibecode-vm
    HostName 192.168.64.10
    User root
    IdentityFile ~/.ssh/vibecode_vm
    StrictHostKeyChecking no
EOF

# Connect without password
ssh vibecode-vm
```

---

## Feature 3: Live Development Dashboard

### Overview

A single-page web application providing real-time visibility into all VM services, logs, and resource usage.

### Dashboard Sections

#### 1. Service Status Panel

```
┌────────────────────────────────────────────────────────┐
│  SERVICE STATUS                         Last Updated: 1s ago  │
├────────────────────────────────────────────────────────┤
│  ● OpenVSCode    :8080   ✓ Healthy   Uptime: 2h 15m   │
│     Response: 3ms   Memory: 245MB   CPU: 2%            │
│     [Restart] [View Logs] [Configure]                  │
│                                                          │
│  ● PostgreSQL    :5432   ✓ Healthy   Uptime: 2h 15m   │
│     Connections: 3/50   Queries/sec: 12   Cache: 85%   │
│     [Restart] [View Logs] [pgAdmin] [Query Console]    │
│                                                          │
│  ● Valkey        :6379   ✓ Healthy   Uptime: 2h 15m   │
│     Memory: 45MB/128MB   Keys: 1,234   Hits: 95%       │
│     [Restart] [View Logs] [Commander] [Monitor]        │
│                                                          │
│  ● SSH           :22     ✓ Healthy   Uptime: 2h 15m   │
│     Sessions: 2   Failed attempts: 0                    │
│     [View Logs] [Active Sessions]                      │
└────────────────────────────────────────────────────────┘
```

#### 2. Live Log Streaming

```
┌────────────────────────────────────────────────────────┐
│  LIVE LOGS                                  [Filters]   │
├────────────────────────────────────────────────────────┤
│  [OpenVSCode] [PostgreSQL] [Valkey] [SSH] [All]       │
│  [Clear] [Download] [Pause] [Search]                   │
├────────────────────────────────────────────────────────┤
│  12:34:56.789  [OpenVSCode]  INFO   Server listening   │
│  12:34:57.123  [PostgreSQL]  LOG    Checkpoint start   │
│  12:34:57.456  [Valkey]      DEBUG  RDB save complete  │
│  12:34:58.789  [SSH]         WARN   Failed login from  │
│  12:34:59.012  [OpenVSCode]  INFO   Extension loaded   │
│  ...                                                    │
│  [Auto-scroll: ON] [Level: ALL]  Showing 500 lines    │
└────────────────────────────────────────────────────────┘
```

#### 3. Resource Usage Graphs

```
┌────────────────────────────────────────────────────────┐
│  RESOURCE USAGE                         Last 5 minutes  │
├────────────────────────────────────────────────────────┤
│  CPU Usage (%)                                          │
│  100 ┤                                                 │
│   75 ┤              ╭╮                                 │
│   50 ┤     ╭────────╯╰───╮                            │
│   25 ┤─────╯              ╰─────                       │
│    0 ┼────────────────────────────────────            │
│      └─────────────────────────────────►               │
│                                                          │
│  Memory (MB)                                            │
│  4096┤              ┌──────────────                    │
│  3072┤         ┌────┘                                  │
│  2048┤    ┌────┘                                       │
│  1024┤────┘                                            │
│     0┼──────────────────────────────────              │
│      └─────────────────────────────────►               │
│                                                          │
│  Network I/O (KB/s)                                     │
│   500┤     ╭╮    ╭╮                                    │
│   375┤    ╭╯╰╮  ╭╯╰╮                                   │
│   250┤   ╭╯  ╰╮╭╯  ╰╮                                  │
│   125┤──╭╯    ╰╯    ╰╮──                               │
│     0┼──╯            ╰───────────────                  │
│      └─────────────────────────────────►               │
└────────────────────────────────────────────────────────┘
```

#### 4. Quick Actions

```
┌────────────────────────────────────────────────────────┐
│  QUICK ACTIONS                                          │
├────────────────────────────────────────────────────────┤
│  [🔄 Restart All Services]  [⏸️  Pause Monitoring]     │
│  [🗄️  Backup Databases]     [📊 Performance Report]    │
│  [🔍 Run Health Checks]     [📁 Browse Files]          │
│  [⚙️  Edit Configurations]  [📝 View Documentation]    │
└────────────────────────────────────────────────────────┘
```

#### 5. Database Query Console

**PostgreSQL Tab:**
```
┌────────────────────────────────────────────────────────┐
│  POSTGRESQL QUERY CONSOLE                               │
├────────────────────────────────────────────────────────┤
│  SELECT * FROM users WHERE active = true;               │
│  [Run Query] [Format] [Save] [History]                 │
├────────────────────────────────────────────────────────┤
│  Results (23 rows in 15ms):                            │
│  ┌────┬────────────┬──────────────┬────────────────┐  │
│  │ id │ username   │ email        │ created_at     │  │
│  ├────┼────────────┼──────────────┼────────────────┤  │
│  │ 1  │ john_doe   │ john@ex.com  │ 2025-01-01     │  │
│  │ 2  │ jane_smith │ jane@ex.com  │ 2025-01-02     │  │
│  └────┴────────────┴──────────────┴────────────────┘  │
│  [Export CSV] [Export JSON] [Copy]                     │
└────────────────────────────────────────────────────────┘
```

**Valkey Tab:**
```
┌────────────────────────────────────────────────────────┐
│  VALKEY COMMAND CONSOLE                                 │
├────────────────────────────────────────────────────────┤
│  > KEYS *                                               │
│  [Execute] [Clear] [History]                           │
├────────────────────────────────────────────────────────┤
│  1) "user:1234"                                         │
│  2) "session:abc"                                       │
│  3) "cache:homepage"                                    │
│  (3 keys found)                                         │
│                                                          │
│  > GET user:1234                                        │
│  {"id":1234,"name":"John Doe","active":true}           │
│  [View as JSON] [Edit] [Delete]                        │
└────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend (VM):**
- **API Server:** Go with Gin framework
- **WebSocket:** gorilla/websocket for real-time updates
- **Log Aggregation:** multitail + custom parser
- **Metrics:** Prometheus node exporter

**Frontend (Host):**
- **Framework:** React with TypeScript
- **UI Library:** shadcn/ui + Tailwind CSS
- **Charts:** recharts for resource graphs
- **Terminal:** xterm.js for embedded shells
- **WebSocket Client:** Socket.IO

---

## Feature 4: Developer Utilities Suite

### Essential Command-Line Tools

#### 1. Version Control
```bash
# Git with LFS support
git version 2.43.0
git-lfs version 3.4.0

# Configuration
git config --global user.name "Developer"
git config --global user.email "dev@vibecode.local"
git config --global core.editor "code --wait"
```

#### 2. API Testing Tools
```bash
# curl (already included)
curl --version

# httpie - Modern HTTP client
http --version
# Example: http GET http://localhost:8080/api/users

# Postman CLI (newman)
newman --version
# Example: newman run collection.json
```

#### 3. Code Formatters
```bash
# Prettier for JavaScript/TypeScript
prettier --version
# Example: prettier --write "**/*.{js,ts,json,css}"

# Black for Python
black --version
# Example: black --check *.py

# gofmt for Go (part of Go toolchain)
go fmt ./...

# shfmt for Shell scripts
shfmt --version
# Example: shfmt -w -i 2 script.sh
```

#### 4. Linters
```bash
# ESLint for JavaScript/TypeScript
eslint --version
# Example: eslint --fix src/**/*.ts

# Pylint for Python
pylint --version
# Example: pylint --output-format=colorized app.py

# ShellCheck for Shell scripts
shellcheck --version
# Example: shellcheck script.sh

# Hadolint for Dockerfiles
hadolint --version
# Example: hadolint Dockerfile
```

#### 5. Database Tools
```bash
# PostgreSQL client
psql --version
# Example: psql -h localhost -U postgres -c "SELECT version();"

# pgcli - PostgreSQL with autocomplete
pgcli --version
# Example: pgcli postgresql://postgres@localhost/postgres

# Redis CLI (for Valkey)
redis-cli --version
# Example: redis-cli -h localhost PING
```

#### 6. JSON/YAML Processors
```bash
# jq - JSON processor
jq --version
# Example: curl http://api.example.com | jq '.users[0]'

# yq - YAML processor
yq --version
# Example: yq eval '.services.postgres.port' docker-compose.yml

# fx - Interactive JSON viewer
fx --version
# Example: echo '{"key":"value"}' | fx
```

#### 7. Network Utilities
```bash
# netcat for port testing
nc -zv localhost 8080

# nmap for network scanning
nmap --version
# Example: nmap -p 1-10000 192.168.64.10

# tcpdump for packet capture
tcpdump --version
# Example: tcpdump -i eth0 port 5432

# mtr - Network diagnostic tool
mtr --version
# Example: mtr google.com
```

#### 8. Process Monitoring
```bash
# htop - Interactive process viewer
htop --version

# btop - Modern resource monitor
btop --version

# glances - System monitoring
glances --version

# lazydocker - Docker management TUI
lazydocker --version
```

#### 9. File Operations
```bash
# fd - Fast file finder
fd --version
# Example: fd -e js -e ts

# ripgrep - Fast grep alternative
rg --version
# Example: rg "TODO" --type js

# bat - Cat with syntax highlighting
bat --version
# Example: bat config.json

# exa - Modern ls
exa --version
# Example: exa --tree --level=2
```

#### 10. Benchmarking
```bash
# ab - Apache Bench
ab -V
# Example: ab -n 1000 -c 10 http://localhost:8080/

# wrk - HTTP benchmarking
wrk --version
# Example: wrk -t12 -c400 -d30s http://localhost:8080

# hyperfine - Command benchmarking
hyperfine --version
# Example: hyperfine 'psql -c "SELECT count(*) FROM users"'
```

### Package Manager Setup

```bash
# Node.js and npm (via Alpine musl-compatible build)
node --version  # v24.9.0
npm --version   # v10.9.0

# Yarn
npm install -g yarn
yarn --version

# pnpm
npm install -g pnpm
pnpm --version

# Python and pip
python3 --version  # v3.12
pip3 --version

# Rust and Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo --version
```

---

## Feature 5: File Synchronization

### Bi-Directional Sync Architecture

```
┌──────────────────────────────────────────────────────┐
│  HOST MACHINE                                         │
├──────────────────────────────────────────────────────┤
│  Project Directory: ~/projects/myapp                  │
│         │                                             │
│         ▼                                             │
│  File Watcher (fswatch)                              │
│         │                                             │
│         ▼                                             │
│  Rsync Client (triggers on change)                   │
│         │                                             │
│         │ SSH (port 22)                               │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│  VM: 192.168.64.10                                    │
├──────────────────────────────────────────────────────┤
│  Rsync Daemon (listens on port 873)                  │
│         │                                             │
│         ▼                                             │
│  /mnt/host/sync/myapp (synced directory)             │
│         │                                             │
│         ▼                                             │
│  Hot Reload Watcher (inotify)                        │
│         │                                             │
│         ▼                                             │
│  Service Restart (selective)                         │
└──────────────────────────────────────────────────────┘
```

### Rsync Configuration

**On VM (`/etc/rsyncd.conf`):**
```ini
# Rsync daemon configuration for file sync
uid = root
gid = root
use chroot = no
max connections = 4
pid file = /var/run/rsyncd.pid
log file = /var/log/rsyncd.log

[sync]
    path = /mnt/host/sync
    comment = Project sync directory
    read only = false
    list = yes
    auth users = dev
    secrets file = /etc/rsyncd.secrets
    hosts allow = 192.168.64.1/24
```

**On Host (`~/vibecode-sync.sh`):**
```bash
#!/bin/bash
# Bi-directional file sync script

PROJECT_DIR="${1:-$PWD}"
VM_IP="192.168.64.10"
SYNC_MODULE="sync"
EXCLUDE_FILE="$HOME/.vibecode-sync-exclude"

# Create exclude file if not exists
cat > "$EXCLUDE_FILE" << 'EOF'
.git/
node_modules/
.DS_Store
*.log
__pycache__/
.venv/
dist/
build/
.next/
EOF

# Watch mode: sync on file change
watch_sync() {
    echo "Watching $PROJECT_DIR for changes..."
    fswatch -o "$PROJECT_DIR" | while read -r change; do
        echo "[$(date +%T)] Syncing changes to VM..."
        rsync -avz --delete \
            --exclude-from="$EXCLUDE_FILE" \
            "$PROJECT_DIR/" \
            "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/"
        echo "[$(date +%T)] Sync complete"
    done
}

# Manual sync mode
manual_sync() {
    echo "Syncing $PROJECT_DIR to VM..."
    rsync -avz --delete \
        --exclude-from="$EXCLUDE_FILE" \
        --progress \
        "$PROJECT_DIR/" \
        "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/"
    echo "Sync complete"
}

# Reverse sync from VM to host
pull_sync() {
    echo "Pulling changes from VM to $PROJECT_DIR..."
    rsync -avz --delete \
        --exclude-from="$EXCLUDE_FILE" \
        --progress \
        "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/" \
        "$PROJECT_DIR/"
    echo "Pull complete"
}

case "${2:-watch}" in
    watch)
        watch_sync
        ;;
    push)
        manual_sync
        ;;
    pull)
        pull_sync
        ;;
    *)
        echo "Usage: $0 <project_dir> [watch|push|pull]"
        exit 1
        ;;
esac
```

### VS Code Integration

**`.vscode/settings.json`:**
```json
{
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/**": true
  },
  "remote.SSH.remotePlatform": {
    "vibecode-vm": "linux"
  },
  "remote.autoForwardPorts": false,
  "vibecode.sync.enabled": true,
  "vibecode.sync.mode": "automatic",
  "vibecode.sync.debounceMs": 500
}
```

### Performance Characteristics

| Operation | Target | Notes |
|-----------|--------|-------|
| Initial sync (1000 files) | <10s | First-time full sync |
| Incremental sync (1 file) | <2s | Single file change |
| Batch sync (10 files) | <5s | Multiple changes |
| Large file (10MB) | <3s | Binary/media files |

---

## Feature 6: Plugin Ecosystem

### Pre-installed VS Code Extensions

**Tier 1: Essential Development (included by default)**

1. **Continue** (Continue.continue)
   - AI pair programming with Claude/GPT
   - Version: 0.9.237
   - Size: 8MB

2. **SQLTools** (mtxr.sqltools)
   - PostgreSQL database management
   - Version: 0.28.3
   - Size: 5MB

3. **SQLTools PostgreSQL Driver** (mtxr.sqltools-driver-pg)
   - PostgreSQL connection support
   - Version: 0.5.4
   - Size: 2MB

4. **Redis Client** (cweijan.vscode-redis-client)
   - Valkey/Redis GUI client
   - Version: 4.7.0
   - Size: 6MB

5. **Prettier** (esbenp.prettier-vscode)
   - Code formatter
   - Version: 11.0.0
   - Size: 3MB

6. **ESLint** (dbaeumer.vscode-eslint)
   - JavaScript/TypeScript linter
   - Version: 3.0.13
   - Size: 2MB

7. **REST Client** (humao.rest-client)
   - API testing in VS Code
   - Version: 0.25.1
   - Size: 1MB

**Total Tier 1 Size:** ~27MB

**Tier 2: Language Support (install on demand)**

8. **Python** (ms-python.python)
   - Python IntelliSense, linting, debugging
   - Size: 12MB

9. **Go** (golang.go)
   - Go language support
   - Size: 5MB

10. **Rust Analyzer** (rust-lang.rust-analyzer)
    - Rust language server
    - Size: 8MB

11. **TypeScript Vue Plugin** (Vue.volar)
    - Vue.js support
    - Size: 4MB

12. **JavaScript and TypeScript Nightly** (ms-vscode.vscode-typescript-next)
    - Latest TS features
    - Size: 3MB

**Tier 3: Developer Experience**

13. **GitLens** (eamodio.gitlens)
    - Git supercharged
    - Size: 10MB

14. **Docker** (ms-azuretools.vscode-docker)
    - Docker management
    - Size: 5MB

15. **Markdown All in One** (yzhang.markdown-all-in-one)
    - Markdown authoring
    - Size: 1MB

16. **TODO Highlight** (wayou.vscode-todo-highlight)
    - Highlight TODOs in code
    - Size: 200KB

17. **Error Lens** (usernamehw.errorlens)
    - Inline error display
    - Size: 500KB

18. **Path Intellisense** (christian-kohler.path-intellisense)
    - Autocomplete filenames
    - Size: 100KB

19. **Bracket Pair Colorizer 2** (CoenraadS.bracket-pair-colorizer-2)
    - Colorize matching brackets
    - Size: 300KB

20. **Live Share** (ms-vsliveshare.vsliveshare)
    - Real-time collaboration
    - Size: 15MB

### Extension Marketplace Access

**Implementation Strategy:**

1. **Direct VSIX Download**
   - Pre-cache popular extensions in initramfs
   - Download on-demand from VS Code marketplace
   - Store in persistent volume /mnt/host/extensions

2. **Extension Update Mechanism**
   ```bash
   # Update all extensions
   /opt/openvscode/bin/openvscode-server --update-extensions

   # Install specific extension
   /opt/openvscode/bin/openvscode-server --install-extension publisher.extension-name
   ```

3. **Custom Extension Repository**
   - Host local extension registry
   - Faster downloads for team
   - Air-gapped environment support

### Language Servers

Pre-installed language servers for IntelliSense:

```bash
# TypeScript/JavaScript
npm install -g typescript typescript-language-server

# Python
pip install python-lsp-server[all]

# Go
go install golang.org/x/tools/gopls@latest

# Rust
rustup component add rust-analyzer

# Bash
npm install -g bash-language-server

# JSON/YAML
npm install -g vscode-json-languageserver yaml-language-server

# Docker
npm install -g dockerfile-language-server-nodejs

# SQL
pip install sql-language-server
```

---

## Feature 7: Database Development Tools

### PostgreSQL: pgAdmin 4

**Installation:**
```bash
# Add pgAdmin to initramfs during build
wget https://ftp.postgresql.org/pub/pgadmin/pgadmin4/v8.1/alpine/pgadmin4-8.1-py3-none-any.whl
pip install pgadmin4-8.1-py3-none-any.whl
```

**Configuration (`/etc/pgadmin/config_local.py`):**
```python
# pgAdmin configuration for development VM
DEFAULT_SERVER = '0.0.0.0'
DEFAULT_SERVER_PORT = 5050

# Development mode
DEBUG = True
CONSOLE_LOG_LEVEL = logging.INFO

# Default admin account
DEFAULT_USER = 'dev@vibecode.local'
MASTER_PASSWORD_REQUIRED = False

# PostgreSQL connection defaults
SERVER_MODE = True
DEFAULT_BINARY_PATHS = {
    'pg': '/usr/libexec/postgresql16'
}
```

**Auto-configure PostgreSQL connection:**
```json
{
  "Servers": {
    "1": {
      "Name": "Local PostgreSQL",
      "Group": "Servers",
      "Host": "localhost",
      "Port": 5432,
      "MaintenanceDB": "postgres",
      "Username": "postgres",
      "SSLMode": "prefer",
      "PassFile": "/var/lib/pgadmin/.pgpass"
    }
  }
}
```

**Access:** http://192.168.64.10:5050

### Valkey: Redis Commander

**Installation:**
```bash
# Add Redis Commander to initramfs
npm install -g redis-commander
```

**Configuration (`/etc/redis-commander/config.json`):**
```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "dbIndex": 0,
    "useScan": true
  },
  "server": {
    "address": "0.0.0.0",
    "port": 8081,
    "urlPrefix": ""
  },
  "ui": {
    "cliHeight": 50,
    "cliOpen": false,
    "locked": false,
    "jsonViewAsDefault": true
  },
  "noLogData": false,
  "noSave": false,
  "scanCount": 100
}
```

**Access:** http://192.168.64.10:8081

### Database Migration Tools

**PostgreSQL Migrations:**
```bash
# Install Flyway
wget https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/10.4.1/flyway-commandline-10.4.1-linux-arm64.tar.gz
tar xzf flyway-commandline-10.4.1-linux-arm64.tar.gz -C /opt

# Configure Flyway
cat > /mnt/host/config/flyway.conf << 'EOF'
flyway.url=jdbc:postgresql://localhost:5432/postgres
flyway.user=postgres
flyway.password=
flyway.locations=filesystem:/mnt/host/migrations
EOF

# Create sample migration
cat > /mnt/host/migrations/V1__initial_schema.sql << 'SQL'
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
SQL
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goals:**
- File synchronization working
- Basic hot reload for OpenVSCode
- SSH key-based authentication

**Deliverables:**
1. `azure/dev-tools-setup.sh` - Installs developer utilities
2. `azure/rsync-daemon-setup.sh` - Configures rsync server
3. `vibecode-sync.sh` - Host-side sync script
4. `.vscode/launch.json` - Debugging configurations

**Success Criteria:**
- File changes sync to VM in <2s
- OpenVSCode extensions reload without full rebuild
- SSH without password prompt

### Phase 2: Monitoring (Week 2)

**Goals:**
- Dev dashboard with live log streaming
- Resource monitoring graphs
- Service health checks

**Deliverables:**
1. `azure/dev-dashboard-api.go` - Dashboard backend
2. `azure/dev-dashboard.html` - Single-page frontend
3. `azure/log-aggregator.sh` - Multi-service log collector

**Success Criteria:**
- Dashboard accessible at http://192.168.64.10:9090
- Live logs from all 4 services
- CPU/Memory graphs updating every 1s

### Phase 3: Database Tools (Week 3)

**Goals:**
- pgAdmin for PostgreSQL
- Redis Commander for Valkey
- Database migration tools

**Deliverables:**
1. `azure/pgadmin-setup.sh` - pgAdmin installation
2. `azure/redis-commander-setup.sh` - Redis Commander setup
3. Migration tool configurations

**Success Criteria:**
- pgAdmin accessible at :5050
- Redis Commander at :8081
- Flyway migrations working

### Phase 4: Advanced Features (Week 4)

**Goals:**
- Remote debugging fully configured
- Extension marketplace access
- Performance optimization

**Deliverables:**
1. `.vscode/launch.json` - Complete debug configs
2. `azure/extension-installer.sh` - VS Code extensions
3. Performance tuning documentation

**Success Criteria:**
- Node.js breakpoint debugging working
- 20+ extensions pre-installed
- <30s hot reload time achieved

---

## Performance Impact Analysis

### Initramfs Size Growth

| Component | Size | Cumulative | Impact |
|-----------|------|------------|--------|
| Base system | 65MB | 65MB | Baseline |
| Developer utilities | 15MB | 80MB | +23% |
| pgAdmin | 25MB | 105MB | +31% |
| Redis Commander | 5MB | 110MB | +5% |
| Language servers | 10MB | 120MB | +9% |
| VS Code extensions | 30MB | 150MB | +25% |
| **Total** | **150MB** | **150MB** | **+131%** |

**Mitigation:**
- Use Alpine packages (smaller than Ubuntu)
- Strip debug symbols from binaries
- Compress with gzip -9
- Store extensions in persistent volume

### Boot Time Impact

| Service | Current | With Dev Tools | Delta |
|---------|---------|----------------|-------|
| Network init | 10s | 10s | 0s |
| Services start | 42s | 45s | +3s |
| Dev tools init | 0s | 10s | +10s |
| **Total** | **52s** | **65s** | **+13s** |

**Mitigation:**
- Lazy-load dev tools (start on demand)
- Parallel service startup
- Skip dev tools in production mode

### Memory Usage

| Service | Base | With Dev Tools | Delta |
|---------|------|----------------|-------|
| OpenVSCode | 245MB | 280MB | +35MB |
| PostgreSQL | 180MB | 180MB | 0MB |
| Valkey | 45MB | 45MB | 0MB |
| pgAdmin | 0MB | 120MB | +120MB |
| Redis Commander | 0MB | 50MB | +50MB |
| Dev Dashboard | 0MB | 30MB | +30MB |
| **Total** | **470MB** | **705MB** | **+235MB** |

**Recommendation:** Increase VM memory from 2GB to 4GB for development mode.

---

## Security Considerations

### 1. SSH Key Authentication

```bash
# Disable password authentication in production
cat >> /etc/ssh/sshd_config << EOF
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
EOF
```

### 2. Database Access Control

```sql
-- Restrict PostgreSQL to localhost in production
ALTER SYSTEM SET listen_addresses = 'localhost';

-- Require SSL for remote connections
ALTER SYSTEM SET ssl = on;
```

### 3. Network Isolation

```bash
# Firewall rules for development mode
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -s 192.168.64.0/24 -j ACCEPT
iptables -A INPUT -j DROP
```

### 4. File Sync Permissions

```bash
# Restrict rsync to specific directories
chroot = yes
uid = nobody
gid = nogroup
read only = false
```

---

## Testing Strategy

### 1. Hot Reload Tests

```bash
# Test 1: Single file change
echo "console.log('test');" >> /mnt/host/sync/test.js
# Expected: OpenVSCode reloads in <15s

# Test 2: Multiple file changes
touch /mnt/host/sync/{a,b,c}.js
# Expected: Batched reload in <20s

# Test 3: Config file change
sed -i 's/port = 5432/port = 5433/' /mnt/host/config/postgresql.conf
# Expected: PostgreSQL reloads in <5s
```

### 2. Debugging Tests

```bash
# Test 1: Node.js breakpoint
# Set breakpoint in VS Code
# Trigger code path
# Expected: Debugger pauses at breakpoint

# Test 2: PostgreSQL function debugging
psql -c "SELECT my_debug_function();"
# Expected: pgAdmin debugger activates
```

### 3. File Sync Tests

```bash
# Test 1: Push sync
vibecode-sync.sh ~/myproject push
# Expected: Files sync in <10s

# Test 2: Watch sync
vibecode-sync.sh ~/myproject watch &
touch ~/myproject/test.txt
# Expected: File appears in VM in <2s

# Test 3: Pull sync
vibecode-sync.sh ~/myproject pull
# Expected: VM changes pulled to host
```

### 4. Performance Tests

```bash
# Test 1: Dashboard response time
curl -w "@curl-format.txt" http://192.168.64.10:9090/api/status
# Expected: <100ms

# Test 2: Log streaming latency
# Generate log entry
# Check dashboard
# Expected: Appears in <1s

# Test 3: Resource monitor accuracy
# Compare dashboard metrics with `htop`
# Expected: <5% variance
```

---

## Documentation Deliverables

### 1. AGENT-Y-QUICK-SETUP.md

Quick start guide for developers:
- Install host-side tools
- Connect to VM
- Run first hot reload
- Open dev dashboard
- Configure debugging

### 2. AGENT-Y-IMPLEMENTATION-GUIDE.md

Step-by-step implementation:
- Build script modifications
- Service configuration
- Network setup
- Testing procedures

### 3. .vscode/launch.json

Pre-configured debug configs:
- OpenVSCode Node.js debugging
- PostgreSQL plpgsql debugging
- Remote shell debugging

### 4. API Documentation

Dev dashboard API endpoints:
- GET /api/status - Service health
- GET /api/logs - Log streaming
- POST /api/restart/:service - Restart service
- WebSocket /ws - Real-time updates

---

## Success Metrics

| Metric | Current | Target | Success Criteria |
|--------|---------|--------|------------------|
| Code change to reload | 8 min | <30s | 94% improvement |
| File sync latency | N/A | <2s | Real-time feel |
| Debug setup time | 30 min | <5 min | 83% reduction |
| Service visibility | 0% | 100% | Live dashboard |
| Developer utilities | 5 | 25+ | 400% increase |
| VS Code extensions | 7 | 20+ | 186% increase |
| Database GUI access | CLI only | Full GUI | pgAdmin + Commander |
| Hot reload success rate | 0% | 95% | Production ready |

---

## Risk Mitigation

### Risk 1: Increased Boot Time

**Mitigation:**
- Lazy-load dev tools
- Production mode flag (skip dev services)
- Parallel initialization

### Risk 2: Memory Pressure

**Mitigation:**
- Increase VM memory to 4GB in dev mode
- Make dev tools optional
- Monitor memory usage with dashboard

### Risk 3: File Sync Conflicts

**Mitigation:**
- .gitignore-style exclusion rules
- Conflict detection and resolution
- Bi-directional sync with merge strategy

### Risk 4: Security Exposure

**Mitigation:**
- Dev mode only (not for production)
- Firewall rules
- SSH key authentication
- Network isolation

---

## Conclusion

This developer experience enhancement transforms the unified services VM from a production-ready system into a developer productivity powerhouse. By adding hot reload, remote debugging, live monitoring, file synchronization, and comprehensive tooling, we reduce development iteration time by 94% (from 8 minutes to <30 seconds).

The modular design allows developers to enable only the features they need, keeping the system lean for production deployments while providing rich tooling for development.

**Next Steps:**
1. Review this design document
2. Prioritize features (recommend Phase 1 first)
3. Implement and test each phase
4. Gather developer feedback
5. Iterate and improve

**Estimated Implementation:** 4 weeks (1 week per phase)

**Team Required:** 1-2 developers

**Expected ROI:** 10-15 hours/week saved per developer

---

**Agent Y - Developer Experience Enhancement**
**Status:** DESIGN COMPLETE
**Next:** Implementation Phase 1
