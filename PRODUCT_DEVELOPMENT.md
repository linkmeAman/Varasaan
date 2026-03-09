# 🛠️ Digital Legacy Manager — Product Development Roadmap

> Treat this as your engineering + product execution bible. Every phase has a checklist. Nothing moves to the next phase until the current one is complete.

---

## 🏗️ Architecture Decision Records (Decided Upfront)

Before writing a single line of code, these are locked:

```
Backend          → Python 3.12 + FastAPI (async, Pydantic v2 validation)
ORM              → SQLAlchemy 2.0 (async) + Alembic (migrations)
Database         → PostgreSQL (primary) + Redis (sessions/queues/rate-limiting)
Task Queue       → Celery + Redis broker (heartbeat jobs, PDF generation)
File Storage     → AWS S3 / GCP GCS with client-side encryption (AES-256)
Auth             → Passkey-first (WebAuthn) + TOTP fallback (pyotp)
                   JWT tokens: python-jose (RS256, not HS256)
Frontend         → Next.js (App Router) + React + TypeScript
Mobile           → React Native (Phase 3+)
Infra            → Docker + Kubernetes (GCP/AWS India region)
Email            → AWS SES / Postmark (transactional only)
PDF Generation   → WeasyPrint or ReportLab (server-side)
Audit Logs       → Append-only PostgreSQL table + optional blockchain anchor
Compliance       → DPDP-ready from Day 1 (India region data residency)
Testing          → pytest + pytest-asyncio + httpx (AsyncClient)
```

---

## 📦 Phase 0 — Foundation (Weeks 1–4)

> Goal: Infrastructure up, compliance posture set, zero features but bulletproof base.

### 0.1 Project Setup
- [ ] Monorepo structure (`/apps/web`, `/apps/api`, `/packages/shared`)
- [ ] Python 3.12 + `uv` for dependency management (faster than pip/poetry)
- [ ] `pyproject.toml` as single source of truth for deps + tooling config
- [ ] Ruff for linting + formatting (replaces Black + Flake8 + isort in one tool)
- [ ] mypy strict mode configured (type safety is non-negotiable for a compliance product)
- [ ] Pre-commit hooks: ruff + mypy + pytest on changed files
- [ ] Git branching strategy documented (`main` → `staging` → `feature/*`)
- [ ] `.env` management via Doppler or AWS Secrets Manager (no `.env` files in repo)
- [ ] Pydantic v2 Settings class for all config (never `os.environ.get` scattered in code)
- [ ] FastAPI app factory pattern (`create_app()`) — makes testing and multi-env clean

### 0.2 Database Schema (Core Tables)
- [ ] ⚠️ Use `asyncpg` as PostgreSQL driver from Day 1 — never sync SQLAlchemy with FastAPI
  ```python
  # Lock this in before writing any model
  engine = create_async_engine("postgresql+asyncpg://...")
  async def get_db():
      async with AsyncSession(engine) as session:
          yield session
  ```
- [ ] `users` — id, email, phone, created_at, deleted_at (soft delete)
- [ ] `accounts_inventory` — user_id, platform, account_type, access_status, notes
- [ ] `trusted_contacts` — user_id, contact_name, email, phone, role (executor/viewer)
- [ ] `documents` — user_id, doc_type, s3_key, encrypted, uploaded_at, expires_at
- [ ] `cases` — user_id (deceased), executor_id, status, opened_at, closed_at
- [ ] `tasks` — case_id, platform, task_type, status, evidence_doc_id, updated_at
- [ ] `audit_logs` — entity_type, entity_id, action, actor_id, timestamp, ip_hash
- [ ] `heartbeats` — user_id, last_checked_in, next_expected, escalation_level
- [ ] All tables: UUID primary keys, created_at/updated_at timestamps, soft deletes

### 0.3 Security Baseline
- [ ] All API routes require authenticated JWT (RS256, not HS256)
- [ ] Rate limiting on all public endpoints (express-rate-limit / nginx)
- [ ] HTTPS only, HSTS enabled
- [ ] S3 buckets: private, no public ACLs, versioning enabled
- [ ] Documents encrypted before upload (client-side AES key, never transmitted)
- [ ] Secrets never logged (scrubbed in logger middleware)
- [ ] SQL injection prevention: parameterised queries only (no raw string concat)
- [ ] CORS locked to known origins

