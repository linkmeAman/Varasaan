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
- [x] Merge policy: every completed stream lands on `main`, and every successor stream starts from the refreshed `main` tip.
- [x] Backend owns public interface changes.
- [x] Frontend consumes only generated client/types.
- [x] Sync stream owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- [x] Stop conditions: do not start the next stream if contract artifacts, generated types, required verification, or root status docs are out of sync.
- [x] Current tree hygiene: the mixed Phase 2.4 and closure-hardening tree was consolidated into `codex/pre-phase-a-baseline`, and the Phase A stream branches were cut from that baseline.

## Active Phase Queue

### Phase A - After-Loss Hardening Finish (in progress)

Target commits:
- `feat(api): add activation sanitization and review flow`
- `chore(contract): sync activation review schema and docs`
- `feat(web): surface activation review states`

Audit snapshot (2026-03-22):
- Backend stream is implemented and verified on `codex/phase-a-backend`.
- Sync / QA / Docs is implemented locally on `main`: the public case-review fields are present in OpenAPI and the generated frontend artifacts are refreshed.
- Frontend executor review-state UX is implemented locally on `main`: `pending review`, `rejected review`, review reason/note display, and replacement upload are wired to the activation surface.
- Real-runner execution of the updated Playwright review-state spec is still pending before Phase A can be signed off completely.

Checklist:
- [x] Strip death-certificate metadata before activation.
- [x] Add risk-based manual review state and internal review endpoints.
- [x] Keep the public case lifecycle stable by extending case summary payloads with review metadata.
- [x] Add integration coverage for clean activation, queued review, approval, rejection, and replacement upload.
- [x] Regenerate public contract/client artifacts without exposing internal review routes.
- [x] Add executor UX states for `pending review` and `rejected review`.
- [x] Show review reason/note and the replacement-upload path.
- [x] Update the executor Playwright spec for queued review, rejection, and replacement upload.
- [ ] Execute the updated executor Playwright spec in a real runner or staging environment.

Exit gate:
- [x] Backend enforces exactly one of `active`, `pending review`, or `rejected review`.
- [x] Backend review tooling avoids manual DB intervention for queue, approve, reject, and replacement-upload flows.
- [ ] Public contract sync, generated artifacts, docs, and executor UX are aligned locally; real-runner Playwright execution is still pending.

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

## Remaining Work To Completion

### Required for Current Release

- [ ] Execute the updated Phase A executor Playwright spec in a real runner/staging environment and resolve any review-state regressions.
- [ ] Finish Phase B checkout: ship the real paid-tier checkout flow, Razorpay polling plus success/failure/retry states, and entitlement refresh.
- [ ] Validate the current release in staging: complete a real paid order, confirm the relevant Playwright spec updates for user-visible changes, and keep contract/backend/frontend verification green.

### Required for MVP Completion

- [ ] Finish the remaining task-workspace gap that is still open in the roadmap: the `Quick wins` task section for simple account closures.
- [ ] Finish Phase C across all three streams: multi-participant case collaboration, task assignment, comment threads, participant-aware activity visibility, and task-status notifications.
- [ ] Finish Phase D across all three streams: crypto planning models, activation snapshots, executor guidance, and the matching frontend workflow.
- [ ] Close the first-paying-user launch checklist in `PRODUCT_DEVELOPMENT.md`: privacy policy, terms, payment/refund validation, heartbeat staging validation, data deletion validation, error monitoring, uptime monitoring, backup restore testing, manual fraud review documentation, and the support runbook.

### Later Roadmap Only

- [ ] Phase E: multi-tenant partner foundations, signed webhooks, tenant admin surfaces, branding, and usage dashboards.
- [ ] Post-Phase-E expansion in `PRODUCT_DEVELOPMENT.md`: mobile app work, analytics/observability expansion, platform partnerships, moat features, regional-language support, and international expansion.

## Immediate Next Steps

1. Run the updated `frontend/tests/e2e/executor-flow.spec.ts` against a running frontend/backend stack and close any review-state UX gaps it finds.
2. Start Phase B with an API sufficiency review against the required billing flow: tier selection, checkout launch, status polling, success/failure/retry, and entitlement refresh.
3. If the existing payment endpoints are sufficient, skip Phase B backend/sync work and move directly to the frontend checkout implementation from current `main`.
4. Keep the launch checklist evidence current in `PRODUCT_DEVELOPMENT.md` while current-release work continues.
