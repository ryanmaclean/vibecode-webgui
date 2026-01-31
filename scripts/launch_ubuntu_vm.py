#!/usr/bin/env python3
import os
import sys
import logging
import subprocess
import urllib.request
import shutil
import time
from pathlib import Path

# Configure Logging
VM_DIR = Path.home() / "VibeCode" / "UbuntuVM"
VM_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [UBUNTU-VM] %(message)s')
logger = logging.getLogger()

# File Logging (Audit #1530)
log_file = VM_DIR / "console.log"
file_handler = logging.FileHandler(log_file)
file_handler.setFormatter(logging.Formatter('%(asctime)s [UBUNTU-VM] %(message)s'))
logger.addHandler(file_handler)

# Telemetry (Audit #1525)
# Add scripts dir to path to find vibecode package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry("ubuntu-vm")
    logger.info("✅ Telemetry initialized")
except ImportError:
    logger.warning("⚠️  Telemetry module not found. Tracing disabled.")

# Configuration
WORKSPACE_DIR = Path.home() / "VibeCode" / "Workspace"
UBUNTU_RELEASE = "noble" # 24.04
BASE_URL = f"https://cloud-images.ubuntu.com/minimal/releases/{UBUNTU_RELEASE}/release"
IMAGE_URL = f"{BASE_URL}/ubuntu-24.04-minimal-cloudimg-arm64.img"
KERNEL_URL = f"{BASE_URL}/unpacked/ubuntu-24.04-minimal-cloudimg-arm64-vmlinuz-generic"
INITRD_URL = f"{BASE_URL}/unpacked/ubuntu-24.04-minimal-cloudimg-arm64-initrd-generic"

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

def create_seed_iso(vm_dir):
    """Create cloud-init seed ISO."""
    seed_dir = vm_dir / "seed"
    seed_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. meta-data
    (seed_dir / "meta-data").write_text("instance-id: vibecode-ubuntu\nlocal-hostname: vibecode-ubuntu\n")
    
    # 2. user-data
    ssh_key_path = Path.home() / ".ssh" / "id_rsa.pub"
    ssh_key = ""
    if ssh_key_path.exists():
        ssh_key = ssh_key_path.read_text().strip()
    else:
        logger.warning("⚠️  No SSH key found at ~/.ssh/id_rsa.pub. SSH access might be limited.")

    user_data = f"""#cloud-config
hostname: vibecode-ubuntu
fqdn: vibecode-ubuntu.local
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
"""
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
    if not check_dependencies():
        return

    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    
    kernel = VM_DIR / "vmlinuz"
    initrd = VM_DIR / "initrd"
    disk = VM_DIR / "disk.img"
    
    # Download assets
    download_file(KERNEL_URL, kernel)
    download_file(INITRD_URL, initrd)
    
    if not disk.exists():
        download_file(IMAGE_URL, disk)
        logger.info("💿 Resizing disk to 20GB...")
        subprocess.run(["truncate", "-s", "20G", str(disk)])
    
    # Create Seed ISO
    seed_iso = create_seed_iso(VM_DIR)
    
    # Launch vfkit
    cmd = [
        "vfkit",
        "--cpus", "2",
        "--memory", "2048",
        "--bootline", "console=hvc0 root=/dev/vda1 rw",
        "--kernel", str(kernel),
        "--initrd", str(initrd),
        "--disk", str(disk),
        "--device", f"file,path={seed_iso}", # Attach ISO as second disk
        "--device", f"virtiofs,path={WORKSPACE_DIR},tag=vibecode", # Mount workspace
        "--net", "nat",
    ]
    
    logger.info("🚀 Launching Ubuntu VM...")
    logger.info(f"   📂 Mounting {WORKSPACE_DIR} -> /home/vibecode/workspace")
    logger.info("   (Press Ctrl+C to stop)")
    
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        logger.info("\n🛑 VM Stopped")

if __name__ == "__main__":
    launch()
