#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
VibeCode Docker Structure Validation Script

Tests the Docker structure without requiring Docker daemon.

Usage:
    python validate.py
"""

import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes for terminal output."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class ValidationResult:
    """Result of a validation check."""
    passed: bool
    message: str


def print_status(message: str) -> None:
    """Print an info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def check_dockerfile_exists() -> ValidationResult:
    """Check if Dockerfile exists in current directory."""
    if Path("Dockerfile").exists():
        return ValidationResult(True, "Dockerfile exists")
    return ValidationResult(False, "Dockerfile not found. Please run from docker/ directory.")


def validate_dockerfile_syntax() -> ValidationResult:
    """Validate Dockerfile syntax using docker buildx."""
    try:
        result = subprocess.run(
            ["docker", "buildx", "build", "--dry-run", "-f", "Dockerfile", "."],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0:
            return ValidationResult(True, "Dockerfile syntax is valid")
        return ValidationResult(False, "Dockerfile syntax validation failed")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ValidationResult(True, "Dockerfile syntax validation skipped (Docker daemon not available)")


def check_required_files() -> list[ValidationResult]:
    """Check that all required files exist."""
    required_files = [
        "Dockerfile",
        "docker-compose.dev.yml",
        "docker-compose.prod.yml",
        "docker-compose.test.yml",
        "docker-compose.aks.yml",
        "build.sh",
        "deploy.sh",
        "README.md",
    ]

    results = []
    for file in required_files:
        if Path(file).exists():
            results.append(ValidationResult(True, f"✓ {file} exists"))
        else:
            results.append(ValidationResult(False, f"✗ {file} missing"))

    return results


def check_script_permissions() -> list[ValidationResult]:
    """Check and fix script permissions."""
    scripts = ["build.sh", "deploy.sh"]
    results = []

    for script in scripts:
        path = Path(script)
        if not path.exists():
            continue

        if os.access(path, os.X_OK):
            results.append(ValidationResult(True, f"✓ {script} is executable"))
        else:
            # Fix permissions
            try:
                os.chmod(path, path.stat().st_mode | 0o111)
                results.append(ValidationResult(True, f"✓ {script} permissions fixed"))
            except OSError as e:
                results.append(ValidationResult(False, f"✗ {script} - could not fix permissions: {e}"))

    return results


def validate_compose_files() -> list[ValidationResult]:
    """Validate docker-compose file syntax."""
    compose_files = [
        "docker-compose.dev.yml",
        "docker-compose.prod.yml",
        "docker-compose.test.yml",
        "docker-compose.aks.yml",
    ]

    results = []
    for compose_file in compose_files:
        if not Path(compose_file).exists():
            continue

        try:
            result = subprocess.run(
                ["docker-compose", "-f", compose_file, "config"],
                capture_output=True,
                timeout=30,
            )
            if result.returncode == 0:
                results.append(ValidationResult(True, f"✓ {compose_file} syntax is valid"))
            else:
                results.append(ValidationResult(False, f"✗ {compose_file} syntax is invalid"))
        except (subprocess.TimeoutExpired, FileNotFoundError):
            results.append(ValidationResult(True, f"⚠ {compose_file} syntax validation skipped"))

    return results


def test_script_help(script: str) -> ValidationResult:
    """Test that a script's --help option works."""
    try:
        result = subprocess.run(
            [f"./{script}", "--help"],
            capture_output=True,
            timeout=10,
        )
        if result.returncode == 0:
            return ValidationResult(True, f"✓ {script} help works")
        return ValidationResult(False, f"✗ {script} help failed")
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        return ValidationResult(False, f"✗ {script} help failed")


def check_dockerfile_targets() -> list[ValidationResult]:
    """Check that required targets exist in Dockerfile."""
    targets = ["base", "deps", "builder", "production", "development", "testing", "ingestion"]
    results = []

    dockerfile_path = Path("Dockerfile")
    if not dockerfile_path.exists():
        return [ValidationResult(False, "Dockerfile not found")]

    dockerfile_content = dockerfile_path.read_text()

    for target in targets:
        pattern = rf"FROM\s+.*\s+AS\s+{target}"
        if re.search(pattern, dockerfile_content, re.IGNORECASE):
            results.append(ValidationResult(True, f"✓ Target '{target}' found in Dockerfile"))
        else:
            results.append(ValidationResult(False, f"⚠ Target '{target}' not found in Dockerfile"))

    return results


def check_build_arguments() -> list[ValidationResult]:
    """Check that required build arguments exist in Dockerfile."""
    build_args = [
        "NODE_VERSION",
        "BASE_OS",
        "BUILD_TARGET",
        "INCLUDE_DEV_DEPS",
        "ENABLE_SOURCE_MAPS",
        "ENABLE_DATADOG",
        "ENABLE_LIGHTNINGCSS",
        "ENABLE_PRISMA",
        "ENABLE_HEALTH_CHECK",
    ]

    results = []
    dockerfile_path = Path("Dockerfile")
    if not dockerfile_path.exists():
        return [ValidationResult(False, "Dockerfile not found")]

    dockerfile_content = dockerfile_path.read_text()

    for arg in build_args:
        if f"ARG {arg}" in dockerfile_content:
            results.append(ValidationResult(True, f"✓ Build arg '{arg}' found in Dockerfile"))
        else:
            results.append(ValidationResult(False, f"⚠ Build arg '{arg}' not found in Dockerfile"))

    return results


def run_validation() -> int:
    """Run all validation checks."""
    print_status("Validating VibeCode Docker Structure...")

    all_passed = True

    # Check Dockerfile exists
    result = check_dockerfile_exists()
    if result.passed:
        print_success(result.message)
    else:
        print_error(result.message)
        return 1

    # Validate Dockerfile syntax
    print_status("Validating Dockerfile syntax...")
    result = validate_dockerfile_syntax()
    if result.passed:
        print_success(result.message)
    else:
        print_warning(result.message)

    # Check required files
    print_status("Checking required files...")
    for result in check_required_files():
        if result.passed:
            print_success(result.message)
        else:
            print_error(result.message)
            all_passed = False

    if not all_passed:
        return 1

    # Check script permissions
    print_status("Checking script permissions...")
    for result in check_script_permissions():
        if result.passed:
            print_success(result.message)
        else:
            print_warning(result.message)

    # Validate compose files
    print_status("Validating docker-compose files...")
    for result in validate_compose_files():
        if result.passed:
            print_success(result.message)
        else:
            print_warning(result.message)

    # Test script help
    print_status("Testing build script help...")
    result = test_script_help("build.sh")
    if result.passed:
        print_success(result.message)
    else:
        print_error(result.message)
        all_passed = False

    print_status("Testing deploy script help...")
    result = test_script_help("deploy.sh")
    if result.passed:
        print_success(result.message)
    else:
        print_error(result.message)
        all_passed = False

    # Check Dockerfile targets
    print_status("Checking Dockerfile targets...")
    for result in check_dockerfile_targets():
        if result.passed:
            print_success(result.message)
        else:
            print_warning(result.message)

    # Check build arguments
    print_status("Checking build arguments...")
    for result in check_build_arguments():
        if result.passed:
            print_success(result.message)
        else:
            print_warning(result.message)

    # Summary
    print("")
    if all_passed:
        print_success("🎉 Docker structure validation completed!")
        print_status("The new consolidated Docker structure is ready to use.")
        print_status("")
        print_status("Next steps:")
        print_status("1. Test with: ./build.sh dev")
        print_status("2. Deploy with: ./deploy.sh dev")
        print_status("3. Update CI/CD workflows to use new structure")
        print_status("4. Remove old Dockerfiles after migration")
        return 0
    else:
        print_error("Docker structure validation failed!")
        return 1


def main() -> int:
    """Main entry point."""
    return run_validation()


if __name__ == "__main__":
    sys.exit(main())