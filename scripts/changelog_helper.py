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

"""
Changelog Helper Script

Generates formatted changelog entries from git commits.
Converts changelog-helper.sh to Python with proper error handling.

Usage: python changelog_helper.py [previous_tag] [current_tag]
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


# ANSI colors
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"  # No Color


# Category headers
CATEGORY_HEADERS = {
    "feat": "### Added",
    "fix": "### Fixed",
    "security": "### Security",
    "perf": "### Performance",
    "refactor": "### Changed",
    "docs": "### Documentation",
    "test": "### Tests",
    "ci": "### CI/CD",
    "workflow": "### Workflow",
    "chore": "### Maintenance",
    "style": "### Style",
    "deprecate": "### Deprecated",
    "remove": "### Removed",
    "other": "### Other Changes",
}

CATEGORY_ORDER = [
    "feat", "fix", "security", "perf", "refactor", "docs",
    "deprecate", "remove", "test", "ci", "workflow", "chore",
    "style", "other"
]


@dataclass
class CommitInfo:
    """Parsed commit information."""
    hash: str
    subject: str
    body: str
    author: str
    commit_type: Optional[str] = None
    scope: Optional[str] = None
    description: Optional[str] = None
    is_breaking: bool = False


def print_header(text: str) -> None:
    """Print a colored header."""
    print(f"{Colors.BLUE}================================{Colors.NC}")
    print(f"{Colors.BLUE}{text}{Colors.NC}")
    print(f"{Colors.BLUE}================================{Colors.NC}")


def print_success(text: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}{text}{Colors.NC}")


def print_warning(text: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}{text}{Colors.NC}")


def print_error(text: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}{text}{Colors.NC}")


def is_git_repo() -> bool:
    """Check if current directory is a git repository."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
        )
        return result.returncode == 0
    except Exception:
        return False


