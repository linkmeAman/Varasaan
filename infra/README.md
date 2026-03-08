# Terraform Deployment Stacks

This folder defines separate Terraform stacks for staging and production:

- `infra/environments/staging`
- `infra/environments/production`

Both stacks call `infra/modules/platform`, which provisions:

- ECR repository for API images
- ECS cluster/service/task definition for API runtime
- ALB + target group + listener
- S3 bucket + CloudFront distribution for frontend hosting
- GitHub Actions OIDC IAM role for CI/CD deploy workflows
- SSM parameter namespace for runtime variables

## Workflow configuration source

Promote Terraform outputs into GitHub Environment variables/secrets:

1. `terraform -chdir=infra/environments/staging output`
2. `terraform -chdir=infra/environments/production output`
3. Copy `github_environment_vars` keys into GitHub Environment variables.
4. Copy `github_environment_secrets` keys into GitHub Environment secrets.

## Validation

CI runs:

- `terraform fmt -check -recursive`
- `terraform init -backend=false`
- `terraform validate`
- `tflint`

Optional `terraform plan` can be enabled by setting repo variable `TF_PLAN_ENABLED=true` and `AWS_TERRAFORM_PLAN_ROLE_ARN`.
