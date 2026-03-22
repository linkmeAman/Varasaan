# Synchronized Multi-Phase Delivery Plan

## Standing Streams

Every remaining phase is executed in three standing streams:

- `Backend`: schema, models, services, routes, backend tests.
- `Frontend`: hooks, screens, UX states, and e2e/spec updates.
- `Sync / QA / Docs`: `openapi.yaml`, generated client/types, cross-stack verification, and roadmap/changelog/checklist updates.

## Default Commit Order

1. Backend commit lands first.
2. Sync / QA / Docs commit lands second.
3. Frontend commit lands third.
4. An optional final integration commit lands only if a cross-stream fix is required.

## Default Branch Pattern

- `codex/<phase>-backend`
- `codex/<phase>-sync`
- `codex/<phase>-frontend`

## Ownership Rules

- Backend owns public interface changes.
- Frontend never handwrites request/response shapes. It consumes generated client/types only.
- Sync stream owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- A phase is not complete until implementation, generated artifacts, verification, and docs land together.

## Execution Controls (2026)

- Completion gates are nested:
  - `Current release complete`: Phase A sync, Phase A frontend, Phase B, and current-release staging validation are closed.
  - `MVP complete`: current release plus `Quick wins`, Phase C, Phase D, and the first-paying-user launch checklist are closed.
  - `Roadmap complete`: MVP plus Phase E and the post-Phase-E roadmap sequence are closed.
  - `Project complete`: roadmap plus legal, compliance, business, and ongoing ops sign-offs are closed with evidence.
- Merge policy is strict:
  - every completed stream lands on `main`
  - every successor stream branch is created or reset from the new `main` tip
  - stale successor branches are not continued
- Precondition before a stream starts:
  - reconcile dirty planning docs on `main`
  - confirm `main` already contains the predecessor stream result
  - confirm the stream scope matches the documented phase scope
- Stop conditions are explicit:
  - do not start the next stream if contract changes are unmerged
  - do not start the next stream if generated artifacts are stale
  - do not start the next stream if required tests are failing
  - do not start the next stream if the four root status docs contradict implementation
- Evidence policy is explicit:
  - high-level done/not-done state stays in `PROGRESS_CHECKLIST.md`
  - contract state lives in `INTEGRATION_CHECKLIST.md`
  - release-facing notes live in `CHANGELOG.md`
  - non-code launch, legal, compliance, and ops items must carry owner, due date, and evidence/sign-off location in `PRODUCT_DEVELOPMENT.md`

## Phase Sequence

### Phase A - After-Loss Hardening Finish

Backend:
- Add death-certificate metadata stripping.
- Add risk-based manual review state and internal review endpoints.
- Keep the public case lifecycle stable by extending case summary payloads with review metadata instead of creating a second public lifecycle.
- Add integration coverage for clean activation, queued review, approval, rejection, and replacement upload.
- Status (2026-03-22): implemented and verified on `codex/phase-a-backend`.
- Commit: `feat(api): add activation sanitization and review flow`

Sync / QA / Docs:
- Update public OpenAPI only for the new public case summary fields.
- Keep internal review endpoints out of the public contract.
- Regenerate `packages/shared/openapi/openapi.generated.json`, `frontend/src/lib/generated/api-client.ts`, and `frontend/src/api/openapi-types.ts`.
- Update status docs to mark hardening complete.
- Run contract sync plus backend regression coverage.
- Status (2026-03-22): implemented locally on `main`; backend regression coverage passed and public contract artifacts are regenerated.
- Commit: `chore(contract): sync activation review schema and docs`

Frontend:
- Add executor states for `pending review` and `rejected review`.
- Show the review reason/note and the replacement-upload path.
- Keep active and closed flows unchanged.
- Status (2026-03-22): implemented locally on `main`; updated executor Playwright coverage is written, but a real runner/staging execution is still pending.
- Commit: `feat(web): surface activation review states`

Exit gate:
- Every activation ends in exactly one of `active`, `pending review`, or `rejected review`.
- No manual database intervention is required.

### Phase B - Payment & Checkout Finish

Backend:
- Change payment APIs only if a real frontend blocker appears.
- If needed, add invoice/download endpoints in the same slice.
- Commit only if backend changes are required: `feat(api): complete payment support surface`

Sync / QA / Docs:
- Sync contract/client artifacts if payment payloads change.
- Update docs to mark payment UI complete.
- Run payment integration and contract verification.
- Commit: `chore(contract): sync payment artifacts and docs`

Frontend:
- Build the real checkout flow for plan tiers.
- Add Razorpay status polling, success/failure/retry states, and entitlement refresh.
- Validate a real staging payment before completion.
- Commit: `feat(web): ship checkout and payment verification flow`