### 0.4 DPDP Compliance Groundwork
- [ ] Data Processing Agreement template drafted (for B2B later)
- [ ] Privacy Policy written with DPDP language (data principal rights, fiduciary obligations)
- [ ] Consent capture mechanism implemented (granular, logged, revocable)
- [ ] Data retention policy documented (death certs deleted after case closure + 90 days)
- [ ] Breach response runbook written (who does what in first 72 hours)
- [ ] Data residency confirmed: all user data stored in India AWS/GCP region

### 0.5 CI/CD Pipeline
- [ ] GitHub Actions: lint → test → build → deploy to staging on PR merge
- [ ] Staging environment mirrors production (separate DB, separate S3)
- [ ] Production deploy requires manual approval gate
- [ ] Rollback procedure documented and tested
- [ ] Uptime monitoring set up (Better Uptime / UptimeRobot)
- [ ] Error tracking set up (Sentry)

---

## 📦 Phase 1 — MVP: Planning Mode (Weeks 5–12)

> Goal: A paying user can build their digital inventory and generate an evidence packet. Manual and slightly rough is fine. This is validation.

### 1.1 Auth + Onboarding
- [ ] Email + password signup (bcrypt, min entropy enforced)
- [ ] Email verification flow
- [ ] Optional: Google OAuth (convenient for target audience)
- [ ] Onboarding flow: name → phone → designate 1 trusted contact
- [ ] Profile: nominee/executor designation with relationship field
- [ ] Account deletion: hard delete + all associated data within 30 days (DPDP)

### 1.2 Account Inventory Builder
- [ ] Pre-built catalogue of 50+ Indian platforms:
  - Email: Gmail, Outlook, Yahoo, Rediffmail
  - Finance: Zerodha, Groww, HDFC Demat, SBI, ICICI, Paytm, PhonePe, UPI
  - Telecom: Airtel, Jio, BSNL, Vi
  - Govt: Aadhaar-linked accounts, DigiLocker, IRCTC, income tax portal
  - Social: Instagram, Facebook, LinkedIn, Twitter/X, YouTube
  - Streaming: Netflix, Hotstar, Spotify, Prime Video
  - Cloud: Google Drive, iCloud, OneDrive
  - Crypto: WazirX, CoinDCX, Coinbase, Binance, self-custody wallets
  - Work: Slack, GitHub, Notion, GSuite
- [ ] Custom account addition (free text + category)
- [ ] Per account: username (optional), notes, access instructions (encrypted), importance level
- [ ] "Where to find credentials" field: points to password manager, physical location, trusted person — NOT the credential itself
- [ ] Bulk import from CSV (Phase 1.5+)

### 1.3 Trusted Contact + Executor Designation
- [ ] Add executor by email + phone
- [ ] Executor receives invite email (must accept)
- [ ] Role-based access: executor sees inventory after death confirmed; viewer sees nothing until triggered
- [ ] Executor cannot access anything until "After-Loss Mode" is activated (multi-step)

### 1.4 Evidence Packet Generator (Core Feature)
- [ ] For each platform in inventory, generate a PDF packet containing:
  - Required documents checklist (death certificate, legal heir certificate, ID proof, etc.)
  - Pre-filled request letter (custodian-specific template)
  - Submission URL / email / process instructions
  - Expected timeline and escalation path
- [ ] Start with top 10 platforms for India:
  1. Gmail / Google Account (deceased user request form)
  2. Apple ID (Legacy Contact + court order path)
  3. Facebook / Instagram (memorialisation / removal)
  4. Zerodha / Groww (demat transmission)
  5. Jio / Airtel SIM (NOC + closure)
  6. WhatsApp (account deletion request)
  7. IRCTC (PNR + wallet closure)
  8. DigiLocker (account deactivation)
  9. PF / EPFO (nominee claim initiation)
  10. LIC / insurance (claim initiation pack)
- [ ] PDF generated server-side (Puppeteer or PDFKit)
- [ ] Packet versioned — if platform changes process, old packets flagged as stale
- [ ] Download as ZIP: all letters + checklist in one bundle

