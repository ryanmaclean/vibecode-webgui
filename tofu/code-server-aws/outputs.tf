output "vpc_id" {
  value       = aws_vpc.codeserver.id
  description = "ID of the VPC"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.codeserver.name
  description = "Name of the ECS cluster"
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.codeserver.arn
  description = "ARN of the ECS cluster"
}

output "ecs_service_name" {
  value       = aws_ecs_service.codeserver.name
  description = "Name of the ECS service"
}

output "ecs_service_arn" {
  value       = aws_ecs_service.codeserver.id
  description = "ARN of the ECS service"
}

output "load_balancer_dns" {
  value       = aws_lb.codeserver.dns_name
  description = "DNS name of the Application Load Balancer"
}

output "load_balancer_zone_id" {
  value       = aws_lb.codeserver.zone_id
  description = "Zone ID of the Application Load Balancer"
}

output "efs_file_system_id" {
  value       = aws_efs_file_system.codeserver.id
  description = "ID of the EFS file system"
}

output "efs_file_system_arn" {
  value       = aws_efs_file_system.codeserver.arn
  description = "ARN of the EFS file system"
}

output "cloudwatch_log_group_name" {
  value       = aws_cloudwatch_log_group.codeserver.name
  description = "Name of the CloudWatch log group"
}

output "scheduler_job_name" {
  value       = var.enable_scheduling ? aws_scheduler_schedule.codeserver_start[0].name : null
  description = "Name of the EventBridge Scheduler job (if enabled)"
}

output "access_instructions" {
  sensitive = true
  value = <<-EOT
    Code-server instances are running on AWS ECS Fargate Spot with the following configuration:
    - Environment: ${var.environment}
    - Region: ${var.region}
    - Task CPU: ${var.task_cpu}
    - Task Memory: ${var.task_memory}MB
    - Desired Count: ${var.desired_count}
    - Container Image: ${var.container_image}
    - EFS File System: ${aws_efs_file_system.codeserver.id}
    
    To access your code-server:
    1. Load Balancer URL: http://${aws_lb.codeserver.dns_name}
    2. Password: ${var.codeserver_password}
    
    To scale the service:
    aws ecs update-service --cluster ${aws_ecs_cluster.codeserver.name} --service ${aws_ecs_service.codeserver.name} --desired-count N
    
    To view logs:
    aws logs tail /ecs/${var.environment}-codeserver --follow
  EOT
  description = "Instructions for accessing and managing code-server instances"
}

output "cost_optimization_info" {
  value = <<-EOT
    Cost Optimization Features:
    - Fargate Spot: Up to 70% cost savings vs regular Fargate
    - EFS One Zone: Reduced storage costs for single-AZ deployments
    - EventBridge Scheduler: Automated start/stop to reduce idle costs
    - CloudWatch Logs: 7-day retention to minimize log storage costs
    
    Estimated monthly cost (1 task, 512 CPU, 1GB memory):
    - Fargate Spot: ~$15-20/month
    - EFS One Zone: ~$3-5/month
    - ALB: ~$16/month
    - Total: ~$35-40/month per developer workspace
  EOT
  description = "Information about cost optimization features"
}
