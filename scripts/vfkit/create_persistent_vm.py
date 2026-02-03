#!/usr/bin/env python3
"""Create a persistent Alpine installation on disk for VibeCode.

This allows full package installation and proper virtiofs support.
"""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"

# Cloud-init meta-data template
META_DATA_TEMPLATE = """instance-id: vibecode-alpine-001
local-hostname: vibecode-alpine
"""

# Cloud-init user-data template
USER_DATA_TEMPLATE = """#cloud-config

# Hostname
hostname: vibecode-alpine
fqdn: vibecode-alpine.local

# Users
users:
  - name: vibecode
    gecos: VibeCode Developer
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    groups: wheel
    ssh_authorized_keys:
      - ssh-rsa REPLACE_WITH_YOUR_SSH_KEY

# Root password (disabled by default for security)
chpasswd:
  expire: false

# Package installation
packages:
  - bash
  - git
  - curl
  - wget
  - build-base
  - nodejs
  - npm
  - postgresql
  - postgresql-dev
  - postgresql-contrib
  - redis
  - python3
  - python3-dev
  - py3-pip
  - supervisor
  - ca-certificates
  - openssl

# Run commands on first boot
runcmd:
  # Load virtiofs module
  - modprobe virtiofs || true

  # Create mount point
  - mkdir -p /mnt/vibecode

  # Mount virtiofs share
  - mount -t virtiofs vibecode /mnt/vibecode || echo "Failed to mount virtiofs"

  # Add to fstab for persistence
  - echo "vibecode /mnt/vibecode virtiofs defaults 0 0" >> /etc/fstab

  # Initialize PostgreSQL
  - rc-service postgresql setup
  - rc-update add postgresql default
  - rc-service postgresql start

  # Configure PostgreSQL
  - su postgres -c "createdb vibecode"
  - su postgres -c "createuser vibecode"

  # Start Redis
  - rc-update add redis default
  - rc-service redis start

  # Create startup script
  - |
    cat > /usr/local/bin/start-vibecode << 'SCRIPT'
    #!/bin/bash
    cd /mnt/vibecode
    npm install
    npm run build
    npm start
    SCRIPT
  - chmod +x /usr/local/bin/start-vibecode

write_files:
  - path: /etc/motd
    content: |
      ==========================================
        VibeCode Alpine ARM64 Development VM
      ==========================================

      Project: /mnt/vibecode
      Services: PostgreSQL (5432), Redis (6379)

      Quick Start:
        cd /mnt/vibecode
        npm install
        npm run build
        npm start

      ==========================================

  - path: /etc/postgresql/postgresql.conf
    content: |
      listen_addresses = '*'
      port = 5432
      max_connections = 100
    append: true

  - path: /etc/redis.conf
    content: |
      bind 0.0.0.0
      port 6379
      protected-mode no

power_state:
  mode: reboot
  message: Initial setup complete, rebooting...
  timeout: 30
"""


@dataclass
class VMConfig:
    """VM configuration."""

    vm_dir: Path = field(default_factory=lambda: Path.home() / ".vfkit" / "vms" / "vibecode-alpine")
    disk_size: str = "20G"
    disk_size_mb: int = 20480  # 20GB in MB

    @property
    def kernel_dir(self) -> Path:
        """Get kernel directory path."""
        return self.vm_dir / "kernel"

    @property
    def disk_dir(self) -> Path:
        """Get disk directory path."""
        return self.vm_dir / "disk"

    @property
    def disk_image(self) -> Path:
        """Get disk image path."""
        return self.disk_dir / "alpine-system.img"

    @property
    def cloud_init_dir(self) -> Path:
        """Get cloud-init directory path."""
        return self.vm_dir / "cloud-init"


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}✅ {msg}{NC}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}⚠️  {msg}{NC}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}❌ {msg}{NC}")


def run_command(
    cmd: list[str],
    timeout: int = 300,
    capture: bool = True,
) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="Timeout")
    except subprocess.SubprocessError as e:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(e))


def prompt_yes_no(message: str, default: bool = False) -> bool:
    """Prompt user for yes/no input.

    Args:
        message: Prompt message.
        default: Default value if user just presses enter.

    Returns:
        True for yes, False for no.
    """
    suffix = "(Y/n)" if default else "(y/N)"
    try:
        response = input(f"{message} {suffix}: ").strip().lower()
        if not response:
            return default
        return response in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def check_disk_exists(config: VMConfig) -> bool:
    """Check if disk image already exists.

    Args:
        config: VM configuration.

    Returns:
        True if disk exists.
    """
    return config.disk_image.exists()


def delete_disk(config: VMConfig) -> bool:
    """Delete existing disk image.

    Args:
        config: VM configuration.

    Returns:
        True if deletion successful.
    """
    try:
        config.disk_image.unlink()
        return True
    except OSError:
        return False


