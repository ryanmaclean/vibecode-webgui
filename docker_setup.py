#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Docker Client Setup Script for VibeCode Unified VM.

This script configures your macOS environment to use Docker in the VibeCode VM.
"""

import os
import shutil
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'


def print_success(msg: str) -> None:
    print(f"{Colors.GREEN}✓{Colors.NC} {msg}")


def print_warning(msg: str) -> None:
    print(f"{Colors.YELLOW}⚠{Colors.NC} {msg}")


def print_error(msg: str) -> None:
    print(f"{Colors.RED}✗{Colors.NC} {msg}")


def get_user_input(prompt: str) -> str:
    """Get input from user."""
    try:
        return input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return 'n'


def command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def run_command(cmd: list[str], capture: bool = True) -> tuple[bool, str]:
    """Run a command and return success status and output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=60
        )
        return result.returncode == 0, result.stdout.strip() if capture else ""
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        return False, str(e)


def check_port_open(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is open."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            return result == 0
    except socket.error:
        return False


def detect_shell() -> tuple[str, Path, Path]:
    """Detect the user's shell and return profile paths."""
    shell_name = os.path.basename(os.environ.get('SHELL', '/bin/bash'))
    home = Path.home()

    if shell_name == 'bash':
        profile = home / '.bash_profile'
        rc_file = home / '.bashrc'
    elif shell_name == 'zsh':
        profile = home / '.zshrc'
        rc_file = home / '.zshrc'
    else:
        print_warning(f"Unknown shell: {shell_name}")
        print("Defaulting to .profile")
        profile = home / '.profile'
        rc_file = home / '.profile'

    return shell_name, profile, rc_file


def check_docker_cli() -> Optional[str]:
    """Check if Docker CLI is installed and return version."""
    if command_exists('docker'):
        success, version = run_command(['docker', '--version'])
        return version if success else "unknown"
    return None


def install_docker_cli() -> bool:
    """Install Docker CLI via Homebrew."""
    if not command_exists('brew'):
        print_error("Homebrew not found. Please install Homebrew first:")
        print('  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
        return False

    print("Installing Docker CLI via Homebrew...")
    success, _ = run_command(['brew', 'install', 'docker'], capture=False)
    if success:
        print_success("Docker CLI installed")
        return True
    return False


def configure_docker_host(profile: Path) -> bool:
    """Configure DOCKER_HOST environment variable."""
    docker_host_line = "export DOCKER_HOST=tcp://localhost:2375"
    docker_host_check = "DOCKER_HOST=tcp://localhost:2375"

    # Check if already configured
    if profile.exists():
        content = profile.read_text()
        if docker_host_check in content:
            print_warning(f"DOCKER_HOST already configured in {profile}")
            response = get_user_input("Would you like to skip this step? (y/n) ")
            if response == 'y':
                print("Skipping configuration...")
                return True
            else:
                print("Updating configuration...")
                # Remove old entry and add new
                lines = [line for line in content.splitlines()
                        if docker_host_check not in line]
                content = '\n'.join(lines)
                profile.write_text(content)

    # Add configuration
    with open(profile, 'a') as f:
        f.write('\n')
        f.write('# VibeCode Docker Configuration\n')
        f.write(f'# Added by docker_setup.py on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
        f.write(f'{docker_host_line}\n')

    print_success(f"DOCKER_HOST configured in {profile}")

    # Export for current process
    os.environ['DOCKER_HOST'] = 'tcp://localhost:2375'
    return True


def test_docker_connection() -> bool:
    """Test connection to Docker daemon."""
    success, _ = run_command(['docker', 'version'])
    return success


def test_docker_functionality() -> bool:
    """Test Docker functionality by running a container."""
    print("Pulling alpine:latest image (small test image)...")
    success, _ = run_command(['docker', 'pull', 'alpine:latest'])
    if not success:
        print_warning("Failed to pull alpine image")
        print("This might be a network issue or Docker daemon issue.")
        return False

    print_success("Successfully pulled alpine:latest")

    print("Running test container...")
    success, output = run_command([
        'docker', 'run', '--rm', 'alpine:latest',
        'echo', 'Hello from Docker in VibeCode VM!'
    ])

    if success and 'Hello from Docker' in output:
        print_success("Test container executed successfully")
        print(f"  Output: {output}")
        return True
    else:
        print_warning("Container ran but output unexpected")
        print(f"  Output: {output}")
        return False


def add_docker_aliases(profile: Path) -> None:
    """Add helpful Docker aliases to profile."""
    aliases = '''
# Docker Aliases (added by docker_setup.py)
alias dps='docker ps'
alias dpsa='docker ps -a'
alias di='docker images'
alias dv='docker volume ls'
alias dn='docker network ls'
alias dclean='docker system prune -f'
alias dlogs='docker logs'
alias dexec='docker exec -it'
alias dstop='docker stop $(docker ps -q)'
alias drm='docker rm $(docker ps -aq)'
'''

    with open(profile, 'a') as f:
        f.write(aliases)

    print_success(f"Aliases added to {profile}")
    print()
    print("Available aliases:")
    print("  dps      # docker ps")
    print("  dpsa     # docker ps -a")
    print("  di       # docker images")
    print("  dv       # docker volume ls")
    print("  dn       # docker network ls")
    print("  dclean   # docker system prune -f")
    print("  dlogs    # docker logs")
    print("  dexec    # docker exec -it")
    print("  dstop    # Stop all containers")
    print("  drm      # Remove all containers")


def install_docker_compose() -> None:
    """Install docker-compose if not present."""
    if command_exists('docker-compose'):
        success, version = run_command(['docker-compose', '--version'])
        print_success(f"docker-compose found: {version}")
        return

    print_warning("docker-compose not found")
    response = get_user_input("Would you like to install docker-compose? (y/n) ")

    if response == 'y':
        if command_exists('brew'):
            success, _ = run_command(['brew', 'install', 'docker-compose'], capture=False)
            if success:
                print_success("docker-compose installed")
        else:
            print("Please install via: brew install docker-compose")


def setup_docker() -> int:
    """
    Main setup function for Docker client.

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    print("======================================")
    print("  Docker Client Setup for VibeCode")
    print("======================================")
    print()

    # Detect shell
    shell_name, profile, _ = detect_shell()
    print(f"Detected shell: {shell_name}")
    print(f"Profile file: {profile}")
    print()

    # Step 1: Check Docker CLI
    print("Step 1: Checking for Docker CLI...")
    docker_version = check_docker_cli()
    if docker_version:
        print_success(f"Docker CLI found: {docker_version}")
    else:
        print_error("Docker CLI not found")
        print()
        response = get_user_input("Would you like to install Docker CLI? (y/n) ")
        if response == 'y':
            if not install_docker_cli():
                return 1
        else:
            print()
            print("You can install Docker CLI later with:")
            print("  brew install docker")
            print()
            print("Note: You don't need Docker Desktop, just the CLI is enough.")
            return 0
    print()

    # Step 2: Check if VM is running
    print("Step 2: Checking if VibeCode VM is running...")
    if check_port_open('localhost', 2375):
        print_success("Docker daemon accessible on localhost:2375")
    else:
        print_warning("Docker daemon not accessible on localhost:2375")
        print()
        print("Make sure:")
        print("  1. UnifiedServicesVibeCodeApp is running")
        print("  2. VM has finished booting (wait 30-60 seconds after launch)")
        print("  3. Docker service started successfully inside VM")
        print()
        response = get_user_input("Continue anyway? (y/n) ")
        if response != 'y':
            return 0
    print()

    # Step 3: Configure DOCKER_HOST
    print("Step 3: Configuring DOCKER_HOST environment variable...")
    if not configure_docker_host(profile):
        return 1
    print()

    # Step 4: Test connection
    print("Step 4: Testing Docker connection...")
    if test_docker_connection():
        print_success("Successfully connected to Docker daemon")
        print()
        print("Docker Server Info:")
        success, output = run_command(['docker', 'version'])
        if success:
            # Print server info
            for line in output.split('\n'):
                if 'Server:' in line or (output.find('Server:') != -1 and
                                          output.split('\n').index(line) > output.split('\n').index('Server:')):
                    print(line)
    else:
        print_error("Failed to connect to Docker daemon")
        print()
        print("Troubleshooting steps:")
        print("  1. Make sure UnifiedServicesVibeCodeApp is running")
        print("  2. Check if port 2375 is accessible: nc -z localhost 2375")
        print("  3. View Docker logs: ssh root@localhost -p 2222 'tail -f /tmp/docker.log'")
        print("     (password: vibecode)")
        return 1
    print()

    # Step 5: Test Docker functionality
    print("Step 5: Testing Docker functionality...")
    test_docker_functionality()
    print()

    # Step 6: Summary
    print("======================================")
    print("  Setup Complete!")
    print("======================================")
    print()
    print("Docker is now configured to use the VibeCode VM.")
    print()
    print("Important notes:")
    print("  • Docker host: tcp://localhost:2375")
    print(f"  • Profile updated: {profile}")
    print("  • Current session: DOCKER_HOST is set")
    print()
    print("To use Docker in a new terminal:")
    print("  1. Open a new terminal (to load the profile)")
    print("  OR")
    print(f"  2. Run: source {profile}")
    print()
    print("Basic Docker commands:")
    print("  docker images          # List images")
    print("  docker ps              # List containers")
    print("  docker pull <image>    # Pull an image")
    print("  docker run <image>     # Run a container")
    print("  docker info            # Show Docker info")
    print()
    print("For more information:")
    print("  • Usage guide: DOCKER_USAGE_GUIDE.md")
    print("  • Troubleshooting: DOCKER_TROUBLESHOOTING.md")
    print()
    print_success("Happy containerizing! 🐳")
    print()

    # Optional: Add aliases
    response = get_user_input("Would you like to add helpful Docker aliases? (y/n) ")
    if response == 'y':
        add_docker_aliases(profile)

    # Optional: Install docker-compose
    print()
    install_docker_compose()

    print()
    print("Setup script completed successfully!")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    try:
        return setup_docker()
    except KeyboardInterrupt:
        print("\nSetup cancelled by user.")
        return 130


if __name__ == "__main__":
    sys.exit(main())