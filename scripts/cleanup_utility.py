#!/usr/bin/env python3
"""Unified Cleanup Utility for VibeCode Repository.

Consolidates all cleanup operations:
- backup: Create full repository backup before cleanup
- binaries: Remove large binary files from git tracking
- secrets: Remove tracked secret files from git index
- history: Rewrite git history to remove files completely

Usage:
    ./scripts/cleanup_utility.py backup
    ./scripts/cleanup_utility.py binaries --dry-run
    ./scripts/cleanup_utility.py secrets
    ./scripts/cleanup_utility.py history --force
    ./scripts/cleanup_utility.py all --dry-run
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ANSI colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'

# Important branches to backup
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

# Large binary patterns to remove
BINARY_PATTERNS = [
    "azure/*.cpio.gz",
    "azure/*.cpio.gz.*",
    "azure/*.img",
    "azure/*.img.gz",
    "azure/vmlinuz*",
    "azure/vmlinux*",
    "azure/linux-kernel*",
    "azure/bun-openvscode*",
    "azure/nodejs-complete*",
    "bench-images/",
    "artifacts/",
    "release-artifacts/",
    "demos/venv311/",
    "*.tar.gz",
    "vibecode-vm-*.tar.gz",
]

# Secret files to remove from tracking
SECRET_FILES = [
    ".env.docker.fixed",
    ".env.docker",
    ".env.test-db",
    ".env.test-external-db",
    ".env.local.backup",
    ".env.azure",
    ".env.valkey",
    "config/env/.env.docker.fixed",
    "config/env/.env.docker",
    "config/env/.env.test-db",
    "config/env/.env.test-external-db",
    "config/env/.env.local.backup",
    "config/env/.env.azure",
    "config/env/.env.valkey",
]

# Paths to remove from git history completely
HISTORY_PATHS_TO_REMOVE = """
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

# Build artifact directories
artifacts/
bench-images/
demos/venv311/
release-artifacts/
src-tauri/target/
VibeCode-VMs/.build/
macos-vm/.build/
docs/node_modules/
extensions/vibecode-ai-assistant/node_modules/

# Large binaries
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
    backup_dir: Path = field(default_factory=Path)
    dry_run: bool = False
    force: bool = False
    verbose: bool = False


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
    cwd: Optional[Path] = None
) -> tuple[int, str, str]:
    """Run a command and return the result."""
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
    """Get the git repository root."""
    rc, stdout, _ = run_command(["git", "rev-parse", "--show-toplevel"])
    if rc == 0:
        return Path(stdout.strip())
    return None


def confirm(message: str, force: bool = False) -> bool:
    """Ask for user confirmation."""
    if force:
        return True
    try:
        response = input(f"{message} (y/N) ").strip()
        return response.lower() == 'y'
    except (EOFError, KeyboardInterrupt):
        return False


def print_header(title: str) -> None:
    """Print a section header."""
    print("=" * 48)
    print(title)
    print("=" * 48)
    print()


# =============================================================================
# Backup Operations
# =============================================================================

