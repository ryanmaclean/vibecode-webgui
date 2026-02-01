#!/usr/bin/env python3
"""Configure LX-Branded Zone for VibeCode.

Sets up Debian-compatible zone with ZFS datasets and networking.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"


@dataclass
class ZoneConfig:
    """LX Zone configuration."""

    zone_name: str = "vibecode-zone"
    zone_path: str = field(default="")
    zone_vnic: str = "vibecode0"
    zone_cpus: int = 4
    zone_memory: str = "8G"
    zone_swap: str = "10G"
    debian_image_url: str = "https://us-central.manta.mnx.io/Joyent_Dev/public/lx-debian-11/lx-debian-11-latest.zss.gz"
    debian_image: str = "lx-debian-11-latest.zss"
    primary_nic: str = ""

    def __post_init__(self) -> None:
        """Set derived values."""
        if not self.zone_path:
            self.zone_path = f"/zones/{self.zone_name}"


def log_info(msg: str) -> None:
    """Log info message."""
    print(f"{GREEN}[INFO]{NC} {msg}")


def log_warn(msg: str) -> None:
    """Log warning message."""
    print(f"{YELLOW}[WARN]{NC} {msg}")


def log_error(msg: str) -> None:
    """Log error message."""
    print(f"{RED}[ERROR]{NC} {msg}")


def run_command(
    cmd: list[str],
    timeout: int = 300,
    check: bool = False,
    capture: bool = True,
    input_text: str | None = None,
) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
            check=check,
            input=input_text,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="Timeout")
    except subprocess.SubprocessError as e:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(e))


def check_root() -> bool:
    """Check if running as root.

    Returns:
        True if running as root.
    """
    if os.getuid() != 0:
        log_error("This script must be run as root")
        return False
    return True


def update_system() -> bool:
    """Update OpenIndiana packages.

    Returns:
        True if successful or if update failed but we can continue.
    """
    log_info("Updating OpenIndiana base system...")
    result = run_command(["pkg", "update", "-v"], timeout=600)
    if result.returncode != 0:
        log_warn("Package update failed, continuing...")
    return True


def install_lx_brand() -> bool:
    """Install lx-branded zone support.

    Returns:
        True if installation successful.
    """
    log_info("Installing lx-branded zone support...")

    # Check if already installed
    result = run_command(["pkg", "list", "brand/lx"])
    if result.returncode == 0:
        log_info("lx-branded zone already installed")
        return True

    # Install the package
    result = run_command(["pkg", "install", "-v", "brand/lx"], timeout=600)
    if result.returncode != 0:
        log_error("Failed to install lx-branded zone")
        return False

    # Verify installation
    result = run_command(["pkg", "list", "brand/lx"])
    if result.returncode != 0:
        log_error("Failed to verify lx-branded zone installation")
        return False

    log_info("lx-branded zone installed successfully")
    return True


def download_debian_image(config: ZoneConfig) -> bool:
    """Download Debian image for lx zone.

    Returns:
        True if image is available.
    """
    log_info("Downloading Debian 11 image for lx zone...")

    image_path = Path(config.debian_image)
    compressed_path = Path(f"{config.debian_image}.gz")

    if image_path.exists():
        log_info(f"Debian image already exists: {config.debian_image}")
        return True

    # Download compressed image if needed
    if not compressed_path.exists():
        log_info(f"Downloading from: {config.debian_image_url}")
        result = run_command(
            ["curl", "-L", "-o", str(compressed_path), config.debian_image_url],
            timeout=1800,  # 30 minutes for large download
        )
        if result.returncode != 0:
            log_error("Failed to download Debian image")
            return False

    # Decompress
    log_info("Decompressing image...")
    result = run_command(["gunzip", str(compressed_path)], timeout=300)
    if result.returncode != 0:
        log_error("Failed to decompress Debian image")
        return False

    log_info(f"Debian image ready: {config.debian_image}")
    return True


def detect_network(config: ZoneConfig) -> bool:
    """Detect primary network interface.

    Returns:
        True if network detected.
    """
    log_info("Detecting primary network interface...")

    result = run_command(["dladm", "show-phys", "-p", "-o", "LINK"])
    if result.returncode != 0 or not result.stdout.strip():
        log_error("No network interface found")
        return False

    config.primary_nic = result.stdout.strip().split("\n")[0]
    log_info(f"Primary NIC: {config.primary_nic}")
    return True


def create_vnic(config: ZoneConfig) -> bool:
    """Create VNIC for zone.

    Returns:
        True if VNIC created successfully.
    """
    log_info(f"Creating VNIC: {config.zone_vnic}")

    # Check if VNIC already exists
    result = run_command(["dladm", "show-vnic", config.zone_vnic])
    if result.returncode == 0:
        log_warn(f"VNIC {config.zone_vnic} already exists, removing...")
        run_command(["dladm", "delete-vnic", config.zone_vnic])

    # Create VNIC with bandwidth limit
    result = run_command([
        "dladm", "create-vnic", "-l", config.primary_nic,
        "-p", "maxbw=1000", config.zone_vnic,
    ])
    if result.returncode != 0:
        log_error("Failed to create VNIC")
        return False

    # Verify creation
    result = run_command(["dladm", "show-vnic", config.zone_vnic], capture=False)
    log_info("VNIC created successfully")
    return True


def create_zfs_datasets(config: ZoneConfig) -> bool:
    """Create ZFS datasets for zone.

    Returns:
        True if datasets created successfully.
    """
    log_info("Creating ZFS datasets for zone...")

    # Create base zones dataset if it doesn't exist
    result = run_command(["zfs", "list", "rpool/zones"])
    if result.returncode != 0:
        run_command(["zfs", "create", "-o", "mountpoint=/zones", "rpool/zones"])

    # Create zone dataset
    zone_dataset = f"rpool/zones/{config.zone_name}"
    result = run_command(["zfs", "list", zone_dataset])
    if result.returncode == 0:
        log_warn("Zone dataset already exists")
    else:
        run_command(["zfs", "create", zone_dataset])

    # Create optimized datasets
    log_info("Creating optimized datasets...")

    datasets = [
        (f"{zone_dataset}/postgres", [
            ("recordsize", "8K"),
            ("logbias", "latency"),
            ("primarycache", "metadata"),
        ]),
        (f"{zone_dataset}/redis", [
            ("recordsize", "8K"),
            ("compression", "lz4"),
        ]),
        (f"{zone_dataset}/app", [
            ("compression", "lz4"),
            ("atime", "off"),
        ]),
    ]

    for dataset, properties in datasets:
        result = run_command(["zfs", "list", dataset])
        if result.returncode != 0:
            run_command(["zfs", "create", dataset])
            for prop, value in properties:
                run_command(["zfs", "set", f"{prop}={value}", dataset])

    log_info("ZFS datasets created")
    run_command(["zfs", "list"], capture=False)
    return True


def create_zone_config(config: ZoneConfig) -> bool:
    """Create zone configuration.

    Returns:
        True if configuration created successfully.
    """
    log_info("Creating zone configuration...")

    # Check if zone already exists
    result = run_command(["zoneadm", "list", "-cp"])
    if result.returncode == 0 and f"{config.zone_name}:" in result.stdout:
        log_warn(f"Zone {config.zone_name} already exists, removing...")
        run_command(["zoneadm", "-z", config.zone_name, "halt"])
        run_command(["zoneadm", "-z", config.zone_name, "uninstall", "-F"])
        run_command(["zonecfg", "-z", config.zone_name, "delete", "-F"])

    # Create zone configuration
    zone_cfg = f"""create -t lx
