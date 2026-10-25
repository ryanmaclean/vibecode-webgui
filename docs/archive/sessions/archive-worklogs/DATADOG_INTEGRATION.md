# Datadog Integration for VibeCode

## Overview

VibeCode integrates with Datadog for structured logging and observability. All application events, VM operations, and errors are logged in JSON format for easy parsing and analysis in Datadog.

## Components

### 1. DatadogLogger (`Sources/Utilities/DatadogLogger.swift`)

A centralized logging utility that:
- Writes structured JSON logs to `/Users/ryan.maclean/vibecode-webgui/logs/vibecode.log`
- Also logs to macOS unified logging (`os.log`) for Console.app
- Uses `NSLog` for compatibility
- Automatically adds metadata: timestamp, service, source, level

#### Log Levels
- `debug`: Detailed diagnostic information
- `info`: General informational messages
- `warning`: Warning messages for potential issues
- `error`: Error messages for failures

#### Example Usage
```swift
DatadogLogger.shared.info("VM started successfully", [
    "vm_name": "postgresql",
    "vm_id": "vibecode-postgresql",
    "port": 5432
])
```

### 2. Datadog Agent Configuration

**Location**: `datadog/vibecode-logs.yaml`

**Setup**:
```bash
# Run the setup script
./scripts/setup_datadog.sh
```

This will:
1. Create the logs directory
2. Copy configuration to `/opt/datadog-agent/etc/conf.d/vibecode.d/conf.yaml`
3. Restart the Datadog agent

### 3. Log Format

All logs are structured JSON with the following fields:

```json
{
  "timestamp": "2025-10-31T15:08:16Z",
  "level": "INFO",
  "message": "VM validated successfully",
  "service": "vibecode",
  "source": "swift",
  "vm_name": "vibecode-postgresql",
  "disk_path": "/path/to/disk.img"
}
```

## Key Events Logged

### Application Lifecycle
- `app_launch`: Application started
- `vm_manager_creation`: VMManager initialized

### VM Discovery
- `vm_discovery_start`: Starting VM discovery
- `vm_discovery_complete`: VM discovery finished with count
- `vm_discovery_failed`: No VMs found

### VM Operations
- `vm_start`: VM starting
- `vm_stop`: VM stopping
- `vm_running`: VM successfully started
- `vm_stopped`: VM successfully stopped

### UI Events
- `view_init`: View initialized
- `view_appeared`: View appeared on screen

## Viewing Logs

### Local File
```bash
tail -f /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log
```

### With jq for pretty printing
```bash
tail -f /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log | jq .
```

### Datadog Dashboard
https://app.datadoghq.com/logs

**Filters**:
- `service:vibecode` - All VibeCode logs
- `source:swift` - Swift application logs
- `level:ERROR` - Error logs only
- `@vm_name:postgresql` - PostgreSQL VM events

## Tags

All logs are tagged with:
- `env:development`
- `app:vibecode`
- `platform:macos`
- `service:vibecode`
- `source:swift`

## Example Queries

### Count VMs discovered
```
service:vibecode event:vm_discovery_complete
```

### VM start failures
```
service:vibecode event:vm_start level:ERROR
```

### All PostgreSQL VM operations
```
service:vibecode @vm_name:*postgresql*
```

## License

MIT License - See REPOSITORY_RULES.md for details


