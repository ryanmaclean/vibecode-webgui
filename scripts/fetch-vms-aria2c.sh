#!/usr/bin/env bash
# MIT License
# Fetch VibeCode VM images using aria2c. Supports checksum verification and optional symlink
# to Application Support so the app discovers VMs without copying.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  fetch-vms-aria2c.sh -m <manifest.json|URL> -d <dest_dir> [-S]

Options:
  -m   Manifest file path or URL (JSON). Format:
       {
         "vms": [
           {"name":"vibecode-postgresql.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-postgresql-efi.nvram","url":"https://...","sha256":"..."},
           {"name":"vibecode-valkey.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-valkey-efi.nvram","url":"https://...","sha256":"..."},
           {"name":"vibecode-pgvector.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-pgvector-efi.nvram","url":"https://...","sha256":"..."},
           {"name":"vibecode-nodejs.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-nodejs-efi.nvram","url":"https://...","sha256":"..."},
           {"name":"vibecode-nodejs-codeserver.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-nodejs-codeserver-efi.nvram","url":"https://...","sha256":"..."},
           {"name":"vibecode-ide.img","url":"https://...","sha256":"..."},
           {"name":"vibecode-ide-efi.nvram","url":"https://...","sha256":"..."}
         ]
       }
  -d   Destination directory (e.g. /Volumes/tank3/vms)
  -S   Create/update symlink at "$HOME/Library/Application Support/VibeCode/vms" -> <dest_dir>

Notes:
- Requires: aria2c, shasum, python3 (for JSON parsing if manifest is remote)
- Resumable downloads; checksum verification is enforced
USAGE
}

log() { echo "[fetch-vms] $*"; }
err() { echo "[fetch-vms][ERROR] $*" >&2; }

MANIFEST=""
DEST=""
DO_SYMLINK=false

while getopts ":m:d:S" opt; do
  case "$opt" in
    m) MANIFEST="$OPTARG" ;;
    d) DEST="$OPTARG" ;;
    S) DO_SYMLINK=true ;;
    *) usage; exit 1 ;;
  esac
done

if [[ -z "$MANIFEST" || -z "$DEST" ]]; then
  usage; exit 1
fi

# Preconditions
command -v aria2c >/dev/null 2>&1 || { err "aria2c not found. Install via: brew install aria2"; exit 1; }
command -v shasum >/dev/null 2>&1 || { err "shasum not found."; exit 1; }
command -v python3 >/dev/null 2>&1 || { err "python3 not found."; exit 1; }

mkdir -p "$DEST"
MANIFEST_JSON=""

# Load manifest (supports local file or URL)
if [[ "$MANIFEST" =~ ^https?:// ]]; then
  log "Fetching manifest from URL: $MANIFEST"
  MANIFEST_JSON=$(curl -fsSL "$MANIFEST") || { err "Failed to fetch manifest"; exit 1; }
else
  log "Reading manifest file: $MANIFEST"
  MANIFEST_JSON=$(cat "$MANIFEST") || { err "Failed to read manifest"; exit 1; }
fi

# Parse manifest and iterate entries using python (robust JSON parsing)
# Pass DEST as argv[1] and MANIFEST_JSON as argv[2]
python3 - "$DEST" "$MANIFEST_JSON" <<'PY'
import sys, json, subprocess, os
from urllib.parse import urlparse, unquote

dest = sys.argv[1]
raw = sys.argv[2] if len(sys.argv) > 2 else ''
try:
    data = json.loads(raw)
except Exception as e:
    print(f"[fetch-vms][ERROR] Invalid JSON manifest: {e}", file=sys.stderr)
    sys.exit(1)

vms = data.get('vms', [])
if not isinstance(vms, list) or not vms:
    print("[fetch-vms][ERROR] Manifest has no 'vms' array entries", file=sys.stderr)
    sys.exit(1)

errors = 0
for entry in vms:
    name = entry.get('name')
    url = entry.get('url')
    sha256 = entry.get('sha256')
    if not all([name, url, sha256]):
        print(f"[fetch-vms][ERROR] Missing fields in entry: {entry}", file=sys.stderr)
        errors += 1
        continue

    out_path = os.path.join(dest, name)
    # Ensure parent dir exists
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    print(f"[fetch-vms] Downloading {name} from {url}")
    parsed = urlparse(url)
    if parsed.scheme == 'file':
        # Local copy path; URL-decode any escapes
        src_path = unquote(parsed.path)
        # Use cp for performance and simplicity
        rc = subprocess.call(['cp', '-p', src_path, out_path])
    else:
        # Use aria2c with resume, multiple connections, no auto-renaming
        cmd = [
            'aria2c', '-c', '-x16', '-s16', '-j5', '--auto-file-renaming=false',
            '-d', dest, '-o', name, url
        ]
        rc = subprocess.call(cmd)
    if rc != 0:
        print(f"[fetch-vms][ERROR] aria2c failed for {name}", file=sys.stderr)
        errors += 1
        continue

    # Verify checksum
    try:
        out = subprocess.check_output(['shasum', '-a', '256', out_path], text=True)
    except subprocess.CalledProcessError as e:
        print(f"[fetch-vms][ERROR] shasum failed for {name}: {e}", file=sys.stderr)
        errors += 1
        continue

    actual = out.strip().split()[0]
    if actual.lower() != sha256.lower():
        print(f"[fetch-vms][ERROR] checksum mismatch for {name}: {actual} != {sha256}", file=sys.stderr)
        errors += 1
    else:
        print(f"[fetch-vms] OK checksum for {name}")

sys.exit(1 if errors else 0)
PY

if [[ $? -ne 0 ]]; then
  err "One or more downloads failed or checksum mismatch."; exit 1
fi

if $DO_SYMLINK; then
  LINK_PATH="$HOME/Library/Application Support/VibeCode/vms"
  mkdir -p "$(dirname "$LINK_PATH")"
  if [[ -L "$LINK_PATH" || -e "$LINK_PATH" ]]; then
    # If existing symlink points elsewhere, update it; if directory, warn
    if [[ -L "$LINK_PATH" ]]; then
      rm -f "$LINK_PATH"
    elif [[ -d "$LINK_PATH" ]]; then
      echo "[fetch-vms][WARN] Directory exists at '$LINK_PATH'. Not replacing."
      echo "[fetch-vms][INFO] Point the app to: $DEST"
      exit 0
    else
      rm -f "$LINK_PATH"
    fi
  fi
  ln -s "$DEST" "$LINK_PATH"
  log "Symlink created: $LINK_PATH -> $DEST"
fi

log "All VM assets downloaded and verified into: $DEST"
