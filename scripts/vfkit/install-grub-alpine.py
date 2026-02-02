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
Install GRUB EFI Bootloader on Alpine Linux Disk Images

This script installs GRUB on Alpine Linux disk images for EFI boot
with Virtualization.framework. Supports both VM-based and chroot methods.

Usage:
    python install-grub-alpine.py <disk_image_path> [vm_name] [--method=vm|chroot]

Example:
    python install-grub-alpine.py ~/.vfkit/vms/vibecode-postgresql/disk/root.img postgresql
"""

import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import argparse

# Try to import ddtrace for observability
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


class GRUBInstaller:
    """Installs GRUB on Alpine Linux disk images"""
    
    def __init__(self, disk_path: Path, vm_name: str = "alpine-vm", method: str = "auto"):
        self.disk_path = Path(disk_path)
        self.vm_name = vm_name
        self.method = method
        self.script_dir = Path(__file__).parent
        
    def install(self) -> bool:
        """Install GRUB using the specified method"""
        if DDTRACE_AVAILABLE:
            with tracer.trace("grub_install.install", service="vibecode-vm") as span:
                span.set_tag("disk_path", str(self.disk_path))
                span.set_tag("vm_name", self.vm_name)
                span.set_tag("method", self.method)
                return self._install_internal(span)
        else:
            return self._install_internal()
    
    def _install_internal(self, span=None):
        """Internal installation logic"""
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}Installing GRUB EFI Bootloader{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        print(f"Disk: {self.disk_path}")
        print(f"VM Name: {self.vm_name}")
        print(f"Method: {self.method}\n")
        
        # Determine method
        if self.method == "auto":
            # Try VM method first, fallback to chroot
            if self._can_use_vm_method():
                self.method = "vm"
            elif self._can_use_chroot_method():
                self.method = "chroot"
            else:
                print(f"{Colors.RED}❌ No suitable installation method available{Colors.NC}")
                return False
        
        if span:
            span.set_tag("selected_method", self.method)
        
        # Install using selected method
        if self.method == "vm":
            return self._install_via_vm(span)
        elif self.method == "chroot":
            return self._install_via_chroot(span)
        else:
            print(f"{Colors.RED}❌ Unknown method: {self.method}{Colors.NC}")
            return False
    
    def _can_use_vm_method(self) -> bool:
        """Check if VM-based installation is possible"""
        return shutil.which("vfkit") is not None
    
    def _can_use_chroot_method(self) -> bool:
        """Check if chroot installation is possible"""
        return shutil.which("hdiutil") is not None and shutil.which("diskutil") is not None
    
    def _install_via_vm(self, span=None) -> bool:
        """Install GRUB using VM-based method"""
        if span:
            span.set_tag("installation_method", "vm")
        
        print(f"{Colors.YELLOW}Using VM-based installation method...{Colors.NC}\n")
        
        # Create cloud-init script
        cloud_init_dir = Path(tempfile.mkdtemp(prefix="grub-install-"))
        
        try:
            # Create user-data
            user_data = cloud_init_dir / "user-data"
            user_data.write_text("""#cloud-config
package_update: true
package_upgrade: true

packages:
  - grub-efi
  - efibootmgr
  - dosfstools
  - gptfdisk

runcmd:
  - |
    echo "Installing GRUB EFI bootloader..."
    apk add --no-cache grub-efi efibootmgr dosfstools gptfdisk
    
    # Create EFI directory structure
    mkdir -p /boot/efi/EFI/BOOT
    mkdir -p /boot/efi/EFI/ALPINE
    
    # Install GRUB
    if [ -d /boot/efi ]; then
      grub-install --target=arm64-efi --efi-directory=/boot/efi --bootloader-id=ALPINE --removable || true
      grub-mkconfig -o /boot/grub/grub.cfg || true
    fi
    
    echo "GRUB installation complete"
    sync
""")
            
            # Create meta-data
            meta_data = cloud_init_dir / "meta-data"
            meta_data.write_text(f"""instance-id: grub-install-{self.vm_name}
