# Quick Start: Native macOS Observability

**Agent 27**: Staff SRE (Shopify macOS Observability Team)
**Feature**: Phase 1 - Unified Logging
**Time to Test**: 5 minutes

---

## 1. Build and Run

### Option A: Development Mode (Recommended)
```bash
# Navigate to project root
cd /Users/ryan.maclean/vibecode-webgui

# Install Rust dependencies (first time only)
cd src-tauri && cargo build && cd ..

# Run Tauri app in development mode
npm run tauri:dev
```

### Option B: Build Only (Skip UI)
```bash
cd /Users/ryan.maclean/vibecode-webgui/src-tauri

# Run tests
cargo test --package vibecode --lib logging

# Build release
cargo build --release
```

---

## 2. Verify Logging Works

### Terminal Output (Development Mode)
You should see structured log output like:
```
2025-10-02T08:30:15.123Z  INFO vibecode: VibeCode Tauri application starting version="0.1.0"
2025-10-02T08:30:15.234Z  INFO vibecode: Logging initialized (development mode) log_dir="/Users/ryan.maclean/Library/Logs/VibeCode"
2025-10-02T08:30:15.456Z  INFO vibecode: Tauri setup complete
```

### macOS Console.app
1. Open Console.app (Applications → Utilities → Console.app)
2. In the search bar, enter: `subsystem:com.vibecode.app`
3. Click "Start" to stream live logs
4. You should see all VibeCode events appear in real-time

**Alternative (Terminal)**:
```bash
# Stream live logs
log stream --predicate 'subsystem == "com.vibecode.app"' --style compact

# Show last 10 minutes
log show --predicate 'subsystem == "com.vibecode.app"' --info --last 10m

# Filter by category (docker only)
log show --predicate 'subsystem == "com.vibecode.app" AND category == "docker"' --last 1h

# Export to JSON
log show --predicate 'subsystem == "com.vibecode.app"' --style json --last 1h > vibecode-logs.json
```

---

## 3. Test Docker Integration

### Trigger Docker Events
```bash
# In another terminal, trigger Docker operations
# (This assumes you have Docker running)

# Test Docker ping (should generate log)
curl http://localhost:3000/api/docker/status

# Or via Tauri command if app is running:
# Open DevTools in Tauri app and run:
# await invoke('check_docker')
```

### Expected Logs
```
2025-10-02T08:31:00.123Z  INFO docker: Docker operation operation="ping" method="GET" endpoint="/_ping" duration_ms=45 status_code=200
2025-10-02T08:31:00.123Z  INFO docker: Docker ping successful duration_ms=45
```

---

## 4. Check Log Files (Production Mode)

### Log Directory
```bash
# Navigate to log directory
cd ~/Library/Logs/VibeCode

# List log files
ls -lh

# Expected output:
# vibecode-20251002.log  (today's log file)

# View logs
tail -f vibecode-20251002.log

# Pretty-print JSON logs
cat vibecode-20251002.log | jq '.'
```

### Log File Format (JSON)
```json
{
  "timestamp": "2025-10-02T08:30:15.123Z",
  "level": "INFO",
  "subsystem": "com.vibecode.app",
  "category": "docker",
  "message": "Docker ping successful",
  "fields": {
    "duration_ms": 45,
    "method": "GET",
    "endpoint": "/_ping",
    "status_code": 200
  },
  "span": {
    "name": "check_docker_available"
  }
}
```

---

## 5. Run Unit Tests

```bash
cd /Users/ryan.maclean/vibecode-webgui/src-tauri

# Run all logging tests
cargo test --package vibecode --lib logging

# Expected output:
# running 12 tests
# test logging::tests::test_category_as_str ... ok
# test logging::tests::test_subsystem_constant ... ok
# test logging::structured::tests::test_log_entry_serialization ... ok
# test logging::structured::tests::test_container_event_conversion ... ok
# test logging::structured::tests::test_docker_operation_error_level ... ok
# test logging::aggregation::tests::test_add_and_get_all ... ok
# test logging::aggregation::tests::test_buffer_eviction ... ok
# test logging::aggregation::tests::test_filter_by_category ... ok
# test logging::aggregation::tests::test_filter_by_level ... ok
# test logging::aggregation::tests::test_search ... ok
# test logging::aggregation::tests::test_get_stats ... ok
# test logging::retention::tests::test_retention_policy_age ... ok
#
# test result: ok. 12 passed; 0 failed

# Run with output (debug)
RUST_LOG=debug cargo test --package vibecode --lib logging -- --nocapture
```

