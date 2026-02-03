#!/usr/bin/env python3
"""Full history cleanup using git-filter-repo.

WARNING: DESTRUCTIVE OPERATION - Run backup-before-cleanup.sh first!

This script removes large files and secrets from git history.
After running, you MUST force push and all collaborators must re-clone.
"""

import argparse
import os
import subprocess
import shutil
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ANSI colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'

# Paths to remove from history
PATHS_TO_REMOVE = """
# Large binary files
azure/bun-openvscode.cpio.gz
azure/nodejs-complete.cpio.gz
azure/nodejs-complete.cpio.gz.backup-20251202-095734
azure/nodejs-complete.backup
azure/unified-services-static.cpio.gz
azure/unified-services-static.cpio.gz.broken
azure/unified-services-static.cpio.gz.january
azure/linux-kernel-arm64
azure/linux-kernel-arm64.5.15-backup
azure/vmlinux-raw
azure/vmlinuz-arm64
azure/vibecode-services-disk.img.gz

# VM images
VibeCodeSwift/Resources/vms/vibecode-postgresql.img

# Entire directories with build artifacts
artifacts/
bench-images/
demos/venv311/
release-artifacts/
src-tauri/target/
VibeCode-VMs/.build/
macos-vm/.build/
docs/node_modules/
extensions/vibecode-ai-assistant/node_modules/

# Large vfkit binary
src-tauri/resources/vfkit

# Secret files
.env.docker.fixed
.env.docker
.env.test-db
.env.test-external-db
.env.local.backup
.env.azure
.env.valkey
config/env/.env.docker.fixed
config/env/.env.docker
config/env/.env.test-db
config/env/.env.test-external-db
config/env/.env.local.backup
config/env/.env.azure
config/env/.env.valkey
"""


@dataclass
class CleanupConfig:
    """Cleanup configuration."""

    repo_root: Path = field(default_factory=Path)
    paths_file: Path = field(default_factory=Path)
    force: bool = False
    dry_run: bool = False


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
    cwd: Optional[Path] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, raise on failure.
        capture: If True, capture output.
        cwd: Working directory.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=cwd
        )
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_repo_root() -> Optional[Path]:
    """Get the git repository root.

    Returns:
        Path to repo root or None.
    """
    rc, stdout, _ = run_command(
        ["git", "rev-parse", "--show-toplevel"],
        check=False
    )
    if rc == 0:
        return Path(stdout.strip())
    return None


def check_git_filter_repo() -> bool:
    """Check if git-filter-repo is installed.

    Returns:
        True if installed.
    """
    return shutil.which("git-filter-repo") is not None


def check_working_directory_clean(repo_root: Path) -> bool:
    """Check if working directory is clean.

    Args:
        repo_root: Repository root.

    Returns:
        True if clean.
    """
    # Check for unstaged changes
    rc1, _, _ = run_command(["git", "diff", "--quiet"], cwd=repo_root, check=False)

    # Check for staged changes
    rc2, _, _ = run_command(["git", "diff", "--cached", "--quiet"], cwd=repo_root, check=False)

    return rc1 == 0 and rc2 == 0


def create_paths_file() -> Path:
    """Create temporary file with paths to remove.

    Returns:
        Path to temporary file.
    """
    fd, path = tempfile.mkstemp(prefix="vibecode-paths-", suffix=".txt")
    with os.fdopen(fd, 'w') as f:
        f.write(PATHS_TO_REMOVE)
    return Path(path)


def get_paths_list() -> list[str]:
    """Get list of paths to remove (excluding comments and blank lines).

    Returns:
        List of paths.
    """
    paths = []
    for line in PATHS_TO_REMOVE.strip().split('\n'):
        line = line.strip()
        if line and not line.startswith('#'):
            paths.append(line)
    return paths


def run_filter_repo(config: CleanupConfig) -> bool:
    """Run git-filter-repo to remove paths.

    Args:
        config: Cleanup configuration.

    Returns:
        True if successful.
    """
    cmd = [
        "git", "filter-repo",
        "--invert-paths",
        "--paths-from-file", str(config.paths_file),
        "--force"
    ]

    print()
    print("Starting git-filter-repo...")
    print()

    rc, stdout, stderr = run_command(cmd, cwd=config.repo_root, check=False)

    if stdout:
        print(stdout)
    if stderr:
        print(stderr)

    return rc == 0


def get_repo_stats(repo_root: Path) -> str:
    """Get repository statistics.

    Args:
        repo_root: Repository root.

    Returns:
        Stats string.
    """
    rc, stdout, _ = run_command(
        ["git", "count-objects", "-vH"],
        cwd=repo_root,
        check=False
    )
    if rc == 0:
        return stdout.strip()
    return "Unable to get stats"


def confirm_backup() -> bool:
    """Confirm user has created a backup.

    Returns:
        True if confirmed.
    """
    try:
        response = input("Have you created a full backup? (yes/no) ").strip()
        return response.lower() == "yes"
    except (EOFError, KeyboardInterrupt):
        return False


