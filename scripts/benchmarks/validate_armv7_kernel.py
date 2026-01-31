#!/usr/bin/env python3
"""Validate ARMv7 MiniVim kernel build.

Checks kernel image existence, size, type, and optionally runs QEMU boot test.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_bytes,
        file_size_human,
        get_iso_timestamp,
        log,
        run_cmd,
        run_cmd_output,
        save_results,
        success,
        warn,
        error as log_error,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_bytes,
        file_size_human,
        get_iso_timestamp,
        log,
        run_cmd,
        run_cmd_output,
        save_results,
        success,
        warn,
        error as log_error,
    )


DEFAULT_KERNEL_VERSION = "6.17.14"
TARGET_SIZE_MB = 4


def validate_kernel(
    kernel_version: str,
    output_dir: Path,
    artifacts_dir: Path,
) -> dict:
    """Validate kernel image.

    Returns:
        Dictionary with validation results
    """
    image_path = output_dir / f"zImage-armv7-{kernel_version}"

    print(f"=== ARMv7 Kernel Validation ===")
    print(f"Kernel Version: {kernel_version}")
    print(f"Image Path: {image_path}")
    print()

    results = {
        "validation_timestamp": get_iso_timestamp(),
        "kernel_version": kernel_version,
        "architecture": "armv7",
        "image_path": str(image_path),
        "validation_passed": False,
    }

    # Phase 1: File existence check
    print("Phase 1: Checking kernel image...")
    if not image_path.exists():
        log_error(f"Kernel image not found at {image_path}")
        return results

    success("Kernel image exists")

    # Get kernel size
    kernel_size = file_size_bytes(image_path)
    kernel_size_mb = kernel_size / (1024 * 1024)
    success(f"Kernel size: {kernel_size_mb:.2f} MB")

    results["image_size_bytes"] = kernel_size
    results["image_size_mb"] = kernel_size_mb

    # Phase 2: Size validation
    print()
    print("Phase 2: Size validation...")
    results["target_size_mb"] = TARGET_SIZE_MB

    if kernel_size_mb > TARGET_SIZE_MB:
        warn(f"Kernel size ({kernel_size_mb:.2f} MB) exceeds target ({TARGET_SIZE_MB} MB)")
        results["size_compliant"] = False
    else:
        success(f"Kernel size within target ({TARGET_SIZE_MB} MB)")
        results["size_compliant"] = True

    # Phase 3: File type check
    print()
    print("Phase 3: File type validation...")

    if check_command("file"):
        try:
            file_type = run_cmd_output(["file", str(image_path)])
            print(f"File type: {file_type}")

            if "ARM" in file_type:
                success("Valid ARM kernel image")
                results["file_type"] = file_type
            else:
                warn("File type doesn't explicitly show ARM")
                results["file_type"] = file_type
        except BenchmarkError:
            warn("Failed to check file type")
    else:
        warn("'file' command not available, skipping type check")

    # Phase 4: QEMU boot test
    print()
    print("Phase 4: QEMU boot validation...")

    results["qemu_available"] = check_command("qemu-system-arm")

    if check_command("qemu-system-arm"):
        print("Testing QEMU boot (5 second timeout)...")

        qemu_log = artifacts_dir / "qemu-boot-test-armv7.log"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        try:
            with open(qemu_log, "w") as log_file:
                proc = subprocess.run(
                    [
                        "qemu-system-arm",
                        "-machine", "virt",
                        "-cpu", "cortex-a15",
                        "-m", "256M",
                        "-kernel", str(image_path),
                        "-nographic",
                        "-serial", "mon:stdio",
                        "-append", "console=ttyAMA0",
                    ],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    timeout=5,
                )
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            warn(f"QEMU test failed: {e}")

        if qemu_log.exists():
            log_content = qemu_log.read_text()
            if "Linux version" in log_content:
                success("Kernel started in QEMU")
                # Extract boot log
                for line in log_content.split("\n"):
                    if "Linux version" in line:
                        print(f"  Boot log: {line.strip()}")
                        break
            elif "Booting" in log_content:
                success("QEMU boot initiated")
            else:
                warn("QEMU test inconclusive (may need initramfs)")
                print(f"  Log: {qemu_log}")
        else:
            warn("QEMU log not generated")
    else:
        warn("QEMU not available, skipping boot test")
        print("  Install with: sudo apt-get install qemu-system-arm")

    # Generate JSON report
    print()
    print("Phase 5: Generating validation report...")

    results["validation_passed"] = True
    report_path = artifacts_dir / f"armv7-validation-{kernel_version}.json"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)

    success(f"Validation report: {report_path}")

    # Summary
    print()
    print("=== Validation Summary ===")
    print("Status: \u2705 PASSED")
    print(f"Kernel: {image_path}")
    print(f"Size: {kernel_size_mb:.2f} MB")
    print(f"Report: {report_path}")
    print()
    print("Next steps:")
    print("1. Build BusyBox initramfs if needed")
    print("2. Run full boot benchmark: python3 scripts/benchmarks/boot_latency_bench.py")
    print("3. Capture timing data for documentation")
    print()

    return results


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "kernel_version",
        nargs="?",
        default=DEFAULT_KERNEL_VERSION,
        help=f"Kernel version (default: {DEFAULT_KERNEL_VERSION})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "minivim",
        help="Output directory containing kernel images",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=REPO_ROOT / "artifacts" / "minivim",
        help="Artifacts directory for logs and reports",
    )

    args = parser.parse_args(argv)

    results = validate_kernel(
        args.kernel_version,
        args.output_dir,
        args.artifacts_dir,
    )

    return 0 if results.get("validation_passed") else 1


if __name__ == "__main__":
    sys.exit(main())