---

## 6. Performance Validation

### CPU Usage
```bash
# Run in development mode
npm run tauri:dev &

# Monitor CPU usage
top -pid $(pgrep -f vibecode)

# Expected: <1% CPU usage
```

### Memory Usage
```bash
# Check memory usage
ps aux | grep vibecode

# Expected: <50MB for entire Tauri app (logging is <10MB)
```

### Log Latency
```bash
# Run performance test
cd /Users/ryan.maclean/vibecode-webgui/src-tauri
cargo test --package vibecode --lib logging::tests --release -- --nocapture

# Expected: <10μs per log entry
```

---

## 7. Test Log Aggregation (In-Memory Buffer)

### Via Rust Code
```rust
// In any Rust module
use crate::logging::aggregation::LogAggregator;

// Create aggregator
let aggregator = LogAggregator::default();

// Query logs
let recent = aggregator.get_recent(100);
let errors = aggregator.get_by_level("ERROR");
let search = aggregator.search("docker");

// Get statistics
let stats = aggregator.get_stats();
println!("Total: {}, Errors: {}",
    stats.total_entries,
    stats.by_level.get("ERROR").unwrap_or(&0)
);
```

### Via Tauri Commands (Future)
```typescript
// In React component (Phase 6)
import { invoke } from '@tauri-apps/api/core';

const logs = await invoke<LogEntry[]>('get_logs', {
  category: 'docker',
  level: 'ERROR'
});

const stats = await invoke<LogStats>('get_log_stats');
console.log('Total logs:', stats.total_entries);
```

---

## 8. Test Retention Policy

### Manual Cleanup
```bash
cd /Users/ryan.maclean/vibecode-webgui/src-tauri

# Run retention test
cargo test --package vibecode --lib logging::retention::tests -- --nocapture

# Or create test script
cat > test_retention.rs << 'EOF'
use vibecode::logging::retention::RetentionPolicy;

#[tokio::main]
async fn main() {
    let policy = RetentionPolicy::default();

    // Get usage
    let stats = policy.get_usage_stats().unwrap();
    println!("Files: {}, Size: {:.2} MB",
        stats.total_files,
        stats.total_size_mb()
    );

    // Apply retention
    let (deleted, freed) = policy.apply().unwrap();
    println!("Deleted: {}, Freed: {} MB",
        deleted,
        freed / 1_048_576
    );
}
EOF
```

---

## 9. Troubleshooting

### Logs Not Appearing

**Problem**: No logs in Console.app
**Solution**:
```bash
# 1. Check subsystem filter
log stream --predicate 'subsystem CONTAINS "vibecode"'

# 2. Check if Tauri app is running
ps aux | grep vibecode

# 3. Check RUST_LOG environment variable
echo $RUST_LOG  # Should be "info" or "debug"

# 4. Try broader filter
log stream | grep vibecode
```

### Log Files Not Created

**Problem**: No files in ~/Library/Logs/VibeCode
**Solution**:
```bash
# 1. Check directory exists
ls -la ~/Library/Logs/VibeCode

# 2. Create directory if missing
mkdir -p ~/Library/Logs/VibeCode

# 3. Check permissions
ls -ld ~/Library/Logs/VibeCode
# Should be: drwxr-xr-x (755)

# 4. Check if running in production mode
# Log files only created in release builds
cargo build --release
```

### High CPU Usage

