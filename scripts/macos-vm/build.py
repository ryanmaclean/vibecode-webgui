#!/usr/bin/env python3
"""Build VibeCode VM for macOS."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Main entry point."""
    print("\U0001f528 Building VibeCode VM for macOS...")

    # Navigate to project root
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent

    # Build the Swift package
    subprocess.run(
        ["swift", "build", "--package-path", "macos-vm", "-c", "release"],
        cwd=project_root,
        check=True,
    )

    # Copy binary to convenient location
    bin_dir = project_root / "bin"
    bin_dir.mkdir(exist_ok=True)

    source_binary = project_root / "macos-vm" / ".build" / "release" / "vibecode-vm"
    dest_binary = bin_dir / "vibecode-vm"

    shutil.copy2(source_binary, dest_binary)

    print("\u2705 Build complete!")
    print(f"\U0001f4e6 Binary: {dest_binary.relative_to(project_root)}")
    print()
    print("\U0001f680 Quick start:")
    print("   1. ./scripts/macos-vm/download-kernel.sh")
    print("   2. ./bin/vibecode-vm")

    return 0


if __name__ == "__main__":
    sys.exit(main())
