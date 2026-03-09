output "github_environment_vars" {
  description = "Map these outputs to GitHub Environment variables for production workflows."
  value = {
    PROD_ECR_REPOSITORY               = module.platform.ecr_repository_name
    PROD_ECS_CLUSTER                  = module.platform.ecs_cluster_name
    PROD_ECS_SERVICE                  = module.platform.ecs_service_name
    PROD_TASK_DEFINITION_FAMILY       = module.platform.ecs_task_definition_family
    PROD_TASK_CONTAINER_NAME          = module.platform.ecs_task_container_name
    PROD_MIGRATION_TASK_DEFINITION    = module.platform.ecs_task_definition_family
    PROD_PRIVATE_SUBNETS              = module.platform.ecs_private_subnet_ids_csv
    PROD_SECURITY_GROUPS              = module.platform.ecs_security_group_ids_csv
    PROD_WEB_BUCKET                   = module.platform.web_bucket_name
    PROD_CLOUDFRONT_DISTRIBUTION_ID   = module.platform.cloudfront_distribution_id
    PROD_API_HEALTH_URL               = "http://${module.platform.alb_dns_name}/healthz"
    PROD_WEB_URL                      = ""
    PROD_LEGACY_WEB_URL               = "https://${module.platform.cloudfront_distribution_domain_name}"
  }
}

output "github_environment_secrets" {
  description = "Map these outputs to GitHub Environment secrets for production workflows."
  value = {
    AWS_PRODUCTION_ROLE_ARN = module.platform.github_actions_role_arn
  }
  sensitive = true
}
