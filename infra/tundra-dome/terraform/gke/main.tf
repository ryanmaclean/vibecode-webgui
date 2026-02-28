# Tundra Dome GKE Cluster - Google Kubernetes Engine
# Multi-cluster infrastructure for distributed bead processing

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  backend "gcs" {
    # Configure via backend.tf or environment variables
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.tundra_dome.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.tundra_dome.master_auth[0].cluster_ca_certificate)
}

# Data sources
data "google_client_config" "default" {}

data "google_project" "project" {
  project_id = var.project_id
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  cluster_name = "${var.cluster_prefix}-${var.environment}-${random_id.suffix.hex}"

  common_labels = merge(var.labels, {
    environment  = var.environment
    project      = "tundra-dome"
    managed-by   = "terraform"
    cluster-type = "multi-cluster"
  })
}

# VPC network for GKE
resource "google_compute_network" "vpc" {
  name                    = "${local.cluster_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet for GKE nodes
resource "google_compute_subnetwork" "subnet" {
  name          = "${local.cluster_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  # Secondary IP ranges for pods and services
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  private_ip_google_access = true
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "${local.cluster_name}-router"
  region  = var.region
  network = google_compute_network.vpc.id
  project = var.project_id
}

# Cloud NAT for egress traffic
resource "google_compute_router_nat" "nat" {
  name                               = "${local.cluster_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Service account for GKE nodes
resource "google_service_account" "gke_nodes" {
  account_id   = "${local.cluster_name}-node-sa"
  display_name = "GKE Node Service Account for ${local.cluster_name}"
  project      = var.project_id
}

# IAM bindings for node service account
resource "google_project_iam_member" "gke_nodes_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_resource_metadata_writer" {
  project = var.project_id
  role    = "roles/stackdriver.resourceMetadata.writer"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_gcr_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# GKE Cluster
resource "google_container_cluster" "tundra_dome" {
  name     = local.cluster_name
  location = var.regional_cluster ? var.region : var.zone
  project  = var.project_id

  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network configuration
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # IP allocation policy (for VPC-native cluster)
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = var.enable_private_nodes
    enable_private_endpoint = var.enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  # Master authorized networks
  dynamic "master_authorized_networks_config" {
    for_each = var.master_authorized_networks != null ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr_block
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Release channel for automatic upgrades
  release_channel {
    channel = var.release_channel
  }

  # Cluster addons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
    gcs_fuse_csi_driver_config {
      enabled = true
    }
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "PROVIDER_UNSPECIFIED"
  }

  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = var.maintenance_start_time
    }
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = var.enable_binary_authorization ? "PROJECT_SINGLETON_POLICY_ENFORCE" : "DISABLED"
  }

  # Monitoring and logging
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]

    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  # Resource labels
  resource_labels = local.common_labels

  lifecycle {
    ignore_changes = [
      initial_node_count,
      node_pool
    ]
  }
}

