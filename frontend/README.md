# Frontend (Next.js)

This app is built with **Next.js App Router** + TypeScript.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production build locally
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test:smoke` - run smoke test
- `npm run test:e2e` - run the blocking Playwright critical-path suite
- `npm run test:e2e:headed` - run the Playwright suite with a visible browser
- `npm run generate:api` - regenerate frontend API client/types from OpenAPI

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL` - backend base URL used by the frontend API client.
- `PLAYWRIGHT_BASE_URL` - frontend base URL used by Playwright.
- `PLAYWRIGHT_API_BASE_URL` - backend base URL used by Playwright helpers.

`NEXT_PUBLIC_API_BASE_URL` is compiled into the production bundle, so rebuild the app before `npm run start` if the backend origin changes.

## Auth UX

Implemented routes:

- `/login` - real login + cookie session handling
- `/register` - signup + policy-consent fetch + email verification token flow
- `/recovery` - password reset + account recovery assist/confirm flows

Protected workspaces:

- `/dashboard`
- `/dashboard/inventory`
- `/dashboard/trusted-contacts`
- `/dashboard/documents`
- `/dashboard/packets`
- `/dashboard/exports`
- `/dashboard/billing`
- `/executor`
- `/executor/cases/[caseId]`

Executor routes:

- `/executor` - landing page for pending and active executor cases, including the pending-case activation screen.
- `/executor/cases/[caseId]` - task-centric executor workspace with filters, Kanban columns, and task editing.

Compatibility redirects:

- unknown routes -> `/`
