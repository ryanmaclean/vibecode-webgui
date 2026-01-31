#!/usr/bin/env python3
"""Build MiniVim kernel in Alpine Docker (avoids macOS Make issues).

This script builds the kernel inside an Alpine Docker container, which
avoids issues with macOS Make and provides a consistent build environment.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        log,
        run_cmd,
        success,
        error as log_error,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        log,
        run_cmd,
        success,
        error as log_error,
    )


DEFAULT_KERNEL_VERSION = "6.17.4"


def build_in_docker(arch: str, kernel_version: str) -> Path:
    """Build kernel inside Alpine Docker container.

    Args:
        arch: Target architecture (x86_64, arm64, armv7)
        kernel_version: Kernel version to build

    Returns:
        Path to built kernel image
    """
    if not check_command("docker"):
        raise BenchmarkError("Docker is required but not found")

    log(f"Building kernel {kernel_version} for {arch} in Alpine Docker...")

    # Determine kernel image name based on architecture
    if arch == "x86_64":
        kernel_target = "bzImage"
        kernel_path = "arch/x86/boot/bzImage"
        output_name = f"vmlinuz-{kernel_version}-musl"
    elif arch == "arm64":
        kernel_target = "Image"
        kernel_path = "arch/arm64/boot/Image"
        output_name = f"Image-{kernel_version}-musl"
    else:  # armv7
        kernel_target = "zImage"
        kernel_path = "arch/arm/boot/zImage"
        output_name = f"zImage-{kernel_version}-musl"

    # Build script to run inside Docker
    docker_script = f"""
apk add --no-cache build-base linux-headers flex bison bc perl elfutils-dev openssl-dev

mkdir -p artifacts/minivim/work
cd artifacts/minivim/work

# Download kernel if needed
if [ ! -d linux-{kernel_version} ]; then
  wget -q https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-{kernel_version}.tar.xz
  tar xf linux-{kernel_version}.tar.xz
  rm linux-{kernel_version}.tar.xz
fi

cd linux-{kernel_version}
make mrproper
make ARCH={arch} tinyconfig

# Merge kernel configs
scripts/kconfig/merge_config.sh -m .config \\
  /work/scripts/benchmarks/kernel-configs/minivim-base.config \\
  /work/scripts/benchmarks/kernel-configs/minivim-{arch}.config

yes '' | make ARCH={arch} olddefconfig
make ARCH={arch} -j$(nproc) {kernel_target}

# Copy output
mkdir -p /work/bench-images/minivim
cp {kernel_path} /work/bench-images/minivim/{output_name}

echo '=== Build Complete ==='
ls -lh /work/bench-images/minivim/{output_name}
"""

    run_cmd([
        "docker", "run", "--rm",
        "-v", f"{REPO_ROOT}:/work",
        "-w", "/work",
        "alpine:latest",
        "sh", "-c", docker_script,
    ])

    output_path = REPO_ROOT / "bench-images" / "minivim" / output_name
    if not output_path.exists():
        raise BenchmarkError(f"Build failed: {output_path} not found")

    return output_path


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
        "version",
        nargs="?",
        default=DEFAULT_KERNEL_VERSION,
        help=f"Kernel version (default: {DEFAULT_KERNEL_VERSION})",
    )

    args = parser.parse_args(argv)

    print(f"=== Building MiniVim Kernel in Docker ===")
    print(f"Architecture: {args.arch}")
    print(f"Kernel Version: {args.version}")
    print()

    try:
        output_path = build_in_docker(args.arch, args.version)

        print()
        print("=== Build Complete ===")
        print(f"Output: {output_path}")
        print(f"Size: {output_path.stat().st_size / (1024*1024):.2f} MB")
        print()
        print("To test with QEMU:")
        print(f"  qemu-system-{args.arch} -kernel {output_path} ...")

        return 0

    except BenchmarkError as err:
        log_error(str(err))
        return 1


if __name__ == "__main__":
    sys.exit(main())
