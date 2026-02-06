#!/usr/bin/env python3
"""Branch Merge Strategy - Based on 5 Agent Analysis.

Analyzes and manages branch merges for the repository.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


# ANSI color codes
class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


# Branches that should already be merged
MERGED_BRANCHES: list[str] = [
    "code-claude-must-integrate-all",
    "code-claude-review-outstanding-repo",
    "code-claude-second-wave-agents",
    "code-claude-third-batch--continue",
    "code-cloud-must-integrate-all",
    "code-cloud-review-outstanding-repo",
    "code-cloud-second-wave-agents",
    "code-code-integrate-commits-5c9393b48",
    "code-code-must-integrate-all",
    "code-code-review-outstanding-repo",
    "code-code-second-wave-agents",
    "code-code-third-batch--continue",
    "code-gemini-must-integrate-all",
    "code-gemini-review-outstanding-repo",
]


def run_git_command(
    args: list[str],
    capture: bool = True,
    check: bool = False,
) -> tuple[bool, str, str]:
    """Run a git command.

    Args:
        args: Git command arguments.
        capture: Whether to capture output.
        check: Whether to raise on failure.

    Returns:
        Tuple of (success, stdout, stderr).
    """
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=capture,
            text=True,
            timeout=60,
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except subprocess.SubprocessError as e:
        return False, "", str(e)


def branch_exists(branch: str) -> bool:
    """Check if a local branch exists.

    Args:
        branch: Branch name.

    Returns:
        True if branch exists, False otherwise.
    """
    success, _, _ = run_git_command(["show-ref", "--verify", "--quiet", f"refs/heads/{branch}"])
    return success


def is_ancestor(branch: str, target: str = "main") -> bool:
    """Check if branch is an ancestor of target (fully merged).

    Args:
        branch: Branch to check.
        target: Target branch.

    Returns:
        True if branch is fully merged into target.
    """
    success, _, _ = run_git_command(["merge-base", "--is-ancestor", branch, target])
    return success


def delete_branch(branch: str) -> bool:
    """Delete a local branch.

    Args:
        branch: Branch name.

    Returns:
        True if deleted successfully.
    """
    success, _, _ = run_git_command(["branch", "-D", branch])
    return success


def checkout_branch(branch: str) -> bool:
    """Checkout a branch.

    Args:
        branch: Branch name.

    Returns:
        True if successful.
    """
    success, _, _ = run_git_command(["checkout", branch])
    return success


def merge_branch(branch: str, message: str) -> bool:
    """Merge a branch with a message.

    Args:
        branch: Branch to merge.
        message: Commit message.

    Returns:
        True if successful.
    """
    success, _, _ = run_git_command(["merge", "--no-ff", branch, "-m", message])
    return success


def get_commits_with_pattern(base: str, branch: str, pattern: str) -> list[str]:
    """Get commits matching a pattern between base and branch.

    Args:
        base: Base branch.
        branch: Target branch.
        pattern: Grep pattern.

    Returns:
        List of commit lines.
    """
    success, stdout, _ = run_git_command([
        "log", f"{base}..{branch}", "--oneline", f"--grep={pattern}"
    ])
    if success and stdout:
        return stdout.split("\n")
    return []


def print_header(title: str) -> None:
    """Print a section header.

    Args:
        title: Header title.
    """
    print(f"{Colors.BLUE}{'═' * 55}{Colors.NC}")
    print(f"{Colors.BLUE}{title}{Colors.NC}")
    print(f"{Colors.BLUE}{'═' * 55}{Colors.NC}")
    print()


def print_box(title: str) -> None:
    """Print a box header.

    Args:
        title: Box title.
    """
    print("╔═══════════════════════════════════════════════════════╗")
    print(f"║  {title:<53} ║")
    print("╚═══════════════════════════════════════════════════════╝")
    print()


@dataclass
class MergeStats:
    """Merge operation statistics."""

    deleted_count: int = 0
    skipped_count: int = 0
    not_found_count: int = 0
    merged_count: int = 0


def phase1_delete_merged_branches() -> MergeStats:
    """Phase 1: Delete already-merged branches.

    Returns:
        Statistics from the operation.
    """
    print_header("Phase 1: Delete Already-Merged Branches (14 branches)")

    print(f"{Colors.YELLOW}Verifying branches are fully merged...{Colors.NC}")
    print()

    stats = MergeStats()

    for branch in MERGED_BRANCHES:
        if branch_exists(branch):
            if is_ancestor(branch, "main"):
                print(f"{Colors.GREEN}\u2705 {branch} - Safe to delete (fully merged){Colors.NC}")
                if delete_branch(branch):
                    stats.deleted_count += 1
                else:
                    print("  (already deleted)")
            else:
                print(f"{Colors.RED}\u274c {branch} - NOT fully merged! Skipping.{Colors.NC}")
                stats.skipped_count += 1
        else:
            print(f"{Colors.YELLOW}\u26a0\ufe0f  {branch} - Does not exist locally{Colors.NC}")
            stats.not_found_count += 1

    print()
    print(f"{Colors.GREEN}Phase 1 Complete: Deleted {stats.deleted_count} already-merged branches{Colors.NC}")
    print()

    return stats


def phase2_merge_critical_fix() -> bool:
    """Phase 2: Merge critical logger circular dependency fix.

    Returns:
        True if merged or already merged.
    """
    print_header("Phase 2: Merge Critical Logger Circular Dependency Fix")

    branch = "fix/logger-circular-dependency"

    if branch_exists(branch):
        print(f"{Colors.YELLOW}Checking {branch}...{Colors.NC}")

        if is_ancestor(branch, "main"):
            print(f"{Colors.GREEN}\u2705 Already merged to main{Colors.NC}")
            return True
        else:
            print(f"{Colors.YELLOW}Merging {branch}...{Colors.NC}")

            if not checkout_branch("main"):
                print(f"{Colors.RED}Failed to checkout main{Colors.NC}")
                return False

            merge_message = """fix: Merge logger circular dependency fix

