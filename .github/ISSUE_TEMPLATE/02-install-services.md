---
name: Install Services in VMs
about: Add PostgreSQL, Valkey, Node.js, and OpenVSCode to VMs
title: 'Install application services in VMs via cloud-init'
labels: enhancement, services, help wanted
assignees: ''
---

## Problem

VMs boot but have no services installed. Users can't actually use PostgreSQL, Valkey, Node.js, or OpenVSCode.

**Current state**: VMs are base Alpine Linux with no applications.

## Services Needed

### 1. PostgreSQL VM
- [ ] Install postgresql and postgresql-client packages
- [ ] Initialize database cluster
- [ ] Configure to listen on 0.0.0.0:5432
- [ ] Set up postgres user with password
- [ ] Create test database
- [ ] Auto-start on boot

### 2. Valkey VM
- [ ] Install redis (Valkey) package
- [ ] Configure to listen on 0.0.0.0:6379
- [ ] Disable protected mode for development
- [ ] Auto-start on boot

### 3. Node.js VM
- [ ] Install nodejs and npm packages
- [ ] Create simple HTTP server on port 3000
- [ ] Auto-start server on boot
- [ ] Verify npm functionality

### 4. OpenVSCode VM
- [ ] Install nodejs
- [ ] Install code-server or openvscode-server
- [ ] Configure on 0.0.0.0:8080
- [ ] Set password or disable auth
- [ ] Auto-start on boot

## Implementation Approach

Cloud-init configurations already created in `config/cloud-init/`:
- `postgresql-user-data.yaml`
- `valkey-user-data.yaml`
- `nodejs-user-data.yaml`
- `codeserver-user-data.yaml`

**Problem**: Cloud-init ISOs aren't being attached or processed during first boot.

## Possible Solutions

### Option 1: First Boot with Cloud-Init ISO
Attach cloud-init ISO on first VM boot (current approach).

**Status**: Code added to VMManager.swift but untested.

### Option 2: Manual Installation
SSH into VMs and install services manually.

**Pros**: Quick to test  
**Cons**: Not reproducible

### Option 3: Pre-Built VM Images
Build VMs with services already installed, distribute as downloads.

**Pros**: Users get working VMs immediately  
**Cons**: Large downloads, hard to customize

### Option 4: Post-Boot Provisioning Script
Run provisioning script after VM boots.

**Pros**: Flexible, debuggable  
**Cons**: Adds complexity

## Dependencies

- [ ] Bootloader fix (#1) - VMs must boot before services can be installed
- [ ] SSH access - Helpful for debugging service installation

## Testing

After installation:
```bash
# PostgreSQL
psql -h 192.168.64.X -p 5432 -U postgres -c "SELECT version();"

# Valkey
redis-cli -h 192.168.64.X -p 6379 PING

# Node.js
curl http://192.168.64.X:3000/

# OpenVSCode
curl http://192.168.64.X:8080/
```

Test script: `./scripts/test-service-health.sh <vm-ip>`

## Acceptance Criteria

- [ ] All 4 services installed and running
- [ ] Services start automatically on VM boot
- [ ] Services accessible from host Mac
- [ ] Connection tested and documented
- [ ] Installation is reproducible (scripted)

## Priority

**High** - Required for v1.0 release. This is the core value proposition.

