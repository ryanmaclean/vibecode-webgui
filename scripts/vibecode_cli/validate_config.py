#!/usr/bin/env python3


"""Vibecode WebGUI configuration validator.

Ensures environment files and integrations are ready for local development.
"""

from __future__ import annotations
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

import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

from . import COLORS, get_project_root, log, ok, run_command, warn, which


@dataclass
class ValidationResult:
    """Tracks validation warnings and errors."""

    warnings: int = 0
    errors: int = 0
    stream: TextIO = field(default_factory=lambda: sys.stdout)

    def info(self, message: str) -> None:
        """Print blue informational message."""
        self.stream.write(f"{COLORS.blue}{message}{COLORS.reset}\n")
        self.stream.flush()

    def ok(self, message: str) -> None:
        """Print green success message with checkmark."""
        self.stream.write(f"{COLORS.green}\u2713 {message}{COLORS.reset}\n")
        self.stream.flush()

    def warn(self, message: str) -> None:
        """Print yellow warning message and increment counter."""
        self.stream.write(f"{COLORS.yellow}\u26a0 {message}{COLORS.reset}\n")
        self.stream.flush()
        self.warnings += 1

    def err(self, message: str) -> None:
        """Print red error message and increment counter."""
        self.stream.write(f"{COLORS.red}\u2717 {message}{COLORS.reset}\n")
        self.stream.flush()
        self.errors += 1


def load_env_var(config_file: Path, var_name: str) -> str:
    """Load a variable value from an env file.

    If the variable appears multiple times, the last value wins (matches shell behavior).
    """
    if not config_file.exists():
        return ""

    value = ""
    for line in config_file.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{var_name}="):
            value = line.split("=", 1)[1]
    return value


def validate_env_file(project_root: Path, result: ValidationResult) -> Path | None:
    """Check if .env.local exists."""
    config_file = project_root / ".env.local"
    env_template = project_root / "env.development.example"

    if not config_file.exists():
        if env_template.exists():
            result.warn(".env.local not found. Create one via python -m vibecode_cli.install")
        else:
            result.err("No local environment file present.")
        return None

    result.ok(f"Found {config_file.name}")
    return config_file


def validate_datadog(config_file: Path | None, result: ValidationResult) -> None:
    """Validate Datadog configuration."""
    result.info("Validating Datadog configuration")

    if config_file is None:
        result.warn("Cannot validate Datadog - no config file")
        return

    dd_api_key = load_env_var(config_file, "DD_API_KEY")
    dd_site = load_env_var(config_file, "DD_SITE")

    # Check API key
    if not dd_api_key:
        result.warn("DD_API_KEY missing")
    elif "your-datadog" in dd_api_key.lower():
        result.warn("DD_API_KEY still set to placeholder")
    else:
        result.ok("DD_API_KEY present")

    # Check site
    if not dd_site:
        result.warn("DD_SITE not configured (defaulting to datadoghq.com)")
    else:
        result.ok(f"DD_SITE: {dd_site}")

    # Test connectivity
    if which("curl") and dd_api_key and "your-datadog" not in dd_api_key.lower():
        dd_base = f"https://{dd_site or 'datadoghq.com'}"
        try:
            run_command(
                ["curl", "-s", "-m", "5", "-H", f"DD-API-KEY: {dd_api_key}", f"{dd_base}/api/v1/validate"],
                check=True,
                capture_output=True,
            )
            result.ok("Datadog API reachable")
        except subprocess.CalledProcessError:
            result.warn(f"Unable to validate Datadog API key against {dd_base}")
    else:
        result.warn("Skipping Datadog connectivity (missing curl or API key)")


def validate_database(config_file: Path | None, result: ValidationResult) -> None:
    """Validate database connectivity."""
    result.info("Validating database connectivity")

    if config_file is None:
        result.warn("Cannot validate database - no config file")
        return

    database_url = load_env_var(config_file, "DATABASE_URL")

    if not database_url:
        result.warn("DATABASE_URL not configured")
    elif which("psql"):
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = ""
            run_command(
                ["psql", database_url, "-c", "SELECT 1;"],
                check=True,
                capture_output=True,
                env=env,
            )
            result.ok("Database reachable")
        except subprocess.CalledProcessError:
            result.warn("Database connection failed. Ensure service is running.")
    else:
        result.warn("psql not available. Install PostgreSQL client to test connectivity.")


def validate_redis(config_file: Path | None, result: ValidationResult) -> None:
    """Validate Redis configuration."""
    result.info("Validating Redis configuration")

    if config_file is None:
        result.warn("Cannot validate Redis - no config file")
        return

    redis_url = load_env_var(config_file, "REDIS_URL")

    if not redis_url:
        result.warn("REDIS_URL not configured")
    elif which("redis-cli"):
        try:
            run_command(
                ["redis-cli", "-u", redis_url, "ping"],
                check=True,
                capture_output=True,
            )
            result.ok("Redis reachable")
        except subprocess.CalledProcessError:
            result.warn(f"Redis ping failed ({redis_url})")
    else:
        result.warn("redis-cli not installed. Skipping Redis connectivity test.")


def validate_tooling(result: ValidationResult) -> None:
    """Check project tooling availability."""
    result.info("Checking project tooling")

    for tool in ["node", "npm", "git"]:
        if which(tool):
            result.ok(f"{tool} available")
        else:
            result.err(f"{tool} not found")


def validate_node_modules(project_root: Path, result: ValidationResult) -> None:
    """Check if node_modules directory exists."""
    node_modules = project_root / "node_modules"
    if node_modules.is_dir():
        result.ok("node_modules directory present")
    else:
        result.warn("node_modules missing. Run npm install.")


def print_summary(result: ValidationResult) -> None:
    """Print validation summary."""
    print()
    result.info("Summary")
    print(f"  Errors  : {result.errors}")
    print(f"  Warnings: {result.warnings}")

    if result.errors == 0 and result.warnings == 0:
        print(f"{COLORS.green}Configuration validated successfully.{COLORS.reset}")
    elif result.errors == 0:
        print(f"{COLORS.yellow}Validation completed with warnings.{COLORS.reset}")
    else:
        print(f"{COLORS.red}Validation failed. Address the issues above.{COLORS.reset}")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    project_root = get_project_root()
    os.chdir(project_root)

    result = ValidationResult()

    result.info("Vibecode WebGUI configuration validator")

    config_file = validate_env_file(project_root, result)
    validate_datadog(config_file, result)
    validate_database(config_file, result)
    validate_redis(config_file, result)
    validate_tooling(result)
    validate_node_modules(project_root, result)

    print_summary(result)

    return 1 if result.errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())