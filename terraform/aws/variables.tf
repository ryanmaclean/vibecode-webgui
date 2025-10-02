# AWS Cloud Workspaces - Terraform Variables

variable "region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "vibecode-workspaces"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.28"
}

variable "vpc_cidr" {
  description = "CIDR range for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR ranges for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR ranges for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "spot_instance_types" {
  description = "EC2 instance types for Spot node group"
  type        = list(string)
  default     = ["t3.large", "t3a.large", "t3.xlarge", "t3a.xlarge"]
}

variable "on_demand_instance_types" {
  description = "EC2 instance types for on-demand node group"
  type        = list(string)
  default     = ["t3.medium", "t3a.medium"]
}

variable "min_nodes" {
  description = "Minimum number of spot nodes"
  type        = number
  default     = 2
}

variable "max_nodes" {
  description = "Maximum number of spot nodes"
  type        = number
  default     = 20
}

variable "desired_nodes" {
  description = "Desired number of spot nodes"
  type        = number
  default     = 3
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

variable "efs_throughput_mode" {
  description = "EFS throughput mode (bursting or elastic)"
  type        = string
  default     = "elastic"
}

variable "enable_karpenter" {
  description = "Enable Karpenter for advanced node autoscaling"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
