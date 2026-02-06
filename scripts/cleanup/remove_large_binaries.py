#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "remove-large-binaries"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "maintenance"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Remove large binary files from git tracking.

Run this AFTER backing up the repository. This script untracks large
binary files but does not delete them from the working directory.
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


# Large binary file patterns that should not be tracked
BINARY_PATTERNS = [
    "azure/*.cpio.gz",
    "azure/*.cpio.gz.*",
    "azure/*.img",
    "azure/*.img.gz",
    "azure/vmlinuz*",
    "azure/vmlinux*",
    "azure/linux-kernel*",
    "azure/bun-openvscode*",
    "azure/nodejs-complete*",
    "bench-images/",
    "artifacts/",
    "release-artifacts/",
    "demos/venv311/",
    "*.tar.gz",
    "vibecode-vm-*.tar.gz",
]

# Minimum file size in KB to report as "large"
LARGE_FILE_THRESHOLD_KB = 1024


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


def get_tracked_files() -> list[str]:
    """Get list of all tracked files."""
    result = run_cmd(["git", "ls-files"])
    if result.returncode != 0:
        return []
    return [f for f in result.stdout.strip().split("\n") if f]


def get_file_size_kb(file_path: Path) -> int:
    """Get file size in KB."""
    try:
        return file_path.stat().st_size // 1024
    except OSError:
        return 0


def find_large_tracked_files(repo_root: Path) -> list[tuple[str, int]]:
    """Find tracked files larger than threshold."""
    large_files = []
    for file_path in get_tracked_files():
        full_path = repo_root / file_path
        if full_path.is_file():
            size_kb = get_file_size_kb(full_path)
            if size_kb > LARGE_FILE_THRESHOLD_KB:
                large_files.append((file_path, size_kb))

    return sorted(large_files, key=lambda x: -x[1])[:30]


def get_files_matching_patterns(patterns: list[str]) -> list[str]:
    """Get tracked files matching the given patterns."""
    matching_files = []
    for pattern in patterns:
        result = run_cmd(["git", "ls-files", pattern])
        if result.returncode == 0 and result.stdout.strip():
            matching_files.extend(result.stdout.strip().split("\n"))
    return [f for f in matching_files if f]


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

    repo_root = get_repo_root()

    print("=" * 48)
    print("Removing large binary files from git index")
    print("=" * 48)
    print()

    print("Scanning for large tracked files...")
    print()

    # Find and display large tracked files
    large_files = find_large_tracked_files(repo_root)
    if large_files:
        print(f"Currently tracked large files (>{LARGE_FILE_THRESHOLD_KB // 1024}MB):")
        for file_path, size_kb in large_files:
            print(f"  {size_kb:>6} KB  {file_path}")
    else:
        print("No large tracked files found.")

    print()
    print("Files matching binary patterns to untrack:")

    # Get files matching patterns
    files_to_untrack = get_files_matching_patterns(BINARY_PATTERNS)
    if files_to_untrack:
        for file_path in files_to_untrack:
            print(f"  - {file_path}")
    else:
        print("  (none found)")
        return 0

    if args.dry_run:
        print()
        print(f"{Colors.YELLOW}[!] DRY RUN - No changes made{Colors.NC}")
        return 0

    print()
    if not args.yes:
        response = input("Proceed with untracking these files? (y/N) ")
        if response.lower() != "y":
            print("Aborted.")
            return 0

    # Untrack files
    untracked_count = 0
    for file_path in files_to_untrack:
        if is_tracked(file_path):
            print(f"Untracking: {file_path}")
            if untrack_file(file_path):
                untracked_count += 1

    print()
    print(f"{Colors.GREEN}[OK] {untracked_count} binary files untracked.{Colors.NC}")
    print()
    print("Now commit this change:")
    print("   git commit -m 'chore: remove large binary files from tracking'")
    print()
    print(f"{Colors.YELLOW}[!] These files still exist in git history!{Colors.NC}")
    print("   For complete removal and size reduction, use:")
    print("   git filter-repo --invert-paths --path <file>")

    return 0


if __name__ == "__main__":
    sys.exit(main())