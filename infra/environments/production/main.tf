terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.91"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "platform" {
  source      = "../../modules/platform"
  project_name = var.project_name
  environment = "production"

  aws_region                 = var.aws_region
  vpc_id                     = var.vpc_id
  public_subnet_ids          = var.public_subnet_ids
  private_subnet_ids         = var.private_subnet_ids
  web_bucket_name            = var.web_bucket_name
  github_repository          = var.github_repository
  github_oidc_provider_arn   = var.github_oidc_provider_arn
  github_actions_role_name   = "${var.project_name}-production-github-actions"
  ecs_service_desired_count  = var.ecs_service_desired_count
  api_task_environment       = var.api_task_environment
  runtime_parameters         = var.runtime_parameters
  allowed_ingress_cidr_blocks = var.allowed_ingress_cidr_blocks
  deletion_protection_enabled = true
}
