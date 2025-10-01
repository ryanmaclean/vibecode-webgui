output "instance_group_manager_name" {
  value       = google_compute_instance_group_manager.codeserver.name
  description = "Name of the managed instance group"
}

output "instance_group_manager_url" {
  value       = google_compute_instance_group_manager.codeserver.instance_group
  description = "URL of the managed instance group"
}

output "service_account_email" {
  value       = google_service_account.codeserver.email
  description = "Email of the service account used by instances"
}

output "health_check_url" {
  value       = google_compute_health_check.codeserver.self_link
  description = "URL of the health check"
}

output "scheduler_job_name" {
  value       = var.enable_scheduling ? google_cloud_scheduler_job.codeserver_schedule[0].name : null
  description = "Name of the Cloud Scheduler job (if enabled)"
}

output "access_instructions" {
  sensitive = true
  value = <<-EOT
    Code-server instances are running with the following configuration:
    - Environment: ${var.environment}
    - Machine Type: ${var.machine_type}
    - Target Size: ${var.target_size}
    - Container Image: ${var.container_image}
    - Workspace Disk Size: ${var.workspace_disk_size}GB
    
    To access your instances:
    1. Find the external IP: gcloud compute instances list --filter="name~codeserver-${var.environment}"
    2. Access code-server at: http://EXTERNAL_IP:8080
    3. Password: ${var.codeserver_password}
    
    To scale instances:
    gcloud compute instance-groups managed resize ${google_compute_instance_group_manager.codeserver.name} --size=N --zone=${var.zone}
  EOT
  description = "Instructions for accessing and managing code-server instances"
}
