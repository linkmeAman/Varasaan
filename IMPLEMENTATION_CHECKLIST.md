# CI/CD + Governance Implementation Checklist

## 1. Initialize remote governance

- Set GitHub default branch to `main`.
- Run `pwsh ./scripts/github/apply-governance.ps1 -Repo <owner/repo>`.
- Confirm repository merge settings:
  - Squash merge enabled.
  - Merge commit disabled.
  - Rebase merge disabled.

## 2. Configure GitHub Environments

Create environments:

- `staging`
- `production` (with required reviewers)

Populate variables and secrets from Terraform outputs:

- `infra/environments/staging` -> staging env vars/secrets
- `infra/environments/production` -> production env vars/secrets

## 3. Required checks on main ruleset

Ensure exact required check names:

- `pr-title-lint`
- `contract-sync`
- `backend-quality`
- `frontend-quality`
- `infra-validate`
- `critical-path-e2e`

## 4. Contract synchronization policy

Canonical generated files:

- `packages/shared/openapi/openapi.generated.json`
- `frontend/src/api/openapi-types.ts`
- `frontend/src/lib/generated/api-client.ts`

Regeneration commands:

- `python backend/scripts/generate_openapi.py`
- `npm --prefix frontend run generate:api`

## 5. Local developer setup

- Install root tooling: `npm install`
- Install git hook: `npm run prepare`
- Backend deps: `uv sync --project backend --extra dev`
- Frontend deps: `npm ci --prefix frontend`
- Playwright browser: `npx --prefix frontend playwright install chromium`

## 6. Validate workflows

- Open PR with invalid title -> `pr-title-lint` fails.
- Change backend schema without generated artifacts -> `contract-sync` fails.
- Break a critical Playwright flow -> `critical-path-e2e` fails and blocks release.
- Push to `main` -> staging deployment workflow runs.
- Release on `main` after CI success -> semantic-release cuts `v*` tag.
- Push `v*` tag -> production deployment waits on `production` environment approval.
