#!/usr/bin/env python3
"""Testing and Validation.

Usage: ./vibecode test [subcommand] [options]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def print_status(msg: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")


def print_success(msg: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}")


def print_error(msg: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def run_command(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(cmd, cwd=cwd, check=check, text=True)


def get_docker_dir() -> Path:
    """Get the docker directory path."""
    script_dir = Path(__file__).parent.resolve()
    # Navigate from scripts/consolidated/test to project root, then to docker
    project_root = script_dir.parent.parent.parent
    return project_root / "docker"


def run_unit_tests(watch: bool = False, ci_mode: bool = False) -> None:
    """Run unit tests."""
    print_status("Running unit tests...")

    if watch:
        run_command(["npm", "run", "test:watch"])
    elif ci_mode:
        run_command(["npm", "run", "test:ci"])
    else:
        run_command(["npm", "test"])

    print_success("Unit tests completed!")


def run_integration_tests() -> None:
    """Run integration tests."""
    print_status("Running integration tests...")

    docker_dir = get_docker_dir()

    # Start test services
    run_command(
        ["docker-compose", "-f", "docker-compose.test.yml", "up", "-d"],
        cwd=docker_dir,
    )

    # Wait for services to be ready
    time.sleep(10)

    try:
        # Run integration tests
        run_command(["npm", "run", "test:integration"])
    finally:
        # Cleanup
        run_command(
            ["docker-compose", "-f", "docker-compose.test.yml", "down"],
            cwd=docker_dir,
        )

    print_success("Integration tests completed!")


def run_e2e_tests() -> None:
    """Run end-to-end tests."""
    print_status("Running end-to-end tests...")

    docker_dir = get_docker_dir()

    # Start full environment
    run_command(
        ["docker-compose", "-f", "docker-compose.prod.yml", "up", "-d"],
        cwd=docker_dir,
    )

    # Wait for services
    time.sleep(15)

    try:
        # Run E2E tests
        run_command(["npm", "run", "test:e2e"])
    finally:
        # Cleanup
        run_command(
            ["docker-compose", "-f", "docker-compose.prod.yml", "down"],
            cwd=docker_dir,
        )

    print_success("E2E tests completed!")


def run_all_tests() -> None:
    """Run all tests."""
    print_status("Running all tests...")

    docker_dir = get_docker_dir()

    # Run unit tests
    run_command(["npm", "test"])

    # Run integration tests
    run_command(
        ["docker-compose", "-f", "docker-compose.test.yml", "up", "-d"],
        cwd=docker_dir,
    )
    time.sleep(10)

    try:
        run_command(["npm", "run", "test:integration"])
    finally:
        run_command(
            ["docker-compose", "-f", "docker-compose.test.yml", "down"],
            cwd=docker_dir,
        )

    # Run E2E tests
    run_command(
        ["docker-compose", "-f", "docker-compose.prod.yml", "up", "-d"],
        cwd=docker_dir,
    )
    time.sleep(15)

    try:
        run_command(["npm", "run", "test:e2e"])
    finally:
        run_command(
            ["docker-compose", "-f", "docker-compose.prod.yml", "down"],
            cwd=docker_dir,
        )

    print_success("All tests completed!")


def run_coverage_tests() -> None:
    """Run tests with coverage."""
    print_status("Running tests with coverage...")

    run_command(["npm", "run", "test:coverage"])

    print_success("Coverage tests completed!")


def run_performance_tests() -> None:
    """Run performance tests."""
    print_status("Running performance tests...")

    docker_dir = get_docker_dir()

    # Start performance test environment
    run_command(
        ["docker-compose", "-f", "docker-compose.prod.yml", "up", "-d"],
        cwd=docker_dir,
    )

    # Wait for services
    time.sleep(15)

    try:
        # Run performance tests
        run_command(["npm", "run", "test:performance"])
    finally:
        # Cleanup
        run_command(
            ["docker-compose", "-f", "docker-compose.prod.yml", "down"],
            cwd=docker_dir,
        )

    print_success("Performance tests completed!")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Testing and Validation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "subcommand",
        nargs="?",
        choices=["unit", "integration", "e2e", "all", "coverage", "performance"],
        help="Test subcommand to run",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Run tests in watch mode (unit tests only)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="Run in CI mode (unit tests only)",
    )

    args = parser.parse_args()

    if not args.subcommand:
        parser.print_help()
        print("\nAvailable subcommands: unit, integration, e2e, all, coverage, performance")
        return 1

    try:
        if args.subcommand == "unit":
            run_unit_tests(watch=args.watch, ci_mode=args.ci)
        elif args.subcommand == "integration":
            run_integration_tests()
        elif args.subcommand == "e2e":
            run_e2e_tests()
        elif args.subcommand == "all":
            run_all_tests()
        elif args.subcommand == "coverage":
            run_coverage_tests()
        elif args.subcommand == "performance":
            run_performance_tests()
        else:
            print_error(f"Unknown subcommand: {args.subcommand}")
            print("Available subcommands: unit, integration, e2e, all, coverage, performance")
            return 1
    except subprocess.CalledProcessError as e:
        print_error(f"Command failed with exit code {e.returncode}")
        return e.returncode

    return 0


if __name__ == "__main__":
    sys.exit(main())