def create_backup(config: CleanupConfig) -> int:
    """Create full repository backup.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header("VibeCode Repository Backup")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = Path.home() / f"vibecode-backup-{timestamp}"

    if config.dry_run:
        print(f"{YELLOW}DRY RUN - Would create backup at: {backup_dir}{NC}")
        return 0

    print(f"Backup directory: {backup_dir}")
    print(f"Repository root: {config.repo_root}")
    print()

    backup_dir.mkdir(parents=True, exist_ok=True)

    # 1. Create git bundle
    print("1. Creating git bundle with ALL branches and tags...")
    bundle_path = backup_dir / "vibecode-complete.bundle"
    rc, _, _ = run_command(
        ["git", "bundle", "create", str(bundle_path), "--all"],
        cwd=config.repo_root
    )
    if rc == 0:
        print(f"   {GREEN}Bundle created: {bundle_path}{NC}")
    else:
        print(f"   {RED}Failed to create bundle{NC}")
        return 1

    # 2. Export branch list
    print()
    print("2. Exporting branch list...")
    rc, stdout, _ = run_command(["git", "branch", "-a"], cwd=config.repo_root)
    if rc == 0:
        (backup_dir / "all-branches.txt").write_text(stdout)
        print(f"   {GREEN}Branches saved{NC}")

    # 3. Export worktree list
    print()
    print("3. Exporting worktree list...")
    rc, stdout, _ = run_command(["git", "worktree", "list"], cwd=config.repo_root)
    if rc == 0:
        (backup_dir / "worktrees.txt").write_text(stdout)
        print(f"   {GREEN}Worktrees saved{NC}")

    # 4. Archive important branches
    print()
    print("4. Creating archives of important branches...")
    archives_dir = backup_dir / "branch-archives"
    archives_dir.mkdir(exist_ok=True)

    for branch in IMPORTANT_BRANCHES:
        safe_name = branch.replace("/", "-")
        rc, _, _ = run_command(
            ["git", "rev-parse", "--verify", branch],
            cwd=config.repo_root
        )
        if rc == 0:
            print(f"   Archiving: {branch}...")
            archive_path = archives_dir / f"{safe_name}.tar.gz"
            run_command(
                ["git", "archive", "--format=tar.gz",
                 f"--prefix={safe_name}/", branch, "-o", str(archive_path)],
                cwd=config.repo_root
            )
        else:
            print(f"   {YELLOW}Skipped (not found): {branch}{NC}")

    # 5. Backup config files
    print()
    print("5. Backing up important config files...")
    config_backup = backup_dir / "config-backup"
    config_backup.mkdir(exist_ok=True)

    config_files = [".gitignore", "package.json", "tsconfig.json"]
    for cf in config_files:
        src = config.repo_root / cf
        if src.exists():
            shutil.copy2(src, config_backup / cf)

    # Copy next.config.* files
    for cf in config.repo_root.glob("next.config.*"):
        shutil.copy2(cf, config_backup / cf.name)

    print(f"   {GREEN}Config files backed up{NC}")

    # 6. Record repository state
    print()
    print("6. Recording repository state...")

    rc, head, _ = run_command(["git", "rev-parse", "HEAD"], cwd=config.repo_root)
    rc, branch, _ = run_command(["git", "branch", "--show-current"], cwd=config.repo_root)
    rc, objects, _ = run_command(["git", "count-objects", "-vH"], cwd=config.repo_root)
    rc, log, _ = run_command(["git", "log", "--oneline", "-20"], cwd=config.repo_root)

    state = f"""Backup created: {datetime.now()}
Repository: {config.repo_root}
Current HEAD: {head.strip()}
Current branch: {branch.strip() or "(detached)"}

Git object count:
{objects}

Recent commits (last 20):
{log}
"""
    (backup_dir / "repo-state.txt").write_text(state)
    print(f"   {GREEN}Repository state recorded{NC}")

    # Summary
    print()
    print_header("BACKUP COMPLETE!")
    print(f"Backup location: {backup_dir}")
    print()
    print("To restore from bundle:")
    print(f"  git clone {bundle_path} restored-repo")
    print()
    print("To verify bundle:")
    print(f"  git bundle verify {bundle_path}")

    config.backup_dir = backup_dir
    return 0


# =============================================================================
# Binary Removal Operations
# =============================================================================

def get_tracked_files_matching(pattern: str, repo_root: Path) -> list[str]:
    """Get tracked files matching a pattern."""
    rc, stdout, _ = run_command(
        ["git", "ls-files", pattern],
        cwd=repo_root
    )
    if rc == 0 and stdout.strip():
        return [f for f in stdout.strip().split('\n') if f]
    return []


def get_large_tracked_files(repo_root: Path, min_size_kb: int = 1024) -> list[tuple[str, int]]:
    """Get tracked files larger than min_size_kb."""
    rc, stdout, _ = run_command(["git", "ls-files"], cwd=repo_root)
    if rc != 0:
        return []

    large_files = []
    for file in stdout.strip().split('\n'):
        if not file:
            continue
        file_path = repo_root / file
        if file_path.exists() and file_path.is_file():
            size_kb = file_path.stat().st_size // 1024
            if size_kb > min_size_kb:
                large_files.append((file, size_kb))

    return sorted(large_files, key=lambda x: x[1], reverse=True)


def remove_binaries(config: CleanupConfig) -> int:
    """Remove large binary files from git tracking.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header("Removing Large Binary Files from Git Index")
    print(f"{YELLOW}This will untrack files but NOT delete them from disk.{NC}")
    print()

    # Show large tracked files
    print("Currently tracked large files (>1MB):")
    large_files = get_large_tracked_files(config.repo_root)[:30]
    for file, size_kb in large_files:
        print(f"  {size_kb:6d} KB  {file}")

    # Find files matching binary patterns
    print()
    print("Files matching binary patterns to untrack:")
    files_to_untrack = []
    for pattern in BINARY_PATTERNS:
        matches = get_tracked_files_matching(pattern, config.repo_root)
        for f in matches:
            if f not in files_to_untrack:
                files_to_untrack.append(f)
                print(f"  - {f}")

    if not files_to_untrack:
        print("  (no files found)")
        return 0

    if config.dry_run:
        print()
        print(f"{YELLOW}DRY RUN - No changes made{NC}")
        return 0

    if not confirm("\nProceed with untracking these files?", config.force):
        print("Aborted.")
        return 0

    # Untrack files
    for file in files_to_untrack:
        print(f"Untracking: {file}")
        run_command(["git", "rm", "--cached", file], cwd=config.repo_root)

    print()
    print(f"{GREEN}Binary files untracked.{NC}")
    print()
    print("Now commit this change:")
    print("   git commit -m 'chore: remove large binary files from tracking'")
    print()
    print(f"{YELLOW}These files still exist in git history!{NC}")
    print("   For complete removal, use: cleanup_utility.py history")

    return 0