# System node pool
resource "google_container_node_pool" "system" {
  name       = "system-pool"
  location   = var.regional_cluster ? var.region : var.zone
  cluster    = google_container_cluster.tundra_dome.name
  project    = var.project_id
  node_count = var.system_node_count

  # Autoscaling
  autoscaling {
    min_node_count = var.system_node_min_count
    max_node_count = var.system_node_max_count
  }

  # Node configuration
  node_config {
    preemptible  = false
    machine_type = var.system_node_machine_type
    disk_size_gb = 100
    disk_type    = "pd-standard"

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = merge(local.common_labels, {
      nodepool = "system"
      workload = "system"
    })

    tags = ["gke-node", "${local.cluster_name}"]

    metadata = {
      disable-legacy-endpoints = "true"
    }

    taint {
      key    = "CriticalAddonsOnly"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Application node pool
resource "google_container_node_pool" "application" {
  name       = "application-pool"
  location   = var.regional_cluster ? var.region : var.zone
  cluster    = google_container_cluster.tundra_dome.name
  project    = var.project_id
  node_count = var.app_node_count

  # Autoscaling
  autoscaling {
    min_node_count = var.app_node_min_count
    max_node_count = var.app_node_max_count
  }

  # Node configuration
  node_config {
    preemptible  = var.app_node_preemptible
    machine_type = var.app_node_machine_type
    disk_size_gb = 100
    disk_type    = "pd-standard"

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = merge(local.common_labels, {
      nodepool     = "application"
      workload     = "beads"
      cluster-type = "tundra-dome"
    })

    tags = ["gke-node", "${local.cluster_name}"]

    metadata = {
      disable-legacy-endpoints = "true"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Artifact Registry repository
resource "google_artifact_registry_repository" "tundra_dome" {
  count = var.create_artifact_registry ? 1 : 0

  location      = var.region
  repository_id = "${local.cluster_name}-images"
  description   = "Docker repository for Tundra Dome ${var.environment}"
  format        = "DOCKER"
  project       = var.project_id

  labels = local.common_labels
}

# Kubernetes namespace
resource "kubernetes_namespace" "tundra_dome" {
  metadata {
    name = "tundra-dome"

    labels = {
      name        = "tundra-dome"
      environment = var.environment
      managed-by  = "terraform"
      cluster     = local.cluster_name
    }
  }

  depends_on = [google_container_cluster.tundra_dome]
}

# Variables
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal cluster (if regional_cluster is false)"
  type        = string
  default     = "us-central1-a"
}

variable "regional_cluster" {
  description = "Create regional cluster (true) or zonal cluster (false)"
  type        = bool
  default     = true
}

variable "cluster_prefix" {
  description = "Prefix for cluster name"
  type        = string
  default     = "tundra-dome"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "subnet_cidr" {
  description = "CIDR block for subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "pods_cidr" {
  description = "CIDR block for pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "CIDR block for services"
  type        = string
  default     = "10.2.0.0/16"
}

variable "enable_private_nodes" {
  description = "Enable private nodes"
  type        = bool
  default     = true
}

variable "enable_private_endpoint" {
  description = "Enable private cluster endpoint"
  type        = bool
  default     = false
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for GKE master"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "List of master authorized networks"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = null
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "maintenance_start_time" {
  description = "Start time for maintenance window (HH:MM format)"
  type        = string
  default     = "03:00"
}

variable "enable_binary_authorization" {
  description = "Enable binary authorization"
  type        = bool
  default     = false
}

variable "enable_managed_prometheus" {
  description = "Enable managed Prometheus for monitoring"
  type        = bool
  default     = true
}

variable "system_node_count" {
  description = "Initial number of system nodes per zone"
  type        = number
  default     = 1
}

variable "system_node_min_count" {
  description = "Minimum number of system nodes per zone"
  type        = number
  default     = 1
}

variable "system_node_max_count" {
  description = "Maximum number of system nodes per zone"
  type        = number
  default     = 3
}

variable "system_node_machine_type" {
  description = "Machine type for system nodes"
  type        = string
  default     = "e2-medium"
}

variable "app_node_count" {
  description = "Initial number of application nodes per zone"
  type        = number
  default     = 2
}

variable "app_node_min_count" {
  description = "Minimum number of application nodes per zone"
  type        = number
  default     = 1
}

variable "app_node_max_count" {
  description = "Maximum number of application nodes per zone"
  type        = number
  default     = 10
}

variable "app_node_machine_type" {
  description = "Machine type for application nodes"
  type        = string
  default     = "e2-standard-4"
}

variable "app_node_preemptible" {
  description = "Use preemptible nodes for application pool"
  type        = bool
  default     = false
}

variable "create_artifact_registry" {
  description = "Create Artifact Registry repository"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Additional labels for resources"
  type        = map(string)
  default     = {}
}

# Outputs
output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.tundra_dome.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.tundra_dome.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Cluster CA certificate"
  value       = google_container_cluster.tundra_dome.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "subnet_name" {
  description = "Subnet name"
  value       = google_compute_subnetwork.subnet.name
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = var.create_artifact_registry ? "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.tundra_dome[0].repository_id}" : null
}
