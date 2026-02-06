#!/usr/bin/env python3
"""Standup report generator for GitHub Actions.

Generates a markdown report of recent repository activity.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date
from typing import TextIO


@dataclass
class ReportConfig:
    """Configuration for standup report."""

    repo_owner: str
    repo_name: str
    days_back: int = 1
    report_date: str = field(default_factory=lambda: date.today().isoformat())

    @property
    def repo_url(self) -> str:
        """Get the full repository URL."""
        return f"https://github.com/{self.repo_owner}/{self.repo_name}"

    @classmethod
    def from_environment(cls) -> ReportConfig:
        """Create config from environment variables.

        Raises:
            ValueError: If GITHUB_REPOSITORY is not set.
        """
        github_repo = os.environ.get("GITHUB_REPOSITORY", "")
        if not github_repo or "/" not in github_repo:
            raise ValueError("GITHUB_REPOSITORY environment variable not set or invalid")

        owner, name = github_repo.split("/", 1)
        return cls(repo_owner=owner, repo_name=name)


def run_command(
    cmd: list[str],
    *,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        cmd,
        capture_output=capture_output,
        text=True,
    )


def get_recent_commits(days_back: int) -> list[str]:
    """Get recent commits from the repository.

    Args:
        days_back: Number of days to look back.

    Returns:
        List of commit lines formatted as "hash - message (author)".
    """
    result = run_command([
        "git", "log",
        f"--since={days_back} days ago",
        "--pretty=format:%h - %s (%an)",
        "--abbrev-commit",
    ])

    if result.returncode != 0 or not result.stdout.strip():
        return []

    return result.stdout.strip().split("\n")


def get_open_prs() -> list[dict]:
    """Get list of open pull requests.

    Returns:
        List of PR dictionaries with number, title, author, updatedAt.
    """
    result = run_command([
        "gh", "pr", "list",
        "--json", "number,title,author,updatedAt",
        "--limit", "10",
    ])

    if result.returncode != 0 or not result.stdout.strip():
        return []

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return []


def get_recent_workflow_runs() -> list[dict]:
    """Get recent workflow runs.

    Returns:
        List of workflow run dictionaries.
    """
    result = run_command([
        "gh", "run", "list",
        "--limit", "5",
        "--json", "status,conclusion,event,headBranch,updatedAt,url",
    ])

    if result.returncode != 0 or not result.stdout.strip():
        return []

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return []


def get_review_requests() -> list[dict]:
    """Get PRs requiring review from current user.

    Returns:
        List of PR dictionaries needing review.
    """
    result = run_command([
        "gh", "pr", "list",
        "--search", "review-requested:@me",
        "--json", "number,title,author",
    ])

    if result.returncode != 0 or not result.stdout.strip():
        return []

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return []


def get_assigned_issues_count() -> int:
    """Get count of issues assigned to current user.

    Returns:
        Number of assigned issues.
    """
    result = run_command([
        "gh", "issue", "list",
        "--assignee", "@me",
        "--json", "number",
    ])

    if result.returncode != 0 or not result.stdout.strip():
        return 0

    try:
        issues = json.loads(result.stdout)
        return len(issues)
    except json.JSONDecodeError:
        return 0


def generate_report(config: ReportConfig, output: TextIO = sys.stdout) -> None:
    """Generate the standup report.

    Args:
        config: Report configuration.
        output: Output stream to write to.
    """
    # Header
    output.write(f"## 📅 Standup Report for {config.report_date}\n")
    output.write("\n")

    # Recent commits section
    output.write("### 🔄 Recent Changes\n")
    output.write("\n")

    commits = get_recent_commits(config.days_back)
    if commits:
        output.write("```\n")
        for commit in commits:
            output.write(f"{commit}\n")
        output.write("```\n")
    else:
        output.write(f"No commits in the last {config.days_back} day(s)\n")

    output.write("\n")

    # Open PRs section
    output.write("### 📌 Open Pull Requests\n")
    output.write("\n")

    prs = get_open_prs()
    if prs:
        for pr in prs:
            number = pr.get("number", "?")
            title = pr.get("title", "Untitled")
            author = pr.get("author", {}).get("login", "unknown")
            output.write(
                f"* [#{number}]({config.repo_url}/pull/{number}) {title} - @{author}\n"
            )
    else:
        output.write("No open pull requests\n")

    output.write("\n")

    # Workflow runs section
    output.write("### ⚙️ Recent Workflow Runs\n")
    output.write("\n")

    runs = get_recent_workflow_runs()
    if runs:
        for run in runs:
            event = run.get("event", "unknown")
            branch = run.get("headBranch", "unknown")
            status = run.get("status", "unknown")
            conclusion = run.get("conclusion", "")
            url = run.get("url", "")

            conclusion_str = f" {conclusion}" if conclusion else ""
            output.write(f"* [{event}] {branch} - {status}{conclusion_str} ([View]({url}))\n")
    else:
        output.write("No recent workflow runs\n")

    output.write("\n")

    # Issues & Reviews section
    output.write("### 📊 Issues & Reviews\n")
    output.write("\n")

    review_prs = get_review_requests()
    review_count = len(review_prs)
    assigned_count = get_assigned_issues_count()

    output.write(f"* Pull requests requiring review: **{review_count}**\n")
    output.write(f"* Issues assigned to me: **{assigned_count}**\n")

    if review_prs:
        output.write("\n")
        output.write("**Reviews needed:**\n")
        for pr in review_prs:
            number = pr.get("number", "?")
            title = pr.get("title", "Untitled")
            author = pr.get("author", {}).get("login", "unknown")
            output.write(
                f"* [PR #{number}]({config.repo_url}/pull/{number}) - {title} (@{author})\n"
            )

    output.write("\n")
    output.write("---\n")
    output.write(f"_Generated automatically by GitHub Actions on {config.report_date}_\n")


def main() -> int:
    """Main entry point."""
    try:
        config = ReportConfig.from_environment()
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print("Please ensure GITHUB_REPOSITORY is set (e.g., 'owner/repo')", file=sys.stderr)
        return 1

    generate_report(config)
    return 0


if __name__ == "__main__":
    sys.exit(main())
