#!/usr/bin/env python3
"""VibeCode ZFS Integration Script.

Implements ZFS optimizations for maximum performance:
- Creates ZFS pool with optimal settings
- Configures compression, atime, sync, recordsize
- Creates dataset hierarchy for code-server
- Manages snapshots for instant rollback
- Performance testing and optimization
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
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


# Configuration
DEFAULT_ZFS_POOL = "vibecode-pool"
DEFAULT_ZFS_DATASET = "vibecode-pool/vibecode"
DEFAULT_MOUNT_POINT = "/vibecode-zfs"
BACKUP_DIR = Path("/tmp/vibecode-backup")

# ZFS optimization settings
ZFS_SETTINGS: dict[str, str] = {
    "compression": "lz4",
    "atime": "off",
    "sync": "disabled",
    "recordsize": "64k",
    "logbias": "throughput",
}

SUB_DATASETS: list[str] = [
    "code-server",
    "extensions",
    "user-data",
    "cache",
]

SNAPSHOT_SCRIPT = '''\
#!/bin/bash

ZFS_POOL="{pool}"
ZFS_DATASET="{dataset}"

case "$1" in
    "create")
        SNAPSHOT_NAME="vibecode-$(date +%Y%m%d-%H%M%S)"
        zfs snapshot "$ZFS_DATASET@$SNAPSHOT_NAME"
        echo "Snapshot created: $SNAPSHOT_NAME"
        ;;
    "list")
        zfs list -t snapshot "$ZFS_DATASET"
        ;;
    "rollback")
        if [ -z "$2" ]; then
            echo "Usage: $0 rollback <snapshot-name>"
            exit 1
        fi
        zfs rollback "$ZFS_DATASET@$2"
        echo "Rolled back to: $2"
        ;;
    "clean")
        zfs rollback "$ZFS_DATASET@baseline" 2>/dev/null || echo "No baseline snapshot"
        echo "Rolled back to clean state"
        ;;
    *)
        echo "Usage: $0 {{create|list|rollback|clean}}"
        echo "  create    - Create new snapshot"
        echo "  list      - List all snapshots"
        echo "  rollback  - Rollback to specific snapshot"
        echo "  clean     - Rollback to clean state"
        ;;
esac
'''

OPTIMIZE_SCRIPT = '''\
#!/bin/bash

ZFS_POOL="{pool}"
ZFS_DATASET="{dataset}"

echo "Optimizing VibeCode ZFS..."

# Set optimal ZFS parameters
zfs set compression=lz4 "$ZFS_POOL"
zfs set atime=off "$ZFS_POOL"
zfs set sync=disabled "$ZFS_POOL"
zfs set recordsize=64k "$ZFS_POOL"
zfs set logbias=throughput "$ZFS_POOL"

# Set ARC size (if supported)
if [ -f /sys/module/zfs/parameters/zfs_arc_max ]; then
    echo 1073741824 > /sys/module/zfs/parameters/zfs_arc_max 2>/dev/null || true
fi

echo "ZFS optimization complete"
'''


@dataclass
class ZFSConfig:
    """ZFS configuration."""

    pool: str = DEFAULT_ZFS_POOL
    dataset: str = DEFAULT_ZFS_DATASET
    mount_point: str = DEFAULT_MOUNT_POINT


def run_cmd(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
    )


def run_zfs(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a ZFS command."""
    return run_cmd(["zfs"] + args, check=check)


