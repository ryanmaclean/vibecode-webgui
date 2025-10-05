variable "project_id" {
  type        = string
  description = "GCP project identifier"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP region"
}

variable "zone" {
  type        = string
  default     = "us-central1-a"
  description = "GCP zone"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment name (dev, staging, prod)"
}

variable "machine_type" {
  type        = string
  default     = "e2-small"
  description = "GCP machine type for code-server instances"
}

variable "source_image" {
  type        = string
  default     = "debian-12"
  description = "Source image family for instances"
}

variable "boot_disk_size" {
  type        = number
  default     = 20
  description = "Boot disk size in GB"
}

variable "workspace_disk_size" {
  type        = number
  default     = 50
  description = "Workspace persistent disk size in GB"
}

variable "container_image" {
  type        = string
  default     = "ghcr.io/ryanmaclean/vibecode-codeserver:latest"
  description = "Docker image for code-server"
}

variable "codeserver_password" {
  type        = string
  default     = "changeme"
  description = "Password for code-server access"
  sensitive   = true
}

variable "network" {
  type        = string
  default     = "default"
  description = "VPC network name"
}

variable "target_size" {
  type        = number
  default     = 1
  description = "Target number of instances in the managed instance group"
}

variable "enable_scheduling" {
  type        = bool
  default     = false
  description = "Enable Cloud Scheduler for automated start/stop"
}

variable "schedule_cron" {
  type        = string
  default     = "0 9 * * 1-5"
  description = "Cron expression for scheduling (default: weekdays 9 AM)"
}

variable "schedule_target_size" {
  type        = number
  default     = 1
  description = "Target size for scheduled scaling"
}

variable "timezone" {
  type        = string
  default     = "America/New_York"
  description = "Timezone for Cloud Scheduler"
}
