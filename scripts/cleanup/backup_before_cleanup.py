#!/usr/bin/env python3
"""
Backup script for vibecode-webgui before major cleanup.

Run this BEFORE any destructive operations.
Creates a complete backup including git bundle, branch archives, and config files.
"""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional


# Important branches to archive individually
IMPORTANT_BRANCHES = [
    "main",
    "fix/boot-time-testing",
    "fix/documentation",
    "fix/vm-stability",
    "agent-fix-openvscode-binary",
    "agent-fix-postgresql",
    "agent-fix-valkey",
    "agent-h-testing",
    "feat/unified-launcher-openvscode-vm",
    "feature/workspace-rag-mlx-ddtrace",
]

# Config files to backup
CONFIG_FILES = [
    ".gitignore",
    "package.json",
    "tsconfig.json",
]

CONFIG_PATTERNS = [
    "next.config.*",
]


def get_repo_root() -> Path:
    """Get the git repository root directory."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(result.stdout.strip())


def create_git_bundle(backup_dir: Path) -> bool:
    """Create a git bundle with all branches and tags."""
    print("1. Creating git bundle with ALL branches and tags...")

    bundle_path = backup_dir / "vibecode-complete.bundle"
    result = subprocess.run(
        ["git", "bundle", "create", str(bundle_path), "--all"],
        check=False,
    )

    if result.returncode == 0:
        print(f"   + Bundle created: {bundle_path}")
        return True
    else:
        print("   x Failed to create git bundle")
        return False


def export_branch_list(backup_dir: Path) -> None:
    """Export list of all branches."""
    print()
    print("2. Exporting branch list...")

    result = subprocess.run(
        ["git", "branch", "-a"],
        capture_output=True,
        text=True,
        check=False,
    )

    branches_file = backup_dir / "all-branches.txt"
    branches_file.write_text(result.stdout)
    print(f"   + Branches saved: {branches_file}")


def export_worktree_list(backup_dir: Path) -> None:
    """Export list of git worktrees."""
    print()
    print("3. Exporting worktree list...")

    result = subprocess.run(
        ["git", "worktree", "list"],
        capture_output=True,
        text=True,
        check=False,
    )

    worktrees_file = backup_dir / "worktrees.txt"
    worktrees_file.write_text(result.stdout)
    print(f"   + Worktrees saved: {worktrees_file}")


def branch_exists(branch: str) -> bool:
    """Check if a git branch exists."""
    result = subprocess.run(
        ["git", "rev-parse", "--verify", branch],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def archive_branches(backup_dir: Path, branches: List[str]) -> None:
    """Create archives of important branches."""
    print()
    print("4. Creating archives of important branches...")

    archives_dir = backup_dir / "branch-archives"
    archives_dir.mkdir(parents=True, exist_ok=True)

    for branch in branches:
        # Convert slashes to dashes for safe filename
        safe_name = branch.replace("/", "-")

        if branch_exists(branch):
            print(f"   Archiving: {branch}...")
            archive_path = archives_dir / f"{safe_name}.tar.gz"

            result = subprocess.run(
                [
                    "git", "archive",
                    "--format=tar.gz",
                    f"--prefix={safe_name}/",
                    branch,
                ],
                capture_output=True,
                check=False,
            )

            if result.returncode == 0:
                archive_path.write_bytes(result.stdout)
            else:
                print(f"   ! Skipped (not found locally): {branch}")
        else:
            print(f"   ! Skipped (not found): {branch}")


def backup_config_files(backup_dir: Path, repo_root: Path) -> None:
    """Backup important config files."""
    print()
    print("5. Backing up important config files...")

    config_backup_dir = backup_dir / "config-backup"
    config_backup_dir.mkdir(parents=True, exist_ok=True)

    # Copy specific files
    for config_file in CONFIG_FILES:
        src = repo_root / config_file
        if src.exists():
            shutil.copy2(src, config_backup_dir / config_file)

    # Copy files matching patterns
    for pattern in CONFIG_PATTERNS:
        for src in repo_root.glob(pattern):
            if src.is_file():
                shutil.copy2(src, config_backup_dir / src.name)

    print("   + Config files backed up")


def get_git_info() -> dict:
    """Gather various git information."""
    info = {}

    # Current HEAD
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    info["head"] = result.stdout.strip() if result.returncode == 0 else "unknown"

    # Current branch
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True,
        check=False,
    )
    info["branch"] = result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else "(detached)"

    # Object count
    result = subprocess.run(
        ["git", "count-objects", "-vH"],
        capture_output=True,
        text=True,
        check=False,
    )
    info["objects"] = result.stdout if result.returncode == 0 else "unknown"

    # Recent commits
    result = subprocess.run(
        ["git", "log", "--oneline", "-20"],
        capture_output=True,
        text=True,
        check=False,
    )
    info["recent_commits"] = result.stdout if result.returncode == 0 else "unknown"

    return info


def get_disk_usage(path: Path) -> str:
    """Get disk usage of a directory."""
    result = subprocess.run(
        ["du", "-sh", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def record_repo_state(backup_dir: Path, repo_root: Path) -> None:
    """Record the current repository state."""
    print()
    print("6. Recording repository state...")

    git_info = get_git_info()
    disk_usage = get_disk_usage(repo_root)

    state_content = f"""\
