#!/usr/bin/env python3
"""Configure LX-Branded Zone for VibeCode.

Sets up Debian-compatible zone with ZFS datasets and networking
on OpenIndiana.
"""

import argparse
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class ZoneConfig:
    """Configuration for the LX zone."""

    name: str = "vibecode-zone"
    vnic: str = "vibecode0"
    cpus: int = 4
    memory: str = "8G"
    swap: str = "10G"
    debian_image_url: str = field(default_factory=lambda: (
        "https://us-central.manta.mnx.io/Joyent_Dev/public/"
        "lx-debian-11/lx-debian-11-latest.zss.gz"
    ))
    debian_image: str = "lx-debian-11-latest.zss"
    resolvers: str = "8.8.8.8,8.8.4.4"
    dns_domain: str = "local"

    @property
    def zone_path(self) -> str:
        """Get the zone path."""
        return f"/zones/{self.name}"

    @property
    def zfs_base(self) -> str:
        """Get the base ZFS dataset path."""
        return f"rpool/zones/{self.name}"


def log_info(message: str) -> None:
    """Log an info message."""
    print(f"{GREEN}[INFO]{NC} {message}")


def log_warn(message: str) -> None:
    """Log a warning message."""
    print(f"{YELLOW}[WARN]{NC} {message}")


def log_error(message: str) -> None:
    """Log an error message."""
    print(f"{RED}[ERROR]{NC} {message}")


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
    input_text: Optional[str] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, log errors on failure.
        capture: If True, capture output.
        input_text: Optional input to send to command.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            input=input_text
        )
        if check and result.returncode != 0 and capture:
            log_error(f"Command failed: {' '.join(cmd)}")
            if result.stderr:
                log_error(result.stderr)
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def check_root() -> bool:
    """Check if running as root.

    Returns:
        True if running as root.
    """
    if os.geteuid() != 0:
        log_error("This script must be run as root")
        return False
    return True


def update_system() -> bool:
    """Update OpenIndiana packages.

    Returns:
        True if update succeeded or was skipped.
    """
    log_info("Updating OpenIndiana base system...")
    rc, _, _ = run_command(["pkg", "update", "-v"], check=False)
    if rc != 0:
        log_warn("Package update failed, continuing...")
    return True


def install_lx_brand() -> bool:
    """Install lx-branded zone support.

    Returns:
        True if installation succeeded.
    """
    log_info("Installing lx-branded zone support...")

    # Check if already installed
    rc, _, _ = run_command(["pkg", "list", "brand/lx"], check=False)
    if rc == 0:
        log_info("lx-branded zone already installed")
        return True

    # Install package
    rc, _, _ = run_command(["pkg", "install", "-v", "brand/lx"])
    if rc != 0:
        log_error("Failed to install lx-branded zone")
        return False

    # Verify installation
    rc, _, _ = run_command(["pkg", "list", "brand/lx"], check=False)
    if rc != 0:
        log_error("Failed to verify lx-branded zone installation")
        return False

    log_info("lx-branded zone installed successfully")
    return True


def download_debian_image(config: ZoneConfig, force: bool = False) -> bool:
    """Download Debian image for lx zone.

    Args:
        config: Zone configuration.
        force: Force re-download if image exists.

    Returns:
        True if image is available.
    """
    log_info("Downloading Debian 11 image for lx zone...")

    image_path = Path(config.debian_image)
    gz_path = Path(f"{config.debian_image}.gz")

    if image_path.exists() and not force:
        log_info(f"Debian image already exists: {config.debian_image}")
        return True

    # Download compressed image if needed
    if not gz_path.exists():
        log_info(f"Downloading from: {config.debian_image_url}")
        rc, _, _ = run_command([
            "curl", "-L", "-o", str(gz_path), config.debian_image_url
        ])
        if rc != 0:
            log_error("Failed to download Debian image")
            return False

    # Decompress
    log_info("Decompressing image...")
    rc, _, _ = run_command(["gunzip", str(gz_path)])
    if rc != 0:
        log_error("Failed to decompress image")
        return False

    log_info(f"Debian image ready: {config.debian_image}")
    return True


def detect_network() -> Optional[str]:
    """Detect primary network interface.

    Returns:
        Primary NIC name or None.
    """
    log_info("Detecting primary network interface...")

    rc, stdout, _ = run_command([
        "dladm", "show-phys", "-p", "-o", "LINK"
    ])

    if rc != 0 or not stdout.strip():
        log_error("No network interface found")
        return None

    primary_nic = stdout.strip().split('\n')[0]
    log_info(f"Primary NIC: {primary_nic}")
    return primary_nic