Exit gate:
- A real paid order can be completed in staging and unlock the intended UI.

### Phase C - Family Workspace

Backend:
- Expand case participants beyond a single executor.
- Add task assignment, comment threads, and participant-aware activity logging.
- Add task-status email notifications.
- Commit: `feat(api): add case collaboration and assignment`

Sync / QA / Docs:
- Update OpenAPI with participant, assignment, and comment payloads.
- Regenerate frontend client/types and update docs to mark collaboration complete.
- Run case-flow, contract, and notification regression tests.
- Commit: `chore(contract): sync collaboration artifacts and docs`

Frontend:
- Add the participant panel, task assignment UI, comment threads, and richer activity feed.
- Extend the existing task dialog instead of creating a parallel task editor.
- Commit: `feat(web): add family workspace collaboration`

Exit gate:
- Multiple participants can collaborate on one active case with assignment, comments, notifications, and audit visibility.

### Phase D - Crypto Inheritance Kit

Backend:
- Add separate planning-mode crypto asset models.
- Snapshot crypto data into case-time records at activation.
- Expose an executor crypto guidance endpoint.
- Commit: `feat(api): add crypto inheritance kit`

Sync / QA / Docs:
- Add public crypto planning/case schemas to OpenAPI.
- Regenerate client/types and update roadmap/docs.
- Run snapshot and regression coverage.
- Commit: `chore(contract): sync crypto artifacts and docs`

Frontend:
- Build the crypto planning wizard and executor crypto guidance pages.
- Reuse the existing case workspace/task model for execution.
- Commit: `feat(web): add crypto planning and executor guidance`

Exit gate:
- Crypto planning data snapshots cleanly into after-loss mode without storing secrets.

### Phase E - B2B / Scale Foundations

Backend:
- Add org/tenant models, partner webhooks, usage reporting, and tenant-safe auth boundaries.
- Commit: `feat(api): add multi-tenant partner foundations`

Sync / QA / Docs:
- Sync B2B contracts, webhook payloads, docs, and launch checklists.
- Add staging operational validation guidance.
- Commit: `chore(contract): sync b2b artifacts and docs`

Frontend:
- Add tenant admin surfaces, branding controls, and usage dashboards.
- Mobile work does not start until this phase stabilizes.
- Commit: `feat(web): add partner admin surfaces`

Exit gate:
- One pilot tenant can operate on isolated data with signed webhook integration.

## Completion Buckets (2026)

Required for current release:
- Execute the updated Phase A executor Playwright coverage in a real runner/staging environment and resolve any review-state regressions.
- Finish Phase B checkout so a real staged payment can unlock the intended UI.

Required for MVP completion:
- Finish the remaining open task-workspace item (`Quick wins`) if it remains in MVP scope.
- Finish Phase C collaboration.
- Finish Phase D crypto guidance and planning.
- Finish the first-paying-user launch checklist from `PRODUCT_DEVELOPMENT.md`.

Later roadmap only:
- Phase E multi-tenant partner foundations and everything after it in the broader product roadmap.

## Sync / QA / Docs Responsibilities In Every Phase

- Pull the backend branch after API/schema changes.
- Update `packages/shared/openapi/openapi.yaml` first, then regenerate artifacts.
- Run `python -m pytest backend/tests/test_contract_sync.py`.
- Run the relevant backend integration tests for the phase.
- Run `npm run typecheck`.
- Run `npm run lint`.
- If frontend work changes user-visible behavior, confirm the relevant Playwright spec is updated.
- Update `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- Block phase completion if contract, generated client, docs, and implementation are not aligned.

## Current Gaps

- The repo previously had no explicit sync-owner process; this plan formalizes that stream.
- The repo previously had no root-level local sync verification entrypoint; `npm run verify:sync` now covers the shared contract/type/lint/typecheck path and accepts phase-specific backend test targets.
- The PR checklist previously did not require the four phase docs to be updated alongside implementation.
- Phase A public contract artifacts and executor review-state UX are now implemented locally on `main`, but the updated Playwright review-state coverage still needs a real runner/staging execution for sign-off.
- Payment frontend is still unfinished even though the backend surface exists.
- Playwright and Vitest results from this sandbox are not a substitute for a real runner or staging pass.
- The pre-Phase-A mixed tree has been consolidated into `codex/pre-phase-a-baseline`; any remaining successor work must branch from current `main`, not the stale pre-sync Phase A heads.

## Assumptions

- One engineer can execute the standing streams sequentially.
- Backend is the source of truth for contract shape.
- Sync stream owns generated artifacts and docs, not backend or frontend.
- No phase is marked complete until implementation, generated artifacts, verification, and docs all land together.
