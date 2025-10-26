#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DOWNLOAD_DIR="$ROOT_DIR/fast-openvscode-vm/downloads"
mkdir -p "$DOWNLOAD_DIR"

usage() {
  cat <<USAGE
Usage: $0 [version]

Fetch the specified Gitpod OpenVSCode Server release into fast-openvscode-vm/downloads/.
If no version is provided, the latest GitHub release is used.

Examples:
  $0                # download latest release
  $0 v1.105.1       # download an explicit tag

Environment variables:
  GITHUB_TOKEN      Optional token to increase GitHub API rate limits.
USAGE
}

API_BASE="https://api.github.com/repos/gitpod-io/openvscode-server"
VERSION_INPUT=${1:-${OPENVSCODE_VERSION:-latest}}

fetch_release_json() {
  local endpoint
  if [[ "$VERSION_INPUT" == "latest" ]]; then
    endpoint="$API_BASE/releases/latest"
  else
    endpoint="$API_BASE/releases/tags/$VERSION_INPUT"
  fi
  local -a auth=()
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth=("-H" "Authorization: Bearer $GITHUB_TOKEN")
  fi
  if (( ${#auth[@]} > 0 )); then
    curl -sSf "${auth[@]}" "$endpoint"
  else
    curl -sSf "$endpoint"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

release_json=$(fetch_release_json)
export RELEASE_JSON="$release_json"
read -r resolved_version download_url < <(python3 - "$VERSION_INPUT" <<'PY'
import json
import os
import sys

version_arg = sys.argv[1]
release = json.loads(os.environ['RELEASE_JSON'])

if version_arg == 'latest':
    tag = release.get('tag_name')
elif version_arg.startswith('openvscode-server-'):
    tag = version_arg
else:
    tag = f"openvscode-server-{version_arg}"

if not tag:
    raise SystemExit('error: unable to determine release tag')

version_suffix = tag.replace('openvscode-server-', '', 1)
asset_name = f"openvscode-server-{version_suffix}-linux-x64.tar.gz"
assets = release.get('assets') or []
for asset in assets:
    if asset.get('name') == asset_name:
        print(f"{version_suffix} {asset.get('browser_download_url')}")
        break
else:
    if version_arg == 'latest':
        url = f"https://github.com/gitpod-io/openvscode-server/releases/download/{tag}/{asset_name}"
        print(f"{version_suffix} {url}")
    else:
        raise SystemExit('error: matching asset not found in release JSON')
PY
)
unset RELEASE_JSON

if [[ -z "$resolved_version" || -z "$download_url" ]]; then
  echo "error: failed to resolve release asset" >&2
  exit 1
fi

tarball="openvscode-server-${resolved_version}-linux-x64.tar.gz"
output_path="$DOWNLOAD_DIR/$tarball"

if [[ -f "$output_path" ]]; then
  echo "info: $tarball already exists; skipping download"
else
  echo "Downloading $tarball"
  curl -L "$download_url" -o "$output_path"
fi

sha_path="$output_path.sha256"
sha_value=$(shasum -a 256 "$output_path" | awk '{print $1}')
printf '%s  %s\n' "$sha_value" "$tarball" > "$sha_path"
echo "SHA256    $sha_value"

echo "Saved artifacts:"
echo "  $output_path"
echo "  $sha_path"
