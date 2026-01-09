# Unified Services VM - Deployment Guide

**Author**: Agent W
**Date**: 2026-01-05
**Version**: 1.0.0

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Deployment Methods](#deployment-methods)
5. [Configuration](#configuration)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)
9. [Production Best Practices](#production-best-practices)

---

## Overview

This guide covers deploying the Unified Services VM, which includes:
- **Valkey 9.0.0** - Redis-compatible in-memory data store
- **PostgreSQL 16** - Relational database with pgvector extension
- **OpenVSCode Server 1.95.3** - Web-based IDE
- **Datadog Integration** - Monitoring and metrics
- **Dropbear SSH** - Remote access

**Supported Platforms**:
- macOS ARM64 (Apple Silicon) - vfkit
- Linux x86_64 - QEMU/KVM
- AWS EC2
- Azure VMs
- Google Cloud Compute Engine
- Kubernetes (KinD, AKS, GKE)

---

## Prerequisites

### Local Development

**macOS**:
```bash
# Install vfkit (for running VMs)
brew tap cfergeau/crc
brew install vfkit

# Download kernel (one-time setup)
mkdir -p ~/.vfkit/vms/vibecode-valkey/kernel
cd ~/.vfkit/vms/vibecode-valkey/kernel
wget https://github.com/vibecode/vibecode-webgui/releases/download/kernel-v1.0.0/vmlinux
```

**Linux**:
```bash
# Install QEMU/KVM
sudo apt-get update
sudo apt-get install -y qemu-system-x86 qemu-kvm libvirt-daemon-system

# Verify installation
qemu-system-x86_64 --version
```

### Cloud Deployment

**AWS**:
- AWS CLI configured (`aws configure`)
- EC2 SSH key pair created
- IAM permissions for EC2, VPC, Security Groups

**Azure**:
- Azure CLI installed (`az login`)
- Resource group created
- SSH public key registered

**GCP**:
- gcloud CLI authenticated
- Project created and configured
- Compute Engine API enabled

### Kubernetes

**KinD (Local)**:
```bash
# Install KinD
brew install kind  # macOS
# or
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/

# Create cluster
kind create cluster --name vibecode
```

**AKS/GKE**:
- Cluster already provisioned
- kubectl configured with cluster context
- Helm 3 installed

---

## Quick Start

### Option 1: Makefile (Recommended)

```bash
# Build VM
make vm-build

# Start VM
make vm-start

# Check status
make vm-status

# Stop VM
make vm-stop

# View logs
make vm-logs
```

### Option 2: Direct Build

```bash
# Build the VM image
cd azure
./build-unified-services-with-datadog.sh

# Full build with VS Code extensions
./build-unified-services-with-datadog.sh --with-extensions

# Fast build (OpenVSCode only)
./build-unified-services-with-datadog.sh --fast
```

### Option 3: Download Release

```bash
# Download from GitHub Releases
wget https://github.com/vibecode/vibecode-webgui/releases/latest/download/unified-services-static.cpio.gz

# Verify checksum
wget https://github.com/vibecode/vibecode-webgui/releases/latest/download/SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt
```

---

## Deployment Methods

### 1. Local Development (vfkit - macOS)

**Basic Deployment**:
```bash
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-rng
```

**With Datadog Monitoring**:
```bash
export DD_API_KEY="your_datadog_api_key"

vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=${DD_API_KEY} DD_SITE=datadoghq.com DD_HOSTNAME=my-dev-vm" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-rng
```

**Advanced Configuration**:
```bash
vfkit \
  --cpus 8 \
  --memory 4096 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=${DD_API_KEY} loglevel=debug" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-rng \
  --device virtio-blk,path=/path/to/storage.img
```

---

### 2. Local Development (QEMU - Linux)

**Basic Deployment**:
```bash
qemu-system-x86_64 \
  -m 2048 \
  -smp 4 \
  -kernel /path/to/vmlinux \
  -initrd azure/unified-services-static.cpio.gz \
  -append "console=ttyS0" \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::6379-:6379,hostfwd=tcp::5432-:5432,hostfwd=tcp::8080-:8080 \
  -device virtio-net-pci,netdev=net0 \
  -nographic
```

**With KVM Acceleration**:
```bash
qemu-system-x86_64 \
  -enable-kvm \
  -m 2048 \
  -smp 4 \
  -kernel /path/to/vmlinux \
  -initrd azure/unified-services-static.cpio.gz \
  -append "console=ttyS0 DD_API_KEY=${DD_API_KEY}" \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::6379-:6379,hostfwd=tcp::5432-:5432,hostfwd=tcp::8080-:8080 \
  -device virtio-net-pci,netdev=net0 \
  -nographic
```

---

### 3. Cloud Deployment (Terraform)

**Initialize Terraform**:
```bash
cd terraform/unified-vm
terraform init
```

**Deploy to AWS**:
```bash
# Create terraform.tfvars
cat > terraform.tfvars << EOF
environment = "production"
deploy_aws = true

aws_region = "us-east-1"
aws_instance_type = "t3.medium"
aws_key_name = "my-ssh-key"
allowed_ips = ["YOUR_IP/32"]

vm_version = "v1.0.0"
EOF

# Plan
terraform plan

# Apply
terraform apply

# Get connection details
terraform output aws_vm_details
```

**Deploy to Azure**:
```bash
cat > terraform.tfvars << EOF
environment = "production"
deploy_azure = true

azure_subscription_id = "your-subscription-id"
azure_resource_group = "vibecode-unified-vm"
azure_location = "eastus"
azure_vm_size = "Standard_B2s"
allowed_ips = ["YOUR_IP/32"]

vm_version = "v1.0.0"
EOF

terraform apply
terraform output azure_vm_details
```

**Deploy to GCP**:
```bash
cat > terraform.tfvars << EOF
environment = "production"
deploy_gcp = true

gcp_project_id = "your-project-id"
gcp_region = "us-central1"
gcp_zone = "us-central1-a"
gcp_machine_type = "n1-standard-2"
allowed_ips = ["YOUR_IP/32"]

vm_version = "v1.0.0"
EOF

terraform apply
terraform output gcp_vm_details
```

**Multi-Cloud Deployment**:
```bash
# Deploy to all platforms
cat > terraform.tfvars << EOF
environment = "production"
deploy_aws = true
deploy_azure = true
deploy_gcp = true

# AWS config
aws_region = "us-east-1"
aws_instance_type = "t3.medium"
aws_key_name = "my-key"

# Azure config
azure_subscription_id = "sub-id"
azure_location = "eastus"

# GCP config
gcp_project_id = "project-id"
gcp_region = "us-central1"

allowed_ips = ["YOUR_IP/32"]
vm_version = "v1.0.0"
EOF

terraform apply
```

---

### 4. Kubernetes Deployment

**Create Namespace**:
```bash
kubectl create namespace vibecode-vm
```

**Deploy with Helm** (coming soon):
```bash
helm repo add vibecode https://vibecode.github.io/charts
helm repo update

helm install unified-vm vibecode/unified-services-vm \
  --namespace vibecode-vm \
  --set vm.version=v1.0.0 \
  --set datadog.apiKey=${DD_API_KEY}
```

**Deploy with Kubectl**:
```yaml
# unified-vm-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-vm
  namespace: vibecode-vm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: unified-vm
  template:
    metadata:
      labels:
        app: unified-vm
    spec:
      containers:
      - name: unified-vm
        image: ghcr.io/vibecode/unified-vm:latest
        ports:
        - containerPort: 22
        - containerPort: 6379
        - containerPort: 5432
        - containerPort: 8080
        env:
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: api-key
        resources:
          requests:
            memory: "2Gi"
            cpu: "2"
          limits:
            memory: "4Gi"
            cpu: "4"
---
apiVersion: v1
kind: Service
metadata:
  name: unified-vm-service
  namespace: vibecode-vm
spec:
  type: LoadBalancer
  selector:
    app: unified-vm
  ports:
  - name: ssh
    port: 22
    targetPort: 22
  - name: valkey
    port: 6379
    targetPort: 6379
  - name: postgresql
    port: 5432
    targetPort: 5432
  - name: openvscode
    port: 8080
    targetPort: 8080
```

```bash
kubectl apply -f unified-vm-deployment.yaml

# Get service IP
kubectl get service unified-vm-service -n vibecode-vm
```

---

## Configuration

### Environment Variables

**Kernel Command Line Parameters**:
```bash
# Datadog
DD_API_KEY=your_key
DD_SITE=datadoghq.com
DD_HOSTNAME=my-vm

# Debug
loglevel=debug

# Network (static IP fallback)
ip=192.168.64.10::192.168.64.1:255.255.255.0
```

### Service Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| SSH | 22 | TCP | Remote access |
| Valkey | 6379 | TCP | Redis-compatible cache |
| PostgreSQL | 5432 | TCP | Relational database |
| OpenVSCode | 8080 | HTTP | Web IDE |
| Datadog StatsD | 8125 | UDP | Metrics (internal) |

### Firewall Rules

**AWS Security Group**:
```hcl
# Already configured in Terraform module
# Ports 22, 6379, 5432, 8080 exposed to allowed_ips
```

**Azure NSG**:
```bash
# Create network security rules
az network nsg rule create \
  --resource-group vibecode-unified-vm \
  --nsg-name unified-vm-nsg \
  --name AllowSSH \
  --priority 100 \
  --source-address-prefixes YOUR_IP/32 \
  --destination-port-ranges 22 \
  --access Allow \
  --protocol Tcp
```

**GCP Firewall**:
```bash
gcloud compute firewall-rules create unified-vm-allow \
  --allow tcp:22,tcp:6379,tcp:5432,tcp:8080 \
  --source-ranges YOUR_IP/32 \
  --target-tags unified-vm
```

---

## Monitoring & Health Checks

### Manual Health Checks

**Check VM Status**:
```bash
# Makefile command
make vm-status

# SSH into VM
ssh root@<VM_IP>

# Check service status
ps aux | grep -E "valkey|postgres|openvscode"

# Check ports
netstat -tuln | grep -E "22|6379|5432|8080"

# View logs
cat /tmp/valkey.log
cat /tmp/postgresql.log
cat /tmp/openvscode.log
```

**Service Tests**:
```bash
# Test Valkey
redis-cli -h <VM_IP> ping

# Test PostgreSQL
psql -h <VM_IP> -U postgres -c "SELECT version();"

# Test OpenVSCode
curl http://<VM_IP>:8080

# Test SSH
ssh root@<VM_IP> uptime
```

### Automated Monitoring (Datadog)

**Dashboard Setup**:
```bash
# Metrics automatically sent to Datadog
# View at: https://app.datadoghq.com/dashboard

# Key metrics:
- system.cpu.idle
- system.mem.used
- system.net.bytes_rcvd
- custom.unified_vm.services.status
```

**Alerts**:
- Service down > 2 minutes
- Memory usage > 90%
- Disk usage > 85%
- Network connectivity issues

---

## Troubleshooting

### Common Issues

**1. VM Doesn't Boot**
```bash
# Check kernel and initramfs paths
ls -lh ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux
ls -lh azure/unified-services-static.cpio.gz

# Verify file integrity
gzip -t azure/unified-services-static.cpio.gz

# Check vfkit logs
vfkit --debug ...
```

**2. Network Not Working**
```bash
# Inside VM
ip addr show
ip route show

# Check DHCP
cat /tmp/network.log

# Try static IP
ip addr add 192.168.64.10/24 dev eth0
ip route add default via 192.168.64.1
```

**3. Services Not Starting**
```bash
# Check init script
cat /init

# View service logs
cat /tmp/valkey.log
cat /tmp/postgresql.log
cat /tmp/openvscode.log

# Check if binaries exist
ls -lh /bin/valkey-server
ls -lh /usr/bin/postgres
ls -lh /opt/openvscode/bin/openvscode-server

# Verify library dependencies
ldd /bin/valkey-server
ldd /usr/bin/postgres
```

**4. Can't Connect to Services**
```bash
# Check if ports are listening
netstat -tuln

# Test from inside VM
redis-cli ping
psql -U postgres -c "SELECT 1;"
curl http://localhost:8080

# Check firewall rules (host)
# AWS: Review security group rules
# Azure: Check NSG rules
# GCP: Verify firewall rules
```

### Debug Mode

**Enable Verbose Logging**:
```bash
vfkit \
  --kernel-cmdline "console=hvc0 loglevel=debug init=/bin/sh" \
  ...
```

**Interactive Shell**:
```bash
# Boot into shell instead of full init
vfkit \
  --kernel-cmdline "console=hvc0 init=/bin/sh" \
  ...

# Then manually run init
/init
```

---

## Rollback Procedures

### Terraform Rollback

**Revert to Previous Version**:
```bash
# Update version in terraform.tfvars
vm_version = "v1.0.0"  # Previous stable version

# Apply
terraform apply

# Verify
terraform output
```

**Complete Infrastructure Rollback**:
```bash
# Destroy current infrastructure
terraform destroy

# Checkout previous terraform state
git checkout <previous-commit> terraform/

# Re-deploy
terraform init
terraform apply
```

### Manual Rollback

**Local VM**:
```bash
# Stop current VM
make vm-stop

# Restore previous image
cp azure/unified-services-static.cpio.gz.backup azure/unified-services-static.cpio.gz

# Start VM
make vm-start
```

**Cloud VM**:
```bash
# AWS: Create new instance with previous AMI
aws ec2 run-instances \
  --image-id ami-previous-version \
  --instance-type t3.medium \
  ...

# Azure: Redeploy from previous image
az vm create \
  --name unified-vm-rollback \
  --image previous-image-id \
  ...
```

---

## Production Best Practices

### Security

1. **Network Security**
   - Restrict `allowed_ips` to known sources only
   - Use VPN for sensitive environments
   - Enable TLS for all external connections

2. **Access Control**
   - Change default SSH password immediately
   - Use SSH keys instead of passwords
   - Implement MFA for production access
   - Rotate credentials regularly

3. **Monitoring**
   - Enable Datadog monitoring in production
   - Set up alerts for critical metrics
   - Configure log aggregation
   - Monitor security events

### High Availability

1. **Multi-Region Deployment**
   ```bash
   # Deploy to multiple regions for redundancy
   terraform apply -var="aws_region=us-east-1"
   terraform apply -var="aws_region=us-west-2"
   ```

2. **Load Balancing**
   - Use AWS ELB / Azure Load Balancer / GCP Load Balancer
   - Configure health checks
   - Set up auto-scaling (for stateless components)

3. **Backup Strategy**
   ```bash
   # PostgreSQL backups
   pg_dump -h <VM_IP> -U postgres > backup.sql

   # Valkey snapshots (configured in valkey.conf)
   # Automatic snapshots every 15 minutes
   ```

### Performance Tuning

1. **Resource Allocation**
   - Production: 4-8 CPUs, 4-8GB RAM minimum
   - Staging: 2-4 CPUs, 2-4GB RAM
   - Development: 2 CPUs, 2GB RAM

2. **Database Optimization**
   ```sql
   -- PostgreSQL tuning
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ALTER SYSTEM SET maintenance_work_mem = '128MB';
   SELECT pg_reload_conf();
   ```

3. **Monitoring Performance**
   - CPU usage < 70%
   - Memory usage < 80%
   - Disk I/O < 80% capacity
   - Network latency < 50ms

---

## Support

- **Documentation**: See [AGENT-W-CICD-DESIGN.md](AGENT-W-CICD-DESIGN.md)
- **Issues**: https://github.com/vibecode/vibecode-webgui/issues
- **Discussions**: https://github.com/vibecode/vibecode-webgui/discussions
- **Emergency**: Contact DevOps team

---

## Changelog

### v1.0.0 (2026-01-05)
- Initial release
- Multi-cloud support (AWS, Azure, GCP)
- Automated CI/CD pipelines
- Production-ready deployment procedures