def create_disk_with_qemu(config: VMConfig) -> bool:
    """Create disk image using qemu-img.

    Args:
        config: VM configuration.

    Returns:
        True if creation successful.
    """
    result = run_command([
        "qemu-img", "create", "-f", "raw",
        str(config.disk_image), config.disk_size,
    ])
    return result.returncode == 0


def create_disk_with_dd(config: VMConfig) -> bool:
    """Create sparse disk image using dd.

    Args:
        config: VM configuration.

    Returns:
        True if creation successful.
    """
    result = run_command([
        "dd", "if=/dev/zero", f"of={config.disk_image}",
        "bs=1M", "count=0", f"seek={config.disk_size_mb}",
    ])
    return result.returncode == 0


def create_disk_image(config: VMConfig) -> bool:
    """Create the disk image.

    Args:
        config: VM configuration.

    Returns:
        True if creation successful.
    """
    log_info(f"📀 Creating {config.disk_size} disk image...")

    # Create disk directory
    config.disk_dir.mkdir(parents=True, exist_ok=True)

    # Try qemu-img first, fallback to dd
    if shutil.which("qemu-img"):
        success = create_disk_with_qemu(config)
    else:
        success = create_disk_with_dd(config)

    if success and config.disk_image.exists():
        log_success(f"Created: {config.disk_image}")
        return True
    else:
        log_error("Failed to create disk image")
        return False


def print_next_steps() -> None:
    """Print next steps after disk creation."""
    print()
    log_info("=== Next Steps ===")
    print()
    log_info("1. Boot Alpine installer:")
    log_info("   Use 04-launch-alpine-vm.sh to boot from ISO/initramfs")
    print()
    log_info("2. In the VM, run Alpine setup:")
    log_info("   setup-alpine")
    log_info("   - Choose keyboard layout")
    log_info("   - Set hostname: vibecode-alpine")
    log_info("   - Initialize network: dhcp")
    log_info("   - Set root password")
    log_info("   - Set timezone")
    log_info("   - Install to disk: /dev/vda (sys mode)")
    print()
    log_info("3. After installation, update launch script to boot from disk")
    print()
    log_info("Alternative: Use pre-configured approach")
    log_info("This creates an Alpine cloud-init disk with:")
    log_info("  - Automatic virtiofs kernel module loading")
    log_info("  - Pre-installed packages (postgres, redis, build tools)")
    log_info("  - Auto-mount of /mnt/vibecode")
    print()


def create_cloud_init_config(config: VMConfig) -> bool:
    """Create cloud-init configuration files.

    Args:
        config: VM configuration.

    Returns:
        True if creation successful.
    """
    log_info("📝 Creating cloud-init configuration...")

    try:
        # Create cloud-init directory
        config.cloud_init_dir.mkdir(parents=True, exist_ok=True)

        # Create meta-data
        meta_data_path = config.cloud_init_dir / "meta-data"
        meta_data_path.write_text(META_DATA_TEMPLATE)

        # Create user-data
        user_data_path = config.cloud_init_dir / "user-data"
        user_data_path.write_text(USER_DATA_TEMPLATE)

        log_success("Cloud-init configuration created")
        print()
        log_info("Files created:")
        log_info(f"  - {meta_data_path}")
        log_info(f"  - {user_data_path}")
        print()
        log_warning("Note: Cloud-init requires Alpine Linux cloud image")
        log_info("    Regular Alpine ISO doesn't include cloud-init")
        print()
        log_info("Alternative approach:")
        log_info("  Use scripts/vfkit/08-setup-from-iso.sh for manual installation")
        print()

        return True

    except OSError as e:
        log_error(f"Failed to create cloud-init config: {e}")
        return False


def run_create_persistent_vm(
    config: VMConfig | None = None,
    interactive: bool = True,
    force_recreate: bool = False,
    skip_cloud_init: bool = False,
) -> int:
    """Run the persistent VM creation process.

    Args:
        config: VM configuration (uses defaults if None).
        interactive: Whether to prompt for user input.
        force_recreate: Force recreation of disk if exists.
        skip_cloud_init: Skip cloud-init configuration.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = VMConfig()

    log_info("=== Creating Persistent Alpine VM Disk ===")
    print()

    # Check if disk exists
    if check_disk_exists(config):
        log_warning(f"Disk image already exists: {config.disk_image}")

        if interactive and not force_recreate:
            if not prompt_yes_no("Delete and recreate?", default=False):
                log_info("Aborted")
                return 1

        if not delete_disk(config):
            log_error("Failed to delete existing disk")
            return 1

    # Create disk image
    if not create_disk_image(config):
        return 1

    # Print next steps
    print_next_steps()

    # Ask about cloud-init
    if skip_cloud_init:
        log_info("Skipping cloud-init setup")
        return 0

    if interactive:
        if not prompt_yes_no("Create cloud-init configuration for automated setup?", default=True):
            log_info("Skipping cloud-init setup")
            return 0

    # Create cloud-init config
    create_cloud_init_config(config)

    return 0


def main() -> int:
    """Main entry point."""
    return run_create_persistent_vm()


if __name__ == "__main__":
    sys.exit(main())
