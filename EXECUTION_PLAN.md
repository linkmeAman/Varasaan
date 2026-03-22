# Phase 1 Execution Plan Sync

This document is the reality-based execution view for the remaining Phase 1 work. It is aligned to the current repository state rather than the earlier greenfield assumptions.

Sync sources: status below is derived from the current frontend routes, legacy view layer, backend API surface, generated client artifacts, Playwright coverage, and CI workflows.

Every remaining phase is executed in three standing streams:

## 1. Current Shipped State

### Done: Backend and contract surface

- Auth, onboarding, password reset, assisted recovery, inventory, trusted contacts, documents, packets, exports, and payments are implemented in `backend/src/app/api`.
- Generated client artifacts already exist in `frontend/src/api/openapi-types.ts` and `frontend/src/lib/generated/api-client.ts`.
- CI already enforces `contract-sync`, `backend-quality`, `frontend-quality`, `infra-validate`, and `critical-path-e2e`.

### Done: Frontend MVP routes and screens

- App Router routes already exist for `/login`, `/register`, `/recovery`, `/dashboard`, `/dashboard/inventory`, `/dashboard/trusted-contacts`, `/dashboard/documents`, `/dashboard/packets`, `/dashboard/exports`, and `/dashboard/billing`.
- Those routes currently mount client-heavy screen implementations from `frontend/src/views`.
- Auth/session behavior already has a working MVP layer in `frontend/src/lib/api.ts` and `frontend/src/lib/use-auth-guard.ts`.

### Done: End-to-end MVP coverage

- Existing Playwright coverage already exercises auth, recovery, inventory, trusted contacts, documents, packets, exports, and billing flows under `frontend/tests/e2e`.
- The current Phase 1 gap is not "no UI"; it is "UI shipped in MVP form and needs architectural hardening."

### Not done: Heartbeat

- There is no dedicated heartbeat model, route surface, OpenAPI contract, worker orchestration, or frontend heartbeat UI.
- Existing `last_heartbeat` usage in packet jobs is unrelated to the Phase 1 dead-man switch feature.

## Phase Sequence

## 2. Remaining Architecture Refactor Work

### Refactor/Harden: Route and layout ownership

- Add `frontend/src/app/dashboard/layout.tsx` to own the dashboard shell instead of spreading workspace concerns across individual pages and the global navbar.
- Add `frontend/src/middleware.ts` for pre-render cookie checks on protected dashboard routes.
- Replace the current thin page wrappers that only import `frontend/src/views/*` with route-owned App Router modules and smaller client leaves.

### Refactor/Harden: Auth and session layer

- Replace the standalone `useAuthGuard` pattern with a shared auth provider and `useAuth` hook that owns `GET /api/v1/auth/me`, login, logout, and session refresh behavior.
- Keep session credentials in HTTP-only cookies only; client state should hold the non-sensitive current user object.
- Keep the existing Axios/generated-client integration, but treat it as the transport layer under the new auth provider rather than the final architecture.

### Refactor/Harden: Workspace behavior and UX

- Move inventory, trusted contacts, documents, billing, packets, and exports toward server-first route ownership with clearer loading and error boundaries.
- Upgrade inventory mutations to a more explicit optimistic-update flow and isolate list/card components from form state.
- Replace the current billing manual refresh pattern with a verification state that polls payment status after checkout success.
- Replace the current document upload flow with a reusable uploader that shows direct-upload progress before scan dispatch.
- Add proper dashboard-level loading and error handling instead of relying only on per-view client guards.

### Refactor/Harden: Verification baseline

- Re-run frontend lint, typecheck, backend pytest, and Playwright only after local dependencies are installed.
- Do not mark the refactor work complete until local and CI quality gates agree.

---

## 3. Heartbeat Implementation Scope

### Build New: Backend domain and API

- Add a dedicated heartbeat persistence model and migration for the user dead-man switch state.
- Add Phase 1 heartbeat endpoints for:
  - retrieving the current user's heartbeat configuration,
  - creating or updating cadence and enabled state,
  - performing an explicit user check-in.
- Regenerate OpenAPI and frontend client/types after the route surface is added.

### Build New: Scheduler and worker flow

- Add a heartbeat scheduler task that runs every 5 minutes and selects due heartbeat records for processing.
- Add an idempotent worker flow that locks candidate rows safely before sending reminders or escalating state.
- Log heartbeat state changes into `audit_logs`.
- Keep Phase 1 behavior limited to reminder and executor notification; do not trigger full After-Loss Mode automatically.

### Build New: Basic frontend slice

- Add a basic dashboard heartbeat surface where the user can:
  - choose cadence,
  - see next expected check-in,
  - see current reminder/escalation state,
  - perform a manual check-in.
- Keep this UI intentionally small for Phase 1; the target is usable configuration, not a full after-loss workflow.

---

## 4. Verification and Release Gates

### Repo truth checks for docs and implementation status

- `git diff -- EXECUTION_PLAN.md PROGRESS_CHECKLIST.md`
- `rg -n "dashboard/layout|middleware|heartbeat" frontend/src backend/src`
- `rg -n "critical-path-e2e|frontend-quality|backend-quality|contract-sync" .github/workflows`

### Quality gates that must stay authoritative

- Frontend: `npm run lint`, `npm run typecheck`, `npm run test:smoke`, `npm run build`
- Backend: Ruff, mypy, and `pytest`
- End to end: `critical-path-e2e`

### Current local verification constraint

- Local verification in this workspace is presently incomplete because dependency bootstrap has not been finished:
  - `frontend/node_modules` is absent, so frontend lint/typecheck cannot yet be treated as current truth.
  - backend pytest currently fails at setup in this environment because `aiosqlite` is missing.
- Until bootstrap is completed and checks are rerun, "done" applies only to observed repository state and existing checked-in coverage, not to fresh local execution.

### Release discipline

- Land Phase 1 docs sync and future implementation work through review branches and PRs.
- Keep PR titles and commit headers Conventional Commit compliant so they pass the existing CI policy.
- Do not broaden scope into Phase 2 work until the Phase 1 architecture hardening and heartbeat feature are both verified through the existing release gates.
