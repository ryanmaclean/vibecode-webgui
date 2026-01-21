variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for deployment"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment name (dev, staging, prod)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for VPC"
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Enable NAT Gateway for private subnets"
}

variable "task_cpu" {
  type        = number
  default     = 512
  description = "CPU units for ECS task (256, 512, 1024, 2048, 4096)"
}

variable "task_memory" {
  type        = number
  default     = 1024
  description = "Memory in MB for ECS task"
}

variable "desired_count" {
  type        = number
  default     = 1
  description = "Desired number of ECS tasks"
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

variable "log_retention_days" {
  type        = number
  default     = 7
  description = "CloudWatch log retention in days"
}

variable "enable_scheduling" {
  type        = bool
  default     = false
  description = "Enable EventBridge Scheduler for automated start/stop"
}

variable "schedule_cron" {
  type        = string
  default     = "0 9 * * 1-5"
  description = "Cron expression for scheduling (default: weekdays 9 AM)"
}

variable "enable_idle_detection" {
  type        = bool
  default     = false
  description = "Enable Lambda-based idle detection and auto-shutdown"
}

variable "idle_threshold_minutes" {
  type        = number
  default     = 30
  description = "Minutes of inactivity before considering idle"
}
