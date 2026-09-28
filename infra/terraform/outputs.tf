output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.ai_translation.id
}

output "public_ip" {
  description = "Elastic IP of the ai-translation instance"
  value       = aws_eip.ai_translation.public_ip
}

output "app_url" {
  description = "ai-translation base URL, through nginx. Set the portal's AI_TRANSLATION_API_URL to this plus /v1."
  value       = "http://${aws_eip.ai_translation.public_ip}:${var.nginx_port}"
}

output "health_url" {
  description = "Health check, through nginx"
  value       = "http://${aws_eip.ai_translation.public_ip}:${var.nginx_port}/health"
}

output "docs_url" {
  description = "FastAPI Swagger UI, through nginx"
  value       = "http://${aws_eip.ai_translation.public_ip}:${var.nginx_port}/docs"
}

output "ssh_command" {
  description = "Command to SSH into the instance"
  value       = "ssh -i ${local_file.private_key.filename} ec2-user@${aws_eip.ai_translation.public_ip}"
}

output "rendered_user_data" {
  description = "The exact first-boot script aws_instance.ai_translation was given. EC2 only runs it once, on first boot, so `make tf-redeploy` pipes this over SSH to bring an already-running instance in line with the current config (new image, new nginx settings, etc). Sensitive: embeds the database password and HF token in plaintext."
  value       = local.user_data
  sensitive   = true
}
