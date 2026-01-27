# VibeCode VM Management

Easy VM orchestration for VibeCode's vfkit-based infrastructure.

## Quick Start

```bash
# Start all VMs
python scripts/vfkit/vm-manager.py start-all

# Check status
python scripts/vfkit/vm-manager.py list

# Run tests
./test-all-vms.sh

# Stop all VMs
python scripts/vfkit/vm-manager.py stop-all
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
python scripts/vfkit/vm-manager.py start valkey
python scripts/vfkit/vm-manager.py stop postgresql
python scripts/vfkit/vm-manager.py restart nodejs-dev
python scripts/vfkit/vm-manager.py status valkey

# All VMs
python scripts/vfkit/vm-manager.py start-all
python scripts/vfkit/vm-manager.py stop-all
python scripts/vfkit/vm-manager.py list

# Logs
python scripts/vfkit/vm-manager.py logs valkey 100
python scripts/vfkit/vm-manager.py follow nodejs-dev

# Health & Monitoring
python scripts/vfkit/vm-manager.py health
python scripts/vfkit/vm-manager.py monitor

# Testing
python scripts/vfkit/test-valkey.py  # Python replacement for test-valkey.sh
./test-postgresql.sh
./test-nodejs-dev.sh
./test-all-vms.sh
```

## Python CLI replacements

The vfkit tooling is migrating from bash to Python. The following entrypoints are available today:

- `scripts/vfkit/vm-manager.py` – complete orchestration CLI covering `start`, `stop`, `logs`, `health`, etc.
- `scripts/vfkit/start-*.py` – thin wrappers that call `vm-manager.py start <vm>` for each VM.
- `scripts/vfkit/start-all-vms.py`, `scripts/vfkit/stop-all-vms.py`, `scripts/vfkit/vm-health-check.py` – wrappers for the respective bulk/health commands.
- `scripts/vfkit/test-valkey.py` – Python translation of the Valkey integration test suite.

Run them either via `./scripts/vfkit/<name>.py` (after `chmod +x`) or explicitly with `python scripts/vfkit/<name>.py`. Their behaviour is covered by unit tests in `tests/vfkit/`.

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
python scripts/vfkit/vm-manager.py list

# View logs
python scripts/vfkit/vm-manager.py logs valkey 100

# Restart if stuck
python scripts/vfkit/vm-manager.py restart valkey

# Full reset
python scripts/vfkit/vm-manager.py stop-all
rm ~/.vibecode/vm-pids/*.pid
python scripts/vfkit/vm-manager.py start-all
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
