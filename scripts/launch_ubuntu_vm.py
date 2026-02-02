#!/usr/bin/env python3
import os
import sys
import logging
import subprocess
import urllib.request
import shutil
import time
import argparse
from pathlib import Path
from textwrap import dedent

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

# Configuration
WORKSPACE_DIR = Path.home() / "VibeCode" / "Workspace"
UBUNTU_RELEASE = "noble" # 24.04
BASE_URL = f"https://cloud-images.ubuntu.com/releases/{UBUNTU_RELEASE}/release"
IMAGE_URL = f"{BASE_URL}/ubuntu-24.04-server-cloudimg-arm64.img"
KERNEL_URL = f"{BASE_URL}/unpacked/ubuntu-24.04-server-cloudimg-arm64-vmlinuz-generic"
INITRD_URL = f"{BASE_URL}/unpacked/ubuntu-24.04-server-cloudimg-arm64-initrd-generic"

logger = logging.getLogger()

def setup_logging(log_file):
    # Reset handlers
    logger = logging.getLogger()
    logger.handlers = []
    
    # File Handler
    log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(logging.Formatter('%(asctime)s [UBUNTU-VM] %(message)s'))
    logger.addHandler(file_handler)
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter('%(asctime)s [UBUNTU-VM] %(message)s'))
    logger.addHandler(console_handler)
    
    logger.setLevel(logging.INFO)
    return logger

def check_dependencies():
    """Check for required tools."""
    if not shutil.which("vfkit"):
        logger.error("❌ vfkit not found. Please install: brew install vfkit")
        return False
    if not shutil.which("hdiutil"):
        logger.error("❌ hdiutil not found. Are you on macOS?")
        return False
    return True

def download_file(url, dest):
    """Download a file with progress logging."""
    if dest.exists():
        logger.info(f"✅ Found existing {dest.name}")
        return
    
    logger.info(f"📥 Downloading {url}...")
    try:
        urllib.request.urlretrieve(url, dest)
        logger.info(f"✅ Downloaded {dest.name}")
    except Exception as e:
        logger.error(f"❌ Failed to download {url}: {e}")
        sys.exit(1)

