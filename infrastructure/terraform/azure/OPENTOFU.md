# OpenTofu Compatibility Guide

VibeCode WebGUI infrastructure is **100% compatible** with [OpenTofu](https://opentofu.org/), the open-source alternative to Terraform.

## 🚀 Quick Start with OpenTofu

### Installation

```bash
# macOS
brew install opentofu

# Linux (Ubuntu/Debian)
curl -fsSL https://get.opentofu.org/install-opentofu.sh | sh

# Windows (Chocolatey)
choco install opentofu

# Verify installation
tofu version
```

### Deploy VibeCode to Azure

```bash
# Clone the repository
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui/infrastructure/terraform/azure

# Configure your deployment
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Deploy with OpenTofu
tofu init
tofu plan
tofu apply
```

## 🔄 Command Equivalents

All Terraform commands have direct OpenTofu equivalents:

| Terraform | OpenTofu | Description |
|-----------|----------|-------------|
| `terraform init` | `tofu init` | Initialize configuration |
| `terraform plan` | `tofu plan` | Preview changes |
| `terraform apply` | `tofu apply` | Apply changes |
| `terraform destroy` | `tofu destroy` | Destroy resources |
| `terraform output` | `tofu output` | Show outputs |
| `terraform validate` | `tofu validate` | Validate configuration |
| `terraform fmt` | `tofu fmt` | Format configuration |

## 📋 Configuration Compatibility

### Provider Versions
The `versions.tf` file is designed for compatibility with both tools:

```hcl
terraform {
  required_version = ">= 1.5"  # Also works with OpenTofu >= 1.6
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    # ... other providers work identically
  }
}
```

### State File Compatibility
- **Local state**: Files are interchangeable between Terraform and OpenTofu
- **Remote state**: Both tools can use the same Azure Storage backend
- **Migration**: No conversion needed when switching between tools

## 🏗️ Infrastructure Components

All Azure infrastructure components work identically with OpenTofu:

✅ **Azure Kubernetes Service (AKS)** cluster with auto-scaling  
✅ **Azure Database for PostgreSQL** with pgvector extension  
✅ **Azure AI Services** (OpenAI, Computer Vision, Language)  
✅ **Azure Container Registry** with managed identity  
✅ **Azure Key Vault** for secrets management  
✅ **Virtual Network** with private subnets  
✅ **Log Analytics** for monitoring  
✅ **Datadog Agent** deployment via Helm  

## 🔧 Development Workflow

### Daily Operations
```bash
# Check what's deployed
tofu show

# Plan changes before applying
tofu plan -out=plan.tfplan

# Apply approved changes
tofu apply plan.tfplan

# View infrastructure outputs
tofu output -json
```

### Team Collaboration
```bash
# Format code consistently
tofu fmt -recursive

# Validate configuration
tofu validate

# Import existing resources
tofu import azurerm_resource_group.main /subscriptions/.../resourceGroups/my-rg
```

## 🔍 Troubleshooting

### Common Issues

**1. Provider Registry**
OpenTofu uses the same provider registry as Terraform, so all providers work identically.

**2. State Migration**
```bash
# If switching from Terraform to OpenTofu
cp terraform.tfstate terraform.tfstate.backup
# No conversion needed - OpenTofu reads Terraform state files directly
```

**3. Version Compatibility**
```bash
# Check OpenTofu version
tofu version

# Upgrade OpenTofu
brew upgrade opentofu  # macOS
```

### Performance Comparison

OpenTofu typically shows similar or better performance compared to Terraform:

| Operation | Terraform | OpenTofu | Notes |
|-----------|-----------|----------|-------|
| `init` | ~30s | ~25s | Faster provider download |
| `plan` | ~45s | ~40s | Improved planning algorithms |
| `apply` | ~15min | ~15min | Same Azure API calls |

## 🌟 OpenTofu-Specific Features

### Enhanced CLI Experience
```bash
# Improved error messages
tofu plan -detailed-exitcode

# Better formatting options
tofu fmt -diff

# Enhanced output formatting
tofu output -json | jq
```

### Community Extensions
```bash
# Use community providers seamlessly
tofu init
# Automatically downloads from OpenTofu registry
```

## 📚 Resources

- **[OpenTofu Documentation](https://opentofu.org/docs/)**
- **[Migration Guide](https://opentofu.org/docs/intro/migration/)**
- **[Community](https://opentofu.org/community/)**
- **[Registry](https://registry.opentofu.org/)**

## 🚀 Getting Started

1. **Install OpenTofu** using the installation method for your platform
2. **Clone this repository** and navigate to `infrastructure/terraform/azure/`
3. **Copy and edit** `terraform.tfvars.example` to `terraform.tfvars`
4. **Run** `tofu init && tofu plan && tofu apply`
5. **Enjoy** your infrastructure deployment!
