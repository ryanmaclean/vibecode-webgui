# Input variables for Azure OpenAI Monitoring module

variable "environment" {
  description = "The environment (e.g., dev, staging, prod)"
  type        = string
}

variable "service_name" {
  description = "Name of the service being monitored"
  type        = string
  default     = "vibecode-ai"
}

variable "slack_channel" {
  description = "Slack channel for alerts"
  type        = string
  default     = "#alerts-ai"
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alerts (percentage)"
  type        = number
  default     = 5.0
}

variable "latency_threshold_ms" {
  description = "Latency threshold in milliseconds for alerts"
  type        = number
  default     = 1000
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
