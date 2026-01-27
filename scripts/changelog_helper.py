"""Changelog helper implemented in Python with type hints."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Sequence


COLOR_BLUE = "\033[0;34m"
COLOR_GREEN = "\033[0;32m"
COLOR_YELLOW = "\033[1;33m"
COLOR_RED = "\033[0;31m"
COLOR_RESET = "\033[0m"

CATEGORY_HEADERS: Dict[str, str] = {
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
    "feat",
    "fix",
    "security",
    "perf",
    "refactor",
    "docs",
    "deprecate",
    "remove",
    "test",
    "ci",
    "workflow",
    "chore",
    "style",
    "other",
]

CONVENTIONAL_PATTERN = re.compile(r"^([a-z]+)(\(.+\))?(!)?:\s(.+)$")


@dataclass
class CommitSummary:
    """Representation of a git commit extracted from git log."""

    hash: str
    subject: str
    body: str
    author: str


@dataclass
class ChangelogAnalysis:
    categories: Dict[str, List[str]]
    total_commits: int
    conventional_commits: int
    breaking_changes: int


def colorize(text: str, color: str) -> str:
    return f"{color}{text}{COLOR_RESET}"


def print_header(message: str) -> None:
    border = "=" * 32
    print(colorize(border, COLOR_BLUE))
    print(colorize(message, COLOR_BLUE))
    print(colorize(border, COLOR_BLUE))


def print_success(message: str) -> None:
    print(colorize(f"✓ {message}", COLOR_GREEN))


def print_warning(message: str) -> None:
    print(colorize(f"⚠ {message}", COLOR_YELLOW))


def print_error(message: str) -> None:
    print(colorize(f"✗ {message}", COLOR_RED))


def run_git_command(args: Sequence[str]) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def ensure_git_repository() -> None:
    try:
        run_git_command(["rev-parse", "--git-dir"])
    except subprocess.CalledProcessError as exc:  # pragma: no cover - simple failure
        print_error("Not a git repository")
        raise SystemExit(exc.returncode)


def detect_previous_tag(provided: str | None) -> str:
    if provided:
        return provided

    tags_output = run_git_command(["tag", "--sort=-version:refname"])
    for tag in tags_output.splitlines():
        candidate = tag.strip()
        if candidate:
            print_success(f"Auto-detected previous tag: {candidate}")
            return candidate

    print_warning("No previous tag found, using initial commit")
    return run_git_command(["rev-list", "--max-parents=0", "HEAD"])


def parse_git_log(output: str) -> List[CommitSummary]:
    commits: List[CommitSummary] = []
    for line in output.splitlines():
        if not line:
            continue
        parts = line.split("|||")
        if len(parts) != 4:
            continue
        commits.append(CommitSummary(*parts))
    return commits


def load_commits(previous: str, current: str) -> List[CommitSummary]:
    args = [
        "log",
        f"{previous}..{current}",
        "--pretty=format:%H|||%s|||%b|||%an",
        "--no-merges",
    ]
    try:
        output = run_git_command(args)
    except subprocess.CalledProcessError:
        output = ""
    return parse_git_log(output)


def analyze_commits(commits: Sequence[CommitSummary]) -> ChangelogAnalysis:
    categories: Dict[str, List[str]] = {key: [] for key in CATEGORY_HEADERS}
    total = conventional = breaking = 0

    for commit in commits:
        if not commit.hash:
            continue
        total += 1
        short_hash = commit.hash[:7]

        match = CONVENTIONAL_PATTERN.match(commit.subject)
        body_breaking = "BREAKING CHANGE" in commit.body
        breaking_change = body_breaking

        if match:
            ctype, scope, bang, description = match.groups()
            conventional += 1
            if bang:
                breaking_change = True
            entry = "- "
            if breaking_change:
                entry += "**BREAKING**: "
            if scope:
                entry += f"**{scope.strip('()')}**: {description} (`{short_hash}`)"
            else:
                entry += f"{description} (`{short_hash}`)"

            category = ctype if ctype in CATEGORY_HEADERS else "other"
            categories[category].append(entry)
        else:
            entry = f"- {commit.subject} (`{short_hash}`)"
            categories["other"].append(entry)

        if breaking_change:
            breaking += 1

    return ChangelogAnalysis(categories, total, conventional, breaking)


def count_contributors(previous: str, current: str) -> int:
    output = run_git_command([
        "log",
        f"{previous}..{current}",
        "--format=%an",
        "--no-merges",
    ])
    contributors = {line.strip() for line in output.splitlines() if line.strip()}
    return len(contributors)


def format_categories(categories: Dict[str, List[str]]) -> str:
    lines: List[str] = []
    for key in CATEGORY_ORDER:
        entries = categories.get(key) or []
        if not entries:
            continue
        lines.append(CATEGORY_HEADERS[key])
        lines.append("")
        lines.extend(entries)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def prompt_save_file(version: str, date_str: str, categories: Dict[str, List[str]]) -> None:
    if not (sys.stdout.isatty() and sys.stdin.isatty()):
        return

    try:
        response = input("Save to file? (y/N) ").strip().lower()
    except EOFError:
        return
    if response not in {"y", "yes"}:
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    sanitized_version = version.replace("/", "-") or "unreleased"
    output_file = Path(f"changelog-{sanitized_version}-{timestamp}.md")
    with output_file.open("w", encoding="utf-8") as handle:
        handle.write(f"## [{version}]{date_str}\n\n")
        handle.write(format_categories(categories))

    print_success(f"Saved to: {output_file}")


def build_stats_block(analysis: ChangelogAnalysis, contributors: int) -> None:
    print_header("Statistics")
    print("")
    print(f"Total commits:         {analysis.total_commits}")
    print(f"Conventional commits:  {analysis.conventional_commits}")
    print(f"Breaking changes:      {analysis.breaking_changes}")
    print(f"Contributors:          {contributors}")
    print("")

    if analysis.total_commits:
        percent = analysis.conventional_commits * 100 // analysis.total_commits
        if percent < 50:
            print_warning(
                f"Only {percent}% of commits follow conventional format;"
                " consider adopting it more broadly"
            )
        elif percent < 80:
            print_success(f"{percent}% conventional commits (good progress!)")
        else:
            print_success(f"{percent}% conventional commits (excellent!)")


def print_contributors(previous: str, current: str) -> None:
    print_header("Contributors")
    print("")
    output = run_git_command([
        "log",
        f"{previous}..{current}",
        "--format=%an",
        "--no-merges",
    ])
    names = sorted({line.strip() for line in output.splitlines() if line.strip()})
    for name in names:
        print(f"  - {name}")
    print("")


def print_next_steps(version: str) -> None:
    print_header("Next Steps")
    print("")
    print("1. Copy the changelog entry above")
    print("2. Open CHANGELOG.md and add it under the appropriate version")
    print("3. Review and refine descriptions for clarity")
    print("4. Add any additional context or migration notes")
    print(f"5. Commit with: git commit -m 'docs: update CHANGELOG.md for {version}'")
    print("")


def render_changelog(previous: str, current: str) -> int:
    commits = load_commits(previous, current)
    if not commits:
        print_error(f"No commits found between {previous} and {current}")
        return 1

    analysis = analyze_commits(commits)
    contributors = count_contributors(previous, current)

    if current == "HEAD":
        version = "Unreleased"
        date_str = ""
        print_warning("Using HEAD as current version (unreleased)")
    else:
        version = current.lstrip("v") or current
        date_str = f" - {datetime.now():%Y-%m-%d}"

    print_header("Generating Changelog")
    print(f"From: {previous}")
    print(f"To:   {current}")
    print("")

    print_header("Changelog Entry")
    print("")
    print(f"## [{version}]{date_str}\n")
    print(format_categories(analysis.categories))

    build_stats_block(analysis, contributors)
    print_contributors(previous, current)

    if analysis.breaking_changes:
        print_warning(
            f"This release contains {analysis.breaking_changes} breaking change(s)."
        )
        print("   Ensure migration guide is included in changelog\n")

    print_next_steps(version)
    prompt_save_file(version, date_str, analysis.categories)
    print_success("Changelog generation complete!")
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate changelog entries from git commits")
    parser.add_argument("previous", nargs="?", help="Previous tag")
    parser.add_argument("current", nargs="?", default="HEAD", help="Current tag")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    ensure_git_repository()
    args = parse_args(argv)

    previous = detect_previous_tag(args.previous)
    current = args.current or "HEAD"

    try:
        return render_changelog(previous, current)
    except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
        print_error(f"Git command failed: {exc}")
        return exc.returncode


if __name__ == "__main__":
    sys.exit(main())
