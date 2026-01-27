"""Download the minimal Alpine Linux kernel for ASIF test VMs."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Sequence
from urllib.request import urlopen


DEFAULT_VERSION = "3.20"
DEFAULT_ARCH = "aarch64"
DEFAULT_TARGET = Path("/tmp/asif-test")
DEFAULT_FALLBACK_RELEASE = "3.20.3"


@dataclass(frozen=True)
class AlpineConfig:
    version: str = DEFAULT_VERSION
    arch: str = DEFAULT_ARCH
    target_dir: Path = DEFAULT_TARGET

    @property
    def base_url(self) -> str:
        return f"https://dl-cdn.alpinelinux.org/alpine/v{self.version}/releases/{self.arch}"


def human_readable_size(path: Path) -> str:
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}" if unit != "B" else f"{size}B"
        size /= 1024
    return f"{size:.1f}TB"


def fetch_release_listing(url: str) -> str:
    with urlopen(url) as response:  # nosec B310 - trusted Alpine CDN
        return response.read().decode("utf-8", errors="replace")


def parse_iso_versions(listing: str) -> list[str]:
    pattern = re.compile(r"alpine-virt-([0-9.]+)-aarch64\.iso")
    versions = pattern.findall(listing)
    return sorted(set(versions), key=lambda v: [int(x) for x in v.split('.')])


def determine_release(config: AlpineConfig) -> str:
    try:
        html = fetch_release_listing(f"{config.base_url}/")
    except OSError:
        return DEFAULT_FALLBACK_RELEASE
    versions = parse_iso_versions(html)
    return versions[-1] if versions else DEFAULT_FALLBACK_RELEASE


def download_file(url: str, destination: Path) -> None:
    with urlopen(url) as response, destination.open("wb") as target:  # nosec B310
        shutil.copyfileobj(response, target)


def run_command(cmd: Sequence[str], cwd: Optional[Path] = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=False,
        capture_output=True,
        text=True,
    )


def find_kernel_candidate(boot_dir: Path) -> Optional[Path]:
    preferred = ["vmlinuz-virt", "vmlinuz-lts"]
    for candidate in preferred:
        path = boot_dir / candidate
        if path.exists():
            return path
    for path in boot_dir.glob("vmlinuz-*"):
        if path.is_file():
            return path
    return None


def extract_kernel(iso_path: Path, target_dir: Path) -> Path:
    if shutil.which("bsdtar") is None:
        raise RuntimeError("bsdtar is required to extract the Alpine ISO")
    run_command(["bsdtar", "-xf", iso_path.name, "boot/"], cwd=target_dir)
    boot_dir = target_dir / "boot"
    kernel = find_kernel_candidate(boot_dir)
    if kernel is None:
        raise RuntimeError("Unable to locate vmlinuz in extracted ISO")
    destination = target_dir / "vmlinuz"
    shutil.copy(kernel, destination)
    shutil.rmtree(boot_dir, ignore_errors=True)
    return destination


def ensure_target_dir(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)


def download_kernel(config: AlpineConfig) -> Path:
    ensure_target_dir(config.target_dir)
    kernel_path = config.target_dir / "vmlinuz"
    if kernel_path.exists():
        size = human_readable_size(kernel_path)
        print(f"✅ Kernel already exists: {kernel_path} ({size})")
        return kernel_path

    release = determine_release(config)
    iso_name = f"alpine-virt-{release}-{config.arch}.iso"
    iso_path = config.target_dir / iso_name
    iso_url = f"{config.base_url}/{iso_name}"
    print(f"📥 Downloading: {iso_name}")
    print(f"    URL: {iso_url}")
    download_file(iso_url, iso_path)
    print(f"✅ Downloaded {iso_name} ({human_readable_size(iso_path)})")
    kernel = extract_kernel(iso_path, config.target_dir)
    iso_path.unlink(missing_ok=True)
    print("🧹 Deleted ISO to save space")
    return kernel


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=DEFAULT_VERSION, help="Alpine version (default: %(default)s)")
    parser.add_argument("--arch", default=DEFAULT_ARCH, help="Target architecture (default: %(default)s)")
    parser.add_argument(
        "--target",
        default=str(DEFAULT_TARGET),
        help="Directory to store kernel (default: %(default)s)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    config = AlpineConfig(version=args.version, arch=args.arch, target_dir=Path(args.target))
    print("=== Downloading Minimal Alpine Kernel ===\n")
    print(f"Alpine Version: {config.version}")
    print(f"Architecture: {config.arch}")
    print(f"Target: {config.target_dir}\n")
    try:
        kernel_path = download_kernel(config)
    except Exception as exc:  # pragma: no cover - runtime failure path
        print(f"❌ {exc}")
        return 1
    size = human_readable_size(kernel_path)
    print("\n=== Download Complete ===\n")
    print(f"✅ Kernel: {kernel_path} ({size})\n")
    print("Next steps:")
    print("  1. ./scripts/vz/create-minimal-initramfs.sh")
    print("  2. ./scripts/vz/create-asif-disk.sh")
    print("  3. ./scripts/vz/asif-test-vm.swift")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

