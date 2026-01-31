#!/usr/bin/env python3
"""Deployment Workflows Validation Script.

Validates deployment workflow configurations and prerequisites.
"""

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


class Color:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"


@dataclass
class ValidationResult:
    """Result of validation checks."""

    passed: int = 0
    failed: int = 0
    warnings: int = 0
    missing_scripts: list[str] = field(default_factory=list)


class DeploymentValidator:
    """Validates deployment workflow configurations."""

    def __init__(self, project_root: Path | None = None) -> None:
        """Initialize validator.

        Args:
            project_root: Root directory of the project.
        """
        self.project_root = project_root or Path.cwd()
        self.result = ValidationResult()

    def check_file(self, path: str, required: bool = True) -> bool:
        """Check if a file exists.

        Args:
            path: Relative path to the file.
            required: If True, missing file is an error; otherwise warning.

        Returns:
            True if file exists.
        """
        full_path = self.project_root / path
        if full_path.is_file():
            print(f"{Color.GREEN}\u2713{Color.NC} Found: {path}")
            self.result.passed += 1
            return True
        else:
            if required:
                print(f"{Color.RED}\u2717{Color.NC} Missing: {path}")
                self.result.failed += 1
            else:
                print(f"{Color.YELLOW}\u26a0{Color.NC} Missing: {path} (optional)")
                self.result.warnings += 1
            return False

    def check_dir(self, path: str, required: bool = False) -> bool:
        """Check if a directory exists.

        Args:
            path: Relative path to the directory.
            required: If True, missing directory is an error; otherwise warning.

        Returns:
            True if directory exists.
        """
        full_path = self.project_root / path
        if full_path.is_dir():
            print(f"{Color.GREEN}\u2713{Color.NC} Found: {path}")
            self.result.passed += 1
            return True
        else:
            if required:
                print(f"{Color.RED}\u2717{Color.NC} Missing: {path}")
                self.result.failed += 1
            else:
                print(f"{Color.YELLOW}\u26a0{Color.NC} Missing: {path} (optional)")
                self.result.warnings += 1
            return False

    def check_workflow_files(self) -> None:
        """Check deployment workflow files exist."""
        print("1. Checking deployment workflow files...")
        self.check_file(".github/workflows/deploy-docs.yml")
        self.check_file(".github/workflows/deploy-next-docs.yml")
        self.check_file(".github/workflows/db-monitoring-deployment.yml")
        print()

    def check_docker_files(self) -> None:
        """Check Docker files exist."""
        print("2. Checking Docker files...")
        self.check_file("docker/Dockerfile.docs-next")
        print()

    def check_documentation_structure(self) -> None:
        """Check documentation structure."""
        print("3. Checking documentation structure...")
        self.check_dir("docs")
        self.check_file("docs/package.json")
        self.check_dir("content/wiki")
        print()

    def check_monitoring_structure(self) -> None:
        """Check monitoring structure."""
        print("4. Checking monitoring structure...")
        self.check_dir("monitoring/dashboards")
        self.check_dir("monitoring/alerts")
        print()

    def check_required_scripts(self) -> None:
        """Check required scripts exist."""
        print("5. Checking required scripts...")
        self.check_file("scripts/benchmark-vector-search.js")
        self.check_file("scripts/setup-datadog-dbm.ts")

        # Optional scripts with fallbacks
        if not self.check_file("scripts/update-datadog-baselines.js", required=False):
            self.result.missing_scripts.append("update-datadog-baselines.js")

        if not self.check_file("scripts/verify-datadog-integration.js", required=False):
            self.result.missing_scripts.append("verify-datadog-integration.js")

        print()

    def validate_package_json(self) -> None:
        """Validate package.json scripts."""
        print("6. Validating package.json scripts...")

        package_path = self.project_root / "package.json"
        if not package_path.is_file():
            print(f"{Color.YELLOW}\u26a0{Color.NC} package.json not found, skipping validation")
            self.result.warnings += 1
            print()
            return

        try:
            with open(package_path) as f:
                package_data = json.load(f)

            scripts = package_data.get("scripts", {})
            if "build" in scripts:
                print(f"{Color.GREEN}\u2713{Color.NC} build script exists")
                self.result.passed += 1
            else:
                print(f"{Color.RED}\u2717{Color.NC} build script missing")
                self.result.failed += 1

        except json.JSONDecodeError:
            print(f"{Color.RED}\u2717{Color.NC} Invalid JSON in package.json")
            self.result.failed += 1

        print()

    def check_node_version(self) -> None:
        """Check Node.js version."""
        print("7. Checking Node.js version...")

        if not shutil.which("node"):
            print(f"{Color.RED}\u2717{Color.NC} Node.js not installed")
            self.result.failed += 1
            print()
            return

        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                check=True,
            )
            node_version = result.stdout.strip()
            print(f"{Color.GREEN}\u2713{Color.NC} Node.js version: {node_version}")
            self.result.passed += 1

            # Parse major version
            version_str = node_version.lstrip("v")
            major_version = int(version_str.split(".")[0])
            required_major = 20

            if major_version >= required_major:
                print(f"{Color.GREEN}\u2713{Color.NC} Node.js version meets requirements (>= v20)")
                self.result.passed += 1
            else:
                print(f"{Color.YELLOW}\u26a0{Color.NC} Node.js version below v20 (workflows use v20/v22)")
                self.result.warnings += 1

        except (subprocess.CalledProcessError, ValueError):
            print(f"{Color.RED}\u2717{Color.NC} Failed to get Node.js version")
            self.result.failed += 1

        print()

    def print_summary(self) -> None:
        """Print validation summary."""
        print("=== Summary ===")

        if self.result.missing_scripts:
            print(f"{Color.YELLOW}Missing optional scripts:{Color.NC}")
            for script in self.result.missing_scripts:
                print(f"  - scripts/{script}")
            print()
            print("These scripts have fallbacks in the workflows and are not critical.")

        print()
        print(f"{Color.GREEN}Validation complete!{Color.NC}")
        print()
        print("Next steps:")
        print("1. Ensure required GitHub secrets are configured")
        print("2. Test workflows in a non-production environment")
        print("3. Monitor first production deployment")
        print()
        print("For detailed fixes, see: claudedocs/deployment-workflows-fixes.md")

    def run(self) -> int:
        """Run all validation checks.

        Returns:
            Exit code (0 for success, 1 for failures).
        """
        print("=== Deployment Workflows Validation ===")
        print()

        self.check_workflow_files()
        self.check_docker_files()
        self.check_documentation_structure()
        self.check_monitoring_structure()
        self.check_required_scripts()
        self.validate_package_json()
        self.check_node_version()
        self.print_summary()

        return 1 if self.result.failed > 0 else 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    validator = DeploymentValidator()
    return validator.run()


if __name__ == "__main__":
    sys.exit(main())
