# Ansible Quick Start

Deploy sandboxed GenAI coding editors across all your machines.

## Setup

```bash
# Install Ansible
brew install ansible  # macOS
# or
pip install ansible   # Linux

# Configure hosts
vim ansible/hosts.ini  # Edit IPs and users
```

## Deploy

```bash
# Deploy to all machines
ansible-playbook -i ansible/hosts.ini ansible/setup_k3s.yml

# Deploy to specific group
ansible-playbook -i ansible/hosts.ini ansible/setup_k3s.yml --limit macos
```

## What It Does

1. **Installs K3s** on all nodes
2. **Sets up cluster** (control-plane + workers)
3. **Deploys OLLama** (local AI models)
4. **Deploys MLflow** (experiment tracking)
5. **Creates namespaces** and services

## Result

Each machine gets:
- K3s cluster joined
- OLLama running (port 11434)
- MLflow tracking (port 5000)
- Sandboxed environment

## Access Services

```bash
# Forward ports
kubectl port-forward -n mlflow-ollama svc/ollama 11434:11434 &
kubectl port-forward -n mlflow-ollama svc/mlflow 5000:5000 &

# Test OLLama
curl http://localhost:11434/api/tags

# Test MLflow
curl http://localhost:5000/health
```

## Customize

Edit `ansible/hosts.ini` to add your machines:
```ini
[all]
your-host ansible_host=YOUR_IP ansible_user=YOUR_USER ansible_connection=ssh
```

Edit `ansible/setup_k3s.yml` to customize deployments.

## What Gets Deployed

- **K3s**: Lightweight Kubernetes
- **OLLama**: Local LLM inference
- **MLflow**: ML experiment tracking
- **Namespace**: mlflow-ollama (sandboxed)

All on your local machines!
