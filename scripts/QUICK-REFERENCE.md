# Automation Framework Quick Reference

## One-Command Operations

```bash
# Build everything
bash scripts/build-all-vms.sh

# Test everything
bash scripts/test-specialized-vms.sh

# Build + Test (CI)
bash scripts/ci-test.sh
```

## Individual VM Operations

### Valkey
```bash
# Build
bash scripts/build-valkey-vm.sh

# Test
bash scripts/test-valkey-vm.sh

# Deploy
bash scripts/deploy-vm.sh valkey valkey-standalone-complete.cpio.gz
```

### PostgreSQL
```bash
# Build
bash scripts/rebuild-postgresql-docker.sh

# Test
bash scripts/test-postgresql-vm.sh

# Deploy
bash scripts/deploy-vm.sh postgresql postgresql-standalone-complete.cpio.gz
```

### Unified
```bash
# Build
bash scripts/build-unified-vm.sh

# Test
bash scripts/test-unified-vm.sh

# Deploy
bash scripts/deploy-vm.sh unified unified-services-restored.cpio.gz
```

## Prerequisites

### Required
- Docker: `brew install docker`

### Optional (for testing)
- redis-cli: `brew install redis`
- psql: `brew install postgresql`

## Troubleshooting

### Check VM Files
```bash
ls -lh ~/vibecode-webgui/azure/*.cpio.gz
```

### Inspect Initramfs
```bash
mkdir /tmp/inspect
cd /tmp/inspect
gunzip -c ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz | cpio -idm
ls -lR
```

### Check Running VMs
```bash
ps aux | grep NodeJSVibeCode
```

### View Console
```bash
tail -f /tmp/vibecode-console-*.log
```

### Find VM IP
```bash
for ip in 192.168.64.{1..10}; do
    ping -c 1 $ip 2>/dev/null && echo "Found: $ip"
done
```

## File Locations

- Scripts: `~/vibecode-webgui/scripts/`
- VMs: `~/vibecode-webgui/azure/`
- Docs: `~/vibecode-webgui/docs/`
- Console logs: `/tmp/vibecode-console-*.log`

## Exit Codes

- 0 = Success
- 1 = Failure

All scripts use `set -e` for fail-fast behavior.

## CI/CD Integration

```yaml
# .github/workflows/vm-tests.yml
name: VM Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: bash scripts/ci-test.sh
```

## Getting Help

- Usage guide: `scripts/README-AUTOMATION.md`
- Detailed docs: `docs/AUTOMATION_FRAMEWORK.md`
- This file: `scripts/QUICK-REFERENCE.md`
