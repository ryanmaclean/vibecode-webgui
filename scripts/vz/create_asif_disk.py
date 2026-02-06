#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "vz-create-asif-disk"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "virtualization"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Create Apple Sparse Image Format (ASIF) disk for VMs.

ASIF is Apple's native sparse disk image format designed for VM storage
with the Virtualization framework.

Benefits:
- Native VZ framework integration
- Space efficient (only allocates blocks as data is written)
- APFS optimized (CoW, snapshots, cloning)
- Fast provisioning (seconds vs minutes for pre-allocated)

Usage:
    ./scripts/vz/create_asif_disk.py [--size SIZE] [--name NAME] [OUTPUT_DIR]
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
import os
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEST_DIR = Path("/tmp/asif-test")
DEFAULT_SIZE = "100m"  # 100MB default for test VMs
DEFAULT_VOLUME_NAME = "VM-Data"


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "K", "M", "G"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}T"


def get_actual_disk_usage(path: Path) -> int:
    """Get actual disk usage in bytes (sparse-aware)."""
    result = run_cmd(["du", "-k", str(path)], check=False)
    if result.returncode == 0 and result.stdout.strip():
        try:
            # du -k returns size in 1K blocks
            return int(result.stdout.split()[0]) * 1024
        except (ValueError, IndexError):
            pass
    return path.stat().st_size


def get_disk_info(path: Path) -> dict[str, str]:
    """Get detailed info about an ASIF image using hdiutil."""
    info = {}

    result = run_cmd(["hdiutil", "imageinfo", str(path)], check=False)
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if ":" in line:
                key, _, value = line.partition(":")
                info[key.strip()] = value.strip()

    return info


def create_asif_disk(
    output_path: Path,
    size: str,
    volume_name: str = DEFAULT_VOLUME_NAME,
    force: bool = False,
) -> bool:
    """Create an ASIF disk image.

    Args:
        output_path: Path to create the disk image (without extension)
        size: Size specification (e.g., "100m", "10g", "1t")
        volume_name: Volume name for the disk
        force: Overwrite existing file

    Returns:
        True if successful, False otherwise
    """
    # diskutil adds .sparseimage extension
    final_path = output_path.with_suffix(".sparseimage")

    if final_path.exists():
        if force:
            print(f"Removing existing: {final_path}")
            final_path.unlink()
        else:
            print(f"ASIF disk already exists: {final_path}")
            size_str = get_file_size_human(final_path)
            actual = get_actual_disk_usage(final_path)
            actual_str = f"{actual / 1024 / 1024:.1f}M"
            print(f"  Logical size: {size_str}")
            print(f"  Actual usage: {actual_str}")
            return True

    print(f"Creating ASIF disk image...")
    print(f"  Output: {final_path}")
    print(f"  Max size: {size}")
    print(f"  Volume name: {volume_name}")
    print()

    # Check for diskutil
    if not shutil.which("diskutil"):
        print("Error: diskutil not found (macOS required)")
        return False

    # Create the ASIF image using diskutil
    # Note: diskutil image create requires the path WITHOUT extension
    result = run_cmd(
        [
            "diskutil",
            "image",
            "create",
            "-size", size,
            "-format", "SPARSE",  # SPARSE creates .sparseimage (ASIF format)
            "-volname", volume_name,
            str(output_path.with_suffix("")),  # Remove any extension
        ],
        check=False,
    )

    if result.returncode != 0:
        print(f"Error creating ASIF disk: {result.stderr}")

        # Try alternative method with hdiutil
        print("Trying alternative method with hdiutil...")
        result = run_cmd(
            [
                "hdiutil",
                "create",
                "-size", size,
                "-type", "SPARSE",
                "-fs", "APFS",
                "-volname", volume_name,
                str(output_path.with_suffix("")),
            ],
            check=False,
        )

        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return False

    # Verify creation
    if not final_path.exists():
        # Check if it was created with a different extension
        alt_path = output_path.with_suffix(".sparseimage")
        if alt_path.exists():
            final_path = alt_path
        else:
            print("Error: ASIF disk was not created")
            return False

    print(f"Created ASIF disk: {final_path}")

    # Show space efficiency
    logical_size = final_path.stat().st_size
    actual_usage = get_actual_disk_usage(final_path)

    print()
    print("Space efficiency:")
    print(f"  Logical size: {get_file_size_human(final_path)}")
    print(f"  Actual usage: {actual_usage / 1024 / 1024:.1f}M")

    if logical_size > 0:
        efficiency = (1 - actual_usage / logical_size) * 100
        print(f"  Savings: {efficiency:.1f}%")

    return True


