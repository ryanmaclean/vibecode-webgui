#!/usr/bin/env python3
"""Complete automated OmniOS ARM64 installation.

Starts QEMU with OmniOS ARM64 and automates the installation of
Node.js, code-server, and SSH configuration via telnet.
"""

from __future__ import annotations

import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

# Configuration
OMNIOS_DIR = Path.home() / "Downloads" / "omnios-arm64"
QEMU_LOG = Path("/tmp/qemu-omnios.log")
INSTALL_LOG = Path("/tmp/omnios-install.log")
TELNET_HOST = "127.0.0.1"
TELNET_PORT = 9600


@dataclass
class QEMUConfig:
    """QEMU configuration for OmniOS ARM64."""

    name: str = "omnios-arm64-auto"
    memory: str = "8G"
    cpus: int = 4
    disk_image: str = "omnios-arm64.qcow2"
    bios: str = "/opt/homebrew/share/qemu/edk2-aarch64-code.fd"
    serial_port: int = 9600


def print_step(step: int, message: str) -> None:
    """Print a step message."""
    print(f"Step {step}: {message}")


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}✅ {message}{COLORS.reset}")


def print_info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}   {message}{COLORS.reset}")


def start_qemu(config: QEMUConfig) -> subprocess.Popen:
    """Start QEMU with OmniOS ARM64.

    Args:
        config: QEMU configuration.

    Returns:
        QEMU process handle.
    """
    print_step(1, "Starting QEMU...")

    cmd = [
        "qemu-system-aarch64",
        "-name", config.name,
        "-machine", "type=virt,accel=hvf",
        "-cpu", "host",
        "-m", config.memory,
        "-smp", str(config.cpus),
        "-drive", f"file={config.disk_image},if=virtio,format=qcow2",
        "-device", "virtio-net,netdev=user.0",
        "-netdev", "user,id=user.0",
        "-bios", config.bios,
        "-serial", f"telnet:{TELNET_HOST}:{config.serial_port},server,nowait",
        "-display", "cocoa",
    ]

    with QEMU_LOG.open("w") as log_file:
        process = subprocess.Popen(
            cmd,
            cwd=OMNIOS_DIR,
            stdout=log_file,
            stderr=log_file,
        )

    print_success(f"QEMU started (PID: {process.pid})")
    print_info(f"Serial: telnet://localhost:{config.serial_port}")
    print()

    return process


def wait_for_qemu_ready(seconds: int = 10) -> None:
    """Wait for QEMU to initialize.

    Args:
        seconds: Number of seconds to wait.
    """
    print_step(2, "Waiting for QEMU to initialize...")
    time.sleep(seconds)
    print_success("QEMU ready")
    print()


def get_installation_commands() -> list[tuple[str, int, str]]:
    """Get list of installation commands with delays.

    Returns:
        List of (command, delay_seconds, description) tuples.
    """
    return [
        # Login
        ("root", 5, "Logging in as root"),
        # Configure network
        ("ipadm create-addr -T dhcp net0/v4", 10, "Configuring network"),
        # Refresh packages
        ("pkg refresh", 15, "Refreshing package manager"),
        # Install Node.js
        ("pkg install nodejs", 5, "Installing Node.js (starting)"),
        ("y", 90, "Installing Node.js (confirming)"),
        # Verify Node.js
        ("node --version", 3, "Verifying Node.js"),
        # Install code-server
        ("npm install -g code-server", 180, "Installing code-server"),
        # Create config directory
        ("mkdir -p /root/.config/code-server", 2, "Creating config directory"),
        # Create config file (multiline)
        ("cat > /root/.config/code-server/config.yaml << 'EOF'", 1, "Creating config file"),
        ("bind-addr: 0.0.0.0:8080", 1, None),
        ("auth: password", 1, None),
        ("password: omnios-dev-2025", 1, None),
        ("cert: false", 1, None),
        ("EOF", 3, "Config file created"),
        # Enable SSH
        ("svcadm enable ssh", 3, "Enabling SSH"),
        # Set root password
        ("echo 'root:omnios123' | chpasswd", 2, "Setting root password"),
        # Start code-server
        ("nohup code-server > /var/log/code-server.log 2>&1 &", 5, "Starting code-server"),
        # Verify
        ("ps aux | grep code-server | grep -v grep", 2, "Verifying code-server"),
        # Show config
        ("cat /root/.config/code-server/config.yaml", 2, "Showing config"),
        # Show IP
        ("ifconfig net0 | grep inet", 2, "Showing IP address"),
    ]


