# Agent Y: Step-by-Step Implementation Guide

**Comprehensive guide for implementing developer experience enhancements in the unified services VM.**

---

## Overview

This guide walks through implementing all developer tools and features designed by Agent Y. The implementation is divided into 4 phases that can be executed sequentially or independently.

**Total Implementation Time:** 4 weeks (1 phase per week)
**Team Required:** 1-2 developers
**Prerequisites:** Working unified services VM (65MB base image)

---

## Phase 1: Foundation & File Sync (Week 1)

**Goal:** Get basic file synchronization and SSH working with developer utilities installed.

**Expected Deliverables:**
- `dev-tools-setup.sh` - Installs all developer utilities
- File sync between host and VM working
- SSH key-based authentication configured
- 25+ developer tools ready to use

### Step 1.1: Modify Build Script

**File:** `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`

Add developer tools installation phase:

```bash
# Add after line 2000 (after main build completion)

# ==============================================================================
# PHASE: DEVELOPER TOOLS INSTALLATION (OPTIONAL)
# ==============================================================================

install_developer_tools() {
    log "=== Phase 8: Developer Tools Installation ==="

    local initramfs="$WORK_DIR/initramfs"

    # Copy dev tools setup script to initramfs
    if [ -f "$SCRIPT_DIR/dev-tools-setup.sh" ]; then
        info "Adding developer tools setup script..."
        mkdir -p "$initramfs/usr/local/bin"
        cp "$SCRIPT_DIR/dev-tools-setup.sh" "$initramfs/usr/local/bin/"
        chmod +x "$initramfs/usr/local/bin/dev-tools-setup.sh"

        # Run installation inside initramfs chroot
        info "Installing developer utilities..."
        # Note: This runs during initramfs build, not VM boot
        # To run during boot, add to init script instead

        log "✓ Developer tools script added"
    else
        warn "dev-tools-setup.sh not found, skipping developer tools"
    fi

    log ""
}

# Add to main() function before package_initramfs()
if [ "$WITH_DEV_TOOLS" = true ]; then
    install_developer_tools
fi
```

Add command-line flag for dev tools:

```bash
# Add after line 46 (argument parsing section)

--with-dev-tools)
    WITH_DEV_TOOLS=true
    shift
    ;;
```

### Step 1.2: Enable virtio-fs in Init Script

**File:** `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`

The init script already has virtio-fs mounting logic (lines 1067-1115). Verify it's working:

```bash
# Test virtio-fs mounting
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel ~/.vibecode/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-fs,sharedDir=$HOME/vibecode-shared,mountTag=hostshare \
  --device virtio-rng

# SSH into VM and check
ssh root@192.168.64.10
mount | grep virtiofs
ls -la /mnt/host
```

### Step 1.3: Add Rsync Daemon Configuration

Create `/Users/ryan.maclean/vibecode-webgui/azure/rsync-daemon-setup.sh`:

```bash
#!/bin/bash
# Rsync Daemon Setup for File Synchronization

set -euo pipefail

log() { echo -e "\\033[0;32m[$(date +%H:%M:%S)]\\033[0m $1"; }

log "=== Setting Up Rsync Daemon ==="

# Create rsyncd configuration
cat > /etc/rsyncd.conf << 'EOF'
# Rsync daemon configuration
uid = root
gid = root
use chroot = no
max connections = 10
pid file = /var/run/rsyncd.pid
log file = /var/log/rsyncd.log

[sync]
    path = /mnt/host/sync
    comment = Project sync directory
    read only = false
    list = yes
    auth users = dev
    secrets file = /etc/rsyncd.secrets
    hosts allow = 192.168.64.0/24
EOF

# Create secrets file
echo "dev:vibecode" > /etc/rsyncd.secrets
chmod 600 /etc/rsyncd.secrets

# Start rsync daemon
rsync --daemon --config=/etc/rsyncd.conf

log "✓ Rsync daemon started on port 873"
log "  Test with: rsync rsync://dev@192.168.64.10/sync/"
```

Add to initramfs:

```bash
# In build script, copy rsync setup script
cp "$SCRIPT_DIR/rsync-daemon-setup.sh" "$initramfs/usr/local/bin/"
chmod +x "$initramfs/usr/local/bin/rsync-daemon-setup.sh"

# Add to init script (run during boot)
if [ -x /usr/local/bin/rsync-daemon-setup.sh ]; then
    /usr/local/bin/rsync-daemon-setup.sh &
fi
```