def create_vnic(config: ZoneConfig, primary_nic: str) -> bool:
    """Create VNIC for zone.

    Args:
        config: Zone configuration.
        primary_nic: Primary network interface.

    Returns:
        True if VNIC was created.
    """
    log_info(f"Creating VNIC: {config.vnic}")

    # Check if VNIC already exists
    rc, _, _ = run_command(
        ["dladm", "show-vnic", config.vnic],
        check=False
    )
    if rc == 0:
        log_warn(f"VNIC {config.vnic} already exists, removing...")
        run_command(["dladm", "delete-vnic", config.vnic])

    # Create VNIC with bandwidth limit
    rc, _, _ = run_command([
        "dladm", "create-vnic",
        "-l", primary_nic,
        "-p", "maxbw=1000",
        config.vnic
    ])

    if rc != 0:
        log_error("Failed to create VNIC")
        return False

    # Verify creation
    run_command(["dladm", "show-vnic", config.vnic], capture=False)

    log_info("VNIC created successfully")
    return True


def create_zfs_datasets(config: ZoneConfig) -> bool:
    """Create ZFS datasets for zone.

    Args:
        config: Zone configuration.

    Returns:
        True if datasets were created.
    """
    log_info("Creating ZFS datasets for zone...")

    # Create base zones dataset if needed
    rc, _, _ = run_command(["zfs", "list", "rpool/zones"], check=False)
    if rc != 0:
        run_command([
            "zfs", "create",
            "-o", "mountpoint=/zones",
            "rpool/zones"
        ])

    # Create zone dataset
    rc, _, _ = run_command(["zfs", "list", config.zfs_base], check=False)
    if rc == 0:
        log_warn("Zone dataset already exists")
    else:
        run_command(["zfs", "create", config.zfs_base])

    log_info("Creating optimized datasets...")

    # PostgreSQL dataset (optimized for small random I/O)
    postgres_ds = f"{config.zfs_base}/postgres"
    rc, _, _ = run_command(["zfs", "list", postgres_ds], check=False)
    if rc != 0:
        run_command(["zfs", "create", postgres_ds])
        run_command(["zfs", "set", "recordsize=8K", postgres_ds])
        run_command(["zfs", "set", "logbias=latency", postgres_ds])
        run_command(["zfs", "set", "primarycache=metadata", postgres_ds])

    # Redis dataset (optimized for fast access)
    redis_ds = f"{config.zfs_base}/redis"
    rc, _, _ = run_command(["zfs", "list", redis_ds], check=False)
    if rc != 0:
        run_command(["zfs", "create", redis_ds])
        run_command(["zfs", "set", "recordsize=8K", redis_ds])
        run_command(["zfs", "set", "compression=lz4", redis_ds])

    # Application dataset (compressed, no atime)
    app_ds = f"{config.zfs_base}/app"
    rc, _, _ = run_command(["zfs", "list", app_ds], check=False)
    if rc != 0:
        run_command(["zfs", "create", app_ds])
        run_command(["zfs", "set", "compression=lz4", app_ds])
        run_command(["zfs", "set", "atime=off", app_ds])

    log_info("ZFS datasets created")
    run_command(["zfs", "list"], capture=False)
    return True


def generate_zone_config(config: ZoneConfig) -> str:
    """Generate zone configuration commands.

    Args:
        config: Zone configuration.

    Returns:
        Zone configuration string.
    """
    return f"""create -t lx
set zonepath={config.zone_path}
set autoboot=true
set ip-type=exclusive
add net
set physical={config.vnic}
end
add attr
set name=resolvers
set type=string
set value={config.resolvers}
end
add attr
set name=dns-domain
set type=string
set value={config.dns_domain}
end
add capped-cpu
set ncpus={config.cpus}
end
add capped-memory
set physical={config.memory}
set swap={config.swap}
end
"""


