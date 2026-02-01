#!/usr/bin/env python3
"""Remove tracked secret files from git index.

Run this AFTER backing up the repository. This script untracks secret
files but does NOT delete them from the working directory.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Files with secrets that should not be tracked
SECRET_FILES = [
    ".env.docker.fixed",
    ".env.docker",
    ".env.test-db",
    ".env.test-external-db",
    ".env.local.backup",
    ".env.azure",
    ".env.valkey",
    "config/env/.env.docker.fixed",
    "config/env/.env.docker",
    "config/env/.env.test-db",
    "config/env/.env.test-external-db",
    "config/env/.env.local.backup",
    "config/env/.env.azure",
    "config/env/.env.valkey",
]


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def get_repo_root() -> Path:
    """Get the git repository root."""
    result = run_cmd(["git", "rev-parse", "--show-toplevel"])
    if result.returncode != 0:
        print(f"{Colors.RED}[X] Not in a git repository{Colors.NC}")
        sys.exit(1)
    return Path(result.stdout.strip())


def is_tracked(file_path: str) -> bool:
    """Check if a file is tracked by git."""
    result = run_cmd(["git", "ls-files", "--error-unmatch", file_path])
    return result.returncode == 0


def untrack_file(file_path: str) -> bool:
    """Remove a file from git tracking (but keep on disk)."""
    result = run_cmd(["git", "rm", "--cached", file_path])
    return result.returncode == 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be untracked without making changes",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    get_repo_root()

    print("=" * 48)
    print("Removing tracked secret files from git index")
    print("=" * 48)
    print()
    print(f"{Colors.YELLOW}[!] This will untrack files but NOT delete them from disk.")
    print(f"    The files will remain in your working directory.{Colors.NC}")
    print()

    # Check which files are tracked
    tracked_files = []
    not_tracked_files = []

    print("Files to untrack:")
    for file_path in SECRET_FILES:
        if is_tracked(file_path):
            print(f"  - {file_path} (tracked)")
            tracked_files.append(file_path)
        else:
            print(f"  - {file_path} (not tracked, skipping)")
            not_tracked_files.append(file_path)

    if not tracked_files:
        print()
        print(f"{Colors.GREEN}[OK] No secret files are currently tracked.{Colors.NC}")
        return 0

    if args.dry_run:
        print()
        print(f"{Colors.YELLOW}[!] DRY RUN - No changes made{Colors.NC}")
        return 0

    print()
    if not args.yes:
        response = input("Proceed with untracking? (y/N) ")
        if response.lower() != "y":
            print("Aborted.")
            return 0

    # Untrack files
    untracked_count = 0
    for file_path in tracked_files:
        print(f"Untracking: {file_path}")
        if untrack_file(file_path):
            untracked_count += 1

    print()
    print(f"{Colors.GREEN}[OK] {untracked_count} files untracked.{Colors.NC}")
    print()
    print("Now commit this change:")
    print("   git commit -m 'chore: remove tracked secret files'")
    print()
    print(f"{Colors.YELLOW}[!] Remember: secrets are still in git history!")
    print(f"   For complete removal, use git-filter-repo{Colors.NC}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
