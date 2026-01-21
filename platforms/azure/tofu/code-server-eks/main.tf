terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

provider "aws" {
  region = var.region
}

provider "kubernetes" {
  host                   = var.cluster_endpoint
  cluster_ca_certificate = base64decode(var.cluster_ca_certificate)
  token                  = var.auth_token
}

provider "helm" {
  kubernetes {
    host                   = var.cluster_endpoint
    cluster_ca_certificate = base64decode(var.cluster_ca_certificate)
    token                  = var.auth_token
  }
}

resource "helm_release" "codeserver" {
  name       = var.release_name
  namespace  = var.namespace
  chart      = var.chart_path
  repository = ""
  version    = var.chart_version
  wait       = true

  set {
    name  = "auth.password"
    value = var.code_server_password
  }

  set {
    name  = "workspace.persistentVolume.enabled"
    value = var.enable_persistent_volume
  }

  set {
    name  = "workspace.persistentVolume.storageClass"
    value = var.storage_class
  }

  dynamic "set" {
    for_each = var.spot_node_selector
    content {
      name  = "nodeSelector.${set.key}"
      value = set.value
    }
  }

  values = [file(var.chart_values_file)]
}

