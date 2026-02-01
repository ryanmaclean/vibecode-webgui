#!/usr/bin/env python3
"""Build EFI-stub kernel for Apple Virtualization Framework fast boot.

The EFI-stub kernel boots directly from EFI without GRUB.
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
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        detect_cpu_count,
        detect_make_binary,
        file_size_human,
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
        detect_cpu_count,
        detect_make_binary,
        file_size_human,
        log,
        run_cmd,
        success,
        error as log_error,
    )


DEFAULT_KERNEL_VERSION = "6.12.10"
KERNEL_URL_TEMPLATE = "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-{version}.tar.xz"


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "arch",
        nargs="?",
        default="arm64",
        choices=["arm64"],
        help="Target architecture (only arm64 supported for Apple VF)",
    )
    parser.add_argument(
        "version",
        nargs="?",
        default=DEFAULT_KERNEL_VERSION,
        help=f"Kernel version (default: {DEFAULT_KERNEL_VERSION})",
    )
    parser.add_argument(
        "--jobs", "-j",
        type=int,
        default=int(os.environ.get("KERNEL_JOBS", detect_cpu_count())),
        help="Number of parallel jobs",
    )
    parser.add_argument(
        "--skip-mrproper",
        action="store_true",
        default=os.environ.get("SKIP_MRPROPER") == "1",
        help="Skip make mrproper",
    )

    args = parser.parse_args(argv)

    if args.arch != "arm64":
        log_error("Apple VF on Apple Silicon requires arm64 architecture")
        return 1

    build_root = REPO_ROOT / "bench-images" / "apple-vf-fastboot"
    src_dir = build_root / f"linux-{args.version}"
    config_dir = REPO_ROOT / "scripts" / "benchmarks" / "kernel-configs"
    output_dir = build_root
    make_bin = detect_make_binary()

    print(f"=== Building EFI-stub Kernel for Apple VF ===")
    print(f"Architecture: {args.arch}")
    print(f"Kernel version: {args.version}")
    print()

    build_root.mkdir(parents=True, exist_ok=True)

    try:
        # Download kernel source
        tarball = f"linux-{args.version}.tar.xz"
        tarball_path = build_root / tarball
        url = KERNEL_URL_TEMPLATE.format(version=args.version)

        if not tarball_path.exists():
            log("Downloading kernel source...")
            run_cmd(["curl", "-L", url, "-o", str(tarball_path)])

        if not src_dir.exists():
            log("Extracting kernel source...")
            run_cmd(["tar", "-C", str(build_root), "--no-same-owner", "-xf", str(tarball_path)])

        os.chdir(src_dir)

        # Clean previous build
        if not args.skip_mrproper:
            run_cmd([make_bin, "ARCH=arm64", "mrproper"])

        # Configure kernel
        log("Configuring kernel...")
        run_cmd([make_bin, "ARCH=arm64", "defconfig"])

        # Merge config fragments
        config_files = [
            config_dir / "minivim-base.config",
            config_dir / "minivim-arm64.config",
            config_dir / "efi-stub-arm64.config",
        ]

        for config_file in config_files:
            if config_file.exists():
                run_cmd([
                    str(src_dir / "scripts/kconfig/merge_config.sh"),
                    "-m", ".config", str(config_file),
                ])

        # Ensure EFI-stub is enabled
        config_script = str(src_dir / "scripts/config")
        for opt in ["EFI", "EFI_STUB", "EFI_GENERIC_STUB"]:
            run_cmd([config_script, "--enable", opt])

        # Additional size optimizations
        run_cmd([config_script, "--enable", "CC_OPTIMIZE_FOR_SIZE"])
        run_cmd([config_script, "--disable", "DEBUG_KERNEL"])
        run_cmd([config_script, "--disable", "DEBUG_INFO"])
        run_cmd([config_script, "--disable", "MODULES"])

        # Fast boot optimizations
        run_cmd([config_script, "--enable", "PRINTK"])
        run_cmd([config_script, "--set-str", "DEFAULT_INIT", "/init"])

        # Finalize config
        run_cmd([make_bin, "ARCH=arm64", "olddefconfig"])

        print()
        log("Building kernel (this may take several minutes)...")
        run_cmd([make_bin, "ARCH=arm64", f"-j{args.jobs}", "Image"])

        # Copy output
        output_path = output_dir / "vmlinux-efi-stub"
        run_cmd(["cp", "arch/arm64/boot/Image", str(output_path)])

        kernel_size = output_path.stat().st_size

        print()
        print("=== Build Complete ===")
        print(f"Kernel: {output_path}")
        print(f"Size: {file_size_human(kernel_size)}")
        print()
        print("To test fast boot:")
        print(f"  APPLEVF_KERNEL={output_path} \\")
        print("  ./scripts/benchmarks/applevf_fastboot_bench.sh bench 5")

        return 0

    except BenchmarkError as err:
        log_error(str(err))
        return 1


if __name__ == "__main__":
    sys.exit(main())
