# PostgreSQL VM Docker Build - Quick Reference

## One-Line Build (after Docker is installed)

```bash
cd ~/vibecode-webgui/scripts && bash rebuild-postgresql-docker.sh
```

## Installation & Testing Flow

### 1. Install Docker Desktop
```bash
bash ~/vibecode-webgui/scripts/install-docker.sh
```

**Manual installation:**
- Download: https://www.docker.com/products/docker-desktop
- Install and launch Docker Desktop
- Wait for Docker daemon to start (whale icon in menu bar)

### 2. Build PostgreSQL Initramfs
```bash
bash ~/vibecode-webgui/scripts/rebuild-postgresql-docker.sh
```

**What it does:**
- Builds Docker image with Linux build tools (Ubuntu 22.04)
- Runs build inside container using Linux-native cpio/gzip
- Outputs: `~/vibecode-webgui/azure/postgresql-standalone-complete.cpio.gz`

**Expected output:**
```
Building Docker image...
Running initramfs build in Docker container...
✓ init script found
✓ postgres binary found
✓ psql binary found
✓ libicuuc.so.74 found
✓ libzstd.so.1 found
Building initramfs with Linux-native tools...
✓ Extraction successful
File count: 500+
Total size: 150M+
=== Build Complete ===
```

### 3. Test the Build
```bash
bash ~/vibecode-webgui/scripts/test-postgresql-docker-build.sh
```

**What it tests:**
1. Kernel boot (no kernel panic)
2. Library dependencies (no missing .so errors)
3. PostgreSQL service startup
4. Port 5432 connectivity
5. SQL operations (CREATE/INSERT/SELECT/DROP)

**Expected results:**
```
=== CRITICAL TEST: Kernel Boot ===
SUCCESS - Kernel accepted initramfs, VM booted

=== Checking PostgreSQL Service ===
PostgreSQL messages found:
database system is ready to accept connections

=== Checking for Library Errors ===
SUCCESS - No library errors

=== Testing PostgreSQL Connectivity ===
SUCCESS - Port 5432 is listening

=== Testing PostgreSQL Functionality ===
1. Testing version query...
   SUCCESS - Version query worked
2. Creating test table...
   SUCCESS - Table created
3. Inserting test data...
   SUCCESS - Data inserted
4. Querying test data...
   SUCCESS - Data retrieved
5. Dropping test table...
   SUCCESS - Table dropped
```

## Files Created

| File | Purpose |
|------|---------|
| `Dockerfile.initramfs-builder` | Docker image definition |
| `build-initramfs.sh` | Build script (runs in container) |
| `rebuild-postgresql-docker.sh` | Main wrapper script |
| `test-postgresql-docker-build.sh` | Comprehensive test suite |
| `install-docker.sh` | Docker installation helper |
| `README_DOCKER_BUILD.md` | This file |

## Why Docker?

**Problem:** macOS cpio/gzip creates archives that Linux kernel rejects:
```
Initramfs unpacking failed: junk within compressed archive
Kernel panic - not syncing: No working init found
```

**Solution:** Use Docker container with Linux-native tools (Ubuntu 22.04) to create kernel-compatible archives.

## Troubleshooting

### Docker Not Installed
```
ERROR: Docker not installed
```
Run: `bash install-docker.sh` or install manually

### Docker Not Running
```
ERROR: Docker daemon not running
```
Launch Docker Desktop from /Applications/Docker.app

### Source Directory Missing
```
ERROR: Source directory not found: /tmp/postgresql-vm-fixed
```
Run Agent D2 first to prepare the initramfs

### Build Fails
Check Docker logs:
```bash
docker logs $(docker ps -a -q --filter ancestor=initramfs-builder:latest | head -1)
```

### VM Won't Boot
Check console log:
```bash
tail -100 /tmp/vibecode-console-*.log
```

Look for:
- "kernel panic" - initramfs format issue
- "error while loading" - missing library
- "PostgreSQL" - service startup messages

## Architecture

```
macOS Host
    ↓ (source: /tmp/postgresql-vm-fixed/)
Docker Container (Ubuntu 22.04)
    • GNU cpio --null -o -H newc
    • GNU gzip -9
    ↓ (output: ~/vibecode-webgui/azure/)
postgresql-standalone-complete.cpio.gz
    ↓ (kernel-compatible format)
VM Execution
    ✓ Kernel accepts initramfs
    ✓ PostgreSQL starts
    ✓ Port 5432 listening
```

## Next Steps

1. **Install Docker** (if not already installed)
2. **Run build script** to create initramfs
3. **Run test script** to validate
4. **Deploy** if all tests pass

## Quick Commands

```bash
# Full rebuild and test
cd ~/vibecode-webgui/scripts
bash rebuild-postgresql-docker.sh && bash test-postgresql-docker-build.sh

# Check Docker status
docker info

# View Docker images
docker images | grep initramfs

# Clean up Docker
docker rmi initramfs-builder:latest
```

## Support

For detailed documentation, see:
- `~/vibecode-webgui/docs/POSTGRESQL_DOCKER_BUILD_GUIDE.md`
