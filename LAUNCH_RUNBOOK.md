# Launch Hardening Runbook

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
| Razorpay checkout order creation succeeds | Backend | staged order id + webhook delivery log |
| Razorpay webhook captured event updates payment status | Backend | payment record shows `captured` with sequence |
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
| Checkout + payment webhook | Backend | Playwright run + webhook log | checkout created and payment status updates |

## Go/No-Go Checklist

All of the following must be true before production tag creation:

- Staging deploy is green.
- `critical-path-e2e` passed on the release commit.
- Razorpay and Postmark staging checks were executed the same day as release approval.
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
