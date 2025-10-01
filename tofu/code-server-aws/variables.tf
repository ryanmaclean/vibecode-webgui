variable "region" {
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  default     = "t4g.small"
}

variable "instance_name" {
  type        = string
  default     = "codeserver-dev"
}