def resize_asif_disk(path: Path, new_size: str) -> bool:
    """Resize an ASIF disk image (grow only).

    Args:
        path: Path to the ASIF disk
        new_size: New size specification (e.g., "20g")

    Returns:
        True if successful, False otherwise
    """
    if not path.exists():
        print(f"Error: File not found: {path}")
        return False

    print(f"Resizing ASIF disk to {new_size}...")

    result = run_cmd(
        ["hdiutil", "resize", "-size", new_size, str(path)],
        check=False,
    )

    if result.returncode != 0:
        print(f"Error resizing: {result.stderr}")
        return False

    print(f"Resized: {path}")
    return True


def compact_asif_disk(path: Path) -> bool:
    """Compact an ASIF disk to reclaim unused space.

    Args:
        path: Path to the ASIF disk

    Returns:
        True if successful, False otherwise
    """
    if not path.exists():
        print(f"Error: File not found: {path}")
        return False

    before_size = get_actual_disk_usage(path)

    print(f"Compacting ASIF disk...")
    print(f"  Before: {before_size / 1024 / 1024:.1f}M")

    result = run_cmd(["hdiutil", "compact", str(path)], check=False)

    if result.returncode != 0:
        print(f"Error compacting: {result.stderr}")
        return False

    after_size = get_actual_disk_usage(path)
    saved = before_size - after_size

    print(f"  After: {after_size / 1024 / 1024:.1f}M")
    print(f"  Saved: {saved / 1024 / 1024:.1f}M")

    return True


def show_disk_info(path: Path) -> None:
    """Display detailed information about an ASIF disk."""
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    print(f"ASIF Disk Information: {path}")
    print()

    # Basic file info
    logical_size = path.stat().st_size
    actual_usage = get_actual_disk_usage(path)

    print(f"Logical size: {get_file_size_human(path)}")
    print(f"Actual usage: {actual_usage / 1024 / 1024:.1f}M")

    if logical_size > 0:
        efficiency = (1 - actual_usage / logical_size) * 100
        print(f"Space savings: {efficiency:.1f}%")

    # Detailed info from hdiutil
    info = get_disk_info(path)
    if info:
        print()
        print("Image properties:")
        for key in ["Format", "Type", "Compressed", "Partition Table"]:
            if key in info:
                print(f"  {key}: {info[key]}")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        nargs="?",
        default=DEFAULT_TEST_DIR,
        help=f"Output directory (default: {DEFAULT_TEST_DIR})",
    )
    parser.add_argument(
        "-s", "--size",
        default=DEFAULT_SIZE,
        help=f"Disk size (e.g., 100m, 10g, 1t) (default: {DEFAULT_SIZE})",
    )
    parser.add_argument(
        "-n", "--name",
        default="asif-disk",
        help="Disk image filename (without extension)",
    )
    parser.add_argument(
        "-v", "--volume-name",
        default=DEFAULT_VOLUME_NAME,
        help=f"Volume name (default: {DEFAULT_VOLUME_NAME})",
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Overwrite existing disk",
    )
    parser.add_argument(
        "--resize",
        metavar="SIZE",
        help="Resize existing disk to new size",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Compact disk to reclaim unused space",
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Show disk information",
    )

    args = parser.parse_args(argv)

    # Check platform
    if sys.platform != "darwin":
        print("Error: ASIF format is macOS-specific")
        print("       This script requires macOS with diskutil/hdiutil")
        return 1

    output_dir = args.output_dir
    disk_path = output_dir / args.name

    # Handle info command
    if args.info:
        show_disk_info(disk_path.with_suffix(".sparseimage"))
        return 0

    # Handle compact command
    if args.compact:
        success = compact_asif_disk(disk_path.with_suffix(".sparseimage"))
        return 0 if success else 1

    # Handle resize command
    if args.resize:
        success = resize_asif_disk(disk_path.with_suffix(".sparseimage"), args.resize)
        return 0 if success else 1

    # Create disk
    print("=== Creating ASIF Disk for VM ===")
    print()
    print(f"Output directory: {output_dir}")
    print()

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    success = create_asif_disk(
        output_path=disk_path,
        size=args.size,
        volume_name=args.volume_name,
        force=args.force,
    )

    if not success:
        return 1

    print()
    print("=== ASIF Disk Ready ===")
    print()
    print(f"Disk: {disk_path.with_suffix('.sparseimage')}")
    print()
    print("Next steps:")
    print("  1. ./scripts/vz/download-alpine-minimal.sh")
    print("  2. ./scripts/vz/create-minimal-initramfs.sh")
    print("  3. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())