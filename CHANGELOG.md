# Changelog

All notable changes to this repository are documented in this file.

## Unreleased

- Synced the public Phase A case-review contract into `packages/shared/openapi/openapi.yaml`, regenerated `packages/shared/openapi/openapi.generated.json`, `frontend/src/lib/generated/api-client.ts`, and `frontend/src/api/openapi-types.ts`, and verified the backend contract/integration regressions against the new public fields.
- Surfaced executor `pending review` and `rejected review` states in the landing/workspace flow, added review reason/note display, and routed replacement certificate upload through the same activation surface without changing active/closed behavior.
- Added executor Playwright coverage for queued review, rejection, and replacement upload, and tightened the delivery docs around merge-to-main stream sequencing, stop conditions, and non-code evidence tracking.
- Reclassified the remaining work in the status docs into three buckets: required for the current release, required for MVP completion, and later roadmap only.
- Audited the current delivery state, updated the roadmap/checklist docs for the consolidated pre-Phase-A baseline, and rewrote the next-step plan around the Phase A sync stream followed by the frontend stream.
- Added the Phase A backend hardening slice: death-certificate metadata stripping, risk-based manual review state, hidden internal review endpoints, review metadata on case summaries, and regression coverage for clean, queued, approved, rejected, and replacement-upload activation paths.
- Documented the synchronized multi-phase delivery model, added a root `npm run verify:sync` entrypoint for the sync stream, and expanded the PR template to require contract/doc alignment across phase work.
- Added the first after-loss foundation slice: executor trusted-contact designation, pending and active case lifecycle, case-scoped death-certificate activation, task snapshot generation, executor workspace routes, and synced OpenAPI/frontend client artifacts.
- Added the Phase 2.3 executor evidence/report slice: task-scoped evidence uploads and downloads, malware-scan-gated clean evidence references, activity timeline entries, and a live printable closure report view.
- Added the Phase 2.4 bleed-stopper slice: recurring-payment planning metadata, activation-time task snapshots, executor bleed summary totals, workspace checklist previews, and a printable rail-specific cancellation/dispute guide for card, UPI autopay, and other recurring payments.
- Added the after-loss hardening follow-up: case-open designated-contact notifications, executor-driven case closure, fixed evidence-retention windows, automated case-evidence cleanup, and closed-case report/landing UI states.
