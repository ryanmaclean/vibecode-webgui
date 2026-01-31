#!/usr/bin/env python3
"""Clean up the messy root directory.

Moves loose files to appropriate directories while keeping essential files.
"""
from __future__ import annotations

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


# Essential files to keep in root
ESSENTIAL_FILES = {
    "README.md",
    "package.json",
    "package-lock.json",
    "LICENSE",
    "LICENSE.md",
    "Makefile",
    "go.mod",
    "go.sum",
    ".gitignore",
    "DEMO.sh",
    "start-demo",
}


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be moved without actually moving",
    )
    parser.add_argument(
        "--archive-dir",
        type=Path,
        default=Path("archive/root-cleanup"),
        help="Directory to move archived files to (default: archive/root-cleanup)",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()
    archive_dir: Path = repo_root / args.archive_dir
    dry_run: bool = args.dry_run

    print("Cleaning up root directory...")

    if dry_run:
        print("(dry run - no files will be moved)")

    # Create archive directory
    if not dry_run:
        archive_dir.mkdir(parents=True, exist_ok=True)

    moved_count = 0

    # Extensions to move to archive
    archive_extensions = {".md", ".toml", ".json", ".yaml", ".yml"}

    # Scan root directory for files to move
    for item in repo_root.iterdir():
        if not item.is_file():
            continue

        # Skip essential files
        if item.name in ESSENTIAL_FILES:
            continue

        # Skip hidden files
        if item.name.startswith("."):
            continue

        # Check if extension should be archived
        if item.suffix in archive_extensions:
            dest = archive_dir / item.name
            if dry_run:
                print(f"  Would move: {item.name} -> {dest.relative_to(repo_root)}")
            else:
                shutil.move(str(item), str(dest))
                print(f"  Moved: {item.name}")
            moved_count += 1

    # Move Docker files to docker/
    docker_dir = repo_root / "docker"
    for pattern in ("Dockerfile*", "docker-compose*.yml"):
        for item in repo_root.glob(pattern):
            if item.is_file():
                if not dry_run:
                    docker_dir.mkdir(parents=True, exist_ok=True)
                dest = docker_dir / item.name
                if dry_run:
                    print(f"  Would move: {item.name} -> docker/{item.name}")
                else:
                    shutil.move(str(item), str(dest))
                    print(f"  Moved to docker/: {item.name}")
                moved_count += 1

    # Move config files to config/
    config_dir = repo_root / "config"
    for item in repo_root.iterdir():
        if item.is_file() and ".config" in item.name:
            if not dry_run:
                config_dir.mkdir(parents=True, exist_ok=True)
            dest = config_dir / item.name
            if dry_run:
                print(f"  Would move: {item.name} -> config/{item.name}")
            else:
                shutil.move(str(item), str(dest))
                print(f"  Moved to config/: {item.name}")
            moved_count += 1

    print(f"\n{Colors.GREEN}Root cleanup complete!{Colors.NC}")
    print(f"\n  Files {'that would be ' if dry_run else ''}moved: {moved_count}")

    # Show remaining root files
    print("\nRoot directory now contains:")
    for item in sorted(repo_root.iterdir()):
        if item.is_file():
            print(f"  {item.name}")

    print("\nDemo still works: ./DEMO.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())
