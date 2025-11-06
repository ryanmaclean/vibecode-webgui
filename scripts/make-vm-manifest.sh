#!/usr/bin/env bash
# MIT License
# Generate a VM manifest JSON from a directory of VM assets (img + nvram)
# Computes SHA-256 for each file and constructs URLs using a provided base URL.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  make-vm-manifest.sh -s <source_dir> -b <base_url> -o <manifest.json>

Options:
  -s   Source directory containing VM files (e.g. vibecode-*.img and *-efi.nvram)
  -b   Base URL; will be prefixed to each filename (e.g. https://cdn.example.com/vms)
  -o   Output manifest path (JSON)

Example:
  make-vm-manifest.sh -s "/Volumes/tank3/vms" -b "https://cdn.example.com/vms" -o scripts/vm-manifest.json

Requires: shasum, python3
USAGE
}

SRC=""
BASE_URL=""
OUT=""

while getopts ":s:b:o:" opt; do
  case "$opt" in
    s) SRC="$OPTARG" ;;
    b) BASE_URL="$OPTARG" ;;
    o) OUT="$OPTARG" ;;
    *) usage; exit 1 ;;
  esac
done

if [[ -z "$SRC" || -z "$BASE_URL" || -z "$OUT" ]]; then
  usage; exit 1
fi

command -v shasum >/dev/null 2>&1 || { echo "[make-vm-manifest][ERROR] shasum not found" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[make-vm-manifest][ERROR] python3 not found" >&2; exit 1; }

if [[ ! -d "$SRC" ]]; then
  echo "[make-vm-manifest][ERROR] Source directory not found: $SRC" >&2
  exit 1
fi

# Gather files (img + nvram)
mapfile -t FILES < <(find "$SRC" -maxdepth 1 -type f \( -name "*.img" -o -name "*-efi.nvram" \) -print | sort)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "[make-vm-manifest][ERROR] No VM files found in $SRC" >&2
  exit 1
fi

echo "[make-vm-manifest] Found ${#FILES[@]} files"

# Build JSON via Python
python3 - "$OUT" "$BASE_URL" <<'PY'
import sys, json, os, subprocess
out = sys.argv[1]
base = sys.argv[2].rstrip('/')

# Read file list from stdin
files = [line.strip() for line in sys.stdin if line.strip()]
entries = []
for f in files:
    name = os.path.basename(f)
    try:
        sh = subprocess.check_output(['shasum', '-a', '256', f], text=True)
    except subprocess.CalledProcessError as e:
        print(f"[make-vm-manifest][ERROR] shasum failed for {f}: {e}", file=sys.stderr)
        sys.exit(1)
    sha = sh.strip().split()[0]
    url = f"{base}/{name}"
    entries.append({"name": name, "url": url, "sha256": sha})

manifest = {"vms": entries}
with open(out, 'w') as fh:
    json.dump(manifest, fh, indent=2)
print(f"[make-vm-manifest] Wrote manifest: {out}")
PY