def get_latest_tag() -> Optional[str]:
    """Get the most recent tag."""
    try:
        result = subprocess.run(
            ["git", "tag", "--sort=-version:refname"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")[0]
    except Exception:
        pass
    return None


def get_initial_commit() -> Optional[str]:
    """Get the initial commit hash."""
    try:
        result = subprocess.run(
            ["git", "rev-list", "--max-parents=0", "HEAD"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def get_commits(from_ref: str, to_ref: str) -> list[CommitInfo]:
    """Get commits between two refs."""
    try:
        result = subprocess.run(
            [
                "git", "log", f"{from_ref}..{to_ref}",
                "--pretty=format:%H|||%s|||%b|||%an",
                "--no-merges",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0 or not result.stdout.strip():
            return []

        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue

            parts = line.split("|||")
            if len(parts) >= 4:
                commits.append(CommitInfo(
                    hash=parts[0],
                    subject=parts[1],
                    body=parts[2],
                    author=parts[3],
                ))

        return commits
    except Exception:
        return []


def parse_conventional_commit(commit: CommitInfo) -> CommitInfo:
    """Parse conventional commit format."""
    # Check for breaking change
    if "!" in commit.subject or "BREAKING CHANGE" in commit.body:
        commit.is_breaking = True

    # Parse conventional commit: type(scope)!: description
    pattern = r"^([a-z]+)(\(.+\))?(!)?:\s+(.+)$"
    match = re.match(pattern, commit.subject)

    if match:
        commit.commit_type = match.group(1)
        scope = match.group(2)
        if scope:
            commit.scope = scope.strip("()")
        commit.description = match.group(4)
    else:
        commit.commit_type = "other"
        commit.description = commit.subject

    return commit


def get_contributors(from_ref: str, to_ref: str) -> list[str]:
    """Get unique contributors between refs."""
    try:
        result = subprocess.run(
            [
                "git", "log", f"{from_ref}..{to_ref}",
                "--format=%an",
                "--no-merges",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            names = set(result.stdout.strip().split("\n"))
            return sorted(names)
    except Exception:
        pass
    return []


def format_commit_entry(commit: CommitInfo) -> str:
    """Format a commit as a changelog entry."""
    short_hash = commit.hash[:7]

    if commit.is_breaking:
        prefix = "- **BREAKING**: "
    else:
        prefix = "- "

    if commit.scope:
        return f"{prefix}**{commit.scope}**: {commit.description} (`{short_hash}`)"
    else:
        return f"{prefix}{commit.description} (`{short_hash}`)"


def generate_changelog(
    commits: list[CommitInfo],
    version: str,
    date_str: str,
) -> str:
    """Generate the changelog markdown."""
    # Categorize commits
    categories: dict[str, list[str]] = defaultdict(list)

    for commit in commits:
        commit = parse_conventional_commit(commit)
        entry = format_commit_entry(commit)

        if commit.commit_type in CATEGORY_HEADERS:
            categories[commit.commit_type].append(entry)
        else:
            categories["other"].append(entry)

    # Build output
    lines = [f"## [{version}]{date_str}", ""]

    for cat in CATEGORY_ORDER:
        if categories[cat]:
            lines.append(CATEGORY_HEADERS[cat])
            lines.append("")
            lines.extend(categories[cat])
            lines.append("")

    return "\n".join(lines)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate changelog entries from git commits"
    )
    parser.add_argument(
        "previous_tag",
        nargs="?",
        help="Previous tag (auto-detected if not provided)",
    )
    parser.add_argument(
        "current_tag",
        nargs="?",
        default="HEAD",
        help="Current tag (default: HEAD)",
    )
    parser.add_argument(
        "-o", "--output",
        help="Output file (optional)",
    )

    args = parser.parse_args()

    # Check git repo
    if not is_git_repo():
        print_error("Not a git repository")
        return 1

    # Determine previous tag
    previous_tag = args.previous_tag
    if not previous_tag:
        previous_tag = get_latest_tag()
        if previous_tag:
            print_success(f"Auto-detected previous tag: {previous_tag}")
        else:
            print_warning("No previous tag found, using initial commit")
            previous_tag = get_initial_commit()
            if not previous_tag:
                print_error("Could not determine starting point")
                return 1

    current_tag = args.current_tag
    if current_tag == "HEAD":
        print_warning("Using HEAD as current version (unreleased)")

    print_header("Generating Changelog")
    print(f"From: {previous_tag}")
    print(f"To:   {current_tag}")
    print()

    # Get commits
    commits = get_commits(previous_tag, current_tag)
    if not commits:
        print_error(f"No commits found between {previous_tag} and {current_tag}")
        return 1

    # Calculate statistics
    total_commits = len(commits)
    conventional_commits = 0
    breaking_changes = 0

    for commit in commits:
        commit = parse_conventional_commit(commit)
        if commit.commit_type != "other":
            conventional_commits += 1
        if commit.is_breaking:
            breaking_changes += 1

    # Determine version string
    if current_tag == "HEAD":
        version = "Unreleased"
        date_str = ""
    else:
        version = current_tag.lstrip("v")
        date_str = f" - {datetime.now().strftime('%Y-%m-%d')}"

    # Generate changelog
    changelog = generate_changelog(commits, version, date_str)

    print_header("Changelog Entry")
    print()
    print(changelog)

    # Statistics
    print_header("Statistics")
    print()
    print(f"Total commits:         {total_commits}")
    print(f"Conventional commits:  {conventional_commits}")
    print(f"Breaking changes:      {breaking_changes}")

    contributors = get_contributors(previous_tag, current_tag)
    print(f"Contributors:          {len(contributors)}")
    print()

    # Conventional commit percentage
    if total_commits > 0:
        pct = (conventional_commits * 100) // total_commits
        if pct < 50:
            print_warning(f"Only {pct}% of commits follow conventional format")
            print("   Consider adopting conventional commits for better automation")
        elif pct < 80:
            print_success(f"{pct}% conventional commits (good progress!)")
        else:
            print_success(f"{pct}% conventional commits (excellent!)")

    # Contributors
    print_header("Contributors")
    print()
    for name in contributors:
        print(f"  - {name}")
    print()

    # Breaking changes warning
    if breaking_changes > 0:
        print_warning(f"This release contains {breaking_changes} breaking change(s)")
        print("   Ensure migration guide is included in changelog")
        print()

    # Save to file
    if args.output:
        Path(args.output).write_text(changelog)
        print_success(f"Saved to: {args.output}")

    print_header("Next Steps")
    print()
    print("1. Copy the changelog entry above")
    print("2. Open CHANGELOG.md and add it under appropriate version")
    print("3. Review and refine descriptions for clarity")
    print("4. Add any additional context or migration notes")
    print(f"5. Commit with: git commit -m 'docs: update CHANGELOG.md for {version}'")
    print()

    print_success("Changelog generation complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())