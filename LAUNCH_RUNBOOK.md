# Launch Hardening Runbook

## Local Development

Use this flow when you want to run the Next.js frontend and FastAPI backend together on one machine for manual testing.

### Prerequisites

- Python 3.12+
- `uv`
- Node.js and `npm`

Install the app dependencies once from the repo root:

```powershell
uv sync --project backend
npm install --prefix frontend --ignore-scripts
```

### Start The Backend

Run the backend in its own terminal from the repo root:

```powershell
Set-Location D:\Varasaan\backend
$env:PYTHONPATH = 'src'
$env:DATABASE_URL = 'sqlite+aiosqlite:///D:/Varasaan/backend/.tmp-local.db'
$env:AUTO_CREATE_SCHEMA = 'true'
$env:CELERY_TASK_ALWAYS_EAGER = 'true'
$env:MOCK_EXTERNAL_SERVICES = 'true'
$env:DEBUG = 'true'
$env:FRONTEND_BASE_URL = 'http://localhost:3000'
$env:API_BASE_URL = 'http://127.0.0.1:8000'
$env:CORS_ALLOW_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://varasaan-staging.vercel.app,https://varasaan.vercel.app'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir src --host 127.0.0.1 --port 8000
```

What this local backend setup does:

- uses SQLite instead of local Postgres
- auto-creates the schema on startup
- runs Celery-backed flows inline
- mocks email, storage, and malware-scan integrations
- returns debug verification/reset/recovery tokens in the API responses

Backend URLs:

- API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/healthz`

### Seed Legal Policies On A Fresh Database

The register screen expects active privacy and terms policy versions. If `GET /api/v1/legal/policies` is empty, seed them once in a second terminal:

```powershell
@(
  @{
    policy_type = 'privacy'
    version = '2026.03'
    effective_from = '2026-03-01T00:00:00Z'
    is_active = $true
    checksum = 'privacy-2026-03'
  },
  @{
    policy_type = 'terms'
    version = '2026.03'
    effective_from = '2026-03-01T00:00:00Z'
    is_active = $true
    checksum = 'terms-2026-03'
  }
) | ForEach-Object {
  Invoke-RestMethod `
    -Uri 'http://127.0.0.1:8000/api/v1/legal/policies' `
    -Method Post `
    -ContentType 'application/json' `
    -Body ($_ | ConvertTo-Json)
}
```

### Start The Frontend

Run the frontend in a second terminal:

```powershell
Set-Location D:\Varasaan\frontend
$env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8000'
npm run dev -- --hostname localhost --port 3000
```

Open the app at `http://localhost:3000`.

### Local Testing Notes

- `http://localhost:3000` and `http://127.0.0.1:3000` are both allowed by the backend CORS settings above.
- Signup and recovery flows surface debug tokens in the UI when `DEBUG=true`.
- Billing can be exercised as a local UI/backend flow, but it is not connected to a live Razorpay checkout in this mode.
- Document, packet, export, and scan flows stay local because external integrations are mocked.

### Stop The Services

Use `Ctrl+C` in each terminal that is running `uvicorn` or `npm run dev`.

## Release Gates

Production and staging releases are blocked until these GitHub checks are green on the exact commit being shipped:

- `pr-title-lint`
- `contract-sync`
- `backend-quality`
- `frontend-quality`
- `infra-validate`
- `critical-path-e2e`

## Required Runtime Configuration

| Area | Required Variables |
| --- | --- |
| Core API | `JWT_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL` |
| Cookie auth | `ACCESS_COOKIE_NAME`, `REFRESH_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `CSRF_HEADER_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_DOMAIN` |
| Documents/exports | `S3_BUCKET_DOCUMENTS`, `S3_BUCKET_EXPORTS`, `KMS_KEY_ID`, `AWS_REGION` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET` |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM_ADDRESS`, `POSTMARK_SERVER_TOKEN` |
| Observability | `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` |

## Staging Provider Validation

Run these checks in staging before approving production:

| Check | Owner | Evidence |
| --- | --- | --- |
| Razorpay tier checkout order creation succeeds | Backend | staged order id + selected tier + webhook delivery log |
| Razorpay captured event updates payment status and entitlement state | Backend | payment record shows `captured` and `/api/v1/auth/me` shows the expected entitlement |
| Razorpay refund event reverses entitlement state when required by product rules | Backend | refund log + payment record + UI or API evidence after refresh |
| Billing history and invoice download work for a staged paid order | Backend | billing-history response + downloaded invoice artifact |
| Postmark verification email is delivered | Backend | inbox screenshot or provider event id |
| Postmark reset email is delivered | Backend | inbox screenshot or provider event id |
| Postmark invite/recovery emails are delivered | Backend | inbox screenshot or provider event id |
| Sentry event arrives with release + environment tags | Platform | Sentry issue or test event link |
| Alert routing fires for a synthetic failure | Platform | pager/email/slack evidence |

## UAT Checklist

Complete and record evidence for every critical path.

| Journey | Owner | Evidence | Exit criteria |
| --- | --- | --- | --- |
| Signup -> verify -> login | Frontend | Playwright run + screenshot | cookie session established and `/dashboard` loads |
| Password reset | Frontend | Playwright run | new password logs in successfully |
| Assisted recovery | Frontend | Playwright run | approval + recovery token flow completes |
| Inventory CRUD | Frontend | Playwright run | create, edit, delete all succeed |
| Trusted contact invite/accept/revoke | Frontend | Playwright run | status transitions to `active` then `revoked` |
| Document upload -> scan -> download -> grant | Frontend | Playwright run | clean scan visible, download succeeds, grant recorded |
| Packet/export generation | Frontend | Playwright run | jobs move to `ready`; one-time token replay denied |
| Checkout + entitlement refresh + refund | Backend | Playwright run + webhook log + UI capture | checkout succeeds, entitlement state refreshes without manual intervention, and refund behavior matches product rules |

## Go/No-Go Checklist

All of the following must be true before production tag creation:

- Staging deploy is green.
- `critical-path-e2e` passed on the release commit.
- Razorpay and Postmark staging checks, including payment, refund, entitlement refresh, and invoice validation, were executed the same day as release approval.
- Sentry release tagging and alert routing were verified.
- Rollback owner is assigned and on-call coverage is confirmed for the first 24 hours.
- `python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>` passes against the target environment.

## Deployment Sequence

1. Deploy backend and apply migrations.
2. Deploy frontend with the matching API base URL and release metadata.
3. Run `python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>`.
4. Confirm GitHub deployment, Sentry release, and provider dashboards reflect the new version.

## Rollback

1. Halt new production releases and notify the release owner.
2. Roll back frontend to the previous healthy deployment.
3. Roll back backend to the previous release and run the matching rollback migration if required.
4. Re-run `python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>` against the restored version.
5. Record the incident, timeline, and customer impact in the launch log.

## First 24 Hours Monitoring

Check these signals at deploy +15m, +1h, +4h, and +24h:

- API 5xx rate
- auth `401` and `403` spikes after cookie rollout
- Razorpay webhook failure rate
- worker retry spikes
- queue latency for packet/export/scan jobs
- Postmark bounce/deferred events
- new Sentry issues for the shipped release

Use `python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>` for repeat smoke checks during the observation window.
