# 📊 Digital Legacy Manager — Progress & Next Steps Checklist

This document tracks the actual implementation progress against the `PRODUCT_DEVELOPMENT.md` roadmap. It serves as your daily dashboard for what has been completed and what to tackle next.

---

## 🟢 Phase 0 — Foundation (Completed)
*Infrastructure, compliance, and basic backend setup are functionally complete based on the integration checklists.*

- [x] **Project Setup**: Monorepo structure (`frontend`, `backend`, `packages`), tooling (`uv`, Ruff, pre-commit) configured.
- [x] **CI/CD Pipeline**: GitHub workflows, required checks (`contract-sync`, `pr-title-lint`, `backend-quality`), and environments (`staging`, `prod`) are active.
- [x] **Database Schema**: Core tables implemented and integrated.
- [x] **Security Baseline**: JWT/Cookies flow, double-submit CSRF, OpenAPI contract sync established.

---

## 🟡 Phase 1 — MVP: Planning Mode (In Progress)
*Backend APIs are heavily built and synced. The primary focus right now should be completing the Frontend UI and tying everything together.*

### Backend / API (Mostly Complete)
- [x] **Auth + Onboarding**: Signup, login, email verification, password reset APIs are synced.
- [x] **Account Inventory Builder**: Accounts API endpoints are synced.
- [x] **Trusted Contacts**: Invite, accept, list, and revoke APIs are synced.
- [x] **Evidence Packet Generator**: Job creation and retrieval APIs (exports & packets) are synced.
- [x] **Payment Integration**: Razorpay checkout and webhook APIs are synced.
- [x] **Document Management**: Uploads init, grants, and scan queue APIs are synced.
- [ ] **Heartbeat / Dead-Man Switch**: Cron jobs and related endpoints for the heartbeat ping and escalation reminders.

### Frontend / UI (Current Focus)
- [ ] **Auth Flow Screens**: Login, Registration, Password Reset UI.
- [ ] **Dashboard / Inventory Builder**: UI to add/manage 50+ platforms, fill credentials hints, etc.
- [ ] **Trusted Contacts UI**: Screens to invite executors and setup relationships.
- [ ] **Payment & Checkout UI**: Razorpay frontend integration for Essential/Executor tiers.
- [ ] **Document Uploads UI**: Safe client-side UI to upload death certificates/evidence.

---

## 🔴 Phase 2 — After-Loss Mode (Pending)
*This phase will be tackled once the MVP Planning Mode is fully usable by the person planning their estate.*

- [ ] **Case Activation Flow** (Executor dashboard activation, death certificate validation)
- [ ] **Task Management / Kanban** (Auto-generating tasks from inventory)
- [ ] **Evidence & Proof Capture** (Uploading completion states)
- [ ] **Subscription Bleeding Stopper** (Cancellation checklists)
- [ ] **Family Workspace** (Collaboration threads and assignment)
- [ ] **Crypto Inheritance Kit** 

---

## 🔮 Phase 3 & 4 (Future Roadmap)
- [ ] B2B APIs & White-labeling
- [ ] React Native Mobile App
- [ ] Analytics & Observability
- [ ] AI-assisted letter drafting & Regional languages

---

## 🚀 Immediate Next Steps (What to do today)

1. **Frontend UI Implementation**: Continue building the React/Next.js screens (`apps`, `views`, `components`) to consume the synced OpenAPIs for Auth, Inventory, and Trusted Contacts.
2. **Heartbeat System Backend**: Implement the background job (Celery/Postgres) and endpoints for the heartbeat/dead-man switch mechanism.
3. **End-to-End Testing**: Start tying the frontend directly to the staging backend testing Razorpay, Email flows, and PDF generation from the actual UI.
