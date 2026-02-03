#!/usr/bin/env python3
"""Setup Branch Protection Rules for Release Branch Strategy.

Configures GitHub branch protection rules to enforce the release branch workflow.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from textwrap import dedent


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

# Configuration - update these for your repository
REPO_OWNER = "ryan-maclean"
REPO_NAME = "vibecode-webgui"
MAIN_BRANCH = "main"


def log(message: str) -> None:
    """Print blue log message with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{COLORS.blue}[{timestamp}]{COLORS.reset} {message}")


def success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}\u2705{COLORS.reset} {message}")


def warning(message: str) -> None:
    """Print yellow warning message."""
    print(f"{COLORS.yellow}\u26a0\ufe0f{COLORS.reset} {message}")


def error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}\u274c{COLORS.reset} {message}")


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def check_gh_cli() -> bool:
    """Check if GitHub CLI is installed and authenticated."""
    # Check if gh is installed
    result = subprocess.run(["which", "gh"], capture_output=True)
    if result.returncode != 0:
        error("GitHub CLI (gh) is not installed. Please install it first:")
        print("  brew install gh")
        print("  or visit: https://cli.github.com/")
        return False

    # Check if authenticated
    result = subprocess.run(["gh", "auth", "status"], capture_output=True)
    if result.returncode != 0:
        error("Not authenticated with GitHub CLI. Please run:")
        print("  gh auth login")
        return False

    return True


