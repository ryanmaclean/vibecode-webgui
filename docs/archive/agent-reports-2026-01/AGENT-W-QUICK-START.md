# Unified Services VM - Quick Start Guide

**Fast track to deploying the Unified Services VM in under 5 minutes**

---

## 1. Choose Your Method

### Option A: Local Development (macOS)
```bash
# Install vfkit
brew tap cfergeau/crc && brew install vfkit

# Build VM
cd /Users/ryan.maclean/vibecode-webgui
make -f Makefile.vm vm-build

# Start VM
make -f Makefile.vm vm-start

# Access services
# - SSH: ssh root@localhost (password: vibecode)
# - Valkey: redis://localhost:6379
# - PostgreSQL: postgresql://localhost:5432
# - OpenVSCode: http://localhost:8080
```

### Option B: Cloud Deployment (AWS)
```bash
# Configure Terraform
cd terraform/unified-vm

cat > terraform.tfvars << EOF
environment = "dev"
deploy_aws = true
aws_region = "us-east-1"
aws_instance_type = "t3.medium"
aws_key_name = "your-key-name"
allowed_ips = ["YOUR_IP/32"]
vm_version = "latest"
EOF

# Deploy
terraform init
terraform apply

# Get IP address
terraform output aws_vm_details
```

### Option C: Kubernetes
```bash
# Create namespace
kubectl create namespace vibecode-vm

# Deploy
kubectl apply -f k8s/unified-vm/ -n vibecode-vm

# Get service IP
kubectl get svc -n vibecode-vm
```

---

## 2. Verify Services

```bash
# Check VM status
make -f Makefile.vm vm-status

# Test services
redis-cli -h <VM_IP> ping              # Should return PONG
psql -h <VM_IP> -U postgres -c "SELECT 1;"  # Should return 1
curl http://<VM_IP>:8080               # Should load OpenVSCode
ssh root@<VM_IP>                       # Should connect (password: vibecode)
```

---

## 3. Enable Monitoring (Optional)

```bash
# Set Datadog API key
export DD_API_KEY="your_datadog_api_key"

# Restart VM with monitoring
make -f Makefile.vm vm-restart

# View metrics at https://app.datadoghq.com/dashboard
```

---

## Common Commands

```bash
# Build
make -f Makefile.vm vm-build           # Full build
make -f Makefile.vm vm-build-fast      # Fast build (OpenVSCode only)

# Lifecycle
make -f Makefile.vm vm-start           # Start VM
make -f Makefile.vm vm-stop            # Stop VM
make -f Makefile.vm vm-restart         # Restart VM
make -f Makefile.vm vm-status          # Check status

# Testing
make -f Makefile.vm vm-test            # Run all tests
make -f Makefile.vm vm-logs            # View logs

# Cloud
make -f Makefile.vm cloud-deploy CLOUD_PROVIDER=aws    # Deploy to AWS
make -f Makefile.vm cloud-status                       # Check status

# Help
make -f Makefile.vm help               # Show all commands
```

---

## Troubleshooting

**VM won't start?**
```bash
# Check if image exists
ls -lh azure/unified-services-static.cpio.gz

# Rebuild if needed
make -f Makefile.vm vm-build

# Check logs
make -f Makefile.vm vm-logs
```

**Can't connect to services?**
```bash
# SSH into VM
make -f Makefile.vm vm-ssh

# Check services inside VM
ps aux | grep -E "valkey|postgres|openvscode"
netstat -tuln | grep -E "6379|5432|8080"
```

**Need help?**
```bash
# View full documentation
cat AGENT-W-DEPLOYMENT-GUIDE.md

# View architecture
cat AGENT-W-CICD-DESIGN.md
```

---

## Next Steps

1. **Explore the services**
   - Connect to OpenVSCode and write code
   - Use Valkey as a cache
   - Create PostgreSQL databases

2. **Set up CI/CD**
   - Push code to trigger automated builds
   - Create releases with `git tag vm-v1.0.0`
   - Deploy to staging/production

3. **Scale up**
   - Deploy to multiple clouds
   - Set up Kubernetes cluster
   - Enable high availability

---

## Quick Reference

| Service | Port | Access | Default Credentials |
|---------|------|--------|---------------------|
| SSH | 22 | `ssh root@<VM_IP>` | Password: vibecode |
| Valkey | 6379 | `redis-cli -h <VM_IP>` | No auth |
| PostgreSQL | 5432 | `psql -h <VM_IP> -U postgres` | Trust auth |
| OpenVSCode | 8080 | `http://<VM_IP>:8080` | No auth |

---

**Documentation**:
- Full deployment guide: [AGENT-W-DEPLOYMENT-GUIDE.md](AGENT-W-DEPLOYMENT-GUIDE.md)
- CI/CD architecture: [AGENT-W-CICD-DESIGN.md](AGENT-W-CICD-DESIGN.md)
- Complete summary: [AGENT-W-SUMMARY.md](AGENT-W-SUMMARY.md)

**Support**: https://github.com/vibecode/vibecode-webgui/issues