def create_zone_config(config: ZoneConfig) -> bool:
    """Create zone configuration.

    Args:
        config: Zone configuration.

    Returns:
        True if configuration was created.
    """
    log_info("Creating zone configuration...")

    # Check if zone already exists
    rc, stdout, _ = run_command(["zoneadm", "list", "-cp"], check=False)
    if rc == 0 and f"{config.name}:" in stdout:
        log_warn(f"Zone {config.name} already exists, removing...")
        run_command(
            ["zoneadm", "-z", config.name, "halt"],
            check=False
        )
        run_command(
            ["zoneadm", "-z", config.name, "uninstall", "-F"],
            check=False
        )
        run_command(
            ["zonecfg", "-z", config.name, "delete", "-F"],
            check=False
        )

    # Create zone configuration
    zone_cfg = generate_zone_config(config)
    rc, _, _ = run_command(
        ["zonecfg", "-z", config.name],
        input_text=zone_cfg
    )

    if rc != 0:
        log_error("Failed to create zone configuration")
        return False

    log_info("Zone configuration created")
    run_command(["zonecfg", "-z", config.name, "info"], capture=False)
    return True


def install_zone(config: ZoneConfig) -> bool:
    """Install zone from Debian image.

    Args:
        config: Zone configuration.

    Returns:
        True if installation succeeded.
    """
    log_info("Installing zone from Debian image...")

    if not Path(config.debian_image).exists():
        log_error(f"Debian image not found: {config.debian_image}")
        return False

    rc, _, _ = run_command([
        "zoneadm", "-z", config.name,
        "install", "-s", config.debian_image
    ])

    if rc != 0:
        log_error("Failed to install zone")
        return False

    log_info("Zone installed successfully")
    return True


def boot_zone(config: ZoneConfig) -> bool:
    """Boot the zone.

    Args:
        config: Zone configuration.

    Returns:
        True if zone is running.
    """
    log_info(f"Booting zone: {config.name}")

    rc, _, _ = run_command(["zoneadm", "-z", config.name, "boot"])
    if rc != 0:
        log_error("Failed to boot zone")
        return False

    log_info("Waiting for zone to boot...")
    time.sleep(10)

    # Verify zone is running
    rc, stdout, _ = run_command(["zoneadm", "list", "-v"])
    if rc == 0 and config.name in stdout and "running" in stdout:
        log_info("Zone is running")
        return True

    log_error("Zone failed to boot")
    run_command(["zoneadm", "list", "-v"], capture=False)
    return False


def generate_network_config() -> str:
    """Generate network configuration script.

    Returns:
        Network configuration script content.
    """
    return """
# Configure DHCP
cat > /etc/network/interfaces <<NETCONF
auto lo
iface lo inet loopback

auto net0
iface net0 inet dhcp
NETCONF

# Restart networking
systemctl restart networking

# Test connectivity
sleep 5
ping -c 3 8.8.8.8 || echo "Warning: Network connectivity test failed"

# Update package lists
apt update

echo "Zone network configured"
"""


def configure_zone_network(config: ZoneConfig) -> bool:
    """Configure zone networking.

    Args:
        config: Zone configuration.

    Returns:
        True if configuration succeeded.
    """
    log_info("Configuring zone networking...")

    network_script = generate_network_config()
    rc, _, _ = run_command(
        ["zlogin", config.name, "/bin/bash"],
        input_text=network_script
    )

    if rc != 0:
        log_warn("Network configuration may have failed")

    log_info("Zone networking configured")
    return True


def create_snapshot(config: ZoneConfig) -> bool:
    """Create baseline ZFS snapshot.

    Args:
        config: Zone configuration.

    Returns:
        True if snapshot was created.
    """
    log_info("Creating baseline ZFS snapshot...")

    snapshot_name = f"{config.zfs_base}@baseline"
    rc, _, _ = run_command(["zfs", "snapshot", snapshot_name])

    if rc != 0:
        log_warn("Failed to create snapshot")
        return False

    log_info(f"Snapshot created: {snapshot_name}")
    return True


def get_zone_state(config: ZoneConfig) -> str:
    """Get the current zone state.

    Args:
        config: Zone configuration.

    Returns:
        Zone state string.
    """
    rc, stdout, _ = run_command(["zoneadm", "list", "-v"], check=False)
    if rc == 0:
        for line in stdout.strip().split('\n'):
            if config.name in line:
                parts = line.split()
                if len(parts) >= 3:
                    return parts[2]
    return "unknown"


def get_zone_ip(config: ZoneConfig) -> str:
    """Get the zone IP address.

    Args:
        config: Zone configuration.

    Returns:
        IP address or 'Not available yet'.
    """
    rc, stdout, _ = run_command(
        ["zlogin", config.name, "ip", "addr", "show", "net0"],
        check=False
    )
    if rc == 0:
        for line in stdout.split('\n'):
            if "inet " in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    return parts[1]
    return "Not available yet"


