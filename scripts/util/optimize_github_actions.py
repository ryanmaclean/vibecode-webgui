#!/usr/bin/env python3
"""GitHub Actions Cost Optimization Script.

Disables expensive workflows and implements release branch strategy.
"""

from __future__ import annotations

import sys
from pathlib import Path
from textwrap import dedent


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


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

KEEP_WORKFLOWS = [
    "deploy-docs.yml",
    "secret-scanning.yml",
    "dependabot.yml",
    "main-branch-ci.yml",
    "release-branch-ci.yml",
]


def get_cost_monitor_workflow() -> str:
    """Get the cost monitor workflow content."""
    return dedent("""\
        name: GitHub Actions Cost Monitor

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
                  echo "📊 GitHub Actions Cost Optimization Active"
                  echo "Current strategy:"
                  echo "  ✅ Main branch: Lightweight CI only (~$0.05 per run)"
                  echo "  🚀 Release branches: Full CI/CD (~$2-4 per run)"
                  echo ""
                  echo "💡 To run full tests:"
                  echo "  1. Create branch: git checkout -b release/v1.x.x"
                  echo "  2. Push: git push origin release/v1.x.x"
                  echo "  3. Full CI/CD will run automatically"
                  echo ""
                  echo "Expected monthly savings: ~70-80% ($100 → $20-30)"
    """)


def get_release_branch_script() -> str:
    """Get the release branch helper script content."""
    return dedent("""\
        #!/bin/bash

        # Helper script to create release branches for full CI/CD testing

        if [ -z "$1" ]; then
            echo "Usage: ./create-release-branch.sh <version>"
            echo "Example: ./create-release-branch.sh v1.2.0"
            exit 1
        fi

        VERSION=$1
        BRANCH_NAME="release/$VERSION"

        echo "🚀 Creating release branch: $BRANCH_NAME"

        # Create and switch to release branch
        git checkout -b "$BRANCH_NAME"

        # Push to trigger full CI/CD
        git push -u origin "$BRANCH_NAME"

        echo "✅ Release branch created and pushed"
        echo "🔄 Full CI/CD pipeline will run automatically"
        echo "📊 Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\\([^.]*\\).*/\\1/')/actions"
    """)


def main() -> int:
    """Main entry point."""
    print("\U0001f680 Optimizing GitHub Actions for cost control...")

    project_root = get_project_root()
    workflows_dir = project_root / ".github" / "workflows"
    disabled_dir = workflows_dir / "disabled-expensive"

    # Create backup directory
    disabled_dir.mkdir(parents=True, exist_ok=True)

    # Move expensive workflows
    print("\U0001f4e6 Moving expensive workflows to disabled directory...")
    moved_count = 0
    for workflow in EXPENSIVE_WORKFLOWS:
        src = workflows_dir / workflow
        if src.exists():
            print(f"  Moving {workflow}")
            src.rename(disabled_dir / workflow)
            moved_count += 1

    # Report kept workflows
    print("\u2705 Keeping essential workflows:")
    for workflow in KEEP_WORKFLOWS:
        if (workflows_dir / workflow).exists():
            print(f"  \u2713 {workflow}")

    # Create cost monitoring workflow
    cost_monitor = workflows_dir / "cost-monitor.yml"
    cost_monitor.write_text(get_cost_monitor_workflow())
    print(f"\u2705 Created {cost_monitor.name}")

    # Create release branch helper script
    release_script = project_root / "create-release-branch.sh"
    release_script.write_text(get_release_branch_script())
    release_script.chmod(0o755)
    print(f"\u2705 Created {release_script.name}")

    # Update README
    readme = project_root / "README.md"
    if readme.exists():
        readme_content = readme.read_text()
        if "GitHub Actions Cost Optimization" not in readme_content:
            addition = dedent("""

                ## 🚀 GitHub Actions Cost Optimization

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
            """)
            readme.write_text(readme_content + addition)
            print("\u2705 Updated README.md with cost optimization docs")

    print()
    print("\u2705 GitHub Actions optimization complete!")
    print()
    print("\U0001f4ca Cost Impact:")
    print("  Before: ~$100/month (full CI on every commit)")
    print("  After:  ~$20-30/month (70-80% reduction)")
    print()
    print("\U0001f680 How to use:")
    print("  Main branch: Automatic lightweight CI")
    print("  Full testing: ./create-release-branch.sh v1.x.x")
    print()
    print(f"\U0001f4c1 Disabled workflows moved to: {disabled_dir.relative_to(project_root)}/")
    print("\U0001f504 Active workflows: main-branch-ci.yml, release-branch-ci.yml")

    return 0


if __name__ == "__main__":
    sys.exit(main())