def create_seed_iso(vm_dir, vm_name):
    """Create cloud-init seed ISO."""
    seed_dir = vm_dir / "seed"
    seed_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. meta-data
    (seed_dir / "meta-data").write_text(f"instance-id: {vm_name}\nlocal-hostname: {vm_name}\n")
    
    # 2. user-data
    ssh_key_path = Path.home() / ".ssh" / "id_rsa.pub"
    ssh_key = ""
    if ssh_key_path.exists():
        ssh_key = ssh_key_path.read_text().strip()
    else:
        logger.warning("⚠️  No SSH key found at ~/.ssh/id_rsa.pub. SSH access might be limited.")

    user_data = dedent(f"""\
        #cloud-config
        hostname: {vm_name}
        fqdn: {vm_name}.local
        manage_etc_hosts: true

        users:
          - name: vibecode
            gecos: VibeCode Developer
            sudo: ALL=(ALL) NOPASSWD:ALL
            shell: /bin/bash
            lock_passwd: false
            ssh_authorized_keys:
              - {ssh_key}

        packages:
          - docker.io
          - socat
          - avahi-daemon
          - curl
          - git
          - virtiofs-tools

        # Configure Docker to listen on TCP 2375
        write_files:
          - path: /etc/systemd/system/docker.service.d/override.conf
            content: |
              [Service]
              ExecStart=
              ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2375
            owner: root:root
            permissions: '0644'

        runcmd:
          - systemctl daemon-reload
          - systemctl restart docker
          # Mount virtiofs share
          - mkdir -p /home/vibecode/workspace
          - chown vibecode:vibecode /home/vibecode/workspace
          - echo "vibecode /home/vibecode/workspace virtiofs defaults 0 0" >> /etc/fstab
          - mount -a || echo "⚠️ Failed to mount workspace"
          - echo "✅ VibeCode Setup Complete"
    """)
    (seed_dir / "user-data").write_text(user_data)
    
    # 3. Create ISO
    iso_path = vm_dir / "seed.iso"
    if iso_path.exists():
        iso_path.unlink()
        
    cmd = [
        "hdiutil", "makehybrid",
        "-o", str(iso_path),
        "-hfs", "-joliet", "-iso",
        "-default-volume-name", "cidata",
        str(seed_dir)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    logger.info(f"✅ Created cloud-init seed ISO: {iso_path}")
    
    # Cleanup seed dir
    shutil.rmtree(seed_dir)
    return iso_path

def launch():
    parser = argparse.ArgumentParser(description="Launch VibeCode Ubuntu VM")
    parser.add_argument("--name", default="default", help="VM Instance Name")
    args = parser.parse_args()

    vm_name = args.name
    vm_base_dir = Path.home() / "VibeCode" / "VMs"
    vm_dir = vm_base_dir / vm_name
    
    # Migration Logic
    old_vm_dir = Path.home() / "VibeCode" / "UbuntuVM"
    if vm_name == "default" and old_vm_dir.exists() and not vm_dir.exists():
        print("📦 Migrating legacy VM to new structure...")
        vm_base_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(old_vm_dir), str(vm_dir))

    vm_dir.mkdir(parents=True, exist_ok=True)
    log_file = vm_dir / "console.log"
    setup_logging(log_file)

    if not check_dependencies():
        return

    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    
    kernel = vm_dir / "vmlinuz"
    initrd = vm_dir / "initrd"
    disk = vm_dir / "disk.img"
    
    # Download assets
    download_file(KERNEL_URL, kernel)
    download_file(INITRD_URL, initrd)
    
    # Decompress kernel if needed
    kernel_uncompressed = vm_dir / "vmlinux"
    if not kernel_uncompressed.exists():
        logger.info("📦 Decompressing kernel...")
        with open(kernel, 'rb') as f_in:
            import gzip
            with open(kernel_uncompressed, 'wb') as f_out:
                shutil.copyfileobj(gzip.GzipFile(fileobj=f_in), f_out)
    
    disk_raw = vm_dir / "disk.raw"
    if not disk_raw.exists():
        if not disk.exists():
            download_file(IMAGE_URL, disk)
        
        logger.info("💿 Converting QCOW2 to RAW...")
        subprocess.run(["qemu-img", "convert", "-f", "qcow2", "-O", "raw", str(disk), str(disk_raw)], check=True)
         
        logger.info("💿 Resizing disk to 20GB...")
        subprocess.run(["truncate", "-s", "20G", str(disk_raw)])
    
    # Create Seed ISO
    seed_iso = create_seed_iso(vm_dir, vm_name)
    
    # Launch vfkit
    cmd = [
        "vfkit",
        "--cpus", "2",
        "--memory", "2048",
        "--kernel-cmdline", "console=hvc0 root=/dev/vda1 rw",
        "--kernel", str(kernel_uncompressed),
        "--initrd", str(initrd),
        "--device", f"virtio-blk,path={disk_raw}",
        "--device", f"virtio-blk,path={seed_iso}", # Attach ISO as second disk
        "--device", f"virtio-fs,sharedDir={WORKSPACE_DIR},mountTag=vibecode", # Mount workspace
        "--device", "virtio-net,nat",
    ]
    
    logger.info(f"🚀 Launching Ubuntu VM ({vm_name})...")
    logger.info(f"   📂 Mounting {WORKSPACE_DIR} -> /home/vibecode/workspace")
    logger.info(f"   📄 Console logs to: {log_file}")
    logger.info("   (Press Ctrl+C to stop)")
    
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        logger.info("\n🛑 VM Stopped")

if __name__ == "__main__":
    launch()
