#!/usr/bin/env python3
"""Move root-level markdown files to archive.

Moves non-essential .md files from root to archive/root-md-files/.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import shutil
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Essential markdown files to keep in root
ESSENTIAL_FILES = {
    "README.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "LICENSE.md",
}


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--archive-dir",
        type=Path,
        default=Path("archive/root-md-files"),
        help="Directory to move files to (default: archive/root-md-files)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be moved without actually moving",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()
    archive_dir: Path = repo_root / args.archive_dir
    dry_run: bool = args.dry_run

    print("Moving root-level markdown files to archive...")

    if dry_run:
        print("(dry run - no files will be moved)")

    # Create archive directory
    if not dry_run:
        archive_dir.mkdir(parents=True, exist_ok=True)

    moved_count = 0

    # Find markdown files in root (not subdirectories)
    for md_file in repo_root.glob("*.md"):
        if not md_file.is_file():
            continue

        # Skip essential files
        if md_file.name in ESSENTIAL_FILES:
            print(f"  Keeping: {md_file.name}")
            continue

        dest = archive_dir / md_file.name

        if dry_run:
            print(f"  Would move: {md_file.name}")
        else:
            shutil.copy2(md_file, dest)
            print(f"  Moved: {md_file.name}")

        moved_count += 1

    print()
    print(f"{Colors.GREEN}Done!{Colors.NC}")
    print(f"  Files {'that would be ' if dry_run else ''}moved: {moved_count}")
    print(f"  Archive location: {archive_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
