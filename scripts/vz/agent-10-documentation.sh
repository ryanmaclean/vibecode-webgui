#!/bin/bash
# Agent 10: Complete Documentation
set -e

echo "=== Agent 10: Creating Complete Documentation ==="

# Create comprehensive documentation
cat > docs/vm/OPENCLAW_VM_COMPLETE.md << 'DOCEOF'
# OpenClaw VM - Complete Setup Guide

## Overview
Complete guide for setting up OpenClaw in a minimal macOS VM with networking, security, and monitoring.

## Quick Start
```bash
# 1. Create VM
./platforms/macos/vz-swift/.build/release/vibecode-vm-standalone openclaw openclaw-tiny

# 2. Install OpenClaw (inside VM)
./scripts/vz/install-openclaw-in-vm-enhanced.sh

# 3. Setup Tailscale
TAILSCALE_AUTH_KEY=your-key ./scripts/vz/setup-tailscale-vm.sh

# 4. Setup SSL
./scripts/vz/setup-letsencrypt-auto.sh openclaw.local admin@example.com

# 5. Setup Monitoring
./scripts/vz/setup-datadog-vm.sh
```

## Architecture
- **VM**: Minimal macOS (2GB RAM, 2 CPU, 20GB disk)
- **Networking**: NAT with auto-generated MAC (fixed carrier issue)
- **Security**: App Store compliant entitlements
- **Monitoring**: Datadog integration with dashboards
- **SSL**: Let's Encrypt with automatic renewal

## Components
- OpenClaw gateway (port 18789)
- Tailscale VPN for secure access
- Datadog APM for monitoring
- Let's Encrypt for SSL/TLS

## Troubleshooting
See docs/vm/macos-vm-workflow.md for detailed troubleshooting.

## Testing
Run comprehensive tests: `./scripts/vz/test-comprehensive.sh openclaw-tiny`

## Alternative: Apple Container
For lightweight deployment, see Apple Container prototype.
DOCEOF

# Create API documentation
cat > docs/vm/API_REFERENCE.md << 'APIEOF'
# OpenClaw VM API Reference

## Gateway API
- **Health Check**: `GET /health`
- **Status**: `GET /status`
- **Metrics**: `GET /metrics`

## Tailscale API
- **Status**: `GET /tailscale/status`
- **IP**: `GET /tailscale/ip`

## Monitoring API
- **Datadog**: `GET /datadog/metrics`
- **Alerts**: `GET /alerts`

## Authentication
All APIs require authentication token from `gateway.auth.token`.

## Examples
```bash
# Health check
curl http://localhost:18789/health

# With auth token
curl -H "Authorization: Bearer $TOKEN" http://localhost:18789/status
```
APIEOF

echo "✅ Complete documentation created"
echo "Files:"
echo "  - docs/vm/OPENCLAW_VM_COMPLETE.md"
echo "  - docs/vm/API_REFERENCE.md"
