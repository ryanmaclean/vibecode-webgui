terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
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

provider "kubernetes" {
  host                   = var.cluster_endpoint
  client_certificate     = base64decode(var.client_certificate)
  client_key             = base64decode(var.client_key)
  cluster_ca_certificate = base64decode(var.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = var.cluster_endpoint
    client_certificate     = base64decode(var.client_certificate)
    client_key             = base64decode(var.client_key)
    cluster_ca_certificate = base64decode(var.cluster_ca_certificate)
  }
}

resource "helm_release" "codeserver" {
  name       = var.release_name
  namespace  = var.namespace
  repository = ""
  chart      = var.chart_path
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
    for_each = var.enable_datadog_sidecar ? [1] : []
    content {
      name  = "sidecar.datadog.enabled"
      value = true
    }
  }

  values = [file(var.chart_values_file)]
}