def send_installation_commands(log_file: Path) -> None:
    """Send installation commands via telnet.

    Args:
        log_file: Path to log file for output.
    """
    # Wait for boot
    time.sleep(30)

    commands = get_installation_commands()

    try:
        with socket.create_connection((TELNET_HOST, TELNET_PORT), timeout=10) as sock:
            with log_file.open("w") as log:
                for cmd, delay, description in commands:
                    if description:
                        log.write(f"# {description}\n")
                        log.flush()

                    # Send command
                    sock.sendall(f"{cmd}\n".encode())
                    log.write(f"> {cmd}\n")
                    log.flush()

                    # Wait for command to complete
                    time.sleep(delay)

                    # Try to read any output
                    sock.setblocking(False)
                    try:
                        data = sock.recv(4096)
                        if data:
                            log.write(data.decode(errors="replace"))
                            log.flush()
                    except BlockingIOError:
                        pass
                    sock.setblocking(True)

                log.write("\n==========================================\n")
                log.write("INSTALLATION COMPLETE!\n")
                log.write("==========================================\n")

    except (socket.error, OSError) as e:
        with log_file.open("a") as log:
            log.write(f"\nError: {e}\n")


def run_installation_async(log_file: Path) -> subprocess.Popen:
    """Run installation commands in a subprocess.

    Args:
        log_file: Path to log file.

    Returns:
        Installation process handle.
    """
    print_step(3, "Sending automated installation commands...")
    print_info("This will take ~3-5 minutes")
    print()

    # Create a Python script to run the installation
    install_script = dedent(f'''
        import socket
        import time
        import sys
        sys.path.insert(0, "{Path(__file__).parent}")
        from full_auto_install import send_installation_commands
        from pathlib import Path
        send_installation_commands(Path("{log_file}"))
    ''')

    process = subprocess.Popen(
        [sys.executable, "-c", install_script],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print_success(f"Installation script running (PID: {process.pid})")
    print()

    return process


def print_monitoring_info(qemu_pid: int, install_pid: int) -> None:
    """Print monitoring and access information.

    Args:
        qemu_pid: QEMU process ID.
        install_pid: Installation process ID.
    """
    print_step(4, "Monitoring installation...")
    print_info(f"Log: tail -f {INSTALL_LOG}")
    print()

    time.sleep(10)

    print("Installation in progress...")
    print()
    print("To monitor:")
    print(f"  tail -f {INSTALL_LOG}")
    print(f"  telnet localhost {TELNET_PORT}")
    print()
    print("Expected completion: ~5 minutes")
    print()
    print("Access after completion:")
    print("  1. Get VM IP from Cocoa window console")
    print("  2. SSH: ssh root@<VM_IP>")
    print("     Password: omnios123")
    print("  3. code-server: http://<VM_IP>:8080")
    print("     Password: omnios-dev-2025")
    print()
    print(f"QEMU PID: {qemu_pid}")
    print(f"Install PID: {install_pid}")
    print()
    print_success("Automated installation started!")


def main() -> int:
    """Main entry point."""
    print("\U0001f680 Starting Automated OmniOS ARM64 Installation")
    print("==============================================")
    print()

    # Check if QEMU is available
    qemu_path = subprocess.run(
        ["which", "qemu-system-aarch64"],
        capture_output=True,
    )
    if qemu_path.returncode != 0:
        print("Error: qemu-system-aarch64 not found")
        print("Install with: brew install qemu")
        return 1

    # Check if OmniOS directory exists
    if not OMNIOS_DIR.exists():
        print(f"Error: OmniOS directory not found: {OMNIOS_DIR}")
        return 1

    config = QEMUConfig()

    # Check if disk image exists
    disk_path = OMNIOS_DIR / config.disk_image
    if not disk_path.exists():
        print(f"Error: Disk image not found: {disk_path}")
        return 1

    # Start QEMU
    qemu_process = start_qemu(config)

    # Wait for QEMU to be ready
    wait_for_qemu_ready()

    # Start installation
    install_process = run_installation_async(INSTALL_LOG)

    # Print monitoring info
    print_monitoring_info(qemu_process.pid, install_process.pid)

    return 0


if __name__ == "__main__":
    sys.exit(main())
