# 🏗️ Industry-Standard Execution Blueprint: Phase 1 & 2

This document provides a senior-engineering level architectural breakdown and step-by-step implementation guide for the remaining tasks defined in `PROGRESS_CHECKLIST.md`. It adheres to modern enterprise standards for Next.js 15 (App Router), React 19, and scalable Python/FastAPI architectures.

---

## 🏗️ Architectural Guiding Principles (Frontend)

To ensure this application meets "industry scale" and compliance (DPDP/SOC2 readiness), the following paradigms **must** be followed for all remaining UI work:

1. **RSC (React Server Components) First**: Default all components in `src/app` to Server Components to reduce the JavaScript bundle size and improve LCP (Largest Contentful Paint). Only use `'use client'` at the lowest possible leaf node (e.g., specific interactive forms, buttons).
2. **Strict Type Safety**: Use the generated OpenAPI types (`frontend/src/api/openapi-types.ts`) for all API requests and component props. No `any` types.
3. **Data Fetching & Caching**: Use Next.js native `fetch` with granular `revalidate` tags for public data. For authenticated user data, manage state using React Context combined with SWR or React Query to handle background refetching and stale-while-revalidate logic.
4. **Secure State Management**: The session token MUST remain in HTTP-only cookies. The frontend UI should only hold a non-sensitive `User` object context, never the raw JWT.
5. **Resilience & UX**: Every API call must be wrapped in generic error handlers. Use global `<ErrorBoundary>` and `Suspense` boundaries with skeletal loaders to prevent layout shift (CLS).

---

## 🛠️ Step 1: Secure Authentication & Session Layer

**Objective**: Connect the Next.js UI to the finalized `/api/v1/auth/*` endpoints using industry-standard CSRF and Session patterns.

- [ ] **1.1 Axios Interceptor Setup** (`frontend/src/lib/api-client.ts`)
  - Implement an Axios instance that globally intercepts 401 Unauthorized errors and attempts to call `POST /api/v1/auth/refresh`.
  - On a 403 CSRF Failure, automatically re-fetch the CSRF token from `GET /api/v1/auth/csrf` and retry the original request.
- [ ] **1.2 Global Auth Provider** (`frontend/src/lib/auth-context.tsx`)
  - Create a React Context (`AuthContext`) that fetches `GET /api/v1/auth/me` on mount.
  - Implement a `useAuth` custom hook returning `{ user, isLoading, error, login, logout }`.
- [ ] **1.3 Edge Route Protection** (`frontend/src/middleware.ts`)
  - Implement Next.js Middleware to protect `/dashboard/*` routes. If the session cookie is missing, perform a 302 redirect to `/login` before rendering occurs.
- [ ] **1.4 Login & Registration UI** (`src/app/login/`, `src/app/register/`)
  - Build accessible forms using `react-hook-form` and `zod` for strict client-side validation.
  - Ensure password inputs meet minimum entropy guidelines visually (Password strength meter).
  - Submit using the `useAuth` hook. On success, use `router.push('/dashboard')` with `router.refresh()` to hydrate server components.

---

## 📊 Step 2: The Core Dashboard & Inventory Engine

**Objective**: Build a highly performant, accessible grid for users to input their digital legacy inventory.

- [ ] **2.1 Dashboard Shell Architecture** (`src/app/dashboard/layout.tsx`)
  - Build a responsive App Shell with a collapsing sidebar (use `lucide-react` for iconography).
  - Implement Breadcrumb navigation dynamically based on the current route.
- [ ] **2.2 Optimistic UI for Inventory Grid** (`src/app/dashboard/page.tsx`)
  - Fetch `GET /api/v1/inventory/accounts`. Render skeletal loaders while fetching.
  - Render Accounts using a reusable `<AccountCard />` component.
  - **Performance**: Implement "Virtualization" (e.g., `@tanstack/react-virtual`) if the account list grows beyond 100 items to maintain 60FPS scrolling.
