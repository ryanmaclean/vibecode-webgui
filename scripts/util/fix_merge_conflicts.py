#!/usr/bin/env python3
"""Fix all git merge conflicts automatically.

This script removes merge conflict markers and keeps the main branch content.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def find_files_with_conflicts(project_root: Path) -> list[Path]:
    """Find all files with git merge conflict markers."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=U"],
        cwd=project_root,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0 or not result.stdout.strip():
        return []

    return [project_root / f for f in result.stdout.strip().split("\n") if f]


def fix_conflicts_in_file(file_path: Path) -> bool:
    """Remove merge conflict markers from a file, keeping main branch content.

    Args:
        file_path: Path to file with conflicts.

    Returns:
        True if conflicts were fixed, False otherwise.
    """
    try:
        content = file_path.read_text()
    except OSError:
        return False

    # Pattern to match conflict blocks
    # <<<<<<< HEAD
    # ... main content ...
    # =======
    # ... other content ...
    # >>>>>>> branch
    conflict_pattern = re.compile(
        r"<<<<<<<[^\n]*\n(.*?)\n=======\n.*?\n>>>>>>>[^\n]*\n",
        re.DOTALL,
    )

    new_content, count = conflict_pattern.subn(r"\1\n", content)

    if count > 0:
        file_path.write_text(new_content)
        return True

    return False


def main() -> int:
    """Main entry point."""
    print("\U0001f527 Fixing git merge conflicts...")

    project_root = get_project_root()
    files_with_conflicts = find_files_with_conflicts(project_root)

    if not files_with_conflicts:
        print("\u2705 No merge conflicts found!")
        return 0

    print(f"\U0001f4cb Found conflicts in {len(files_with_conflicts)} files:")
    for f in files_with_conflicts:
        print(f"  {f.relative_to(project_root)}")
    print()

    fixed_count = 0
    for file_path in files_with_conflicts:
        if file_path.exists():
            print(f"\U0001f527 Fixing: {file_path.relative_to(project_root)}")
            if fix_conflicts_in_file(file_path):
                print(f"  \u2705 Fixed merge conflicts")
                fixed_count += 1
            else:
                print(f"  \u26a0\ufe0f  No standard conflict markers found")

    print()
    print("\U0001f389 Merge conflict resolution complete!")
    print(f"  \U0001f4ca Files processed: {len(files_with_conflicts)}")
    print(f"  \u2705 Files fixed: {fixed_count}")
    print()
    print("Next steps:")
    print("1. Review the changes: git diff")
    print("2. Run tests to ensure everything works")
    print("3. Commit the fixes: git add . && git commit -m 'Fix merge conflicts'")

    return 0


if __name__ == "__main__":
    sys.exit(main())
