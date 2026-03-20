output "github_environment_vars" {
  description = "Map these outputs to GitHub Environment variables for staging workflows."
  value = {
    STAGING_ECR_REPOSITORY             = module.platform.ecr_repository_name
    STAGING_ECS_CLUSTER                = module.platform.ecs_cluster_name
    STAGING_ECS_SERVICE                = module.platform.ecs_service_name
    STAGING_TASK_DEFINITION_FAMILY     = module.platform.ecs_task_definition_family
    STAGING_TASK_CONTAINER_NAME        = module.platform.ecs_task_container_name
    STAGING_MIGRATION_TASK_DEFINITION  = module.platform.ecs_task_definition_family
    STAGING_PRIVATE_SUBNETS            = module.platform.ecs_private_subnet_ids_csv
    STAGING_SECURITY_GROUPS            = module.platform.ecs_security_group_ids_csv
    STAGING_WEB_BUCKET                 = module.platform.web_bucket_name
    STAGING_CLOUDFRONT_DISTRIBUTION_ID = module.platform.cloudfront_distribution_id
    STAGING_API_HEALTH_URL             = "http://${module.platform.alb_dns_name}/healthz"
    STAGING_WEB_URL                    = ""
    STAGING_LEGACY_WEB_URL             = "https://${module.platform.cloudfront_distribution_domain_name}"
  }
}

output "github_environment_secrets" {
  description = "Map these outputs to GitHub Environment secrets for staging workflows."
  value = {
    AWS_STAGING_ROLE_ARN = module.platform.github_actions_role_arn
  }
  sensitive = true
}
