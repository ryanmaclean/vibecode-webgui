#!/usr/bin/env python3
"""
Security Testing Script

Comprehensive security testing for local development.

Usage:
    python test.py
"""

import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
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
class TestResult:
    """Result of a security test."""
    name: str
    passed: bool
    message: str
    details: Optional[str] = None


def print_status(status: str, message: str) -> None:
    """Print colored status message."""
    colors = {
        "success": Color.GREEN,
        "warning": Color.YELLOW,
        "error": Color.RED,
        "info": Color.BLUE,
    }
    icons = {
        "success": "✅",
        "warning": "⚠️ ",
        "error": "❌",
        "info": "ℹ️ ",
    }
    color = colors.get(status, Color.NC)
    icon = icons.get(status, "")
    print(f"{color}{icon} {message}{Color.NC}")


def check_dependencies() -> TestResult:
    """Check if required tools are installed."""
    print("📋 Checking dependencies...")

    if not shutil.which("npm"):
        print_status("error", "npm is required but not installed")
        return TestResult("dependencies", False, "npm not found")

    if not shutil.which("jq"):
        print_status("warning", "jq is recommended for JSON parsing (brew install jq)")

    print_status("success", "Dependencies check complete")
    return TestResult("dependencies", True, "All required dependencies found")


def run_vulnerability_scan() -> TestResult:
    """Run npm audit for vulnerability scanning."""
    print(f"\n{Color.BLUE}🔍 Running vulnerability scan...{Color.NC}")
    print("Checking for package vulnerabilities...")

    if not shutil.which("npm") or not Path("package.json").exists():
        return TestResult("vulnerability_scan", True, "Skipped - npm not available")

    result = subprocess.run(
        ["npm", "audit", "--audit-level=low"],
        capture_output=True,
    )

    if result.returncode == 0:
        print_status("success", "No vulnerabilities found")
        return TestResult("vulnerability_scan", True, "No vulnerabilities found")

    print_status("warning", "Vulnerabilities detected - running detailed audit:")
    subprocess.run(["npm", "audit", "--audit-level=low"])
    print("\nTo fix vulnerabilities, run: npm audit fix")
    print("For breaking changes: npm audit fix --force")

    return TestResult("vulnerability_scan", False, "Vulnerabilities detected")


def scan_secrets() -> TestResult:
    """Scan for hardcoded secrets and API keys."""
    print(f"\n{Color.BLUE}🔐 Scanning for hardcoded secrets...{Color.NC}")

    secret_patterns = [
        (r"sk-[a-zA-Z0-9]{40,}", "OpenAI/OpenRouter"),
        (r"sk-ant-[a-zA-Z0-9]{40,}", "Anthropic"),
        (r"ghp_[a-zA-Z0-9]{36}", "GitHub"),
        (r"AKIA[0-9A-Z]{16}", "AWS"),
        (r"sk_test_[a-zA-Z0-9]{24}", "Stripe test"),
        (r"sk_live_[a-zA-Z0-9]{24}", "Stripe live"),
    ]

    secrets_found = False
    src_dir = Path("src")

    if src_dir.exists():
        for file_path in src_dir.rglob("*"):
            if not file_path.is_file():
                continue

            if "node_modules" in str(file_path):
                continue

            try:
                content = file_path.read_text(errors="ignore")

                for pattern, name in secret_patterns:
                    if re.search(pattern, content):
                        print(f"  Found {name} pattern in: {file_path}")
                        secrets_found = True

                # Generic credential patterns
                if re.search(
                    r"(password\s*=\s*['\"][^'\"]+['\"]|api[_-]?key\s*=\s*['\"][^'\"]+['\"])",
                    content,
                    re.IGNORECASE,
                ):
                    print(f"  Found generic credential in: {file_path}")
                    secrets_found = True

            except (OSError, UnicodeDecodeError):
                continue

    if secrets_found:
        print_status("error", "Potential secrets found - review above output")
        print("Consider using environment variables instead of hardcoded values")
        return TestResult("secrets_scan", False, "Potential secrets detected")

    print_status("success", "No hardcoded secrets detected")
    return TestResult("secrets_scan", True, "No secrets found")


def check_security_config() -> TestResult:
    """Check security configurations."""
    print(f"\n{Color.BLUE}⚙️ Checking security configurations...{Color.NC}")

    issues = []
    src_dir = Path("src")

    if not src_dir.exists():
        return TestResult("security_config", True, "No src directory found")

    def search_in_src(pattern: str) -> bool:
        for file_path in src_dir.rglob("*"):
            if not file_path.is_file():
                continue
            if not file_path.suffix in (".ts", ".js", ".tsx", ".jsx"):
                continue
            try:
                if re.search(pattern, file_path.read_text(errors="ignore")):
                    return True
            except (OSError, UnicodeDecodeError):
                continue
        return False

    # Check rate limiting
    if search_in_src(r"rateLimit|@upstash/ratelimit"):
        print_status("success", "Rate limiting configured")
    else:
        print_status("warning", "Rate limiting not found - consider implementing")
        issues.append("rate limiting")

    # Check authentication
    if search_in_src(r"NextAuth|next-auth"):
        print_status("success", "Authentication configured")
    else:
        print_status("warning", "Authentication not found")
        issues.append("authentication")

    # Check input validation
    if search_in_src(r"zod|joi|validator"):
        print_status("success", "Input validation libraries found")
    else:
        print_status("warning", "Input validation libraries not found")
        issues.append("input validation")

    # Check CORS configuration
    if search_in_src(r"cors"):
        print_status("success", "CORS configuration found")
    else:
        print_status("warning", "CORS configuration not found")
        issues.append("CORS")

    if issues:
        return TestResult("security_config", False, f"Missing: {', '.join(issues)}")

    return TestResult("security_config", True, "All security configurations found")


