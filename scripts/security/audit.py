#!/usr/bin/env python3

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

"""
Security Audit Script

Scans the codebase for potential security vulnerabilities.

Usage:
    python audit.py
"""

import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class AuditResult:
    """Result of a security audit."""
    issues_found: int = 0
    warnings_found: int = 0


def print_status(status: str, message: str) -> None:
    """Print colored status message."""
    colors = {
        "success": Color.GREEN,
        "warning": Color.YELLOW,
        "error": Color.RED,
        "info": Color.BLUE,
    }
    color = colors.get(status, Color.NC)
    icons = {
        "success": "✅",
        "warning": "⚠️ ",
        "error": "❌",
        "info": "ℹ️ ",
    }
    icon = icons.get(status, "")
    print(f"{color}{icon} {message}{Color.NC}")


def check_exposed_secrets() -> tuple[int, int]:
    """Check for potentially exposed API keys and secrets."""
    print(f"\n{Color.BLUE}🔑 Scanning for exposed secrets...{Color.NC}")
    print("Checking for exposed secrets in source files...")

    issues = 0
    warnings = 0

    # Pattern for potential secrets
    secret_pattern = re.compile(
        r'(api[_-]?key|secret|token|password)\s*[:=]\s*["\'][a-zA-Z0-9_-]{20,}["\']',
        re.IGNORECASE,
    )

    # Exclusion patterns
    exclusions = [
        "REPLACE_WITH_",
        "your_.*_here",
        "placeholder",
        ".example",
        "ExistingSecret",
        "secretKeyRef",
    ]

    for root, dirs, files in os.walk("."):
        # Skip certain directories
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "venv", "build", "dist")]

        for file in files:
            if file.endswith(".md"):
                continue

            file_path = Path(root) / file

            try:
                content = file_path.read_text(errors="ignore")
            except (OSError, UnicodeDecodeError):
                continue

            for match in secret_pattern.finditer(content):
                matched_text = match.group()

                # Check if it's an excluded pattern
                if any(exc.lower() in matched_text.lower() for exc in exclusions):
                    continue

                print(f"  Found in: {file_path}")
                issues += 1

    if issues > 0:
        print_status("error", f"Found potential exposed secrets in {issues} location(s)")
    else:
        print_status("success", "No exposed secrets found in source files")

    return issues, warnings


def check_hardcoded_credentials() -> tuple[int, int]:
    """Check for hardcoded credentials in config files."""
    print("\nChecking for hardcoded credentials in configuration files...")

    issues = 0
    warnings = 0

    config_extensions = (".yaml", ".yml", ".json", ".env")

    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "venv")]

        for file in files:
            if not any(file.endswith(ext) for ext in config_extensions):
                continue

            file_path = Path(root) / file

            try:
                content = file_path.read_text(errors="ignore")
            except (OSError, UnicodeDecodeError):
                continue

            # Skip template files
            if "REPLACE_WITH_" in content:
                continue

            # Check for credential patterns
            cred_pattern = re.compile(
                r'(password|secret|token|key).*[:=].*["\'][^"\'REPLACE_WITH_]{10,}["\']',
                re.IGNORECASE,
            )

            if cred_pattern.search(content):
                if "template" not in file.lower() and "example" not in file.lower():
                    print_status("warning", f"Potential hardcoded credential in: {file_path}")
                    warnings += 1

    if warnings == 0:
        print_status("success", "No hardcoded credentials found")

    return issues, warnings


def check_file_permissions() -> tuple[int, int]:
    """Check for overly permissive files."""
    print(f"\n{Color.BLUE}🔒 Checking file permissions...{Color.NC}")

    issues = 0
    warnings = 0

    sensitive_extensions = (".sh", ".key", ".pem")

    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "venv")]

        for file in files:
            if not any(file.endswith(ext) for ext in sensitive_extensions):
                continue

            file_path = Path(root) / file

            try:
                mode = file_path.stat().st_mode
                # Check if world-readable/writable
                if mode & 0o007:
                    print_status("warning", f"Overly permissive file: {file_path}")
                    warnings += 1
            except OSError:
                continue

    if warnings == 0:
        print_status("success", "File permissions look secure")

    return issues, warnings


