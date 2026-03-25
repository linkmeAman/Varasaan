# Codex Master Checklist — Varasaan Digital Legacy Manager

> **Purpose**: Single reusable checklist for Codex handoffs. Each phase is self-contained with streams, verification commands, and exit gates. Copy the relevant phase section when assigning work.

> **Completion rules**: An item is `[x]` only when repo evidence (passing CI, merged code, or documented sign-off) exists. Items with work-in-progress but no proof stay `[ ]`.

> **Last audited**: 2026-03-26

---

## Coding Principles (Apply To Every Phase)

- [ ] No raw `os.environ.get` — use Pydantic Settings class
- [ ] No sync SQLAlchemy — use `create_async_engine` + `AsyncSession`
- [ ] No handwritten frontend API types — consume generated client only
- [ ] All new endpoints covered by integration tests
- [ ] All user-visible changes covered by Playwright spec
- [ ] `ruff`, `mypy`, `pytest` green before any backend PR
- [ ] `lint`, `typecheck`, `build`, `test:smoke` green before any frontend PR
- [ ] Contract sync (`npm run verify:sync`) green before merge
- [ ] Branch from refreshed `main` — never continue stale branches
- [ ] Commit order: backend → sync/QA/docs → frontend → optional integration fix

---

## Verification Commands Reference

```powershell
# Backend
uv run --project backend ruff check backend/src backend/tests
uv run --project backend mypy backend/src
uv run --project backend pytest -c backend/pyproject.toml

# Frontend
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:smoke
npm --prefix frontend run build

# Contract sync
npm run verify:sync

# E2E (real runner)
npm --prefix frontend run test:e2e

# Post-deploy
python scripts/ops/post_deploy_verify.py --api-base-url <api> --web-base-url <web>
```

---

## Pre-Phase Baseline ✅ COMPLETE

> Audit: 2026-03-22 — all checks green on `main`.

### Backend Stream
- [x] Fix backend `mypy` (62 files, 0 issues)
- [x] Typed import and stub handling explicit
- [x] Nullable datetime comparisons resolved
- [x] Optional auth value narrowing fixed
- [x] Replace deprecated `@app.on_event("startup")` with lifespan handler
- [x] Backend `pytest` green from repo-native command path (30/30 tests)
- [x] Backend `ruff` passing

