#!/usr/bin/env python3
"""Vibecode WebGUI - Local installation helper.

Bootstraps development prerequisites, env files, and optional setup routines.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
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


def log(msg: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}{msg}{Colors.NC}")


def ok(msg: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}\u2713 {msg}{Colors.NC}")


def warn(msg: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}\u26a0 {msg}{Colors.NC}")


def err(msg: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}\u2717 {msg}{Colors.NC}")


def check_command(cmd: str) -> bool:
    """Check if a command is available."""
    if shutil.which(cmd) is None:
        err(f"Missing dependency: {cmd}")
        print("Install the dependency and re-run this script.")
        return False
    ok(f"{cmd} available")
    return True


def get_node_version() -> tuple[int, int, str]:
    """Get Node.js version as (major, minor, full_version)."""
    result = subprocess.run(
        ["node", "-v"],
        capture_output=True,
        text=True,
        check=True,
    )
    version = result.stdout.strip().lstrip("v")
    parts = version.split(".")
    return int(parts[0]), int(parts[1]), version


def run_npm_command(
    args: list[str],
    cwd: Path,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run an npm command."""
    return subprocess.run(
        ["npm", *args],
        cwd=cwd,
        capture_output=capture,
        text=True,
    )


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Prepares a local Vibecode WebGUI development environment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
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

    # Check if running as root
    if os.getuid() == 0:
        print(
            f"{Colors.YELLOW}\u26a0 Running as root is not recommended. "
            f"Continue? (y/N): {Colors.NC}",
            end="",
        )
        try:
            answer = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = ""

        if answer not in ("y", "yes"):
            print(f"{Colors.RED}Aborting install. Re-run without sudo.{Colors.NC}")
            return 1

    # Determine project root
    script_path = Path(__file__).resolve()
    project_root = script_path.parent.parent.parent
    os.chdir(project_root)

    log("Vibecode WebGUI installer")
    log(f"Project root: {project_root}")

    # Check required tooling
    log("Checking required tooling...")
    if not check_command("node"):
        return 1
    if not check_command("npm"):
        return 1

    # Docker is optional
    if shutil.which("docker"):
        ok("docker available")
    else:
        warn("docker not found. Container workflows will be skipped.")

    # Check Node.js version
    min_major = 18
    min_minor = 18

    try:
        node_major, node_minor, node_version = get_node_version()
    except (subprocess.CalledProcessError, ValueError, IndexError) as e:
        err(f"Failed to get Node.js version: {e}")
        return 1

    if node_major < min_major or (node_major == min_major and node_minor < min_minor):
        err(f"Node.js {node_version} detected. Require >= {min_major}.{min_minor}.")
        print("Update Node.js and retry.")
        return 1

    ok(f"Node.js version {node_version} compatible")

    # Ensure env files
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

    # Verify Prisma schema
    log("Verifying Prisma schema (optional)...")
    prisma_schema = project_root / "prisma" / "schema.prisma"
    if prisma_schema.exists():
        ok("Prisma schema detected")
    else:
        warn("Prisma schema not found; skipping database validation")

    # Install npm dependencies
    if not args.skip_install:
        log("Installing npm dependencies...")
        result = run_npm_command(["install"], cwd=project_root)
        if result.returncode != 0:
            err("npm install failed")
            return 1
        ok("npm install complete")
    else:
        warn("Skipping dependency install (--skip-install)")

    # Run npm setup
    if not args.skip_setup:
        result = run_npm_command(["run", "setup"], cwd=project_root, capture=True)
        if result.returncode == 0:
            ok("npm run setup completed")
        else:
            warn("npm run setup exited with non-zero status. Inspect logs above.")
    else:
        warn("Skipping project setup (--skip-setup)")

    # Run health checks
    log("Running quick health checks...")
    result = run_npm_command(["run", "check"], cwd=project_root, capture=True)
    if result.returncode == 0:
        ok("Lint + type-check passed")
    else:
        warn("npm run check failed. Review output for details.")

    # Print next steps
    log("Install complete. Next steps:")
    print("  1. Update .env.local with real credentials.")
    print("  2. Start development server via 'npm run dev'.")
    print("  3. Optional: run validation script scripts/vibecode-cli/validate-config.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())
