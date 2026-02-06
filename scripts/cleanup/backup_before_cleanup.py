#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "backup-before-cleanup"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "maintenance"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Backup script for vibecode-webgui before major cleanup.

Run this BEFORE any destructive operations to create a full backup
including git bundle, branch archives, and config files.
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Important branches to archive
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


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        cwd=cwd,
    )


def get_repo_root() -> Path:
    """Get the git repository root."""
    result = run_cmd(["git", "rev-parse", "--show-toplevel"])
    if result.returncode != 0:
        print("Error: Not in a git repository")
        sys.exit(1)
    return Path(result.stdout.strip())


def create_git_bundle(backup_dir: Path, repo_root: Path) -> None:
    """Create git bundle with all branches and tags."""
    print("1. Creating git bundle with ALL branches and tags...")
    bundle_path = backup_dir / "vibecode-complete.bundle"
    result = run_cmd(
        ["git", "bundle", "create", str(bundle_path), "--all"],
        cwd=repo_root,
    )
    if result.returncode == 0:
        print(f"   {Colors.GREEN}[OK]{Colors.NC} Bundle created: {bundle_path}")
    else:
        print(f"   {Colors.YELLOW}[!]{Colors.NC} Bundle creation failed")


def export_branch_list(backup_dir: Path, repo_root: Path) -> None:
    """Export list of all branches."""
    print()
    print("2. Exporting branch list...")
    result = run_cmd(["git", "branch", "-a"], cwd=repo_root)
    branches_file = backup_dir / "all-branches.txt"
    branches_file.write_text(result.stdout)
    print(f"   {Colors.GREEN}[OK]{Colors.NC} Branches saved: {branches_file}")


def export_worktree_list(backup_dir: Path, repo_root: Path) -> None:
    """Export worktree list."""
    print()
    print("3. Exporting worktree list...")
    result = run_cmd(["git", "worktree", "list"], cwd=repo_root)
    worktrees_file = backup_dir / "worktrees.txt"
    worktrees_file.write_text(result.stdout)
    print(f"   {Colors.GREEN}[OK]{Colors.NC} Worktrees saved: {worktrees_file}")


def archive_branches(backup_dir: Path, repo_root: Path) -> None:
    """Create archives of important branches."""
    print()
    print("4. Creating archives of important branches...")

    archives_dir = backup_dir / "branch-archives"
    archives_dir.mkdir(exist_ok=True)

    for branch in IMPORTANT_BRANCHES:
        safe_name = branch.replace("/", "-")

        # Check if branch exists
        result = run_cmd(
            ["git", "rev-parse", "--verify", branch],
            cwd=repo_root,
        )
        if result.returncode != 0:
            print(f"   {Colors.YELLOW}[!]{Colors.NC} Skipped (not found): {branch}")
            continue

        print(f"   Archiving: {branch}...")
        archive_path = archives_dir / f"{safe_name}.tar.gz"
        result = run_cmd(
            [
                "git",
                "archive",
                "--format=tar.gz",
                f"--prefix={safe_name}/",
                branch,
            ],
            cwd=repo_root,
        )
        if result.returncode == 0:
            archive_path.write_bytes(result.stdout.encode("latin-1") if result.stdout else b"")
        else:
            print(
                f"   {Colors.YELLOW}[!]{Colors.NC} Skipped (not found locally): {branch}"
            )


def backup_config_files(backup_dir: Path, repo_root: Path) -> None:
    """Backup important config files."""
    print()
    print("5. Backing up important config files...")

    config_dir = backup_dir / "config-backup"
    config_dir.mkdir(exist_ok=True)

    config_files = [
        ".gitignore",
        "package.json",
        "tsconfig.json",
    ]

    for config_file in config_files:
        src = repo_root / config_file
        if src.exists():
            dst = config_dir / config_file
            dst.write_bytes(src.read_bytes())

    # Also copy next.config.* files
    for config in repo_root.glob("next.config.*"):
        dst = config_dir / config.name
        dst.write_bytes(config.read_bytes())

    print(f"   {Colors.GREEN}[OK]{Colors.NC} Config files backed up")


def record_repo_state(backup_dir: Path, repo_root: Path) -> None:
    """Record repository state information."""
    print()
    print("6. Recording repository state...")

    # Get various git info
    head = run_cmd(["git", "rev-parse", "HEAD"], cwd=repo_root).stdout.strip()
    branch_result = run_cmd(["git", "branch", "--show-current"], cwd=repo_root)
    current_branch = branch_result.stdout.strip() or "(detached)"
    count_objects = run_cmd(["git", "count-objects", "-vH"], cwd=repo_root).stdout
    recent_commits = run_cmd(["git", "log", "--oneline", "-20"], cwd=repo_root).stdout

    state_file = backup_dir / "repo-state.txt"
    state_file.write_text(f"""Backup created: {datetime.now().isoformat()}
Repository: {repo_root}
Current HEAD: {head}
Current branch: {current_branch}

Git object count:
{count_objects}

Recent commits (last 20):
{recent_commits}
""")

    print(f"   {Colors.GREEN}[OK]{Colors.NC} Repository state recorded")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=None,
        help="Custom backup directory (default: ~/vibecode-backup-TIMESTAMP)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    # Create backup directory
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = args.backup_dir or Path.home() / f"vibecode-backup-{timestamp}"
    repo_root = get_repo_root()

    print("=" * 48)
    print("VibCode Repository Backup Script")
    print("=" * 48)
    print(f"Backup directory: {backup_dir}")
    print(f"Repository root: {repo_root}")
    print()

    backup_dir.mkdir(parents=True, exist_ok=True)

    create_git_bundle(backup_dir, repo_root)
    export_branch_list(backup_dir, repo_root)
    export_worktree_list(backup_dir, repo_root)
    archive_branches(backup_dir, repo_root)
    backup_config_files(backup_dir, repo_root)
    record_repo_state(backup_dir, repo_root)

    print()
    print("=" * 48)
    print("BACKUP COMPLETE!")
    print("=" * 48)
    print()
    print(f"Backup location: {backup_dir}")
    print()
    print("Contents:")

    # List backup contents
    for item in sorted(backup_dir.iterdir()):
        print(f"  {item.name}")

    print()
    print("To restore from bundle:")
    print(f"  git clone {backup_dir}/vibecode-complete.bundle restored-repo")
    print()
    print("To verify bundle:")
    print(f"  git bundle verify {backup_dir}/vibecode-complete.bundle")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())