# =============================================================================
# Secret Removal Operations
# =============================================================================

def is_file_tracked(file: str, repo_root: Path) -> bool:
    """Check if a file is tracked by git."""
    rc, _, _ = run_command(
        ["git", "ls-files", "--error-unmatch", file],
        cwd=repo_root
    )
    return rc == 0


def remove_secrets(config: CleanupConfig) -> int:
    """Remove tracked secret files from git index.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header("Removing Tracked Secret Files from Git Index")
    print(f"{YELLOW}This will untrack files but NOT delete them from disk.{NC}")
    print()

    # Check which secret files are tracked
    print("Files to untrack:")
    tracked_secrets = []
    for file in SECRET_FILES:
        if is_file_tracked(file, config.repo_root):
            tracked_secrets.append(file)
            print(f"  - {file} (tracked)")
        else:
            print(f"  - {file} (not tracked, skipping)")

    if not tracked_secrets:
        print()
        print("No tracked secret files found.")
        return 0

    if config.dry_run:
        print()
        print(f"{YELLOW}DRY RUN - No changes made{NC}")
        return 0

    if not confirm("\nProceed with untracking?", config.force):
        print("Aborted.")
        return 0

    # Untrack files
    for file in tracked_secrets:
        print(f"Untracking: {file}")
        run_command(["git", "rm", "--cached", file], cwd=config.repo_root)

    print()
    print(f"{GREEN}Files untracked.{NC}")
    print()
    print("Now commit this change:")
    print("   git commit -m 'chore: remove tracked secret files'")
    print()
    print(f"{YELLOW}Remember: secrets are still in git history!{NC}")
    print("   For complete removal, use: cleanup_utility.py history")

    return 0


# =============================================================================
# History Cleanup Operations
# =============================================================================

def check_git_filter_repo() -> bool:
    """Check if git-filter-repo is installed."""
    return shutil.which("git-filter-repo") is not None


def check_working_directory_clean(repo_root: Path) -> bool:
    """Check if working directory is clean."""
    rc1, _, _ = run_command(["git", "diff", "--quiet"], cwd=repo_root)
    rc2, _, _ = run_command(["git", "diff", "--cached", "--quiet"], cwd=repo_root)
    return rc1 == 0 and rc2 == 0


def cleanup_history(config: CleanupConfig) -> int:
    """Rewrite git history to remove files completely.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header(f"{RED}GIT HISTORY REWRITE{NC}")
    print()
    print("This will PERMANENTLY rewrite git history to remove:")
    print("  - Large binary files (kernels, cpio, disk images)")
    print("  - Secret/environment files")
    print("  - Build artifacts committed by mistake")
    print()
    print("Prerequisites:")
    print("  1. Run 'cleanup_utility.py backup' first")
    print("  2. Install git-filter-repo: brew install git-filter-repo")
    print("  3. Coordinate with all team members")
    print()

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

    # Confirm backup
    if not config.force:
        if not confirm("Have you created a full backup?"):
            print("Please run: cleanup_utility.py backup")
            return 1

    # Show paths to remove
    print()
    print("Files/directories to be removed from ALL history:")
    for line in HISTORY_PATHS_TO_REMOVE.strip().split('\n'):
        line = line.strip()
        if line and not line.startswith('#'):
            print(f"  {line}")

    # Final warning
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

    if config.dry_run:
        print(f"{YELLOW}DRY RUN - No changes made{NC}")
        return 0

    if not config.force:
        try:
            response = input("Type 'REWRITE HISTORY' to proceed: ").strip()
            if response != "REWRITE HISTORY":
                print("Aborted.")
                return 0
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            return 0

    # Create paths file
    import tempfile
    fd, paths_file = tempfile.mkstemp(suffix='.txt', prefix='vibecode-paths-')
    with os.fdopen(fd, 'w') as f:
        f.write(HISTORY_PATHS_TO_REMOVE)

    print()
    print("Starting git-filter-repo...")
    print()

    # Run git-filter-repo
    rc, stdout, stderr = run_command([
        "git", "filter-repo",
        "--invert-paths",
        "--paths-from-file", paths_file,
        "--force"
    ], cwd=config.repo_root)

    # Cleanup temp file
    Path(paths_file).unlink(missing_ok=True)

    if stdout:
        print(stdout)
    if stderr:
        print(stderr)

    if rc != 0:
        print(f"{RED}git-filter-repo failed{NC}")
        return 1

    # Success
    print()
    print("=" * 48)
    print(f"{GREEN}History rewrite complete!{NC}")
    print("=" * 48)
    print()

    rc, stats, _ = run_command(["git", "count-objects", "-vH"], cwd=config.repo_root)
    print("New repository stats:")
    print(stats)
    print()
    print("Next steps:")
    print("  1. Verify the repository works correctly")
    print("  2. Force push all branches:")
    print("     git push --force --all origin")
    print("     git push --force --tags origin")
    print("  3. Notify team to re-clone")

    return 0


