# Phase 3 Wave 6H Report: Invoice Mutations

## Scope

Implemented invoice write coverage and the legacy job-order completion flow that converts an open job order into an invoice.

## Endpoints Added or Extended

- `POST /api/operations/invoices`
- `PUT /api/operations/invoices/{id}`
- `DELETE /api/operations/invoices/{id}`
- `POST /api/operations/joborders/{id}/complete`

## Files Changed

- `src/server/operations/invoices.ts`
- `src/app/api/operations/invoices/route.ts`
- `src/app/api/operations/invoices/[id]/route.ts`
- `src/app/api/operations/joborders/[id]/complete/route.ts`

## Legacy Behavior Preserved

- Invoice create rejects duplicate job-order links and returns a conflict payload with invoice id and invoice number.
- Invoice create generates the next invoice number when no invoice number is supplied.
- Invoice update supports partial field updates and blocks reopening non-open invoice records back to `OPEN`.
- Invoice delete follows the operation-record soft-delete pattern by moving the invoice to `DELETED`.
- Job-order complete:
  - Requires `OPEN` and `COMPLETED` statuses to exist.
  - Allows completing an already completed job order only when an invoice already exists.
  - Creates a new invoice from the job order totals and customer/advisor metadata.
  - Copies job order packages into invoice packages.
  - Falls back to linked estimate packages when job order packages are unavailable.
  - Updates the job order to `COMPLETED` and links `InvoiceId`.
  - Returns the existing invoice when the job order is already linked.

## Validation

- `npm run typecheck` passed.
- `npm run db:validate` passed with a placeholder PostgreSQL URL.
- `npm run lint` passed.
- `npm run build` passed with the known pre-existing Turbopack trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.

## Neon Smoke Test

Write smoke testing used a direct Neon connection because this wave exercises interactive transactions. Temporary rows were hard-cleaned after verification.

Verified:

- Direct invoice create succeeded.
- Duplicate invoice create for the same job order returned conflict behavior.
- Invoice update succeeded.
- Reopening a completed invoice back to `OPEN` was blocked.
- Invoice soft delete moved the invoice to `DELETED`.
- Job-order complete created an invoice.
- Job-order complete copied one package into `InvoicePackages`.
- Job-order complete linked the job order to the invoice.
- Job-order complete moved the job order to `COMPLETED`.
- Re-running job-order complete returned the existing invoice.
- Cleanup verification found `0` Wave 6H temporary job orders and `0` Wave 6H temporary invoices.

## Notes

- The Neon/PG adapter emitted the same SSL advisory for `sslmode=require`; deployment should review whether to use `sslmode=verify-full` or the documented compatibility flag.
- Invoice proceed-to-payment remains deferred to the payments wave because it creates payment records and changes invoice payment state.
