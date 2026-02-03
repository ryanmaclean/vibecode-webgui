#!/usr/bin/env python3
"""Vibecode WebGUI configuration validator.

Ensures environment files and integrations are ready for local development.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()


@dataclass
class ValidationCounters:
    """Tracks warning and error counts during validation."""

    warnings: int = field(default=0)
    errors: int = field(default=0)


def info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}{message}{COLORS.reset}")


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}\u2713 {message}{COLORS.reset}")


def warn(message: str, counters: ValidationCounters) -> None:
    """Print yellow warning message and increment counter."""
    print(f"{COLORS.yellow}\u26a0 {message}{COLORS.reset}")
    counters.warnings += 1


def err(message: str, counters: ValidationCounters) -> None:
    """Print red error message and increment counter."""
    print(f"{COLORS.red}\u2717 {message}{COLORS.reset}")
    counters.errors += 1


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def which(cmd: str) -> str | None:
    """Find command in PATH."""
    return shutil.which(cmd)


def load_env_var(config_file: Path, var_name: str) -> str:
    """Load a variable from the config file."""
    if not config_file.exists():
        return ""
    for line in config_file.read_text().splitlines():
        if line.startswith(f"{var_name}="):
            return line.split("=", 1)[1]
    return ""


def validate_config_file(project_root: Path, counters: ValidationCounters) -> Path:
    """Validate presence of config file."""
    config_file = project_root / ".env.local"
    env_example = project_root / "env.development.example"

    if not config_file.exists():
        if env_example.exists():
            warn(".env.local not found. Create one via scripts/vibecode-cli/install.sh", counters)
        else:
            err("No local environment file present.", counters)
    else:
        ok(f"Found {config_file.name}")

    return config_file


def validate_datadog(config_file: Path, counters: ValidationCounters) -> None:
    """Validate Datadog configuration."""
    info("Validating Datadog configuration")

    dd_api_key = load_env_var(config_file, "DD_API_KEY")
    dd_site = load_env_var(config_file, "DD_SITE")

    if not dd_api_key:
        warn("DD_API_KEY missing", counters)
    elif "your-datadog" in dd_api_key.lower():
        warn("DD_API_KEY still set to placeholder", counters)
    else:
        ok("DD_API_KEY present")

    if not dd_site:
        warn("DD_SITE not configured (defaulting to datadoghq.com)", counters)
    else:
        ok(f"DD_SITE: {dd_site}")

    # Test Datadog API connectivity
    if which("curl") and dd_api_key and "your-datadog" not in dd_api_key.lower():
        dd_base = f"https://{dd_site or 'datadoghq.com'}"
        try:
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-m",
                    "5",
                    "-H",
                    f"DD-API-KEY: {dd_api_key}",
                    f"{dd_base}/api/v1/validate",
                ],
                capture_output=True,
                check=False,
            )
            if result.returncode == 0:
                ok("Datadog API reachable")
            else:
                warn(f"Unable to validate Datadog API key against {dd_base}", counters)
        except (subprocess.SubprocessError, OSError):
            warn(f"Unable to validate Datadog API key against {dd_base}", counters)
    else:
        warn("Skipping Datadog connectivity (missing curl or API key)", counters)


def validate_database(config_file: Path, counters: ValidationCounters) -> None:
    """Validate database connectivity."""
    info("Validating database connectivity")

    database_url = load_env_var(config_file, "DATABASE_URL")

    if not database_url:
        warn("DATABASE_URL not configured", counters)
    elif which("psql"):
        try:
            result = subprocess.run(
                ["psql", database_url, "-c", "SELECT 1;"],
                capture_output=True,
                check=False,
                env={"PGPASSWORD": ""},
            )
            if result.returncode == 0:
                ok("Database reachable")
            else:
                warn("Database connection failed. Ensure service is running.", counters)
        except (subprocess.SubprocessError, OSError):
            warn("Database connection failed. Ensure service is running.", counters)
    else:
        warn("psql not available. Install PostgreSQL client to test connectivity.", counters)


def validate_redis(config_file: Path, counters: ValidationCounters) -> None:
    """Validate Redis configuration."""
    info("Validating Redis configuration")

    redis_url = load_env_var(config_file, "REDIS_URL")

    if not redis_url:
        warn("REDIS_URL not configured", counters)
    elif which("redis-cli"):
        try:
            result = subprocess.run(
                ["redis-cli", "-u", redis_url, "ping"],
                capture_output=True,
                check=False,
            )
            if result.returncode == 0:
                ok("Redis reachable")
            else:
                warn(f"Redis ping failed ({redis_url})", counters)
        except (subprocess.SubprocessError, OSError):
            warn(f"Redis ping failed ({redis_url})", counters)
    else:
        warn("redis-cli not installed. Skipping Redis connectivity test.", counters)


def validate_tooling(project_root: Path, counters: ValidationCounters) -> None:
    """Check project tooling availability."""
    info("Checking project tooling")

    for tool in ("node", "npm", "git"):
        if which(tool):
            ok(f"{tool} available")
        else:
            err(f"{tool} not found", counters)

    node_modules = project_root / "node_modules"
    if node_modules.is_dir():
        ok("node_modules directory present")
    else:
        warn("node_modules missing. Run npm install.", counters)


def print_summary(counters: ValidationCounters) -> None:
    """Print validation summary."""
    print()
    info("Summary")
    print(f"  Errors  : {counters.errors}")
    print(f"  Warnings: {counters.warnings}")

    if counters.errors == 0 and counters.warnings == 0:
        print(f"{COLORS.green}Configuration validated successfully.{COLORS.reset}")
    elif counters.errors == 0:
        print(f"{COLORS.yellow}Validation completed with warnings.{COLORS.reset}")
    else:
        print(f"{COLORS.red}Validation failed. Address the issues above.{COLORS.reset}")


def main() -> int:
    """Main entry point."""
    project_root = get_project_root()
    counters = ValidationCounters()

    info("Vibecode WebGUI configuration validator")

    config_file = validate_config_file(project_root, counters)
    validate_datadog(config_file, counters)
    validate_database(config_file, counters)
    validate_redis(config_file, counters)
    validate_tooling(project_root, counters)
    print_summary(counters)

    return 1 if counters.errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
