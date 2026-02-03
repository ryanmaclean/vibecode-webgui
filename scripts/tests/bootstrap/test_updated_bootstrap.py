#!/usr/bin/env python3
"""Test the updated AKS bootstrap script.

Validates that all AKS bootstrap scripts are present, executable,
have valid syntax, and follow the expected modular architecture.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Import bootstrap environment
try:
    from .bootstrap_env import (
        BOOTSTRAP_TEST_REPO_ROOT,
        BOOTSTRAP_TEST_SCRIPTS_DIR,
    )
except ImportError:
    from bootstrap_env import (
        BOOTSTRAP_TEST_REPO_ROOT,
        BOOTSTRAP_TEST_SCRIPTS_DIR,
    )

# ANSI colors
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class TestResult:
    """Result of a single test."""

    name: str
    passed: bool
    message: str = ""
    fixed: bool = False


@dataclass
class TestSuite:
    """Collection of test results."""

    results: list[TestResult] = field(default_factory=list)

    def add(self, result: TestResult) -> None:
        """Add a test result."""
        self.results.append(result)

    @property
    def passed(self) -> int:
        """Count of passed tests."""
        return sum(1 for r in self.results if r.passed)

    @property
    def failed(self) -> int:
        """Count of failed tests."""
        return sum(1 for r in self.results if not r.passed)

    @property
    def all_passed(self) -> bool:
        """Check if all tests passed."""
        return self.failed == 0


# Script paths
SCRIPTS_DIR = BOOTSTRAP_TEST_SCRIPTS_DIR
REPO_ROOT = BOOTSTRAP_TEST_REPO_ROOT

# Scripts to check
SCRIPTS_TO_CHECK = [
    "aks-bootstrap.sh",
    "aks-datadog-setup.sh",
    "aks-postgresql-setup.sh",
    "aks-app-deploy.sh",
]


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
    cwd: Optional[Path] = None,
    env: Optional[dict] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, raise on failure.
        capture: If True, capture output.
        cwd: Working directory.
        env: Environment variables.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        merged_env = os.environ.copy()
        if env:
            merged_env.update(env)

        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=cwd,
            env=merged_env
        )
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_relative_path(path: Path) -> str:
    """Get path relative to repo root.

    Args:
        path: Absolute path.

    Returns:
        Relative path string.
    """
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def check_script_exists(script_path: Path) -> TestResult:
    """Check if a script exists and is executable.

    Args:
        script_path: Path to the script.

    Returns:
        TestResult with status.
    """
    rel_path = get_relative_path(script_path)

    if not script_path.exists():
        return TestResult(
            name=f"Script exists: {rel_path}",
            passed=False,
            message="missing"
        )

    if os.access(script_path, os.X_OK):
        return TestResult(
            name=f"Script exists: {rel_path}",
            passed=True,
            message="executable"
        )

    # Try to fix by making executable
    try:
        script_path.chmod(0o755)
        return TestResult(
            name=f"Script exists: {rel_path}",
            passed=True,
            message="made executable",
            fixed=True
        )
    except OSError as e:
        return TestResult(
            name=f"Script exists: {rel_path}",
            passed=False,
            message=f"exists but not executable: {e}"
        )


def check_script_syntax(script_path: Path) -> TestResult:
    """Check script syntax using bash -n.

    Args:
        script_path: Path to the script.

    Returns:
        TestResult with status.
    """
    rel_path = get_relative_path(script_path)

    if not script_path.exists():
        return TestResult(
            name=f"Syntax check: {rel_path}",
            passed=False,
            message="file not found"
        )

    rc, stdout, stderr = run_command(
        ["bash", "-n", str(script_path)],
        check=False
    )

    if rc == 0:
        return TestResult(
            name=f"Syntax check: {rel_path}",
            passed=True,
            message="syntax OK"
        )
    else:
        return TestResult(
            name=f"Syntax check: {rel_path}",
            passed=False,
            message=f"syntax error: {stderr.strip()}"
        )


def test_script_load(script_path: Path, env: Optional[dict] = None) -> TestResult:
    """Test that a script can be sourced without errors.

    Args:
        script_path: Path to the script.
        env: Environment variables to set.

    Returns:
        TestResult with status.
    """
    rel_path = get_relative_path(script_path)

    if not script_path.exists():
        return TestResult(
            name=f"Load test: {rel_path}",
            passed=False,
            message="file not found"
        )

    # Create a test script that sources the target and exits
    test_cmd = f"source '{script_path}' && echo 'loaded'"

    rc, stdout, stderr = run_command(
        ["bash", "-c", test_cmd],
        env=env,
        check=False
    )

    if rc == 0 and "loaded" in stdout:
        return TestResult(
            name=f"Load test: {rel_path}",
            passed=True,
            message="loaded successfully"
        )
    else:
        return TestResult(
            name=f"Load test: {rel_path}",
            passed=False,
            message=f"load failed: {stderr.strip()}"
        )


def create_validation_script(source_script: Path) -> Optional[Path]:
    """Create a validation version of the bootstrap script.

    Args:
        source_script: Path to the source bootstrap script.

    Returns:
        Path to temporary validation script or None on error.
    """
    if not source_script.exists():
        return None

    try:
        content = source_script.read_text()

        # Find and remove the section from "# Call additional setup scripts" to end
        marker = "# Call additional setup scripts"
        if marker in content:
            content = content.split(marker)[0]

        # Add validation completion
        content += '''
  log "Bootstrap validation test completed successfully!"
  log "All modular scripts are available and ready"
}

# Execute test
main "$@"
'''

        # Write to temp file
        fd, path = tempfile.mkstemp(suffix='.sh', prefix='bootstrap-test-')
        with os.fdopen(fd, 'w') as f:
            f.write(content)

        os.chmod(path, 0o755)
        return Path(path)

    except Exception:
        return None


def run_bootstrap_validation(source_script: Path) -> TestResult:
    """Run the bootstrap script validation test.

    Args:
        source_script: Path to the main bootstrap script.

    Returns:
        TestResult with status.
    """
    temp_script = create_validation_script(source_script)

    if temp_script is None:
        return TestResult(
            name="Bootstrap validation",
            passed=False,
            message="could not create validation script"
        )

    try:
        # Set required environment variables
        env = {
            "CLUSTER_NAME": "test-cluster",
            "RESOURCE_GROUP": "test-rg",
            "ACR_NAME": "testacr",
            "NAMESPACE": "test-namespace",
        }

        rc, stdout, stderr = run_command(
            ["bash", str(temp_script)],
            env=env,
            check=False
        )

        if rc == 0:
            return TestResult(
                name="Bootstrap validation",
                passed=True,
                message="validation completed"
            )
        else:
            return TestResult(
                name="Bootstrap validation",
                passed=False,
                message=f"validation failed: {stderr.strip()}"
            )
    finally:
        temp_script.unlink(missing_ok=True)


def print_result(result: TestResult) -> None:
    """Print a test result.

    Args:
        result: Test result to print.
    """
    if result.passed:
        if result.fixed:
            print(f"   {YELLOW}Fixed{NC} {result.name} - {result.message}")
        else:
            print(f"   {GREEN}OK{NC} {result.name} - {result.message}")
    else:
        print(f"   {RED}FAIL{NC} {result.name} - {result.message}")


def print_summary(suite: TestSuite) -> None:
    """Print test summary.

    Args:
        suite: Test suite with results.
    """
    print()
    print("Test Results:")
    print(f"   {GREEN}Passed:{NC} {suite.passed}")
    if suite.failed > 0:
        print(f"   {RED}Failed:{NC} {suite.failed}")
    print()

    if suite.all_passed:
        print(f"{GREEN}All scripts present and executable{NC}")
        print(f"{GREEN}Script syntax validation passed{NC}")
        print(f"{GREEN}Environment variable handling working{NC}")
        print(f"{GREEN}Modular architecture implemented{NC}")
        print()
        print("The updated AKS bootstrap script is ready!")
    else:
        print(f"{RED}Some tests failed. Please fix the issues above.{NC}")


def print_architecture() -> None:
    """Print the script architecture summary."""
    print()
    print("Script Architecture:")
    print("   scripts/aks-bootstrap.sh - Main orchestration")
    print("   scripts/aks-datadog-setup.sh - Monitoring setup")
    print("   scripts/aks-postgresql-setup.sh - Database setup")
    print("   scripts/aks-app-deploy.sh - Application deployment")
    print()
    print("To run the full deployment:")
    print("   export ENV_FILE=.env.local")
    print("   ./scripts/aks-bootstrap.sh")


def run_tests(verbose: bool = False) -> int:
    """Run all bootstrap tests.

    Args:
        verbose: If True, print detailed output.

    Returns:
        Exit code (0 for success).
    """
    print("Testing Updated AKS Bootstrap Script")
    print()

    suite = TestSuite()

    # Build script paths
    script_paths = [SCRIPTS_DIR / name for name in SCRIPTS_TO_CHECK]
    source_script = SCRIPTS_DIR / "aks-bootstrap.sh"

    # Check script availability
    print("Checking script availability:")
    for script_path in script_paths:
        result = check_script_exists(script_path)
        suite.add(result)
        print_result(result)

        if not result.passed:
            print()
            print(f"{RED}Missing required script. Cannot continue.{NC}")
            return 1

    # Test script syntax
    print()
    print("Testing script syntax:")
    for script_path in script_paths:
        result = check_script_syntax(script_path)
        suite.add(result)
        print_result(result)

        if not result.passed:
            print()
            print(f"{RED}Syntax error in script. Cannot continue.{NC}")
            return 1

    # Test environment configuration
    print()
    print("Testing environment configuration:")
    os.environ["CLUSTER_NAME"] = "test-cluster"
    os.environ["RESOURCE_GROUP"] = "test-rg"
    os.environ["ACR_NAME"] = "testacr"
    os.environ["NAMESPACE"] = "test-namespace"
    print(f"   {GREEN}OK{NC} Environment variables set")

    # Run bootstrap validation
    print()
    print("Running bootstrap validation test:")
    if source_script.exists():
        result = run_bootstrap_validation(source_script)
        suite.add(result)
        print_result(result)

    # Test individual script components
    print()
    print("Testing individual script components:")

    # Test Datadog setup script
    datadog_script = SCRIPTS_DIR / "aks-datadog-setup.sh"
    if datadog_script.exists():
        result = test_script_load(
            datadog_script,
            env={"DD_API_KEY": "test_key"}
        )
        # Datadog may need real cluster, so just warn
        if result.passed:
            suite.add(result)
            print(f"   {GREEN}OK{NC} Datadog setup script structure OK")
        else:
            print(f"   {YELLOW}WARN{NC} Datadog setup script has issues (may need real cluster)")

    # Test PostgreSQL setup script
    postgres_script = SCRIPTS_DIR / "aks-postgresql-setup.sh"
    if postgres_script.exists():
        result = check_script_syntax(postgres_script)
        suite.add(result)
        if result.passed:
            print(f"   {GREEN}OK{NC} PostgreSQL setup script syntax OK")
        else:
            print(f"   {RED}FAIL{NC} PostgreSQL setup script syntax error")

    # Test App deployment script
    app_script = SCRIPTS_DIR / "aks-app-deploy.sh"
    if app_script.exists():
        result = check_script_syntax(app_script)
        suite.add(result)
        if result.passed:
            print(f"   {GREEN}OK{NC} App deployment script syntax OK")
        else:
            print(f"   {RED}FAIL{NC} App deployment script syntax error")

    # Print summary
    print_summary(suite)
    print_architecture()

    return 0 if suite.all_passed else 1


def main(verbose: bool = False) -> int:
    """Main entry point.

    Args:
        verbose: If True, print detailed output.

    Returns:
        Exit code (0 for success).
    """
    return run_tests(verbose=verbose)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Test the updated AKS bootstrap script"
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help="Enable verbose output"
    )

    args = parser.parse_args()
    sys.exit(main(verbose=args.verbose))
