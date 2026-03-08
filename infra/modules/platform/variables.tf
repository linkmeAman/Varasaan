variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (staging or production)."
  type        = string
}

variable "aws_region" {
  description = "AWS region for resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID used for ECS and ALB."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs used by ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs used by ECS services/tasks."
  type        = list(string)
}

variable "web_bucket_name" {
  description = "S3 bucket name for frontend assets."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name format."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider for token.actions.githubusercontent.com."
  type        = string
}

variable "github_actions_role_name" {
  description = "IAM role name assumed by GitHub Actions for this environment."
  type        = string
}

variable "api_container_port" {
  description = "API container port exposed through ALB."
  type        = number
  default     = 8000
}

variable "api_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "api_image" {
  description = "Fallback API image used until CI/CD updates service task definition."
  type        = string
  default     = "public.ecr.aws/docker/library/nginx:latest"
}

variable "ecs_service_desired_count" {
  description = "Desired ECS service count."
  type        = number
  default     = 1
}

variable "api_task_environment" {
  description = "Environment variables for API task definition."
  type        = map(string)
  default     = {}
}

variable "runtime_parameters" {
  description = "Runtime parameters stored in SSM Parameter Store (SecureString)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "allowed_ingress_cidr_blocks" {
  description = "CIDR blocks allowed to reach ALB listener."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "deletion_protection_enabled" {
  description = "Enable ALB deletion protection."
  type        = bool
  default     = true
}
