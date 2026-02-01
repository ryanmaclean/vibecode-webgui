#!/usr/bin/env python3
"""
License compatibility check for package.json

Ensures all dependencies use MIT, BSD, or Apache licenses.
Converts check-licenses.sh to Python with proper error handling.
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import shutil
import subprocess
import sys
from pathlib import Path


# Allowed licenses (MIT, BSD variants, Apache) - NO GPL/LGPL/AGPL EVER!
ALLOWED_LICENSES = [
    "MIT",
    "BSD",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "ISC",
    "Unlicense",
    "CC0-1.0",
    "0BSD",
    "CC-BY-4.0",
]


def check_license_checker_installed() -> bool:
    """Check if license-checker is installed."""
    return shutil.which("license-checker") is not None


def install_license_checker() -> bool:
    """Install license-checker globally via npm."""
    print("Installing license-checker...")
    try:
        result = subprocess.run(
            ["npm", "install", "-g", "license-checker"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Failed to install license-checker: {e}")
        return False


def check_licenses(node_modules_dir: Path) -> tuple[bool, str]:
    """
    Check licenses in node_modules directory.

    Returns:
        Tuple of (success, output_message)
    """
    allowed_list = ";".join(ALLOWED_LICENSES)

    try:
        result = subprocess.run(
            [
                "license-checker",
                "--onlyAllow", allowed_list,
                "--production",
                ".",
            ],
            cwd=node_modules_dir,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            return True, "All licenses are compatible"
        else:
            return False, result.stderr or result.stdout
    except Exception as e:
        return False, f"Failed to run license-checker: {e}"


def get_detailed_report(node_modules_dir: Path) -> str:
    """Get detailed license report."""
    try:
        result = subprocess.run(
            ["license-checker", "--production", "."],
            cwd=node_modules_dir,
            capture_output=True,
            text=True,
        )
        return result.stdout
    except Exception:
        return "Unable to generate detailed report"


def main() -> int:
    """Main entry point."""
    print("Checking license compatibility...")

    # Check for license-checker
    if not check_license_checker_installed():
        if not install_license_checker():
            print("Could not install license-checker")
            return 1

    # Format allowed licenses
    allowed_list = ";".join(ALLOWED_LICENSES)
    print(f"Allowed licenses: {allowed_list}")

    # Check for node_modules
    node_modules = Path("node_modules")
    if not node_modules.is_dir():
        print("No node_modules directory found, skipping license check")
        return 0

    # Check licenses
    success, message = check_licenses(node_modules)

    if success:
        print(f"All licenses are compatible")
        return 0
    else:
        print("Found incompatible licenses")
        print("Detailed license report:")
        print(get_detailed_report(node_modules))
        return 1


if __name__ == "__main__":
    sys.exit(main())
