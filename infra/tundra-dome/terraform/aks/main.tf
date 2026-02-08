# Tundra Dome - Azure Kubernetes Service (AKS)
# Full production cluster with all Tundra Dome components

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "tundra-dome"
}

variable "region" {
  description = "Azure region"
  type        = string
  default     = "westus2"
}

variable "node_count" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 3
}

variable "node_size" {
  description = "VM size for nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "dd_api_key" {
  description = "Datadog API Key"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    project     = "tundra-dome"
    environment = "production"
    managed_by  = "terraform"
  }
}

# Resource Group
resource "azurerm_resource_group" "tundra" {
  name     = "rg-${var.cluster_name}"
  location = var.region
  tags     = var.tags
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "tundra" {
  name                = var.cluster_name
  location            = azurerm_resource_group.tundra.location
  resource_group_name = azurerm_resource_group.tundra.name
  dns_prefix          = var.cluster_name
  kubernetes_version  = "1.29"

  default_node_pool {
    name                = "default"
    node_count          = var.node_count
    vm_size             = var.node_size
    enable_auto_scaling = true
    min_count           = 2
    max_count           = 10

    node_labels = {
      "tundra-dome/role" = "worker"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    network_policy    = "calico"
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.tundra.id
  }

  tags = var.tags
}

# Log Analytics for monitoring
resource "azurerm_log_analytics_workspace" "tundra" {
  name                = "law-${var.cluster_name}"
  location            = azurerm_resource_group.tundra.location
  resource_group_name = azurerm_resource_group.tundra.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# Container Registry
resource "azurerm_container_registry" "tundra" {
  name                = replace("acr${var.cluster_name}", "-", "")
  resource_group_name = azurerm_resource_group.tundra.name
  location            = azurerm_resource_group.tundra.location
  sku                 = "Standard"
  admin_enabled       = true
  tags                = var.tags
}

# Grant AKS access to ACR
resource "azurerm_role_assignment" "aks_acr" {
  principal_id                     = azurerm_kubernetes_cluster.tundra.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.tundra.id
  skip_service_principal_aad_check = true
}

# Kubernetes provider config
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.tundra.kube_config[0].host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.tundra.kube_config[0].host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.tundra.kube_config[0].cluster_ca_certificate)
  }
}

# Tundra Dome namespace
resource "kubernetes_namespace" "tundra_dome" {
  metadata {
    name = "tundra-dome"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "tundra-dome/cluster"          = var.cluster_name
    }
  }

  depends_on = [azurerm_kubernetes_cluster.tundra]
}

# Datadog Helm release
resource "helm_release" "datadog" {
  name             = "datadog-agent"
  repository       = "https://helm.datadoghq.com"
  chart            = "datadog"
  namespace        = "datadog"
  create_namespace = true

  set_sensitive {
    name  = "datadog.apiKey"
    value = var.dd_api_key
  }

  set {
    name  = "datadog.site"
    value = "datadoghq.com"
  }

  set {
    name  = "datadog.clusterName"
    value = var.cluster_name
  }

  set {
    name  = "datadog.apm.portEnabled"
    value = "true"
  }

  set {
    name  = "datadog.logs.enabled"
    value = "true"
  }

  set {
    name  = "datadog.logs.containerCollectAll"
    value = "true"
  }

  set {
    name  = "clusterAgent.enabled"
    value = "true"
  }

  depends_on = [azurerm_kubernetes_cluster.tundra]
}

# Outputs
output "cluster_name" {
  value = azurerm_kubernetes_cluster.tundra.name
}

output "resource_group" {
  value = azurerm_resource_group.tundra.name
}

output "kube_config" {
  value     = azurerm_kubernetes_cluster.tundra.kube_config_raw
  sensitive = true
}

output "acr_login_server" {
  value = azurerm_container_registry.tundra.login_server
}

output "connect_command" {
  value = "az aks get-credentials --resource-group ${azurerm_resource_group.tundra.name} --name ${azurerm_kubernetes_cluster.tundra.name}"
}
