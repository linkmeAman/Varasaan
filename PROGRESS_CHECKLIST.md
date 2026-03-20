# Digital Legacy Manager - Progress Checklist

This checklist tracks repository reality against the current product roadmap and execution documents.

Sync sources: status below is derived from the current frontend routes, backend API surface, generated client artifacts, Playwright coverage, and CI workflows.

---

## Phase 0 - Foundation

Infrastructure, release governance, contract generation, and the base backend stack are in place.

- [x] Project setup: monorepo structure, root/frontend package manifests, backend Python project, and shared OpenAPI artifacts exist.
- [x] CI/CD pipeline: GitHub workflows enforce `pr-title-lint`, `contract-sync`, `backend-quality`, `frontend-quality`, `infra-validate`, and `critical-path-e2e`.
- [x] Database schema baseline: core entities, Alembic, and async SQLAlchemy wiring exist.
- [x] Security baseline: cookie auth, CSRF enforcement, OpenAPI sync, and protected API dependencies exist.

---

## Phase 1 - MVP Planning Mode

The MVP is partially shipped. The remaining work is now architecture hardening plus the missing heartbeat feature.

### Backend / API

- [x] Auth and onboarding API: signup, login, email verification, password reset, logout, session refresh, and recovery flows are implemented.
- [x] Inventory API: create, list, update, and delete account inventory endpoints are implemented.
- [x] Trusted contacts API: create, invite, accept, list, and revoke endpoints are implemented.
- [x] Documents API: upload init, scan dispatch, listing, grants, download, and soft delete are implemented.
- [x] Evidence packet and export API: packet/export job creation and retrieval flows are implemented.
- [x] Payments API: checkout, webhook processing, and payment status retrieval are implemented.
- [ ] Heartbeat / dead-man switch: dedicated model, routes, generated contract surface, and worker flow are still missing.

### Frontend / UI

- [x] Auth screens: `/login`, `/register`, and `/recovery` are implemented as MVP flows.
- [x] Dashboard and inventory UI: `/dashboard` and `/dashboard/inventory` are implemented as MVP routes.
- [x] Trusted contacts UI: `/dashboard/trusted-contacts` is implemented as an MVP route.
- [x] Document uploads UI: `/dashboard/documents` is implemented as an MVP route.
- [x] Payment and checkout UI: `/dashboard/billing` is implemented as an MVP route.
- [x] Evidence packet and export UI: `/dashboard/packets` and `/dashboard/exports` are implemented as MVP routes.

### E2E / integration status

- [x] Playwright auth flow coverage exists.
- [x] Playwright recovery flow coverage exists.
- [x] Playwright workspace coverage exists for inventory, trusted contacts, documents, packets, exports, and billing.

### Current technical debt / hardening focus

- [ ] Replace thin App Router page wrappers that only mount `frontend/src/views/*` with route-owned modules.
- [ ] Add `frontend/src/app/dashboard/layout.tsx` and dashboard-level loading/error boundaries.
- [ ] Add `frontend/src/middleware.ts` for protected-route cookie checks.
- [ ] Replace the standalone auth guard pattern with a shared auth provider and hook.
- [ ] Upgrade inventory, document upload, and billing flows from MVP behavior to hardened UX patterns.
- [ ] Re-run local frontend/backend verification after dependency bootstrap so current status is backed by fresh execution, not only checked-in code.

---

## Phase 2 - After-Loss Mode

This phase remains pending and should not be started until Phase 1 architecture hardening and heartbeat are complete.

- [ ] Case activation flow
- [ ] Task management / Kanban
- [ ] Evidence and proof capture
- [ ] Subscription bleeding stopper
- [ ] Family workspace
- [ ] Crypto inheritance kit

---

## Phase 3 and 4 - Future Roadmap

- [ ] B2B APIs and white-labeling
- [ ] React Native mobile app
- [ ] Analytics and observability expansion
- [ ] AI-assisted letter drafting and regional language support

---

## Immediate Next Steps

1. Frontend architecture hardening: add dashboard layout/middleware/auth-provider structure and migrate route ownership away from the legacy `src/views` pattern.
2. Heartbeat implementation: add the missing backend model, route surface, worker flow, generated types, and a basic dashboard UI.
3. Verification parity: complete dependency bootstrap locally and rerun lint, typecheck, pytest, and Playwright so repository status is confirmed by fresh execution.
