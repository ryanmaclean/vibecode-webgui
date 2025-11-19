# PostgreSQL Container Setup with Apple Container Runtime

## Overview

The extension now uses Apple Container Runtime (Swift + Virtualization.framework) to manage PostgreSQL with pgvector in a containerized environment. No need to install PostgreSQL manually!

## How It Works

1. **Swift Container Manager** (`swift/PostgresContainerManager.swift`)
   - Wraps Apple Container Runtime
   - Manages PostgreSQL container lifecycle
   - Handles pgvector initialization

2. **TypeScript Bridge** (`src/swiftBridge.ts`)
   - Executes Swift CLI commands
   - Provides async/await interface
   - Handles errors gracefully

3. **Integration Layer** (`src/containerIntegration.ts`)
   - Auto-starts container on extension activation
   - Provides unified database config interface
   - Falls back to external PostgreSQL if needed

## Automatic Setup

When the extension activates:
1. Checks if container mode is enabled (`workspaceRag.useContainer`)
2. Checks if PostgreSQL container is running
3. If not running, automatically starts it
4. Waits for PostgreSQL to be ready
5. Initializes pgvector extension

## Manual Control

### Via VS Code Settings

- `workspaceRag.useContainer` - Enable/disable container mode
- `workspaceRag.containerName` - Container name (default: `workspace-rag-postgres`)
- `workspaceRag.containerImage` - Image to use (default: `pgvector/pgvector:pg16`)

### Via Command Line

```bash
cd extensions/workspace-rag/swift

# Start container
swift run postgres-container start

# Check status
swift run postgres-container status

# Stop container
swift run postgres-container stop

# Initialize pgvector
swift run postgres-container init-pgvector
```

## Container Image

Default: `pgvector/pgvector:pg16`

This image includes:
- PostgreSQL 16
- pgvector extension pre-installed
- Optimized for Apple Silicon

## Data Persistence

Container data is stored at:
`~/.vibecode/workspace-rag/postgres-data`

This persists across container restarts.

## Fallback Behavior

If container mode fails or is disabled:
- Extension falls back to external PostgreSQL
- Uses settings: `pgHost`, `pgPort`, `pgUser`, `pgPassword`, `pgDatabase`
- Shows warning message to user

## Requirements

- macOS 14.0+
- Apple Silicon (M1/M2/M3/M4)
- Swift 5.9+
- Apple Container Runtime (Virtualization.framework)

## Troubleshooting

### Container Won't Start
- Check Swift is installed: `swift --version`
- Check Apple Container Runtime is available
- Check logs in Output panel: "Workspace RAG"

### Container Starts But Can't Connect
- Wait a few seconds for PostgreSQL to initialize
- Check port 5432 is not in use: `lsof -i :5432`
- Try restarting container: `swift run postgres-container stop && swift run postgres-container start`

### pgvector Not Available
- Run: `swift run postgres-container init-pgvector`
- Or connect manually and run: `CREATE EXTENSION vector;`

## Benefits

✅ No manual PostgreSQL installation
✅ Automatic pgvector setup
✅ Isolated environment
✅ Easy cleanup (just remove container)
✅ Consistent across machines
✅ Native macOS performance
