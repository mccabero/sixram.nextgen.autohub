# Phase 3 Wave 7 - Reports and Print Endpoints

## Scope

Implemented the remaining report and print endpoint surface for the migrated Next.js Route Handler backend.

This wave intentionally uses printable HTML output instead of binary PDF generation. It preserves the legacy URLs and browser-print workflow while avoiding a premature PDF runtime choice for Vercel. A dedicated PDF renderer can be added later behind the same route contracts.

## Added Endpoints

- `GET /api/operations/reports/daily-sales`
- `GET /api/operations/reports/daily-sales/print`
- `GET /api/operations/reports/monthly-sales-summary/print`
- `GET /api/operations/reports/credit-card-payment/print`
- `GET /api/operations/reports/payment-type/print`
- `GET /api/operations/reports/accounts-receivable-daily/print`
- `GET /api/operations/reports/accounts-receivable-monthly/print`
- `GET /api/operations/reports/petty-cash-voucher/print`
- `GET /api/operations/reports/commissions-sa/print`
- `GET /api/operations/reports/commissions-tech/print`
- `GET /api/operations/reports/incentives-sa/print`
- `GET /api/operations/reports/incentives-tech/print`
- `GET /api/operations/inspections/{id}/print`
- `GET /api/operations/estimates/{id}/print`
- `GET /api/operations/joborders/{id}/print`
- `GET /api/operations/invoices/{id}/print`
- `GET /api/operations/payments/{id}/receipt`
- `GET /api/operations/payments/{id}/gate-pass`

## Files Added

- `src/server/reports/service.ts`
- `src/server/reports/html.ts`
- `src/server/reports/route-handlers.ts`
- Report route files under `src/app/api/operations/reports/...`
- Print route files under operation record folders

## Preserved Behavior

- Report date validation.
- Daily report single-day validation.
- Accounts receivable current/overdue balance calculations.
- Payment type filtering by `PAYMENT TYPE` parameters.
- Credit card payment bucketing and deduction calculations.
- Petty cash running balance reporting.
- Service advisor and technician commission/incentive staff matrix calculations.
- Gate pass guard for completed/paid, zero-balance payments only.
- Existing API authorization guard remains enabled.

## Validation

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run db:validate` passed with placeholder `DATABASE_URL`.
- `npm run build` passed with placeholder `DATABASE_URL`.
- Live Neon read-only smoke test passed for report builders and document print builders.

## Notes

- Build still reports the pre-existing Turbopack/NFT trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.
- The print endpoints currently return `text/html` with inline content disposition. Binary PDF generation remains a follow-up deployment decision.