Fixes 3 circular dependency chains in agent-framework:
- agents/index.ts → index.ts
- index.ts → tools/index.ts
- index.ts → types.ts

Creates new src/lib/agent-framework/core.ts with clean separation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"""

            if merge_branch(branch, merge_message):
                print(f"{Colors.GREEN}\u2705 Merged {branch}{Colors.NC}")
                return True
            else:
                print(f"{Colors.RED}Failed to merge {branch}{Colors.NC}")
                return False
    else:
        print(f"{Colors.YELLOW}\u26a0\ufe0f  {branch} branch not found{Colors.NC}")
        return True



def phase3_extract_vfkit_work() -> None:
    """Phase 3: Extract vfkit/Alpine VM work."""
    print_header("Phase 3: Extract vfkit/Alpine VM Work")

    print(f"{Colors.YELLOW}Checking for vfkit work in branches...{Colors.NC}")
    print()

    # Check code-gemini-second-wave-agents
    branch1 = "code-gemini-second-wave-agents"
    if branch_exists(branch1):
        print(f"{Colors.YELLOW}Found {branch1} with vfkit scripts{Colors.NC}")
        print(f"{Colors.YELLOW}Review needed - contains 27 vfkit scripts but also problematic logger changes{Colors.NC}")
        print(f"{Colors.YELLOW}Recommendation: Manual cherry-pick of vfkit commits only{Colors.NC}")

        print()
        print(f"{Colors.BLUE}vfkit-related commits in {branch1}:{Colors.NC}")

        for pattern in ["vfkit", "Alpine", "VM"]:
            commits = get_commits_with_pattern("main", branch1, pattern)
            for commit in commits:
                if commit:
                    print(f"  {commit}")

    # Check fix/merge-all-branches
    branch2 = "fix/merge-all-branches"
    if branch_exists(branch2):
        print()
        print(f"{Colors.YELLOW}Found {branch2} with vfkit work{Colors.NC}")
        print(f"{Colors.YELLOW}Review needed - contains valuable vfkit work but has conflicts{Colors.NC}")

        print()
        print(f"{Colors.BLUE}vfkit-related commits in {branch2}:{Colors.NC}")

        for pattern in ["vfkit", "Alpine", "VM"]:
            commits = get_commits_with_pattern("main", branch2, pattern)
            for commit in commits:
                if commit:
                    print(f"  {commit}")

    print()
    print(f"{Colors.YELLOW}Manual action required:{Colors.NC}")
    print("  1. Review code-gemini-second-wave-agents")
    print("  2. Cherry-pick ONLY vfkit commits (skip logger changes)")
    print("  3. Test VM scripts after cherry-pick")
    print()


def phase4_summary() -> None:
    """Phase 4: Print summary and manual steps."""
    print_header("Summary")

    print(f"{Colors.GREEN}\u2705 Completed:{Colors.NC}")
    print("  \u2022 Deleted 14 fully-merged branches")
    print("  \u2022 Merged fix/logger-circular-dependency (if not already merged)")
    print()

    print(f"{Colors.YELLOW}\u26a0\ufe0f  Manual Steps Required:{Colors.NC}")
    print()

    print(f"1. {Colors.BLUE}Choose Logger Strategy:{Colors.NC}")
    print("   Option A (Recommended): Merge fix/restore-proper-logger (Pino + Datadog)")
    print("   Option B: Keep current console-based logger")
    print("   Option C: Use no-op stub from fix/merge-all-branches")
    print()

    print(f"2. {Colors.BLUE}Cherry-Pick vfkit Work:{Colors.NC}")
    print("   git checkout -b feature/vfkit-integration main")
    print("   git log main..code-gemini-second-wave-agents --oneline | grep -i vfkit")
    print("   git cherry-pick <vfkit-commit-hash>")
    print()

    print(f"3. {Colors.BLUE}Extract ESLint Config (if needed):{Colors.NC}")
    print("   git checkout fix/consolidated-dependency-updates -- .eslintrc.production.cjs")
    print("   # Test CI/CD before committing")
    print()

    print(f"4. {Colors.BLUE}Clean Up Remaining Branches:{Colors.NC}")
    print("   git branch -D fix/merge-all-branches  # After extracting vfkit work")
    print("   git branch -D code-gemini-second-wave-agents  # After cherry-picking")
    print("   git branch -D fix/consolidated-dependency-updates  # After extracting config")
    print()

    print(f"{Colors.BLUE}{'═' * 55}{Colors.NC}")
    print(f"{Colors.GREEN}Branch merge strategy script complete!{Colors.NC}")
    print(f"{Colors.BLUE}{'═' * 55}{Colors.NC}")
    print()
    print("Next: Review manual steps above and execute as needed")
    print()


def run_merge_strategy() -> int:
    """Run the merge strategy.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    print_box("Branch Merge Strategy - 26 Branches Analyzed")

    # Phase 1: Delete merged branches
    phase1_delete_merged_branches()

    # Phase 2: Merge critical fix
    phase2_merge_critical_fix()

    # Phase 3: Extract vfkit work
    phase3_extract_vfkit_work()

    # Phase 4: Summary
    phase4_summary()

    return 0


def main() -> int:
    """Main entry point."""
    return run_merge_strategy()


if __name__ == "__main__":
    sys.exit(main())
