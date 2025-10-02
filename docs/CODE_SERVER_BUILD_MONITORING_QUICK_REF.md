# Quick Reference: Monitor Code-Server Build

## Check Build Status

```bash
# List recent builds
gh run list --workflow=codeserver-multiarch.yml --limit 5

# Watch active build
gh run watch

# View specific build
gh run view <RUN_ID>

# Check for failures
gh run list --workflow=codeserver-multiarch.yml --status=failure --limit 3
```

## Verify Extension Versions

```bash
# Run automated verification
./scripts/verify-codeserver-extensions.sh

# Or manually check
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions | grep -E "saoudrizwan|continue"
```

## Expected Output

```
saoudrizwan.claude-dev@3.32.6
continue.continue@1.3.15
```

## Test Container

```bash
# Start container
docker run -d --name test-codeserver -p 8765:8765 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Check it's running
docker ps | grep test-codeserver

# Access UI
open http://localhost:8765

# Cleanup
docker stop test-codeserver && docker rm test-codeserver
```

## Multi-Arch Verification

```bash
# Test AMD64
docker run --rm --platform linux/amd64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions | grep -E "saoudrizwan|continue"

# Test ARM64
docker run --rm --platform linux/arm64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions | grep -E "saoudrizwan|continue"
```

## Troubleshooting

### Build Failed
```bash
# View full logs
gh run view <RUN_ID> --log

# Check specific job
gh run view <RUN_ID> --log-failed
```

### Extensions Not Found
```bash
# Check if image exists
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

# List all extensions
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions
```

### Container Won't Start
```bash
# Check logs
docker logs test-codeserver

# Try with different port
docker run -d --name test-codeserver -p 9090:8765 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest
```

## Documentation

- Full monitoring guide: `claudedocs/CODE_SERVER_BUILD_MONITORING_2025-10-01.md`
- Extension update details: `claudedocs/CODE_SERVER_EXTENSIONS_UPDATE_2025-10-01.md`
- Verification script: `scripts/verify-codeserver-extensions.sh`