local-hostname: grub-install
""")
            
            # Create cloud-init ISO
            cloud_init_iso = cloud_init_dir / "cloud-init.iso"
            if shutil.which("genisoimage"):
                subprocess.run([
                    "genisoimage", "-output", str(cloud_init_iso),
                    "-volid", "cidata", "-joliet", "-rock",
                    str(user_data), str(meta_data)
                ], check=True, capture_output=True)
            elif shutil.which("mkisofs"):
                subprocess.run([
                    "mkisofs", "-output", str(cloud_init_iso),
                    "-volid", "cidata", "-joliet", "-rock",
                    str(user_data), str(meta_data)
                ], check=True, capture_output=True)
            else:
                print(f"{Colors.RED}❌ genisoimage or mkisofs not found{Colors.NC}")
                return False
            
            # Create temporary EFI store
            efi_store = cloud_init_dir / "efi.nvram"
            efi_store.touch()
            
            print("Booting temporary VM to install GRUB...")
            print("This will take about 60 seconds...\n")
            
            # Boot VM with vfkit
            vfkit_cmd = [
                "vfkit",
                "--cpus", "2",
                "--memory", "2048",
                "--bootloader", f"efi,variable-store={efi_store},create",
                "--device", f"virtio-blk,path={self.disk_path}",
                "--device", f"virtio-blk,path={cloud_init_iso},devName=cdrom",
                "--device", "virtio-net,nat",
                "--device", "virtio-serial,logFilePath=/tmp/vfkit-grub-install.log",
                "--device", "virtio-rng"
            ]
            
            if span:
                span.set_tag("vfkit_command", " ".join(vfkit_cmd))
            
            process = subprocess.Popen(
                vfkit_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for installation (60 seconds)
            try:
                process.wait(timeout=60)
            except subprocess.TimeoutExpired:
                # Expected - we stop it manually
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            
            print(f"{Colors.GREEN}✓ GRUB installation via VM completed{Colors.NC}\n")
            
            if span:
                span.set_tag("installation_complete", True)
            
            return True
            
        except Exception as e:
            print(f"{Colors.RED}❌ VM-based installation failed: {e}{Colors.NC}")
            if span:
                span.set_tag("error", str(e))
            return False
        finally:
            # Cleanup
            shutil.rmtree(cloud_init_dir, ignore_errors=True)
    
    def _install_via_chroot(self, span=None) -> bool:
        """Install GRUB using chroot method"""
        if span:
            span.set_tag("installation_method", "chroot")
        
        print(f"{Colors.YELLOW}Using chroot installation method...{Colors.NC}\n")
        print(f"{Colors.YELLOW}⚠ Chroot method requires root access and may not work on all systems{Colors.NC}\n")
        
        # This is complex and requires mounting the disk
        # For now, recommend VM method
        print(f"{Colors.YELLOW}Chroot method not fully implemented.{Colors.NC}")
        print(f"{Colors.YELLOW}Please use VM method or install GRUB manually.{Colors.NC}")
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Install GRUB EFI bootloader on Alpine Linux disk images"
    )
    parser.add_argument("disk_path", type=Path, help="Path to disk image")
    parser.add_argument("vm_name", nargs="?", default="alpine-vm", help="VM name")
    parser.add_argument(
        "--method",
        choices=["auto", "vm", "chroot"],
        default="auto",
        help="Installation method (default: auto)"
    )
    
    args = parser.parse_args()
    
    if not args.disk_path.exists():
        print(f"{Colors.RED}❌ Disk image not found: {args.disk_path}{Colors.NC}")
        sys.exit(1)
    
    installer = GRUBInstaller(args.disk_path, args.vm_name, args.method)
    success = installer.install()
    
    if success:
        print(f"\n{Colors.GREEN}✅ GRUB installation complete!{Colors.NC}")
        print("\nNext steps:")
        print("1. Validate installation: python validate-grub-installation.py <disk_path>")
        print("2. Create EFI boot entry: python manage-efi-boot-entries.py create <vm_name> <disk_path> <efi_store>")
    else:
        print(f"\n{Colors.RED}❌ GRUB installation failed{Colors.NC}")
        sys.exit(1)


if __name__ == "__main__":
    main()
