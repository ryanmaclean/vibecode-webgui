#!/usr/bin/env python3
"""Vibecode WebGUI - Local installation helper.

Bootstraps development prerequisites, env files, and optional setup routines.
"""

import argparse
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
class InstallConfig:
    """Configuration for the installer."""

    skip_install: bool = False
    skip_setup: bool = False
    project_root: Path | None = None


def log(message: str) -> None:
    """Print an info message."""
    print(f"{Color.BLUE}{message}{Color.NC}")


def ok(message: str) -> None:
    """Print a success message."""
    print(f"{Color.GREEN}\u2713 {message}{Color.NC}")


def warn(message: str) -> None:
    """Print a warning message."""
    print(f"{Color.YELLOW}\u26a0 {message}{Color.NC}")


def err(message: str) -> None:
    """Print an error message."""
    print(f"{Color.RED}\u2717 {message}{Color.NC}")


def check_command(name: str, required: bool = True) -> bool:
    """Check if a command is available.

    Args:
        name: The command name to check.
        required: If True, exit on missing command.

    Returns:
        True if command exists, False otherwise.
    """
    if shutil.which(name) is None:
        if required:
            err(f"Missing dependency: {name}")
            print("Install the dependency and re-run this script.")
            sys.exit(1)
        return False
    ok(f"{name} available")
    return True


def get_node_version() -> tuple[int, int, int]:
    """Get the installed Node.js version.

    Returns:
        Tuple of (major, minor, patch) version numbers.
    """
    result = subprocess.run(
        ["node", "-v"],
        capture_output=True,
        text=True,
        check=True,
    )
    version_str = result.stdout.strip().lstrip("v")
    parts = version_str.split(".")
    return (
        int(parts[0]) if len(parts) > 0 else 0,
        int(parts[1]) if len(parts) > 1 else 0,
        int(parts[2]) if len(parts) > 2 else 0,
    )


def check_node_version(min_major: int = 18, min_minor: int = 18) -> None:
    """Check that Node.js version meets minimum requirements.

    Args:
        min_major: Minimum major version required.
        min_minor: Minimum minor version required.
    """
    major, minor, patch = get_node_version()
    version_str = f"{major}.{minor}.{patch}"

    if major < min_major or (major == min_major and minor < min_minor):
        err(f"Node.js {version_str} detected. Require >= {min_major}.{min_minor}.")
        print("Update Node.js and retry.")
        sys.exit(1)

    ok(f"Node.js version {version_str} compatible")


def check_running_as_root() -> None:
    """Check if running as root and warn user."""
    if os.geteuid() == 0:
        print(
            f"{Color.YELLOW}\u26a0 Running as root is not recommended. "
            f"Continue? (y/N): {Color.NC}",
            end="",
        )
        answer = input().strip().lower()
        if answer not in ("y", "yes"):
            print(f"{Color.RED}Aborting install. Re-run without sudo.{Color.NC}")
            sys.exit(1)


def ensure_env_files(project_root: Path) -> None:
    """Ensure environment files are set up.

    Args:
        project_root: Path to the project root directory.
    """
    log("Ensuring env files...")
    env_local = project_root / ".env.local"
    env_example = project_root / "env.development.example"

    if not env_local.exists():
        if env_example.exists():
            shutil.copy(env_example, env_local)
            warn(".env.local created from env.development.example. Review placeholder values.")
        else:
            warn("env.development.example missing. Skipping env bootstrap.")
    else:
        ok(".env.local already present")


def check_prisma_schema(project_root: Path) -> None:
    """Check for Prisma schema file.

    Args:
        project_root: Path to the project root directory.
    """
    log("Verifying Prisma schema (optional)...")
    schema_path = project_root / "prisma" / "schema.prisma"

    if schema_path.exists():
        ok("Prisma schema detected")
    else:
        warn("Prisma schema not found; skipping database validation")


def run_npm_install(project_root: Path) -> None:
    """Run npm install.

    Args:
        project_root: Path to the project root directory.
    """
    log("Installing npm dependencies...")
    subprocess.run(["npm", "install"], cwd=project_root, check=True)
    ok("npm install complete")


def run_npm_setup(project_root: Path) -> None:
    """Run npm run setup.

    Args:
        project_root: Path to the project root directory.
    """
    result = subprocess.run(
        ["npm", "run", "setup"],
        cwd=project_root,
        capture_output=True,
    )
    if result.returncode == 0:
        ok("npm run setup completed")
    else:
        warn("npm run setup exited with non-zero status. Inspect logs above.")


def run_health_checks(project_root: Path) -> None:
    """Run quick health checks.

    Args:
        project_root: Path to the project root directory.
    """
    log("Running quick health checks...")
    result = subprocess.run(
        ["npm", "run", "check"],
        cwd=project_root,
        capture_output=True,
    )
    if result.returncode == 0:
        ok("Lint + type-check passed")
    else:
        warn("npm run check failed. Review output for details.")


def print_next_steps() -> None:
    """Print next steps for the user."""
    log("Install complete. Next steps:")
    print("  1. Update .env.local with real credentials.")
    print("  2. Start development server via 'npm run dev'.")
    print("  3. Optional: run validation script scripts/vibecode-cli/validate-config.sh")


def parse_args() -> InstallConfig:
    """Parse command line arguments.

    Returns:
        InstallConfig with parsed options.
    """
    parser = argparse.ArgumentParser(
        description="Prepares a local Vibecode WebGUI development environment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
    # Standard install
    scripts/vibecode-cli/install.py

    # Re-run validation without reinstalling dependencies
    scripts/vibecode-cli/install.py --skip-install --skip-setup
""",
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Skip package installation (npm install)",
    )
    parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip project setup script (npm run setup)",
    )

    args = parser.parse_args()
    return InstallConfig(
        skip_install=args.skip_install,
        skip_setup=args.skip_setup,
    )


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success).
    """
    config = parse_args()

    # Check if running as root
    check_running_as_root()

    # Determine project root
    script_path = Path(__file__).resolve()
    project_root = (script_path.parent / "../..").resolve()
    os.chdir(project_root)

    log("Vibecode WebGUI installer")
    log(f"Project root: {project_root}")

    # Check required tooling
    log("Checking required tooling...")
    check_command("node", required=True)
    check_command("npm", required=True)

    # Docker is optional
    if shutil.which("docker"):
        ok("docker available")
    else:
        warn("docker not found. Container workflows will be skipped.")

    # Check Node.js version
    check_node_version(min_major=18, min_minor=18)

    # Ensure env files
    ensure_env_files(project_root)

    # Check Prisma schema
    check_prisma_schema(project_root)

    # Install dependencies
    if not config.skip_install:
        run_npm_install(project_root)
    else:
        warn("Skipping dependency install (--skip-install)")

    # Run setup
    if not config.skip_setup:
        run_npm_setup(project_root)
    else:
        warn("Skipping project setup (--skip-setup)")

    # Health checks
    run_health_checks(project_root)

    # Print next steps
    print_next_steps()

    return 0


if __name__ == "__main__":
    sys.exit(main())
