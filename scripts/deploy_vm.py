#!/usr/bin/env python3
"""VM Deployment Script - deploys any VM for testing or production use."""

import argparse
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path


class VMDeployer:
    def __init__(self, vm_name: str, initramfs: str):
        self.vm_name = vm_name
        self.initramfs = initramfs
        self.azure_dir = Path.home() / "vibecode-webgui" / "azure"

    def run(self):
        print(f"=== Deploying {self.vm_name} VM ===")
        print(f"Initramfs: {self.initramfs}")

        initramfs_path = self.azure_dir / self.initramfs
        if not initramfs_path.exists():
            print(f"ERROR: Initramfs not found: {initramfs_path}")
            return 1

        # Backup and copy
        os.chdir(self.azure_dir)
        nodejs_cpio = self.azure_dir / "nodejs-complete.cpio.gz"
        if nodejs_cpio.exists():
            shutil.copy2(nodejs_cpio, self.azure_dir / "nodejs-backup.cpio.gz")
        shutil.copy2(initramfs_path, nodejs_cpio)

        # Kill existing
        subprocess.run(["killall", "NodeJSVibeCode"], capture_output=True)

        # Launch VM
        print("Launching VM...")
        app_path = self.azure_dir / "SwiftUI-Apps" / "NodeJSVibeCode.app" / "Contents" / "MacOS" / "NodeJSVibeCode"
        proc = subprocess.Popen(
            [str(app_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        print(f"""
VM launched (PID: {proc.pid})

Wait 30-60 seconds for boot, then check:
  Console: tail -f /tmp/vibecode-console-*.log
  Network: for ip in 192.168.64.{{1..10}}; do ping -c 1 $ip 2>/dev/null && echo "Found: $ip"; done
""")
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy VM for testing")
    parser.add_argument("vm_name", help="VM name (e.g., valkey, postgresql, unified)")
    parser.add_argument("initramfs", help="Initramfs file (e.g., valkey-standalone-complete.cpio.gz)")
    args = parser.parse_args()

    if not args.vm_name or not args.initramfs:
        parser.print_help()
        print("\nExamples:")
        print("  deploy_vm.py valkey valkey-standalone-complete.cpio.gz")
        print("  deploy_vm.py postgresql postgresql-standalone-complete.cpio.gz")
        sys.exit(1)

    sys.exit(VMDeployer(args.vm_name, args.initramfs).run())
