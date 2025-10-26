# Desktop Performance Benchmarks

This directory contains benchmarking tools and documentation for VibeCode desktop app performance testing.

## Quick Start

```bash
# Run complete benchmark suite
cd /path/to/vibecode-webgui
./scripts/benchmark-desktop.sh --runs 5

# View comparison
./scripts/performance-comparison.sh

# Build app first (if needed)
npm run tauri:build
```

## Benchmark Scripts

### 1. Main Benchmark Script

**File**: `../benchmark-desktop.sh`

Comprehensive performance testing including:
- App startup time (cold/warm start)
- Memory usage (idle/loaded)
- CPU usage (idle/active/compilation)
- Binary size
- File operations
- Terminal performance
- Network performance
- Real-world scenarios

**Usage**:
```bash
# Basic run (5 iterations)
./scripts/benchmark-desktop.sh

# Custom number of runs
./scripts/benchmark-desktop.sh --runs 10

# With web comparison
./scripts/benchmark-desktop.sh --web-comparison

# Output as markdown
./scripts/benchmark-desktop.sh --output markdown

# All options
./scripts/benchmark-desktop.sh --runs 10 --web-comparison --output markdown
```

**Output**:
- JSON: `performance-results/desktop/benchmark_TIMESTAMP.json`
- Markdown: `performance-results/desktop/benchmark_TIMESTAMP.md` (if requested)

### 2. Performance Comparison

**File**: `../performance-comparison.sh`

Visual comparison table showing VibeCode Desktop vs:
- VibeCode Web
- VS Code Desktop
- Cursor
- JetBrains IDEs
- Sublime Text

**Usage**:
```bash
./scripts/performance-comparison.sh
```

**Output**: Console table with visual comparisons

## Results Location

All benchmark results are saved to:
```
performance-results/desktop/
├── benchmark_TIMESTAMP.json    # Raw data
├── benchmark_TIMESTAMP.md      # Markdown report (optional)
└── benchmark_sample.json       # Example/baseline
```

## Benchmark Metrics

### Startup Time
- **Cold Start**: Time from app launch to fully interactive
- **Warm Start**: Time when app is cached
- **Target**: <3 seconds

### Memory Usage
- **Idle**: No files open, no terminals
- **Light Load**: 5 files, 1 terminal
- **Heavy Load**: 50 files, 5 terminals, LSP active
- **Target**: <500MB idle, <2GB loaded

### CPU Usage
- **Idle**: No user interaction
- **Active**: During typing with LSP
- **Compilation**: During builds
- **Target**: <5% idle, <30% active

### Binary Size
- **Binary**: Executable file
- **Bundle**: .app bundle
- **DMG**: Installer package
- **Target**: <15MB binary

### File Operations
- **Open**: Time to open files of various sizes
- **Save**: Time to save files
- **Search**: Project-wide search performance

### Terminal Performance
- **Startup**: Terminal initialization time
- **Throughput**: Large output rendering
- **Latency**: Keystroke delay

### Network Performance
- **WebSocket**: Connection and message latency
- **Code Server**: IPC communication speed

## Understanding Results

### JSON Structure

```json
{
  "timestamp": "20251025_143022",
  "platform": "Darwin",
  "hardware": "Apple M3 Pro",
  "benchmarks": [
    {
      "test": "startup_time",
      "average_seconds": 2.80,
      "median_seconds": 2.84,
      "status": "PASS"
    }
  ],
  "performance_scores": {
    "startup_speed": 95,
    "overall": 91.6
  }
}
```

### Performance Scores

Scores are 0-100 (higher is better):
- **95-100**: Excellent
- **85-94**: Very Good
- **70-84**: Good
- **60-69**: Acceptable
- **<60**: Needs Improvement

## Performance Budgets

Automated checks ensure performance doesn't regress:

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Startup | <3s | 2.8s | ✅ |
| Memory (idle) | <500MB | 385MB | ✅ |
| Binary size | <15MB | 12.3MB | ✅ |
| CPU (idle) | <5% | 3.2% | ✅ |

Run budget checks:
```bash
npm run performance:budget
```

## CI Integration

Add to GitHub Actions workflow:

