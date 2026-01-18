# Replacing Gitpod Binary with OpenVSCodium

**Issue**: #561 - Replace Gitpod binary with maintained OpenVSCodium build

## Background

The Gitpod binary in use may be outdated or unmaintained. OpenVSCodium provides:
- Regular security updates
- Active maintenance
- Better arm64 support
- Open source transparency

## Migration Steps

### 1. Download OpenVSCodium

```bash
# For x86_64
curl -L https://github.com/gitpod-io/openvscode-server/releases/latest/download/openvscode-server-linux-x64.tar.gz -o openvscode.tar.gz

# For arm64 (M-Series)
curl -L https://github.com/gitpod-io/openvscode-server/releases/latest/download/openvscode-server-linux-arm64.tar.gz -o openvscode.tar.gz

# Extract
tar xzf openvscode.tar.gz
```

### 2. Verify Binary

```bash
# Check version
./openvscode-server --version

# Test startup
./openvscode-server --port 8080 --host 0.0.0.0 --without-connection-token
```

### 3. Update Scripts

Replace hardcoded Gitpod paths:

```bash
# Before
VSCODE_BIN="/opt/gitpod/code-server"

# After
VSCODE_BIN="/opt/openvscode-server/bin/openvscode-server"
```

### 4. Update Dockerfiles

```dockerfile
# Before
FROM gitpod/openvscode-server:latest

# After
FROM gitpod/openvscode-server:1.85.0
# Pin specific version for reproducibility
```

### 5. Environment Variables

Update workspace configuration:

```bash
# .env
VSCODE_SERVER_PATH=/opt/openvscode-server
VSCODE_VERSION=1.85.0
```

### 6. Automated Tracking

Use the artifact tracking script:

```bash
# Run tracking
./scripts/track-arm64-artifacts.sh

# Subscribe to updates
gh issue subscribe <new-release-issue>
```

## Verification

### Test Checklist

- [ ] Binary starts without errors
- [ ] Extensions install correctly
- [ ] Workspace files accessible
- [ ] Terminal works
- [ ] Debug capabilities functional
- [ ] arm64 performance acceptable

### Benchmark Comparison

Run before/after benchmarks:

```bash
# Gitpod baseline
./scripts/benchmarks/openvscode-benchmark.sh

# OpenVSCodium comparison
OPENVSCODE_VERSION=1.85.0 ./scripts/benchmarks/openvscode-benchmark.sh
```

Expected results:
- Boot time: Similar or better
- Memory: ±10% variance acceptable
- Extension load: <30s

## Rollback Plan

If issues occur:

```bash
# 1. Keep old binary as backup
mv /opt/gitpod/code-server /opt/gitpod/code-server.backup

# 2. Restore if needed
mv /opt/gitpod/code-server.backup /opt/gitpod/code-server

# 3. Document issues
gh issue create --title "OpenVSCodium migration issue" --body "..."
```

## Configuration Differences

### Gitpod vs OpenVSCodium

| Feature | Gitpod | OpenVSCodium |
|---------|--------|--------------|
| Update frequency | Quarterly | Monthly |
| arm64 support | Limited | Full |
| Extensions | Gitpod marketplace | VS Code marketplace |
| Telemetry | Gitpod analytics | Opt-out |

### Extension Compatibility

Most extensions work identically. Check compatibility:

```bash
# List installed extensions
code-server --list-extensions

# Migrate to OpenVSCodium
openvscode-server --install-extension <extension-id>
```

## Performance Optimization

### arm64 Specific

On M-Series hardware:

```bash
# Enable native arm64 optimizations
export VSCODE_ARCH=arm64
export NODE_OPTIONS="--max-old-space-size=4096"

# Use native Node.js
which node  # Should be arm64 Node
node --version
```

### Memory Tuning

```bash
# Increase heap for large workspaces
export NODE_OPTIONS="--max-old-space-size=8192"

# Limit extension host memory
openvscode-server --max-memory=4096
```

## Monitoring

### Health Checks

```bash
#!/bin/bash
# Check OpenVSCodium health

# Process check
pgrep -f openvscode-server || echo "Not running"

# Port check
curl -f http://localhost:8080 || echo "Port not accessible"

# Memory check
ps aux | grep openvscode-server | awk '{print $6/1024 "MB"}'
```

### Datadog Integration

Send metrics:

```bash
# Boot time
curl -X POST "https://api.datadoghq.com/api/v1/series" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d '{
    "series": [{
      "metric": "openvscode.boot_time",
      "points": [['"$(date +%s)"', 2.5]],
      "tags": ["version:1.85.0", "arch:arm64"]
    }]
  }'
```

## References

- OpenVSCode Server: https://github.com/gitpod-io/openvscode-server
- Release Notes: https://github.com/gitpod-io/openvscode-server/releases
- Artifact Tracking: scripts/track-arm64-artifacts.sh
- Benchmark Script: scripts/benchmarks/openvscode-benchmark.sh

## Related Issues

- #561: Replace Gitpod binary with maintained OpenVSCodium build
- #563: Benchmark custom build vs Gitpod baseline
- #564: Track Apple Silicon arm64 OpenVSCodium artifact
