#!/usr/bin/env python3
"""Build BusyBox with musl libc for static linking.

Creates a statically linked BusyBox binary suitable for minimal initramfs.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        detect_cpu_count,
        log,
        run_cmd,
        success,
        warn,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        detect_cpu_count,
        log,
        run_cmd,
        success,
        warn,
    )


DEFAULT_BUSYBOX_VERSION = "1.36.1"
BUSYBOX_URL_TEMPLATE = "https://busybox.net/downloads/busybox-{version}.tar.bz2"


def set_bool_config(config_path: Path, key: str, value: str) -> None:
    """Set a boolean config option in .config file."""
    content = config_path.read_text()

    # Try to replace existing setting
    if f"{key}=" in content:
        lines = content.split("\n")
        new_lines = []
        for line in lines:
            if line.startswith(f"{key}="):
                new_lines.append(f"{key}={value}")
            else:
                new_lines.append(line)
        config_path.write_text("\n".join(new_lines))
    elif f"# {key} is not set" in content:
        content = content.replace(f"# {key} is not set", f"{key}={value}")
        config_path.write_text(content)
    else:
        # Append to file
        with open(config_path, "a") as f:
            f.write(f"\n{key}={value}\n")


def set_string_config(config_path: Path, key: str, value: str) -> None:
    """Set a string config option in .config file."""
    content = config_path.read_text()

    if f'{key}="' in content:
        lines = content.split("\n")
        new_lines = []
        for line in lines:
            if line.startswith(f'{key}="'):
                new_lines.append(f'{key}="{value}"')
            else:
                new_lines.append(line)
        config_path.write_text("\n".join(new_lines))
    elif f"# {key} is not set" in content:
        content = content.replace(f"# {key} is not set", f'{key}="{value}"')
        config_path.write_text(content)
    else:
        with open(config_path, "a") as f:
            f.write(f'\n{key}="{value}"\n')


def disable_config(config_path: Path, key: str) -> None:
    """Disable a config option in .config file."""
    content = config_path.read_text()

    if f"{key}=" in content:
        lines = content.split("\n")
        new_lines = []
        for line in lines:
            if line.startswith(f"{key}="):
                new_lines.append(f"# {key} is not set")
            else:
                new_lines.append(line)
        config_path.write_text("\n".join(new_lines))
    elif f"# {key} is not set" not in content:
        with open(config_path, "a") as f:
            f.write(f"\n# {key} is not set\n")


def download_busybox(build_root: Path, version: str) -> Path:
    """Download BusyBox source tarball.

    Returns:
        Path to extracted source directory
    """
    tarball = f"busybox-{version}.tar.bz2"
    tarball_path = build_root / tarball
    url = BUSYBOX_URL_TEMPLATE.format(version=version)
    src_dir = build_root / f"busybox-{version}"

    if not tarball_path.exists():
        log(f"Downloading BusyBox {version}...")
        run_cmd(["curl", "-LO", url], cwd=build_root)

    if not src_dir.exists():
        log("Extracting BusyBox source...")
        run_cmd(["tar", "-xf", tarball], cwd=build_root)

    return src_dir


def configure_busybox(src_dir: Path, arch: str) -> None:
    """Configure BusyBox for static musl build."""
    log("Configuring BusyBox...")

    # Clean previous build
    run_cmd(["make", "distclean"], cwd=src_dir, check=False)

    # Start with defconfig
    run_cmd(["make", "defconfig"], cwd=src_dir)

    config_path = src_dir / ".config"

    # Enable static linking
    set_bool_config(config_path, "CONFIG_STATIC", "y")

    # Enable essential features
    set_bool_config(config_path, "CONFIG_UDHCPC", "y")
    set_string_config(config_path, "CONFIG_UDHCPC_DEFAULT_SCRIPT", "/udhcpc.script")
    set_bool_config(config_path, "CONFIG_IP", "y")
    set_bool_config(config_path, "CONFIG_SH_IS_ASH", "y")
    set_bool_config(config_path, "CONFIG_ASH", "y")
    set_bool_config(config_path, "CONFIG_LS", "y")
    set_bool_config(config_path, "CONFIG_CAT", "y")
    set_bool_config(config_path, "CONFIG_ECHO", "y")
    set_bool_config(config_path, "CONFIG_GREP", "y")
    set_bool_config(config_path, "CONFIG_TAR", "y")
    set_bool_config(config_path, "CONFIG_CP", "y")
    set_bool_config(config_path, "CONFIG_MKDIR", "y")
    set_bool_config(config_path, "CONFIG_MV", "y")
    set_bool_config(config_path, "CONFIG_RM", "y")
    set_bool_config(config_path, "CONFIG_PWD", "y")
    set_bool_config(config_path, "CONFIG_SLEEP", "y")
    set_bool_config(config_path, "CONFIG_INIT", "y")
    set_bool_config(config_path, "CONFIG_PING", "y")

    # Disable unnecessary features
    disable_config(config_path, "CONFIG_TC")
    disable_config(config_path, "CONFIG_FEATURE_IP_TUNNEL")
    disable_config(config_path, "CONFIG_FEATURE_SYSLOG")
    disable_config(config_path, "CONFIG_FEATURE_IPV6")
    disable_config(config_path, "CONFIG_SYSLOGD")
    disable_config(config_path, "CONFIG_KLOGD")

    # Run oldconfig with default answers
    proc = subprocess.Popen(
        ["make", "oldconfig"],
        cwd=src_dir,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Send newlines to accept defaults
    proc.communicate(input=b"\n" * 1000)


def build_busybox(src_dir: Path, arch: str, jobs: int) -> None:
    """Build BusyBox."""
    log(f"Building BusyBox with {jobs} jobs...")

    cross_args = []
    if arch == "arm64":
        cross_args = ["ARCH=arm64", "CROSS_COMPILE=aarch64-linux-gnu-"]
    elif arch == "armv7":
        cross_args = ["ARCH=arm", "CROSS_COMPILE=arm-linux-gnueabihf-"]

    run_cmd(
        ["make", f"-j{jobs}"] + cross_args,
        cwd=src_dir,
    )


def install_busybox(src_dir: Path, build_root: Path, arch: str) -> None:
    """Install BusyBox to rootfs."""
    rootfs_dir = build_root / "rootfs"
    log(f"Installing BusyBox to {rootfs_dir}...")

    cross_args = []
    if arch == "arm64":
        cross_args = ["ARCH=arm64", "CROSS_COMPILE=aarch64-linux-gnu-"]
    elif arch == "armv7":
        cross_args = ["ARCH=arm", "CROSS_COMPILE=arm-linux-gnueabihf-"]

    run_cmd(
        ["make", "install", f"CONFIG_PREFIX={rootfs_dir}"] + cross_args,
        cwd=src_dir,
    )


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "arch",
        nargs="?",
        default="x86_64",
        choices=["x86_64", "arm64", "armv7"],
        help="Target architecture (default: x86_64)",
    )
    parser.add_argument(
        "--version",
        default=os.environ.get("BUSYBOX_VERSION", DEFAULT_BUSYBOX_VERSION),
        help=f"BusyBox version (default: {DEFAULT_BUSYBOX_VERSION})",
    )
    parser.add_argument(
        "--jobs", "-j",
        type=int,
        default=detect_cpu_count(),
        help="Number of parallel jobs",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "busybox",
        help="Output directory",
    )

    args = parser.parse_args(argv)

    build_root = args.output_dir
    build_root.mkdir(parents=True, exist_ok=True)

    try:
        # Download source
        src_dir = download_busybox(build_root, args.version)

        # Configure
        configure_busybox(src_dir, args.arch)

        # Build
        build_busybox(src_dir, args.arch, args.jobs)

        # Install
        install_busybox(src_dir, build_root, args.arch)

        rootfs_dir = build_root / "rootfs"
        success(f"BusyBox rootfs stored in {rootfs_dir}")

        return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
