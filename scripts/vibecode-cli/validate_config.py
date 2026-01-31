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
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


@dataclass
class ValidationResults:
    """Track validation results."""

    warnings: int = 0
    errors: int = 0


def info(message: str) -> None:
    """Print an info message."""
    print(f"{BLUE}{message}{NC}")


def ok(message: str) -> None:
    """Print a success message."""
    print(f"{GREEN}✓ {message}{NC}")


def warn(message: str, results: ValidationResults) -> None:
    """Print a warning message and increment counter."""
    print(f"{YELLOW}⚠ {message}{NC}")
    results.warnings += 1


def err(message: str, results: ValidationResults) -> None:
    """Print an error message and increment counter."""
    print(f"{RED}✗ {message}{NC}")
    results.errors += 1


def load_var(config_file: Path, var_name: str) -> Optional[str]:
    """Load a variable from the config file.

    Args:
        config_file: Path to the config file.
        var_name: Name of the variable to load.

    Returns:
        The variable value or None if not found.
    """
    if not config_file.exists():
        return None

    value: Optional[str] = None
    with open(config_file) as f:
        for line in f:
            line = line.strip()
            if line.startswith(f"{var_name}="):
                # Get everything after the first =
                value = line.split("=", 1)[1] if "=" in line else None

    return value


def command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def validate_env_file(
    project_root: Path,
    config_file: Path,
    results: ValidationResults
) -> None:
    """Validate the environment file exists.

    Args:
        project_root: Path to the project root.
        config_file: Path to the config file.
        results: ValidationResults to update.
    """
    if not config_file.exists():
        example_file = project_root / "env.development.example"
        if example_file.exists():
            warn(".env.local not found. Create one via scripts/vibecode-cli/install.sh", results)
        else:
            err("No local environment file present.", results)
    else:
        ok(f"Found {config_file.name}")


def validate_datadog_config(
    config_file: Path,
    results: ValidationResults
) -> None:
    """Validate Datadog configuration.

    Args:
        config_file: Path to the config file.
        results: ValidationResults to update.
    """
    info("Validating Datadog configuration")

    dd_api_key = load_var(config_file, "DD_API_KEY")
    dd_site = load_var(config_file, "DD_SITE")

    # Validate DD_API_KEY
    if not dd_api_key:
        warn("DD_API_KEY missing", results)
    elif "your-datadog" in dd_api_key.lower():
        warn("DD_API_KEY still set to placeholder", results)
    else:
        ok("DD_API_KEY present")

    # Validate DD_SITE
    if not dd_site:
        warn("DD_SITE not configured (defaulting to datadoghq.com)", results)
    else:
        ok(f"DD_SITE: {dd_site}")

    # Test Datadog API connectivity
    if dd_api_key and "your-datadog" not in dd_api_key.lower():
        dd_base = f"https://{dd_site or 'datadoghq.com'}"
        try:
            req = Request(
                f"{dd_base}/api/v1/validate",
                headers={"DD-API-KEY": dd_api_key}
            )
            with urlopen(req, timeout=5) as response:
                if response.status == 200:
                    ok("Datadog API reachable")
                else:
                    warn(f"Unable to validate Datadog API key against {dd_base}", results)
        except (URLError, TimeoutError):
            warn(f"Unable to validate Datadog API key against {dd_base}", results)
    else:
        warn("Skipping Datadog connectivity (missing API key)", results)


def validate_database_config(
    config_file: Path,
    results: ValidationResults
) -> None:
    """Validate database connectivity.

    Args:
        config_file: Path to the config file.
        results: ValidationResults to update.
    """
    info("Validating database connectivity")

    database_url = load_var(config_file, "DATABASE_URL")

    if not database_url:
        warn("DATABASE_URL not configured", results)
    elif command_exists("psql"):
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = ""
            result = subprocess.run(
                ["psql", database_url, "-c", "SELECT 1;"],
                capture_output=True,
                timeout=10,
                env=env
            )
            if result.returncode == 0:
                ok("Database reachable")
            else:
                warn("Database connection failed. Ensure service is running.", results)
        except subprocess.TimeoutExpired:
            warn("Database connection timed out.", results)
        except Exception:
            warn("Database connection failed. Ensure service is running.", results)
    else:
        warn("psql not available. Install PostgreSQL client to test connectivity.", results)


def validate_redis_config(
    config_file: Path,
    results: ValidationResults
) -> None:
    """Validate Redis configuration.

    Args:
        config_file: Path to the config file.
        results: ValidationResults to update.
    """
    info("Validating Redis configuration")

    redis_url = load_var(config_file, "REDIS_URL")

    if not redis_url:
        warn("REDIS_URL not configured", results)
    elif command_exists("redis-cli"):
        try:
            result = subprocess.run(
                ["redis-cli", "-u", redis_url, "ping"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0 and b"PONG" in result.stdout:
                ok("Redis reachable")
            else:
                warn(f"Redis ping failed ({redis_url})", results)
        except subprocess.TimeoutExpired:
            warn(f"Redis connection timed out ({redis_url})", results)
        except Exception:
            warn(f"Redis ping failed ({redis_url})", results)
    else:
        warn("redis-cli not installed. Skipping Redis connectivity test.", results)


def validate_project_tooling(
    project_root: Path,
    results: ValidationResults
) -> None:
    """Validate project tooling.

    Args:
        project_root: Path to the project root.
        results: ValidationResults to update.
    """
    info("Checking project tooling")

    # Check required tools
    for tool in ["node", "npm", "git"]:
        if command_exists(tool):
            ok(f"{tool} available")
        else:
            err(f"{tool} not found", results)

    # Check node_modules
    node_modules = project_root / "node_modules"
    if node_modules.is_dir():
        ok("node_modules directory present")
    else:
        warn("node_modules missing. Run npm install.", results)


def print_summary(results: ValidationResults) -> None:
    """Print validation summary.

    Args:
        results: ValidationResults to summarize.
    """
    print()
    info("Summary")
    print(f"  Errors  : {results.errors}")
    print(f"  Warnings: {results.warnings}")

    if results.errors == 0 and results.warnings == 0:
        print(f"{GREEN}Configuration validated successfully.{NC}")
    elif results.errors == 0:
        print(f"{YELLOW}Validation completed with warnings.{NC}")
    else:
        print(f"{RED}Validation failed. Address the issues above.{NC}")


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success, 1 for errors).
    """
    # Determine project root (two levels up from this script)
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent
    os.chdir(project_root)

    results = ValidationResults()
    config_file = project_root / ".env.local"

    info("Vibecode WebGUI configuration validator")

    # Run all validations
    validate_env_file(project_root, config_file, results)
    validate_datadog_config(config_file, results)
    validate_database_config(config_file, results)
    validate_redis_config(config_file, results)
    validate_project_tooling(project_root, results)

    print_summary(results)

    return 1 if results.errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
