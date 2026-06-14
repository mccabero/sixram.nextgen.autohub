# Phase 5 QA and Deployment Readiness Plan

Date: 2026-06-14

## Objective

Stabilize the migrated SIXRAM NextGen AutoHub application for production-style deployment on Next.js App Router, Prisma, PostgreSQL, Vercel, and Neon.

Phase 5 is not a broad feature-build phase. It is a readiness phase focused on proving that the copied frontend, migrated Route Handlers, Prisma schema, Neon data, security boundaries, storage strategy, reports, and deployment configuration work together.

## Current Status

Completed foundations:

- Next.js App Router shell.
- Prisma/PostgreSQL baseline.
- Neon development data migration.
- Auth and RBAC foundations.
- Core API migration waves.
- Operations/report compatibility.
- Copied frontend mounted inside Next.js.
- Legacy route catch-all for direct page refresh.

Known temporary compatibility areas:

- Local `uploads/...` filesystem is still used for login assets, company logos, inspection photos, appointment JSON, and Hikvision settings.
- Print endpoints return printable HTML rather than binary PDF.
- Hikvision snapshot testing returns a clear `501` until a network gateway exists.
- Chat endpoint returns a clear `503` until a provider is configured.
- Appointments use a local JSON compatibility store because the validated Prisma schema has no appointment table.

## Readiness Workstreams

### 1. Neon Data Smoke Testing

Goal: confirm the migrated backend can read real Neon development data after the frontend parity wave.

Checks:

- Prisma connects to Neon with the supplied pooled connection string.
- Core table counts are nonzero where expected.
- Public shell endpoints have data:
  - company info
  - login settings
- Auth/RBAC data exists:
  - users
  - roles
  - permissions
  - role permissions
- Core master data reads work:
  - customers
  - vehicles
  - configuration references
  - products/services/packages
- Operations reads work:
  - inspections
  - estimates
  - job orders
  - invoices
  - payments
  - deposits
  - quick sales
  - expenses
  - petty cash
- Report builders can execute without mutation.

Exit criteria:

- Read-only smoke completes without unhandled errors.
- Any empty modules are classified as either expected empty data or migration gap.
- No secrets are written to repository files or terminal reports.

### 2. Browser Workflow QA

Goal: verify copied frontend behavior against the new backend.

Priority walk-throughs:

- Login by PIN.
- Login by email/password.
- Dashboard load.
- Customer list, create, edit, delete/void behavior.
- Vehicle list and customer vehicle lookup.
- Configuration reference data screens.
- Product/service/package management.
- Inventory dashboard, audit, checks, transactions.
- Inspection to estimate.
- Estimate to job order.
- Job order completion.
- Invoice and payment flow.
- Deposit and quick sale flow.
- Expenses and petty cash screens.
- Reports and print buttons.
- RBAC page-access behavior.
- Admin user/role/void-code behavior.

Exit criteria:

- Each high-priority workflow has pass/fail notes.
- Any failed workflow is mapped to frontend, backend, data, storage, or deployment cause.
- Blocking issues are fixed before production deployment.

### 3. Storage Replacement

Goal: replace local filesystem assumptions before Vercel production.

Storage consumers:

- login background
- login logo
- company logo
- inspection photos
- Hikvision snapshots
- temporary appointment JSON if appointments remain file-backed

Recommended provider options:

- Vercel Blob for simplest Vercel-native deployment.
- S3 or Cloudflare R2 for portable object storage.
- Azure Blob if the organization already uses Azure.

Exit criteria:

- `STORAGE_PROVIDER` has a selected production value.
- Upload/read/delete routes use object storage in production.
- Local storage remains available only for local development.
- Existing uploaded assets have a migration path.

### 4. PDF and Print Strategy

Goal: decide whether printable HTML is acceptable or true PDFs are required.

Options:

- Keep printable HTML for browser print/save.
- Add a Node-compatible PDF renderer behind current route contracts.
- Use an external rendering service if Vercel runtime constraints become an issue.

Exit criteria:

- Stakeholder-approved report output format.
- Same route URLs preserved where possible.
- Report output tested for core operational forms and financial reports.

### 5. Hikvision Deployment Strategy

Goal: handle private camera network access safely.

Important constraint:

- Vercel may not be able to reach local/private Hikvision cameras.

Recommended patterns:

- Local/on-prem gateway service forwards camera events and snapshots to Vercel.
- VPN/private networking if infrastructure supports it.
- Keep Hikvision snapshot capture outside Vercel and sync stored snapshots to object storage.

Exit criteria:

- Event ingestion path selected.
- Snapshot capture path selected.
- Secrets are stored in deployment configuration, not repository files.
- Failure behavior is documented for unavailable cameras.

### 6. Chat Provider Decision

Goal: replace the temporary chat `503` route with the approved provider.

Inputs needed:

- Provider choice.
- Model.
- API key storage.
- Data retention rules.
- Allowed context sources.

Exit criteria:

- Chat endpoint has real provider integration or is intentionally disabled in production.
- No API keys are committed.
- Error behavior is user-friendly.

### 7. Vercel and Neon Deployment

Goal: prepare production-like deployment.

Environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_EXPIRY_MINUTES`
- `PASSWORD_HASHING_ITERATIONS`
- `STORAGE_PROVIDER`
- storage provider variables
- `HIKVISION_GATEWAY_BASE_URL`
- `HIKVISION_WEBHOOK_SECRET`
- chat provider variables if enabled

Deployment checks:

- `npm run db:validate`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run db:migrate:deploy` for managed migrations when production migration scripts are finalized

Exit criteria:

- Vercel preview deploy builds.
- Preview deployment can reach Neon.
- Protected APIs reject unauthenticated requests.
- Public APIs remain intentionally public.
- Rollback plan exists.

### 8. Security and QA Review

AEGIS review focus:

- Auth/session handling.
- RBAC enforcement.
- Public endpoint exceptions.
- Sensitive fields never returned.
- Void-code consumption.
- Upload type validation.
- Object storage access control.
- Input validation for mutating routes.
- Error messages do not expose secrets.

Exit criteria:

- High-risk security findings fixed.
- Residual risks documented.
- Release acceptance criteria signed off.

## Recommended Execution Order

1. Run read-only Neon smoke test.
2. Fix any immediate data/backend breakages.
3. Run browser workflow QA against real Neon data.
4. Choose object storage.
5. Replace local storage for production paths.
6. Choose PDF strategy.
7. Decide appointments persistence.
8. Decide Hikvision gateway strategy.
9. Decide chat provider strategy.
10. Prepare Vercel preview deployment.
11. Run AEGIS security review.
12. Run final ATLAS deployment checklist and rollback checklist.

## Phase 5 Exit Criteria

- Real Neon smoke testing passes.
- Critical browser workflows pass.
- Local filesystem storage is removed from production path or formally accepted as local-only.
- Deployment environment variables are documented.
- Vercel preview deployment passes build and runtime checks.
- Object storage, PDF, Hikvision, chat, and appointments decisions are closed.
- Security review is complete.
- Rollback checklist is ready.

