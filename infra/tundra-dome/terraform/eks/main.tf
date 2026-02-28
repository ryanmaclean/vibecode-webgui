# Tundra Dome EKS Cluster - AWS Elastic Kubernetes Service
# Multi-cluster infrastructure for distributed bead processing

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    # Configure via backend.tf or environment variables
  }
}

# Provider configuration
provider "aws" {
  region = var.region

  default_tags {
    tags = local.common_tags
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  cluster_name = "${var.cluster_prefix}-${var.environment}-${random_id.suffix.hex}"

  common_tags = merge(var.tags, {
    Environment  = var.environment
    Project      = "tundra-dome"
    ManagedBy    = "terraform"
    ClusterType  = "multi-cluster"
    CreatedDate  = formatdate("YYYY-MM-DD", timestamp())
  })

  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

# VPC for EKS cluster
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = var.single_nat_gateway
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Kubernetes specific tags
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version

  # Cluster endpoint access
  cluster_endpoint_public_access  = var.cluster_endpoint_public_access
  cluster_endpoint_private_access = true

  # VPC configuration
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Enable IRSA for pod-level IAM permissions
  enable_irsa = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # Cluster encryption
  cluster_encryption_config = {
    resources        = ["secrets"]
    provider_key_arn = var.kms_key_arn
  }

  # Managed node groups
  eks_managed_node_groups = {
    # System node group for critical workloads
    system = {
      min_size     = var.system_node_min_count
      max_size     = var.system_node_max_count
      desired_size = var.system_node_count

      instance_types = var.system_node_instance_types
      capacity_type  = "ON_DEMAND"

      labels = {
        nodepool     = "system"
        workload     = "system"
        cluster-type = "tundra-dome"
      }

      taints = [{
        key    = "CriticalAddonsOnly"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]

      tags = merge(local.common_tags, {
        "nodepool-type" = "system"
      })
    }

    # Application node group for bead workers
    application = {
      min_size     = var.app_node_min_count
      max_size     = var.app_node_max_count
      desired_size = var.app_node_count

      instance_types = var.app_node_instance_types
      capacity_type  = var.app_node_capacity_type

      labels = {
        nodepool     = "application"
        workload     = "beads"
        cluster-type = "tundra-dome"
      }

      tags = merge(local.common_tags, {
        "nodepool-type"    = "application"
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler/${local.cluster_name}" = "owned"
      })
    }
  }

  # AWS auth configuration
  manage_aws_auth_configmap = true
  aws_auth_roles            = var.aws_auth_roles
  aws_auth_users            = var.aws_auth_users

  tags = local.common_tags
}

# CloudWatch log group for cluster logging
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${local.cluster_name}/cluster"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# ECR repository for container images
resource "aws_ecr_repository" "tundra_dome" {
  count = var.create_ecr_repository ? 1 : 0

  name                 = "${local.cluster_name}-images"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = var.kms_key_arn != null ? "KMS" : "AES256"
    kms_key         = var.kms_key_arn
  }

  tags = local.common_tags
}

# ECR lifecycle policy
resource "aws_ecr_lifecycle_policy" "tundra_dome" {
  count = var.create_ecr_repository ? 1 : 0

  repository = aws_ecr_repository.tundra_dome[0].name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# Kubernetes namespace for tundra-dome
resource "kubernetes_namespace" "tundra_dome" {
  metadata {
    name = "tundra-dome"

    labels = {
      name        = "tundra-dome"
      environment = var.environment
      managed-by  = "terraform"
      cluster     = local.cluster_name
    }
  }

  depends_on = [module.eks]
}

# Variables for configuration
variable "region" {
  description = "AWS region for EKS cluster"
  type        = string
  default     = "us-west-2"
}

variable "cluster_prefix" {
  description = "Prefix for cluster name"
  type        = string
  default     = "tundra-dome"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway (cost optimization)"
  type        = bool
  default     = false
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "cluster_endpoint_public_access" {
  description = "Enable public access to cluster endpoint"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption (optional)"
  type        = string
  default     = null
}

variable "system_node_count" {
  description = "Desired number of system nodes"
  type        = number
  default     = 2
}

variable "system_node_min_count" {
  description = "Minimum number of system nodes"
  type        = number
  default     = 1
}

variable "system_node_max_count" {
  description = "Maximum number of system nodes"
  type        = number
  default     = 4
}

variable "system_node_instance_types" {
  description = "Instance types for system nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "app_node_count" {
  description = "Desired number of application nodes"
  type        = number
  default     = 3
}

variable "app_node_min_count" {
  description = "Minimum number of application nodes"
  type        = number
  default     = 2
}

variable "app_node_max_count" {
  description = "Maximum number of application nodes"
  type        = number
  default     = 10
}

variable "app_node_instance_types" {
  description = "Instance types for application nodes"
  type        = list(string)
  default     = ["t3.large"]
}

variable "app_node_capacity_type" {
  description = "Capacity type for application nodes (ON_DEMAND or SPOT)"
  type        = string
  default     = "ON_DEMAND"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "create_ecr_repository" {
  description = "Create ECR repository for container images"
  type        = bool
  default     = true
}

variable "aws_auth_roles" {
  description = "Additional IAM roles for aws-auth ConfigMap"
  type        = list(any)
  default     = []
}

variable "aws_auth_users" {
  description = "Additional IAM users for aws-auth ConfigMap"
  type        = list(any)
  default     = []
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

# Outputs
output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = var.create_ecr_repository ? aws_ecr_repository.tundra_dome[0].repository_url : null
}