def run_eslint_security() -> TestResult:
    """Run ESLint security analysis."""
    print(f"\n{Color.BLUE}📝 Running ESLint security analysis...{Color.NC}")

    if not shutil.which("npx"):
        return TestResult("eslint", True, "Skipped - npx not available")

    if not Path("src").exists():
        return TestResult("eslint", True, "Skipped - no src directory")

    result = subprocess.run(
        ["npx", "eslint", "src/", "--ext", ".ts,.tsx,.js,.jsx", "--quiet"],
        capture_output=True,
    )

    if result.returncode == 0:
        print_status("success", "No ESLint security issues found")
        return TestResult("eslint", True, "No issues found")

    print_status("warning", "ESLint found issues")
    return TestResult("eslint", False, "ESLint issues found")


def check_security_headers() -> TestResult:
    """Check for security headers in Next.js config."""
    print(f"\n{Color.BLUE}🛡️ Checking security headers configuration...{Color.NC}")

    config_files = ["next.config.js", "next.config.mjs"]

    for config_file in config_files:
        config_path = Path(config_file)
        if config_path.exists():
            content = config_path.read_text()

            if re.search(r"(helmet|securityHeaders|contentSecurityPolicy)", content):
                print_status("success", "Security headers configuration found")
                return TestResult("security_headers", True, "Security headers configured")

    print_status("warning", "Consider adding security headers to Next.js config")
    print("Example:")
    print("  headers: [")
    print("    { key: 'X-Frame-Options', value: 'DENY' },")
    print("    { key: 'X-Content-Type-Options', value: 'nosniff' }")
    print("  ]")

    return TestResult("security_headers", False, "Security headers not configured")


def check_env_security() -> TestResult:
    """Check environment variable security."""
    print(f"\n{Color.BLUE}🌐 Checking environment variable security...{Color.NC}")

    issues = []
    env_files = [".env", ".env.local", ".env.example"]

    for env_file in env_files:
        env_path = Path(env_file)
        if not env_path.exists():
            continue

        print(f"Checking {env_file}...")
        content = env_path.read_text()

        # Check for development settings
        if re.search(r"(DEBUG=true|NODE_ENV=development)", content):
            print_status("warning", f"Development settings found in {env_file}")
            issues.append(f"dev settings in {env_file}")

        # Check for missing security variables
        if not re.search(r"(NEXTAUTH_SECRET|NEXTAUTH_URL)", content):
            print_status("warning", f"Missing authentication secrets in {env_file}")
            issues.append(f"missing auth secrets in {env_file}")

    if issues:
        return TestResult("env_security", False, f"Issues: {', '.join(issues)}")

    return TestResult("env_security", True, "Environment configuration looks secure")


def generate_report(results: list[TestResult]) -> None:
    """Generate security report."""
    print(f"\n{Color.BLUE}📊 Security Testing Summary{Color.NC}")
    print("=" * 30)
    print(f"Date: {datetime.now()}")
    print("Repository: VibeCode WebGUI")
    print()

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    for result in results:
        status = "✅" if result.passed else "❌"
        print(f"{status} {result.name}: {result.message}")

    print(f"\nPassed: {passed}/{len(results)}")
    print(f"Failed: {failed}/{len(results)}")

    print(f"\n{Color.BLUE}💡 Recommendations:{Color.NC}")
    print("• Regularly update dependencies with 'npm audit fix'")
    print("• Use environment variables for all secrets")
    print("• Implement security headers in production")
    print("• Enable rate limiting on API endpoints")
    print("• Use HTTPS in production environments")
    print("• Regularly review and rotate API keys")

    print(f"\n{Color.BLUE}🔧 Quick Fixes:{Color.NC}")
    print("• Fix vulnerabilities: npm audit fix")
    print("• Add security headers: Update next.config.js")
    print("• Secure environment: Review .env files")


def run_security_tests() -> int:
    """Run all security tests."""
    print(f"{Color.BLUE}🔒 VibeCode Security Testing Suite{Color.NC}")
    print("=" * 40)

    results = []

    results.append(check_dependencies())
    results.append(run_vulnerability_scan())
    results.append(scan_secrets())
    results.append(check_security_config())
    results.append(run_eslint_security())
    results.append(check_security_headers())
    results.append(check_env_security())

    generate_report(results)

    print(f"\n{Color.GREEN}✅ Security testing complete!{Color.NC}")
    print("Run this script regularly to maintain security posture")

    failed = sum(1 for r in results if not r.passed)
    return 0 if failed == 0 else 1


def main() -> int:
    """Main entry point."""
    return run_security_tests()


if __name__ == "__main__":
    sys.exit(main())
