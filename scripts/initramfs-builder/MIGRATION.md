# Directory Rename: vfkit → initramfs-builder

## What Changed

**Old**: `scripts/vfkit/` stored in `~/.vfkit/vms/`
**New**: `scripts/initramfs-builder/` stored in `~/.vibecode/vms/`

## Why

The old naming suggested a dependency on the external `vfkit` tool, which was confusing because:
- The menubar app uses 100% native Apple Virtualization.framework
- No vfkit binary is required or called
- Scripts only BUILD initramfs files (Alpine Linux + OpenVSCode Server)

## What These Scripts Do

These scripts create initramfs (initial RAM filesystem) images containing:
- Alpine Linux 3.22 (minimal)
- Node.js 24 (musl build)
- OpenVSCode Server (Gitpod v1.105.1)
- Valkey (Redis alternative)
- PostgreSQL

The menubar app loads these initramfs files using Apple's native VZLinuxBootLoader.

## Migration for Existing Users

If you have existing VMs in `~/.vfkit/vms/`:

```bash
# Move to new location
mkdir -p ~/.vibecode/vms
cp -R ~/.vfkit/vms/vibecode-alpine ~/.vibecode/vms/alpine

# Optional: Remove old directory
rm -rf ~/.vfkit
```

## No Functionality Change

This is purely a naming change. The menubar app and scripts work exactly the same.
