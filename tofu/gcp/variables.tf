# GCP Cloud Workspaces - Terraform Variables

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
  description = "GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "vibecode-workspaces"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "subnet_cidr" {
  description = "CIDR range for the subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "pods_cidr" {
  description = "CIDR range for GKE pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "CIDR range for GKE services"
  type        = string
  default     = "10.2.0.0/20"
}

variable "filestore_tier" {
  description = "Filestore tier (BASIC_HDD, BASIC_SSD, ENTERPRISE)"
  type        = string
  default     = "BASIC_HDD"
}

variable "filestore_capacity_gb" {
  description = "Filestore capacity in GB (min 1024 for BASIC_HDD)"
  type        = number
  default     = 1024
}

variable "idle_threshold_minutes" {
  description = "Minutes of inactivity before suspending workspace"
  type        = number
  default     = 30
}

variable "terminate_threshold_hours" {
  description = "Hours of inactivity before terminating workspace"
  type        = number
  default     = 24
}

variable "enable_spot_vms" {
  description = "Enable spot VMs for cost savings"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
