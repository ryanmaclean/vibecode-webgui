#!/usr/bin/env python3
"""Trim MicroVM Rootfs for Sub-10s Cold Boots.

Removes unnecessary files to optimize boot time.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import gzip
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from .benchmark_utils import (
        BenchmarkError,
        file_size_human,
        log,
        run_cmd,
        success,
        warn,
        error as log_error,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        BenchmarkError,
        file_size_human,
        log,
        run_cmd,
        success,
        warn,
        error as log_error,
    )


def get_dir_size(path: Path) -> int:
    """Get total size of a directory in bytes."""
    total = 0
    for p in path.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


def trim_rootfs(rootfs_work: Path) -> int:
    """Trim unnecessary files from rootfs.

    Returns:
        Number of bytes saved
    """
    original_size = get_dir_size(rootfs_work)
    log(f"Original size: {file_size_human(original_size)}")

    print()
    log("Trimming unnecessary files...")

    # Remove documentation
    for pattern in ["doc", "man", "info"]:
        for doc_dir in rootfs_work.rglob(pattern):
            if doc_dir.is_dir():
                shutil.rmtree(doc_dir, ignore_errors=True)
                print(f"  Removed: {doc_dir.relative_to(rootfs_work)}")

    # Remove locales (keep en_US only)
    locale_dir = rootfs_work / "usr" / "share" / "locale"
    if locale_dir.exists():
        for locale in locale_dir.iterdir():
            if locale.is_dir() and locale.name != "en_US":
                shutil.rmtree(locale, ignore_errors=True)
        print("  Trimmed locales (kept en_US only)")

    # Remove static libraries
    for lib in rootfs_work.rglob("*.a"):
        lib.unlink(missing_ok=True)
    print("  Removed static libraries")

    # Remove package manager caches
    for cache_dir in [
        rootfs_work / "var" / "cache" / "apt",
        rootfs_work / "var" / "cache" / "yum",
    ]:
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)
            print(f"  Cleared {cache_dir.name} cache")

    # Remove kernel sources
    src_dir = rootfs_work / "usr" / "src"
    if src_dir.exists():
        shutil.rmtree(src_dir, ignore_errors=True)
        print("  Removed kernel sources")

    # Remove development headers
    for header in rootfs_work.rglob("*.h"):
        if "include" in str(header):
            header.unlink(missing_ok=True)
    print("  Removed development headers")

    # Remove Python bytecode
    for pattern in ["*.pyc", "*.pyo", "__pycache__"]:
        for item in rootfs_work.rglob(pattern):
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink(missing_ok=True)
    print("  Removed Python bytecode")

    # Remove logs
    log_dir = rootfs_work / "var" / "log"
    if log_dir.exists():
        for log_file in log_dir.rglob("*"):
            if log_file.is_file():
                log_file.unlink(missing_ok=True)
        print("  Cleared logs")

    # Strip binaries
    print()
    log("Stripping binaries...")
    stripped = 0
    for f in rootfs_work.rglob("*"):
        if f.is_file() and os.access(f, os.X_OK):
            try:
                result = subprocess.run(
                    ["file", str(f)],
                    capture_output=True,
                    text=True,
                )
                if "ELF" in result.stdout:
                    subprocess.run(
                        ["strip", "--strip-unneeded", str(f)],
                        capture_output=True,
                    )
                    stripped += 1
            except Exception:
                pass
    print(f"  Stripped {stripped} executables")

    trimmed_size = get_dir_size(rootfs_work)
    savings = original_size - trimmed_size

    return savings


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "rootfs",
        type=Path,
        nargs="?",
        default=Path("artifacts/minivim/rootfs"),
        help="Rootfs directory or image file",
    )
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path("artifacts/minivim/rootfs-trimmed.img"),
        help="Output file path",
    )
    parser.add_argument(
        "--target-size-mb",
        type=int,
        default=int(os.environ.get("TARGET_SIZE_MB", 50)),
        help="Target size in MB",
    )

    args = parser.parse_args(argv)

    print("=== MicroVM Rootfs Trimming ===")
    print(f"Input: {args.rootfs}")
    print(f"Output: {args.output}")
    print(f"Target size: {args.target_size_mb}MB")
    print()

    if not args.rootfs.exists():
        log_error(f"Rootfs not found: {args.rootfs}")
        return 1

    work_dir = Path(tempfile.mkdtemp())

    try:
        # Extract if it's an image file
        if args.rootfs.is_file():
            log("Extracting rootfs image...")
            rootfs_work = work_dir / "rootfs"
            rootfs_work.mkdir()

            # Detect format and extract
            with open(args.rootfs, "rb") as f:
                magic = f.read(2)

            if magic == b"\x1f\x8b":
                # gzip compressed
                cpio_path = work_dir / "rootfs.cpio"
                with gzip.open(args.rootfs, "rb") as f_in:
                    with open(cpio_path, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)

                subprocess.run(
                    ["cpio", "-idm"],
                    cwd=rootfs_work,
                    stdin=open(cpio_path, "rb"),
                    capture_output=True,
                )
            elif magic[:2] in (b"07", b"70"):
                # cpio archive
                subprocess.run(
                    ["cpio", "-idm"],
                    cwd=rootfs_work,
                    stdin=open(args.rootfs, "rb"),
                    capture_output=True,
                )
            else:
                log_error("Unknown rootfs format")
                return 1
        else:
            rootfs_work = args.rootfs

        # Trim
        log("Analyzing rootfs...")
        original_size = get_dir_size(rootfs_work)
        savings = trim_rootfs(rootfs_work)
        trimmed_size = get_dir_size(rootfs_work)
        savings_pct = (savings / original_size * 100) if original_size > 0 else 0

        print()
        print("=== Trimming Results ===")
        print(f"Original: {file_size_human(original_size)}")
        print(f"Trimmed: {file_size_human(trimmed_size)}")
        print(f"Savings: {file_size_human(savings)} ({savings_pct:.0f}%)")

        # Create new rootfs image
        print()
        log("Creating trimmed rootfs image...")
        args.output.parent.mkdir(parents=True, exist_ok=True)

        # Create cpio archive
        find_proc = subprocess.Popen(
            ["find", "."],
            cwd=rootfs_work,
            stdout=subprocess.PIPE,
        )
        cpio_proc = subprocess.Popen(
            ["cpio", "-o", "-H", "newc"],
            cwd=rootfs_work,
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        gzip_proc = subprocess.Popen(
            ["gzip", "-9"],
            stdin=cpio_proc.stdout,
            stdout=subprocess.PIPE,
        )

        output_data, _ = gzip_proc.communicate()
        args.output.write_bytes(output_data)

        output_size = args.output.stat().st_size
        output_size_mb = output_size / (1024 * 1024)

        print(f"Output size: {file_size_human(output_size)}")

        if output_size_mb <= args.target_size_mb:
            success(f"Target size achieved (<={args.target_size_mb}MB)")
        else:
            warn(f"Target size not achieved (>{args.target_size_mb}MB)")
            warn("Consider more aggressive trimming or using busybox-only rootfs")

        print()
        success(f"Trimmed rootfs saved to: {args.output}")
        print()
        print("Next steps:")
        print("1. Test boot time with trimmed rootfs")
        print("2. Verify essential services still work")
        print("3. Measure cold boot performance improvement")

        return 0

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
