#!/usr/bin/env python3
"""Build VibeCode Native Swift App.

MIT License - Build script for the VibeCode Swift application.
"""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

VM_IMAGES = [
    "vibecode-postgresql.img",
    "vibecode-postgresql-efi.nvram",
    "vibecode-valkey.img",
    "vibecode-valkey-efi.nvram",
    "vibecode-nodejs.img",
    "vibecode-nodejs-efi.nvram",
]


def info(message: str) -> None:
    """Print info message."""
    print(f"{COLORS.blue}{message}{COLORS.reset}")


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}{message}{COLORS.reset}")


def err(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}{message}{COLORS.reset}")


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent


def run_command(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def check_swift_version() -> bool:
    """Check and display Swift version."""
    info("Checking Swift version...")
    try:
        run_command(["swift", "--version"])
        print()
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        err("Swift not found. Please install Xcode or Swift toolchain.")
        return False


def setup_vm_resources(swift_dir: Path, vm_images_dir: Path) -> bool:
    """Set up VM resources directory and symlinks."""
    info("Setting up VM resources...")
    resources_dir = swift_dir / "Resources" / "vms"
    resources_dir.mkdir(parents=True, exist_ok=True)

    # Check if VM images exist
    primary_image = vm_images_dir / "vibecode-postgresql.img"
    if not primary_image.exists():
        err("VM images not found in dist/vm-images/")
        print("Run: scripts/create_vm_disk_images.py first")
        return False

    # Symlink VM images
    info("Symlinking VM disk images...")
    for image_name in VM_IMAGES:
        source = vm_images_dir / image_name
        target = resources_dir / image_name
        if source.exists():
            try:
                if target.is_symlink() or target.exists():
                    target.unlink()
                target.symlink_to(source)
            except OSError:
                pass  # Ignore symlink errors

    ok("VM resources linked")

    # List linked files
    try:
        result = run_command(
            ["ls", "-lh", str(resources_dir)],
            capture_output=True,
            check=False,
        )
        for line in result.stdout.splitlines()[:10]:
            print(line)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    print()

    return True


def build_swift_app(swift_dir: Path) -> bool:
    """Build the Swift application."""
    info("Building Swift app...")
    try:
        run_command(["swift", "build", "-c", "release"], cwd=swift_dir)
        print()
        ok("Build complete!")
        print()
        return True
    except subprocess.CalledProcessError:
        err("Swift build failed.")
        return False


def show_binary_info(swift_dir: Path) -> None:
    """Display binary location and run instructions."""
    binary_path = swift_dir / ".build" / "release" / "VibeCode"

    info("Binary location:")
    try:
        run_command(["ls", "-lh", str(binary_path)], check=False)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"  {binary_path}")
    print()

    info("To run:")
    print("  cd VibeCodeSwift")
    print("  swift run")
    print()
    print("Or:")
    print("  .build/release/VibeCode")
    print()

    ok("Next: Code sign and create app bundle!")


def main() -> int:
    """Main entry point."""
    print("Building VibeCode Native Swift App")
    print()

    project_root = get_project_root()
    swift_dir = project_root / "VibeCodeSwift"
    vm_images_dir = project_root / "dist" / "vm-images"

    if not swift_dir.exists():
        err(f"Swift project directory not found: {swift_dir}")
        return 1

    os.chdir(swift_dir)

    if not check_swift_version():
        return 1

    if not setup_vm_resources(swift_dir, vm_images_dir):
        return 1

    if not build_swift_app(swift_dir):
        return 1

    show_binary_info(swift_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
