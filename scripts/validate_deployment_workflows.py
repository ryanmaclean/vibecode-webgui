#!/usr/bin/env python3
"""Deployment Workflows Validation Script.

Validates deployment workflow configurations and prerequisites.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# Required workflow files
WORKFLOW_FILES = [
    ".github/workflows/deploy-docs.yml",
    ".github/workflows/deploy-next-docs.yml",
    ".github/workflows/db-monitoring-deployment.yml",
]

# Required Docker files
DOCKER_FILES = [
    "docker/Dockerfile.docs-next",
]

# Documentation structure
DOC_DIRS = ["docs"]
DOC_FILES = ["docs/package.json"]
DOC_OPTIONAL_DIRS = ["content/wiki"]

# Monitoring structure
MONITORING_DIRS = [
    "monitoring/dashboards",
    "monitoring/alerts",
]

# Required and optional scripts
REQUIRED_SCRIPTS = [
    "scripts/benchmark-vector-search.js",
    "scripts/setup-datadog-dbm.ts",
]

OPTIONAL_SCRIPTS = [
    "scripts/update-datadog-baselines.js",
    "scripts/verify-datadog-integration.js",
]

REQUIRED_NODE_MAJOR_VERSION = 20


@dataclass
class ValidationResult:
    """Result of validation checks."""

    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    missing_optional_scripts: list[str] = field(default_factory=list)


def check_file(path: Path, base_path: Path) -> bool:
    """Check if a file exists.

    Args:
        path: Relative path to check
        base_path: Base path to resolve against

    Returns:
        True if file exists, False otherwise
    """
    full_path = base_path / path
    if full_path.is_file():
        print(f"{GREEN}✓{NC} Found: {path}")
        return True
    else:
        print(f"{RED}✗{NC} Missing: {path}")
        return False


def check_dir(path: Path, base_path: Path, optional: bool = False) -> bool:
    """Check if a directory exists.

    Args:
        path: Relative path to check
        base_path: Base path to resolve against
        optional: Whether this directory is optional

    Returns:
        True if directory exists, False otherwise
    """
    full_path = base_path / path
    if full_path.is_dir():
        print(f"{GREEN}✓{NC} Found: {path}")
        return True
    else:
        if optional:
            print(f"{YELLOW}⚠{NC} Missing: {path} (optional)")
        else:
            print(f"{RED}✗{NC} Missing: {path}")
        return False


def check_package_json_scripts(base_path: Path) -> bool:
    """Check if required scripts exist in package.json.

    Args:
        base_path: Project root directory

    Returns:
        True if build script exists, False otherwise
    """
    package_json_path = base_path / "package.json"

    if not package_json_path.is_file():
        print(f"{RED}✗{NC} package.json not found")
        return False

    try:
        with open(package_json_path) as f:
            package_data = json.load(f)

        scripts = package_data.get("scripts", {})
        if "build" in scripts:
            print(f"{GREEN}✓{NC} build script exists")
            return True
        else:
            print(f"{RED}✗{NC} build script missing")
            return False

    except json.JSONDecodeError:
        print(f"{RED}✗{NC} Invalid JSON in package.json")
        return False


def check_node_version() -> bool:
    """Check Node.js version meets requirements.

    Returns:
        True if Node.js version is adequate, False otherwise
    """
    if not shutil.which("node"):
        print(f"{RED}✗{NC} Node.js not installed")
        return False

    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        version_str = result.stdout.strip()
        print(f"{GREEN}✓{NC} Node.js version: {version_str}")

        # Parse major version (e.g., "v20.10.0" -> 20)
        major_version = int(version_str.lstrip("v").split(".")[0])

        if major_version >= REQUIRED_NODE_MAJOR_VERSION:
            print(f"{GREEN}✓{NC} Node.js version meets requirements (>= v{REQUIRED_NODE_MAJOR_VERSION})")
            return True
        else:
            print(f"{YELLOW}⚠{NC} Node.js version below v{REQUIRED_NODE_MAJOR_VERSION} (workflows use v20/v22)")
            return False

    except (subprocess.TimeoutExpired, subprocess.SubprocessError, ValueError) as e:
        print(f"{RED}✗{NC} Failed to check Node.js version: {e}")
        return False


def validate_workflows(base_path: Path | None = None) -> ValidationResult:
    """Validate deployment workflow configurations.

    Args:
        base_path: Project root directory (auto-detected if None)

    Returns:
        ValidationResult with errors, warnings, and missing scripts
    """
    if base_path is None:
        base_path = Path(__file__).parent.parent.resolve()

    result = ValidationResult()

    print("=== Deployment Workflows Validation ===")
    print()

    # 1. Check workflow files
    print("1. Checking deployment workflow files...")
    for file_path in WORKFLOW_FILES:
        if not check_file(Path(file_path), base_path):
            result.errors.append(file_path)
    print()

    # 2. Check Docker files
    print("2. Checking Docker files...")
    for file_path in DOCKER_FILES:
        if not check_file(Path(file_path), base_path):
            result.errors.append(file_path)
    print()

    # 3. Check documentation structure
    print("3. Checking documentation structure...")
    for dir_path in DOC_DIRS:
        if not check_dir(Path(dir_path), base_path):
            result.errors.append(dir_path)
    for file_path in DOC_FILES:
        if not check_file(Path(file_path), base_path):
            result.errors.append(file_path)
    for dir_path in DOC_OPTIONAL_DIRS:
        check_dir(Path(dir_path), base_path, optional=True)
    print()

    # 4. Check monitoring structure
    print("4. Checking monitoring structure...")
    for dir_path in MONITORING_DIRS:
        if not check_dir(Path(dir_path), base_path, optional=True):
            result.warnings.append(dir_path)
    print()

    # 5. Check required scripts
    print("5. Checking required scripts...")
    for file_path in REQUIRED_SCRIPTS:
        if not check_file(Path(file_path), base_path):
            result.errors.append(file_path)

    for file_path in OPTIONAL_SCRIPTS:
        if not check_file(Path(file_path), base_path):
            script_name = Path(file_path).name
            result.missing_optional_scripts.append(script_name)
    print()

    # 6. Validate package.json scripts
    print("6. Validating package.json scripts...")
    check_package_json_scripts(base_path)
    print()

    # 7. Check Node.js version
    print("7. Checking Node.js version...")
    check_node_version()
    print()

    return result


def print_summary(result: ValidationResult) -> None:
    """Print validation summary.

    Args:
        result: Validation result to summarize
    """
    print("=== Summary ===")

    if result.missing_optional_scripts:
        print(f"{YELLOW}Missing optional scripts:{NC}")
        for script in result.missing_optional_scripts:
            print(f"  - scripts/{script}")
        print()
        print("These scripts have fallbacks in the workflows and are not critical.")

    print()
    print(f"{GREEN}Validation complete!{NC}")
    print()
    print("Next steps:")
    print("1. Ensure required GitHub secrets are configured")
    print("2. Test workflows in a non-production environment")
    print("3. Monitor first production deployment")
    print()
    print("For detailed fixes, see: claudedocs/deployment-workflows-fixes.md")


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success)
    """
    result = validate_workflows()
    print_summary(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
