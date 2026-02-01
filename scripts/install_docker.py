#!/usr/bin/env python3
"""Docker Installation Helper.

Checks if Docker is installed and running, provides installation options.
"""

from __future__ import annotations

import shutil
import subprocess
import sys


def check_docker_installed() -> bool:
    """Check if Docker is installed.

    Returns:
        True if docker command is available.
    """
    return shutil.which("docker") is not None


def get_docker_version() -> str | None:
    """Get the installed Docker version.

    Returns:
        Version string or None if unable to get version.
    """
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass
    return None


def check_docker_daemon_running() -> bool:
    """Check if Docker daemon is running.

    Returns:
        True if daemon is accessible.
    """
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def check_homebrew_installed() -> bool:
    """Check if Homebrew is installed.

    Returns:
        True if brew command is available.
    """
    return shutil.which("brew") is not None


def install_docker_via_homebrew() -> int:
    """Install Docker Desktop via Homebrew.

    Returns:
        Exit code from brew install command.
    """
    print("Installing Docker Desktop via Homebrew...")
    try:
        result = subprocess.run(
            ["brew", "install", "--cask", "docker"],
            timeout=600,  # 10 minutes for download/install
        )
        return result.returncode
    except subprocess.TimeoutExpired:
        print("ERROR: Installation timed out")
        return 1
    except subprocess.SubprocessError as e:
        print(f"ERROR: Installation failed: {e}")
        return 1


def print_installation_options() -> None:
    """Print Docker installation options."""
    print("Docker is not installed. Installation options:")
    print("")
    print("Option 1: Install via Homebrew (recommended for macOS)")
    print("  brew install --cask docker")
    print("")
    print("Option 2: Manual download")
    print("  Download from: https://www.docker.com/products/docker-desktop")
    print("")
    print("After installation:")
    print("  1. Launch Docker Desktop from Applications")
    print("  2. Wait for Docker to start (whale icon in menu bar)")
    print("  3. Run this script again to verify")
    print("")


def print_post_install_instructions() -> None:
    """Print instructions after successful installation."""
    print("")
    print("Docker Desktop installed!")
    print("")
    print("IMPORTANT: You must now:")
    print("  1. Open Docker Desktop from /Applications/Docker.app")
    print("  2. Accept the terms and conditions")
    print("  3. Wait for Docker to start (whale icon in menu bar)")
    print("  4. Then run: bash ~/vibecode-webgui/scripts/rebuild-postgresql-docker.sh")


def prompt_install() -> bool:
    """Prompt user for Homebrew installation.

    Returns:
        True if user wants to install.
    """
    try:
        response = input("Install Docker via Homebrew now? (y/N): ")
        return response.strip().lower() in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        print("")
        return False


def run_install_docker(interactive: bool = True) -> int:
    """Run the Docker installation helper.

    Args:
        interactive: Whether to prompt for installation.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    print("=== Docker Installation Helper ===")
    print("")

    # Check if Docker is already installed
    if check_docker_installed():
        print("Docker is already installed!")
        version = get_docker_version()
        if version:
            print(version)

        if check_docker_daemon_running():
            print("Docker daemon is running")
            return 0
        else:
            print("")
            print("Docker is installed but daemon is not running")
            print("Please start Docker Desktop from /Applications/Docker.app")
            return 1

    # Docker not installed - show options
    print_installation_options()

    if not interactive:
        return 1

    if prompt_install():
        if check_homebrew_installed():
            exit_code = install_docker_via_homebrew()
            if exit_code == 0:
                print_post_install_instructions()
            return exit_code
        else:
            print("ERROR: Homebrew not found")
            print("Install Homebrew first from: https://brew.sh")
            print("Or download Docker Desktop manually")
            return 1
    else:
        print("Installation cancelled")
        print("Install Docker manually from: https://www.docker.com/products/docker-desktop")
        return 1


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    return run_install_docker(interactive=True)


if __name__ == "__main__":
    sys.exit(main())
