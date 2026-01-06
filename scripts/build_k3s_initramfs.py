#!/usr/bin/env python3
"""
Build K3s initramfs for ARM64 with Datadog tracing.

Creates a lightweight Kubernetes VM for service deployment.
"""

import os
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
import logging

# Datadog tracing
from ddtrace import tracer, patch_all
patch_all()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@tracer.wrap(service='vibecode-vm-builder', resource='build_k3s_vm')
def build_k3s_vm() -> bool:
    """Build K3s VM initramfs with full tracing."""
    
    with tracer.trace('setup_directories'):
        project_root = Path(__file__).parent.parent
        work_dir = Path(tempfile.mkdtemp())
        initramfs_dir = work_dir / 'initramfs'
        initramfs_dir.mkdir(parents=True)
        
        logger.info(f"Working directory: {work_dir}")
    
    try:
        # Download Alpine base
        with tracer.trace('download_alpine_base'):
            alpine_file = Path("/tmp/alpine-minirootfs-3.19-aarch64.tar.gz")
            if not alpine_file.exists():
                logger.info("Downloading Alpine Linux base...")
                url = "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-minirootfs-3.19.0-aarch64.tar.gz"
                subprocess.run(
                    ['curl', '-L', url, '-o', str(alpine_file)],
                    check=True,
                    capture_output=True
                )
                logger.info("✅ Alpine downloaded")
        
        # Extract Alpine
        with tracer.trace('extract_alpine'):
            logger.info("Extracting Alpine base...")
            subprocess.run(
                ['tar', '-xzf', str(alpine_file), '-C', str(initramfs_dir)],
                check=True,
                capture_output=True
            )
            logger.info("✅ Alpine extracted")
        
        # Download K3s
        with tracer.trace('download_k3s'):
            logger.info("Downloading K3s...")
            k3s_dir = initramfs_dir / 'usr' / 'local' / 'bin'
            k3s_dir.mkdir(parents=True, exist_ok=True)
            k3s_file = k3s_dir / 'k3s'
            
            subprocess.run([
                'curl', '-L',
                'https://github.com/k3s-io/k3s/releases/download/v1.29.0+k3s1/k3s-arm64',
                '-o', str(k3s_file)
            ], check=True, capture_output=True)
            
            k3s_file.chmod(0o755)
            size_mb = k3s_file.stat().st_size / (1024 * 1024)
            logger.info(f"✅ K3s downloaded ({size_mb:.0f}MB)")
        
        # Download Helm
        with tracer.trace('download_helm'):
            logger.info("Downloading Helm...")
            helm_tar = work_dir / 'helm.tar.gz'
            subprocess.run([
                'curl', '-L',
                'https://get.helm.sh/helm-v3.13.0-linux-arm64.tar.gz',
                '-o', str(helm_tar)
            ], check=True, capture_output=True)
            
            subprocess.run(
                ['tar', '-xz', '-C', str(work_dir)],
                stdin=open(helm_tar, 'rb'),
                check=True
            )
            
            helm_bin = work_dir / 'linux-arm64' / 'helm'
            shutil.copy2(helm_bin, k3s_dir / 'helm')
            (k3s_dir / 'helm').chmod(0o755)
            logger.info("✅ Helm downloaded")
        
        # Create init script
        with tracer.trace('create_init_script'):
            logger.info("Creating init script...")
            init_script = '''#!/bin/sh
set -e

echo "=== Booting K3s VM (ARM64) ==="

# Mount filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var/lib/rancher/k3s

# Setup network
ip link set lo up
for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        ip link set eth0 up
        udhcpc -i eth0 -n -q || true
        break
    fi
    sleep 1
done

VM_IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo "unknown")
echo "Network: $VM_IP"

# Install tools
apk update
apk add --no-cache bash curl git vim sudo openssh python3 docker-cli jq htop || true

# Start K3s
echo "Starting K3s..."
/usr/local/bin/k3s server --disable traefik --disable servicelb --write-kubeconfig-mode 644 --data-dir /var/lib/rancher/k3s &

# Wait for K3s
export KUBECONFIG=/var/lib/rancher/k3s/agent/kubeconfig.yaml
for i in $(seq 1 60); do
    if /usr/local/bin/k3s kubectl get nodes >/dev/null 2>&1; then
        echo "✅ K3s ready"
        break
    fi
    sleep 1
done

# Add Helm repos
/usr/local/bin/helm repo add bitnami https://charts.bitnami.com/bitnami
/usr/local/bin/helm repo update

echo ""
echo "=== K3s VM Ready ==="
echo "IP: $VM_IP"
echo "K3s: kubectl --kubeconfig=$KUBECONFIG get pods"
echo ""

exec /bin/sh
'''
            init_file = initramfs_dir / 'init'
            init_file.write_text(init_script)
            init_file.chmod(0o755)
            logger.info("✅ Init script created")
        
        # Build initramfs
        with tracer.trace('build_initramfs'):
            logger.info("Building initramfs...")
            output_file = work_dir / 'k3s-base.cpio.gz'
            
            proc = subprocess.Popen(
                ['find', '.', '-print'],
                cwd=str(initramfs_dir),
                stdout=subprocess.PIPE
            )
            
            proc2 = subprocess.Popen(
                ['cpio', '-o', '-H', 'newc'],
                stdin=proc.stdout,
                stdout=subprocess.PIPE,
                cwd=str(initramfs_dir)
            )
            
            proc3 = subprocess.Popen(
                ['gzip'],
                stdin=proc2.stdout,
                stdout=open(output_file, 'wb'),
                cwd=str(initramfs_dir)
            )
            
            proc3.communicate()
            
            size_mb = output_file.stat().st_size / (1024 * 1024)
            logger.info(f"✅ Initramfs created: {size_mb:.1f}MB")
        
        # Copy to azure directory
        with tracer.trace('copy_to_azure'):
            azure_dir = project_root / 'azure'
            azure_dir.mkdir(exist_ok=True)
            dest = azure_dir / 'k3s-base.cpio.gz'
            shutil.copy2(output_file, dest)
            logger.info(f"✅ Copied to {dest}")
        
        logger.info("")
        logger.info("=== Build Complete ===")
        logger.info(f"Output: azure/k3s-base.cpio.gz ({size_mb:.1f}MB)")
        
        return True
        
    except Exception as e:
        logger.error(f"Build failed: {e}")
        tracer.current_span().set_tag('error', True)
        tracer.current_span().set_tag('error.message', str(e))
        return False
    finally:
        if work_dir.exists():
            shutil.rmtree(work_dir)


if __name__ == '__main__':
    tracer.configure(
        hostname='localhost',
        port=8126,
    )
    
    success = build_k3s_vm()
    sys.exit(0 if success else 1)

