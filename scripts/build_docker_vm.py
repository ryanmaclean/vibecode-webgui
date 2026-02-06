#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "build-docker-vm"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Build Docker VM initramfs for ARM64 with Datadog tracing.

Creates a VM that can be used as a Docker/Podman host, replacing Docker Desktop.
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


@tracer.wrap(service='vibecode-vm-builder', resource='build_docker_vm')
def build_docker_vm() -> bool:
    """Build Docker VM initramfs with full tracing."""
    
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
        
        # Configure repositories
        with tracer.trace('configure_repositories'):
            repos_file = initramfs_dir / 'etc' / 'apk' / 'repositories'
            repos_file.write_text(
                "https://dl-cdn.alpinelinux.org/alpine/v3.19/main\n"
                "https://dl-cdn.alpinelinux.org/alpine/v3.19/community\n"
            )
        
        # Create init script
        with tracer.trace('create_init_script'):
            logger.info("Creating init script...")
            init_script = '''#!/bin/sh
set -e

echo "=== Booting Docker VM (ARM64) ==="

# Mount filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var
mount -t tmpfs tmpfs /run

# Setup cgroups for Docker
mkdir -p /sys/fs/cgroup
mount -t cgroup2 none /sys/fs/cgroup

# Setup network
ip link set lo up
echo "Waiting for network..."
for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        ip link set eth0 up
        udhcpc -i eth0 -n -q || true
        break
    fi
    sleep 1
done

VM_IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo "unknown")
echo "Network configured: $VM_IP"

# Install Docker and tools on first boot
if [ ! -f /var/.docker-installed ]; then
    echo ""
    echo "Installing Docker and tools..."
    apk update
    apk add --no-cache \\
        docker \\
        docker-compose \\
        docker-cli-buildx \\
        openssh \\
        bash \\
        curl \\
        git \\
        make \\
        sudo \\
        python3 \\
        py3-pip
    
    # Enable Docker service
    rc-update add docker default
    
    # Setup SSH
    ssh-keygen -A
    echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
    echo "root:vibecode" | chpasswd
    
    touch /var/.docker-installed
    echo "✅ Docker installed"
fi

# Start Docker daemon
echo "Starting Docker daemon..."
rc-service docker start

# Wait for Docker to be ready
for i in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
        echo "✅ Docker daemon ready"
        break
    fi
    sleep 1
done

# Start SSH
echo "Starting SSH server..."
/usr/sbin/sshd

# Show status
echo ""
echo "=========================================="
echo "=== Docker VM Ready ==="
echo "=========================================="
echo "VM IP: $VM_IP"
echo ""
echo "SSH Access:"
echo "  ssh root@$VM_IP"
echo "  Password: vibecode"
echo ""
echo "Docker Access:"
echo "  export DOCKER_HOST=ssh://root@$VM_IP"
echo "  docker ps"
echo ""
echo "Or configure ~/.docker/config.json:"
echo "  {\\"hosts\\": [\\"ssh://root@$VM_IP\\"]}"
echo "=========================================="

# Keep running
exec /bin/sh
'''
            init_file = initramfs_dir / 'init'
            init_file.write_text(init_script)
            init_file.chmod(0o755)
            logger.info("✅ Init script created")
        
        # Build initramfs
        with tracer.trace('build_initramfs'):
            logger.info("Building initramfs...")
            output_file = work_dir / 'docker-vm.cpio.gz'
            
            # Create cpio archive
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
            dest = azure_dir / 'docker-vm.cpio.gz'
            shutil.copy2(output_file, dest)
            logger.info(f"✅ Copied to {dest}")
        
        logger.info("")
        logger.info("=== Build Complete ===")
        logger.info(f"Output: azure/docker-vm.cpio.gz ({size_mb:.1f}MB)")
        logger.info("")
        logger.info("Next steps:")
        logger.info("1. Create SwiftUI app: DockerVibeCode.app")
        logger.info("2. Launch VM")
        logger.info("3. Configure Docker client: export DOCKER_HOST=ssh://root@<VM_IP>")
        logger.info("4. Test: docker run hello-world")
        
        return True
        
    except Exception as e:
        logger.error(f"Build failed: {e}")
        tracer.current_span().set_tag('error', True)
        tracer.current_span().set_tag('error.message', str(e))
        return False
    finally:
        # Cleanup
        if work_dir.exists():
            shutil.rmtree(work_dir)


if __name__ == '__main__':
    tracer.configure(
        hostname='localhost',
        port=8126,
    )
    
    success = build_docker_vm()
    sys.exit(0 if success else 1)
