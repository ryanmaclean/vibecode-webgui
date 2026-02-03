#!/usr/bin/env python3
"""Run VibeCode (rebuild if needed).

This script builds VibeCode if necessary, signs it with entitlements,
and launches the application.
"""

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

# Build configuration
BINARY_PATH = ".build/arm64-apple-macosx/release/VibeCode"
SOURCES_DIR = "Sources"
ENTITLEMENTS_FILE = "VibeCode.entitlements"


def get_vibecode_dir() -> Path:
    """Get the VibeCodeSwift directory path.

    Returns:
        Path to VibeCodeSwift directory.
    """
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent / "VibeCodeSwift"


def run_command(
    cmd: list[str],
    cwd: Optional[Path] = None,
    check: bool = True
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run as list of strings.
        cwd: Working directory for the command.
        check: If True, raise on non-zero exit code.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        if check and result.returncode != 0:
            print(f"{YELLOW}Command failed: {' '.join(cmd)}{NC}")
            print(result.stderr)
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def needs_build(vibecode_dir: Path) -> bool:
    """Check if VibeCode needs to be rebuilt.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.

    Returns:
        True if build is needed.
    """
    binary = vibecode_dir / BINARY_PATH

    # Need to build if binary doesn't exist
    if not binary.exists():
        return True

    # Check if any source files are newer than the binary
    binary_mtime = binary.stat().st_mtime
    sources_dir = vibecode_dir / SOURCES_DIR

    if not sources_dir.exists():
        return False

    for source_file in sources_dir.rglob("*"):
        if source_file.is_file() and source_file.stat().st_mtime > binary_mtime:
            return True

    return False


def build_vibecode(vibecode_dir: Path) -> bool:
    """Build VibeCode using swift build.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.

    Returns:
        True if build succeeded.
    """
    print(f"{GREEN}Building VibeCode...{NC}")
    rc, _, _ = run_command(
        ["swift", "build", "-c", "release"],
        cwd=vibecode_dir,
        check=True
    )
    return rc == 0


def kill_existing_instances() -> None:
    """Kill any existing VibeCode instances."""
    subprocess.run(
        ["pkill", "VibeCode"],
        capture_output=True
    )
    time.sleep(0.5)


def sign_binary(vibecode_dir: Path) -> bool:
    """Sign the binary with entitlements.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.

    Returns:
        True if signing succeeded.
    """
    print(f"{GREEN}Signing binary...{NC}")
    binary = vibecode_dir / BINARY_PATH
    entitlements = vibecode_dir / ENTITLEMENTS_FILE

    rc, _, _ = run_command(
        [
            "codesign",
            "--force",
            "--sign", "-",
            "--entitlements", str(entitlements),
            str(binary)
        ],
        check=True
    )
    return rc == 0


def launch_vibecode(vibecode_dir: Path) -> int:
    """Launch VibeCode.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.

    Returns:
        Exit code from VibeCode.
    """
    print(f"{GREEN}Launching VibeCode...{NC}")
    print()

    binary = vibecode_dir / BINARY_PATH

    # Use exec to replace the current process
    os.execv(str(binary), [str(binary)])


def main(skip_build: bool = False, skip_sign: bool = False) -> int:
    """Main entry point.

    Args:
        skip_build: If True, skip the build step.
        skip_sign: If True, skip the signing step.

    Returns:
        Exit code (0 for success).
    """
    vibecode_dir = get_vibecode_dir()

    if not vibecode_dir.exists():
        print(f"{YELLOW}Error: VibeCodeSwift directory not found: {vibecode_dir}{NC}")
        return 1

    # Build if needed
    if not skip_build and needs_build(vibecode_dir):
        if not build_vibecode(vibecode_dir):
            return 1

    # Check binary exists
    binary = vibecode_dir / BINARY_PATH
    if not binary.exists():
        print(f"{YELLOW}Error: Binary not found: {binary}{NC}")
        print("Run with build enabled or build manually first.")
        return 1

    # Kill existing instances
    kill_existing_instances()

    # Sign binary
    if not skip_sign:
        if not sign_binary(vibecode_dir):
            return 1

    # Launch VibeCode (this replaces the current process)
    return launch_vibecode(vibecode_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run VibeCode (rebuild if needed)"
    )
    parser.add_argument(
        '--skip-build',
        action='store_true',
        help="Skip the build step"
    )
    parser.add_argument(
        '--skip-sign',
        action='store_true',
        help="Skip the signing step"
    )

    args = parser.parse_args()
    sys.exit(main(args.skip_build, args.skip_sign))
