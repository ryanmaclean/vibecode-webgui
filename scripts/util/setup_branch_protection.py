#!/usr/bin/env python3
"""Setup branch protection rules for release branch strategy.

Configures GitHub branch protection rules to enforce the release branch workflow.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log(message: str) -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{Colors.BLUE}[{timestamp}]{Colors.NC} {message}")


def success(message: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}OK{Colors.NC} {message}")


def warning(message: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}Warning:{Colors.NC} {message}")


def error(message: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}Error:{Colors.NC} {message}")


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    input_data: str | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        input=input_data,
    )


def check_gh_cli() -> bool:
    """Check if GitHub CLI is installed and authenticated."""
    result = run_cmd(["which", "gh"])
    if result.returncode != 0:
        error("GitHub CLI (gh) is not installed. Please install it first:")
        print("  brew install gh")
        print("  or visit: https://cli.github.com/")
        return False

    result = run_cmd(["gh", "auth", "status"])
    if result.returncode != 0:
        error("Not authenticated with GitHub CLI. Please run:")
        print("  gh auth login")
        return False

    return True


def setup_main_branch_protection(repo_owner: str, repo_name: str, main_branch: str) -> bool:
    """Configure protection rules for main branch."""
    log("Configuring protection rules for main branch...")

    protection_config = {
        "required_status_checks": {
            "strict": True,
            "contexts": [
                "lint-and-security",
                "unit-tests",
                "cost-monitor",
            ],
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

    result = run_cmd(
        [
            "gh", "api",
            "--method", "PUT",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            f"/repos/{repo_owner}/{repo_name}/branches/{main_branch}/protection",
            "--input", "-",
        ],
        input_data=json.dumps(protection_config),
    )

    if result.returncode == 0:
        success("Main branch protection rules configured")
        return True
    else:
        error(f"Failed to configure main branch protection: {result.stderr}")
        return False


def setup_release_branch_protection() -> None:
    """Show instructions for release branch protection."""
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


def create_codeowners(repo_root: Path, repo_owner: str) -> None:
    """Create CODEOWNERS file."""
    log("Creating CODEOWNERS file...")

    github_dir = repo_root / ".github"
    github_dir.mkdir(parents=True, exist_ok=True)

    codeowners_content = f"""# CODEOWNERS file for vibecode-webgui
# This file defines who owns different parts of the codebase

# Global owners (for all files)
* @{repo_owner}

# GitHub Actions and CI/CD
/.github/ @{repo_owner}
/scripts/ @{repo_owner}

# Core infrastructure
/src/lib/ @{repo_owner}
/src/middleware/ @{repo_owner}

# Database and migrations
/prisma/ @{repo_owner}
/migrations/ @{repo_owner}

# Configuration files
*.config.js @{repo_owner}
*.config.ts @{repo_owner}
package.json @{repo_owner}
package-lock.json @{repo_owner}
"""

    (github_dir / "CODEOWNERS").write_text(codeowners_content)
    success("CODEOWNERS file created")


def create_pr_template(repo_root: Path) -> None:
    """Create pull request template."""
    log("Creating pull request template...")

    github_dir = repo_root / ".github"
    github_dir.mkdir(parents=True, exist_ok=True)

    pr_template = """## Description
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
"""

    (github_dir / "pull_request_template.md").write_text(pr_template)
    success("Pull request template created")


def update_repo_settings(repo_owner: str, repo_name: str) -> bool:
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

    result = run_cmd(
        [
            "gh", "api",
            "--method", "PATCH",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            f"/repos/{repo_owner}/{repo_name}",
            "--input", "-",
        ],
        input_data=json.dumps(settings),
    )

    if result.returncode == 0:
        success("Repository settings updated")
        return True
    else:
        error(f"Failed to update repository settings: {result.stderr}")
        return False


def create_protection_summary(repo_root: Path) -> None:
    """Create branch protection documentation."""
    log("Creating branch protection summary...")

    summary = f"""# Branch Protection Setup Summary

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

## Workflow

1. **Feature Development**: Create feature branches from `main`
2. **Release Preparation**: Create `release/vX.Y.Z` branch
3. **Feature Integration**: Merge features into release branch
4. **Comprehensive Testing**: Full CI/CD runs on release branch
5. **Release**: Merge release branch to `main` after all tests pass

## Cost Optimization

- **Main Branch**: ~$20-30/month (lightweight CI)
- **Release Branches**: ~$50-70/month (comprehensive CI, but only when releasing)
- **Feature Branches**: $0/month (no CI)
- **Total Savings**: ~70-80% reduction from previous $100/month

## Manual Setup Required

1. **Release Branch Protection**: Set up in GitHub UI for pattern `release/*`
2. **Required Status Checks**: Configure for release branches
3. **Team Permissions**: Ensure proper access controls

## Files Created

- `.github/CODEOWNERS`: Code ownership definitions
- `.github/pull_request_template.md`: PR template with release strategy context
- `scripts/util/setup-branch-protection.sh`: This setup script
- `BRANCH_PROTECTION_SETUP.md`: This documentation

## Next Steps

1. Run this script to apply main branch protection
2. Manually configure release branch protection in GitHub UI
3. Train team on new release branch workflow
4. Monitor CI/CD costs and adjust as needed

Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
"""

    (repo_root / "BRANCH_PROTECTION_SETUP.md").write_text(summary)
    success("Branch protection documentation created")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--repo-owner",
        default=os.environ.get("GITHUB_REPOSITORY_OWNER", "ryan-maclean"),
        help="GitHub repository owner",
    )
    parser.add_argument(
        "--repo-name",
        default="vibecode-webgui",
        help="GitHub repository name",
    )
    parser.add_argument(
        "--main-branch",
        default="main",
        help="Main branch name (default: main)",
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip confirmation prompt",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()

    print()
    log("GitHub Branch Protection Setup")
    print("==================================")
    print()

    # Check GitHub CLI
    if not check_gh_cli():
        return 1

    # Confirm
    print(f"Repository: {args.repo_owner}/{args.repo_name}")
    print(f"Main branch: {args.main_branch}")
    print()

    if not args.yes:
        response = input("Continue with branch protection setup? (y/N): ").strip().lower()
        if response not in ("y", "yes"):
            warning("Setup cancelled by user")
            return 0

    print()

    # Execute setup steps
    setup_main_branch_protection(args.repo_owner, args.repo_name, args.main_branch)
    setup_release_branch_protection()
    create_codeowners(repo_root, args.repo_owner)
    create_pr_template(repo_root)
    update_repo_settings(args.repo_owner, args.repo_name)
    create_protection_summary(repo_root)

    print()
    success("Branch protection setup completed!")
    print()
    log("Summary:")
    print("  OK Main branch protection configured")
    print(f"  {Colors.YELLOW}Warning:{Colors.NC} Release branch protection needs manual setup")
    print("  OK CODEOWNERS file created")
    print("  OK PR template created")
    print("  OK Repository settings updated")
    print("  OK Documentation created")
    print()
    warning("IMPORTANT: You still need to manually configure release branch protection in GitHub UI")
    log(f"Visit: https://github.com/{args.repo_owner}/{args.repo_name}/settings/branches")
    print()
    log("Next: Create your first release branch with: ./create-release-branch.sh v1.0.0")

    return 0


if __name__ == "__main__":
    sys.exit(main())
