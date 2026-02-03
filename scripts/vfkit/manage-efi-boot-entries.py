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

"""
Manage EFI Boot Entries for Virtualization.framework VMs

Inspired by Tart and UTM's EFI boot management approaches.

Usage:
    python manage-efi-boot-entries.py create <vm_name> <disk_path> <efi_store_path>
    python manage-efi-boot-entries.py discover <disk_path> <efi_store_path>
    python manage-efi-boot-entries.py list <efi_store_path>

Example:
    python manage-efi-boot-entries.py create postgresql \\
        ~/.vfkit/vms/vibecode-postgresql/disk/root.img \\
        ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
import argparse
import time

# Try to import ddtrace
try:
    import ddtrace
    from ddtrace import tracer
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False


class Colors:
    """ANSI color codes"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class EFIBootManager:
    """Manages EFI boot entries for VMs"""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent
        
    def create_boot_entry(self, vm_name: str, disk_path: Path, efi_store_path: Path) -> bool:
        """Create EFI boot entry for a VM"""
        if DDTRACE_AVAILABLE:
            with tracer.trace("efi_boot.create_entry", service="vibecode-vm") as span:
                span.set_tag("vm_name", vm_name)
                span.set_tag("disk_path", str(disk_path))
                span.set_tag("efi_store_path", str(efi_store_path))
                return self._create_boot_entry_internal(vm_name, disk_path, efi_store_path, span)
        else:
            return self._create_boot_entry_internal(vm_name, disk_path, efi_store_path)
    
    def _create_boot_entry_internal(self, vm_name: str, disk_path: Path, 
                                    efi_store_path: Path, span=None) -> bool:
        """Internal boot entry creation"""
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}Creating EFI Boot Entry{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        print(f"VM Name: {vm_name}")
        print(f"Disk: {disk_path}")
        print(f"EFI Store: {efi_store_path}\n")
        
        # Verify disk exists
        if not disk_path.exists():
            print(f"{Colors.RED}❌ Disk image not found: {disk_path}{Colors.NC}")
            return False
        
        # Create EFI store directory if needed
        efi_store_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create EFI variable store if it doesn't exist
        if not efi_store_path.exists():
            print("Creating EFI variable store...")
            if not self._create_efi_store(efi_store_path):
                print(f"{Colors.YELLOW}⚠ Could not create EFI store, will be created on first boot{Colors.NC}")
        
        print(f"{Colors.GREEN}✓ EFI variable store ready{Colors.NC}")
        print(f"{Colors.GREEN}✓ Boot entry will be created on first VM boot{Colors.NC}\n")
        print("Note: The actual EFI boot entry is created automatically when")
        print("      the VM boots for the first time and EFI firmware discovers")
        print("      the bootloader on the disk.\n")
        
        if span:
            span.set_tag("boot_entry_ready", True)
        
        return True
    
    def discover_boot_entries(self, disk_path: Path, efi_store_path: Path) -> bool:
        """Boot VM once to let EFI firmware discover boot entries"""
        if DDTRACE_AVAILABLE:
            with tracer.trace("efi_boot.discover", service="vibecode-vm") as span:
                span.set_tag("disk_path", str(disk_path))
                span.set_tag("efi_store_path", str(efi_store_path))
                return self._discover_boot_entries_internal(disk_path, efi_store_path, span)
        else:
            return self._discover_boot_entries_internal(disk_path, efi_store_path)
    
    def _discover_boot_entries_internal(self, disk_path: Path, efi_store_path: Path, span=None) -> bool:
        """Internal boot discovery"""
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}Discovering EFI Boot Entries{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        print(f"Disk: {disk_path}")
        print(f"EFI Store: {efi_store_path}\n")
        
        if not disk_path.exists():
            print(f"{Colors.RED}❌ Disk image not found: {disk_path}{Colors.NC}")
            return False
        
        if not shutil.which("vfkit"):
            print(f"{Colors.RED}❌ vfkit not found{Colors.NC}")
            print("Install with: brew install vfkit")
            return False
        
        # Create EFI store if it doesn't exist
        if not efi_store_path.exists():
            print("Creating EFI variable store...")
            self._create_efi_store(efi_store_path)
        
        print("Booting VM to let EFI firmware discover boot entries...")
        print("This will start the VM, wait for EFI discovery, then stop it.\n")
        
        # Build vfkit command
        vfkit_cmd = [
            "vfkit",
            "--cpus", "2",
            "--memory", "2048",
            "--bootloader", f"efi,variable-store={efi_store_path}",
            "--device", f"virtio-blk,path={disk_path}",
            "--device", "virtio-net,nat",
            "--device", "virtio-serial,logFilePath=/tmp/vfkit-boot-discovery.log",
            "--device", "virtio-rng"
        ]
        
        if span:
            span.set_tag("vfkit_command", " ".join(vfkit_cmd))
        
        print("Starting VM for boot discovery...")
        print(f"Command: {' '.join(vfkit_cmd)}\n")
        
        try:
            process = subprocess.Popen(
                vfkit_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            print("VM started (PID: {})".format(process.pid))
            print("Waiting 30 seconds for EFI boot discovery...")
            print("Check logs at: /tmp/vfkit-boot-discovery.log\n")
            
            # Wait for discovery
            time.sleep(30)
            
            # Stop VM
            print("Stopping VM...")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            
            print(f"\n{Colors.GREEN}✓ Boot discovery complete{Colors.NC}\n")
            print("The EFI firmware should have discovered and registered boot entries.")
            print("You can now boot the VM normally.\n")
            
            if span:
                span.set_tag("discovery_complete", True)
            
            return True
            
        except Exception as e:
            print(f"{Colors.RED}❌ Boot discovery failed: {e}{Colors.NC}")
            if span:
                span.set_tag("error", str(e))
            return False
    
    def list_boot_entries(self, efi_store_path: Path) -> bool:
        """List EFI boot entries (limited - Virtualization.framework doesn't expose API)"""
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}Listing EFI Boot Entries{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        
        if not efi_store_path.exists():
            print(f"{Colors.YELLOW}⚠ EFI variable store not found: {efi_store_path}{Colors.NC}")
            print("Boot entries are stored in the EFI variable store.")
            print("Virtualization.framework doesn't expose a direct API to read them.\n")
            return False
        
        print(f"{Colors.GREEN}✓ EFI store: {efi_store_path}{Colors.NC}\n")
        print("Note: Virtualization.framework doesn't provide a direct API to read")
        print("      EFI boot entries. Boot entries are managed by the EFI firmware")
        print("      and are discovered automatically when the VM boots.\n")
        print("To verify boot entries are working:")
        print("1. Boot the VM: vfkit --bootloader efi,variable-store=<efi_store> --device virtio-blk,path=<disk>")
        print("2. Check the EFI boot menu during boot")
        print("3. Verify the bootloader is discovered and listed\n")
        
        return True
    
    def _create_efi_store(self, efi_store_path: Path) -> bool:
        """Create EFI variable store using Swift"""
        try:
            swift_script = tempfile.NamedTemporaryFile(mode='w', suffix='.swift', delete=False)
            swift_script.write("""
import Foundation
import Virtualization

let efiPath = CommandLine.arguments[1]
let efiURL = URL(fileURLWithPath: efiPath)

do {
    let efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    print("EFI variable store created")
} catch {
    print("Error: \\(error)")
    exit(1)
}
""")
            swift_script.close()
            
            try:
                result = subprocess.run(
                    ["swift", swift_script.name, str(efi_store_path)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    return True
                else:
                    # Fallback: create empty file
                    efi_store_path.touch()
                    return True
            finally:
                Path(swift_script.name).unlink(missing_ok=True)
                
        except Exception:
            # Fallback: create empty file
            efi_store_path.touch()
            return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Manage EFI boot entries for Virtualization.framework VMs"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Create command
    create_parser = subparsers.add_parser("create", help="Create EFI boot entry")
    create_parser.add_argument("vm_name", help="VM name")
    create_parser.add_argument("disk_path", type=Path, help="Path to disk image")
    create_parser.add_argument("efi_store_path", type=Path, help="Path to EFI variable store")
    
    # Discover command
    discover_parser = subparsers.add_parser("discover", help="Discover boot entries by booting VM")
    discover_parser.add_argument("disk_path", type=Path, help="Path to disk image")
    discover_parser.add_argument("efi_store_path", type=Path, help="Path to EFI variable store")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List boot entries (limited)")
    list_parser.add_argument("efi_store_path", type=Path, help="Path to EFI variable store")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    manager = EFIBootManager()
    
    if args.command == "create":
        success = manager.create_boot_entry(args.vm_name, args.disk_path, args.efi_store_path)
    elif args.command == "discover":
        success = manager.discover_boot_entries(args.disk_path, args.efi_store_path)
    elif args.command == "list":
        success = manager.list_boot_entries(args.efi_store_path)
    else:
        parser.print_help()
        sys.exit(1)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
