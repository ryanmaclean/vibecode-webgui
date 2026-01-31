#!/usr/bin/env python3
"""
Installation script for vibecode CLI.

Usage: python install_vibecode_cli.py [--user]

Options:
    --user    Install to user directory (~/.local/bin) instead of system-wide
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color


def print_success(msg: str) -> None:
    """Print success message in green."""
    print(f"{Colors.GREEN}✓{Colors.NC} {msg}")


def print_warning(msg: str) -> None:
    """Print warning message in yellow."""
    print(f"{Colors.YELLOW}⚠{Colors.NC} {msg}")


def print_error(msg: str) -> None:
    """Print error message in red."""
    print(f"{Colors.RED}✗{Colors.NC} {msg}")


def print_info(msg: str) -> None:
    """Print info message."""
    print(f"→ {msg}")


def command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def run_command(cmd: list[str], capture_output: bool = True) -> Optional[str]:
    """Run a command and return its output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            check=True
        )
        return result.stdout.strip() if capture_output else None
    except subprocess.CalledProcessError:
        return None


def copy_file(src: Path, dest: Path, use_sudo: bool = False) -> bool:
    """Copy a file, optionally using sudo."""
    try:
        if use_sudo:
            subprocess.run(['sudo', 'cp', str(src), str(dest)], check=True)
            subprocess.run(['sudo', 'chmod', '+x', str(dest)], check=True)
        else:
            shutil.copy2(src, dest)
            dest.chmod(0o755)
        return True
    except (subprocess.CalledProcessError, OSError, shutil.Error) as e:
        print_error(f"Failed to copy file: {e}")
        return False


def install_vibecode_cli(user_install: bool = False) -> int:
    """
    Install the vibecode CLI.

    Args:
        user_install: If True, install to user directory instead of system-wide

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    script_dir = Path(__file__).parent.resolve()
    vibecode_script = script_dir / "vibecode"

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  VibeCode CLI Installation")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()

    # Check if vibecode script exists
    if not vibecode_script.exists():
        print_error(f"vibecode script not found: {vibecode_script}")
        return 1

    # Determine installation directories
    if user_install:
        install_dir = Path.home() / ".local" / "bin"
        completion_dir = Path.home() / ".local" / "share" / "bash-completion" / "completions"
        zsh_completion_dir = Path.home() / ".local" / "share" / "zsh" / "site-functions"
        print_info(f"Installing to user directory: {install_dir}")
        use_sudo = False
    else:
        install_dir = Path("/usr/local/bin")
        completion_dir = Path("/usr/local/etc/bash_completion.d")
        zsh_completion_dir = Path("/usr/local/share/zsh/site-functions")
        print_info(f"Installing system-wide to: {install_dir}")
        print_warning("This may require sudo privileges")
        use_sudo = True

    print()

    # Create directories if needed (user install only)
    if user_install:
        install_dir.mkdir(parents=True, exist_ok=True)
        completion_dir.mkdir(parents=True, exist_ok=True)
        zsh_completion_dir.mkdir(parents=True, exist_ok=True)

    # Install main script
    print_info("Installing vibecode CLI...")
    dest_path = install_dir / "vibecode"
    if not copy_file(vibecode_script, dest_path, use_sudo=use_sudo):
        return 1
    print_success(f"Installed vibecode to {dest_path}")

    # Install bash completion
    bash_completion = script_dir / "vibecode-completion.bash"
    if bash_completion.exists():
        print_info("Installing bash completion...")
        if use_sudo and not completion_dir.exists():
            subprocess.run(['sudo', 'mkdir', '-p', str(completion_dir)], check=True)
        completion_dest = completion_dir / "vibecode"
        if copy_file(bash_completion, completion_dest, use_sudo=use_sudo):
            print_success("Installed bash completion")

    # Install zsh completion
    zsh_completion = script_dir / "vibecode-completion.zsh"
    if zsh_completion.exists():
        print_info("Installing zsh completion...")
        if use_sudo and not zsh_completion_dir.exists():
            subprocess.run(['sudo', 'mkdir', '-p', str(zsh_completion_dir)], check=True)
        zsh_dest = zsh_completion_dir / "_vibecode"
        if copy_file(zsh_completion, zsh_dest, use_sudo=use_sudo):
            print_success("Installed zsh completion")

    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print_success("Installation complete!")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()

    # Check if directory is in PATH
    if user_install:
        path_dirs = os.environ.get('PATH', '').split(os.pathsep)
        if str(install_dir) not in path_dirs:
            print_warning(f"Add {install_dir} to your PATH:")
            print()
            print("  For bash, add to ~/.bashrc:")
            print('    export PATH="$HOME/.local/bin:$PATH"')
            print()
            print("  For zsh, add to ~/.zshrc:")
            print('    export PATH="$HOME/.local/bin:$PATH"')
            print()

    # Completion setup instructions
    print("To enable tab completion:")
    print()
    print("For Bash:")
    print("  Add to ~/.bashrc:")
    print(f"    source {completion_dir}/vibecode")
    print()
    print("For Zsh:")
    print("  Completions will work automatically after restarting your shell")
    print("  (or run: compinit)")
    print()

    # Test installation
    print_info("Testing installation...")
    if command_exists("vibecode"):
        print_success("vibecode command is available!")
        print()
        version = run_command(["vibecode", "version"])
        if version:
            print(version)
    else:
        print_warning("vibecode command not found in PATH")
        if user_install:
            print_info(f"You may need to restart your shell or add {install_dir} to PATH")

    print()
    print_info("Quick start:")
    print("  vibecode help      # Show all commands")
    print("  vibecode build     # Build the app")
    print("  vibecode start     # Start VibeCode")
    print("  vibecode status    # Check status")
    print("  vibecode check     # Check services")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Installation script for vibecode CLI"
    )
    parser.add_argument(
        "--user",
        action="store_true",
        help="Install to user directory (~/.local/bin) instead of system-wide"
    )

    args = parser.parse_args()
    return install_vibecode_cli(user_install=args.user)


if __name__ == "__main__":
    sys.exit(main())
