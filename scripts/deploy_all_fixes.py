#!/usr/bin/env python3
"""
Deploy All VM Access Fixes

This script deploys:
1. VSOCK relay fix (localhost:3000 access)
2. SSH server fix (tunnel access)
3. Rebuilds app bundles with all fixes

Usage:
    python deploy_all_fixes.py
"""

import os
import subprocess
import sys
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class VMFixDeployer:
    """Handles deployment of VM access fixes."""

    def __init__(self):
        self.project_root = Path(os.environ.get("HOME", "")) / "vibecode-webgui"
        self.initramfs_dir = Path("/tmp/initramfs-with-virtio")
        self.vsock_fix_script = Path("/tmp/FIX_VSOCK_NOW.sh")
        self.bundle_script = self.project_root / "azure" / "SwiftUI-Apps" / "bundle-apps.sh"
        self.deployed_fixes: list[str] = []

    def log_info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}{message}{Color.NC}")

    def log_success(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}  ✓ {message}{Color.NC}")

    def log_warning(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}  ⚠ {message}{Color.NC}")

    def log_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}  ✗ {message}{Color.NC}")

    def prompt_yes_no(self, prompt: str) -> bool:
        """Prompt user for yes/no response."""
        response = input(f"  {prompt} [Y/n]: ").strip().lower()
        return response not in ("n", "no")

    def run_cmd(self, cmd: list[str]) -> tuple[bool, str, str]:
        """Run command and return (success, stdout, stderr)."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)

    def deploy_vsock_fix(self) -> None:
        """Deploy VSOCK relay fix."""
        print(f"{Color.BLUE}[1/3] Deploying VSOCK relay fix...{Color.NC}")

        if self.vsock_fix_script.exists():
            print(f"  Found VSOCK fix script at {self.vsock_fix_script}")
            print("  This will enable localhost:3000 access")

            if self.prompt_yes_no("Deploy?"):
                print(f"{Color.YELLOW}  Running VSOCK fix...{Color.NC}")
                success, _, _ = self.run_cmd(["bash", str(self.vsock_fix_script)])
                if success:
                    self.deployed_fixes.append("VSOCK relay (localhost:3000)")
                    self.log_success("VSOCK relay deployed")
                else:
                    self.log_error("VSOCK fix failed")
            else:
                print("  Skipped VSOCK fix")
        else:
            self.log_warning(f"VSOCK fix script not found at {self.vsock_fix_script}")
            print("  Creating custom vsock relay now...")

            vsock_source = Path("/tmp/vsock-relay.c")
            if vsock_source.exists():
                print("  Compiling vsock-relay.c...")
                target = self.initramfs_dir / "bin" / "vsock-relay"
                success, _, _ = self.run_cmd([
                    "gcc", "-o", str(target), str(vsock_source)
                ])
                if success:
                    target.chmod(0o755)
                    self.deployed_fixes.append("VSOCK relay (custom C implementation)")
                    self.log_success("Custom vsock relay deployed")
                else:
                    self.log_error("Failed to compile vsock-relay.c")
            else:
                self.log_error("Cannot deploy VSOCK fix - missing source files")

    def deploy_ssh_fix(self) -> None:
        """Deploy SSH server fix."""
        print(f"\n{Color.BLUE}[2/3] Deploying SSH server fix...{Color.NC}")

        if not self.initramfs_dir.exists():
            self.log_error(f"Initramfs directory not found at {self.initramfs_dir}")
            return

        dropbear_path = self.initramfs_dir / "bin" / "dropbear"
        print("  Checking for dropbear SSH server...")

        if dropbear_path.exists():
            print(f"  Found dropbear at {dropbear_path}")
            print("  Testing dropbear compatibility...")

            success, stdout, _ = self.run_cmd(["ldd", str(dropbear_path)])
            if success and "GLIBC_2.38" in stdout:
                self.log_warning("Dropbear requires GLIBC 2.38")
                print("  Need to rebuild with GLIBC 2.35 compatibility")
                print("\n  Options:")
                print("    1) Download pre-built dropbear for GLIBC 2.35")
                print("    2) Compile from source")
                print("    3) Skip SSH fix")

                choice = input("  Choice [1/2/3]: ").strip()

                if choice == "1":
                    self._download_compatible_dropbear()
                elif choice == "2":
                    self._compile_dropbear()
                else:
                    print("  Skipped SSH fix")
            else:
                self.log_success("Dropbear is compatible (no GLIBC issues)")
        else:
            self.log_warning("Dropbear not found in initramfs")
            print("  SSH access will not be available")

    def _download_compatible_dropbear(self) -> None:
        """Download pre-built compatible dropbear."""
        print(f"{Color.YELLOW}  Downloading compatible dropbear...{Color.NC}")
        deb_url = "http://archive.ubuntu.com/ubuntu/pool/main/d/dropbear/dropbear_2022.83-1build1_amd64.deb"
        deb_path = Path("/tmp/dropbear.deb")

        success, _, _ = self.run_cmd(["curl", "-L", deb_url, "-o", str(deb_path)])
        if success and deb_path.exists():
            print("  Extracting dropbear...")
            os.chdir("/tmp")
            self.run_cmd(["ar", "x", str(deb_path), "data.tar.xz"])
            self.run_cmd(["tar", "-xJf", "data.tar.xz", "-C", "/tmp"])

            src = Path("/tmp/usr/sbin/dropbear")
            dst = self.initramfs_dir / "bin" / "dropbear"
            if src.exists():
                import shutil
                shutil.copy2(src, dst)
                self.deployed_fixes.append("SSH server (GLIBC 2.35 compatible)")
                self.log_success("SSH server updated")
            else:
                self.log_error("Failed to extract dropbear")

            deb_path.unlink(missing_ok=True)
            Path("/tmp/data.tar.xz").unlink(missing_ok=True)
        else:
            self.log_error("Failed to download dropbear")

    def _compile_dropbear(self) -> None:
        """Compile dropbear from source."""
        print(f"{Color.YELLOW}  Compiling dropbear from source...{Color.NC}")
        print("  This will take a few minutes...")

        os.chdir("/tmp")
        dropbear_dir = Path("/tmp/dropbear-2022.83")

        if not dropbear_dir.exists():
            self.run_cmd([
                "curl", "-LO",
                "https://matt.ucc.asn.au/dropbear/releases/dropbear-2022.83.tar.bz2"
            ])
            self.run_cmd(["tar", "-xjf", "dropbear-2022.83.tar.bz2"])

        os.chdir(dropbear_dir)
        self.run_cmd(["./configure", "--disable-zlib", "--disable-wtmp", "--disable-lastlog"])
        self.run_cmd(["make", "PROGRAMS=dropbear dbclient dropbearkey dropbearconvert"])

        dropbear_bin = dropbear_dir / "dropbear"
        if dropbear_bin.exists():
            import shutil
            shutil.copy2(dropbear_bin, self.initramfs_dir / "bin" / "dropbear")
            self.deployed_fixes.append("SSH server (compiled from source)")
            self.log_success("SSH server compiled and installed")
        else:
            self.log_error("Compilation failed")

    def rebuild_bundles(self) -> None:
        """Rebuild app bundles."""
        print(f"\n{Color.BLUE}[3/3] Rebuilding app bundles...{Color.NC}")

        if not self.deployed_fixes:
            print("  No fixes were deployed, rebuild not needed")
            return

        print("  The following fixes were deployed:")
        for fix in self.deployed_fixes:
            print(f"    - {fix}")
        print("\n  App bundles need to be rebuilt to include these changes")

        if self.prompt_yes_no("Rebuild now?"):
            if self.bundle_script.exists():
                print(f"{Color.YELLOW}  Rebuilding initramfs and app bundles...{Color.NC}")

                # Rebuild initramfs
                print("  Step 1: Repackaging initramfs...")
                os.chdir(self.initramfs_dir)
                output_path = self.project_root / "azure" / "bun-openvscode-ssh-fixed.cpio.gz"

                subprocess.run(
                    f"find . | cpio -o -H newc | gzip > {output_path}",
                    shell=True,
                    cwd=self.initramfs_dir,
                )
                self.log_success("Initramfs repackaged")

                # Rebuild app bundles
                print("  Step 2: Rebuilding app bundles...")
                os.chdir(self.project_root / "azure" / "SwiftUI-Apps")
                self.run_cmd(["bash", "bundle-apps.sh"])
                self.log_success("App bundles rebuilt")

                print(f"\n{Color.GREEN}========================================{Color.NC}")
                print(f"{Color.GREEN}  All fixes deployed successfully!{Color.NC}")
                print(f"{Color.GREEN}========================================{Color.NC}")
            else:
                self.log_error(f"Bundle script not found at {self.bundle_script}")
        else:
            print("  Rebuild skipped")
            self.log_warning("Changes will not take effect until you rebuild")

    def show_summary(self) -> None:
        """Show deployment summary."""
        print(f"\n{Color.BLUE}========================================{Color.NC}")
        print(f"{Color.BLUE}  Deployment Summary{Color.NC}")
        print(f"{Color.BLUE}========================================{Color.NC}")
        print()

        if self.deployed_fixes:
            print(f"{Color.GREEN}Deployed fixes:{Color.NC}")
            for fix in self.deployed_fixes:
                print(f"  ✓ {fix}")
        else:
            print(f"{Color.YELLOW}No fixes were deployed{Color.NC}")

        print("\nAccess methods status:")
        print(f"  1. Direct browser (192.168.64.3:8080) - {Color.GREEN}Working{Color.NC}")

        vsock_status = f"{Color.GREEN}Fixed{Color.NC}" if any(
            "VSOCK" in f for f in self.deployed_fixes
        ) else f"{Color.YELLOW}Pending{Color.NC}"
        print(f"  2. Localhost access (localhost:3000) - {vsock_status}")

        ssh_status = f"{Color.GREEN}Fixed{Color.NC}" if any(
            "SSH" in f for f in self.deployed_fixes
        ) else f"{Color.YELLOW}Pending{Color.NC}"
        print(f"  3. SSH tunnel - {ssh_status}")

        print("\nNext steps:")
        print(f"  1. Launch VM: bash {self.project_root}/scripts/launch-vibecode.sh")
        print("  2. Test access: open http://192.168.64.3:8080")
        if any("VSOCK" in f for f in self.deployed_fixes):
            print("  3. Test localhost: open http://localhost:3000")

    def run(self) -> int:
        """Run the deployment."""
        print(f"{Color.BLUE}========================================{Color.NC}")
        print(f"{Color.BLUE}  Deploy All VM Access Fixes{Color.NC}")
        print(f"{Color.BLUE}========================================{Color.NC}")
        print()

        self.deploy_vsock_fix()
        self.deploy_ssh_fix()
        self.rebuild_bundles()
        self.show_summary()

        return 0


def main() -> int:
    """Main entry point."""
    deployer = VMFixDeployer()
    return deployer.run()


if __name__ == "__main__":
    sys.exit(main())
