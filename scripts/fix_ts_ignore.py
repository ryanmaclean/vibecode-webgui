#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Replace @ts-ignore with @ts-expect-error in TypeScript files.

The @ts-expect-error directive is preferred over @ts-ignore because it will
raise an error if the suppressed error goes away, helping identify stale
suppressions.
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

# Colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


def find_typescript_files(directory: Path) -> list[Path]:
    """Find all TypeScript files in a directory.

    Args:
        directory: Directory to search.

    Returns:
        List of paths to TypeScript files.
    """
    files: list[Path] = []
    for pattern in ['**/*.ts', '**/*.tsx']:
        files.extend(directory.glob(pattern))
    return sorted(files)


def replace_in_file(file_path: Path, dry_run: bool = False) -> int:
    """Replace @ts-ignore with @ts-expect-error in a file.

    Args:
        file_path: Path to the file.
        dry_run: If True, don't modify the file.

    Returns:
        Number of replacements made.
    """
    content = file_path.read_text()
    new_content = content.replace('@ts-ignore', '@ts-expect-error')

    replacements = content.count('@ts-ignore')

    if replacements > 0 and not dry_run:
        file_path.write_text(new_content)

    return replacements


def main(
    directory: Optional[str] = None,
    dry_run: bool = False,
    verbose: bool = False
) -> int:
    """Main entry point.

    Args:
        directory: Directory to search (default: src/).
        dry_run: If True, don't modify files.
        verbose: If True, print each file modified.

    Returns:
        Exit code (0 for success).
    """
    # Default to src/ directory
    search_dir = Path(directory) if directory else Path('src')

    if not search_dir.exists():
        print(f"{YELLOW}Warning: Directory '{search_dir}' not found{NC}")
        return 1

    if not search_dir.is_dir():
        print(f"{YELLOW}Warning: '{search_dir}' is not a directory{NC}")
        return 1

    # Find TypeScript files
    ts_files = find_typescript_files(search_dir)

    if not ts_files:
        print(f"{YELLOW}No TypeScript files found in {search_dir}{NC}")
        return 0

    total_replacements = 0
    files_modified = 0

    for file_path in ts_files:
        replacements = replace_in_file(file_path, dry_run)
        if replacements > 0:
            total_replacements += replacements
            files_modified += 1
            if verbose:
                action = "Would replace" if dry_run else "Replaced"
                print(f"{BLUE}{action} {replacements} in {file_path}{NC}")

    # Print summary
    if dry_run:
        print(f"{GREEN}Would replace {total_replacements} @ts-ignore "
              f"with @ts-expect-error in {files_modified} files{NC}")
    else:
        print(f"{GREEN}Replaced {total_replacements} @ts-ignore "
              f"with @ts-expect-error in {files_modified} files{NC}")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Replace @ts-ignore with @ts-expect-error in TypeScript files"
    )
    parser.add_argument(
        '-d', '--directory',
        default='src',
        help='Directory to search (default: src/)'
    )
    parser.add_argument(
        '-n', '--dry-run',
        action='store_true',
        help="Show what would be changed without modifying files"
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help="Print each file modified"
    )

    args = parser.parse_args()
    sys.exit(main(args.directory, args.dry_run, args.verbose))