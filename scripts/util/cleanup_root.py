#!/usr/bin/env python3
"""Clean up the messy root directory.

Moves loose files to appropriate directories while keeping essential files.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


# Files that should stay in root
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


def main() -> int:
    """Main entry point."""
    print("\U0001f9f9 Cleaning up root directory...")

    project_root = get_project_root()
    archive_dir = project_root / "archive" / "root-cleanup"
    archive_dir.mkdir(parents=True, exist_ok=True)

    docker_dir = project_root / "docker"
    config_dir = project_root / "config"

    # Move loose files to archive
    moved_count = 0
    for pattern in ["*.md", "*.toml", "*.json", "*.yaml", "*.yml"]:
        for f in project_root.glob(pattern):
            if f.is_file() and f.name not in ESSENTIAL_FILES:
                dest = archive_dir / f.name
                shutil.move(str(f), str(dest))
                moved_count += 1

    # Move Docker files to docker/
    docker_dir.mkdir(exist_ok=True)
    for f in project_root.glob("Dockerfile*"):
        if f.is_file():
            shutil.move(str(f), str(docker_dir / f.name))
            moved_count += 1

    for f in project_root.glob("docker-compose*.yml"):
        if f.is_file():
            shutil.move(str(f), str(docker_dir / f.name))
            moved_count += 1

    # Move config files to config/
    config_dir.mkdir(exist_ok=True)
    for pattern in ["*.config.*", "*.config"]:
        for f in project_root.glob(pattern):
            if f.is_file():
                shutil.move(str(f), str(config_dir / f.name))
                moved_count += 1

    # Restore essential files from archive if they were moved
    for name in ESSENTIAL_FILES:
        archived = archive_dir / name
        if archived.exists():
            shutil.move(str(archived), str(project_root / name))

    print("\u2705 Root cleanup complete!")
    print()
    print(f"\U0001f4c1 Moved {moved_count} files")
    print()
    print("\U0001f4c1 Root directory now contains:")
    for f in sorted(project_root.iterdir()):
        if f.is_file():
            print(f"  {f.name}")
    print()
    print("\U0001f680 Demo still works: ./DEMO.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())
