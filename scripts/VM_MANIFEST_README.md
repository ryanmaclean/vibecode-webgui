# VM Manifest System

## Overview

The VM manifest system provides a standardized way to manage, distribute, and download VibeCode VM images. It uses JSON manifests to track VM image locations, checksums, and metadata.

## Files

### `vm-manifest.example.json` (checked into git)
Template manifest showing the expected structure with placeholder URLs. Copy this file to create your own manifest.

### `vm-manifest.json` (gitignored)
Your local manifest with actual URLs pointing to your VM image sources. Created by:
1. Copying `vm-manifest.example.json` to `vm-manifest.json`
2. Updating URLs to point to your CDN, local storage, or file paths
3. Updating SHA-256 checksums to match your actual VM images

### `vm-manifest.local.json` (gitignored)
Alternative local manifest, often used for `file://` URLs pointing to local storage.

## Scripts

### `make-vm-manifest.sh`
Generates a manifest from a directory of VM images.

```bash
make-vm-manifest.sh -s <source_dir> -b <base_url> -o <output.json>
```

**Example:**
```bash
# Generate manifest for CDN distribution
scripts/make-vm-manifest.sh \
  -s "/Volumes/tank3/vms" \
  -b "https://cdn.example.com/vibecode/vms" \
  -o scripts/vm-manifest.json

# Generate manifest for local file URLs
scripts/make-vm-manifest.sh \
  -s "$HOME/Library/Application Support/VibeCode/vms" \
  -b "file://$HOME/Library/Application%20Support/VibeCode/vms" \
  -o scripts/vm-manifest.local.json
```

### `fetch-vms-aria2c.sh`
Downloads VM images from a manifest using aria2c with checksum verification.

```bash
fetch-vms-aria2c.sh -m <manifest.json|URL> -d <dest_dir> [-S]
```

**Options:**
- `-m` - Manifest file path or URL
- `-d` - Destination directory for downloaded VMs
- `-S` - Create symlink at `~/Library/Application Support/VibeCode/vms`

**Examples:**
```bash
# Download from remote manifest
scripts/fetch-vms-aria2c.sh \
  -m "https://cdn.example.com/vibecode/vm-manifest.json" \
  -d "/Volumes/tank3/vms" \
  -S

# Download from local manifest
scripts/fetch-vms-aria2c.sh \
  -m scripts/vm-manifest.json \
  -d "$HOME/Library/Application Support/VibeCode/vms"

# Copy from local file:// URLs (no network transfer)
scripts/fetch-vms-aria2c.sh \
  -m scripts/vm-manifest.local.json \
  -d "/Volumes/tank3/vms"
```

## VM Images

The system manages these VM images:

### Database VMs
- `vibecode-postgresql.img` + `vibecode-postgresql-efi.nvram` - PostgreSQL database server
- `vibecode-pgvector.img` + `vibecode-pgvector-efi.nvram` - PostgreSQL with pgvector extension
- `vibecode-valkey.img` + `vibecode-valkey-efi.nvram` - Valkey (Redis-compatible) cache

### Development VMs
- `vibecode-nodejs.img` + `vibecode-nodejs-efi.nvram` - Node.js runtime environment
- `vibecode-nodejs-codeserver.img` + `vibecode-nodejs-codeserver-efi.nvram` - Node.js + code-server
- `vibecode-ide.img` + `vibecode-ide-efi.nvram` - Full IDE environment

## Manifest Format

```json
{
  "vms": [
    {
      "name": "vibecode-postgresql.img",
      "url": "https://cdn.example.com/vms/vibecode-postgresql.img",
      "sha256": "3b6a07d0d404fab4e23b6d34bc6696a6a312dd92821332385e5af7c01c421351"
    }
  ]
}
```

**Fields:**
- `name` - Filename of the VM image or NVRAM file
- `url` - Download URL (supports `https://`, `http://`, or `file://`)
- `sha256` - SHA-256 checksum for integrity verification

## Quick Start

1. **Create your manifest:**
   ```bash
   cp scripts/vm-manifest.example.json scripts/vm-manifest.json
   ```

2. **Edit `scripts/vm-manifest.json`:**
   Replace `TBD_URL` with your actual URLs:
   ```json
   "url": "https://your-cdn.com/vms/vibecode-postgresql.img"
   ```

3. **Generate checksums (if building from scratch):**
   ```bash
   scripts/make-vm-manifest.sh \
     -s "/path/to/vm/images" \
     -b "https://your-cdn.com/vms" \
     -o scripts/vm-manifest.json
   ```

4. **Download VMs:**
   ```bash
   scripts/fetch-vms-aria2c.sh \
     -m scripts/vm-manifest.json \
     -d "$HOME/Library/Application Support/VibeCode/vms"
   ```

## URL Schemes

### HTTPS/HTTP URLs
For remote distribution via CDN or web server:
```json
"url": "https://cdn.example.com/vms/vibecode-postgresql.img"
```

### File URLs
For local file system access (no network transfer):
```json
"url": "file:///Users/username/Library/Application%20Support/VibeCode/vms/vibecode-postgresql.img"
```

Note: Spaces in paths must be URL-encoded as `%20`.

## Requirements

- **aria2c** - Fast, resumable download client (`brew install aria2`)
- **shasum** - SHA-256 checksum verification (built-in on macOS)
- **python3** - JSON parsing and scripting (built-in on macOS)

## Integration

The VibeCode app uses these manifests to:
1. Discover available VM images
2. Download missing VMs on first launch
3. Verify VM integrity before starting
4. Update VMs when new versions are available

The Swift app looks for manifests at:
- `$HOME/Library/Application Support/VibeCode/vm-manifest.json`
- Project's `scripts/vm-manifest.json`
- Remote URL configured in preferences
