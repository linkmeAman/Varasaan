# MVP Launch Runbook

## Pre-Deploy Checks

- Ensure `packages/shared/openapi/openapi.yaml` and generated frontend/backend API artifacts are in sync.
- Run backend checks: `pytest backend/tests`.
- Run frontend checks: `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`.

## Required Runtime Configuration

- `JWT_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`
- AWS document/export buckets + KMS (`S3_BUCKET_DOCUMENTS`, `S3_BUCKET_EXPORTS`, `KMS_KEY_ID`)
- Payments: `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`
- Email: `EMAIL_PROVIDER`, `EMAIL_FROM_ADDRESS`, `POSTMARK_SERVER_TOKEN`
- Observability: `SENTRY_DSN` (optional but recommended)

## Staging Validation

- Health check: `GET /healthz` returns `{"status":"ok"}`.
- Signup returns message and verification token in debug mode.
- Login, refresh, logout, and logout-all are working.
- Inventory CRUD, trusted contact invite/accept, and document scan workflow are functional.
- Packet/export job creation and payment checkout API return expected states.

## Production Cutover

- Deploy backend and run Alembic migration task.
- Deploy frontend.
- Validate smoke journeys end-to-end:
  - Signup -> verify -> login
  - Inventory CRUD
  - Trusted contact invite + accept
  - Document upload -> scan -> download
  - Packet/export job creation
  - Checkout create + payment status fetch

## Post-Deploy Monitoring

- Track backend 5xx spikes, auth failures, webhook failures, and worker task retries.
- Review Sentry error feed and API logs for first 24 hours.
- Validate queue latency for export/packet/malware scan workers.
