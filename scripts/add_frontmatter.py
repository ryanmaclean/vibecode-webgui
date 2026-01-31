#!/usr/bin/env python3
"""Add frontmatter to markdown files that need it.

Scans markdown files in a directory and adds YAML frontmatter
to any files that don't already have it.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path


def has_frontmatter(file_path: Path) -> bool:
    """Check if a markdown file already has frontmatter.

    Args:
        file_path: Path to the markdown file

    Returns:
        True if file starts with '---' (frontmatter delimiter)
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            first_line = f.readline().strip()
            return first_line == "---"
    except (IOError, UnicodeDecodeError):
        return False


def generate_title(filename: str) -> str:
    """Generate a title from a filename.

    Converts underscores and hyphens to spaces and removes .md extension.

    Args:
        filename: The filename to convert

    Returns:
        Human-readable title
    """
    # Remove .md extension
    title = re.sub(r"\.md$", "", filename, flags=re.IGNORECASE)
    # Replace underscores and hyphens with spaces
    title = title.replace("_", " ").replace("-", " ")
    # Capitalize words
    title = title.title()
    return title


def add_frontmatter(file_path: Path, title: str | None = None) -> bool:
    """Add frontmatter to a markdown file.

    Args:
        file_path: Path to the markdown file
        title: Optional title to use (defaults to generated from filename)

    Returns:
        True if frontmatter was added, False if already present
    """
    if has_frontmatter(file_path):
        return False

    if title is None:
        title = generate_title(file_path.name)

    # Read original content
    try:
        content = file_path.read_text(encoding="utf-8")
    except (IOError, UnicodeDecodeError) as e:
        print(f"Error reading {file_path}: {e}")
        return False

    # Create frontmatter
    frontmatter = f"""---
title: {title}
description: {title} documentation
---

"""

    # Write new content
    try:
        file_path.write_text(frontmatter + content, encoding="utf-8")
        return True
    except IOError as e:
        print(f"Error writing {file_path}: {e}")
        return False


def process_directory(docs_dir: Path, recursive: bool = False) -> tuple[int, int]:
    """Process all markdown files in a directory.

    Args:
        docs_dir: Directory containing markdown files
        recursive: Whether to process subdirectories

    Returns:
        Tuple of (files_processed, files_skipped)
    """
    processed = 0
    skipped = 0

    pattern = "**/*.md" if recursive else "*.md"

    for md_file in docs_dir.glob(pattern):
        if not md_file.is_file():
            continue

        if add_frontmatter(md_file):
            print(f"Added frontmatter to {md_file.name}")
            processed += 1
        else:
            print(f"{md_file.name} already has frontmatter")
            skipped += 1

    return processed, skipped


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "directory",
        type=Path,
        nargs="?",
        default=Path.cwd(),
        help="Directory containing markdown files (default: current directory)",
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Process subdirectories recursively",
    )
    parser.add_argument(
        "-n", "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args(argv)

    docs_dir = args.directory.resolve()

    if not docs_dir.is_dir():
        print(f"Error: {docs_dir} is not a directory")
        return 1

    print(f"Adding frontmatter to markdown files in {docs_dir}")

    if args.dry_run:
        print("(dry run - no changes will be made)")
        pattern = "**/*.md" if args.recursive else "*.md"
        for md_file in docs_dir.glob(pattern):
            if md_file.is_file():
                if has_frontmatter(md_file):
                    print(f"  [skip] {md_file.name} - already has frontmatter")
                else:
                    print(f"  [add]  {md_file.name}")
        return 0

    processed, skipped = process_directory(docs_dir, args.recursive)

    print()
    print(f"Frontmatter added to {processed} file(s)")
    print(f"Skipped {skipped} file(s) (already had frontmatter)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