def check_dependency_security() -> tuple[int, int]:
    """Check dependency security with npm audit."""
    print(f"\n{Color.BLUE}📦 Checking dependency security...{Color.NC}")

    issues = 0
    warnings = 0

    if not shutil.which("npm") or not Path("package.json").exists():
        print_status("info", "Skipping npm audit (npm not available or no package.json)")
        return issues, warnings

    print("Running npm audit...")

    result = subprocess.run(
        ["npm", "audit", "--audit-level=moderate"],
        capture_output=True,
    )

    if result.returncode == 0:
        print_status("success", "No critical npm vulnerabilities found")
    else:
        print_status("warning", "npm audit found vulnerabilities - run 'npm audit' for details")
        warnings += 1

    return issues, warnings


def check_gitignore_coverage() -> tuple[int, int]:
    """Check if critical files are properly ignored."""
    print(f"\n{Color.BLUE}🔧 Checking .gitignore coverage...{Color.NC}")

    issues = 0
    warnings = 0

    critical_patterns = [".env", ".env.local", "*.key", "*.pem", "secrets/", ".datadog/"]

    gitignore_path = Path(".gitignore")
    if not gitignore_path.exists():
        print_status("warning", ".gitignore file not found")
        return 0, 1

    gitignore_content = gitignore_path.read_text()

    for pattern in critical_patterns:
        if pattern not in gitignore_content:
            print_status("warning", f"Missing .gitignore pattern: {pattern}")
            warnings += 1

    if warnings == 0:
        print_status("success", ".gitignore properly configured")

    return issues, warnings


def check_kubernetes_secrets() -> tuple[int, int]:
    """Check if Kubernetes secrets are properly templated."""
    print(f"\n{Color.BLUE}🔍 Checking for Kubernetes secrets management...{Color.NC}")

    issues = 0
    warnings = 0

    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "venv")]

        for file in files:
            if not file.endswith((".yaml", ".yml")):
                continue

            file_path = Path(root) / file

            try:
                content = file_path.read_text(errors="ignore")
            except (OSError, UnicodeDecodeError):
                continue

            if "kind: Secret" not in content:
                continue

            if "REPLACE_WITH_" in content:
                continue

            if "data:" in content:
                # Check for hardcoded base64 data
                data_section = content.split("data:")[1].split("---")[0] if "data:" in content else ""
                if re.search(r"^\s*[^#].*:\s*[a-zA-Z0-9+/=]{20,}\s*$", data_section, re.MULTILINE):
                    print_status("error", f"Kubernetes secret with hardcoded data in: {file_path}")
                    issues += 1

    if issues == 0:
        print_status("success", "Kubernetes secrets properly templated")

    return issues, warnings


def run_security_audit() -> int:
    """Run the complete security audit."""
    print(f"{Color.BLUE}🔍 VibeCode Security Audit{Color.NC}")
    print("=" * 30)

    total_issues = 0
    total_warnings = 0

    # Run all checks
    checks = [
        check_exposed_secrets,
        check_hardcoded_credentials,
        check_file_permissions,
        check_dependency_security,
        check_gitignore_coverage,
        check_kubernetes_secrets,
    ]

    for check in checks:
        issues, warnings = check()
        total_issues += issues
        total_warnings += warnings

    # Print summary
    print(f"\n{Color.BLUE}📋 Security Audit Summary{Color.NC}")
    print("=" * 30)

    if total_issues == 0 and total_warnings == 0:
        print_status("success", "🎉 No security issues found!")
        return 0
    elif total_issues == 0:
        print_status("warning", f"{total_warnings} warning(s) found - review recommended")
        return 1
    else:
        print_status("error", f"{total_issues} critical issue(s) and {total_warnings} warning(s) found")
        print(f"\n{Color.BLUE}Recommended actions:{Color.NC}")
        print("1. Replace any hardcoded secrets with environment variables")
        print("2. Use Kubernetes secrets or external secret management")
        print("3. Run the security setup script: ./scripts/security-setup.sh")
        print("4. Review and fix any dependency vulnerabilities: npm audit fix")
        return 2


def main() -> int:
    """Main entry point."""
    return run_security_audit()


if __name__ == "__main__":
    sys.exit(main())