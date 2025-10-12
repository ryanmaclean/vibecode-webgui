# GCP Cloud Workspaces Infrastructure
# Production-ready GKE Autopilot + Filestore setup

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
  }

  backend "gcs" {
    bucket = "vibecode-terraform-state"
    prefix = "cloud-workspaces/gcp"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# GKE Autopilot Cluster with Spot VMs
resource "google_container_cluster" "workspaces" {
  name     = var.cluster_name
  location = var.region

  # Autopilot mode - Google manages nodes
  enable_autopilot = true

  # Network configuration
  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.workspaces.id

  # IP allocation for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Workload Identity for secure pod authentication
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Binary Authorization for signed images
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00" # 3 AM maintenance window
    }
  }

  # Cluster monitoring
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus {
      enabled = true
    }
  }

  # Logging configuration
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  # Release channel for automatic upgrades
  release_channel {
    channel = "REGULAR"
  }

  # Security features
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Master authorized networks
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0" # Replace with your IP ranges
      display_name = "All networks (replace in production)"
    }
  }

  # Addons
  addons_config {
    horizontal_pod_autoscaling {
      disabled = false
    }
    http_load_balancing {
      disabled = false
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
  }

  # Resource labels
  resource_labels = {
    environment = var.environment
    project     = "vibecode"
    managed_by  = "terraform"
    workload    = "cloud-workspaces"
  }
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# Subnet for workspaces
resource "google_compute_subnetwork" "workspaces" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id

  # Secondary ranges for GKE
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  # Private Google Access for pulling images
  private_ip_google_access = true

  # Log configuration
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.vpc.id

  bgp {
    asn = 64514
  }
}

# Cloud NAT for internet access from private nodes
resource "google_compute_router_nat" "nat" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Filestore instance for persistent workspaces
resource "google_filestore_instance" "workspaces" {
  name     = "${var.cluster_name}-filestore"
  location = var.zone
  tier     = var.filestore_tier

  file_shares {
    capacity_gb = var.filestore_capacity_gb
    name        = "workspaces"

    nfs_export_options {
      ip_ranges   = [var.subnet_cidr]
      access_mode = "READ_WRITE"
      squash_mode = "NO_ROOT_SQUASH"
    }
  }

  networks {
    network      = google_compute_network.vpc.name
    modes        = ["MODE_IPV4"]
    connect_mode = "PRIVATE_SERVICE_ACCESS"
  }

  labels = {
    environment = var.environment
    project     = "vibecode"
    managed_by  = "terraform"
  }
}

# Service account for workspaces
resource "google_service_account" "workspace_sa" {
  account_id   = "workspace-sa"
  display_name = "Workspace Service Account"
  description  = "Service account for code-server workspaces"
}

# IAM bindings for workspace service account
resource "google_project_iam_member" "workspace_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.workspace_sa.email}"
}

resource "google_project_iam_member" "workspace_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.workspace_sa.email}"
}

resource "google_project_iam_member" "workspace_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.workspace_sa.email}"
}

# Workload Identity binding
resource "google_service_account_iam_binding" "workload_identity_binding" {
  service_account_id = google_service_account.workspace_sa.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[vibecode/workspace-sa]"
  ]
}

# Cloud Storage bucket for workspace archives
resource "google_storage_bucket" "archives" {
  name          = "${var.project_id}-workspace-archives"
  location      = var.region
  force_destroy = false
  storage_class = "NEARLINE" # Cost-optimized for infrequent access

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }

  labels = {
    environment = var.environment
    project     = "vibecode"
    managed_by  = "terraform"
  }
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  network = google_compute_network.vpc.id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr, var.pods_cidr, var.services_cidr]
}

resource "google_compute_firewall" "allow_filestore" {
  name    = "${var.cluster_name}-allow-filestore"
  network = google_compute_network.vpc.id

  allow {
    protocol = "tcp"
    ports    = ["2049"] # NFS
  }

  source_ranges = [var.subnet_cidr, var.pods_cidr]
  target_tags   = ["filestore"]
}

# Cloud Function for idle detection
resource "google_storage_bucket_object" "idle_function_source" {
  name   = "idle-detection-${timestamp()}.zip"
  bucket = google_storage_bucket.function_source.name
  source = "${path.module}/functions/idle-detection.zip"
}

resource "google_storage_bucket" "function_source" {
  name     = "${var.project_id}-function-source"
  location = var.region
}

resource "google_cloudfunctions2_function" "idle_detection" {
  name     = "idle-workspace-checker"
  location = var.region

  build_config {
    runtime     = "nodejs20"
    entry_point = "checkIdleWorkspaces"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.idle_function_source.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    min_instance_count = 0
    available_memory   = "256M"
    timeout_seconds    = 300

    environment_variables = {
      PROJECT_ID   = var.project_id
      CLUSTER_NAME = var.cluster_name
      REGION       = var.region
    }

    service_account_email = google_service_account.workspace_sa.email
  }

  labels = {
    environment = var.environment
    project     = "vibecode"
  }
}

# Cloud Scheduler job for idle detection
resource "google_cloud_scheduler_job" "idle_check" {
  name             = "idle-workspace-check"
  description      = "Check for idle workspaces every 5 minutes"
  schedule         = "*/5 * * * *"
  time_zone        = "America/New_York"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.idle_detection.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.workspace_sa.email
    }
  }

  retry_config {
    retry_count = 3
  }
}

# Outputs
output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.workspaces.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.workspaces.endpoint
  sensitive   = true
}

output "filestore_ip" {
  description = "Filestore IP address"
  value       = google_filestore_instance.workspaces.networks[0].ip_addresses[0]
}

output "filestore_share" {
  description = "Filestore share name"
  value       = google_filestore_instance.workspaces.file_shares[0].name
}

output "archive_bucket" {
  description = "Cloud Storage bucket for archives"
  value       = google_storage_bucket.archives.url
}

output "workspace_service_account" {
  description = "Workspace service account email"
  value       = google_service_account.workspace_sa.email
}
