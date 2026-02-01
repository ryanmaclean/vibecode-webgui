#!/usr/bin/env python3
"""Configure GitHub branch protection profiles via the gh CLI."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import shutil
import subprocess
import sys
from typing import Dict, Literal

BLUE = "\033[0;34m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"

ProfileName = Literal["minimal", "recommended", "high-security"]

PROFILES: Dict[ProfileName, Dict[str, object]] = {
    "minimal": {
        "required_status_checks": {
            "strict": True,
            "contexts": [
                "validate-ci-config",
                "quick-validation",
                "security-check",
                "build-check",
            ],
        },
        "enforce_admins": True,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "required_approving_review_count": 1,
        },
        "restrictions": None,
        "allow_force_pushes": False,
        "allow_deletions": False,
        "required_signatures": False,
    },
    "recommended": {
        "required_status_checks": {
            "strict": True,
            "contexts": [
                "validate-ci-config",
                "quick-validation",
                "security-check",
                "build-check",
                "code-quality",
                "root-tests",
                "build-test",
            ],
        },
        "enforce_admins": True,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "required_approving_review_count": 1,
        },
        "restrictions": None,
        "allow_force_pushes": False,
        "allow_deletions": False,
        "required_signatures": True,
    },
    "high-security": {
        "required_status_checks": {
            "strict": True,
            "contexts": [
                "validate-ci-config",
                "quick-validation",
                "security-check",
                "build-check",
                "code-quality",
                "root-tests",
                "build-test",
            ],
        },
        "enforce_admins": True,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "require_code_owner_reviews": True,
            "required_approving_review_count": 2,
            "require_last_push_approval": True,
        },
        "restrictions": None,
        "allow_force_pushes": False,
        "allow_deletions": False,
        "required_signatures": True,
        "required_linear_history": True,
        "required_conversation_resolution": True,
    },
}


class DependencyError(RuntimeError):
    pass


def log_info(message: str) -> None:
    print(f"{BLUE}ℹ️  {message}{NC}")


def log_success(message: str) -> None:
    print(f"{GREEN}✅ {message}{NC}")


def log_warning(message: str) -> None:
    print(f"{YELLOW}⚠️  {message}{NC}")


def log_error(message: str) -> None:
    print(f"{RED}❌ {message}{NC}")


def ensure_gh() -> None:
    if shutil.which("gh") is None:
        raise DependencyError("GitHub CLI (gh) not found. Install from https://cli.github.com/")
    subprocess.run(["gh", "auth", "status"], check=True, capture_output=True)


def ensure_admin_access(owner: str, repo: str) -> None:
    command = [
        "gh",
        "api",
        f"repos/{owner}/{repo}",
        "--jq",
        ".permissions.admin // false",
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    if completed.stdout.strip() != "true":
        raise PermissionError("Repository admin access required to modify branch protection")


def apply_profile(owner: str, repo: str, branch: str, profile: ProfileName) -> None:
    payload = json.dumps(PROFILES[profile], indent=2)
    command = [
        "gh",
        "api",
        f"repos/{owner}/{repo}/branches/{branch}/protection",
        "--method",
        "PUT",
        "-H",
        "Accept: application/vnd.github+json",
        "--input",
        "-",
    ]
    subprocess.run(command, input=payload.encode(), check=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enable GitHub branch protection using predefined profiles")
    parser.add_argument("branch", nargs="?", default="main", help="Branch to configure")
    parser.add_argument(
        "--owner",
        default=os.getenv("GITHUB_OWNER", "ryanmaclean"),
        help="GitHub organization or user",
    )
    parser.add_argument(
        "--repo",
        default=os.getenv("GITHUB_REPO", "vibecode-webgui"),
        help="Repository name",
    )
    parser.add_argument(
        "--profile",
        choices=list(PROFILES.keys()),
        default=os.getenv("BRANCH_PROTECTION_PROFILE", "recommended"),
        help="Desired security profile",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    log_info("Branch Protection Enablement")
    log_info(f"Repository: {args.owner}/{args.repo}")
    log_info(f"Branch: {args.branch}")
    log_info(f"Profile: {args.profile}")
    try:
        ensure_gh()
        ensure_admin_access(args.owner, args.repo)
        apply_profile(args.owner, args.repo, args.branch, args.profile)
    except DependencyError as exc:
        log_error(str(exc))
        return 2
    except PermissionError as exc:
        log_error(str(exc))
        return 2
    except subprocess.CalledProcessError as exc:
        log_error(exc.stderr.strip() if exc.stderr else str(exc))
        return 1

    if args.profile in {"recommended", "high-security"}:
        log_warning("Signed commits enabled. Ensure contributors have configured GPG keys.")
        print("See: https://docs.github.com/en/authentication/managing-commit-signature-verification")
    if args.profile == "high-security":
        log_warning("High security profile requires:")
        print("  - CODEOWNERS file in repository root")
        print("  - Team members configured with GPG keys")
        print("  - Comfort with rebase workflows (linear history)")

    log_success("Branch protection configuration complete")
    print("\nVerify configuration:")
    print(f"  python scripts/security/check_branch_protection.py {args.branch} --owner {args.owner} --repo {args.repo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