### 1.5 Heartbeat / Dead-Man Switch (Basic)
- [ ] User sets check-in frequency: monthly / quarterly
- [ ] Cron job sends reminder 7 days before expected check-in
- [ ] If no check-in: send 3 escalating reminders over 14 days
- [ ] If still no response: notify designated executor (not trigger full After-Loss mode yet)
- [ ] Full activation only after executor uploads death certificate + confirms
- [ ] All heartbeat events logged in audit_logs

### 1.6 Payment Integration
- [ ] Razorpay integration (India-first)
- [ ] One-time purchase for Essential + Executor tiers
- [ ] Invoice generation with GST (18%) for compliance
- [ ] Subscription model architecture ready (for Year 2 B2B recurring)
- [ ] Webhook handling: payment success → unlock features (idempotent)

---

## 📦 Phase 2 — After-Loss Mode (Weeks 13–22)

> Goal: Executor can manage the full closure process with task tracking, proof capture, and status updates.

### 2.1 Case Activation Flow
- [ ] Executor submits death certificate (PDF upload, encrypted)
- [ ] System validates: file is PDF, under 10MB, metadata stripped
- [ ] Optional: manual review step before full activation (for fraud prevention in V1)
- [ ] Once activated: executor gets full inventory view
- [ ] Notification sent to all designated contacts that case is open

### 2.2 Task Management (Kanban for Grief Ops)
- [ ] Auto-generate tasks from inventory: one task per account
- [ ] Task statuses: `Not Started` → `In Progress` → `Submitted` → `Waiting` → `Resolved` / `Escalated`
- [ ] Per task: notes field, document attachment, date submitted, reference number
- [ ] Task priority: auto-set based on account importance level from inventory
- [ ] "Quick wins" section: accounts that have simple one-click deletion (e.g., minor streaming services)
- [ ] Filter by: status / platform / category / priority

### 2.3 Evidence & Proof Capture
- [ ] Executor can upload confirmation emails / screenshots per task
- [ ] Auto-tag uploads by platform + date
- [ ] Closure proof stored encrypted for 90 days post-case (then auto-deleted per retention policy)
- [ ] Exportable "Closure Report" PDF: all tasks, statuses, evidence references, timeline

### 2.4 Subscription Bleeding Stopper
- [ ] Checklist of recurring payments to cancel (from inventory)
- [ ] For credit/debit card-linked subscriptions: bank dispute letter template
- [ ] For UPI autopay: guide to revoke through NPCI / bank app
- [ ] Estimated monthly bleed shown (user inputs amount during planning mode)

### 2.5 Family Workspace (Collaboration)
- [ ] Multiple executors / family members can be added to a case
- [ ] Task assignment: assign specific tasks to specific people
- [ ] Comment threads per task
- [ ] Activity log: who did what, when (full audit trail)
- [ ] Email notifications on task status changes

### 2.6 Crypto Inheritance Kit
- [ ] Planning mode: guided documentation wizard
  - Which exchanges? (WazirX, CoinDCX, Binance, Coinbase)
  - Self-custody wallets? (hardware vs software)
  - Seed phrase: where stored? (physical location hint only — never store seed phrase)
  - Optional: Shamir Secret Sharing setup guide (split seed phrase, M-of-N)
- [ ] After-loss mode: step-by-step guide per exchange's estate process
- [ ] WazirX / CoinDCX: nomination + transmission workflow
- [ ] Self-custody: "if seed phrase location is known" vs "if unknown" decision tree
- [ ] Legal referral: partner CA list for crypto estate matters (affiliate in future)
- [ ] ⚠️ Clear disclaimer: we never hold, see, or transmit keys or seed phrases

---

## 📦 Phase 3 — Scale & B2B (Months 6–12)

### 3.1 Platform Partnerships
- [ ] Apply to Google's Trusted Partner program (if applicable)
- [ ] Research Meta's official Memorial / Removal API access
- [ ] Build formal relationship with EPFO / DigiLocker integration (long-term)
- [ ] Identify 2 life insurers for pilot B2B conversation

### 3.2 White-Label / B2B API
- [ ] Multi-tenant architecture (organisation → users under org)
- [ ] Custom branding per B2B partner (logo, colours, subdomain)
- [ ] Webhook API for partner integration (case opened, case closed events)
- [ ] Usage dashboard for B2B admin
- [ ] Billing: per-seat or per-case pricing via Stripe/Razorpay subscription