### Sync / QA / Docs Stream
- [x] Lock execution order: Phase A → B → Quick Wins → C → D → Launch → Freeze
- [x] Reconcile checklists across `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, `INTEGRATION_CHECKLIST.md`
- [x] Historical items not closed without evidence

### Exit Gate
- [x] Baseline verification green from documented local and CI command paths

---

## Phase A — After-Loss Hardening Sign-Off 🔶 IN PROGRESS

> Rule: Validation-first. Implementation is already present; only sign-off and regression fixes remain.

### Backend Stream
- [x] Strip death-certificate PDF metadata before activation
- [x] Risk-based manual review state and internal review endpoints
- [x] Review metadata on public case summary payloads
- [x] Integration coverage: clean activation, queued review, approval, rejection, replacement upload

### Sync / QA / Docs Stream
- [x] Regenerate OpenAPI + generated client with public Phase A review fields
- [x] Internal review routes excluded from public OpenAPI
- [x] `PROGRESS_CHECKLIST.md` updated with Phase A status
- [x] `INTEGRATION_CHECKLIST.md` updated with endpoint status table
- [x] `CHANGELOG.md` updated with Phase A entries

### Frontend Stream
- [x] Executor `pending review` and `rejected review` UX states
- [x] Review reason/note display
- [x] Replacement certificate upload path
- [x] Playwright spec covers queued review, rejection, replacement upload

### Remaining Sign-Off
- [ ] Execute `frontend/tests/e2e/executor-flow.spec.ts` in a real runner or staging
- [ ] Record validation date and evidence location in phase docs

### Exit Gate
- [ ] Real-runner or staging evidence exists for the updated executor review-state flow

---

## Phase B — Tiered Billing & Entitlements ❌ NOT STARTED

> Rule: Backend → Sync → Frontend. Cannot be frontend-only because current payment surface is amount-based without product entitlements.

### Backend Stream (branch: `codex/phase-b-backend`)
- [ ] Create entitlement model: `free`, `essential`, `executor` tiers
- [ ] Persist entitlement state in user/payment models
- [ ] Extend `/api/v1/auth/me` response with entitlement fields
- [ ] Replace amount-based checkout with tier-based checkout input
- [ ] Map tier → amount in payment handler (`essential` → ₹999, `executor` → ₹2,499)
- [ ] Add billing history endpoint
- [ ] Add invoice download endpoint
- [ ] Keep webhook handling idempotent and entitlement-aware
- [ ] Keep refund handling entitlement-aware
- [ ] Integration tests for tier checkout, entitlement update, billing history, invoice download
- [ ] `ruff` + `mypy` + `pytest` green

### Sync / QA / Docs Stream (branch: `codex/phase-b-sync`)
- [ ] Update `packages/shared/openapi/openapi.yaml` with:
  - [ ] Entitlement fields on `/api/v1/auth/me`
  - [ ] Tier-based checkout request/response payloads
  - [ ] Billing history payloads
  - [ ] Invoice download payloads
- [ ] Regenerate `openapi.generated.json`
- [ ] Regenerate `frontend/src/lib/generated/api-client.ts`
- [ ] Regenerate `frontend/src/api/openapi-types.ts`
- [ ] Run `python -m pytest backend/tests/test_contract_sync.py`
- [ ] Update `PROGRESS_CHECKLIST.md`
- [ ] Update `INTEGRATION_CHECKLIST.md` endpoint table
- [ ] Update `CHANGELOG.md`
- [ ] `npm run verify:sync` green

### Frontend Stream (branch: `codex/phase-b-frontend`)
- [ ] Replace billing page with:
  - [ ] Pricing tier cards (Free / Essential ₹999 / Executor ₹2,499)
  - [ ] Upgrade flow
  - [ ] Checkout flow (Razorpay integration)
  - [ ] Success page
  - [ ] Failure + retry page
- [ ] Add entitlement-aware navigation gating
- [ ] Add billing history page
- [ ] Add invoice download UX
- [ ] `lint` + `typecheck` + `build` + `test:smoke` green

### Exit Gate
- [ ] A real staging payment and refund update entitlement state in the UI without manual intervention

---

## Quick Wins ❌ NOT STARTED

> Rule: Land before Phase C so MVP order stays aligned with roadmap docs.

### Backend Stream
- [ ] Add "Quick wins" task section to workspace (accounts with simple one-click deletion)
- [ ] No new task model — extend existing task model with quick-win flag/category

### Sync / QA / Docs Stream
- [ ] Update OpenAPI if payload changes
- [ ] Regenerate client artifacts if needed
- [ ] Update phase docs

### Frontend Stream
- [ ] Add "Quick wins" section to executor task workspace
- [ ] Visual distinction for quick-win tasks

### Exit Gate
- [ ] Quick wins task-workspace gap shipped, documented, and verified

---

## Phase C — Family Workspace ❌ NOT STARTED

> Enables multi-participant collaboration on active cases.

### Backend Stream (branch: `codex/phase-c-backend`)
- [ ] Add participant membership model (beyond single executor)
- [ ] Add task assignment model
- [ ] Add comment threads model
- [ ] Add participant-aware activity visibility
- [ ] Add task-status email notifications
- [ ] Integration tests for participant CRUD, assignment, comments, notifications

### Sync / QA / Docs Stream (branch: `codex/phase-c-sync`)
- [ ] Sync participant payloads through public contract
- [ ] Sync assignment payloads
- [ ] Sync comment payloads
- [ ] Sync activity payloads
- [ ] Sync notification payloads
- [ ] Regenerate all artifacts
- [ ] Update phase docs
- [ ] `npm run verify:sync` green

### Frontend Stream (branch: `codex/phase-c-frontend`)
- [ ] Participant membership panel
- [ ] Task assignment flows
- [ ] Comment threads UI
- [ ] Participant-aware activity feed
- [ ] Task-status notification surfaces
- [ ] `lint` + `typecheck` + `build` + `test:smoke` green

### Exit Gate
- [ ] Multiple participants can collaborate on one active case with assignment, comments, notifications, and audit visibility

---

## Phase D — Crypto Inheritance Kit ❌ NOT STARTED

> Non-custodial only. No secret or seed storage. No UI copy implying custody.

### Backend Stream (branch: `codex/phase-d-backend`)
- [ ] Add planning-mode crypto asset input models
- [ ] Snapshot crypto planning data into case-time records at activation
- [ ] Expose executor crypto guidance payloads
- [ ] Integration tests for crypto planning, snapshot, guidance

### Sync / QA / Docs Stream (branch: `codex/phase-d-sync`)
- [ ] Sync crypto planning payloads through public contract
- [ ] Sync snapshot payloads
- [ ] Sync guidance payloads
- [ ] Regenerate all artifacts
- [ ] Update phase docs
- [ ] `npm run verify:sync` green

### Frontend Stream (branch: `codex/phase-d-frontend`)
- [ ] Planning workflow UI for crypto asset documentation
- [ ] Activation snapshot visibility in executor workspace
- [ ] Executor guidance experience (per-exchange step-by-step)
- [ ] Self-custody decision tree (seed phrase location known vs unknown)
- [ ] Clear non-custody disclaimers
- [ ] `lint` + `typecheck` + `build` + `test:smoke` green

### Exit Gate
- [ ] Crypto planning snapshots into after-loss mode without storing secrets

---

## Launch Closure ❌ NOT STARTED

> Complete only after Phases A–D are signed off.

### Pre-Launch Checklist
- [ ] Privacy Policy live
- [ ] Terms of Service live
- [ ] Contact/support email monitored (response < 24hrs)
- [ ] Payment flow tested end-to-end (success + failure + refund)
- [ ] PDF packet generation tested for top 10 platforms
- [ ] Heartbeat job tested (staging: accelerated timeline)
- [ ] Data deletion tested: user can delete account + all data
- [ ] Error monitoring live (Sentry)
- [ ] Uptime monitoring live
- [ ] Backup restoration tested
- [ ] Manual fraud review process documented
- [ ] Support runbook written

### Staging Provider Validation
- [ ] Razorpay tier checkout — order creation succeeds
- [ ] Razorpay captured event — updates payment status and entitlement state
- [ ] Razorpay refund event — reverses entitlement when required
- [ ] Billing history + invoice download work for paid order
- [ ] Postmark verification email delivered
- [ ] Postmark reset email delivered
- [ ] Postmark invite/recovery emails delivered
- [ ] Sentry event arrives with release + environment tags
- [ ] Alert routing fires for synthetic failure

### Go/No-Go
- [ ] Staging deploy green
- [ ] `critical-path-e2e` passed on release commit
- [ ] Razorpay + Postmark staging checks same-day as release approval
- [ ] Sentry release tagging verified
- [ ] Rollback owner assigned + on-call confirmed for first 24hrs
- [ ] `post_deploy_verify.py` passes against target environment

### Deploy + Verify
- [ ] Deploy backend + apply migrations
- [ ] Deploy frontend with matching API base URL
- [ ] Run `post_deploy_verify.py`
- [ ] Confirm GitHub deployment, Sentry release, provider dashboards match
- [ ] Mark MVP complete in status docs
- [ ] Relabel Phase E / B2B as `deferred-after-MVP`

### Exit Gate
- [ ] First paying user can complete full planning-mode + after-loss workflow in production

---

## Deferred After MVP

- [ ] Phase E: Multi-tenant B2B foundations, signed webhooks, tenant admin, branding, usage dashboards
- [ ] Mobile app (React Native)
- [ ] Analytics expansion (PostHog, Prometheus + Grafana)
- [ ] Platform partnerships (Google, Meta, EPFO, DigiLocker)
- [ ] AI-assisted letter drafting
- [ ] Hindi + regional language support
- [ ] International expansion (UK)

---

## Reusable Phase Template

> Copy this template for any new phase. Replace placeholders.

```markdown
## Phase [X] — [Name] ❌ NOT STARTED

