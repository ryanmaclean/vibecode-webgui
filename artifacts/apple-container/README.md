# VibeCode Apple Container Distribution

**The first cloud IDE running on Apple's native containerization**

## What's Included

- `install.sh` - One-command installer for Apple Container CLI
- `run-stack.sh` - Launch VibeCode with code-server
- `datadog-monitor.sh` - Send container metrics to Datadog
- `vibecode-stack.yaml` - Stack configuration

## Quick Start

### 1. Install Apple Container

```bash
./install.sh
```

Requirements:
- macOS 15+ (Sequoia)
- Apple Silicon (M1/M2/M3/M4)

### 2. Run VibeCode

```bash
# Basic
./run-stack.sh

# With Datadog monitoring
export DD_API_KEY=your_key_here
export DD_SITE=datadoghq.com
./run-stack.sh
```

Access code-server at: http://localhost:8080

### 3. Monitor with Datadog (Optional)

```bash
export DD_API_KEY=your_key_here
./datadog-monitor.sh
```

Sends metrics:
- `vibecode.apple_container.total` - Total containers
- `vibecode.apple_container.running` - Running containers
- `vibecode.apple_container.container.up` - Per-container status

## Manual Commands

```bash
# Run code-server
container run -d -p 8080:8080 \
  -e PASSWORD=yourpass \
  codercom/code-server:latest

# List containers
container list

# View logs
container logs <container-id>

# Stop container
container stop <container-id>

# Remove container
container rm <container-id>
```

## Datadog Integration

### Metrics

All metrics are tagged with:
- `platform:macos`
- `runtime:apple_container`
- `service:vibecode`
- `host:<hostname>`

### Dashboard

Create a Datadog dashboard with:

```json
{
  "title": "VibeCode Apple Container",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "requests": [{
          "q": "avg:vibecode.apple_container.running{*}"
        }],
        "title": "Running Containers"
      }
    }
  ]
}
```

### Alerts

Set up alerts for:
- Container count drops to 0
- Container restarts frequently
- High memory usage

## Performance

- **Container start**: < 1 second
- **code-server boot**: ~3 seconds
- **Memory**: ~200MB per container
- **CPU**: Native ARM64 performance

## Advantages

✅ No Docker Desktop required
✅ Native macOS integration
✅ Apple Silicon optimized
✅ Lightweight VMs
✅ OCI-compatible
✅ Sub-second starts

## Troubleshooting

### Container won't start
```bash
# Check system service
container system status

# Restart service
container system stop
container system start
```

### Port already in use
```bash
# Use different port
container run -p 8081:8080 ...
```

### Datadog metrics not showing
```bash
# Verify API key
echo $DD_API_KEY

# Check network
curl -I https://api.datadoghq.com
```

## Documentation

- [Apple Container Success](../../docs/APPLE_CONTAINER_SUCCESS.md)
- [Apple Container GitHub](https://github.com/apple/container)
- [VibeCode Documentation](../../README.md)

## Support

- GitHub Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
- Apple Container: https://github.com/apple/container/issues

## License

Apache 2.0 (same as Apple Container)

---

**VibeCode - The first cloud IDE for Apple's native containerization**