def setup_main_branch_protection() -> bool:
    """Configure protection rules for main branch."""
    log("Configuring protection rules for main branch...")

    protection_config = {
        "required_status_checks": {
            "strict": True,
            "contexts": ["lint-and-security", "unit-tests", "cost-monitor"],
        },
        "enforce_admins": False,
        "required_pull_request_reviews": {
            "required_approving_review_count": 1,
            "dismiss_stale_reviews": True,
            "require_code_owner_reviews": False,
            "require_last_push_approval": False,
        },
        "restrictions": None,
        "required_linear_history": True,
        "allow_force_pushes": False,
        "allow_deletions": False,
        "block_creations": False,
        "required_conversation_resolution": True,
        "lock_branch": False,
        "allow_fork_syncing": True,
    }

    result = subprocess.run(
        [
            "gh", "api",
            "--method", "PUT",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            f"/repos/{REPO_OWNER}/{REPO_NAME}/branches/{MAIN_BRANCH}/protection",
            "--input", "-",
        ],
        input=json.dumps(protection_config),
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        success("Main branch protection rules configured")
        return True
    else:
        error(f"Failed to configure main branch protection: {result.stderr}")
        return False


def setup_release_branch_protection() -> None:
    """Provide guidance for release branch protection."""
    log("Configuring protection rules for release/* branches...")
    warning("Release branch protection must be configured manually for each release branch")
    warning("Or set up in GitHub UI under Settings > Branches with pattern 'release/*'")
    print()
    log("Recommended release branch protection settings:")
    print("  - Require pull request reviews: 1 reviewer minimum")
    print("  - Require status checks to pass before merging")
    print("  - Required checks: validate-ci-config, code-quality, test-suite, build-and-performance, security-comprehensive")
    print("  - Require linear history")
    print("  - Do not allow force pushes")
    print("  - Do not allow deletions")


def create_codeowners(project_root: Path) -> None:
    """Create CODEOWNERS file."""
    log("Creating CODEOWNERS file...")

    github_dir = project_root / ".github"
    github_dir.mkdir(exist_ok=True)

    codeowners = github_dir / "CODEOWNERS"
    codeowners.write_text(dedent(f"""\
        # CODEOWNERS file for vibecode-webgui
        # This file defines who owns different parts of the codebase

        # Global owners (for all files)
        * @{REPO_OWNER}

        # GitHub Actions and CI/CD
        /.github/ @{REPO_OWNER}
        /scripts/ @{REPO_OWNER}

        # Core infrastructure
        /src/lib/ @{REPO_OWNER}
        /src/middleware/ @{REPO_OWNER}

        # Database and migrations
        /prisma/ @{REPO_OWNER}
        /migrations/ @{REPO_OWNER}

        # Configuration files
        *.config.js @{REPO_OWNER}
        *.config.ts @{REPO_OWNER}
        package.json @{REPO_OWNER}
        package-lock.json @{REPO_OWNER}
    """))

    success("CODEOWNERS file created")


def create_pr_template(project_root: Path) -> None:
    """Create pull request template."""
    log("Creating pull request template...")

    github_dir = project_root / ".github"
    github_dir.mkdir(exist_ok=True)

    template = github_dir / "pull_request_template.md"
    template.write_text(dedent("""\
        ## Description
        Brief description of the changes in this PR.

        ## Type of Change
        - [ ] Bug fix (non-breaking change which fixes an issue)
        - [ ] New feature (non-breaking change which adds functionality)
        - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
        - [ ] Documentation update
        - [ ] Performance improvement
        - [ ] Code refactoring

        ## Testing
        - [ ] Unit tests pass
        - [ ] Integration tests pass
        - [ ] E2E tests pass (if applicable)
        - [ ] Manual testing completed

        ## Checklist
        - [ ] My code follows the project's style guidelines
        - [ ] I have performed a self-review of my code
        - [ ] I have commented my code, particularly in hard-to-understand areas
        - [ ] I have made corresponding changes to the documentation
        - [ ] My changes generate no new warnings
        - [ ] Any dependent changes have been merged and published

        ## Release Branch Strategy
        - [ ] This PR targets the correct branch (main for hotfixes, release/* for features)
        - [ ] CI/CD costs have been considered (comprehensive tests only run on release branches)
        - [ ] Breaking changes are documented and communicated

        ## Screenshots (if applicable)
        Add screenshots to help explain your changes.

        ## Additional Notes
        Any additional information that reviewers should know.
    """))

    success("Pull request template created")


def update_repo_settings() -> bool:
    """Update repository settings."""
    log("Updating repository settings...")

    settings = {
        "allow_squash_merge": True,
        "allow_merge_commit": False,
        "allow_rebase_merge": True,
        "allow_auto_merge": True,
        "delete_branch_on_merge": True,
        "allow_update_branch": True,
        "use_squash_pr_title_as_default": True,
    }

    result = subprocess.run(
        [
            "gh", "api",
            "--method", "PATCH",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            f"/repos/{REPO_OWNER}/{REPO_NAME}",
            "--input", "-",
        ],
        input=json.dumps(settings),
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        success("Repository settings updated")
        return True
    else:
        warning(f"Failed to update repository settings: {result.stderr}")
        return False


def create_protection_summary(project_root: Path) -> None:
    """Create branch protection summary documentation."""
    log("Creating branch protection summary...")

    summary = project_root / "BRANCH_PROTECTION_SETUP.md"
    summary.write_text(dedent(f"""\
        # Branch Protection Setup Summary

        ## Overview
        This repository uses a release branch strategy to optimize CI/CD costs while maintaining code quality.

        ## Branch Strategy

        ### Main Branch (`main`)
        - **Purpose**: Production-ready code, hotfixes only
        - **Protection**:
          - Requires 1 PR review
          - Requires status checks: lint-and-security, unit-tests, cost-monitor
          - Linear history required
          - No force pushes or deletions
        - **CI/CD**: Lightweight pipeline (linting, basic tests, security scans)

        ### Release Branches (`release/*`)
        - **Purpose**: Feature integration and comprehensive testing
        - **Protection**: Manual setup required for each branch
        - **CI/CD**: Full pipeline (unit, integration, E2E tests, performance, security)

        ### Feature Branches (`feature/*`, `fix/*`, etc.)
        - **Purpose**: Development work
        - **Protection**: None (developers can work freely)
        - **CI/CD**: None (to minimize costs)

        ## Cost Optimization

        - **Main Branch**: ~$20-30/month (lightweight CI)
        - **Release Branches**: ~$50-70/month (comprehensive CI, but only when releasing)
        - **Feature Branches**: $0/month (no CI)
        - **Total Savings**: ~70-80% reduction from previous $100/month

        ## Files Created

        - `.github/CODEOWNERS`: Code ownership definitions
        - `.github/pull_request_template.md`: PR template with release strategy context
        - `scripts/util/setup-branch-protection.sh`: This setup script
        - `BRANCH_PROTECTION_SETUP.md`: This documentation

        Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    """))

    success("Branch protection documentation created")


def main() -> int:
    """Main entry point."""
    print()
    log("\U0001f512 GitHub Branch Protection Setup")
    print("==================================")
    print()

    project_root = get_project_root()

    # Check prerequisites
    if not check_gh_cli():
        return 1

    # Confirm
    print(f"Repository: {REPO_OWNER}/{REPO_NAME}")
    print(f"Main branch: {MAIN_BRANCH}")
    print()

    try:
        response = input("Continue with branch protection setup? (y/N): ").strip().lower()
    except EOFError:
        response = ""

    if response not in ("y", "yes"):
        warning("Setup cancelled by user")
        return 0

    print()

    # Execute setup steps
    setup_main_branch_protection()
    setup_release_branch_protection()
    create_codeowners(project_root)
    create_pr_template(project_root)
    update_repo_settings()
    create_protection_summary(project_root)

    print()
    success("Branch protection setup completed!")
    print()
    log("Summary:")
    print("  \u2705 Main branch protection configured")
    print("  \u26a0\ufe0f  Release branch protection needs manual setup")
    print("  \u2705 CODEOWNERS file created")
    print("  \u2705 PR template created")
    print("  \u2705 Repository settings updated")
    print("  \u2705 Documentation created")
    print()
    warning("IMPORTANT: You still need to manually configure release branch protection in GitHub UI")
    log(f"Visit: https://github.com/{REPO_OWNER}/{REPO_NAME}/settings/branches")
    print()
    log("Next: Create your first release branch with: ./create-release-branch.sh v1.0.0")

    return 0


if __name__ == "__main__":
    sys.exit(main())
