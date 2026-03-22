# Digital Legacy Manager - Progress Checklist

This checklist tracks verified repo state plus the standing three-stream delivery model defined in `EXECUTION_PLAN.md`. A phase is complete only when implementation, generated artifacts, verification, and docs land together with evidence.

## Shipped Baseline

- [x] Foundation: monorepo structure, CI/CD, async backend, cookie-auth baseline, and OpenAPI contract sync are in place.
- [x] Planning-mode baseline: auth, inventory, trusted contacts, document uploads, evidence packet and export jobs, heartbeat flows, and the backend Razorpay surface are implemented.
- [x] After-loss baseline: executor designation, pending and active cases, activation upload flow, task workspace, evidence capture, case-open notifications, closure reporting, case closure, retention cleanup, and bleed-stopper guidance are implemented.
- [ ] Planning-mode finish: tiered billing, entitlement-aware checkout, and live staging payment validation are still open.

## Standing Delivery Rules

- [x] Streams remain `Backend`, `Frontend`, and `Sync / QA / Docs`.
- [x] Commit order remains backend -> sync / QA / docs -> frontend -> optional integration fix.
- [x] Branch pattern remains `codex/<phase>-backend`, `codex/<phase>-sync`, `codex/<phase>-frontend`.
- [x] Every completed stream lands on `main`, and every successor stream starts from refreshed `main`.
- [x] Backend owns public interface changes.
- [x] Frontend consumes generated client/types only.
- [x] Sync owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- [x] Historical checklist reconciliation is required; unsupported or out-of-scope items must not stay mixed into active MVP work.

## Pre-Phase Baseline (complete)

Audit snapshot (2026-03-22):
- Frontend `lint`, `typecheck`, `build`, and `test:smoke` pass on `main`.
- Backend `ruff` passes on `main`.
- Backend `pytest` passes when invoked with `uv run --project backend pytest -c backend/pyproject.toml`.
- The repo previously used a backend pytest command path that did not load the backend pytest config from the repo root; the local sync script and CI workflow now need to use the explicit backend config path.
- Backend `mypy` now passes on `main`.
- `backend/src/app/main.py` now uses a FastAPI lifespan handler instead of the deprecated startup hook.
- Live sign-off evidence is still missing for Phase A, billing providers, email providers, alerts, and launch operations.

Checklist:
- [x] Verify frontend `lint`, `typecheck`, `build`, and `test:smoke` on 2026-03-22.
- [x] Verify backend `ruff` on 2026-03-22.
- [x] Verify backend `pytest` on 2026-03-22 with the backend pytest config explicitly loaded.
- [x] Keep repo-native local and CI verification green from the documented command paths after the pytest invocation fix lands on `main`.
- [x] Clear backend `mypy` failures: typed import and stub handling, nullable datetime comparisons, optional auth value narrowing, and `app.main` typing.
- [x] Replace the deprecated FastAPI startup hook with a lifespan handler.

Exit gate:
- [x] Baseline verification is green from the documented local and CI command paths.

## Active Phase Queue

### Phase A - After-Loss Hardening Sign-Off

Audit snapshot (2026-03-22):
- Backend hardening is implemented and verified.
- Public Phase A contract artifacts are regenerated.
- Executor review-state UX is implemented locally.
- The remaining sign-off item is a real-runner or staging execution of `frontend/tests/e2e/executor-flow.spec.ts`.

Checklist:
- [x] Strip death-certificate metadata before activation.
- [x] Add risk-based manual review state and internal review endpoints.
- [x] Keep the public case lifecycle stable by extending case summary payloads with review metadata.
- [x] Add integration coverage for clean activation, queued review, approval, rejection, and replacement upload.
- [x] Regenerate public contract and generated client artifacts without exposing internal review routes.
- [x] Add executor UX states for `pending review` and `rejected review`.
- [x] Add review reason or note display and the replacement-upload path.
- [x] Update the executor Playwright spec for queued review, rejection, and replacement upload.
- [ ] Execute the updated executor Playwright spec in a real runner or staging environment.
- [ ] Record the validation date and evidence location in the phase docs.

Exit gate:
- [ ] Real-runner or staging evidence exists for the updated executor review-state flow.

### Phase B - Tiered Billing And Entitlements

Checklist:
- [ ] Persist `free`, `essential`, and `executor` entitlements in the backend.
- [ ] Extend `/api/v1/auth/me` with entitlement state.
- [ ] Replace amount-based checkout input with tier-based checkout payloads.
- [ ] Add billing history and invoice download endpoints.
- [ ] Keep webhook and refund handling idempotent and entitlement-aware.
- [ ] Sync OpenAPI and generated client artifacts for entitlements, tier checkout, billing history, and invoice download.
- [ ] Replace the current billing page with pricing, upgrade, checkout, success, failure, and retry flows.
- [ ] Add entitlement-aware navigation and gating.
- [ ] Add billing history and invoice UX.
- [ ] Validate a real staging payment and refund end to end.

Exit gate:
- [ ] A real staging payment and refund update entitlement state in the UI without manual intervention.

### `Quick wins`

Checklist:
- [ ] Add the simple-account `Quick wins` task section to the workspace before Phase C starts.

Exit gate:
- [ ] The remaining `Quick wins` task-workspace gap is shipped, documented, and verified.

### Phase C - Family Workspace

Checklist:
- [ ] Add participant membership beyond a single executor.
- [ ] Add task assignment, comment threads, participant-aware activity visibility, and task-status notifications.
- [ ] Sync participant, assignment, comment, activity, and notification payloads through the public contract.
- [ ] Add the participant panel, assignment flows, comments, and participant-aware activity UI.

Exit gate:
- [ ] Multiple participants can collaborate on one active case with assignment, comments, notifications, and audit visibility.

### Phase D - Crypto Inheritance Kit

Checklist:
- [ ] Add planning-mode crypto asset inputs.
- [ ] Snapshot crypto planning data into case-time records at activation.
- [ ] Add executor crypto guidance payloads and UI.
- [ ] Keep the workflow explicitly non-custodial with no secret or seed storage.
- [ ] Sync crypto planning, snapshot, and guidance payloads through the public contract.

Exit gate:
- [ ] Crypto planning snapshots into after-loss mode without storing secrets.

## Launchable MVP Closure

- [ ] Complete the first-paying-user launch checklist in `PRODUCT_DEVELOPMENT.md` with owner, due date, validation date, and evidence location for each item.
- [ ] Execute the operational, UAT, go or no-go, and post-deploy verification flow in `LAUNCH_RUNBOOK.md`.
- [ ] Mark MVP complete in the status docs once baseline, phase, and launch evidence are all present.
- [ ] Relabel Phase E / B2B and later roadmap work as `deferred-after-MVP`.

## Deferred After MVP

- [ ] Phase E: multi-tenant partner foundations, signed webhooks, tenant admin surfaces, branding, and usage dashboards.
- [ ] Post-Phase-E expansion in `PRODUCT_DEVELOPMENT.md`: mobile, observability expansion, partnerships, moat features, language expansion, and international expansion.

## Immediate Next Steps

1. Run `frontend/tests/e2e/executor-flow.spec.ts` in a real runner or staging stack and record evidence for Phase A sign-off.
2. Start Phase B from refreshed `main` with the mandatory backend entitlement slice before any frontend billing rewrite.
3. Keep launch evidence current in `PRODUCT_DEVELOPMENT.md` and `LAUNCH_RUNBOOK.md` while the remaining MVP streams land.