- [ ] **2.3 Create Account Modal** (`src/components/ui/AccountModal.tsx`)
  - Create an accessible Dialog (`radix-ui/react-dialog` or Headless UI).
  - Form matching `InventoryCreateRequest` (Platform, credentials hint, notes, priority).
  - **UX**: Use optimistic updates. When the user hits "Save", instantly add the item to the UI state while the remote `POST /api/v1/inventory/accounts` request resolves in the background. Rollback on failure.

---

## 🔐 Step 3: High-Security Document & Contacts UI

**Objective**: Safely upload sensitive documents (death certificates) and securely invite executors.

- [ ] **3.1 Trusted Contacts Management** (`src/app/dashboard/contacts/page.tsx`)
  - Fetch `GET /api/v1/trusted-contacts`.
  - Handle state transitions gracefully: Invite Sent (Pending) → Accepted (Active).
  - Add a "Revoke Access" dangerous action with a secure confirmation dialog (typing the person's name to confirm).
- [ ] **3.2 Multipart Document Upload Pipeline** (`src/components/ui/DocumentUploader.tsx`)
  - Must use a multi-stage upload to prevent backend memory exhaustion:
    1. Call `POST /api/v1/documents/uploads/init` to get a short-lived presigned URL.
    2. Upload the `File` object via `fetch` directly to the S3/GCS presigned URL, tracking progress (`xhr.upload.onprogress`) for a UI progress bar.
    3. Call `POST /api/v1/documents/versions/{versionId}/scan` to notify the backend the upload succeeded and queue an AV scan.

---

## 💳 Step 4: Monetization Integration (Razorpay)

**Objective**: Implement a frictionless checkout flow with bulletproof verification.

- [ ] **4.1 Resilient Checkout Flow** (`src/app/dashboard/checkout/page.tsx`)
  - Fetch `POST /api/v1/payments/checkout` to generate the `order_id`.
  - Inject the Razorpay Web SDK asynchronously.
  - On payment success, **DO NOT trust the client callback alone**. Render a "Verifying..." animation while polling `GET /api/v1/payments/{orderId}` every 2 seconds until the backend webhook updates the order status to `SUCCESS`.

---

## ⚙️ Step 5: Distributed Heartbeat System (Backend)

**Objective**: Build a fault-tolerant, scalable Dead-Man Switch that guarantees exactly-once execution.

- [ ] **5.1 Database Implementation** (`backend/app/models/heartbeat.py`)
  - Table schemas must use strict indexing on `next_expected` timestamp to optimize background polling.
- [ ] **5.2 Celery Beat Producer** (`backend/app/workers/heartbeat_scheduler.py`)
  - Create a cron-driven Celery task running every 5 minutes.
  - Query: `SELECT id FROM heartbeats WHERE next_expected < NOW() AND status = 'ACTIVE'`.
- [ ] **5.3 Idempotent Consumer Tasks** (`backend/app/workers/heartbeat_tasks.py`)
  - Use `SELECT FOR UPDATE SKIP LOCKED` (Row-level locking) when picking up a heartbeat to process. This prevents two concurrent workers from sending duplicate warning emails to the same user.
  - If escalation reaches maximum, dispatch an event to the API to trigger `Phase 2: After-Loss Mode`.
  - Log every transition immutably to the `audit_logs` table for compliance.

---

## 🧪 Step 6: Automated Quality Gates (E2E)

**Objective**: Ensure regressions are impossible before merging to `main`.

- [ ] **6.1 Playwright Smoke Tests** (`frontend/tests/e2e/critical-path.spec.ts`)
  - **Test 1**: User Signup -> Email Verification (mocked) -> Login -> Session preserved across reload.
  - **Test 2**: Create Account in Inventory -> Assert it displays -> Reload page -> Assert it still displays.
  - **Mocking**: For external services (Razorpay, AWS S3), utilize Playwright's `page.route` to mock network responses to make the CI pipeline deterministic and fast.

---

### Definition of Done for these Tasks
1. **0 Errors via `npm run typecheck`** (Strict TypeScript).
2. **0 Warnings via `npm run lint`** (ESLint / Ruff).
3. **Accessibility passed**: Lighthouse score of 100 for Accessibility.
4. **Tested**: PRs include Playwright tests for new components.