# =============================================================================
# Main
# =============================================================================

def run_all(config: CleanupConfig) -> int:
    """Run all cleanup operations in order.

    Args:
        config: Cleanup configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header("Running All Cleanup Operations")

    # 1. Backup
    print(f"\n{BLUE}Step 1: Creating backup...{NC}\n")
    rc = create_backup(config)
    if rc != 0:
        return rc

    # 2. Remove binaries
    print(f"\n{BLUE}Step 2: Removing binary files...{NC}\n")
    rc = remove_binaries(config)
    if rc != 0:
        return rc

    # 3. Remove secrets
    print(f"\n{BLUE}Step 3: Removing secret files...{NC}\n")
    rc = remove_secrets(config)
    if rc != 0:
        return rc

    # 4. History cleanup (only if not dry-run)
    if not config.dry_run:
        print(f"\n{BLUE}Step 4: History cleanup...{NC}\n")
        rc = cleanup_history(config)
        if rc != 0:
            return rc

    print()
    print(f"{GREEN}All cleanup operations complete!{NC}")
    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Unified Cleanup Utility for VibeCode Repository",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  backup    Create full repository backup
  binaries  Remove large binary files from git tracking
  secrets   Remove tracked secret files from git index
  history   Rewrite git history to remove files completely
  all       Run all cleanup operations in order

Examples:
  %(prog)s backup
  %(prog)s binaries --dry-run
  %(prog)s secrets
  %(prog)s history --force
  %(prog)s all --dry-run
"""
    )
    parser.add_argument(
        'command',
        choices=['backup', 'binaries', 'secrets', 'history', 'all'],
        help="Cleanup command to run"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Skip confirmation prompts"
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Get repo root
    repo_root = get_repo_root()
    if repo_root is None:
        print(f"{RED}Error: Not in a git repository{NC}", file=sys.stderr)
        return 1

    config = CleanupConfig(
        repo_root=repo_root,
        dry_run=args.dry_run,
        force=args.force,
        verbose=args.verbose
    )

    # Dispatch command
    commands = {
        'backup': create_backup,
        'binaries': remove_binaries,
        'secrets': remove_secrets,
        'history': cleanup_history,
        'all': run_all,
    }

    return commands[args.command](config)


if __name__ == "__main__":
    sys.exit(main())
