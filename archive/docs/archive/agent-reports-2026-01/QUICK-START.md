# VibeCode VM - Quick Start

## Installation (One-Time)

```bash
# 1. Install vfkit
brew install vfkit

# 2. Run installer
./install.sh

# 3. Restart shell or run:
export PATH="$HOME/.local/bin:$PATH"
```

## Daily Usage

```bash
# Start VM
vibecode-vm start

# Check status
vibecode-vm status

# SSH access
vibecode-vm ssh
# Password: vibecode

# Stop VM
vibecode-vm stop
```

## Service Access

Get VM IP from status, then:

| Service | Access |
|---------|--------|
| **SSH** | `ssh root@<VM_IP>` (password: vibecode) |
| **OpenVSCode** | `http://<VM_IP>:8080` (in browser) |
| **Valkey** | `redis-cli -h <VM_IP> -p 6379` |
| **PostgreSQL** | `psql -h <VM_IP> -p 5432 -U postgres` |

## Shared Files

- **Host**: `~/vibecode-shared/`
- **VM**: `/mnt/host/`

## Common Commands

```bash
vibecode-vm start              # Start VM
vibecode-vm stop               # Stop VM
vibecode-vm restart            # Restart VM
vibecode-vm status             # Show status
vibecode-vm ssh                # SSH into VM
vibecode-vm logs               # View console
vibecode-vm logs -f            # Follow console
vibecode-vm config show        # Show config
vibecode-vm config edit        # Edit config
vibecode-vm help               # Show help
```

## Custom Resources

```bash
# Start with 4 CPUs and 4GB RAM
vibecode-vm start --cpus 4 --memory 4096

# Or edit config permanently
vibecode-vm config edit
# Set VM_CPUS=4 and VM_MEMORY=4096
vibecode-vm restart
```

## Troubleshooting

```bash
# Check logs
vibecode-vm logs

# Check vfkit logs
cat ~/.vibecode-vm/vfkit.log

# Verify installation
vibecode-vm version
vibecode-vm config show
```

## File Locations

```
~/.vibecode-vm/          # Installation
~/.local/bin/vibecode-vm # Launcher
~/vibecode-shared/       # Shared directory
```

## For More Help

See full guide: `UNIFIED-TOOL-GUIDE.md`
