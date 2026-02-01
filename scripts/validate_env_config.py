#!/usr/bin/env python3
"""
VibeCode Configuration Validation Script.

Validates .env.example completeness and checks for missing variables.
"""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Optional, Tuple


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}")


def log_success(message: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")


def log_warning(message: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def count_variables(content: str) -> int:
    """Count the number of environment variables defined."""
    pattern = r'^[A-Z_][A-Z0-9_]*='
    return len(re.findall(pattern, content, re.MULTILINE))


def check_required_sections(content: str) -> Tuple[List[str], List[str]]:
    """
    Check for required sections in the .env.example file.

    Returns:
        Tuple of (found_sections, missing_sections)
    """
    required_sections = [
        "Runtime",
        "Database & Caching",
        "Primary AI Provider",
        "Observability & Datadog",
        "Authentication Providers",
        "Security & Rate Limiting",
    ]

    found = []
    missing = []

    for section in required_sections:
        if f"# {section}" in content:
            found.append(section)
        else:
            missing.append(section)

    return found, missing


def check_sensitive_variables(content: str) -> List[Tuple[str, str, bool]]:
    """
    Check that sensitive variables have placeholder values.

    Returns:
        List of (variable_name, status_message, is_ok)
    """
    sensitive_vars = [
        "NEXTAUTH_SECRET",
        "DATABASE_URL",
        "OPENAI_API_KEY",
        "DD_API_KEY",
    ]

    results = []

    for var in sensitive_vars:
        pattern = rf'^{var}=(.*)$'
        match = re.search(pattern, content, re.MULTILINE)

        if match:
            value = match.group(1).strip()
            if "your-" in value or "change-me" in value or not value:
                results.append((var, "has placeholder value", True))
            else:
                results.append((var, f"may contain real value: {value}", False))
        else:
            results.append((var, "not found in .env.example", False))

    return results


def validate_env_config(project_root: Path) -> int:
    """
    Validate the .env.example configuration file.

    Args:
        project_root: Root directory of the project

    Returns:
        0 if validation passes, 1 if it fails
    """
    print("=============================================================================")
    print("Configuration Validation Report")
    print("=============================================================================")
    print()

    env_example_path = project_root / ".env.example"

    # Check if .env.example exists
    if not env_example_path.exists():
        log_error(".env.example not found")
        return 1

    log_success(".env.example found")

    content = env_example_path.read_text()

    # Count variables
    total_vars = count_variables(content)
    log_info(f"Total variables defined: {total_vars}")

    # Check for required sections
    print()
    log_info("Checking required sections...")

    found_sections, missing_sections = check_required_sections(content)

    for section in found_sections:
        log_success(f"+ {section}")

    for section in missing_sections:
        log_error(f"x {section}")

    # Check for sensitive variables
    print()
    log_info("Checking for placeholder values...")

    sensitive_results = check_sensitive_variables(content)

    for var, message, is_ok in sensitive_results:
        if is_ok:
            log_success(f"+ {var} {message}")
        else:
            log_warning(f"! {var} {message}")

    # Summary
    print()
    print("=============================================================================")

    if not missing_sections:
        log_success("Validation passed: .env.example is ready for migration")
        return 0
    else:
        log_error(f"Validation failed: Missing {len(missing_sections)} required sections")
        return 1


def main(project_root: Optional[Path] = None) -> int:
    """
    Main entry point for configuration validation.

    Args:
        project_root: Root directory of the project. If None, uses parent of script directory.

    Returns:
        0 on success, 1 on failure
    """
    if project_root is None:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent

    return validate_env_config(project_root)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="VibeCode Configuration Validation Script"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Root directory of the project (default: parent of script directory)",
    )
    args = parser.parse_args()

    sys.exit(main(project_root=args.project_root))
