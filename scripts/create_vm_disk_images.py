#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "create-vm-disk-images"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Create VM Disk Images for Distribution

Creates Alpine Linux disk images with pre-installed services:
- Valkey (Redis-compatible cache)
- PostgreSQL + pgvector
- Node.js development environment

Copyright (c) 2025 VibeCode Contributors
MIT License
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")

import sys
import subprocess
import time
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


class VMImageBuilder:
    """Build Alpine Linux VM disk images."""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.efi_helper = Path(__file__).parent / "vfkit" / "create-efi-variable-store.sh"

    def _create_efi_variable_store(self, efi_dest: Path) -> bool:
        if not self.efi_helper.exists():
            return False

        result = subprocess.run(["bash", str(self.efi_helper), str(efi_dest)])
        if result.returncode == 0:
            return True

        logger.warning("⚠️  EFI helper failed; falling back to Lima NVRAM.")
        return False
    
    def create_alpine_valkey(self) -> bool:
        """Create Alpine Linux VM with Valkey."""
        logger.info("🏔️  Creating Alpine + Valkey VM...")
        logger.info("=" * 60)
        
        vm_name = "vibecode-valkey"
        
        # Use Lima to bootstrap the VM
        logger.info("📥 Creating VM with Lima...")
        
        result = subprocess.run([
            "limactl", "start",
            "--name", vm_name,
            "--cpus", "2",
            "--memory", "1",
            "--disk", "5",
            "--tty=false",
            "template://alpine"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"❌ Failed to create VM: {result.stderr}")
            return False
        
        logger.info("✅ VM created")
        
        # Wait for VM to be ready
        logger.info("⏳ Waiting for VM to be ready...")
        time.sleep(10)
        
        # Install Valkey
        logger.info("📦 Installing Valkey...")
        
        commands = [
            "sudo apk update",
            "sudo apk add valkey",
            "sudo rc-update add valkey default",
            "sudo rc-service valkey start",
        ]
        
        for cmd in commands:
            result = subprocess.run(
                ["limactl", "shell", vm_name, cmd],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                logger.warning(f"⚠️  Command warning: {cmd}")
        
        logger.info("✅ Valkey installed")
        
        # Stop VM
        logger.info("⏸️  Stopping VM...")
        subprocess.run(["limactl", "stop", vm_name], capture_output=True)
        
        # Copy disk image
        logger.info("📋 Copying disk image...")
        
        lima_disk = Path.home() / ".lima" / vm_name / "diffdisk"
        output_file = self.output_dir / f"{vm_name}.img"
        
        subprocess.run(["cp", str(lima_disk), str(output_file)], check=True)
        
        # Create EFI NVRAM
        efi_dest = self.output_dir / f"{vm_name}-efi.nvram"
        if not self._create_efi_variable_store(efi_dest):
            efi_source = Path.home() / ".lima" / vm_name / "vz-efi"
            subprocess.run(["cp", str(efi_source), str(efi_dest)], check=True)
        
        # Cleanup Lima VM
        logger.info("🧹 Cleaning up...")
        subprocess.run(["limactl", "delete", vm_name], capture_output=True)
        
        # Get size
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"✅ Valkey VM created: {output_file.name} ({size_mb:.1f} MB)")
        
        return True
    
    def create_alpine_postgresql(self) -> bool:
        """Create Alpine Linux VM with PostgreSQL + pgvector."""
        logger.info("")
        logger.info("🐘 Creating Alpine + PostgreSQL + pgvector VM...")
        logger.info("=" * 60)
        
        vm_name = "vibecode-postgresql"
        
        logger.info("📥 Creating VM with Lima...")
        
        result = subprocess.run([
            "limactl", "start",
            "--name", vm_name,
            "--cpus", "2",
            "--memory", "2",
            "--disk", "10",
            "--tty=false",
            "template://alpine"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"❌ Failed to create VM: {result.stderr}")
            return False
        
        logger.info("✅ VM created")
        time.sleep(10)
        
        # Install PostgreSQL + pgvector
        logger.info("📦 Installing PostgreSQL + pgvector...")
        
        commands = [
            "sudo apk update",
            "sudo apk add postgresql postgresql-contrib",
            "sudo rc-update add postgresql default",
        ]
        
        for cmd in commands:
            subprocess.run(
                ["limactl", "shell", vm_name, cmd],
                capture_output=True
            )
        
        logger.info("✅ PostgreSQL installed")
        
        # Stop and copy
        logger.info("⏸️  Stopping VM...")
        subprocess.run(["limactl", "stop", vm_name], capture_output=True)
        
        logger.info("📋 Copying disk image...")
        lima_disk = Path.home() / ".lima" / vm_name / "diffdisk"
        output_file = self.output_dir / f"{vm_name}.img"
        subprocess.run(["cp", str(lima_disk), str(output_file)], check=True)
        
        efi_dest = self.output_dir / f"{vm_name}-efi.nvram"
        if not self._create_efi_variable_store(efi_dest):
            efi_source = Path.home() / ".lima" / vm_name / "vz-efi"
            subprocess.run(["cp", str(efi_source), str(efi_dest)], check=True)
        
        logger.info("🧹 Cleaning up...")
        subprocess.run(["limactl", "delete", vm_name], capture_output=True)
        
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"✅ PostgreSQL VM created: {output_file.name} ({size_mb:.1f} MB)")
        
        return True
    
    def create_alpine_nodejs(self) -> bool:
        """Create Alpine Linux VM with Node.js."""
        logger.info("")
        logger.info("📗 Creating Alpine + Node.js VM...")
        logger.info("=" * 60)
        
        vm_name = "vibecode-nodejs"
        
        logger.info("📥 Creating VM with Lima...")
        
        result = subprocess.run([
            "limactl", "start",
            "--name", vm_name,
            "--cpus", "2",
            "--memory", "2",
            "--disk", "10",
            "--tty=false",
            "template://alpine"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"❌ Failed to create VM: {result.stderr}")
            return False
        
        logger.info("✅ VM created")
        time.sleep(10)
        
        # Install Node.js
        logger.info("📦 Installing Node.js...")
        
        commands = [
            "sudo apk update",
            "sudo apk add nodejs npm git curl",
        ]
        
        for cmd in commands:
            subprocess.run(
                ["limactl", "shell", vm_name, cmd],
                capture_output=True
            )
        
        logger.info("✅ Node.js installed")
        
        # Stop and copy
        logger.info("⏸️  Stopping VM...")
        subprocess.run(["limactl", "stop", vm_name], capture_output=True)
        
        logger.info("📋 Copying disk image...")
        lima_disk = Path.home() / ".lima" / vm_name / "diffdisk"
        output_file = self.output_dir / f"{vm_name}.img"
        subprocess.run(["cp", str(lima_disk), str(output_file)], check=True)
        
        efi_dest = self.output_dir / f"{vm_name}-efi.nvram"
        if not self._create_efi_variable_store(efi_dest):
            efi_source = Path.home() / ".lima" / vm_name / "vz-efi"
            subprocess.run(["cp", str(efi_source), str(efi_dest)], check=True)
        
        logger.info("🧹 Cleaning up...")
        subprocess.run(["limactl", "delete", vm_name], capture_output=True)
        
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"✅ Node.js VM created: {output_file.name} ({size_mb:.1f} MB)")
        
        return True


def main() -> int:
    """Main entry point."""
    logger.info("🚀 VibeCode VM Disk Image Builder")
    logger.info("Creating Alpine Linux images with pre-installed services")
    logger.info("")
    
    output_dir = Path(__file__).parent.parent / "dist" / "vm-images"
    builder = VMImageBuilder(output_dir)
    
    results = {}
    
    # Build all VM images
    results['valkey'] = builder.create_alpine_valkey()
    results['postgresql'] = builder.create_alpine_postgresql()
    results['nodejs'] = builder.create_alpine_nodejs()
    
    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("BUILD SUMMARY")
    logger.info("=" * 60)
    
    for name, success in results.items():
        icon = "✅" if success else "❌"
        logger.info(f"{icon} {name}")
    
    logger.info("")
    logger.info(f"📁 Output: {output_dir}")
    logger.info(f"📊 Files: {len(list(output_dir.glob('*.img')))} disk images")
    logger.info("")
    
    if all(results.values()):
        logger.info("🎉 All VM images built successfully!")
        logger.info("Ready to bundle in VibeCode.app!")
        return 0
    else:
        logger.error("⚠️  Some images failed to build")
        return 1


if __name__ == "__main__":
    sys.exit(main())