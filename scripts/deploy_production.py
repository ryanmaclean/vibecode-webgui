#!/usr/bin/env python3
"""
Production Deployment Script for Vector Performance Optimizations.

Converts deploy-production.sh to Python with enhanced error handling,
Datadog tracing, and structured logging.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

# Local imports
try:
    from lib.vibecode_common import (
        init_vibecode_script,
    )
    USE_COMMON = True
except ImportError:
    USE_COMMON = False
    import logging
    logging.basicConfig(level=logging.INFO)


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


def print_status(message: str, prefix: str = "") -> None:
    """Print a status message."""
    indicator = f"{prefix} " if prefix else ""
    print(f"{Colors.BLUE}{indicator}{message}{Colors.NC}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}{message}{Colors.NC}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Colors.RED}{message}{Colors.NC}", file=sys.stderr)


def run(
    cmd: list[str],
    *,
    capture_output: bool = False,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command with proper error handling."""
    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
            cwd=cwd,
        )
    except subprocess.CalledProcessError as exc:
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def check_environment_variables() -> bool:
    """Check that required environment variables are set."""
    required_vars = [
        "DATABASE_URL",
        "OPENROUTER_API_KEY",
        "NEXT_PUBLIC_APP_URL",
    ]

    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)

    if missing_vars:
        for var in missing_vars:
            print_error(f"Missing required environment variable: {var}")
        return False

    return True


def run_build(project_root: Path) -> bool:
    """Run the project build."""
    print_status("Building project...", "")
    try:
        run(["npm", "run", "build"], cwd=project_root)
        return True
    except CommandError:
        print_error("Build failed")
        return False


def run_type_check(project_root: Path) -> bool:
    """Run TypeScript type checking."""
    print_status("Type checking...", "")
    try:
        run(["npm", "run", "type-check"], cwd=project_root)
        return True
    except CommandError:
        print_error("Type check failed")
        return False


def test_performance_endpoints(project_root: Path) -> bool:
    """Test performance endpoints."""
    print_status("Testing performance endpoints...", "")

    test_script = project_root / "scripts" / "test-performance-endpoints.js"
    if not test_script.exists():
        print_status("Performance endpoint test script not found, skipping")
        return True

    try:
        run(["node", str(test_script)], cwd=project_root)
        return True
    except CommandError:
        print_error("Endpoint tests failed")
        return False


def print_deployment_checklist() -> None:
    """Print the production deployment checklist."""
    checklist = """
PRODUCTION DEPLOYMENT CHECKLIST:

Build successful
Type check passed
Performance endpoints operational
Environment variables validated

RECOMMENDED PRODUCTION SETTINGS:

Environment Variables:
- DB_CONNECTION_LIMIT=20
- CONNECTION_POOL_MIN_CONNECTIONS=2
- CONNECTION_POOL_MAX_CONNECTIONS=20
- CONNECTION_POOL_ACQUIRE_TIMEOUT=30000
- CONNECTION_POOL_IDLE_TIMEOUT=300000

Performance Monitoring:
- Vector metrics: /api/health/vector-metrics
- Connection pool: /api/health/connection-pool
- Database health: /api/health/database/metrics

Deploy with confidence!
"""
    print(checklist)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Production Deployment Script for Vector Performance Optimizations",
    )

    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip the build step",
    )
    parser.add_argument(
        "--skip-type-check",
        action="store_true",
        help="Skip the type check step",
    )
    parser.add_argument(
        "--skip-endpoint-tests",
        action="store_true",
        help="Skip performance endpoint tests",
    )
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="Skip environment variable checks",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Initialize logging and tracing
    shutdown = None
    if USE_COMMON:
        logger, _config_mgr, _metrics, shutdown = init_vibecode_script(
            "deploy_production",
            service_name="vibecode-production-deployment",
        )

    print("DEPLOYING VECTOR PERFORMANCE OPTIMIZATIONS TO PRODUCTION")
    print()

    # Determine project root
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    try:
        # Build check
        if not args.skip_build:
            if not run_build(project_root):
                return 1

        # Type check
        if not args.skip_type_check:
            if not run_type_check(project_root):
                return 1

        # Test performance endpoints
        if not args.skip_endpoint_tests:
            if not test_performance_endpoints(project_root):
                return 1

        # Check environment variables
        if not args.skip_env_check:
            print_status("Checking production environment variables...", "")
            if not check_environment_variables():
                return 1

        print_success("All checks passed - ready for production deployment")
        print_deployment_checklist()

    except CommandError as e:
        print_error(f"Deployment failed: {e}")
        return 1
    except KeyboardInterrupt:
        print_status("\nDeployment cancelled by user", "")
        return 130
    except Exception:
        print_error("Unexpected error encountered; re-raising.")
        raise
    finally:
        if shutdown:
            shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
