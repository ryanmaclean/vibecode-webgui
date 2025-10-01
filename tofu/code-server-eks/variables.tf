variable "region" {
  type    = string
  default = "us-east-1"
}

variable "cluster_endpoint" {
  type = string
}

variable "cluster_ca_certificate" {
  type = string
}

variable "auth_token" {
  type        = string
  description = "Bearer token for Kubernetes API (e.g., aws eks get-token)"
}

variable "namespace" {
  type    = string
  default = "default"
}

variable "release_name" {
  type    = string
  default = "codeserver"
}

variable "chart_path" {
  type    = string
  default = "../../helm/code-server-cloud"
}

variable "chart_version" {
  type    = string
  default = "0.1.0"
}

variable "chart_values_file" {
  type    = string
  default = "values.eks.yaml"
}

variable "code_server_password" {
  type    = string
  default = "changeme"
}

variable "enable_persistent_volume" {
  type    = bool
  default = true
}

variable "storage_class" {
  type    = string
  default = "efs-sc"
}

variable "spot_node_selector" {
  type    = map(string)
  default = {
    "lifecycle" = "Ec2Spot"
  }
}