> Rule: [key constraints]

### Backend Stream (branch: `codex/phase-[x]-backend`)
- [ ] [Backend task 1]
- [ ] [Backend task 2]
- [ ] Integration tests for [scope]
- [ ] `ruff` + `mypy` + `pytest` green

### Sync / QA / Docs Stream (branch: `codex/phase-[x]-sync`)
- [ ] Update `openapi.yaml` with [new payloads]
- [ ] Regenerate `openapi.generated.json`
- [ ] Regenerate `api-client.ts` + `openapi-types.ts`
- [ ] Update `PROGRESS_CHECKLIST.md`
- [ ] Update `INTEGRATION_CHECKLIST.md`
- [ ] Update `CHANGELOG.md`
- [ ] `npm run verify:sync` green

### Frontend Stream (branch: `codex/phase-[x]-frontend`)
- [ ] [Frontend task 1]
- [ ] [Frontend task 2]
- [ ] `lint` + `typecheck` + `build` + `test:smoke` green

### Exit Gate
- [ ] [measurable completion criteria]
```

---

## Stream Handoff Rules (For Every Phase)

1. **Backend lands first** — merge to `main`, then sync starts from refreshed `main`
2. **Sync lands second** — merge to `main`, then frontend starts from refreshed `main`
3. **Frontend lands third** — merge to `main`
4. **Never continue stale branches** — always recreate from latest `main`
5. **Never close a checklist item without evidence** — passing CI, staging proof, or documented sign-off
6. **Update 4 docs every sync stream**: `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, `INTEGRATION_CHECKLIST.md`
