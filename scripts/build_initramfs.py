#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Initramfs Builder (Linux-native)

Converts build-initramfs.sh to Python with proper error handling and testability.
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import sys
from pathlib import Path


def check_source_directory(source_dir: Path) -> bool:
    """Check if source directory exists."""
    if not source_dir.exists():
        print(f"ERROR: {source_dir} not found")
        print("Mount with: docker run -v /path/to/initramfs:/build/source")
        return False
    return True


def list_directory(directory: Path) -> None:
    """List directory contents."""
    print("Checking initramfs structure...")
    for item in sorted(directory.iterdir()):
        stat = item.stat()
        print(f"  {item.name} ({stat.st_size} bytes)")


def check_critical_files(source_dir: Path) -> bool:
    """Check for required files."""
    print("\nChecking critical files...")

    critical_files = [
        ("init", "init script"),
        ("usr/bin/postgres", "postgres binary"),
        ("usr/bin/psql", "psql binary"),
    ]

    all_found = True
    for file_path, description in critical_files:
        full_path = source_dir / file_path
        if full_path.exists():
            print(f"  ✓ {description} found")
        else:
            print(f"  ✗ {description} missing")
            all_found = False

    return all_found


def check_dependencies(source_dir: Path) -> None:
    """Check for optional dependencies."""
    print("\nChecking dependencies...")

    optional_deps = [
        "usr/lib/aarch64-linux-gnu/libicuuc.so.74",
        "usr/lib/aarch64-linux-gnu/libzstd.so.1",
    ]

    for dep in optional_deps:
        full_path = source_dir / dep
        name = Path(dep).name
        if full_path.exists():
            print(f"  ✓ {name} found")
        else:
            print(f"  ⚠ {name} missing")


def build_initramfs(source_dir: Path, output_path: Path) -> bool:
    """Build initramfs using cpio and gzip."""
    print("\nBuilding initramfs with Linux-native tools...")

    try:
        # find . -print0 | cpio --null -o -H newc | gzip -9 > output
        find_proc = subprocess.Popen(
            ["find", ".", "-print0"],
            cwd=source_dir,
            stdout=subprocess.PIPE,
        )

        cpio_proc = subprocess.Popen(
            ["cpio", "--null", "-o", "-H", "newc"],
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
        )
        find_proc.stdout.close()

        with open(output_path, "wb") as f:
            gzip_proc = subprocess.Popen(
                ["gzip", "-9"],
                stdin=cpio_proc.stdout,
                stdout=f,
            )
            cpio_proc.stdout.close()
            gzip_proc.wait()

        cpio_proc.wait()
        find_proc.wait()

        return gzip_proc.returncode == 0
    except Exception as e:
        print(f"Build failed: {e}")
        return False


def verify_output(output_path: Path) -> bool:
    """Verify the output file."""
    print("\nVerifying output...")

    if not output_path.exists():
        print("  ✗ Output file not created")
        return False

    size = output_path.stat().st_size
    size_mb = size / (1024 * 1024)
    print(f"  {output_path.name}: {size_mb:.2f} MB")

    # Check magic bytes
    print("\nChecking magic bytes (should be gzip)...")
    result = subprocess.run(
        ["file", str(output_path)],
        capture_output=True,
        text=True,
    )
    print(f"  {result.stdout.strip()}")

    return "gzip" in result.stdout.lower()


def test_extraction(output_path: Path, test_dir: Path) -> bool:
    """Test extracting the initramfs."""
    print("\nTesting extraction...")

    test_dir.mkdir(parents=True, exist_ok=True)

    try:
        # gunzip -c output | cpio -idm
        gunzip_proc = subprocess.Popen(
            ["gunzip", "-c", str(output_path)],
            stdout=subprocess.PIPE,
        )

        cpio_proc = subprocess.Popen(
            ["cpio", "-idm"],
            cwd=test_dir,
            stdin=gunzip_proc.stdout,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        gunzip_proc.stdout.close()
        cpio_proc.wait()
        gunzip_proc.wait()

        if cpio_proc.returncode != 0:
            print("  ✗ Extraction failed")
            return False

        print("  ✓ Extraction successful")

        # Count files
        file_count = sum(1 for _ in test_dir.rglob("*") if _.is_file())
        print(f"  File count: {file_count}")

        # Total size
        total_size = sum(f.stat().st_size for f in test_dir.rglob("*") if f.is_file())
        total_mb = total_size / (1024 * 1024)
        print(f"  Total size: {total_mb:.2f} MB")

        return True
    except Exception as e:
        print(f"  Extraction test failed: {e}")
        return False


def main() -> int:
    """Main entry point."""
    print("=== Initramfs Builder (Linux-native) ===")
    print()

    source_dir = Path("/build/source")
    output_dir = Path("/build/output")
    output_path = output_dir / "postgresql-standalone-complete.cpio.gz"
    test_dir = Path("/build/test")

    # Check source
    if not check_source_directory(source_dir):
        return 1

    # List contents
    list_directory(source_dir)

    # Check critical files
    if not check_critical_files(source_dir):
        return 1

    # Check dependencies (optional)
    check_dependencies(source_dir)

    # Build
    output_dir.mkdir(parents=True, exist_ok=True)
    if not build_initramfs(source_dir, output_path):
        return 1

    # Verify
    if not verify_output(output_path):
        return 1

    # Test extraction
    if not test_extraction(output_path, test_dir):
        return 1

    print("\n=== Build Complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())