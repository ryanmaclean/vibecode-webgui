variable "cluster_endpoint" {
  type        = string
  description = "GKE API server endpoint"
}

variable "client_certificate" {
  type        = string
  description = "Base64-encoded client cert for Kubernetes auth"
}

variable "client_key" {
  type        = string
  description = "Base64-encoded client key for Kubernetes auth"
}

variable "cluster_ca_certificate" {
  type        = string
  description = "Base64-encoded cluster CA cert"
}

variable "namespace" {
  type        = string
  default     = "default"
}

variable "release_name" {
  type        = string
  default     = "codeserver"
}

variable "chart_path" {
  type        = string
  default     = "../../helm/code-server-cloud"
}

variable "chart_version" {
  type        = string
  default     = "0.1.0"
}

variable "chart_values_file" {
  type        = string
  default     = "values.yaml"
  description = "Additional values file passed to helm_release"
}

variable "code_server_password" {
  type        = string
  default     = "changeme"
}

variable "enable_persistent_volume" {
  type        = bool
  default     = true
}

variable "workspace_size_gb" {
  type        = number
  default     = 50
}

variable "storage_class" {
  type        = string
  default     = ""
}

variable "enable_datadog_sidecar" {
  type        = bool
  default     = false
}
