# VibeCode VM Management

Easy VM orchestration for VibeCode's vfkit-based infrastructure.

## Quick Start

```bash
# Start all VMs
./vm-manager.sh start-all

# Check status
./vm-manager.sh list

# Run tests
./test-all-vms.sh

# Stop all VMs
./vm-manager.sh stop-all
```

## VMs

| VM | Port | Memory | Purpose |
|----|------|--------|---------|
| **valkey** | 6379 | 1GB | In-memory cache (Redis-compatible) |
| **postgresql** | 5432 | 2GB | Database with pgvector |
| **nodejs-dev** | 3000, 5173, 8080 | 4GB | Node.js development environment |

## Commands

```bash
# Individual VMs
./vm-manager.sh start valkey
./vm-manager.sh stop postgresql
./vm-manager.sh restart nodejs-dev
./vm-manager.sh status valkey

# All VMs
./vm-manager.sh start-all
./vm-manager.sh stop-all
./vm-manager.sh list

# Logs
./vm-manager.sh logs valkey 100
./vm-manager.sh follow nodejs-dev

# Health & Monitoring
./vm-manager.sh health
./vm-manager.sh monitor

# Testing
./test-valkey.sh
./test-postgresql.sh
./test-nodejs-dev.sh
./test-all-vms.sh
```

## Connecting to Services

### Valkey (Redis)
```bash
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping
```

### PostgreSQL
```bash
psql postgresql://vibecode:vibecode@localhost:5432/vibecode
```

### Node.js
```bash
curl http://localhost:3000/health
```

## Documentation

- **[VM_MANAGEMENT.md](../../docs/VM_MANAGEMENT.md)** - Complete guide
- **[EXAMPLES.md](./EXAMPLES.md)** - Quick examples and patterns

## Troubleshooting

```bash
# Check status
./vm-manager.sh list

# View logs
./vm-manager.sh logs valkey 100

# Restart if stuck
./vm-manager.sh restart valkey

# Full reset
./vm-manager.sh stop-all
rm ~/.vibecode/vm-pids/*.pid
./vm-manager.sh start-all
```

## Directory Structure

```
~/.vibecode/
├── vm-logs/          # VM output logs
├── vm-pids/          # Process ID files
└── vm-state/         # State tracking
```

## Requirements

- macOS ARM64 (Apple Silicon)
- vfkit v0.6.1 (included in `src-tauri/resources/`)
- Optional tools for testing:
  - `redis-cli` (brew install redis)
  - `psql` (brew install postgresql)
  - `jq` (brew install jq)

## License

Part of the VibeCode project.

VM software:
- vfkit: Apache 2.0
- Valkey: BSD-3-Clause
- PostgreSQL: PostgreSQL License
- Node.js: MIT
