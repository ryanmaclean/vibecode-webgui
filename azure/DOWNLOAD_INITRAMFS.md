# VM Initramfs Files

Large initramfs files (*.cpio.gz) are stored in GitHub Releases to keep the repository small.

## Download All Initramfs Files

```bash
# Download from latest release
gh release download v1.0.0-initramfs -D azure/ -R ryanmaclean/vibecode-webgui
```

## Available Files

See release: https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v1.0.0-initramfs

**Key files:**
- `k3s-base.cpio.gz` (60MB) - K3s + Helm for Kubernetes
- `unified-services-postgres-fixed.cpio.gz` (121MB) - Unified services VM
- `nodejs-complete.cpio.gz` (147MB) - Node.js development VM
- `postgresql-standalone-final.cpio.gz` (142MB) - PostgreSQL VM
- `valkey-standalone.cpio.gz` (29MB) - Valkey/Redis VM

Plus 30+ other VM builds and variants.

## Manual Download

Visit: https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v1.0.0-initramfs

Download needed .cpio.gz files and place in `azure/` directory.

