# Frontend (Next.js)

This app is now built with **Next.js App Router** + TypeScript.

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

## Route Compatibility

The Next.js app includes redirect compatibility for legacy links:

- `/register` -> `/login`
- `/recovery` -> `/login`
- `/dashboard/inventory` -> `/dashboard`
- unknown routes -> `/`
