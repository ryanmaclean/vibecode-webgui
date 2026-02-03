#!/usr/bin/env python3
"""Vibecode WebGUI - Cleanup helper.

Removes local build artifacts and optionally environment files.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# Targets to remove
BUILD_TARGETS = [
    ".next",
    "dist",
    ".turbo",
    "playwright-report",
    "coverage",
    ".cache",
    "reports",
    "tmp-codeium-example",
]

ENV_FILES = [
    ".env.local",
    ".env.development",
    ".env.test",
]


def get_project_root() -> Path:
    """Get the project root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent.parent


def log_rm(path: Path, dry_run: bool) -> None:
    """Remove a file or directory, with optional dry run mode.

    Args:
        path: Path to remove
        dry_run: If True, only print what would be removed
    """
    if dry_run:
        print(f"{YELLOW}DRY RUN{NC} would remove {path}")
    elif path.exists():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        print(f"{GREEN}Removed{NC} {path}")


def run_cleanup(
    dry_run: bool = False,
    keep_env: bool = False,
    keep_node_modules: bool = False,
) -> int:
    """Run the cleanup process.

    Args:
        dry_run: Show actions without removing files
        keep_env: Preserve .env.* files
        keep_node_modules: Preserve node_modules directory

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    # Check if running as root
    if os.getuid() == 0:
        print(
            f"{YELLOW}Warning: This script should run without sudo. Aborting.{NC}",
            file=sys.stderr,
        )
        return 1

    project_root = get_project_root()
    os.chdir(project_root)

    print(f"{GREEN}Vibecode cleanup utility{NC}")
    print(f"Project: {project_root}\n")

    # Remove build targets
    for target in BUILD_TARGETS:
        log_rm(project_root / target, dry_run)

    # Handle node_modules
    if not keep_node_modules:
        log_rm(project_root / "node_modules", dry_run)
    else:
        print(f"{YELLOW}Preserving node_modules (--keep-node-modules){NC}")

    print()

    # Handle environment files
    if not keep_env:
        for env_file in ENV_FILES:
            log_rm(project_root / env_file, dry_run)
    else:
        print(f"{YELLOW}Preserving environment files (--keep-env){NC}")

    print(f"\n{GREEN}Cleanup complete.{NC}")
    if dry_run:
        print("No files were deleted (dry-run mode).")

    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command line arguments.

    Args:
        argv: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Cleans local Vibecode WebGUI artifacts. Designed for developer "
        "workstations - does not affect remote deployments.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    scripts/vibecode-cli/uninstall.py
    scripts/vibecode-cli/uninstall.py --dry-run
""",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show actions without removing files",
    )
    parser.add_argument(
        "--keep-env",
        action="store_true",
        help="Preserve .env.* files",
    )
    parser.add_argument(
        "--keep-node-modules",
        action="store_true",
        help="Preserve node_modules",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point.

    Args:
        argv: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Exit code
    """
    args = parse_args(argv)
    return run_cleanup(
        dry_run=args.dry_run,
        keep_env=args.keep_env,
        keep_node_modules=args.keep_node_modules,
    )


if __name__ == "__main__":
    sys.exit(main())
