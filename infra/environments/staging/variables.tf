variable "project_name" {
  type    = string
  default = "varasaan"
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "web_bucket_name" {
  type = string
}

variable "github_repository" {
  type = string
}

variable "github_oidc_provider_arn" {
  type = string
}

variable "ecs_service_desired_count" {
  type    = number
  default = 1
}

variable "api_task_environment" {
  type    = map(string)
  default = {}
}

variable "runtime_parameters" {
  type      = map(string)
  default   = {}
  sensitive = true
}

variable "allowed_ingress_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}