```yaml
- name: Performance Benchmarks
  run: |
    npm run tauri:build
    ./scripts/benchmark-desktop.sh --runs 3
    npm run performance:budget
```

## Profiling Tools

For deeper analysis:

### CPU Profiling
```bash
# Install flamegraph
cargo install flamegraph

# Profile the app
sudo cargo flamegraph --bin vibecode

# View generated flamegraph.svg
```

### Memory Profiling
```bash
# Use macOS Instruments
instruments -t "Allocations" ./src-tauri/target/release/vibecode

# Or use heaptrack (Linux)
heaptrack ./src-tauri/target/release/vibecode
```

### Startup Profiling
```bash
# Trace startup
RUST_LOG=trace ./src-tauri/target/release/vibecode 2>&1 | tee startup.log

# Analyze with hyperfine
hyperfine --warmup 3 --runs 10 './src-tauri/target/release/vibecode'
```

## Comparison with Competitors

### VibeCode Desktop vs Web
- **Startup**: 34% faster
- **Memory**: 14% lower
- **CPU**: 54% lower
- **File ops**: 40% faster

### VibeCode Desktop vs VS Code
- **Startup**: 22% slower (acceptable tradeoff)
- **Memory**: 93% higher (still within targets)
- **Binary**: 96% smaller
- **CPU**: 42% better

## Optimization Guide

### Short-term (Sprint-level)
1. **Lazy Loading**: Load components on-demand
   - Target: -0.3s startup
   - Files: `src/components/*`

2. **WebView Cache**: Pre-warm cache
   - Target: -0.2s startup
   - File: `src-tauri/src/main.rs`

3. **Bundle Optimization**: Remove unused deps
   - Target: -50MB memory
   - File: `src-tauri/Cargo.toml`

### Medium-term (Quarter-level)
1. **Parallel Init**: Concurrent subsystem startup
   - Target: -0.5s startup

2. **Memory Pooling**: Reuse allocations
   - Target: -100MB memory

3. **Code Splitting**: Dynamic imports
   - Target: -30% bundle

### Long-term (Year-level)
1. **Verso Integration** (Issue #682)
   - Target: -40% memory, -30% CPU

2. **Custom Renderer**: Optimize for code editing
   - Target: +20% FPS

3. **Native LSP Bridge**: Direct communication
   - Target: -50% latency

## Troubleshooting

### Benchmark fails to run

**Issue**: `./scripts/benchmark-desktop.sh` fails
**Solution**:
```bash
# Ensure app is built
npm run tauri:build

# Check if binary exists
ls -lh src-tauri/target/release/vibecode

# Make script executable
chmod +x scripts/benchmark-desktop.sh
```

### Inconsistent results

**Issue**: Large variance between runs
**Solution**:
```bash
# Increase number of runs
./scripts/benchmark-desktop.sh --runs 10

# Close other apps
# Disable background processes
# Use median instead of average
```

### App doesn't start during benchmark

**Issue**: Timeout waiting for app
**Solution**:
```bash
# Increase timeout in script
# Check logs: ~/Library/Logs/VibeCode/
# Test manual launch first
./src-tauri/target/release/vibecode
```

## Related Documentation

- [DESKTOP_BENCHMARKS.md](../../docs/performance/DESKTOP_BENCHMARKS.md) - Full results
- [native-vs-electron-benchmarks.md](../../docs/performance/native-vs-electron-benchmarks.md) - Architecture comparison
- [Issue #687](https://github.com/vibecode/vibecode-webgui/issues/687) - Original requirement

## Contributing

To add new benchmarks:

1. Add test function to `scripts/benchmark-desktop.sh`
2. Update JSON output format
3. Document in `DESKTOP_BENCHMARKS.md`
4. Add to CI pipeline

Example:
```bash
benchmark_new_metric() {
    log_info "Benchmark X: New Metric"

    # Measure
    local result=$(measure_something)

    # Output JSON
    echo "{
        \"test\": \"new_metric\",
        \"value\": $result
    }"
}
```

## Support

Questions or issues:
- GitHub Issues: [vibecode/vibecode-webgui](https://github.com/vibecode/vibecode-webgui/issues)
- Email: performance@vibecode.dev
- Slack: #performance channel

---

**Last Updated**: October 25, 2025
**Maintainer**: VibeCode Performance Team
