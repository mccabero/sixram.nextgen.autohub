# Phase 3 Wave 6G Report: Invoice Read APIs

## Scope

Implemented read-only invoice and accounts receivable API coverage for the Next.js App Router migration.

## Endpoints Added

- `GET /api/operations/invoices`
- `GET /api/operations/invoices/summary`
- `GET /api/operations/invoices/next-reference`
- `GET /api/operations/invoices/{id}`
- `GET /api/operations/accounts-receivable`
- `GET /api/operations/accounts-receivable/summary`

## Files Changed

- `src/server/operations/invoices.ts`
- `src/app/api/operations/invoices/route.ts`
- `src/app/api/operations/invoices/summary/route.ts`
- `src/app/api/operations/invoices/next-reference/route.ts`
- `src/app/api/operations/invoices/[id]/route.ts`
- `src/app/api/operations/accounts-receivable/route.ts`
- `src/app/api/operations/accounts-receivable/summary/route.ts`

## Legacy Behavior Preserved

- Invoice list returns migrated invoice records with camel-case API fields.
- Invoice summary is ordered by newest created invoice first, then highest id.
- Invoice summary includes customer, job order reference, VAT, totals, deposit amount, paid amount, balance due, package flag, and status.
- Invoice next reference follows the legacy `INV0000001` pattern and increments the latest invoice number by invoice id.
- Invoice detail includes customer, advisor, estimator, approver, service group, vehicle, job order, package, service, product, and technician details.
- Invoice detail falls back to linked estimate package/service/product lines when job order or invoice package lines are unavailable.
- Invoice detail falls back to job order packages when invoice packages and estimate packages are unavailable.
- Accounts receivable supports `start` and `end` query filters.
- Accounts receivable rejects date ranges where `end` is before `start`.
- Accounts receivable excludes deleted, voided, and cancelled invoice, deposit, and payment statuses.
- Accounts receivable subtracts deposits and payments from invoice totals, returns only open balances, and derives `CURRENT` or `OVERDUE` status from due dates.

## Validation

- `npm run typecheck` passed.
- `npm run db:validate` passed with a placeholder PostgreSQL URL.
- `npm run lint` passed.
- `npm run build` passed with the known pre-existing Turbopack trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.

## Neon Smoke Test

Read-only smoke testing against Neon passed:

- Invoices list count: `1356`
- Invoice summary count: `1356`
- Next invoice reference: `INV0001357`
- Accounts receivable open-balance rows: `24`
- Invoice detail sample id: `23511`
- Sample invoice detail child counts:
  - Services: `1`
  - Products: `1`
  - Packages: `0`
  - Technicians: `2`

## Notes

- The Neon/PG adapter emitted an SSL advisory for `sslmode=require`; deployment should review whether to use `sslmode=verify-full` or the documented compatibility flag.
- This wave is read-only. Invoice create, update, package sync, job order invoice linking, and soft delete are deferred to Wave 6H.
