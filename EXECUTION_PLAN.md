# MVP Closure Execution Plan

This file is the canonical execution source for the remaining MVP closure work. It keeps the repo-native three-stream model, fixes the verified baseline gaps on `main`, and freezes scope after a launchable MVP is proven.

## Standing Streams

- `Backend`: schema, models, services, routes, migrations, backend tests.
- `Frontend`: hooks, screens, UX states, navigation/gating, and Playwright/spec updates.
- `Sync / QA / Docs`: `packages/shared/openapi/openapi.yaml`, generated client/types, verification entrypoints, and the root status docs.

## Default Commit Order

1. Backend commit lands first.
2. Sync / QA / Docs commit lands second.
3. Frontend commit lands third.
4. An optional integration commit lands only if a cross-stream fix is required.

## Default Branch Pattern

- `codex/<phase>-backend`
- `codex/<phase>-sync`
- `codex/<phase>-frontend`

## Ownership Rules

- Backend owns public interface changes.
- Frontend consumes generated request/response types only.
- Sync / QA / Docs owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md` on every sync slice.
- `LAUNCH_RUNBOOK.md`, `IMPLEMENTATION_CHECKLIST.md`, and `PR_DESCRIPTION.md` update only when process, verification, or launch evidence rules change.
- No checklist item is marked complete from assumption.

## Verified Baseline (2026-03-22)

- Frontend `lint`, `typecheck`, `build`, and `test:smoke` pass on `main`.
- Backend `ruff` passes on `main`.
- Backend `pytest` passes when the backend pytest config is explicitly loaded with `uv run --project backend pytest -c backend/pyproject.toml`.
- Backend `mypy` passes on `main`.
- Repo-native verification now loads the backend pytest config correctly in local sync verification and CI.
- `backend/src/app/main.py` now uses a FastAPI lifespan handler instead of the deprecated `@app.on_event("startup")` hook.
- Phase A implementation is present locally, but real-runner or staging execution of `frontend/tests/e2e/executor-flow.spec.ts` remains open.
- Live provider validation for billing, email, alerts, and launch operations remains open.

## Completion Gates

- `Baseline green`: backend `ruff`, `mypy`, and full `pytest`; frontend `lint`, `typecheck`, `smoke`, and `build`; repo-native `contract-sync`, `backend-quality`, `frontend-quality`, `infra-validate`, and `critical-path-e2e` all pass from documented commands.
- `Launchable MVP`: baseline green plus Phase A sign-off, Phase B, `Quick wins`, Phase C, Phase D, launch checklist closure, and post-deploy verification.
- `Deferred after MVP`: Phase E / B2B foundations and all later roadmap work.

## Execution Controls

- Merge policy is strict:
  - every completed stream lands on `main`
  - every successor stream branch is recreated from the new `main` tip
  - stale successor branches are not continued
- Precondition before a stream starts:
  - predecessor stream result is already on `main`
  - generated artifacts are current
  - required verification is green for the baseline that the stream depends on
  - the four root status docs do not contradict implementation
- Checklist reconciliation policy is strict:
  - if evidence exists, close the item
  - if work exists but proof is missing, leave it open and add owner, due date, and evidence location
  - if it is outside frozen MVP scope, relabel it as `deferred-after-MVP`
- Evidence policy is strict:
  - high-level done or blocked state lives in `PROGRESS_CHECKLIST.md`
  - public contract state lives in `INTEGRATION_CHECKLIST.md`
  - release-facing notes live in `CHANGELOG.md`
  - launch, legal, compliance, and ops evidence lives in `PRODUCT_DEVELOPMENT.md` and `LAUNCH_RUNBOOK.md`

## Ordered Execution

### 0. Pre-Phase Baseline

Backend:
- Cut `codex/mvp-baseline-backend` from refreshed `main`.
- Clear current `backend-quality` debt before remaining phase work:
  - fix backend `mypy`
  - keep typed import or stub handling explicit
  - resolve nullable datetime comparisons and optional token narrowing
  - replace the deprecated FastAPI startup hook with a lifespan handler
- Keep backend `pytest` green from the repo-native command path used by CI.

Sync / QA / Docs:
- Cut `codex/mvp-baseline-sync` from refreshed `main`.
- Lock the remaining order in this file as:
  - Phase A sign-off
  - Phase B
  - `Quick wins`
  - Phase C
  - Phase D
  - launch closure
  - freeze
- Reconcile checklist truth across:
  - `PROGRESS_CHECKLIST.md`
  - `PRODUCT_DEVELOPMENT.md`
  - `CHANGELOG.md`
  - `INTEGRATION_CHECKLIST.md`
- Do not close historical items without repo, CI, runbook, or staging evidence.

Exit gate:
- Baseline verification is green from the documented command paths.

### 1. Phase A - After-Loss Hardening Sign-Off

Rule:
- Treat Phase A as validation-first. The implementation is already present; only sign-off work and regression fixes remain.

Validation:
- Execute `frontend/tests/e2e/executor-flow.spec.ts` in a real runner or staging stack.

If the run fails:
- recreate only the affected `codex/phase-a-backend`, `codex/phase-a-sync`, or `codex/phase-a-frontend` branch from refreshed `main`
- fix in normal stream order

If the run passes:
- use the sync slice to close the remaining Phase A checklist items
- record execution date and evidence location in the docs

Exit gate:
- Real-runner or staging evidence exists for the updated executor review-state flow.

### 2. Phase B - Tiered Billing And Entitlements

Rule:
- Phase B requires backend, sync, and frontend work. It cannot be treated as frontend-only because the current payment surface is amount-based and does not model product entitlements.

Backend:
- Persist entitlements for `free`, `essential`, and `executor`.
- Extend `/api/v1/auth/me` with entitlement state.
- Change checkout from arbitrary amount input to tier-based purchase input.
- Add billing history and invoice download endpoints.
- Keep webhook and refund handling idempotent and entitlement-aware.

Sync / QA / Docs:
- Update public OpenAPI and regenerated clients/types for:
  - entitlement fields on `/api/v1/auth/me`
  - tier-based checkout request and response payloads
  - billing history payloads
  - invoice download payloads
- Update the phase docs to reflect tiered billing instead of the current operator-style payment surface.

Frontend:
- Replace the current billing screen with pricing, upgrade, checkout, success, failure, and retry flows.
- Add entitlement-aware navigation and gating.
- Add billing history and invoice UX.

Exit gate:
- A real staging payment and refund update entitlement state in the UI without manual intervention.

### 3. `Quick wins`

Rule:
- Land the `Quick wins` task section before collaboration so the MVP checklist order stays aligned with the repo docs.

Scope:
- Add the simple-account closure section to the task workspace without creating a parallel task model.

Exit gate:
- The open `Quick wins` roadmap item is shipped, documented, and verified.

### 4. Phase C - Family Workspace

Backend:
- Add participant membership beyond a single executor.
- Add task assignment, comment threads, participant-aware activity visibility, and task-status email notifications.

Sync / QA / Docs:
- Sync participant, assignment, comment, activity, and notification-facing payloads through the public contract and generated artifacts.

Frontend:
- Add participant membership UI, assignment flows, comment threads, participant-aware activity, and task-status notification surfaces.

Exit gate:
- Multiple participants can collaborate on one active case with assignment, comments, notifications, and audit visibility.

### 5. Phase D - Crypto Inheritance Kit

Backend:
- Add planning-mode crypto asset inputs.
- Snapshot crypto data into case-time records at activation.
- Expose executor crypto guidance payloads.

Sync / QA / Docs:
- Sync crypto planning, snapshot, and guidance payloads through the public contract and generated artifacts.

Frontend:
- Add the planning workflow, activation snapshot visibility, and executor guidance experience.

Guardrails:
- non-custodial only
- no secret or seed storage
- no UI copy that implies custody

Exit gate:
- Crypto planning snapshots into after-loss mode without storing secrets.

### 6. Launch Closure And Freeze

- Execute the first-paying-user launch checklist in `PRODUCT_DEVELOPMENT.md`.
- Execute the UAT, operational checks, go or no-go review, and post-deploy verification flow in `LAUNCH_RUNBOOK.md`.
- Record owner, due date, validation date, and evidence location for every legal, compliance, and operational item before marking it complete.
- After launch readiness is proven, update the status docs to mark MVP complete.
- Relabel Phase E / B2B and later roadmap items as `deferred-after-MVP`.

## Required Verification Before Any Checklist Closure

- Backend:
  - `uv run --project backend ruff check backend/src backend/tests`
  - `uv run --project backend mypy backend/src`
  - `uv run --project backend pytest -c backend/pyproject.toml`
- Frontend:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test:smoke`
  - `npm --prefix frontend run build`
- Cross-stack and release:
  - `npm run verify:sync`
  - `contract-sync`
  - `infra-validate`
  - `critical-path-e2e`
  - real-runner or staging execution for Phase A
  - live provider validation for billing, email, and alerts
  - `python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>` against the target environment

## Deferred After MVP

- Phase E / B2B / scale foundations.
- Mobile, broader analytics expansion, partner rollout, moat features, language expansion, and international expansion.

## Assumptions

- The repo-native three-stream split remains the delivery model for the remaining MVP work.
- Full historical checklist reconciliation is required; this is not an active-items-only pass.
- `PRODUCT_VISION.md` stays unchanged unless pricing or positioning changes materially.
- The existing tier model in `PRODUCT_VISION.md` is the billing target for Phase B.