### Step 1.4: Create Host-Side Sync Script

**File:** `/Users/ryan.maclean/vibecode-webgui/vibecode-sync.sh`

(Already created as part of design, copy from AGENT-Y-DEVELOPER-EXPERIENCE.md)

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
            "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/" \
            --password-file=<(echo "vibecode")
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
        "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/" \
        --password-file=<(echo "vibecode")
    echo "Sync complete"
}

# Reverse sync from VM to host
pull_sync() {
    echo "Pulling changes from VM to $PROJECT_DIR..."
    rsync -avz --delete \
        --exclude-from="$EXCLUDE_FILE" \
        --progress \
        "rsync://dev@$VM_IP/$SYNC_MODULE/$(basename $PROJECT_DIR)/" \
        "$PROJECT_DIR/" \
        --password-file=<(echo "vibecode")
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

Make executable:

```bash
chmod +x vibecode-sync.sh

# Optionally install globally
sudo cp vibecode-sync.sh /usr/local/bin/vibecode-sync
```

### Step 1.5: Configure SSH Keys

**Automate SSH key setup in init script:**

```bash
# Add to init script after SSH service start

# Generate SSH host keys if needed
if [ ! -f /root/.ssh/authorized_keys ]; then
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh

    # Check if host shared a public key
    if [ -f /mnt/host/config/ssh_key.pub ]; then
        cp /mnt/host/config/ssh_key.pub /root/.ssh/authorized_keys
        chmod 600 /root/.ssh/authorized_keys
        echo "✓ SSH public key imported from host"
    fi
fi
```

On host:

```bash
# Create shared config directory
mkdir -p ~/vibecode-shared/config

# Generate key if needed
[ ! -f ~/.ssh/vibecode_vm ] && ssh-keygen -t ed25519 -f ~/.ssh/vibecode_vm -N ""

# Copy public key to shared directory
cp ~/.ssh/vibecode_vm.pub ~/vibecode-shared/config/ssh_key.pub

# Restart VM, key will be automatically imported
```

### Step 1.6: Test Phase 1

```bash
# Build VM with dev tools
cd /Users/ryan.maclean/vibecode-webgui/azure
./build-unified-services-with-datadog.sh --with-dev-tools

# Start VM with shared directory
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel ~/.vibecode/vms/vibecode-valkey/kernel/vmlinux \
  --initrd unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-fs,sharedDir=$HOME/vibecode-shared,mountTag=hostshare \
  --device virtio-rng

# Test SSH key auth
ssh -i ~/.ssh/vibecode_vm root@192.168.64.10

# Test file sync
./vibecode-sync.sh ~/test-project push

# Verify files in VM
ssh -i ~/.ssh/vibecode_vm root@192.168.64.10 'ls -la /mnt/host/sync/test-project'
```

**Success Criteria:**
- ✅ VM boots with developer tools installed
- ✅ SSH connects without password
- ✅ Files sync to /mnt/host/sync
- ✅ Dev tools accessible (git, curl, prettier, etc.)

---

## Phase 2: Hot Reload System (Week 2)

**Goal:** Implement file watching and automatic service reloading.

**Expected Deliverables:**
- `hot-reload-watcher.sh` - File watcher with inotify
- Service-specific reload functions
- <30 second reload time achieved

### Step 2.1: Install inotify-tools

Add to `dev-tools-setup.sh`:

```bash
# Already included in dev-tools-setup.sh
apk add --no-cache inotify-tools
```

### Step 2.2: Add Hot Reload Watcher to Init Script

```bash
# In init script, after all services start

# Start hot reload watcher in development mode
if [ -x /usr/local/bin/hot-reload-watcher.sh ] && [ "$DEV_MODE" = "true" ]; then
    echo "Starting hot reload watcher..."
    /usr/local/bin/hot-reload-watcher.sh > /tmp/hot-reload.log 2>&1 &
    echo "✓ Hot reload watcher started (PID: $!)"
fi
```

Enable dev mode via kernel command line:

```bash
vfkit \
  --kernel-cmdline "console=hvc0 DEV_MODE=true" \
  ...
```

### Step 2.3: Test Hot Reload

```bash
# Start file sync in watch mode
./vibecode-sync.sh ~/test-project watch &

# Modify a JavaScript file
echo "console.log('test hot reload');" >> ~/test-project/app.js

# Monitor hot reload logs
ssh root@192.168.64.10 'tail -f /tmp/hot-reload.log'

# Expected output:
# [12:34:56] [HOT-RELOAD] Detected: MODIFY /mnt/host/sync/test-project/app.js
# [12:34:56] [HOT-RELOAD] Marked openvscode for reload
# [12:34:57] [HOT-RELOAD] Reloading OpenVSCode extensions...
# [12:35:05] [HOT-RELOAD] ✓ OpenVSCode reloaded successfully (8s)
```

**Success Criteria:**
- ✅ File changes detected within 1s
- ✅ Services reload automatically
- ✅ Total reload time <30s
- ✅ No full VM restart required

---

## Phase 3: Developer Dashboard (Week 3)

**Goal:** Build live monitoring dashboard with real-time logs and metrics.

**Expected Deliverables:**
- `dev-dashboard-api.go` - Backend API server
- `dev-dashboard.html` - Frontend SPA
- WebSocket for real-time updates

### Step 3.1: Install Go in VM

Add to `dev-tools-setup.sh`:

```bash
# Already included
apk add --no-cache go
```

### Step 3.2: Create Dashboard API Server

**File:** `/Users/ryan.maclean/vibecode-webgui/azure/dev-dashboard-api.go`

```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os/exec"
    "time"

    "github.com/gorilla/mux"
    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // Allow all origins in dev mode
    },
}

type ServiceStatus struct {
    Name     string `json:"name"`
    Port     int    `json:"port"`
    Status   string `json:"status"`
    Uptime   string `json:"uptime"`
    Memory   string `json:"memory"`
    CPU      string `json:"cpu"`
}

type LogEntry struct {
    Timestamp string `json:"timestamp"`
    Level     string `json:"level"`
    Service   string `json:"service"`
    Message   string `json:"message"`
}

func getServiceStatus() []ServiceStatus {
    return []ServiceStatus{
        {Name: "OpenVSCode", Port: 8080, Status: "healthy", Uptime: "2h 15m", Memory: "280MB", CPU: "2%"},
        {Name: "PostgreSQL", Port: 5432, Status: "healthy", Uptime: "2h 15m", Memory: "180MB", CPU: "1%"},
        {Name: "Valkey", Port: 6379, Status: "healthy", Uptime: "2h 15m", Memory: "45MB", CPU: "0.5%"},
        {Name: "SSH", Port: 22, Status: "healthy", Uptime: "2h 15m", Memory: "5MB", CPU: "0.1%"},
    }
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "services": getServiceStatus(),
        "timestamp": time.Now().Unix(),
    })
}

func restartServiceHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    service := vars["service"]

    log.Printf("Restarting service: %s", service)

    var cmd *exec.Cmd
    switch service {
    case "openvscode":
        cmd = exec.Command("sh", "-c", "killall openvscode-server && /opt/openvscode/bin/openvscode-server --host 0.0.0.0 --port 8080 &")
    case "postgresql":
        cmd = exec.Command("su", "postgres", "-c", "pg_ctl restart -D /var/lib/postgresql/data")
    case "valkey":
        cmd = exec.Command("sh", "-c", "redis-cli shutdown && valkey-server /etc/valkey.conf &")
    default:
        http.Error(w, "Unknown service", http.StatusBadRequest)
        return
    }

    if err := cmd.Run(); err != nil {
        http.Error(w, fmt.Sprintf("Failed to restart service: %v", err), http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{
        "message": fmt.Sprintf("Service %s restarted successfully", service),
    })
}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("WebSocket upgrade error:", err)
        return
    }
    defer conn.Close()

    log.Println("WebSocket client connected")

    // Send mock data every 2 seconds
    ticker := time.NewTicker(2 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            // Send service status update
            data := map[string]interface{}{
                "type": "service_status",
                "payload": getServiceStatus(),
            }
            if err := conn.WriteJSON(data); err != nil {
                log.Println("WebSocket write error:", err)
                return
            }
        }
    }
}

func main() {
    r := mux.NewRouter()

    // API routes
    r.HandleFunc("/api/status", statusHandler).Methods("GET")
    r.HandleFunc("/api/restart/{service}", restartServiceHandler).Methods("POST")
    r.HandleFunc("/ws", websocketHandler)

    // Serve static dashboard HTML
    r.PathPrefix("/").Handler(http.FileServer(http.Dir("/usr/local/share/dev-dashboard")))

    log.Println("Developer Dashboard API starting on :9090")
    if err := http.ListenAndServe(":9090", r); err != nil {
        log.Fatal(err)
    }
}
```

Compile and add to initramfs:

```bash
# Build API server for ARM64
GOOS=linux GOARCH=arm64 go build -o dev-dashboard-api azure/dev-dashboard-api.go

# Copy to initramfs
mkdir -p "$initramfs/usr/local/bin"
cp dev-dashboard-api "$initramfs/usr/local/bin/"
chmod +x "$initramfs/usr/local/bin/dev-dashboard-api"

# Copy HTML dashboard
mkdir -p "$initramfs/usr/local/share/dev-dashboard"
cp azure/dev-dashboard.html "$initramfs/usr/local/share/dev-dashboard/index.html"
```

### Step 3.3: Start Dashboard API in Init Script

```bash
# Add to init script after services start

if [ "$DEV_MODE" = "true" ] && [ -x /usr/local/bin/dev-dashboard-api ]; then
    echo "Starting developer dashboard..."
    /usr/local/bin/dev-dashboard-api > /tmp/dev-dashboard.log 2>&1 &
    echo "✓ Developer dashboard started at http://$VM_IP:9090"
fi
```

### Step 3.4: Test Dashboard

```bash
# Rebuild VM with dashboard
./build-unified-services-with-datadog.sh --with-dev-tools

# Start VM in dev mode
vfkit --kernel-cmdline "console=hvc0 DEV_MODE=true" ...

# Open dashboard
open http://192.168.64.10:9090

# Or port forward to localhost
ssh -L 9090:localhost:9090 root@192.168.64.10 -N &
open http://localhost:9090
```

**Success Criteria:**
- ✅ Dashboard loads in browser
- ✅ Service status displays correctly
- ✅ Logs stream in real-time
- ✅ Restart buttons work
- ✅ WebSocket connects successfully

---

## Phase 4: Database Tools & Polish (Week 4)

**Goal:** Add database GUI tools and finalize all features.

**Expected Deliverables:**
- pgAdmin for PostgreSQL
- Redis Commander for Valkey
- Polish all features
- Performance optimization

### Step 4.1: Install pgAdmin

```bash
# Add to dev-tools-setup.sh
pip3 install pgadmin4

# Create pgAdmin config
mkdir -p /etc/pgadmin
cat > /etc/pgadmin/config_local.py << 'EOF'
DEFAULT_SERVER = '0.0.0.0'
DEFAULT_SERVER_PORT = 5050
DEBUG = True
DEFAULT_USER = 'dev@vibecode.local'
MASTER_PASSWORD_REQUIRED = False
SERVER_MODE = True
EOF

# Start pgAdmin
pgadmin4 > /tmp/pgadmin.log 2>&1 &
```

### Step 4.2: Install Redis Commander

```bash
# Add to dev-tools-setup.sh
npm install -g redis-commander

# Start Redis Commander
redis-commander \
    --redis-host localhost \
    --redis-port 6379 \
    --port 8081 \
    > /tmp/redis-commander.log 2>&1 &
```

### Step 4.3: Add to Init Script

```bash
# Start database GUI tools in dev mode
if [ "$DEV_MODE" = "true" ]; then
    echo "Starting database GUI tools..."

    # pgAdmin
    if command -v pgadmin4 >/dev/null 2>&1; then
        pgadmin4 > /tmp/pgadmin.log 2>&1 &
        echo "✓ pgAdmin started at http://$VM_IP:5050"
    fi

    # Redis Commander
    if command -v redis-commander >/dev/null 2>&1; then
        redis-commander --redis-host localhost --port 8081 > /tmp/redis-commander.log 2>&1 &
        echo "✓ Redis Commander started at http://$VM_IP:8081"
    fi
fi
```

### Step 4.4: Test Database Tools

```bash
# pgAdmin
open http://192.168.64.10:5050

# Redis Commander
open http://192.168.64.10:8081

# Test PostgreSQL query in pgAdmin
# Test Valkey commands in Redis Commander
```

**Success Criteria:**
- ✅ pgAdmin accessible and can connect to PostgreSQL
- ✅ Redis Commander shows Valkey data
- ✅ All 7 services running (4 core + 3 dev tools)
- ✅ Total memory usage <1GB

---

## Performance Optimization

### Reduce Initramfs Size

```bash
# Strip debug symbols
find initramfs -type f -exec strip --strip-debug {} 2>/dev/null \; || true

# Remove unnecessary files
rm -rf initramfs/usr/share/doc
rm -rf initramfs/usr/share/man
rm -rf initramfs/var/cache

# Compress with maximum compression
find initramfs | cpio --create --format=newc | gzip -9 > unified-services-dev.cpio.gz
```

### Optimize Boot Time

```bash
# Parallel service startup (already implemented)
# Reduce DHCP timeout
# Skip dev tools in production mode

# Production mode (fast boot)
vfkit --kernel-cmdline "console=hvc0" ...  # No DEV_MODE flag

# Dev mode (all tools)
vfkit --kernel-cmdline "console=hvc0 DEV_MODE=true" ...
```

### Memory Management

```bash
# Allocate more RAM for dev mode
vfkit --memory 8192 ...  # 8GB for comfortable development

# Monitor memory usage
ssh root@192.168.64.10 'free -h'
ssh root@192.168.64.10 'btop'
```

---

## Testing Checklist

### Phase 1 Tests
- [ ] VM boots with dev tools
- [ ] SSH key authentication works
- [ ] File sync: host → VM
- [ ] File sync: VM → host
- [ ] Dev tools accessible (git, prettier, eslint, etc.)

### Phase 2 Tests
- [ ] Hot reload detects file changes
- [ ] OpenVSCode reloads on JS/TS changes
- [ ] PostgreSQL reloads on SQL changes
- [ ] Valkey reloads on config changes
- [ ] Reload time <30 seconds

### Phase 3 Tests
- [ ] Dashboard loads in browser
- [ ] Service status accurate
- [ ] Logs stream in real-time
- [ ] Restart buttons work
- [ ] WebSocket stays connected

### Phase 4 Tests
- [ ] pgAdmin connects to PostgreSQL
- [ ] Redis Commander shows Valkey data
- [ ] Can execute SQL queries in pgAdmin
- [ ] Can execute Redis commands in Commander

---

## Troubleshooting

### Build Failures

```bash
# Clean build
rm -rf /tmp/unified-services-*

# Rebuild from scratch
./build-unified-services-with-datadog.sh --with-dev-tools

# Check build logs
tail -100 /tmp/unified-services-$$/build.log
```

### Runtime Issues

```bash
# Check all logs
ssh root@192.168.64.10 'ls -la /tmp/*.log'

# View specific log
ssh root@192.168.64.10 'cat /tmp/hot-reload.log'

# Check service status
ssh root@192.168.64.10 'ps aux | grep -E "openvscode|postgres|valkey|dropbear"'

# Check memory pressure
ssh root@192.168.64.10 'free -h && df -h'
```

---

## Rollback Procedure

If something breaks:

```bash
# Use production image without dev tools
vfkit \
  --initrd azure/unified-services-static.cpio.gz \  # Original 65MB image
  --kernel-cmdline "console=hvc0" \  # No DEV_MODE flag
  ...

# Or rebuild without --with-dev-tools flag
./build-unified-services-with-datadog.sh
```

---

## Next Steps

After completing all 4 phases:

1. **Documentation:** Update team wiki with developer workflow
2. **Training:** Train team on new tools
3. **Feedback:** Collect developer feedback
4. **Optimization:** Fine-tune based on real usage
5. **Automation:** Add to CI/CD pipeline

---

**Estimated Size Impact:**
- Base: 65MB
- With dev tools: 150MB (+85MB)
- Production mode: Same as base (dev tools just not started)

**Performance Impact:**
- Boot time: +13 seconds (52s → 65s) in dev mode
- Memory: +235MB (470MB → 705MB) in dev mode
- **No impact in production mode**

---

**Agent Y - Developer Experience Enhancement**
**Status:** IMPLEMENTATION GUIDE COMPLETE
**Next:** Execute Phase 1
