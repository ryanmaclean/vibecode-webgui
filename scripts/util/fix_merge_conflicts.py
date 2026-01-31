#!/usr/bin/env python3
"""Fix git merge conflicts automatically.

Removes merge conflict markers and keeps the main branch content.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def run_cmd(
    cmd: list[str],
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True)


def find_files_with_conflicts(repo_root: Path) -> list[Path]:
    """Find all files with merge conflict markers."""
    result = run_cmd(["git", "-C", str(repo_root), "diff", "--name-only", "--diff-filter=U"])
    if result.returncode != 0 or not result.stdout.strip():
        return []

    return [repo_root / f for f in result.stdout.strip().split("\n") if f]


def fix_merge_conflicts(file_path: Path, keep: str = "ours") -> bool:
    """Fix merge conflicts in a file.

    Args:
        file_path: Path to file with conflicts
        keep: Which version to keep: "ours" (HEAD/current) or "theirs" (incoming)

    Returns:
        True if conflicts were fixed, False otherwise
    """
    try:
        content = file_path.read_text()
    except OSError as e:
        print(f"  Error reading {file_path}: {e}")
        return False

    # Pattern matches:
    # <<<<<<< HEAD (or similar)
    # ... ours content ...
    # =======
    # ... theirs content ...
    # >>>>>>> branch-name (or similar)
    conflict_pattern = re.compile(
        r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n",
        re.DOTALL,
    )

    def replace_conflict(match: re.Match[str]) -> str:
        ours = match.group(1)
        theirs = match.group(2)
        return ours if keep == "ours" else theirs

    new_content, count = conflict_pattern.subn(replace_conflict, content)

    if count == 0:
        return False

    file_path.write_text(new_content)
    return True


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--keep",
        choices=["ours", "theirs"],
        default="ours",
        help="Which version to keep (default: ours/HEAD/current branch)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be fixed without making changes",
    )
    parser.add_argument(
        "files",
        nargs="*",
        type=Path,
        help="Specific files to fix (default: all files with conflicts)",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()

    print("Fixing git merge conflicts...")

    # Find files with conflicts
    if args.files:
        files_with_conflicts = [Path(f) for f in args.files if Path(f).exists()]
    else:
        files_with_conflicts = find_files_with_conflicts(repo_root)

    if not files_with_conflicts:
        print(f"{Colors.GREEN}No merge conflicts found!{Colors.NC}")
        return 0

    print(f"Found conflicts in {len(files_with_conflicts)} files:")
    for f in files_with_conflicts:
        print(f"  {f}")
    print()

    conflict_count = 0
    fixed_count = 0

    for file_path in files_with_conflicts:
        if not file_path.exists():
            continue

        print(f"Fixing: {file_path}")
        conflict_count += 1

        if args.dry_run:
            print(f"  {Colors.YELLOW}Would fix conflicts (dry run){Colors.NC}")
            fixed_count += 1
        elif fix_merge_conflicts(file_path, args.keep):
            print(f"  {Colors.GREEN}Fixed merge conflicts{Colors.NC}")
            fixed_count += 1
        else:
            print(f"  {Colors.YELLOW}No conflict markers found{Colors.NC}")

    print()
    print(f"{Colors.GREEN}Merge conflict resolution complete!{Colors.NC}")
    print(f"  Files processed: {conflict_count}")
    print(f"  Files fixed: {fixed_count}")
    print()
    print("Next steps:")
    print("1. Review the changes: git diff")
    print("2. Run tests to ensure everything works")
    print("3. Commit the fixes: git add . && git commit -m 'Fix merge conflicts'")

    return 0


if __name__ == "__main__":
    sys.exit(main())