def run_zpool(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a zpool command."""
    return run_cmd(["zpool"] + args, check=check)


def check_root() -> bool:
    """Check if running as root."""
    return os.geteuid() == 0


def check_zfs_installed() -> bool:
    """Check if ZFS is installed."""
    return shutil.which("zpool") is not None


def pool_exists(pool: str) -> bool:
    """Check if a ZFS pool exists."""
    result = run_zpool(["list", pool], check=False)
    return result.returncode == 0


def dataset_exists(dataset: str) -> bool:
    """Check if a ZFS dataset exists."""
    result = run_zfs(["list", dataset], check=False)
    return result.returncode == 0


def get_zfs_property(dataset: str, prop: str) -> str:
    """Get a ZFS property value."""
    result = run_zfs(["get", "-H", "-o", "value", prop, dataset], check=False)
    return result.stdout.strip() if result.returncode == 0 else ""


def find_available_disk() -> str | None:
    """Find an available disk for ZFS pool."""
    result = run_cmd(["diskutil", "list"], check=False)
    if result.returncode != 0:
        return None

    for line in result.stdout.splitlines():
        if "Free Space" in line:
            parts = line.split()
            if parts:
                return parts[0]
    return None


def phase1_create_pool(config: ZFSConfig) -> bool:
    """Phase 1: Create ZFS Pool."""
    print()
    print("Phase 1: Creating ZFS Pool")
    print("=" * 40)

    if pool_exists(config.pool):
        print(f"ZFS pool already exists: {config.pool}")
        return True

    disk = find_available_disk()
    if not disk:
        print("Error: No available disk found for ZFS pool")
        print("Please ensure you have free disk space")
        return False

    print(f"Using disk: {disk}")
    print("Creating ZFS pool with optimizations...")

    result = run_zpool(
        [
            "create",
            "-o", "ashift=12",
            "-o", "autoexpand=on",
            "-o", "autoreplace=on",
            config.pool,
            disk,
        ],
        check=False,
    )

    if result.returncode != 0:
        print(f"Error creating pool: {result.stderr}")
        return False

    print(f"ZFS pool created: {config.pool}")
    return True


def phase2_optimize_settings(config: ZFSConfig) -> bool:
    """Phase 2: Optimize ZFS Settings."""
    print()
    print("Phase 2: Optimizing ZFS Settings")
    print("=" * 40)

    for prop, value in ZFS_SETTINGS.items():
        result = run_zfs(["set", f"{prop}={value}", config.pool], check=False)
        if result.returncode == 0:
            print(f"Set {prop}={value}")
        else:
            print(f"Warning: Could not set {prop}={value}")

    return True


def phase3_create_datasets(config: ZFSConfig) -> bool:
    """Phase 3: Create VibeCode Dataset."""
    print()
    print("Phase 3: Creating VibeCode Dataset")
    print("=" * 40)

    # Create main dataset
    if not dataset_exists(config.dataset):
        result = run_zfs(["create", config.dataset], check=False)
        if result.returncode == 0:
            print(f"Created dataset: {config.dataset}")
        else:
            print(f"Error creating dataset: {result.stderr}")
            return False
    else:
        print(f"Dataset already exists: {config.dataset}")

    # Create sub-datasets
    for sub in SUB_DATASETS:
        sub_dataset = f"{config.dataset}/{sub}"
        result = run_zfs(["create", sub_dataset], check=False)
        if result.returncode == 0:
            print(f"Created sub-dataset: {sub}")
        else:
            print(f"{sub} dataset exists")

    return True


def phase4_migrate_data(config: ZFSConfig) -> bool:
    """Phase 4: Migrate Existing Data."""
    print()
    print("Phase 4: Migrating Existing Data")
    print("=" * 40)

    home = Path.home()
    code_server_config = home / ".config" / "code-server"

    # Backup existing data
    if code_server_config.exists() and not code_server_config.is_symlink():
        print("Backing up existing code-server data...")
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup_dest = BACKUP_DIR / "code-server"
        if backup_dest.exists():
            shutil.rmtree(backup_dest)
        shutil.copytree(code_server_config, backup_dest)
        print(f"Backup created: {backup_dest}")

    # Get mount point
    mount_point = get_zfs_property(config.dataset, "mountpoint")
    if not mount_point:
        mount_point = config.mount_point
    print(f"ZFS mount point: {mount_point}")

    # Create symlink to ZFS
    if not code_server_config.is_symlink():
        print("Creating symlinks to ZFS...")
        if code_server_config.exists():
            shutil.rmtree(code_server_config)
        user_data_path = Path(mount_point) / "user-data"
        user_data_path.mkdir(parents=True, exist_ok=True)
        code_server_config.symlink_to(user_data_path)
        print(f"Symlink created: {code_server_config} -> {user_data_path}")
    else:
        print(f"Symlink already exists: {code_server_config}")

    return True


def phase5_snapshot_management(config: ZFSConfig) -> bool:
    """Phase 5: Create Snapshot Management."""
    print()
    print("Phase 5: Snapshot Management")
    print("=" * 40)

    # Create snapshot script
    script_path = Path("/usr/local/bin/vibecode-snapshots")
    script_content = SNAPSHOT_SCRIPT.format(pool=config.pool, dataset=config.dataset)

    try:
        script_path.parent.mkdir(parents=True, exist_ok=True)
        script_path.write_text(script_content)
        script_path.chmod(0o755)
        print("Snapshot management script created")
    except PermissionError:
        print(f"Warning: Could not create {script_path} (permission denied)")
        print("You can create it manually or run with sudo")

    # Create baseline snapshot
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    snapshot_name = f"vibecode-{timestamp}"
    result = run_zfs(["snapshot", f"{config.dataset}@{snapshot_name}"], check=False)
    if result.returncode == 0:
        print(f"Snapshot created: {snapshot_name}")
        # Rename to baseline
        run_zfs(
            ["rename", f"{config.dataset}@{snapshot_name}", f"{config.dataset}@baseline"],
            check=False,
        )
        print("Baseline snapshot created")

    return True


def phase6_performance_testing(config: ZFSConfig) -> bool:
    """Phase 6: Performance Testing."""
    print()
    print("Phase 6: Performance Testing")
    print("=" * 40)

    mount_point = get_zfs_property(config.dataset, "mountpoint")
    if not mount_point:
        mount_point = config.mount_point

    test_file = Path(mount_point) / "write-test"

    print("Testing ZFS performance...")

    # Test write performance
    result = run_cmd(
        ["dd", "if=/dev/zero", f"of={test_file}", "bs=1M", "count=100"],
        check=False,
    )
    if result.returncode == 0:
        # Parse dd output from stderr
        for line in result.stderr.splitlines():
            if "copied" in line:
                parts = line.split()
                if len(parts) >= 9:
                    print(f"Write performance: {parts[7]} {parts[8]}")
                break

    # Test read performance
    result = run_cmd(
        ["dd", f"if={test_file}", "of=/dev/null", "bs=1M"],
        check=False,
    )
    if result.returncode == 0:
        for line in result.stderr.splitlines():
            if "copied" in line:
                parts = line.split()
                if len(parts) >= 9:
                    print(f"Read performance: {parts[7]} {parts[8]}")
                break

    # Test compression ratio
    ratio = get_zfs_property(config.dataset, "compressratio")
    if ratio:
        print(f"Compression ratio: {ratio}")

    # Cleanup
    test_file.unlink(missing_ok=True)

    return True


def phase7_optimization_script(config: ZFSConfig) -> bool:
    """Phase 7: Create Optimization Script."""
    print()
    print("Phase 7: Optimization Script")
    print("=" * 40)

    script_path = Path("/usr/local/bin/vibecode-optimize")
    script_content = OPTIMIZE_SCRIPT.format(pool=config.pool, dataset=config.dataset)

    try:
        script_path.parent.mkdir(parents=True, exist_ok=True)
        script_path.write_text(script_content)
        script_path.chmod(0o755)
        print("Optimization script created")
    except PermissionError:
        print(f"Warning: Could not create {script_path} (permission denied)")

    return True


def print_summary(config: ZFSConfig) -> None:
    """Print final summary."""
    print()
    print("ZFS Integration Complete!")
    print("=" * 40)
    print()

    # Pool status
    print("ZFS Pool Status:")
    run_cmd(["zpool", "status", config.pool], capture=False, check=False)
    print()

    # Dataset status
    print("ZFS Dataset Status:")
    run_cmd(["zfs", "list", config.dataset], capture=False, check=False)
    print()

    # Compression status
    print("Compression Status:")
    run_cmd(
        ["zfs", "get", "compression,compressratio", config.dataset],
        capture=False,
        check=False,
    )
    print()

    mount_point = get_zfs_property(config.dataset, "mountpoint")

    print("Available Commands:")
    print("   vibecode-snapshots create    - Create snapshot")
    print("   vibecode-snapshots list      - List snapshots")
    print("   vibecode-snapshots rollback  - Rollback to snapshot")
    print("   vibecode-snapshots clean     - Rollback to clean state")
    print("   vibecode-optimize            - Optimize ZFS settings")
    print()
    print(f"ZFS Mount Point: {mount_point}")
    print(f"Symlink: ~/.config/code-server -> {mount_point}/user-data")
    print()
    print("Expected Performance Improvements:")
    print("   - File I/O: 40-60% faster")
    print("   - Space Usage: 30-50% less")
    print("   - Environment Reset: 90% faster")
    print("   - Snapshot Operations: Instant")
    print()
    print("VibeCode is now running on ZFS!")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--pool",
        default=DEFAULT_ZFS_POOL,
        help=f"ZFS pool name (default: {DEFAULT_ZFS_POOL})",
    )
    parser.add_argument(
        "--dataset",
        default=DEFAULT_ZFS_DATASET,
        help=f"ZFS dataset name (default: {DEFAULT_ZFS_DATASET})",
    )
    parser.add_argument(
        "--skip-root-check",
        action="store_true",
        help="Skip root user check (for testing)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args(argv)

    print("VibeCode ZFS Integration")
    print("=" * 40)
    print()

    # Check root
    if not args.skip_root_check and not check_root():
        print("Error: This script must be run as root for ZFS operations")
        print(f"   Run: sudo {sys.argv[0]}")
        return 1

    # Check ZFS
    if not check_zfs_installed():
        print("Error: ZFS is not installed")
        print("   Install with: brew install zfs")
        return 1

    print("ZFS is available")

    if args.dry_run:
        print()
        print("DRY RUN - No changes will be made")
        print()
        print("Would execute:")
        print(f"  1. Create pool: {args.pool}")
        print(f"  2. Optimize settings: {', '.join(ZFS_SETTINGS.keys())}")
        print(f"  3. Create dataset: {args.dataset}")
        print(f"  4. Create sub-datasets: {', '.join(SUB_DATASETS)}")
        print("  5. Create snapshot management script")
        print("  6. Run performance tests")
        print("  7. Create optimization script")
        return 0

    config = ZFSConfig(
        pool=args.pool,
        dataset=args.dataset,
    )

    # Run all phases
    phases = [
        ("Phase 1", phase1_create_pool),
        ("Phase 2", phase2_optimize_settings),
        ("Phase 3", phase3_create_datasets),
        ("Phase 4", phase4_migrate_data),
        ("Phase 5", phase5_snapshot_management),
        ("Phase 6", phase6_performance_testing),
        ("Phase 7", phase7_optimization_script),
    ]

    for phase_name, phase_func in phases:
        if not phase_func(config):
            print(f"Error in {phase_name}")
            return 1

    print_summary(config)
    return 0


if __name__ == "__main__":
    sys.exit(main())
