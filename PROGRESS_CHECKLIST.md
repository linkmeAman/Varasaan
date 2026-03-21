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
*Core planning-mode frontend surfaces are now in place. The primary focus is closing out the remaining payment and heartbeat gaps.*

### Backend / API (Mostly Complete)
- [x] **Auth + Onboarding**: Signup, login, email verification, password reset APIs are synced.
- [x] **Account Inventory Builder**: Accounts API endpoints are synced.
- [x] **Trusted Contacts**: Invite, accept, list, and revoke APIs are synced.
- [x] **Evidence Packet Generator**: Job creation and retrieval APIs (exports & packets) are synced.
- [x] **Payment Integration**: Razorpay checkout and webhook APIs are synced.
- [x] **Document Management**: Uploads init, grants, and scan queue APIs are synced.
- [ ] **Heartbeat / Dead-Man Switch**: Cron jobs and related endpoints for the heartbeat ping and escalation reminders.

### Frontend / UI (Current Focus)
- [x] **Auth Flow Screens**: Login, Registration, Password Reset UI.
- [x] **Dashboard / Inventory Builder**: UI to add/manage inventory accounts and account details.
- [x] **Trusted Contacts UI**: Screens to invite executors and setup relationships.
- [ ] **Payment & Checkout UI**: Razorpay frontend integration for Essential/Executor tiers.
- [x] **Document Uploads UI**: Owner document vault uploads plus executor death-certificate activation upload.

---

## 🟠 Phase 2 — After-Loss Mode (In Progress)
*The first Phase 2.1 / 2.2 slice is now implemented for a single executor per owner via trusted contacts. The remaining items below stay out of scope for this slice.*

- [x] **Executor Designation + Pending Cases**: Owners can assign an `executor` role in trusted contacts, and accepted executors can see pending or active cases.
- [x] **Case Activation Flow (V1)**: Executor-only pending case visibility, case-scoped death-certificate upload, PDF / 10 MB validation, and idempotent activation.
- [x] **Task Management / Kanban (V1)**: One task per inventory account, stable snapshot generation at activation, board/list filters, and editable notes/status/reference/submitted date.
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

1. **Heartbeat System Backend**: Implement the background job (Celery/Postgres) and endpoints for the heartbeat/dead-man switch mechanism.
2. **Payment & Checkout Finish**: Complete the remaining frontend payment flow and staging validation.
3. **Finish the remaining Phase 2 work**: evidence uploads, manual review, notifications, multi-participant collaboration, and closure reporting.
