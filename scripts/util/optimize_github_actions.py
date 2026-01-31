#!/usr/bin/env python3
"""GitHub Actions cost optimization script.

Disables expensive workflows and implements release branch strategy.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Expensive workflows to disable
EXPENSIVE_WORKFLOWS = [
    "ci-complex.yml",
    "ci-enhancements.yml",
    "ci-cd.yml",
    "ci.yml",
    "docker-multiarch.yml",
    "k8s-deploy.yml",
    "kind-testing.yml",
    "performance-gates.yml",
    "production-deployment.yml",
    "synthetic-test.yml",
    "working-ci.yml",
]

# Essential workflows to keep
KEEP_WORKFLOWS = [
    "deploy-docs.yml",
    "secret-scanning.yml",
    "dependabot.yml",
    "main-branch-ci.yml",
    "release-branch-ci.yml",
]

COST_MONITOR_WORKFLOW = """name: GitHub Actions Cost Monitor

on:
  schedule:
    - cron: '0 9 * * MON'  # Weekly on Monday
  workflow_dispatch:

jobs:
  cost-report:
    runs-on: ubuntu-latest
    steps:
      - name: Weekly cost reminder
        run: |
          echo "GitHub Actions Cost Optimization Active"
          echo "Current strategy:"
          echo "  Main branch: Lightweight CI only (~$0.05 per run)"
          echo "  Release branches: Full CI/CD (~$2-4 per run)"
          echo ""
          echo "To run full tests:"
          echo "  1. Create branch: git checkout -b release/v1.x.x"
          echo "  2. Push: git push origin release/v1.x.x"
          echo "  3. Full CI/CD will run automatically"
          echo ""
          echo "Expected monthly savings: ~70-80% ($100 -> $20-30)"
"""

RELEASE_BRANCH_SCRIPT = """#!/bin/bash

# Helper script to create release branches for full CI/CD testing

if [ -z "$1" ]; then
    echo "Usage: ./create-release-branch.sh <version>"
    echo "Example: ./create-release-branch.sh v1.2.0"
    exit 1
fi

VERSION=$1
BRANCH_NAME="release/$VERSION"

echo "Creating release branch: $BRANCH_NAME"

# Create and switch to release branch
git checkout -b "$BRANCH_NAME"

# Push to trigger full CI/CD
git push -u origin "$BRANCH_NAME"

echo "Release branch created and pushed"
echo "Full CI/CD pipeline will run automatically"
echo "Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\\([^.]*\\).*/\\1/')/actions"
"""

README_ADDITION = """
## GitHub Actions Cost Optimization

To control costs, we use a two-tier CI/CD strategy:

### Main Branch (Lightweight)
- Fast linting and basic unit tests only
- ~$0.05 per run

### Release Branches (Comprehensive)
- Full test suite (unit, integration, E2E)
- Security scans and performance testing
- Production deployment pipelines
- ~$2-4 per run

### Creating Release Branches
```bash
# Create release branch for full testing
./create-release-branch.sh v1.2.0
```
"""


def run_cmd(
    cmd: list[str],
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--skip-readme",
        action="store_true",
        help="Don't update README.md",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()
    workflows_dir = repo_root / ".github" / "workflows"
    disabled_dir = workflows_dir / "disabled-expensive"
    dry_run: bool = args.dry_run

    print("Optimizing GitHub Actions for cost control...")

    if dry_run:
        print("(dry run - no changes will be made)")

    # Create disabled directory
    if not dry_run:
        disabled_dir.mkdir(parents=True, exist_ok=True)

    # Move expensive workflows
    print("\nMoving expensive workflows to disabled directory...")
    moved_count = 0
    for workflow in EXPENSIVE_WORKFLOWS:
        workflow_path = workflows_dir / workflow
        if workflow_path.exists():
            if dry_run:
                print(f"  Would move: {workflow}")
            else:
                shutil.move(str(workflow_path), str(disabled_dir / workflow))
                print(f"  Moved: {workflow}")
            moved_count += 1

    # Show kept workflows
    print(f"\n{Colors.GREEN}Keeping essential workflows:{Colors.NC}")
    for workflow in KEEP_WORKFLOWS:
        if (workflows_dir / workflow).exists():
            print(f"  {workflow}")

    # Create cost monitor workflow
    cost_monitor_path = workflows_dir / "cost-monitor.yml"
    if not dry_run:
        cost_monitor_path.write_text(COST_MONITOR_WORKFLOW)
        print(f"\nCreated: {cost_monitor_path}")

    # Create release branch helper script
    release_script_path = repo_root / "create-release-branch.sh"
    if not dry_run:
        release_script_path.write_text(RELEASE_BRANCH_SCRIPT)
        release_script_path.chmod(0o755)
        print(f"Created: {release_script_path}")

    # Update README
    readme_path = repo_root / "README.md"
    if not args.skip_readme and readme_path.exists():
        if not dry_run:
            with open(readme_path, "a") as f:
                f.write(README_ADDITION)
            print(f"Updated: {readme_path}")

    # Summary
    print()
    print(f"{Colors.GREEN}GitHub Actions optimization complete!{Colors.NC}")
    print()
    print("Cost Impact:")
    print("  Before: ~$100/month (full CI on every commit)")
    print("  After:  ~$20-30/month (70-80% reduction)")
    print()
    print("How to use:")
    print("  Main branch: Automatic lightweight CI")
    print("  Full testing: ./create-release-branch.sh v1.x.x")
    print()
    print(f"Disabled workflows moved to: {disabled_dir}")
    print("Active workflows: main-branch-ci.yml, release-branch-ci.yml")

    return 0


if __name__ == "__main__":
    sys.exit(main())
