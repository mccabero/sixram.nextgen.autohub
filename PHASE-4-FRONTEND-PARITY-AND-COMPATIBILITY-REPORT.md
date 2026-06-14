# Phase 4 Frontend Parity and Compatibility Report

Date: 2026-06-14

## Scope

Mounted the copied legacy React frontend inside the Next.js App Router app and added backend compatibility routes needed by the copied UI.

The intent remains frontend parity first: preserve the existing SIXRAM/Golden Wrench workflows and screen behavior while replacing the backend with Next.js Route Handlers, Prisma, and PostgreSQL.

## Frontend Integration

- Copied the legacy frontend source into `src/legacy`.
- Mounted the legacy React Router app from `src/app/page.tsx`.
- Added `src/app/[...slug]/page.tsx` so direct navigation and refreshes work for legacy routes such as `/login`, `/operations/...`, `/reports/...`, and `/administrators/...`.
- Added `src/app/legacy-app.tsx` as the client-only wrapper for `BrowserRouter`, auth, loading, and toast providers.
- Copied legacy global styles into `src/app/globals.css`.
- Added Tailwind/PostCSS configuration needed by the copied UI.
- Added copied frontend dependencies including FullCalendar, Chart.js, Recharts, React Router, Lucide, and date-range controls.
- Scoped ESLint to ignore `src/legacy/**` because copied parity code is intentionally preserved with its current TypeScript/React style.

## Compatibility Patches

- Normalized legacy auth base URL from `/api/Auth` to `/api/auth`.
- Normalized legacy vehicle calls from `/api/Vehicles` to `/api/vehicles`.
- Updated print openers to support printable HTML responses as well as future PDF responses.
- Added catch-all frontend routing to avoid Next.js 404s on direct legacy routes.

## Backend Compatibility Added

Operations:

- `GET/POST /api/operations/expenses`
- `GET /api/operations/expenses/summary`
- `GET /api/operations/expenses/next-reference`
- `GET/PUT/DELETE /api/operations/expenses/{id}`
- `GET/POST /api/operations/pettycashvouchers`
- `GET/PUT/DELETE /api/operations/pettycashvouchers/{id}`
- `POST /api/operations/{type}/{id}/void`
- `POST /api/operations/joborders/{id}/unlock-editing`
- `GET/POST /api/operations/inspections/{id}/photos`
- `GET/DELETE /api/operations/inspections/{id}/photos/{filename}`

Management reports:

- `GET /api/management/reports/inventory-products/print`
- `GET /api/management/reports/inventory-checks/print`

Assets:

- `GET/POST/DELETE /api/login-settings/background`
- `GET/POST/DELETE /api/login-settings/logo`
- `GET/POST /api/companyinfo/{id}/logo`

Integrations and support:

- `GET/POST /api/appointments`
- `GET/PUT/DELETE /api/appointments/{id}`
- `GET/DELETE /api/camera/hikvision/events`
- `GET /api/camera/hikvision/summary`
- `GET/PUT /api/camera/hikvision/settings`
- `POST /api/camera/hikvision/settings/test-snapshot`
- `POST /api/chat/messages`

## Intentional Stopgaps

- Appointment data uses a local JSON compatibility store under `uploads/appointments` because the validated Prisma schema has no Appointment model yet.
- Hikvision settings use a local JSON compatibility store under `uploads/hikvision`; the password is not returned, only `passwordConfigured`.
- Hikvision snapshot testing returns a clear `501` until a gateway/server can reach the private camera network.
- Chat returns a clear `503` until a chat provider is configured.
- File uploads currently use local `uploads/...` folders. For Vercel production, replace with object storage such as Vercel Blob, S3, R2, or Azure Blob.
- Print endpoints still return printable HTML, not binary PDF.

## Validation

- `npm run db:validate` passed.
- `npm run db:generate` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed with placeholder `DATABASE_URL`.
- Browser smoke test passed:
  - `/` redirects into the copied legacy app.
  - Direct `/login` renders the copied sign-in screen.
  - No browser console errors were reported in the smoke test.
- Secret scan passed for Neon/PostgreSQL connection string patterns.

## Known Warning

`next build` still reports a Turbopack/NFT trace warning around local filesystem upload helpers. This is expected while local `uploads/...` compatibility routes exist. It should be revisited when ATLAS chooses final object storage for production.

## Remaining Decisions

- Choose production object storage.
- Decide whether appointments become a real PostgreSQL module.
- Choose final PDF renderer if binary PDFs are required.
- Choose Hikvision deployment pattern for private network access.
- Choose and configure the Rapide AI chat provider.

