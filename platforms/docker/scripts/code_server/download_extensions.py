#!/usr/bin/env python3
"""
VS Code Extension Downloader

Downloads VS Code extensions from Open VSX for offline installation.

Usage:
    python download_extensions.py
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


def ensure_directory(path: Path) -> None:
    """Create directory if it doesn't exist."""
    path.mkdir(parents=True, exist_ok=True)


def get_latest_version(publisher: str, name: str) -> Optional[str]:
    """Get the latest version of an extension from Open VSX."""
    url = f"https://open-vsx.org/api/{publisher}/{name}"
    try:
        with urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())
            return data.get("version")
    except (URLError, HTTPError, json.JSONDecodeError) as e:
        print(f"Error getting version for {publisher}.{name}: {e}")
        return None


def download_extension(
    publisher: str,
    name: str,
    version: str = "latest",
    extensions_dir: Path = None,
) -> bool:
    """Download an extension from Open VSX."""
    if extensions_dir is None:
        extensions_dir = Path("docker/code-server/extensions-vsix")

    ensure_directory(extensions_dir)

    print(f"Downloading {publisher}.{name}...")

    # Get latest version if needed
    if version == "latest":
        version = get_latest_version(publisher, name)
        if version is None:
            print(f"  Failed to get latest version for {publisher}.{name}")
            return False

    # Download VSIX
    vsix_url = (
        f"https://open-vsx.org/api/{publisher}/{name}/{version}"
        f"/file/{publisher}.{name}-{version}.vsix"
    )
    vsix_path = extensions_dir / f"{publisher}.{name}-{version}.vsix"

    try:
        request = Request(vsix_url)
        with urlopen(request, timeout=120) as response:
            with open(vsix_path, "wb") as f:
                f.write(response.read())

        print(f"✓ Downloaded {publisher}.{name} v{version}")
        return True

    except HTTPError as e:
        print(f"  Failed to download {publisher}.{name}: HTTP {e.code}")
        return False
    except URLError as e:
        print(f"  Failed to download {publisher}.{name}: {e.reason}")
        return False


def download_all_extensions(extensions_dir: Optional[Path] = None) -> int:
    """Download all configured extensions."""
    if extensions_dir is None:
        extensions_dir = Path("docker/code-server/extensions-vsix")

    ensure_directory(extensions_dir)

    print("📦 Downloading extensions from Open VSX...")
    print()

    # AI extensions
    ai_extensions = [
        ("anthropic", "claude-code"),
        ("openai", "chatgpt"),
        ("GitHub", "copilot"),
        ("GitHub", "copilot-chat"),
        ("Codeium", "codeium"),
        ("saoudrizwan", "claude-dev"),
    ]

    # Development extensions
    dev_extensions = [
        ("ms-vscode", "vscode-typescript-next"),
        ("dbaeumer", "vscode-eslint"),
        ("esbenp", "prettier-vscode"),
        ("eamodio", "gitlens"),
    ]

    all_extensions = ai_extensions + dev_extensions
    success_count = 0

    for publisher, name in all_extensions:
        if download_extension(publisher, name, "latest", extensions_dir):
            success_count += 1

    print()
    print(f"✅ Downloaded {success_count}/{len(all_extensions)} extensions to {extensions_dir}")
    print()

    # List downloaded files
    print("Downloaded files:")
    for vsix_file in sorted(extensions_dir.glob("*.vsix")):
        size_mb = vsix_file.stat().st_size / (1024 * 1024)
        print(f"  {vsix_file.name} ({size_mb:.1f} MB)")

    return 0 if success_count == len(all_extensions) else 1


def main() -> int:
    """Main entry point."""
    return download_all_extensions()


if __name__ == "__main__":
    sys.exit(main())
