#!/bin/bash
# Startup script for GCP code-server instances
# This script runs on instance boot to set up code-server with Docker

set -e

# Update system packages
apt-get update
apt-get install -y docker.io docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker

# Add user to docker group
usermod -aG docker $USER

# Create workspace directory
mkdir -p /home/coder/workspace
chown -R coder:coder /home/coder/workspace

# Mount the workspace persistent disk
if [ ! -d /mnt/workspace ]; then
    mkdir -p /mnt/workspace
fi

# Check if workspace disk is already mounted
if ! mountpoint -q /mnt/workspace; then
    # Format and mount the workspace disk if not already done
    if ! blkid /dev/sdb; then
        mkfs.ext4 /dev/sdb
    fi
    mount /dev/sdb /mnt/workspace
    echo '/dev/sdb /mnt/workspace ext4 defaults 0 2' >> /etc/fstab
fi

# Create symlink from workspace to mounted disk
if [ ! -L /home/coder/workspace ]; then
    rm -rf /home/coder/workspace
    ln -s /mnt/workspace /home/coder/workspace
fi

# Pull the code-server image
docker pull ${container_image}

# Create docker-compose file for code-server
cat > /home/coder/docker-compose.yml << EOF
version: '3.8'
services:
  code-server:
    image: ${container_image}
    container_name: code-server
    ports:
      - "8080:8080"
    volumes:
      - /home/coder/workspace:/home/coder/workspace
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - PASSWORD=${password}
      - USER=coder
    restart: unless-stopped
    command: >
      --bind-addr 0.0.0.0:8080
      --auth password
      --disable-telemetry
      /home/coder/workspace
EOF

# Start code-server with docker-compose
cd /home/coder
docker-compose up -d

# Create a simple health check script
cat > /home/coder/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for code-server
curl -f http://localhost:8080/healthz || exit 1
EOF

chmod +x /home/coder/health-check.sh

# Set up log rotation for Docker logs
cat > /etc/logrotate.d/docker-containers << EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF

# Install monitoring tools
apt-get install -y htop iotop nethogs

# Create a simple monitoring script
cat > /home/coder/monitor.sh << 'EOF'
#!/bin/bash
# Simple monitoring script
echo "=== System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Memory: $(free -h)"
echo "Disk: $(df -h /mnt/workspace)"
echo "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

chmod +x /home/coder/monitor.sh

echo "Code-server startup completed successfully"
echo "Access at: http://$(curl -s ifconfig.me):8080"
echo "Password: ${password}"