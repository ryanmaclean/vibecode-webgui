#!/usr/bin/env python3
"""Master VM Build Script.

Builds all specialized VMs with validation.
"""

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

# Colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


class BuildStatus(Enum):
    """Build status enum."""
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


@dataclass
class VMBuild:
    """VM build configuration."""

    name: str
    script: str
    status: BuildStatus = BuildStatus.SKIPPED
    required: bool = True


@dataclass
class BuildConfig:
    """Build configuration."""

    script_dir: Path
    project_root: Path
    parallel: bool = False
    dry_run: bool = False
    vms: list[VMBuild] = field(default_factory=list)


def command_exists(cmd: str) -> bool:
    """Check if a command exists.

    Args:
        cmd: Command to check.

    Returns:
        True if command exists.
    """
    return shutil.which(cmd) is not None


def run_script(script_path: Path, dry_run: bool = False) -> bool:
    """Run a build script.

    Args:
        script_path: Path to the script.
        dry_run: If True, don't actually run.

    Returns:
        True if successful.
    """
    if dry_run:
        print(f"  DRY RUN: Would run {script_path}")
        return True

    if not script_path.exists():
        print(f"{YELLOW}⚠{NC} Build script not found: {script_path}")
        return False

    try:
        result = subprocess.run(
            ["bash", str(script_path)],
            check=False
        )
        return result.returncode == 0
    except Exception as e:
        print(f"{RED}✗{NC} Error running script: {e}")
        return False


def check_prerequisites() -> bool:
    """Check build prerequisites.

    Returns:
        True if all required prerequisites are met.
    """
    print("Checking prerequisites...")

    missing_required = False

    # Required: Docker
    if not command_exists("docker"):
        print(f"{RED}✗{NC} Docker not installed")
        missing_required = True
    else:
        print(f"{GREEN}✓{NC} Docker installed")

    # Optional: redis-cli
    if not command_exists("redis-cli"):
        print(f"{YELLOW}⚠{NC} redis-cli not installed (needed for Valkey tests)")
        print("  Install with: brew install redis")
    else:
        print(f"{GREEN}✓{NC} redis-cli installed")

    # Optional: psql
    if not command_exists("psql"):
        print(f"{YELLOW}⚠{NC} psql not installed (needed for PostgreSQL tests)")
        print("  Install with: brew install postgresql")
    else:
        print(f"{GREEN}✓{NC} psql installed")

    if missing_required:
        print()
        print(f"{RED}ERROR: Missing required prerequisites{NC}")
        return False

    print()
    return True


def build_vm(vm: VMBuild, script_dir: Path, dry_run: bool = False) -> BuildStatus:
    """Build a single VM.

    Args:
        vm: VM build configuration.
        script_dir: Directory containing build scripts.
        dry_run: If True, don't actually build.

    Returns:
        Build status.
    """
    print(f"{BLUE}Building {vm.name}...{NC}")

    script_path = script_dir / vm.script

    if run_script(script_path, dry_run):
        print(f"{GREEN}✓{NC} {vm.name} built successfully")
        return BuildStatus.SUCCESS
    else:
        print(f"{RED}✗{NC} {vm.name} build failed")
        return BuildStatus.FAILED


def get_default_vms() -> list[VMBuild]:
    """Get default list of VMs to build.

    Returns:
        List of VM build configurations.
    """
    return [
        VMBuild(
            name="Valkey",
            script="build-valkey-vm.sh",
            required=True
        ),
        VMBuild(
            name="PostgreSQL",
            script="rebuild-postgresql-docker.sh",
            required=True
        ),
        VMBuild(
            name="Unified",
            script="build-unified-vm.sh",
            required=False
        )
    ]


def print_summary(vms: list[VMBuild]) -> None:
    """Print build summary.

    Args:
        vms: List of VM builds with status.
    """
    print("=== Build Summary ===")

    for vm in vms:
        if vm.status == BuildStatus.SUCCESS:
            print(f"{vm.name}: {GREEN}✓ SUCCESS{NC}")
        elif vm.status == BuildStatus.FAILED:
            print(f"{vm.name}: {RED}✗ FAILED{NC}")
        else:
            print(f"{vm.name}: {YELLOW}⚠ SKIPPED{NC}")


def build_all_vms(
    script_dir: Optional[Path] = None,
    dry_run: bool = False,
    skip_prereqs: bool = False
) -> int:
    """Build all VMs.

    Args:
        script_dir: Directory containing build scripts.
        dry_run: If True, don't actually build.
        skip_prereqs: If True, skip prerequisite checks.

    Returns:
        Exit code (0 if all builds succeeded).
    """
    print(f"{BLUE}================================={NC}")
    print(f"{BLUE}  VibeCode VM Build Suite{NC}")
    print(f"{BLUE}================================={NC}")
    print()

    # Determine script directory
    if script_dir is None:
        script_dir = Path(__file__).parent.resolve()

    # Check prerequisites
    if not skip_prereqs:
        if not check_prerequisites():
            return 1

    print("=== Building VMs ===")
    print()

    # Get VMs to build
    vms = get_default_vms()

    # Build each VM
    for i, vm in enumerate(vms, 1):
        print(f"{i}. {vm.name} VM")
        vm.status = build_vm(vm, script_dir, dry_run)
        print()

    # Print summary
    print_summary(vms)

    # Return failure if any build failed
    failed = any(vm.status == BuildStatus.FAILED for vm in vms)
    return 1 if failed else 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(
        description="Build all VibeCode VMs"
    )
    parser.add_argument(
        '-n', '--dry-run',
        action='store_true',
        help='Show what would be built without building'
    )
    parser.add_argument(
        '--skip-prereqs',
        action='store_true',
        help='Skip prerequisite checks'
    )
    parser.add_argument(
        '-d', '--script-dir',
        type=Path,
        help='Directory containing build scripts'
    )

    args = parser.parse_args()

    return build_all_vms(
        script_dir=args.script_dir,
        dry_run=args.dry_run,
        skip_prereqs=args.skip_prereqs
    )


if __name__ == "__main__":
    sys.exit(main())
