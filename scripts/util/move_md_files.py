#!/usr/bin/env python3
"""Move markdown files from root to archive.

Preserves essential files like README.md, CODE_OF_CONDUCT.md, etc.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


# Files to keep in root
KEEP_FILES = {
    "README.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "LICENSE.md",
}


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def main() -> int:
    """Main entry point."""
    project_root = get_project_root()
    archive_dir = project_root / "archive" / "root-md-files"
    archive_dir.mkdir(parents=True, exist_ok=True)

    moved_count = 0
    for md_file in project_root.glob("*.md"):
        if md_file.is_file() and md_file.name not in KEEP_FILES:
            dest = archive_dir / md_file.name
            shutil.copy(str(md_file), str(dest))
            moved_count += 1
            print(f"Copied: {md_file.name} -> archive/root-md-files/")

    if moved_count == 0:
        print("No markdown files to move (all are essential).")
    else:
        print(f"\nMoved {moved_count} markdown files to archive/root-md-files/")

    return 0


if __name__ == "__main__":
    sys.exit(main())
