#!/usr/bin/env python3
"""
Validate GRUB EFI Bootloader Installation on Alpine Linux Disk Images

This script validates that a disk image has GRUB properly installed and
configured for EFI boot with Virtualization.framework.

Usage:
    python validate-grub-installation.py <disk_image_path> [efi_store_path]

Example:
    python validate-grub-installation.py ~/.vfkit/vms/vibecode-postgresql/disk/root.img
"""

import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional, Tuple, List
import json

# Try to import ddtrace for observability
try:
    import ddtrace
    from ddtrace import tracer
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    print("⚠️  ddtrace not available, running without tracing", file=sys.stderr)


class Colors:
    """ANSI color codes for terminal output"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class GRUBValidator:
    """Validates GRUB installation on Alpine Linux disk images"""
    
    def __init__(self, disk_path: Path, efi_store_path: Optional[Path] = None):
        self.disk_path = Path(disk_path)
        self.efi_store_path = Path(efi_store_path) if efi_store_path else None
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
        
    def validate(self) -> Tuple[bool, dict]:
        """
        Run all validation checks
        
        Returns:
            Tuple of (is_valid, results_dict)
        """
        if DDTRACE_AVAILABLE:
            with tracer.trace("grub_validation.validate", service="vibecode-vm") as span:
                span.set_tag("disk_path", str(self.disk_path))
                span.set_tag("efi_store_path", str(self.efi_store_path))
                return self._validate_internal(span)
        else:
            return self._validate_internal()
    
    def _validate_internal(self, span=None):
        """Internal validation logic"""
        results = {
            "disk_exists": False,
            "disk_readable": False,
            "partition_structure": False,
            "esp_partition": False,
            "grub_installed": False,
            "efi_store_exists": False,
            "efi_store_valid": False,
        }
        
        # Check 1: Disk image exists
        if span:
            span.set_tag("check", "disk_exists")
        if not self._check_disk_exists():
            return False, results
        results["disk_exists"] = True
        
        # Check 2: Disk is readable
        if span:
            span.set_tag("check", "disk_readable")
        if not self._check_disk_readable():
            return False, results
        results["disk_readable"] = True
        
        # Check 3: Partition structure
        if span:
            span.set_tag("check", "partition_structure")
        if not self._check_partition_structure():
            self.warnings.append("Partition structure check failed - disk may need partitioning")
        else:
            results["partition_structure"] = True
        
        # Check 4: ESP partition exists
        if span:
            span.set_tag("check", "esp_partition")
        esp_partition = self._check_esp_partition()
        if esp_partition:
            results["esp_partition"] = True
        
        # Check 5: GRUB installed
        if span:
            span.set_tag("check", "grub_installed")
        grub_installed = self._check_grub_installed()
        if grub_installed:
            results["grub_installed"] = True
        
        # Check 6: EFI store exists
        if span:
            span.set_tag("check", "efi_store")
        if self.efi_store_path:
            if self._check_efi_store_exists():
                results["efi_store_exists"] = True
                if self._check_efi_store_valid():
                    results["efi_store_valid"] = True
        
        # Determine overall validity
        is_valid = (
            results["disk_exists"] and
            results["disk_readable"] and
            results["grub_installed"]
        )
        
        if span:
            span.set_tag("validation_passed", is_valid)
            span.set_metric("errors_count", len(self.errors))
            span.set_metric("warnings_count", len(self.warnings))
        
        return is_valid, results
    
    def _check_disk_exists(self) -> bool:
        """Check if disk image file exists"""
        if not self.disk_path.exists():
            self.errors.append(f"Disk image not found: {self.disk_path}")
            return False
        
        self.info.append(f"✓ Disk image exists: {self.disk_path}")
        return True
    
    def _check_disk_readable(self) -> bool:
        """Check if disk image is readable"""
        try:
            if not self.disk_path.is_file():
                self.errors.append(f"Disk path is not a file: {self.disk_path}")
                return False
            
            # Check file size
            size = self.disk_path.stat().st_size
            if size == 0:
                self.errors.append("Disk image is empty")
                return False
            
            self.info.append(f"✓ Disk image is readable ({size / (1024**3):.2f} GB)")
            return True
        except Exception as e:
            self.errors.append(f"Cannot read disk image: {e}")
            return False
    
    def _check_partition_structure(self) -> bool:
        """Check if disk has proper GPT partition structure"""
        try:
            # Try to get partition info using diskutil (macOS)
            result = subprocess.run(
                ["hdiutil", "attach", "-imagekey", "diskimage-class=CRawDiskImage", 
                 "-nomount", str(self.disk_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                self.warnings.append("Could not attach disk to check partitions")
                return False
            
            disk_dev = result.stdout.strip().split()[0] if result.stdout.strip() else None
            if not disk_dev:
                self.warnings.append("Could not determine disk device")
                return False
            
            # Check partition table
            part_result = subprocess.run(
                ["diskutil", "list", disk_dev],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Detach disk
            subprocess.run(["hdiutil", "detach", disk_dev], 
                          capture_output=True, timeout=5)
            
            if part_result.returncode == 0:
                # Check for GPT and partitions
                output = part_result.stdout
                if "GUID_partition_scheme" in output or "GPT" in output:
                    self.info.append("✓ Disk has GPT partition table")
                    return True
                else:
                    self.warnings.append("Disk may not have GPT partition table")
                    return False
            
            return False
        except subprocess.TimeoutExpired:
            self.warnings.append("Partition check timed out")
            return False
        except Exception as e:
            self.warnings.append(f"Could not check partition structure: {e}")
            return False
    
    def _check_esp_partition(self) -> Optional[str]:
        """Check if EFI System Partition exists and return partition device"""
        try:
            result = subprocess.run(
                ["hdiutil", "attach", "-imagekey", "diskimage-class=CRawDiskImage",
                 "-nomount", str(self.disk_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return None
            
            disk_dev = result.stdout.strip().split()[0] if result.stdout.strip() else None
            if not disk_dev:
                return None
            
            # List partitions
            part_result = subprocess.run(
                ["diskutil", "list", disk_dev],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if part_result.returncode == 0:
                # Look for EFI partition (usually first partition)
                output = part_result.stdout
                lines = output.split('\n')
                for i, line in enumerate(lines):
                    if "EFI" in line or "EFI System Partition" in line:
                        # Try to find partition device (usually disk_dev + "s1")
                        esp_part = f"{disk_dev}s1"
                        self.info.append(f"✓ Found EFI System Partition: {esp_part}")
                        subprocess.run(["hdiutil", "detach", disk_dev], 
                                      capture_output=True, timeout=5)
                        return esp_part
            
            subprocess.run(["hdiutil", "detach", disk_dev], 
                          capture_output=True, timeout=5)
            self.warnings.append("EFI System Partition not found")
            return None
        except Exception as e:
            self.warnings.append(f"Could not check ESP partition: {e}")
            return None
    
    def _check_grub_installed(self) -> bool:
        """Check if GRUB EFI bootloader is installed"""
        try:
            # Attach disk
            result = subprocess.run(
                ["hdiutil", "attach", "-imagekey", "diskimage-class=CRawDiskImage",
                 "-nomount", str(self.disk_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                self.warnings.append("Could not attach disk to check GRUB")
                return False
            
            disk_dev = result.stdout.strip().split()[0] if result.stdout.strip() else None
            if not disk_dev:
                return False
            
            # Try to mount ESP partition
            esp_part = f"{disk_dev}s1"
            mount_point = None
            
            try:
                # Create temp mount point
                mount_point = Path(tempfile.mkdtemp(prefix="grub-check-"))
                
                # Try to mount ESP
                mount_result = subprocess.run(
                    ["diskutil", "mount", "-mountPoint", str(mount_point), esp_part],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if mount_result.returncode == 0:
                    # Check for GRUB files
                    grub_paths = [
                        mount_point / "EFI" / "BOOT" / "BOOTAA64.EFI",
                        mount_point / "EFI" / "BOOT" / "grubaa64.efi",
                        mount_point / "EFI" / "ALPINE" / "grubx64.efi",
                        mount_point / "EFI" / "ALPINE" / "grubaa64.efi",
                    ]
                    
                    found_grub = False
                    for grub_path in grub_paths:
                        if grub_path.exists():
                            self.info.append(f"✓ Found GRUB bootloader: {grub_path.relative_to(mount_point)}")
                            found_grub = True
                            break
                    
                    if not found_grub:
                        self.errors.append("GRUB EFI bootloader not found in ESP")
                    
                    # Unmount
                    subprocess.run(["diskutil", "unmount", str(mount_point)], 
                                  capture_output=True, timeout=5)
                    shutil.rmtree(mount_point, ignore_errors=True)
                    
                    # Detach disk
                    subprocess.run(["hdiutil", "detach", disk_dev], 
                                  capture_output=True, timeout=5)
                    
                    return found_grub
                else:
                    self.warnings.append("Could not mount ESP partition")
                    subprocess.run(["hdiutil", "detach", disk_dev], 
                                  capture_output=True, timeout=5)
                    return False
                    
            except Exception as e:
                if mount_point:
                    shutil.rmtree(mount_point, ignore_errors=True)
                subprocess.run(["hdiutil", "detach", disk_dev], 
                              capture_output=True, timeout=5)
                self.warnings.append(f"Error checking GRUB: {e}")
                return False
                
        except Exception as e:
            self.warnings.append(f"Could not check GRUB installation: {e}")
            return False
    
    def _check_efi_store_exists(self) -> bool:
        """Check if EFI variable store file exists"""
        if not self.efi_store_path:
            return False
        
        if self.efi_store_path.exists():
            self.info.append(f"✓ EFI variable store exists: {self.efi_store_path}")
            return True
        else:
            self.warnings.append(f"EFI variable store not found: {self.efi_store_path}")
            return False
    
    def _check_efi_store_valid(self) -> bool:
        """Check if EFI variable store is valid (non-empty)"""
        if not self.efi_store_path or not self.efi_store_path.exists():
            return False
        
        try:
            size = self.efi_store_path.stat().st_size
            if size > 0:
                self.info.append(f"✓ EFI variable store is valid ({size} bytes)")
                return True
            else:
                self.warnings.append("EFI variable store is empty")
                return False
        except Exception as e:
            self.warnings.append(f"Could not validate EFI store: {e}")
            return False
    
    def print_report(self):
        """Print validation report"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}GRUB Installation Validation Report{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        
        print(f"Disk Image: {self.disk_path}")
        if self.efi_store_path:
            print(f"EFI Store: {self.efi_store_path}")
        print()
        
        # Print info messages
        for msg in self.info:
            print(f"{Colors.GREEN}{msg}{Colors.NC}")
        
        # Print warnings
        for msg in self.warnings:
            print(f"{Colors.YELLOW}⚠ {msg}{Colors.NC}")
        
        # Print errors
        for msg in self.errors:
            print(f"{Colors.RED}❌ {msg}{Colors.NC}")
        
        print()


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python validate-grub-installation.py <disk_image_path> [efi_store_path]")
        sys.exit(1)
    
    disk_path = Path(sys.argv[1])
    efi_store_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    validator = GRUBValidator(disk_path, efi_store_path)
    is_valid, results = validator.validate()
    
    validator.print_report()
    
    # Print summary
    if is_valid:
        print(f"{Colors.GREEN}✅ Validation PASSED{Colors.NC}")
        print("\nGRUB is properly installed and configured for EFI boot.")
    else:
        print(f"{Colors.RED}❌ Validation FAILED{Colors.NC}")
        print("\nGRUB installation issues detected. Run install-grub-alpine.py to fix.")
    
    # Output JSON for programmatic use
    if "--json" in sys.argv:
        output = {
            "valid": is_valid,
            "results": results,
            "errors": validator.errors,
            "warnings": validator.warnings,
            "info": validator.info
        }
        print(json.dumps(output, indent=2))
    
    sys.exit(0 if is_valid else 1)


if __name__ == "__main__":
    main()

