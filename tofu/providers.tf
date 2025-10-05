# OpenTofu providers configuration
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }

    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }

    datadog = {
      source  = "DataDog/datadog"
      version = ">= 3.0"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# Configure the Azure Provider
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }

    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }

  # Use Azure CLI authentication
  use_cli = true
}

# Configure the Kubernetes Provider
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
}

# Configure the Random Provider
provider "random" {}

# Configure the Time Provider
provider "time" {}

# Configure the Datadog Provider (no-op when monitoring disabled)
provider "datadog" {
  api_key  = var.enable_datadog_monitoring ? var.datadog_api_key : null
  app_key  = var.enable_datadog_monitoring ? var.datadog_app_key : null
  api_url  = var.datadog_api_url
  validate = var.enable_datadog_monitoring
}

# Configure the Helm Provider
provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
  }
}
