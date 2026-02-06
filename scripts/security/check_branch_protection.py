from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "check-branch-protection"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation



"""Validate GitHub branch protection rules via the gh CLI."""

# Initialize log aggregation
log_agg = get_log_aggregation()

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

BLUE = "\033[0;34m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"

MAX_SCORE = 10
MIN_SCORE = 7
EXPECTED_CHECKS = ["validate-ci-config", "quick-validation", "security-check", "build-check"]


@dataclass
class BranchProtectionResult:
    score: int
    logs: List[Tuple[str, str]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    max_score: int = MAX_SCORE

    @property
    def percentage(self) -> int:
        if self.max_score == 0:
            return 0
        return round((self.score / self.max_score) * 100)

    @property
    def security_level(self) -> str:
        if self.score >= 9:
            return f"{GREEN}STRONG{NC}"
        if self.score >= 7:
            return f"{YELLOW}MODERATE{NC}"
        return f"{RED}WEAK{NC}"


class BranchProtectionError(RuntimeError):
    """Raised when protection rules are missing or invalid."""


class DependencyError(RuntimeError):
    """Raised when required tools are unavailable."""


def log(level: str, message: str) -> None:
    color = {
        "info": BLUE,
        "success": GREEN,
        "warning": YELLOW,
        "error": RED,
    }.get(level, NC)
    prefix = {
        "info": "ℹ️ ",
        "success": "✅",
        "warning": "⚠️",
        "error": "❌",
    }.get(level, "➤")
    print(f"{color}{prefix} {message}{NC}")


def ensure_gh() -> None:
    if shutil.which("gh") is None:
        raise DependencyError("GitHub CLI (gh) not found. Install: https://cli.github.com/")
    subprocess.run(["gh", "auth", "status"], check=True, capture_output=True)


def fetch_branch_protection(owner: str, repo: str, branch: str) -> Dict[str, Any]:
    command = ["gh", "api", f"repos/{owner}/{repo}/branches/{branch}/protection"]
    try:
        completed = subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        raise BranchProtectionError(
            f"Branch protection not enabled for {branch}. "
            "See docs/security/BRANCH_PROTECTION.md"
        ) from exc
    return json.loads(completed.stdout)


def evaluate_branch_protection(data: Dict[str, Any]) -> BranchProtectionResult:
    score = 0
    logs: List[Tuple[str, str]] = []
    warnings: List[str] = []
    errors: List[str] = []

    def add(level: str, message: str) -> None:
        logs.append((level, message))
        if level == "warning":
            warnings.append(message)
        elif level == "error":
            errors.append(message)

    def award(points: int = 1) -> None:
        nonlocal score
        score += points

    # Pull request reviews
    reviews = data.get("required_pull_request_reviews") or {}
    approvals = reviews.get("required_approving_review_count") or 0
    add("info", "Validating pull request review requirements...")
    if approvals >= 1:
        add("success", f"Pull request reviews required ({approvals} approval(s))")
        award()
        if reviews.get("dismiss_stale_reviews"):
            add("success", "Stale review dismissal enabled")
            award()
        else:
            add("warning", "Stale review dismissal not enabled (outdated approvals allowed)")
        if reviews.get("require_code_owner_reviews"):
            add("info", "Code owner reviews required")
    else:
        add("error", "Pull request reviews not required (merges allowed without review)")

    # Status checks
    add("info", "Validating required status checks...")
    status_checks = data.get("required_status_checks") or {}
    if status_checks:
        add("success", "Status checks required")
        award()
        if status_checks.get("strict"):
            add("success", "Strict status check mode enabled")
            award()
        else:
            add("warning", "Strict mode disabled (PRs can merge without being up-to-date)")
        contexts = status_checks.get("contexts") or []
        if contexts:
            add("success", f"Required status checks configured: {len(contexts)}")
            add("info", "Status checks:")
            for check in contexts:
                add("info", f"    - {check}")
            missing = [expected for expected in EXPECTED_CHECKS if expected not in contexts]
            if missing:
                add("warning", f"Missing recommended status checks: {' '.join(missing)}")
        else:
            add("warning", "No status checks configured (CI/CD will not block merges)")
    else:
        add("error", "Status checks not required (untested code can merge)")

    allow_force = bool((data.get("allow_force_pushes") or {}).get("enabled"))
    add("info", "Validating force push protection...")
    if not allow_force:
        add("success", "Force pushes disabled")
        award()
    else:
        add("error", "Force pushes allowed (history can be rewritten)")

    allow_deletions = bool((data.get("allow_deletions") or {}).get("enabled"))
    add("info", "Validating branch deletion protection...")
    if not allow_deletions:
        add("success", "Branch deletions disabled")
        award()
    else:
        add("error", "Branch deletions allowed (branch can be deleted)")

    signatures_required = bool((data.get("required_signatures") or {}).get("enabled"))
    add("info", "Validating signed commit requirement...")
    if signatures_required:
        add("success", "Signed commits required")
        award()
    else:
        add("warning", "Signed commits not required (commit authentication not enforced)")

    admin_enforced = bool((data.get("enforce_admins") or {}).get("enabled"))
    add("info", "Validating admin enforcement...")
    if admin_enforced:
        add("success", "Admin enforcement enabled (rules apply to admins)")
        award()
    else:
        add("warning", "Admin enforcement disabled (admins can bypass rules)")

    linear_history = bool((data.get("required_linear_history") or {}).get("enabled"))
    add("info", "Validating linear history requirement...")
    if linear_history:
        add("info", "Linear history required (merge commits prevented)")
    else:
        add("info", "Linear history not required (merge commits allowed)")

    conversation_resolution = bool((data.get("required_conversation_resolution") or {}).get("enabled"))
    add("info", "Validating conversation resolution requirement...")
    if conversation_resolution:
        add("info", "Conversation resolution required")
    else:
        add("info", "Conversation resolution not required")

    return BranchProtectionResult(score=score, logs=logs, warnings=warnings, errors=errors)


def render_summary(owner: str, repo: str, branch: str, result: BranchProtectionResult) -> None:
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Branch Protection Summary")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"Repository: {owner}/{repo}")
    print(f"Branch: {branch}")
    print(f"Branch Protection Score: {result.score}/{result.max_score} ({result.percentage}%) - {result.security_level}")
    if result.warnings:
        print(f"\n{YELLOW}Warnings ({len(result.warnings)}):{NC}")
        for warning in result.warnings:
            print(f"  - {warning}")
    if result.errors:
        print(f"\n{RED}Errors ({len(result.errors)}):{NC}")
        for error in result.errors:
            print(f"  - {error}")
    print("\nRecommendations:")
    if result.score < MIN_SCORE:
        print("  - Branch protection is insufficient for production use")
        print("  - Review docs/security/BRANCH_PROTECTION.md for configuration guidance")
        print("  - Enable at minimum: PR reviews, status checks, force push protection")
    if any("Signed commits" in warning for warning in result.warnings):
        print("  - Consider enabling signed commits to authenticate contributors")
    if any("Strict mode" in warning for warning in result.warnings):
        print("  - Enable strict status check mode to prevent race conditions")
    if not result.warnings and not result.errors:
        print("  - Branch protection is optimally configured")
    print("\nDocumentation: docs/security/BRANCH_PROTECTION.md")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate GitHub branch protection settings")
    parser.add_argument("branch", nargs="?", default=os.getenv("BRANCH", "main"), help="Branch to inspect")
    parser.add_argument("--owner", default=os.getenv("GITHUB_OWNER", "ryanmaclean"), help="GitHub owner/org")
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPO", "vibecode-webgui"), help="Repository name")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    try:
        ensure_gh()
        data = fetch_branch_protection(args.owner, args.repo, args.branch)
        result = evaluate_branch_protection(data)
    except DependencyError as exc:
        log("error", str(exc))
        return 2
    except BranchProtectionError as exc:
        log("error", str(exc))
        return 1
    except subprocess.CalledProcessError as exc:
        log("error", exc.stderr.strip() if exc.stderr else str(exc))
        return 1

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Branch Protection Validation Script")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    for level, message in result.logs:
        log(level, message)
    render_summary(args.owner, args.repo, args.branch, result)
    return 0 if result.score >= MIN_SCORE else 1


if __name__ == "__main__":
    sys.exit(main())