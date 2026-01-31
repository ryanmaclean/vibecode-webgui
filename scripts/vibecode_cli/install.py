#!/usr/bin/env python3
"""Vibecode WebGUI - Local installation helper.

Bootstraps development prerequisites, env files, and optional setup routines.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from . import COLORS, err, get_project_root, is_root_user, log, ok, run_command, warn, which


MIN_NODE_MAJOR = 18
MIN_NODE_MINOR = 18


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Prepares a local Vibecode WebGUI development environment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
    # Standard install
    python -m vibecode_cli.install

    # Re-run validation without reinstalling dependencies
    python -m vibecode_cli.install --skip-install --skip-setup
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
    return parser.parse_args(argv)


def check_command(cmd: str) -> bool:
    """Check if a command is available and print status."""
    if which(cmd):
        ok(f"{cmd} available")
        return True
    err(f"Missing dependency: {cmd}")
    print("Install the dependency and re-run this script.")
    return False


def get_node_version() -> tuple[int, int, int] | None:
    """Get Node.js version as (major, minor, patch) tuple."""
    try:
        result = run_command(["node", "-v"], capture_output=True, check=True)
        version_str = result.stdout.strip().lstrip("v")
        parts = version_str.split(".")
        return (int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError, IndexError):
        return None


def check_node_version() -> bool:
    """Verify Node.js version meets minimum requirements."""
    version = get_node_version()
    if version is None:
        err("Could not determine Node.js version")
        return False

    major, minor, patch = version
    version_str = f"{major}.{minor}.{patch}"

    if major < MIN_NODE_MAJOR or (major == MIN_NODE_MAJOR and minor < MIN_NODE_MINOR):
        err(f"Node.js {version_str} detected. Require >= {MIN_NODE_MAJOR}.{MIN_NODE_MINOR}.")
        print("Update Node.js and retry.")
        return False

    ok(f"Node.js version {version_str} compatible")
    return True


def ensure_env_files(project_root: Path) -> None:
    """Create .env.local from template if it doesn't exist."""
    env_local = project_root / ".env.local"
    env_template = project_root / "env.development.example"

    if not env_local.exists():
        if env_template.exists():
            shutil.copy(env_template, env_local)
            warn(".env.local created from env.development.example. Review placeholder values.")
        else:
            warn("env.development.example missing. Skipping env bootstrap.")
    else:
        ok(".env.local already present")


def check_prisma_schema(project_root: Path) -> None:
    """Check if Prisma schema exists."""
    schema_path = project_root / "prisma" / "schema.prisma"
    if schema_path.exists():
        ok("Prisma schema detected")
    else:
        warn("Prisma schema not found; skipping database validation")


def run_npm_install(project_root: Path) -> bool:
    """Run npm install."""
    log("Installing npm dependencies...")
    try:
        run_command(["npm", "install"], cwd=project_root, check=True)
        ok("npm install complete")
        return True
    except subprocess.CalledProcessError:
        err("npm install failed")
        return False


def run_npm_setup(project_root: Path) -> bool:
    """Run npm run setup."""
    try:
        run_command(
            ["npm", "run", "setup"],
            cwd=project_root,
            check=True,
            capture_output=True,
        )
        ok("npm run setup completed")
        return True
    except subprocess.CalledProcessError:
        warn("npm run setup exited with non-zero status. Inspect logs above.")
        return False


def run_health_checks(project_root: Path) -> bool:
    """Run npm run check for lint and type checking."""
    log("Running quick health checks...")
    try:
        run_command(
            ["npm", "run", "check"],
            cwd=project_root,
            check=True,
            capture_output=True,
        )
        ok("Lint + type-check passed")
        return True
    except subprocess.CalledProcessError:
        warn("npm run check failed. Review output for details.")
        return False


def confirm_root_execution() -> bool:
    """Prompt user to confirm running as root."""
    print(f"{COLORS.yellow}\u26a0 Running as root is not recommended. Continue? (y/N): {COLORS.reset}", end="")
    try:
        answer = input().strip().lower()
    except EOFError:
        answer = ""
    if answer in ("y", "yes"):
        return True
    print(f"{COLORS.red}Aborting install. Re-run without sudo.{COLORS.reset}")
    return False


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    if is_root_user():
        if not confirm_root_execution():
            return 1

    project_root = get_project_root()
    os.chdir(project_root)

    log("Vibecode WebGUI installer")
    log(f"Project root: {project_root}")

    log("Checking required tooling...")
    if not check_command("node"):
        return 1
    if not check_command("npm"):
        return 1

    if which("docker"):
        ok("docker available")
    else:
        warn("docker not found. Container workflows will be skipped.")

    if not check_node_version():
        return 1

    log("Ensuring env files...")
    ensure_env_files(project_root)

    log("Verifying Prisma schema (optional)...")
    check_prisma_schema(project_root)

    if not args.skip_install:
        if not run_npm_install(project_root):
            return 1
    else:
        warn("Skipping dependency install (--skip-install)")

    if not args.skip_setup:
        run_npm_setup(project_root)
    else:
        warn("Skipping project setup (--skip-setup)")

    run_health_checks(project_root)

    log("Install complete. Next steps:")
    print("  1. Update .env.local with real credentials.")
    print("  2. Start development server via 'npm run dev'.")
    print("  3. Optional: run validation script python -m vibecode_cli.validate_config")

    return 0


if __name__ == "__main__":
    sys.exit(main())