set zonepath={config.zone_path}
set autoboot=true
set ip-type=exclusive
add net
set physical={config.zone_vnic}
end
add attr
set name=resolvers
set type=string
set value=8.8.8.8,8.8.4.4
end
add attr
set name=dns-domain
set type=string
set value=local
end
add capped-cpu
set ncpus={config.zone_cpus}
end
add capped-memory
set physical={config.zone_memory}
set swap={config.zone_swap}
end
"""

    result = run_command(
        ["zonecfg", "-z", config.zone_name],
        input_text=zone_cfg,
    )
    if result.returncode != 0:
        log_error("Failed to create zone configuration")
        return False

    log_info("Zone configuration created")
    run_command(["zonecfg", "-z", config.zone_name, "info"], capture=False)
    return True


def install_zone(config: ZoneConfig) -> bool:
    """Install zone from Debian image.

    Returns:
        True if zone installed successfully.
    """
    log_info("Installing zone from Debian image...")

    if not Path(config.debian_image).exists():
        log_error(f"Debian image not found: {config.debian_image}")
        return False

    result = run_command(
        ["zoneadm", "-z", config.zone_name, "install", "-s", config.debian_image],
        timeout=600,
    )
    if result.returncode != 0:
        log_error("Failed to install zone")
        return False

    log_info("Zone installed successfully")
    return True


def boot_zone(config: ZoneConfig) -> bool:
    """Boot the zone.

    Returns:
        True if zone booted successfully.
    """
    log_info(f"Booting zone: {config.zone_name}")

    result = run_command(["zoneadm", "-z", config.zone_name, "boot"])
    if result.returncode != 0:
        log_error("Failed to boot zone")
        return False

    # Wait for zone to fully boot
    log_info("Waiting for zone to boot...")
    time.sleep(10)

    # Verify zone is running
    result = run_command(["zoneadm", "list", "-v"])
    if result.returncode == 0 and f"{config.zone_name}" in result.stdout and "running" in result.stdout:
        log_info("Zone is running")
        return True
    else:
        log_error("Zone failed to boot")
        run_command(["zoneadm", "list", "-v"], capture=False)
        return False


def configure_zone_network(config: ZoneConfig) -> bool:
    """Configure zone networking.

    Returns:
        True if networking configured successfully.
    """
    log_info("Configuring zone networking...")

    network_script = """
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

    result = run_command(
        ["zlogin", config.zone_name, "/bin/bash"],
        input_text=network_script,
        timeout=300,
    )
    if result.returncode != 0:
        log_warn("Zone network configuration may have issues")

    log_info("Zone networking configured")
    return True


