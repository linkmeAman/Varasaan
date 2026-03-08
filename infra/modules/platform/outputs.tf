output "ecr_repository_name" {
  value       = aws_ecr_repository.api.name
  description = "ECR repository name for backend image pushes."
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.api.repository_url
  description = "ECR repository URL for backend image pushes."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.api.name
  description = "ECS cluster name."
}

output "ecs_service_name" {
  value       = aws_ecs_service.api.name
  description = "ECS service name."
}

output "ecs_task_definition_family" {
  value       = aws_ecs_task_definition.api.family
  description = "ECS task definition family used by deploy workflow."
}

output "ecs_task_container_name" {
  value       = "api"
  description = "Container name inside task definition."
}

output "alb_dns_name" {
  value       = aws_lb.api.dns_name
  description = "ALB DNS for backend endpoint checks."
}

output "web_bucket_name" {
  value       = aws_s3_bucket.web.bucket
  description = "S3 bucket name for frontend deployment."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.web.id
  description = "CloudFront distribution ID for invalidations."
}

output "cloudfront_distribution_domain_name" {
  value       = aws_cloudfront_distribution.web.domain_name
  description = "CloudFront domain for frontend URL smoke checks."
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "IAM role ARN to store in GitHub Environment secrets."
}

output "ecs_private_subnet_ids_csv" {
  value       = join(",", var.private_subnet_ids)
  description = "CSV of private subnet IDs for ECS run-task network config."
}

output "ecs_security_group_ids_csv" {
  value       = aws_security_group.ecs.id
  description = "CSV of ECS security group IDs for ECS run-task network config."
}