**Problem**: Logging using >1% CPU
**Solution**:
```bash
# 1. Reduce log level
export RUST_LOG=info  # or "warn"

# 2. Reduce frequency
# Check if logging in tight loops

# 3. Profile with instruments
instruments -t "Time Profiler" vibecode
```

### Tests Failing

**Problem**: Cargo tests failing
**Solution**:
```bash
# 1. Update dependencies
cd src-tauri && cargo update

# 2. Clean and rebuild
cargo clean && cargo build

# 3. Check specific test
cargo test --package vibecode --lib logging::aggregation::tests::test_add_and_get_all -- --nocapture

# 4. Check Rust version
rustc --version  # Should be ≥1.70.0
```

---

## 10. Next Steps

### Instrument Additional Modules
1. **mDNS module** (`src-tauri/src/mdns.rs`):
   ```rust
   use tracing::{info, error, instrument};

   #[instrument]
   async fn discover_services() -> Result<Vec<Service>> {
       info!("Starting mDNS service discovery");
       // ... existing code ...
   }
   ```

2. **Commands module** (`src-tauri/src/commands.rs`):
   ```rust
   #[tauri::command]
   #[instrument]
   async fn greet(name: String) -> String {
       info!(name = %name, "Greet command called");
       // ... existing code ...
   }
   ```

### Add Dashboard API (Tauri Commands)
```rust
// In src-tauri/src/commands.rs
use crate::logging::aggregation::{LogAggregator, LogStats};

#[tauri::command]
async fn get_logs(
    category: Option<String>,
    level: Option<String>
) -> Result<Vec<LogEntry>, String> {
    // Implementation
}

#[tauri::command]
async fn search_logs(query: String) -> Result<Vec<LogEntry>, String> {
    // Implementation
}

#[tauri::command]
async fn get_log_stats() -> Result<LogStats, String> {
    // Implementation
}
```

### Begin Phase 2 (Metrics)
1. Create `src-tauri/src/metrics/` directory
2. Add `prometheus` crate to Cargo.toml
3. Implement `MetricsCollector` struct
4. Start HTTP server on port 9091
5. Export metrics in Prometheus format

---

## Configuration Reference

### Environment Variables
```bash
# Log level (default: info)
export RUST_LOG=debug  # trace|debug|info|warn|error

# Log directory (default: ~/Library/Logs/VibeCode)
export LOG_FILE=/custom/path/vibecode.log

# Retention period (default: 7 days)
export LOG_RETENTION_DAYS=14

# Max disk usage (default: 500MB)
export LOG_MAX_SIZE_MB=1000

# Reduce dependency noise
export RUST_LOG=info,bollard=warn,tokio=info,mdns_sd=warn
```

### Build Flags
```bash
# Development build (STDOUT logging)
cargo tauri dev

# Production build (file logging)
cargo tauri build --release

# Enable Tokio console (Phase 4)
RUSTFLAGS="--cfg tokio_unstable" cargo tauri dev
```

---

## Resources

- **Main Plan**: `claudedocs/AGENT27_NATIVE_MACOS_OBSERVABILITY_PLAN.md`
- **Implementation Summary**: `claudedocs/AGENT27_PHASE1_IMPLEMENTATION_SUMMARY.md`
- **Deliverables**: `claudedocs/AGENT27_DELIVERABLES_SUMMARY.md`
- **Logging README**: `src-tauri/src/logging/README.md`
- **Tracing Docs**: https://docs.rs/tracing/latest/tracing/
- **macOS Logging**: https://developer.apple.com/documentation/os/logging

---

## Support

### Issues
- Check `src-tauri/src/logging/README.md` troubleshooting section
- Review test cases in `src-tauri/src/logging/*/tests`
- Inspect logs in Console.app with detailed filters

### Performance
- CPU should be <1% average, <2% peak
- Memory should be <10MB for logging subsystem
- Disk usage should be ~50MB/day with 7-day retention

---

**Status**: ✅ Ready for Testing
**Phase**: Phase 1 Complete (100%)
**Next**: Phase 2 (Metrics Collection)
**Agent**: Agent 27 (Staff SRE)
**Date**: 2025-10-02
