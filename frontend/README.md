# Frontend (Next.js)

This app is built with **Next.js App Router** + TypeScript.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production build locally
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test:smoke` - run smoke test
- `npm run generate:api` - regenerate frontend API client/types from OpenAPI

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL` - backend base URL used by the frontend API client.

## Auth UX

Implemented routes:

- `/login` - real login + session handling
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

Compatibility redirects:

- unknown routes -> `/`
