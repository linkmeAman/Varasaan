# Digital Legacy Manager - Progress Checklist

This document tracks shipped state plus the standing three-stream delivery model defined in `EXECUTION_PLAN.md`. A phase is complete only when backend, sync/QA/docs, and frontend all land with aligned contract artifacts and docs.

## Shipped Baseline

- [x] Foundation: monorepo structure, CI/CD, async backend, cookie-auth security baseline, and OpenAPI contract sync are in place.
- [x] Planning mode baseline: auth, inventory, trusted contacts, document uploads, evidence packet/export jobs, heartbeat flows, and the backend Razorpay surface are implemented.
- [x] After-loss baseline: executor designation, pending/active cases, activation upload flow, task workspace, evidence capture, live closure reporting, case-open notifications, case closure, retention cleanup, and bleed-stopper guidance are implemented.
- [ ] Planning mode finish: the real checkout UI and staging payment validation are still open.

## Standing Delivery Rules

- [x] Streams: `Backend`, `Frontend`, and `Sync / QA / Docs`.
- [x] Commit order: backend -> sync / QA / docs -> frontend -> optional integration fix.
- [x] Branch pattern: `codex/<phase>-backend`, `codex/<phase>-sync`, `codex/<phase>-frontend`.
- [x] Backend owns public interface changes.
- [x] Frontend consumes only generated client/types.
- [x] Sync stream owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- [x] Current tree hygiene: the mixed Phase 2.4 and closure-hardening tree was consolidated into `codex/pre-phase-a-baseline`, and the Phase A stream branches were cut from that baseline.

## Active Phase Queue

### Phase A - After-Loss Hardening Finish (in progress)

Target commits:
- `feat(api): add activation sanitization and review flow`
- `chore(contract): sync activation review schema and docs`
- `feat(web): surface activation review states`

Audit snapshot (2026-03-22):
- Backend stream is implemented and verified on `codex/phase-a-backend`.
- Sync / QA / Docs is the next active stream.
- Frontend remains blocked until the synced public contract and generated client/types are available.

Checklist:
- [x] Strip death-certificate metadata before activation.
- [x] Add risk-based manual review state and internal review endpoints.
- [x] Keep the public case lifecycle stable by extending case summary payloads with review metadata.
- [x] Add integration coverage for clean activation, queued review, approval, rejection, and replacement upload.
- [ ] Regenerate public contract/client artifacts without exposing internal review routes.
- [ ] Add executor UX states for `pending review` and `rejected review`.
- [ ] Show review reason/note and the replacement-upload path.

Exit gate:
- [x] Backend enforces exactly one of `active`, `pending review`, or `rejected review`.
- [x] Backend review tooling avoids manual DB intervention for queue, approve, reject, and replacement-upload flows.
- [ ] Public contract sync, generated artifacts, docs, and executor UX are still pending.

### Phase B - Payment & Checkout Finish (next)

Target commits:
- Optional backend only if needed: `feat(api): complete payment support surface`
- `chore(contract): sync payment artifacts and docs`
- `feat(web): ship checkout and payment verification flow`

Checklist:
- [ ] Build the real checkout flow for paid tiers.
- [ ] Add Razorpay status polling plus success, failure, and retry states.
- [ ] Refresh entitlements after payment success.
- [ ] Sync contract/client artifacts only if payment payloads change.
- [ ] Complete staging validation with a real paid order.

Exit gate:
- [ ] A real paid order in staging unlocks the intended UI.

### Phase C - Family Workspace

Target commits:
- `feat(api): add case collaboration and assignment`
- `chore(contract): sync collaboration artifacts and docs`
- `feat(web): add family workspace collaboration`

Checklist:
- [ ] Expand case participants beyond a single executor.
- [ ] Add task assignment, comment threads, and participant-aware activity logging.
- [ ] Add task-status email notifications.
- [ ] Regenerate contract/client artifacts and update docs.
- [ ] Add participant panel, assignment UI, comments, and richer activity feed.

Exit gate:
- [ ] Multiple participants can collaborate on one active case with assignment, comments, notifications, and audit visibility.

### Phase D - Crypto Inheritance Kit

Target commits:
- `feat(api): add crypto inheritance kit`
- `chore(contract): sync crypto artifacts and docs`
- `feat(web): add crypto planning and executor guidance`

Checklist:
- [ ] Add planning-mode crypto asset models.
- [ ] Snapshot crypto planning data into case-time records at activation.
- [ ] Add executor crypto guidance payloads and UI.
- [ ] Regenerate contract/client artifacts and update docs.

Exit gate:
- [ ] Crypto planning snapshots into after-loss mode without storing secrets.

### Phase E - B2B / Scale Foundations

Target commits:
- `feat(api): add multi-tenant partner foundations`
- `chore(contract): sync b2b artifacts and docs`
- `feat(web): add partner admin surfaces`

Checklist:
- [ ] Add org/tenant models, partner webhooks, usage reporting, and tenant-safe auth boundaries.
- [ ] Sync webhook and B2B contract artifacts plus launch docs.
- [ ] Add tenant admin surfaces, branding controls, and usage dashboards.

Exit gate:
- [ ] One pilot tenant operates on isolated data with signed webhook integration.

## Immediate Next Steps

1. Switch to `codex/phase-a-sync` and update `packages/shared/openapi/openapi.yaml` for the new public case-summary review fields only.
2. Regenerate `packages/shared/openapi/openapi.generated.json`, `frontend/src/lib/generated/api-client.ts`, and `frontend/src/api/openapi-types.ts`, then rerun `npm run verify:sync -- backend/tests/test_api_integration_flows.py backend/tests/test_case_flows.py`.
3. Update the four sync-owned docs to mark the public contract synced while keeping `/api/v1/internal/case-reviews/*` out of OpenAPI.
4. Switch to `codex/phase-a-frontend` and ship executor `pending review` / `rejected review` states, review reason/note display, and replacement upload UX, then move to Phase B checkout completion.