def confirm_rewrite() -> bool:
    """Confirm user wants to rewrite history.

    Returns:
        True if confirmed.
    """
    try:
        response = input("Type 'REWRITE HISTORY' to proceed: ").strip()
        return response == "REWRITE HISTORY"
    except (EOFError, KeyboardInterrupt):
        return False


def print_header() -> None:
    """Print script header."""
    print("=" * 48)
    print(f"{YELLOW}WARNING: GIT HISTORY REWRITE SCRIPT{NC}")
    print("=" * 48)
    print()
    print("This script will PERMANENTLY rewrite git history to remove:")
    print("  - Large binary files (kernels, cpio, disk images)")
    print("  - Secret/environment files")
    print("  - Build artifacts committed by mistake")
    print()
    print("Prerequisites:")
    print("  1. Run backup-before-cleanup.sh first")
    print("  2. Install git-filter-repo: brew install git-filter-repo")
    print("  3. Coordinate with all team members")
    print()


def print_paths_to_remove() -> None:
    """Print paths that will be removed."""
    print()
    print("Files/directories to be removed from ALL history:")
    for path in get_paths_list():
        print(f"  {path}")


def print_final_warning() -> None:
    """Print final warning before rewrite."""
    print()
    print("=" * 48)
    print(f"{RED}FINAL WARNING{NC}")
    print("=" * 48)
    print()
    print("This will PERMANENTLY modify git history.")
    print("After this operation:")
    print("  1. You must force push: git push --force --all")
    print("  2. All team members must re-clone the repository")
    print("  3. All open PRs will need to be recreated")
    print()


def print_success(repo_root: Path) -> None:
    """Print success message.

    Args:
        repo_root: Repository root.
    """
    print()
    print("=" * 48)
    print(f"{GREEN}History rewrite complete!{NC}")
    print("=" * 48)
    print()
    print("New repository stats:")
    print(get_repo_stats(repo_root))
    print()
    print("Next steps:")
    print("  1. Verify the repository works correctly")
    print("  2. Force push all branches:")
    print("     git push --force --all origin")
    print("     git push --force --tags origin")
    print("  3. Notify team to re-clone")
    print()
    print("To verify no secrets remain:")
    print("  git log --all -p | grep -E 'sk-[a-zA-Z0-9]{20}' | head -10")
    print()


def cleanup(config: CleanupConfig) -> int:
    """Run the cleanup process.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header()

    # Check for git-filter-repo
    if not check_git_filter_repo():
        print(f"{RED}git-filter-repo is not installed.{NC}")
        print("   Install with: brew install git-filter-repo")
        return 1

    # Check for clean working directory
    if not check_working_directory_clean(config.repo_root):
        print(f"{RED}Working directory is not clean.{NC}")
        print("   Please commit or stash changes first.")
        return 1

    # Confirm backup (skip if force mode)
    if not config.force:
        if not confirm_backup():
            print("Please run: ./scripts/cleanup/backup-before-cleanup.sh")
            return 1

    # Create paths file
    print()
    print("Creating paths-to-remove.txt...")
    config.paths_file = create_paths_file()

    print_paths_to_remove()
    print_final_warning()

    # Final confirmation (skip if force mode)
    if not config.force:
        if not confirm_rewrite():
            print("Aborted.")
            # Clean up temp file
            config.paths_file.unlink(missing_ok=True)
            return 1

    # Dry run mode
    if config.dry_run:
        print()
        print(f"{YELLOW}DRY RUN MODE - No changes made{NC}")
        print(f"Would run: git filter-repo --invert-paths --paths-from-file {config.paths_file} --force")
        config.paths_file.unlink(missing_ok=True)
        return 0

    # Run git-filter-repo
    if not run_filter_repo(config):
        print(f"{RED}git-filter-repo failed{NC}")
        config.paths_file.unlink(missing_ok=True)
        return 1

    # Clean up temp file
    config.paths_file.unlink(missing_ok=True)

    print_success(config.repo_root)
    return 0


def main(
    force: bool = False,
    dry_run: bool = False,
    repo_root: Optional[Path] = None
) -> int:
    """Main entry point.

    Args:
        force: Skip confirmation prompts.
        dry_run: Show what would be done without making changes.
        repo_root: Repository root directory.

    Returns:
        Exit code (0 for success).
    """
    # Get repo root
    if repo_root is None:
        repo_root = get_repo_root()
        if repo_root is None:
            print(f"{RED}Not in a git repository{NC}")
            return 1

    config = CleanupConfig(
        repo_root=repo_root,
        force=force,
        dry_run=dry_run
    )

    return cleanup(config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Full history cleanup using git-filter-repo"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Skip confirmation prompts (DANGEROUS)"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Show what would be done without making changes"
    )

    args = parser.parse_args()

    sys.exit(main(
        force=args.force,
        dry_run=args.dry_run
    ))
