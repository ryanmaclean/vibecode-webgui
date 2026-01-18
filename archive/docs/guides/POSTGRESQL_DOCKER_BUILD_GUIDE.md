# PostgreSQL VM Docker Build Guide

**Agent:** E1
**Date:** 2025-11-28
**Purpose:** Rebuild PostgreSQL initramfs using Linux-native tools via Docker

## Problem Statement

Agent D2 identified all PostgreSQL dependencies correctly, but macOS cpio/gzip tools create initramfs archives that the Linux kernel rejects with:

```
Initramfs unpacking failed: junk within compressed archive
Kernel panic - not syncing: No working init found
```

This is due to incompatibility between macOS and Linux archive formats.

## Solution

Use Docker container with Ubuntu 22.04 (Linux-native tools) to build initramfs that the kernel will accept.

## Prerequisites

1. Docker Desktop must be installed and running
2. Source initramfs prepared by Agent D2 at `/tmp/postgresql-vm-fixed/`

## Quick Start

### Step 1: Install Docker (if needed)

```bash
cd ~/vibecode-webgui/scripts
bash install-docker.sh
```

Or manually:
- Download from: https://www.docker.com/products/docker-desktop
- Install and launch Docker Desktop
- Wait for Docker daemon to start

### Step 2: Build PostgreSQL Initramfs

```bash
cd ~/vibecode-webgui/scripts
bash rebuild-postgresql-docker.sh
```

This will:
1. Build Docker image with Linux build tools
2. Run build inside container
3. Output: `~/vibecode-webgui/azure/postgresql-standalone-complete.cpio.gz`

### Step 3: Test the Build

```bash
cd ~/vibecode-webgui/scripts
bash test-postgresql-docker-build.sh
```

This will:
1. Backup existing VM image
2. Launch VM with Docker-built initramfs
3. Verify kernel accepts the archive
4. Check PostgreSQL starts correctly
5. Test database connectivity
6. Run SQL queries
7. Restore original VM image

## Build Architecture

### Docker Container Structure

```
ubuntu:22.04
├── cpio (Linux-native)
├── gzip (Linux-native)
├── file (verification)
└── binutils (binary tools)
```

### Volume Mounts

- Source: `/tmp/postgresql-vm-fixed` → `/build/source` (read-only)
- Output: `~/vibecode-webgui/azure` → `/build/output` (read-write)

### Build Process

1. Verify source directory structure
2. Check critical files (init, postgres, psql)
3. Verify dependencies (libicuuc.so.74, libzstd.so.1, etc.)
4. Build initramfs: `find . -print0 | cpio --null -o -H newc | gzip -9`
5. Test extraction and verify integrity

## Files Created

### 1. Dockerfile.initramfs-builder
**Location:** `~/vibecode-webgui/scripts/Dockerfile.initramfs-builder`
**Purpose:** Defines Docker image with Linux build tools

### 2. build-initramfs.sh
**Location:** `~/vibecode-webgui/scripts/build-initramfs.sh`
**Purpose:** Build script that runs inside Docker container

### 3. rebuild-postgresql-docker.sh
**Location:** `~/vibecode-webgui/scripts/rebuild-postgresql-docker.sh`
**Purpose:** Main wrapper script for easy execution

### 4. test-postgresql-docker-build.sh
**Location:** `~/vibecode-webgui/scripts/test-postgresql-docker-build.sh`
**Purpose:** Comprehensive testing of Docker-built initramfs

### 5. install-docker.sh
**Location:** `~/vibecode-webgui/scripts/install-docker.sh`
**Purpose:** Helper script for Docker installation

## Validation Tests

The test script performs these checks:

### Critical Tests
1. **Kernel Boot Test**: Verify kernel accepts initramfs (no "junk within compressed archive")
2. **Library Errors**: Check for missing shared library errors
3. **PostgreSQL Service**: Verify PostgreSQL process starts
4. **Port 5432**: Confirm PostgreSQL is listening
5. **Database Queries**: Run SQL operations (CREATE, INSERT, SELECT, DROP)

### Expected Results

```
Kernel Boot:     SUCCESS - No kernel panic
Library Errors:  NONE - All dependencies present
PostgreSQL:      RUNNING - Service started
Port 5432:       LISTENING - Database accepting connections
SQL Tests:       5/5 PASSED - Full functionality
```

## Troubleshooting

### Docker Not Running
```
ERROR: Docker daemon not running
```
**Solution:** Launch Docker Desktop from Applications

### Source Directory Missing
```
ERROR: Source directory not found: /tmp/postgresql-vm-fixed
```
**Solution:** Run Agent D2 to prepare initramfs first

### Kernel Panic After Build
```
Kernel panic - not syncing: No working init found
```
**Solution:** Check build logs for errors, verify all dependencies included

### PostgreSQL Won't Start
```
PostgreSQL messages not found in console
```
**Solution:** Check `/tmp/vibecode-console-*.log` for errors, verify init script

## Comparison: macOS vs Docker Build

| Aspect | macOS Build | Docker Build |
|--------|-------------|--------------|
| cpio version | BSD cpio | GNU cpio (Linux-native) |
| gzip version | BSD gzip | GNU gzip (Linux-native) |
| Kernel acceptance | REJECTED | ACCEPTED |
| Result | Kernel panic | Boots successfully |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ macOS Host                                                  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Source: /tmp/postgresql-vm-fixed/                  │   │
│  │   ├── init                                          │   │
│  │   ├── usr/bin/postgres                             │   │
│  │   ├── usr/bin/psql                                 │   │
│  │   └── usr/lib/aarch64-linux-gnu/...                │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Docker Container (Ubuntu 22.04)                    │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────┐     │   │
│  │  │ Linux-native build tools:                │     │   │
│  │  │  • GNU cpio --null -o -H newc           │     │   │
│  │  │  • GNU gzip -9                          │     │   │
│  │  └──────────────────────────────────────────┘     │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Output: ~/vibecode-webgui/azure/                  │   │
│  │   postgresql-standalone-complete.cpio.gz           │   │
│  │   (Kernel-compatible format)                       │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ VM Execution (Linux kernel)                        │   │
│  │   ✓ Kernel accepts initramfs                       │   │
│  │   ✓ Extracts successfully                          │   │
│  │   ✓ Runs init script                               │   │
│  │   ✓ Starts PostgreSQL                              │   │
│  │   ✓ Listens on port 5432                           │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

After successful build:
1. Run test script to validate
2. If tests pass, deploy to production
3. Update SwiftUI apps to use new initramfs
4. Document any PostgreSQL-specific configuration

## References

- Agent D2: Dependency analysis and preparation
- Agent E1: Docker-based rebuild solution
- Original issue: macOS cpio/gzip incompatibility with Linux kernel
