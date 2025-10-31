#!/usr/bin/env python3
"""
Extract Raw ARM64 Kernel for vfkit

vfkit requires a raw, uncompressed ARM64 kernel image, not an EFI wrapper.
This script downloads and extracts the correct kernel format.

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
import tempfile
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

HOME = Path.home()
VM_BASE = HOME / ".vfkit" / "vms"

# Alpine Linux kernel package URL
ALPINE_VERSION = "3.19"
ALPINE_REPO = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/main/aarch64"
KERNEL_PKG = "linux-virt-6.6.60-r0.apk"  # Update version as needed


def download_and_extract_kernel(kernel_dir: Path) -> bool:
    """Download Alpine kernel package and extract raw kernel."""
    logger.info("  📥 Downloading Alpine kernel package...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        pkg_path = tmpdir_path / "kernel.apk"
        
        # Download kernel package
        try:
            # First, get the latest kernel package name
            logger.info("  🔍 Finding latest kernel package...")
            result = subprocess.run(
                ["curl", "-sL", f"{ALPINE_REPO}/"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Parse HTML to find linux-virt package
            kernel_packages = [line for line in result.stdout.split('\n') if 'linux-virt-' in line and '.apk' in line]
            if not kernel_packages:
                logger.error("  ❌ Could not find kernel package")
                return False
            
            # Extract package name from HTML
            import re
            match = re.search(r'linux-virt-[\d\.]+-r\d+\.apk', kernel_packages[0])
            if not match:
                logger.error("  ❌ Could not parse kernel package name")
                return False
            
            kernel_pkg_name = match.group(0)
            kernel_url = f"{ALPINE_REPO}/{kernel_pkg_name}"
            
            logger.info(f"  📦 Downloading {kernel_pkg_name}...")
            result = subprocess.run(
                ["curl", "-L", "-o", str(pkg_path), kernel_url],
                capture_output=True,
                timeout=60
            )
            
            if result.returncode != 0:
                logger.error(f"  ❌ Download failed: {result.stderr.decode()}")
                return False
            
        except Exception as e:
            logger.error(f"  ❌ Failed to download: {e}")
            return False
        
        # Extract APK (it's just a tar.gz)
        logger.info("  📂 Extracting package...")
        extract_dir = tmpdir_path / "extracted"
        extract_dir.mkdir()
        
        try:
            subprocess.run(
                ["tar", "-xzf", str(pkg_path), "-C", str(extract_dir)],
                check=True,
                capture_output=True
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"  ❌ Extraction failed: {e.stderr.decode()}")
            return False
        
        # Find the kernel file
        boot_dir = extract_dir / "boot"
        if not boot_dir.exists():
            logger.error("  ❌ No boot directory in package")
            return False
        
        kernel_candidates = list(boot_dir.glob("vmlinuz-*"))
        if not kernel_candidates:
            logger.error("  ❌ No kernel found in package")
            return False
        
        source_kernel = kernel_candidates[0]
        logger.info(f"  ✅ Found kernel: {source_kernel.name}")
        
        # Copy to destination
        dest_kernel = kernel_dir / "vmlinux"
        
        # Check if it's gzipped and decompress if needed
        with open(source_kernel, 'rb') as f:
            magic = f.read(2)
        
        if magic == b'\x1f\x8b':
            logger.info("  🔓 Decompressing kernel...")
            with gzip.open(source_kernel, 'rb') as f_in:
                with open(dest_kernel, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
        else:
            logger.info("  📋 Copying kernel...")
            shutil.copy2(source_kernel, dest_kernel)
        
        logger.info(f"  ✅ Kernel extracted to {dest_kernel}")
        return True


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
    
    # Check kernel type
    result = subprocess.run(
        ["file", str(kernel_path)],
        capture_output=True,
        text=True
    )
    kernel_type = result.stdout
    
    logger.info(f"  Current kernel type: {kernel_type.split(':')[1].strip()}")
    
    # If it's EFI or anything other than raw ARM64, replace it
    if "EFI" in kernel_type or "PE32" in kernel_type:
        logger.info("  🔄 EFI executable detected, need raw ARM64 kernel")
        
        # Backup original
        backup_path = kernel_dir / "vmlinux.efi.bak"
        if not backup_path.exists():
            logger.info(f"  📦 Backing up EFI kernel...")
            shutil.copy2(kernel_path, backup_path)
        
        # Download and extract proper kernel
        if download_and_extract_kernel(kernel_dir):
            # Verify new kernel
            result = subprocess.run(
                ["file", str(kernel_path)],
                capture_output=True,
                text=True
            )
            new_type = result.stdout.split(':')[1].strip()
            logger.info(f"  📊 New kernel type: {new_type}")
            
            if "ARM aarch64" in new_type or "data" in new_type:
                logger.info(f"  ✅ {vm_name} kernel fixed!")
                return True
            else:
                logger.error(f"  ❌ New kernel is still wrong type: {new_type}")
                return False
        else:
            return False
    else:
        logger.info(f"  ✅ Kernel is already correct format")
        return True


def main() -> int:
    """Main entry point."""
    logger.info("🔧 Extracting Raw ARM64 Kernels for vfkit")
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

