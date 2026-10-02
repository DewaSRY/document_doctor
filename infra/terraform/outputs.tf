output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.ai_translation.id
}

output "public_ip" {
  description = "Elastic IP of the ai-translation instance"
  value       = aws_eip.ai_translation.public_ip
}

output "app_url" {
  description = "HTTPS AI API base URL. Set the Worker secret AI_TRANSLATION_API_URL to this plus /api/v1."
  value       = "https://${var.api_domain}"
}

output "health_url" {
  description = "Health check, through Caddy"
  value       = "https://${var.api_domain}/api/health"
}

output "ssh_command" {
  description = "Command to SSH into the instance"
  value       = "ssh -i ${local_file.private_key.filename} ec2-user@${aws_eip.ai_translation.public_ip}"
}

output "rendered_user_data" {
  description = "The exact first-boot script aws_instance.ai_translation was given. Sensitive values are embedded in base64 in the script; protect the Terraform state and restrict EC2 user-data access."
  value       = local.user_data
  sensitive   = true
}
