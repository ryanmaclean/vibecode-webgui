#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Create a persistent Alpine installation on disk for VibeCode.

This allows full package installation and proper virtiofs support.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import log_error, log_section, log_success, log_warn

# Configuration
DISK_SIZE = "20G"


def get_paths() -> dict[str, Path]:
    """Get all relevant paths."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    return {
        "vm_dir": vm_dir,
        "kernel_dir": vm_dir / "kernel",
        "disk_dir": vm_dir / "disk",
        "disk_image": vm_dir / "disk" / "alpine-system.img",
        "cloud_init_dir": vm_dir / "cloud-init",
    }


def create_disk_image(disk_image: Path, disk_size: str, force: bool = False) -> bool:
    """Create the disk image file.

    Args:
        disk_image: Path to the disk image file
        disk_size: Size of the disk (e.g., "20G")
        force: If True, overwrite existing disk without prompting

    Returns:
        True if disk was created, False if aborted
    """
    disk_image.parent.mkdir(parents=True, exist_ok=True)

    if disk_image.exists():
        if not force:
            log_warn(f"Disk image already exists: {disk_image}")
            response = input("Delete and recreate? (y/N): ").strip().lower()
            if response != "y":
                print("Aborted")
                return False
        disk_image.unlink()

    print(f"📀 Creating {disk_size} disk image...")

    if shutil.which("qemu-img"):
        subprocess.run(
            ["qemu-img", "create", "-f", "raw", str(disk_image), disk_size],
            check=True,
        )
    else:
        # Parse size string (e.g., "20G" -> bytes)
        size_map = {"K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4}
        if disk_size[-1].upper() in size_map:
            size_bytes = int(disk_size[:-1]) * size_map[disk_size[-1].upper()]
        else:
            size_bytes = int(disk_size)

        # Create sparse file
        with open(disk_image, "wb") as f:
            f.seek(size_bytes - 1)
            f.write(b"\0")

    log_success(f"Created: {disk_image}")
    return True


def print_next_steps() -> None:
    """Print instructions for next steps."""
    log_section("Next Steps")
    print()
    print("1. Boot Alpine installer:")
    print("   Use 04-launch-alpine-vm.sh to boot from ISO/initramfs")
    print()
    print("2. In the VM, run Alpine setup:")
    print("   setup-alpine")
    print("   - Choose keyboard layout")
    print("   - Set hostname: vibecode-alpine")
    print("   - Initialize network: dhcp")
    print("   - Set root password")
    print("   - Set timezone")
    print("   - Install to disk: /dev/vda (sys mode)")
    print()
    print("3. After installation, update launch script to boot from disk")
    print()
    print("Alternative: Use pre-configured approach")
    print("This creates an Alpine cloud-init disk with:")
    print("  - Automatic virtiofs kernel module loading")
    print("  - Pre-installed packages (postgres, redis, build tools)")
    print("  - Auto-mount of /mnt/vibecode")
    print()


def create_cloud_init_config(cloud_init_dir: Path) -> None:
    """Create cloud-init configuration files."""
    print()
    print("📝 Creating cloud-init configuration...")

    cloud_init_dir.mkdir(parents=True, exist_ok=True)

    # Create meta-data
    meta_data = dedent("""\
        instance-id: vibecode-alpine-001
        local-hostname: vibecode-alpine
    """)
    (cloud_init_dir / "meta-data").write_text(meta_data)

    # Create user-data with full setup
    user_data = dedent("""\
        #cloud-config

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
    """)
    (cloud_init_dir / "user-data").write_text(user_data)

    log_success("Cloud-init configuration created")
    print()
    print("Files created:")
    print(f"  - {cloud_init_dir / 'meta-data'}")
    print(f"  - {cloud_init_dir / 'user-data'}")
    print()
    log_warn("Note: Cloud-init requires Alpine Linux cloud image")
    print("    Regular Alpine ISO doesn't include cloud-init")
    print()
    print("Alternative approach:")
    print("  Use scripts/vfkit/08-setup-from-iso.sh for manual installation")
    print()


def main() -> int:
    """Main entry point."""
    log_section("Creating Persistent Alpine VM Disk")
    print()

    paths = get_paths()

    if not create_disk_image(paths["disk_image"], DISK_SIZE):
        return 1

    print()
    print_next_steps()

    # Ask if user wants to create cloud-init config
    response = input("Create cloud-init configuration for automated setup? (Y/n): ").strip().lower()
    if response == "n":
        print("Skipping cloud-init setup")
        return 0

    create_cloud_init_config(paths["cloud_init_dir"])
    return 0


if __name__ == "__main__":
    sys.exit(main())