### 3.3 Mobile App (React Native)
- [ ] Feature parity with web for Planning Mode
- [ ] Push notifications for heartbeat reminders
- [ ] Biometric unlock for app
- [ ] Offline-capable: inventory viewable without internet
- [ ] Document scanner (camera → PDF for death certificate upload)

### 3.4 Analytics & Observability
- [ ] PostHog or Mixpanel: funnel tracking (signup → inventory built → packet downloaded → paid)
- [ ] Prometheus + Grafana: infra metrics (API latency, DB query time, queue depth)
- [ ] Weekly business metrics dashboard: MRR, active cases, tasks closed, churn
- [ ] Alerting: PagerDuty for P0 (payment failures, auth failures, heartbeat job failures)

---

## 📦 Phase 4 — Moat Building (Year 2)

- [ ] Custodian-specific success rate tracking: which platforms resolve fastest?
- [ ] Community knowledge base: "What worked for Google India in 2025" (crowdsourced)
- [ ] AI-assisted letter drafting: Claude/GPT to personalise request letters based on case details
- [ ] Legal partner network: verified CAs and estate lawyers on platform (referral revenue)
- [ ] Hindi + regional language support (Marathi, Tamil, Telugu, Bengali)
- [ ] International expansion: UK (strong Indian diaspora, clear data protection laws)

---

## 🔒 Security Checklist (Ongoing — Every Sprint)

- [ ] Dependency audit: `pip-audit` in CI (block on high/critical)
- [ ] OWASP Top 10 review quarterly
- [ ] Penetration test before B2B launch
- [ ] Access logs reviewed monthly for anomalous patterns
- [ ] S3 bucket policy reviewed quarterly
- [ ] Rotate secrets quarterly (automated via Secrets Manager)
- [ ] Backup: daily DB snapshots, tested restore monthly

---

## 📋 Legal & Compliance Checklist (One-Time + Ongoing)

### One-time Setup
- [ ] Company incorporated (Private Limited recommended for B2B credibility)
- [ ] GST registration
- [ ] Privacy Policy published (DPDP-compliant)
- [ ] Terms of Service reviewed by a tech lawyer
- [ ] Disclaimer: "We are not a law firm. This is not legal advice." prominently placed
- [ ] DPDP: Register as Data Fiduciary if/when threshold crossed
- [ ] Data Processing Agreement template ready for B2B partners

### Ongoing
- [ ] Review platform terms of service (Google, Apple, Meta) quarterly — they change
- [ ] DPDP rule amendments: monitor MeitY announcements
- [ ] Legal review of any new feature that involves credential handling or account access
- [ ] Maintain "we never log into accounts" as an auditable fact (no such code in codebase)

---

## 🧪 Testing Standards

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | pytest + pytest-asyncio | 80%+ on business logic |
| Integration | httpx AsyncClient | All API endpoints |
| E2E | Playwright | Critical user journeys |
| Load | k6 | 500 concurrent users on PDF gen |
| Security | OWASP ZAP | Before each major release |

---

## 🚀 Launch Checklist (Before First Paying User)

- [ ] Privacy Policy live
- [ ] Terms of Service live
- [ ] Contact/support email monitored (real human response < 24hrs)
- [ ] Payment flow tested end-to-end (success + failure + refund)
- [ ] PDF packet generation tested for all 10 platforms
- [ ] Heartbeat job tested (staging: accelerated timeline)
- [ ] Data deletion tested: user can delete account + all data
- [ ] Error monitoring live (Sentry)
- [ ] Uptime monitoring live
- [ ] Backup restoration tested
- [ ] Manual fraud review process documented (for case activation)
- [ ] Support runbook: what to do if user reports wrong information in a letter template

---

## 📌 Definition of Done (Every Feature)

A feature is DONE only when:

1. ✅ Code reviewed by at least 1 other person
2. ✅ Unit + integration tests written and passing
3. ✅ Security implications documented
4. ✅ Audit log entry implemented if it involves user data
5. ✅ DPDP consent/retention impact assessed
6. ✅ Deployed to staging and smoke-tested
7. ✅ Product owner signed off

---

*Last updated: March 2026 | Version 1.0*
