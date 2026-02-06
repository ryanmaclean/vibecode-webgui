#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "fetch-openvscode-server"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "release"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Fetch Gitpod OpenVSCode Server release.

Fetch the specified Gitpod OpenVSCode Server release into fast-openvscode-vm/downloads/.
If no version is provided, the latest GitHub release is used.

Examples:
    ./fetch_openvscode_server.py                # download latest release
    ./fetch_openvscode_server.py v1.105.1       # download an explicit tag

Environment variables:
    GITHUB_TOKEN      Optional token to increase GitHub API rate limits.
    ARCH              Architecture to download (x64 or arm64, default: auto-detect)
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
import urllib.request
from pathlib import Path


API_BASE = "https://api.github.com/repos/gitpod-io/openvscode-server"


def get_architecture() -> str:
    """Auto-detect architecture."""
    arch_env = os.environ.get("ARCH")
    if arch_env:
        return arch_env

    machine = platform.machine().lower()
    if machine in ("arm64", "aarch64"):
        return "arm64"
    elif machine in ("x86_64", "amd64"):
        return "x64"
    else:
        print(f"error: unsupported architecture {machine}", file=sys.stderr)
        sys.exit(1)


def fetch_release_json(version_input: str) -> dict:
    """Fetch release JSON from GitHub API."""
    if version_input == "latest":
        endpoint = f"{API_BASE}/releases/latest"
    else:
        endpoint = f"{API_BASE}/releases/tags/{version_input}"

    headers = {"User-Agent": "fetch-openvscode-server"}
    github_token = os.environ.get("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    request = urllib.request.Request(endpoint, headers=headers)

    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"error: failed to fetch release info: {e}", file=sys.stderr)
        sys.exit(1)


def resolve_release_asset(
    release: dict,
    version_input: str,
    arch: str,
) -> tuple[str, str]:
    """Resolve release version and download URL."""
    if version_input == "latest":
        tag = release.get("tag_name")
    elif version_input.startswith("openvscode-server-"):
        tag = version_input
    else:
        tag = f"openvscode-server-{version_input}"

    if not tag:
        print("error: unable to determine release tag", file=sys.stderr)
        sys.exit(1)

    version_suffix = tag.replace("openvscode-server-", "", 1)
    asset_name = f"openvscode-server-{version_suffix}-linux-{arch}.tar.gz"

    assets = release.get("assets") or []
    for asset in assets:
        if asset.get("name") == asset_name:
            return version_suffix, asset.get("browser_download_url")

    # Fallback: construct URL if asset not found in release JSON
    if version_input == "latest":
        url = f"https://github.com/gitpod-io/openvscode-server/releases/download/{tag}/{asset_name}"
        return version_suffix, url

    print("error: matching asset not found in release JSON", file=sys.stderr)
    sys.exit(1)


def download_file(url: str, output_path: Path) -> None:
    """Download a file from URL."""
    # Use curl for better progress display and resume support
    subprocess.run(
        ["curl", "-L", url, "-o", str(output_path)],
        check=True,
    )


def compute_sha256(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "version",
        nargs="?",
        default=os.environ.get("OPENVSCODE_VERSION", "latest"),
        help="Version to download (default: latest)",
    )

    args = parser.parse_args()

    # Setup paths
    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent.parent
    download_dir = root_dir / "fast-openvscode-vm" / "downloads"
    download_dir.mkdir(parents=True, exist_ok=True)

    # Get architecture
    arch = get_architecture()

    # Fetch release info
    version_input = args.version

    # Handle tag format for API query
    if version_input != "latest" and not version_input.startswith("openvscode-server-"):
        api_version = f"openvscode-server-{version_input}"
    else:
        api_version = version_input

    release_json = fetch_release_json(api_version)

    # Resolve version and download URL
    resolved_version, download_url = resolve_release_asset(
        release_json,
        version_input,
        arch,
    )

    if not resolved_version or not download_url:
        print("error: failed to resolve release asset", file=sys.stderr)
        return 1

    # Download tarball
    tarball = f"openvscode-server-{resolved_version}-linux-{arch}.tar.gz"
    output_path = download_dir / tarball

    if output_path.exists():
        print(f"info: {tarball} already exists; skipping download")
    else:
        print(f"Downloading {tarball} ({arch})...")
        download_file(download_url, output_path)

    # Compute and save SHA256
    sha_path = Path(f"{output_path}.sha256")
    sha_value = compute_sha256(output_path)
    sha_path.write_text(f"{sha_value}  {tarball}\n")

    print(f"SHA256    {sha_value}")
    print()
    print("Saved artifacts:")
    print(f"  {output_path}")
    print(f"  {sha_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())