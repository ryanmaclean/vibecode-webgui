#!/usr/bin/env python3
"""Vibecode WebGUI configuration validator.

Ensures environment files and integrations are ready for local development.
"""

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


class Color:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


@dataclass
class ValidationResults:
    """Validation results tracker."""

    warnings: int = 0
    errors: int = 0

    def add_warning(self) -> None:
        """Record a warning."""
        self.warnings += 1

    def add_error(self) -> None:
        """Record an error."""
        self.errors += 1

    def is_valid(self) -> bool:
        """Check if validation passed (no errors)."""
        return self.errors == 0

    def is_perfect(self) -> bool:
        """Check if validation passed without warnings."""
        return self.errors == 0 and self.warnings == 0


class ConfigValidator:
    """Validates Vibecode WebGUI configuration."""

    def __init__(self, project_root: Path | None = None) -> None:
        """Initialize validator.

        Args:
            project_root: Root directory of the project.
        """
        self.project_root = project_root or Path(__file__).parent.parent.parent.resolve()
        self.config_file = self.project_root / ".env.local"
        self.results = ValidationResults()
        self.config_vars: dict[str, str] = {}

    def info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}{message}{Color.NC}")

    def ok(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}\u2713 {message}{Color.NC}")

    def warn(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}\u26a0 {message}{Color.NC}")
        self.results.add_warning()

    def err(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}\u2717 {message}{Color.NC}")
        self.results.add_error()

    def load_config(self) -> None:
        """Load configuration from .env.local file."""
        if not self.config_file.exists():
            return

        for line in self.config_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                self.config_vars[key.strip()] = value.strip()

    def get_var(self, name: str) -> str:
        """Get a configuration variable.

        Args:
            name: Variable name.

        Returns:
            Variable value or empty string.
        """
        return self.config_vars.get(name, "")

    def check_config_file(self) -> None:
        """Check if configuration file exists."""
        if not self.config_file.exists():
            example_file = self.project_root / "env.development.example"
            if example_file.exists():
                self.warn(".env.local not found. Create one via scripts/vibecode-cli/install.sh")
            else:
                self.err("No local environment file present.")
        else:
            self.ok(f"Found {self.config_file.name}")

    def validate_datadog(self) -> None:
        """Validate Datadog configuration."""
        self.info("Validating Datadog configuration")

        dd_api_key = self.get_var("DD_API_KEY")
        dd_site = self.get_var("DD_SITE")

        # Check API key
        if not dd_api_key:
            self.warn("DD_API_KEY missing")
        elif "your-datadog" in dd_api_key.lower():
            self.warn("DD_API_KEY still set to placeholder")
        else:
            self.ok("DD_API_KEY present")

        # Check site
        if not dd_site:
            self.warn("DD_SITE not configured (defaulting to datadoghq.com)")
        else:
            self.ok(f"DD_SITE: {dd_site}")

        # Test API connectivity
        if shutil.which("curl") and dd_api_key and "your-datadog" not in dd_api_key.lower():
            dd_base = f"https://{dd_site or 'datadoghq.com'}"
            result = subprocess.run(
                [
                    "curl", "-s", "-m", "5",
                    "-H", f"DD-API-KEY: {dd_api_key}",
                    f"{dd_base}/api/v1/validate",
                ],
                capture_output=True,
            )
            if result.returncode == 0:
                self.ok("Datadog API reachable")
            else:
                self.warn(f"Unable to validate Datadog API key against {dd_base}")
        else:
            self.warn("Skipping Datadog connectivity (missing curl or API key)")

    def validate_database(self) -> None:
        """Validate database connectivity."""
        self.info("Validating database connectivity")

        database_url = self.get_var("DATABASE_URL")

        if not database_url:
            self.warn("DATABASE_URL not configured")
        elif shutil.which("psql"):
            env = os.environ.copy()
            env["PGPASSWORD"] = ""
            result = subprocess.run(
                ["psql", database_url, "-c", "SELECT 1;"],
                capture_output=True,
                env=env,
            )
            if result.returncode == 0:
                self.ok("Database reachable")
            else:
                self.warn("Database connection failed. Ensure service is running.")
        else:
            self.warn("psql not available. Install PostgreSQL client to test connectivity.")

    def validate_redis(self) -> None:
        """Validate Redis configuration."""
        self.info("Validating Redis configuration")

        redis_url = self.get_var("REDIS_URL")

        if not redis_url:
            self.warn("REDIS_URL not configured")
        elif shutil.which("redis-cli"):
            result = subprocess.run(
                ["redis-cli", "-u", redis_url, "ping"],
                capture_output=True,
            )
            if result.returncode == 0:
                self.ok("Redis reachable")
            else:
                self.warn(f"Redis ping failed ({redis_url})")
        else:
            self.warn("redis-cli not installed. Skipping Redis connectivity test.")

    def check_tooling(self) -> None:
        """Check project tooling."""
        self.info("Checking project tooling")

        for tool in ["node", "npm", "git"]:
            if shutil.which(tool):
                self.ok(f"{tool} available")
            else:
                self.err(f"{tool} not found")

        node_modules = self.project_root / "node_modules"
        if node_modules.is_dir():
            self.ok("node_modules directory present")
        else:
            self.warn("node_modules missing. Run npm install.")

    def print_summary(self) -> None:
        """Print validation summary."""
        print()
        self.info("Summary")
        print(f"  Errors  : {self.results.errors}")
        print(f"  Warnings: {self.results.warnings}")

        if self.results.is_perfect():
            print(f"{Color.GREEN}Configuration validated successfully.{Color.NC}")
        elif self.results.is_valid():
            print(f"{Color.YELLOW}Validation completed with warnings.{Color.NC}")
        else:
            print(f"{Color.RED}Validation failed. Address the issues above.{Color.NC}")

    def run(self) -> int:
        """Run all validation checks.

        Returns:
            Exit code (0 for success, 1 for errors).
        """
        self.info("Vibecode WebGUI configuration validator")

        self.check_config_file()
        self.load_config()
        self.validate_datadog()
        self.validate_database()
        self.validate_redis()
        self.check_tooling()
        self.print_summary()

        return 0 if self.results.is_valid() else 1


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    validator = ConfigValidator()
    return validator.run()


if __name__ == "__main__":
    sys.exit(main())
