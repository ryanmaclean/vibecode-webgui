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
Create Alpine Linux UEFI Disk Image for Distribution

Creates a bootable QCOW2 disk image with Alpine Linux and pre-installed services
for bundling in VibeCode app.

Copyright (c) 2025 VibeCode Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import sys
import subprocess
import tempfile
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def create_alpine_valkey_vm(output_dir: Path) -> bool:
    """Create Alpine Linux VM with Valkey pre-installed."""
    logger.info("🏔️  Creating Alpine Linux + Valkey VM")
    logger.info("=" * 60)
    
    vm_name = "alpine-valkey"
    output_file = output_dir / f"{vm_name}.qcow2"
    
    # Use Lima to create the VM with cloud-init
    cloud_init = """#cloud-config
packages:
  - valkey
  - curl
  - bash
runcmd:
  - rc-update add valkey default
  - rc-service valkey start
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(cloud_init)
        cloud_init_file = f.name
    
    try:
        logger.info(f"📥 Creating VM with Lima...")
        
        # Create Lima VM with cloud-init
        cmd = [
            "limactl", "start",
            "--name", vm_name,
            "--cpus", "2",
            "--memory", "1",
            "--disk", "10",
            "--tty=false",
            f"--cloud-init-file={cloud_init_file}",
            "template://alpine"
        ]
        
        logger.info(f"  Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"❌ Failed to create VM: {result.stderr}")
            return False
        
        logger.info("✅ VM created successfully")
        
        # Get disk path
        lima_vm_dir = Path.home() / ".lima" / vm_name
        disk_path = lima_vm_dir / "diffdisk"
        
        if not disk_path.exists():
            logger.error(f"❌ Disk not found: {disk_path}")
            return False
        
        # Copy disk to output
        logger.info(f"📋 Copying disk image...")
        output_file.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["cp", str(disk_path), str(output_file)], check=True)
        
        # Stop and delete Lima VM
        logger.info(f"🧹 Cleaning up Lima VM...")
        subprocess.run(["limactl", "stop", vm_name], capture_output=True)
        subprocess.run(["limactl", "delete", vm_name], capture_output=True)
        
        logger.info(f"✅ Disk image created: {output_file}")
        
        # Get file size
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"📊 Size: {size_mb:.1f} MB")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False
    finally:
        Path(cloud_init_file).unlink(missing_ok=True)


def main() -> int:
    """Main entry point."""
    logger.info("📦 Alpine Linux UEFI Disk Image Creator")
    logger.info("=" * 60)
    logger.info("")
    
    output_dir = Path(__file__).parent.parent / "vms" / "dist"
    
    if create_alpine_valkey_vm(output_dir):
        logger.info("")
        logger.info("🎉 Success!")
        logger.info(f"VM image ready for distribution: {output_dir}")
        return 0
    else:
        logger.info("")
        logger.info("❌ Failed to create VM image")
        return 1


if __name__ == "__main__":
    sys.exit(main())
