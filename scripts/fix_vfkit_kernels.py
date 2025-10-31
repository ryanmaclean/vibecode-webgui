#!/usr/bin/env python3
"""
Fix vfkit Compressed Kernel Issue

Downloads and extracts uncompressed ARM64 kernels for all vfkit VMs.
vfkit requires uncompressed kernels, not gzip or ELF format.

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

import sys
import subprocess
import gzip
import shutil
from pathlib import Path
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

HOME = Path.home()
VM_BASE = HOME / ".vfkit" / "vms"
ALPINE_VERSION = "3.19"
ALPINE_KERNEL_URL = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/alpine-virt-{ALPINE_VERSION}.0-aarch64.iso"


def is_compressed(kernel_path: Path) -> bool:
    """Check if a kernel file is compressed."""
    try:
        with open(kernel_path, 'rb') as f:
            magic = f.read(2)
            # Check for gzip magic number
            if magic == b'\x1f\x8b':
                return True
            # Check for various compression formats
            f.seek(0)
            header = f.read(4)
            # ELF format (which vfkit doesn't accept)
            if header[:4] == b'\x7fELF':
                logger.info(f"  Kernel is ELF format (needs extraction)")
                return True
        return False
    except Exception as e:
        logger.error(f"  Error checking kernel: {e}")
        return False


def decompress_kernel(kernel_path: Path, output_path: Path) -> bool:
    """Decompress a gzipped kernel."""
    try:
        logger.info(f"  Decompressing {kernel_path.name}...")
        with gzip.open(kernel_path, 'rb') as f_in:
            with open(output_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        logger.info(f"  ✅ Decompressed to {output_path.name}")
        return True
    except Exception as e:
        logger.error(f"  ❌ Failed to decompress: {e}")
        return False


def extract_kernel_from_iso(vm_name: str, kernel_dir: Path) -> bool:
    """Extract uncompressed kernel from Alpine ISO."""
    logger.info(f"  Extracting kernel from Alpine ISO...")
    
    iso_path = kernel_dir / "alpine.iso"
    mount_point = kernel_dir / "mnt"
    
    try:
        # Download Alpine ISO if not exists
        if not iso_path.exists():
            logger.info(f"  Downloading Alpine Linux ISO...")
            result = subprocess.run(
                ["curl", "-L", "-o", str(iso_path), ALPINE_KERNEL_URL],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                logger.error(f"  ❌ Failed to download ISO: {result.stderr}")
                return False
        
        # Create mount point
        mount_point.mkdir(exist_ok=True)
        
        # Mount ISO (macOS uses hdiutil)
        logger.info(f"  Mounting ISO...")
        result = subprocess.run(
            ["hdiutil", "attach", str(iso_path), "-mountpoint", str(mount_point), "-readonly"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            logger.error(f"  ❌ Failed to mount ISO: {result.stderr}")
            return False
        
        try:
            # Find kernel in mounted ISO
            kernel_candidates = [
                mount_point / "boot" / "vmlinuz-virt",
                mount_point / "boot" / "vmlinuz",
            ]
            
            for candidate in kernel_candidates:
                if candidate.exists():
                    output_kernel = kernel_dir / "vmlinux"
                    
                    # Check if it's compressed
                    with open(candidate, 'rb') as f:
                        magic = f.read(2)
                    
                    if magic == b'\x1f\x8b':
                        # It's gzipped, decompress it
                        logger.info(f"  Found compressed kernel, decompressing...")
                        with gzip.open(candidate, 'rb') as f_in:
                            with open(output_kernel, 'wb') as f_out:
                                shutil.copyfileobj(f_in, f_out)
                    else:
                        # Copy as-is
                        logger.info(f"  Found kernel, copying...")
                        shutil.copy2(candidate, output_kernel)
                    
                    logger.info(f"  ✅ Kernel extracted to {output_kernel}")
                    return True
            
            logger.error(f"  ❌ No kernel found in ISO")
            return False
            
        finally:
            # Unmount ISO
            subprocess.run(["hdiutil", "detach", str(mount_point)], capture_output=True)
            
    except Exception as e:
        logger.error(f"  ❌ Error extracting kernel: {e}")
        return False


def fix_vm_kernel(vm_name: str) -> bool:
    """Fix kernel for a specific VM."""
    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(f"Fixing kernel for: {vm_name}")
    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    vm_dir = VM_BASE / vm_name
    kernel_dir = vm_dir / "kernel"
    kernel_path = kernel_dir / "vmlinux"
    
    if not kernel_path.exists():
        logger.error(f"  ❌ Kernel not found: {kernel_path}")
        return False
    
    # Check if kernel is compressed
    if not is_compressed(kernel_path):
        logger.info(f"  ✅ Kernel is already uncompressed")
        return True
    
    # Backup original kernel
    backup_path = kernel_dir / "vmlinux.compressed.bak"
    if not backup_path.exists():
        logger.info(f"  📦 Backing up original kernel...")
        shutil.copy2(kernel_path, backup_path)
    
    # Try to decompress if it's gzipped
    with open(kernel_path, 'rb') as f:
        magic = f.read(2)
    
    if magic == b'\x1f\x8b':
        temp_output = kernel_dir / "vmlinux.uncompressed"
        if decompress_kernel(kernel_path, temp_output):
            kernel_path.unlink()
            temp_output.rename(kernel_path)
            logger.info(f"  ✅ {vm_name} kernel fixed!")
            return True
    
    # If it's ELF or other format, extract from ISO
    logger.info(f"  Kernel is ELF format, extracting from Alpine ISO...")
    if extract_kernel_from_iso(vm_name, kernel_dir):
        logger.info(f"  ✅ {vm_name} kernel fixed!")
        return True
    
    logger.error(f"  ❌ Failed to fix {vm_name} kernel")
    return False


def main() -> int:
    """Main entry point."""
    logger.info("🔧 Fixing vfkit Compressed Kernels")
    logger.info("=" * 60)
    logger.info("")
    
    vms = [
        "vibecode-valkey",
        "vibecode-postgresql",
        "vibecode-pgvector",
        "vibecode-nodejs-dev"
    ]
    
    results = {}
    for vm_name in vms:
        results[vm_name] = fix_vm_kernel(vm_name)
        logger.info("")
    
    # Summary
    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)
    
    for vm_name, success in results.items():
        icon = "✅" if success else "❌"
        logger.info(f"{icon} {vm_name}")
    
    failed = sum(1 for success in results.values() if not success)
    
    if failed == 0:
        logger.info("\n🎉 All kernels fixed!")
        return 0
    else:
        logger.info(f"\n⚠️  {failed} kernel(s) failed to fix")
        return 1


if __name__ == "__main__":
    sys.exit(main())