def show_zone_info(config: ZoneConfig) -> None:
    """Display zone information.

    Args:
        config: Zone configuration.
    """
    log_info("Zone Configuration Summary")
    print("================================")
    print()
    print(f"Zone Name: {config.name}")
    print(f"Zone Path: {config.zone_path}")
    print(f"Zone State: {get_zone_state(config)}")
    print(f"VNIC: {config.vnic}")
    print()
    print("Resource Limits:")
    print(f"  CPUs: {config.cpus}")
    print(f"  Memory: {config.memory}")
    print(f"  Swap: {config.swap}")
    print()
    print("ZFS Datasets:")
    run_command(["zfs", "list"], capture=False)
    print()
    print("Network Configuration:")
    run_command(["dladm", "show-vnic", config.vnic], capture=False)
    print()
    print(f"Zone IP Address: {get_zone_ip(config)}")
    print()
    print("================================")


def print_completion_message(config: ZoneConfig) -> None:
    """Print completion message with next steps.

    Args:
        config: Zone configuration.
    """
    print(f"""
{GREEN}Zone setup complete!{NC}

Next Steps:
  1. Login to zone:
       zlogin {config.name}

  2. Inside zone, continue setup:
       Run: ./03-install-node24.sh
       Run: ./04-setup-postgres-pgvector.sh
       Run: ./05-deploy-vibecode.sh

Useful Commands:
  - Zone console:  zlogin -C {config.name}  (Ctrl+] to exit)
  - Zone status:   zoneadm list -v
  - Zone reboot:   zoneadm -z {config.name} reboot
  - Zone halt:     zoneadm -z {config.name} halt
  - Zone stats:    zonestat 5 5

Resource Monitoring:
  - CPU/Memory:    prstat -Z
  - Network:       dladm show-vnic -s
  - ZFS:           zpool iostat 5
""")


def main(
    zone_name: Optional[str] = None,
    cpus: Optional[int] = None,
    memory: Optional[str] = None,
    skip_update: bool = False,
    skip_checks: bool = False
) -> int:
    """Main entry point.

    Args:
        zone_name: Zone name.
        cpus: Number of CPUs.
        memory: Memory limit.
        skip_update: Skip system update.
        skip_checks: Skip root check.

    Returns:
        Exit code (0 for success).
    """
    # Create configuration
    config = ZoneConfig()
    if zone_name:
        config.name = zone_name
        config.vnic = f"{zone_name}0"
    if cpus:
        config.cpus = cpus
    if memory:
        config.memory = memory

    log_info("VibeCode LX Zone Configuration")
    log_info("==============================")

    # Check root
    if not skip_checks and not check_root():
        return 1

    # Update system
    if not skip_update:
        update_system()

    # Install lx brand
    if not install_lx_brand():
        return 1

    # Download Debian image
    if not download_debian_image(config):
        return 1

    # Detect network
    primary_nic = detect_network()
    if not primary_nic:
        return 1

    # Create VNIC
    if not create_vnic(config, primary_nic):
        return 1

    # Create ZFS datasets
    if not create_zfs_datasets(config):
        return 1

    # Create zone config
    if not create_zone_config(config):
        return 1

    # Install zone
    if not install_zone(config):
        return 1

    # Boot zone
    if not boot_zone(config):
        return 1

    # Configure networking
    configure_zone_network(config)

    # Create snapshot
    create_snapshot(config)

    # Show info
    show_zone_info(config)

    # Print completion message
    print_completion_message(config)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Configure LX-Branded Zone for VibeCode"
    )
    parser.add_argument(
        '--name',
        dest='zone_name',
        help="Zone name (default: vibecode-zone)"
    )
    parser.add_argument(
        '--cpus',
        type=int,
        help="Number of CPUs (default: 4)"
    )
    parser.add_argument(
        '--memory',
        help="Memory limit (default: 8G)"
    )
    parser.add_argument(
        '--skip-update',
        action='store_true',
        help="Skip system update"
    )
    parser.add_argument(
        '--skip-checks',
        action='store_true',
        help="Skip root check (for testing)"
    )

    args = parser.parse_args()
    sys.exit(main(
        args.zone_name,
        args.cpus,
        args.memory,
        args.skip_update,
        args.skip_checks
    ))
