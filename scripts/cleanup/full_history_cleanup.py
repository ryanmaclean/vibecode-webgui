#!/usr/bin/env python3
"""Full history cleanup using git-filter-repo.

DESTRUCTIVE OPERATION - Run backup-before-cleanup.sh first!

This script removes large files and secrets from git history.
After running, you MUST force push and all collaborators must re-clone.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


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


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def get_repo_root() -> Path:
    """Get the git repository root."""
    result = run_cmd(["git", "rev-parse", "--show-toplevel"])
    if result.returncode != 0:
        print(f"{Colors.RED}[X] Not in a git repository{Colors.NC}")
        sys.exit(1)
    return Path(result.stdout.strip())


def check_git_filter_repo() -> bool:
    """Check if git-filter-repo is installed."""
    if not shutil.which("git-filter-repo"):
        print(f"{Colors.RED}[X] git-filter-repo is not installed.{Colors.NC}")
        print("   Install with: brew install git-filter-repo")
        return False
    return True


def check_clean_working_dir() -> bool:
    """Check for clean working directory."""
    diff_result = run_cmd(["git", "diff", "--quiet"])
    cached_result = run_cmd(["git", "diff", "--cached", "--quiet"])

    if diff_result.returncode != 0 or cached_result.returncode != 0:
        print(f"{Colors.RED}[X] Working directory is not clean.{Colors.NC}")
        print("   Please commit or stash changes first.")
        return False
    return True


def get_paths_to_remove() -> list[str]:
    """Get list of paths to remove, filtering comments and empty lines."""
    paths = []
    for line in PATHS_TO_REMOVE.strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            paths.append(line)
    return paths


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompts (dangerous!)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be removed without making changes",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    repo_root = get_repo_root()

    print("=" * 48)
    print(f"{Colors.YELLOW}[!] GIT HISTORY REWRITE SCRIPT{Colors.NC}")
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

    # Check dependencies
    if not check_git_filter_repo():
        return 1

    if not check_clean_working_dir():
        return 1

    # Confirmation
    if not args.yes:
        print()
        response = input("Have you created a full backup? (yes/no) ")
        if response.lower() != "yes":
            print("Please run: ./scripts/cleanup/backup-before-cleanup.sh")
            return 1

    # Create paths file
    paths = get_paths_to_remove()

    print()
    print("Files/directories to be removed from ALL history:")
    for path in paths:
        print(f"  {path}")

    if args.dry_run:
        print()
        print(f"{Colors.YELLOW}[!] DRY RUN - No changes made{Colors.NC}")
        return 0

    print()
    print("=" * 48)
    print(f"{Colors.YELLOW}[!] FINAL WARNING{Colors.NC}")
    print("=" * 48)
    print()
    print("This will PERMANENTLY modify git history.")
    print("After this operation:")
    print("  1. You must force push: git push --force --all")
    print("  2. All team members must re-clone the repository")
    print("  3. All open PRs will need to be recreated")
    print()

    if not args.yes:
        confirm = input("Type 'REWRITE HISTORY' to proceed: ")
        if confirm != "REWRITE HISTORY":
            print("Aborted.")
            return 1

    print()
    print("Starting git-filter-repo...")
    print()

    # Write paths to temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("\n".join(paths))
        paths_file = f.name

    try:
        result = run_cmd(
            [
                "git",
                "filter-repo",
                "--invert-paths",
                "--paths-from-file",
                paths_file,
                "--force",
            ]
        )

        if result.returncode != 0:
            print(f"{Colors.RED}[X] git-filter-repo failed{Colors.NC}")
            if result.stderr:
                print(result.stderr)
            return 1
    finally:
        Path(paths_file).unlink(missing_ok=True)

    print()
    print("=" * 48)
    print(f"{Colors.GREEN}[OK] History rewrite complete!{Colors.NC}")
    print("=" * 48)
    print()
    print("New repository stats:")
    stats = run_cmd(["git", "count-objects", "-vH"])
    print(stats.stdout)
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

    return 0


if __name__ == "__main__":
    sys.exit(main())
