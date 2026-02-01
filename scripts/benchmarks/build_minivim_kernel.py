#!/usr/bin/env python3
"""Build a minimal kernel + initramfs tuned for vi launch benchmarks.

Usage:
    python build_minivim_kernel.py [x86_64|arm64|armv7] [kernel_version]
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


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
        detect_make_binary,
        log,
        run_cmd,
        success,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        detect_cpu_count,
        detect_make_binary,
        log,
        run_cmd,
        success,
    )


SUPPORTED_ARCHES = ["x86_64", "arm64", "armv7"]
DEFAULT_KERNEL_VERSION = "6.12.10"
KERNEL_URL_TEMPLATE = "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-{version}.tar.xz"


def download_kernel(build_root: Path, version: str) -> Path:
    """Download and extract kernel source.

    Returns:
        Path to extracted source directory
    """
    tarball = f"linux-{version}.tar.xz"
    tarball_path = build_root / tarball
    url = KERNEL_URL_TEMPLATE.format(version=version)
    src_dir = build_root / f"linux-{version}"

    if not tarball_path.exists():
        log(f"Downloading kernel {version}...")
        run_cmd(["curl", "-L", url, "-o", str(tarball_path)])

    if not src_dir.exists():
        log("Extracting kernel source...")
        run_cmd(["tar", "-C", str(build_root), "--no-same-owner", "-xf", str(tarball_path)])

    return src_dir


def save_cpu_info(build_root: Path, arch: str) -> None:
    """Save CPU information for the build."""
    cpu_info_file = build_root / f"cpuinfo-{arch}.txt"

    if check_command("lscpu"):
        try:
            result = run_cmd(["lscpu"], capture=True, check=False)
            cpu_info_file.write_text(result.stdout)
        except BenchmarkError:
            pass
    elif arch == "x86_64" and check_command("sysctl"):
        try:
            result = run_cmd(["sysctl", "-a"], capture=True, check=False)
            lines = [line for line in result.stdout.split("\n") if "machdep.cpu" in line]
            cpu_info_file.write_text("\n".join(lines))
        except BenchmarkError:
            pass


def configure_kernel(
    src_dir: Path,
    config_dir: Path,
    arch: str,
    make_bin: str,
    skip_mrproper: bool,
) -> None:
    """Configure the kernel."""
    log("Configuring kernel...")

    # Map arch to kernel arch
    kernel_arch = arch
    if arch == "armv7":
        kernel_arch = "arm"

    # Defconfig name
    defconfig_map = {
        "x86_64": "x86_64_defconfig",
        "arm64": "defconfig",
        "armv7": "multi_v7_defconfig",
    }
    defconfig = defconfig_map[arch]

    # Clean if needed
    if not skip_mrproper:
        run_cmd([make_bin, f"ARCH={kernel_arch}", "mrproper"], cwd=src_dir)

    # Run defconfig
    run_cmd([make_bin, f"ARCH={kernel_arch}", defconfig], cwd=src_dir)

    # Merge config fragments
    merge_files = [
        config_dir / "minivim-base.config",
        config_dir / f"minivim-{arch}.config",
    ]
    existing_files = [str(f) for f in merge_files if f.exists()]

    if existing_files:
        run_cmd(
            [str(src_dir / "scripts/kconfig/merge_config.sh"), "-m", ".config"] + existing_files,
            cwd=src_dir,
        )

    # Set initramfs source if available
    initramfs_src = REPO_ROOT / "bench-images" / "apple-vf" / "rootfs"
    if initramfs_src.is_dir():
        run_cmd(
            [str(src_dir / "scripts/config"), "--set-str", "INITRAMFS_SOURCE", str(initramfs_src)],
            cwd=src_dir,
        )

    # Finalize config
    run_cmd([make_bin, f"ARCH={kernel_arch}", "olddefconfig"], cwd=src_dir)

    # Extra config for x86_64
    if arch == "x86_64":
        run_cmd(
            [str(src_dir / "scripts/config"), "--disable", "UNWINDER_ORC", "--disable", "STACK_VALIDATION"],
            cwd=src_dir,
        )
        run_cmd([make_bin, f"ARCH={kernel_arch}", "olddefconfig"], cwd=src_dir)


def build_kernel(src_dir: Path, arch: str, make_bin: str, jobs: int) -> Path:
    """Build the kernel.

    Returns:
        Path to the built kernel image
    """
    log(f"Building kernel with {jobs} jobs...")

    # Map arch to kernel arch and target
    build_config = {
        "x86_64": {
            "kernel_arch": "x86_64",
            "target": "bzImage",
            "output_path": "arch/x86/boot/bzImage",
            "output_name": "bzImage",
        },
        "arm64": {
            "kernel_arch": "arm64",
            "target": "Image",
            "output_path": "arch/arm64/boot/Image",
            "output_name": "Image",
        },
        "armv7": {
            "kernel_arch": "arm",
            "target": "zImage",
            "output_path": "arch/arm/boot/zImage",
            "output_name": "zImage",
            "cross_compile": "arm-linux-gnueabihf-",
        },
    }

    config = build_config[arch]
    make_args = [make_bin, f"ARCH={config['kernel_arch']}", f"-j{jobs}", config["target"]]

    if "cross_compile" in config:
        make_args.insert(2, f"CROSS_COMPILE={config['cross_compile']}")

    run_cmd(make_args, cwd=src_dir)

    return src_dir / config["output_path"]


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
        choices=SUPPORTED_ARCHES,
        help=f"Target architecture (default: x86_64)",
    )
    parser.add_argument(
        "version",
        nargs="?",
        default=os.environ.get("KERNEL_VERSION", DEFAULT_KERNEL_VERSION),
        help=f"Kernel version (default: {DEFAULT_KERNEL_VERSION})",
    )
    parser.add_argument(
        "--skip-mrproper",
        action="store_true",
        default=bool(os.environ.get("SKIP_MRPROPER", "0") == "1"),
        help="Skip make mrproper (for incremental builds)",
    )
    parser.add_argument(
        "--jobs", "-j",
        type=int,
        default=int(os.environ.get("MINIVIM_JOBS", detect_cpu_count())),
        help="Number of parallel jobs",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "minivim",
        help="Output directory for kernel image",
    )

    args = parser.parse_args(argv)

    build_root = args.output_dir
    config_dir = REPO_ROOT / "scripts" / "benchmarks" / "kernel-configs"
    make_bin = detect_make_binary()

    build_root.mkdir(parents=True, exist_ok=True)

    try:
        # Download kernel source
        src_dir = download_kernel(build_root, args.version)

        # Save CPU info
        save_cpu_info(build_root, args.arch)

        # Configure
        configure_kernel(src_dir, config_dir, args.arch, make_bin, args.skip_mrproper)

        # Build
        kernel_path = build_kernel(src_dir, args.arch, make_bin, args.jobs)

        # Copy artifacts
        output_name_map = {
            "x86_64": f"bzImage-{args.arch}-{args.version}",
            "arm64": f"Image-{args.arch}-{args.version}",
            "armv7": f"zImage-{args.arch}-{args.version}",
        }
        output_path = build_root / output_name_map[args.arch]

        run_cmd(["cp", str(kernel_path), str(output_path)])

        success(f"Kernel build complete. Artifacts saved in {build_root}.")
        log(f"Kernel image: {output_path}")

        return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
