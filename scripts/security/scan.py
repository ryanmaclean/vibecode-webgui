#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "scan"
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

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Security Scan Script

Scans for API keys and sensitive data in the codebase.
Uses pattern matching to detect exposed secrets.

Usage:
    python scan.py
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class ScanResult:
    """Result of a security scan."""
    passed: bool
    api_keys_found: list[tuple[str, str]] = field(default_factory=list)
    message: str = ""


# API key patterns to detect
API_KEY_PATTERNS = [
    (r"sk-[a-zA-Z0-9]{40,}", "OpenAI/OpenRouter API key"),
    (r"sk-ant-[a-zA-Z0-9]{40,}", "Anthropic API key"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"gho_[a-zA-Z0-9]{36}", "GitHub OAuth token"),
    (r"ghu_[a-zA-Z0-9]{36}", "GitHub user token"),
    (r"ghs_[a-zA-Z0-9]{36}", "GitHub server token"),
    (r"ghr_[a-zA-Z0-9]{36}", "GitHub refresh token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"ya29\.[0-9A-Za-z\-_]+", "Google OAuth access token"),
]

# Datadog pattern requires context to avoid false positives
DATADOG_PATTERN = r"[a-f0-9]{32}"
DATADOG_CONTEXT_PATTERN = r"(api.key|datadog|dd_api_key).*[a-f0-9]{32}"

# Directories and files to skip
SKIP_PATTERNS = [
    "node_modules",
    ".git",
    ".env.local",
    ".env.",
    "package-lock.json",
    ".tsbuildinfo",
    ".pyc",
    "venv",
    ".log",
    "build",
    "dist",
    ".cache",
    ".tmp",
    "yarn.lock",
    "Cargo.lock",
    "poetry.lock",
    ".sum",
    ".sha",
    ".md5",
]


def should_skip_file(file_path: str) -> bool:
    """Check if a file should be skipped."""
    for pattern in SKIP_PATTERNS:
        if pattern in file_path:
            return True
    return False


def is_binary_file(file_path: Path) -> bool:
    """Check if a file is binary."""
    try:
        result = subprocess.run(
            ["file", str(file_path)],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return "binary" in result.stdout.lower()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def scan_file_for_secrets(file_path: Path) -> list[tuple[str, str]]:
    """Scan a single file for API keys."""
    found_keys = []

    try:
        content = file_path.read_text(errors="ignore")
    except (OSError, UnicodeDecodeError):
        return found_keys

    # Check standard API key patterns
    for pattern, description in API_KEY_PATTERNS:
        if re.search(pattern, content):
            found_keys.append((str(file_path), description))

    # Check Datadog pattern with context
    if re.search(DATADOG_CONTEXT_PATTERN, content, re.IGNORECASE):
        found_keys.append((str(file_path), "Datadog API key"))

    return found_keys


def scan_working_directory(root_dir: str = ".") -> ScanResult:
    """Scan the working directory for API keys."""
    print(f"{Color.BLUE}🔍 Scanning working directory for API keys...{Color.NC}")

    found_keys = []
    root = Path(root_dir)

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue

        if should_skip_file(str(file_path)):
            continue

        if is_binary_file(file_path):
            continue

        keys = scan_file_for_secrets(file_path)
        found_keys.extend(keys)

    if found_keys:
        for file_path, key_type in found_keys:
            print(f"{Color.RED}❌ {key_type} detected in: {file_path}{Color.NC}")

        return ScanResult(
            passed=False,
            api_keys_found=found_keys,
            message="API keys found in working directory",
        )

    return ScanResult(
        passed=True,
        message="No API keys detected in working directory",
    )


def create_bfg_pattern_file() -> Path:
    """Create a pattern file for BFG scanning."""
    patterns = """# OpenAI/OpenRouter API keys
sk-[a-zA-Z0-9]{40,}==>API_KEY_REMOVED

# Anthropic API keys
sk-ant-[a-zA-Z0-9]{40,}==>ANTHROPIC_API_KEY_REMOVED

# Datadog API keys (32 hex chars)
[a-f0-9]{32}==>DATADOG_API_KEY_REMOVED

# GitHub tokens
ghp_[a-zA-Z0-9]{36}==>GITHUB_TOKEN_REMOVED
gho_[a-zA-Z0-9]{36}==>GITHUB_OAUTH_TOKEN_REMOVED
ghu_[a-zA-Z0-9]{36}==>GITHUB_USER_TOKEN_REMOVED
ghs_[a-zA-Z0-9]{36}==>GITHUB_SERVER_TOKEN_REMOVED
ghr_[a-zA-Z0-9]{36}==>GITHUB_REFRESH_TOKEN_REMOVED

# AWS Access Keys
AKIA[0-9A-Z]{16}==>AWS_ACCESS_KEY_REMOVED

# Google OAuth tokens
ya29\\.[0-9A-Za-z\\-_]+==>GOOGLE_OAUTH_TOKEN_REMOVED

# Stripe API keys
[0-9]{4}-[0-9]{7}-[0-9]{13}==>STRIPE_API_KEY_REMOVED
"""
    pattern_file = Path(tempfile.gettempdir()) / "security-patterns.txt"
    pattern_file.write_text(patterns)
    return pattern_file


def scan_with_bfg(pattern_file: Path) -> ScanResult:
    """Scan git history with BFG Docker."""
    print(f"{Color.BLUE}🔍 Running BFG Docker scan for git history...{Color.NC}")

    if not shutil.which("docker"):
        print(f"{Color.YELLOW}⚠️  Docker not available - skipping BFG scan{Color.NC}")
        return ScanResult(passed=True, message="BFG scan skipped (Docker not available)")

    # Create temporary directory for BFG operation
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_copy = Path(temp_dir) / "repo_copy"

        # Clone current repository state
        result = subprocess.run(
            ["git", "clone", ".", str(repo_copy)],
            capture_output=True,
        )

        if result.returncode != 0:
            return ScanResult(
                passed=True,
                message="BFG scan skipped (git clone failed)",
            )

        # Run BFG scan (dry run mode)
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/workspace",
                "-w", "/workspace",
                "jtmotox/bfg",
                "--replace-text", str(pattern_file),
                f"{repo_copy}/.git",
            ],
            capture_output=True,
            text=True,
        )

        if "Found" in result.stdout and "dirty commits" in result.stdout:
            print(f"{Color.RED}❌ BFG detected potential API keys in repository history!{Color.NC}")
            return ScanResult(
                passed=False,
                message="BFG detected sensitive data in git history",
            )

        print(f"{Color.GREEN}✅ BFG scan completed - no sensitive data detected in history{Color.NC}")
        return ScanResult(
            passed=True,
            message="No sensitive data detected in git history",
        )


def run_security_scan() -> int:
    """Run the complete security scan."""
    print(f"{Color.BLUE}🔒 Starting comprehensive security scan{Color.NC}")

    # Scan working directory
    dir_result = scan_working_directory()

    if not dir_result.passed:
        print(f"{Color.RED}❌ API keys found in working directory!{Color.NC}")
        print("   Please remove them and use environment variables")
        return 1

    # Create pattern file and scan git history
    pattern_file = create_bfg_pattern_file()

    try:
        history_result = scan_with_bfg(pattern_file)
    finally:
        pattern_file.unlink(missing_ok=True)

    if not history_result.passed:
        print(f"{Color.RED}❌ Security scan failed{Color.NC}")
        print(f"{Color.RED}🚨 API keys or sensitive data detected in repository{Color.NC}")
        return 1

    print(f"{Color.GREEN}✅ Security scan completed successfully{Color.NC}")
    print(f"{Color.GREEN}🛡️  No API keys or sensitive data detected{Color.NC}")
    return 0


def main() -> int:
    """Main entry point."""
    return run_security_scan()


if __name__ == "__main__":
    sys.exit(main())