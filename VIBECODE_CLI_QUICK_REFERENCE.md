# VibeCode CLI - Quick Reference Card

**Version:** 3.2.0

---

## Installation

```bash
./install-vibecode-cli.sh        # System-wide (requires sudo)
./install-vibecode-cli.sh --user # User install (~/.local/bin)
```

---

## Essential Commands

| Command | Description |
|---------|-------------|
| `vibecode build` | Build the menubar app |
| `vibecode start` | Start VibeCode VM |
| `vibecode stop` | Stop VibeCode VM |
| `vibecode restart` | Restart VM |
| `vibecode status` | Full status report |
| `vibecode check` | Check all services |
| `vibecode help` | Show help |

---

## Service Commands

| Command | Description |
|---------|-------------|
| `vibecode services` | List all services with ports |
| `vibecode ssh` | SSH into VM (interactive) |
| `vibecode docker` | Check Docker status |
| `vibecode ip` | Show VM IP address |
| `vibecode logs` | Show VM console logs |

---

## Services & Ports

| Service | Port | Access |
|---------|------|--------|
| SSH | 2222 | `ssh root@localhost -p 2222` |
| Valkey | 6379 | `valkey-cli -h localhost -p 6379` |
| PostgreSQL | 5432 | `psql -h localhost -p 5432 -U postgres` |
| OpenVSCode | 8080 | http://localhost:8080 |
| Docker | 2375 | `export DOCKER_HOST=tcp://localhost:2375` |

**Default password:** `vibecode`

---

## Quick Start

```bash
# 1. Build
vibecode build

# 2. Start
vibecode start

# 3. Wait for boot (1-2 minutes)
sleep 120

# 4. Check services
vibecode check

# 5. Open OpenVSCode
open http://localhost:8080
```

---

## Common Workflows

### Development Setup

```bash
vibecode start
vibecode ssh
# In VM: install packages, configure services
exit
vibecode services  # Verify all services
```

### Docker Usage

```bash
vibecode docker
export DOCKER_HOST=tcp://localhost:2375
docker ps
docker run hello-world
```

### Database Access

```bash
# Valkey
valkey-cli -h localhost -p 6379 ping

# PostgreSQL
psql -h localhost -p 5432 -U postgres -c "SELECT version();"
```

### Status Monitoring

```bash
# Quick check
vibecode check

# Full status
vibecode status

# Continuous monitoring
watch -n 5 vibecode status
```

---

## Troubleshooting

### VM Won't Start

```bash
# Check if already running
vibecode status

# Kill and restart
pkill -f UnifiedServicesVibeCode
vibecode start
```

### Services Not Available

```bash
# Wait for boot
sleep 120
vibecode check

# Check specific service
nc -zv localhost 2222  # SSH
nc -zv localhost 6379  # Valkey
nc -zv localhost 5432  # PostgreSQL
curl -I http://localhost:8080  # OpenVSCode
```

### Build Fails

```bash
# Check Swift
swift --version

# Manual build
cd azure/SwiftUI-Apps
./build-unified-menubar.sh
```

---

## Tips & Tricks

### Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias vc='vibecode'
alias vcs='vibecode status'
alias vcc='vibecode check'
alias vcr='vibecode restart'
alias vcssh='vibecode ssh'
```

### Auto-start on Boot

Create LaunchAgent:

```xml
<!-- ~/Library/LaunchAgents/com.vibecode.startup.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.startup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/vibecode</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Load with:
```bash
launchctl load ~/Library/LaunchAgents/com.vibecode.startup.plist
```

### Environment Setup

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Docker
export DOCKER_HOST=tcp://localhost:2375

# PostgreSQL
export PGHOST=localhost
export PGPORT=5432
export PGUSER=postgres

# Valkey/Redis
export REDIS_URL=redis://localhost:6379
```

### Monitoring Script

```bash
#!/bin/bash
# monitor.sh - Monitor VibeCode services

while true; do
    clear
    date
    echo ""
    vibecode status
    sleep 10
done
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOCKER_HOST` | Docker daemon address | `tcp://localhost:2375` |
| `VIBECODE_PROJECT_ROOT` | Override project root | `/path/to/project` |
| `VIBECODE_APP_PATH` | Override app path | `/path/to/app` |

---

## Files & Directories

| Path | Description |
|------|-------------|
| `/usr/local/bin/vibecode` | CLI executable (system-wide) |
| `~/.local/bin/vibecode` | CLI executable (user) |
| `~/Library/Application Support/VibeCode/vm-data/` | VM persistent data |
| `~/Library/Logs/VibeCode/` | VM logs (if available) |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Misuse of command |

---

## Getting Help

```bash
vibecode help              # Show help
vibecode --help            # Same as help
vibecode version           # Show version
vibecode <cmd> --help      # Command-specific help (future)
```

---

## Resources

- **User Guide:** `VIBECODE_CLI_GUIDE.md`
- **Developer Docs:** `VIBECODE_CLI_DEVELOPMENT.md`
- **Repository:** https://github.com/ryanmaclean/vibecode-webgui

---

**Last Updated:** 2026-01-14