def create_snapshot(config: ZoneConfig) -> bool:
    """Create baseline ZFS snapshot.

    Returns:
        True if snapshot created successfully.
    """
    log_info("Creating baseline ZFS snapshot...")

    snapshot_name = f"rpool/zones/{config.zone_name}@baseline"
    result = run_command(["zfs", "snapshot", snapshot_name])
    if result.returncode != 0:
        log_warn("Failed to create snapshot")
        return False

    log_info(f"Snapshot created: {snapshot_name}")
    return True


def show_zone_info(config: ZoneConfig) -> None:
    """Display zone information."""
    log_info("Zone Configuration Summary")
    print("================================")

    print(f"Zone Name: {config.zone_name}")
    print(f"Zone Path: {config.zone_path}")

    # Get zone state
    result = run_command(["zoneadm", "list", "-v"])
    if result.returncode == 0:
        for line in result.stdout.split("\n"):
            if config.zone_name in line:
                parts = line.split()
                if len(parts) >= 3:
                    print(f"Zone State: {parts[2]}")

    print(f"VNIC: {config.zone_vnic}")
    print()
    print("Resource Limits:")
    print(f"  CPUs: {config.zone_cpus}")
    print(f"  Memory: {config.zone_memory}")
    print(f"  Swap: {config.zone_swap}")

    print()
    print("ZFS Datasets:")
    run_command(["zfs", "list"], capture=False)

    print()
    print("Network Configuration:")
    run_command(["dladm", "show-vnic", config.zone_vnic], capture=False)

    print()
    print("Zone IP Address:")
    result = run_command([
        "zlogin", config.zone_name,
        "ip", "addr", "show", "net0",
    ])
    if result.returncode == 0:
        for line in result.stdout.split("\n"):
            if "inet " in line:
                parts = line.split()
                for i, p in enumerate(parts):
                    if p == "inet" and i + 1 < len(parts):
                        print(parts[i + 1])
                        break
    else:
        print("Not available yet")

    print()
    print("================================")


def show_next_steps(config: ZoneConfig) -> None:
    """Display next steps after zone setup."""
    print(f"""
{GREEN}Zone setup complete!{NC}

Next Steps:
  1. Login to zone:
       zlogin {config.zone_name}

  2. Inside zone, continue setup:
       Run: ./03-install-node24.sh
       Run: ./04-setup-postgres-pgvector.sh
       Run: ./05-deploy-vibecode.sh

Useful Commands:
  - Zone console:  zlogin -C {config.zone_name}  (Ctrl+] to exit)
  - Zone status:   zoneadm list -v
  - Zone reboot:   zoneadm -z {config.zone_name} reboot
  - Zone halt:     zoneadm -z {config.zone_name} halt
  - Zone stats:    zonestat 5 5

Resource Monitoring:
  - CPU/Memory:    prstat -Z
  - Network:       dladm show-vnic -s
  - ZFS:           zpool iostat 5
""")


def run_configure_zone(config: ZoneConfig | None = None) -> int:
    """Run the zone configuration process.

    Args:
        config: Zone configuration (uses defaults if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = ZoneConfig()

    log_info("VibeCode LX Zone Configuration")
    log_info("==============================")

    if not check_root():
        return 1

    if not update_system():
        return 1

    if not install_lx_brand():
        return 1

    if not download_debian_image(config):
        return 1

    if not detect_network(config):
        return 1

    if not create_vnic(config):
        return 1

    if not create_zfs_datasets(config):
        return 1

    if not create_zone_config(config):
        return 1

    if not install_zone(config):
        return 1

    if not boot_zone(config):
        return 1

    configure_zone_network(config)
    create_snapshot(config)
    show_zone_info(config)
    show_next_steps(config)

    return 0


def main() -> int:
    """Main entry point."""
    return run_configure_zone()


if __name__ == "__main__":
    sys.exit(main())