Backup created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Repository: {repo_root}
Current HEAD: {git_info['head']}
Current branch: {git_info['branch']}

Git object count:
{git_info['objects']}

Disk usage:
{disk_usage}

Recent commits (last 20):
{git_info['recent_commits']}
"""

    state_file = backup_dir / "repo-state.txt"
    state_file.write_text(state_content)
    print("   + Repository state recorded")


def list_backup_contents(backup_dir: Path) -> None:
    """List the contents of the backup directory."""
    print()
    print("Contents:")

    result = subprocess.run(
        ["ls", "-lah", str(backup_dir)],
        check=False,
    )


def backup_repository(
    backup_dir: Optional[Path] = None,
    branches: Optional[List[str]] = None,
) -> int:
    """
    Create a complete backup of the repository.

    Args:
        backup_dir: Directory to store backup (default: ~/vibecode-backup-TIMESTAMP)
        branches: List of branches to archive individually

    Returns:
        0 on success, 1 on failure
    """
    # Generate backup directory name with timestamp
    if backup_dir is None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = Path.home() / f"vibecode-backup-{timestamp}"

    if branches is None:
        branches = IMPORTANT_BRANCHES

    # Get repository root
    try:
        repo_root = get_repo_root()
    except subprocess.CalledProcessError:
        print("ERROR: Not in a git repository")
        return 1

    print("================================================")
    print("VibeCode Repository Backup Script")
    print("================================================")
    print(f"Backup directory: {backup_dir}")
    print(f"Repository root: {repo_root}")
    print()

    # Create backup directory
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Change to repository root
    os.chdir(repo_root)

    # Perform backup steps
    if not create_git_bundle(backup_dir):
        return 1

    export_branch_list(backup_dir)
    export_worktree_list(backup_dir)
    archive_branches(backup_dir, branches)
    backup_config_files(backup_dir, repo_root)
    record_repo_state(backup_dir, repo_root)

    # Print summary
    print()
    print("================================================")
    print("BACKUP COMPLETE!")
    print("================================================")
    print()
    print(f"Backup location: {backup_dir}")

    list_backup_contents(backup_dir)

    print()
    print("To restore from bundle:")
    print(f"  git clone {backup_dir}/vibecode-complete.bundle restored-repo")
    print()
    print("To verify bundle:")
    print(f"  git bundle verify {backup_dir}/vibecode-complete.bundle")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Backup script for vibecode-webgui before major cleanup"
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        help="Directory to store backup (default: ~/vibecode-backup-TIMESTAMP)",
    )
    parser.add_argument(
        "--branches",
        type=str,
        nargs="*",
        help="Additional branches to archive",
    )
    args = parser.parse_args()

    # Combine default and additional branches
    branches = IMPORTANT_BRANCHES.copy()
    if args.branches:
        branches.extend(args.branches)

    return backup_repository(
        backup_dir=args.backup_dir,
        branches=branches,
    )


if __name__ == "__main__":
    sys.exit(main())
