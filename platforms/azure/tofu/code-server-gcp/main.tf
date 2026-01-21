terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# GCP Code-Server Cloud Deployment
# Creates preemptible VMs with persistent disks for affordable developer workspaces

# Service account for code-server instances
resource "google_service_account" "codeserver" {
  account_id   = "codeserver-${var.environment}"
  display_name = "Code-Server Service Account"
  description  = "Service account for code-server cloud instances"
}

# IAM bindings for the service account
resource "google_project_iam_member" "codeserver_storage" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.codeserver.email}"
}

resource "google_project_iam_member" "codeserver_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.codeserver.email}"
}

# Instance template for code-server
resource "google_compute_instance_template" "codeserver" {
  name_prefix = "codeserver-${var.environment}-"
  description = "Template for code-server cloud instances"

  machine_type = var.machine_type
  region       = var.region

  disk {
    source_image = var.source_image
    auto_delete  = true
    boot         = true
    disk_size_gb = var.boot_disk_size
    disk_type    = "pd-balanced"
  }

  # Additional persistent disk for workspace data
  disk {
    auto_delete = false
    boot        = false
    disk_size_gb = var.workspace_disk_size
    disk_type   = "pd-standard"
    device_name = "workspace-disk"
  }

  network_interface {
    network = var.network
    access_config {
      // Ephemeral public IP
    }
  }

  service_account {
    email  = google_service_account.codeserver.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    startup-script = templatefile("${path.module}/startup.sh", {
      container_image = var.container_image
      password        = var.codeserver_password
    })
  }

  scheduling {
    preemptible       = true
    automatic_restart = false
  }

  tags = ["codeserver", var.environment]

  lifecycle {
    create_before_destroy = true
  }
}

# Managed instance group for auto-scaling
resource "google_compute_instance_group_manager" "codeserver" {
  name = "codeserver-${var.environment}-igm"

  base_instance_name = "codeserver-${var.environment}"
  zone               = var.zone

  version {
    instance_template = google_compute_instance_template.codeserver.id
  }

  target_size = var.target_size

  auto_healing_policies {
    health_check      = google_compute_health_check.codeserver.id
    initial_delay_sec = 300
  }
}

# Health check for code-server
resource "google_compute_health_check" "codeserver" {
  name = "codeserver-${var.environment}-health"

  http_health_check {
    port         = 8080
    request_path = "/healthz"
  }

  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

# Cloud Scheduler job for automated start/stop
resource "google_cloud_scheduler_job" "codeserver_schedule" {
  count = var.enable_scheduling ? 1 : 0

  name        = "codeserver-${var.environment}-schedule"
  description = "Schedule code-server instances"
  schedule    = var.schedule_cron
  time_zone   = var.timezone

  http_target {
    http_method = "POST"
    uri         = "https://compute.googleapis.com/compute/v1/projects/${var.project_id}/zones/${var.zone}/instanceGroupManagers/${google_compute_instance_group_manager.codeserver.name}/resize"
    
    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      size = var.schedule_target_size
    }))

    oauth_token {
      service_account_email = google_service_account.codeserver.email
    }
  }
}

