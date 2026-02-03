#!/usr/bin/env python3
"""Replace @ts-ignore with @ts-expect-error in all TypeScript files.

@ts-expect-error is preferred over @ts-ignore because it will error
if the line below it doesn't actually have a type error, helping
catch stale suppressions.
"""

from __future__ import annotations

import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get project root directory."""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent


def find_typescript_files(src_dir: Path) -> list[Path]:
    """Find all TypeScript files in the source directory.

    Args:
        src_dir: Source directory to search.

    Returns:
        List of paths to .ts and .tsx files.
    """
    files: list[Path] = []
    if src_dir.exists():
        files.extend(src_dir.rglob("*.ts"))
        files.extend(src_dir.rglob("*.tsx"))
    return sorted(files)


def fix_ts_ignore_in_file(file_path: Path) -> int:
    """Replace @ts-ignore with @ts-expect-error in a file.

    Args:
        file_path: Path to the TypeScript file.

    Returns:
        Number of replacements made.
    """
    content = file_path.read_text()
    new_content = content.replace("@ts-ignore", "@ts-expect-error")

    if content != new_content:
        file_path.write_text(new_content)
        count = content.count("@ts-ignore")
        return count

    return 0


def main() -> int:
    """Main entry point."""
    project_root = get_project_root()
    src_dir = project_root / "src"

    if not src_dir.exists():
        print(f"Source directory not found: {src_dir}")
        return 1

    files = find_typescript_files(src_dir)
    total_replacements = 0
    files_modified = 0

    for file_path in files:
        count = fix_ts_ignore_in_file(file_path)
        if count > 0:
            total_replacements += count
            files_modified += 1

    if total_replacements > 0:
        print(f"Replaced {total_replacements} @ts-ignore with @ts-expect-error in {files_modified} file(s)")
    else:
        print("No @ts-ignore comments found")

    return 0


if __name__ == "__main__":
    sys.exit(main())
